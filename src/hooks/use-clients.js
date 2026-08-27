import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { usePersistentState } from "./use-persistent-state";
import { findClientByCnpj, DuplicateClientError } from "../utils/client-dedup";

export { DuplicateClientError };

// Chave local usada apenas no modo offline (sem Supabase configurado).
const LOCAL_KEY = "sanwey.clients";

function rowToClient(r) {
  return {
    id: r.id,
    name: r.name,
    razaoSocial: r.razao_social ?? null,
    category: r.category ?? null,
    city: r.city ?? null,
    state: r.state ?? null,
    cnpj: r.cnpj ?? null,
    address: r.address ?? null,
    companyIds: Array.isArray(r.company_ids) ? r.company_ids : [],
    ownerIds: Array.isArray(r.owner_ids) ? r.owner_ids : [],
    externalCodes: r.external_codes && typeof r.external_codes === "object" ? r.external_codes : {},
    status: r.status || "ativo",
    notes: r.notes ?? null,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function clientToRow(c, extras = {}) {
  return {
    ...(c.id ? { id: c.id } : {}),
    name: c.name,
    razao_social: c.razaoSocial ?? null,
    category: c.category ?? null,
    city: c.city ?? null,
    state: c.state ?? null,
    cnpj: c.cnpj ?? null,
    address: c.address ?? null,
    company_ids: Array.isArray(c.companyIds) ? c.companyIds : [],
    owner_ids: Array.isArray(c.ownerIds) ? c.ownerIds : [],
    external_codes: c.externalCodes && typeof c.externalCodes === "object" ? c.externalCodes : {},
    status: c.status || "ativo",
    notes: c.notes ?? null,
    ...extras,
  };
}

function patchToRow(patch) {
  const map = { companyIds: "company_ids", ownerIds: "owner_ids", createdBy: "created_by", externalCodes: "external_codes", razaoSocial: "razao_social" };
  const out = {};
  for (const [k, v] of Object.entries(patch)) out[map[k] || k] = v;
  return out;
}

// Cadastro central de clientes. Espelha o padrão de use-leads: Supabase com
// realtime, fallback em localStorage quando o Supabase não está configurado.
export function useClients({ userId } = {}) {
  const [fallbackClients, setFallbackClients] = usePersistentState(LOCAL_KEY, []);
  const [remoteClients, setRemoteClients] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("clients")
        .select("*")
        .order("name", { ascending: true });
      if (err) throw err;
      if (!activeRef.current) return;
      setRemoteClients((data || []).map(rowToClient));
    } catch (e) {
      if (!activeRef.current) return;
      setError(e);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    if (!isSupabaseConfigured) { setLoading(false); return; }
    fetchAll();
    // Nome de canal único por instância — evita colisão quando o hook é
    // usado por múltiplos componentes ao mesmo tempo.
    const channelName = `clients-all-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, (payload) => {
        if (!activeRef.current) return;
        if (payload.eventType === "DELETE") {
          setRemoteClients(prev => prev.filter(c => c.id !== payload.old.id));
        } else if (payload.eventType === "INSERT") {
          setRemoteClients(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, rowToClient(payload.new)]);
        } else if (payload.eventType === "UPDATE") {
          setRemoteClients(prev => prev.map(c => c.id === payload.new.id ? rowToClient(payload.new) : c));
        }
      })
      .subscribe();
    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const clients = isSupabaseConfigured ? remoteClients : fallbackClients;

  // Guard central contra duplicata por CNPJ — vale pra todo caminho de
  // criação (ClientsManager, ClientQuickCreateModal, LeadDetailDrawer via
  // Sinais etc.), não só quem lembrar de checar antes de chamar. Usa ref
  // pra não recriar createClient a cada mudança da lista.
  const clientsRef = useRef(clients);
  useEffect(() => { clientsRef.current = clients; }, [clients]);

  // `contact` (opcional) captura o contato principal já na tela de criação —
  // sem isso, cadastrar um contato exigia salvar o cliente, reabrir e ir na
  // aba Contatos (por isso client_contacts nascia praticamente vazia). O
  // cliente é sempre salvo primeiro: se o INSERT do contato falhar (RLS,
  // rede), o cliente criado NÃO é desfeito — o erro carrega `clientSaved`
  // pra quem chamou decidir como avisar sem fingir que nada foi salvo.
  const createClient = useCallback(async (client, contact) => {
    const dup = findClientByCnpj(clientsRef.current, client.cnpj);
    if (dup) throw new DuplicateClientError(dup);

    if (!isSupabaseConfigured) {
      // Modo local/demo não tem equivalente de client_contacts — um contato
      // digitado aqui é descartado sem aviso porque não há canal de erro
      // pra esse caminho hoje (não é o modo real usado em produção).
      if (contact?.name?.trim()) console.warn("[createClient] Contato principal ignorado — modo local/demo não persiste client_contacts.");
      const local = { ...client, id: `local-${Date.now()}`, createdAt: new Date().toISOString() };
      setFallbackClients(prev => [...prev, local].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      return local;
    }
    const row = clientToRow(client, { created_by: userId });
    const { data, error: err } = await supabase.from("clients").insert(row).select().single();
    if (err) { setError(err); throw err; }
    const saved = rowToClient(data);
    setRemoteClients(prev => prev.some(c => c.id === saved.id) ? prev : [...prev, saved]);

    if (contact?.name?.trim()) {
      const { error: contactErr } = await supabase.from("client_contacts").insert({
        client_id: saved.id,
        name: contact.name.trim(),
        email: contact.email?.trim() || null,
        phone: contact.phone?.trim() || null,
        job_title: contact.jobTitle?.trim() || null,
      });
      if (contactErr) {
        const wrapped = new Error(`Cliente criado, mas o contato não foi salvo: ${contactErr.message}`);
        wrapped.clientSaved = saved;
        throw wrapped;
      }
    }
    return saved;
  }, [setFallbackClients, userId]);

  const updateClient = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) {
      setFallbackClients(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
      return;
    }
    setRemoteClients(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    // .select() + checagem de vazio: sem isso, um UPDATE bloqueado pela RLS
    // (clients_update) volta error:null e data:[] — silenciosamente não
    // grava nada, mas a tela otimista já mostrou como salvo. Mesmo padrão
    // já aplicado nos outros hooks de update da plataforma.
    const { data, error: err } = await supabase.from("clients").update(patchToRow(patch)).eq("id", id).select();
    if (err) { setError(err); fetchAll(); throw err; }
    if (!data || data.length === 0) {
      fetchAll();
      throw new Error("Não foi possível salvar as alterações do cliente — verifique suas permissões.");
    }
  }, [setFallbackClients, fetchAll]);

  const deleteClient = useCallback(async (id) => {
    if (!isSupabaseConfigured) {
      setFallbackClients(prev => prev.filter(c => c.id !== id));
      return;
    }
    const removed = clients.find(c => c.id === id);
    setRemoteClients(prev => prev.filter(c => c.id !== id));
    const { error: err } = await supabase.from("clients").delete().eq("id", id);
    if (err) {
      setError(err);
      if (removed) setRemoteClients(prev => [...prev, removed]);
      fetchAll().catch(() => {});
      throw err;
    }
  }, [clients, setFallbackClients, fetchAll]);

  // Faturamento histórico por ano — tabela própria (client_billing_history),
  // não colunas fixas por ano. `entries`: [{ year, totalValue, orderCount }].
  // Usado hoje só pelo import de planilha (ClientImportModal); em modo
  // offline (sem Supabase) é no-op, já que a tabela não existe no fallback local.
  const upsertClientBillingHistory = useCallback(async (clientId, entries) => {
    if (!isSupabaseConfigured || !entries || entries.length === 0) return;
    const rows = entries.map(e => ({
      client_id: clientId,
      year: e.year,
      total_value: e.totalValue || 0,
      order_count: e.orderCount || 0,
    }));
    const { error: err } = await supabase.from("client_billing_history").upsert(rows, { onConflict: "client_id,year" });
    if (err) { setError(err); throw err; }
  }, []);

  return useMemo(() => ({
    clients,
    loading,
    error,
    createClient,
    updateClient,
    deleteClient,
    upsertClientBillingHistory,
    refetch: fetchAll,
  }), [clients, loading, error, createClient, updateClient, deleteClient, upsertClientBillingHistory, fetchAll]);
}
