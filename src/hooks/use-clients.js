import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { usePersistentState } from "./use-persistent-state";

// Chave local usada apenas no modo offline (sem Supabase configurado).
const LOCAL_KEY = "sanwey.clients";

function rowToClient(r) {
  return {
    id: r.id,
    name: r.name,
    category: r.category ?? null,
    city: r.city ?? null,
    state: r.state ?? null,
    cnpj: r.cnpj ?? null,
    companyIds: Array.isArray(r.company_ids) ? r.company_ids : [],
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
    category: c.category ?? null,
    city: c.city ?? null,
    state: c.state ?? null,
    cnpj: c.cnpj ?? null,
    company_ids: Array.isArray(c.companyIds) ? c.companyIds : [],
    notes: c.notes ?? null,
    ...extras,
  };
}

function patchToRow(patch) {
  const map = { companyIds: "company_ids", createdBy: "created_by" };
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

  const createClient = useCallback(async (client) => {
    if (!isSupabaseConfigured) {
      const local = { ...client, id: `local-${Date.now()}`, createdAt: new Date().toISOString() };
      setFallbackClients(prev => [...prev, local].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      return local;
    }
    const row = clientToRow(client, { created_by: userId });
    const { data, error: err } = await supabase.from("clients").insert(row).select().single();
    if (err) { setError(err); throw err; }
    const saved = rowToClient(data);
    setRemoteClients(prev => prev.some(c => c.id === saved.id) ? prev : [...prev, saved]);
    return saved;
  }, [setFallbackClients, userId]);

  const updateClient = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) {
      setFallbackClients(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
      return;
    }
    setRemoteClients(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    const { error: err } = await supabase.from("clients").update(patchToRow(patch)).eq("id", id);
    if (err) { setError(err); fetchAll(); throw err; }
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

  return useMemo(() => ({
    clients,
    loading,
    error,
    createClient,
    updateClient,
    deleteClient,
    refetch: fetchAll,
  }), [clients, loading, error, createClient, updateClient, deleteClient, fetchAll]);
}
