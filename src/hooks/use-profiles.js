import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { DEFAULT_USERS } from "../constants/users";

function rowToUser(r) {
  return {
    id: r.id,
    name: r.name || r.email || "—",
    email: r.email || "",
    role: r.role || "vendedor",
    // `roles` é a fonte de verdade pra permissão (multi-cargo); `role`
    // continua sendo só o "cargo principal" (landing page/dashboard padrão)
    // — ver 20260714_profiles_multi_role_foundation.sql. Todo profile
    // sempre tem role ∈ roles (trigger garante), então o fallback abaixo só
    // cobre uma leitura no meio de uma migração ainda não sincronizada.
    roles: Array.isArray(r.roles) && r.roles.length ? r.roles : [r.role || "vendedor"],
    companies: Array.isArray(r.companies) ? r.companies : [],
    initials: r.initials || (r.name || r.email || "—").slice(0, 2).toUpperCase(),
    avatarBg: r.avatar_bg || "#1D4ED8",
    avatarUrl: r.avatar_url || null,
    sectors: Array.isArray(r.sectors) ? r.sectors : [],
    supervisorId: r.supervisor_id || null,
    // Fornecedor de marketing vinculado — só usado por role "agencia", pra
    // escopar o que essa agência específica enxerga (ver migration
    // 20260718_marketing_agencia_supplier_scoping.sql). null = sem trava.
    supplierId: r.supplier_id || null,
    // ai_config/calendar_token não vêm mais nesta linha — moraram em
    // `profile_secrets` (RLS own-only), fora do alcance do roster. Antes
    // dependia de um mapeamento manual pra não vazar (achado de segurança,
    // ver migration 20260819_sec_profile_secrets_split.sql) — agora é
    // estruturalmente impossível, a coluna nem existe mais em `profiles`.
    // Opt-out de notificação de @menção (FASE 4) — precisa viver no banco
    // (não em localStorage como o resto das preferências de notificação),
    // porque quem decide se cria a notificação é a RPC
    // create_mention_notifications, rodando na sessão de quem MENCIONOU,
    // não na de quem seria notificado.
    mentionNotificationsEnabled: r.mention_notifications_enabled !== false,
    // Liga/desliga Chat por usuário via painel do admin (10/08/2026) —
    // enforcement real é na RLS (chat_is_member), isto só reflete o estado
    // pra UI decidir se mostra o item de menu.
    chatEnabled: r.chat_enabled !== false,
  };
}

export function useProfiles({ enabled = true } = {}) {
  const fallbackMode = !isSupabaseConfigured;
  const [fallbackUsers, setFallbackUsers] = usePersistentState(STORAGE_KEYS.users, DEFAULT_USERS);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured && enabled);
  const [error, setError] = useState(null);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) return;
    setError(null);
    setLoading(true);
    try {
      // Achado F-05 da auditoria funcional (19/08/2026): select("*") puxava
      // TODAS as colunas de profiles em toda navegação, incluindo
      // avatar_url em base64 (hoje 524KB pra só 3 fotos cadastradas, sem
      // teto real de crescimento) e colunas que rowToUser() nem lê
      // (department, job_title, employee_status, contract_type,
      // admission_date, client_id...). Lista explícita = só o que o roster
      // de fato usa. Isso NÃO resolve o base64 em si (avatar_url segue
      // sendo consumido de verdade pelo roster) — a correção completa é
      // mover a foto pro Storage, que precisa de decisão sobre bucket (ver
      // auditoria, pendência de schema).
      const { data, error: err } = await supabase
        .from("profiles")
        .select("id, name, email, role, roles, companies, initials, avatar_bg, avatar_url, sectors, supervisor_id, supplier_id, mention_notifications_enabled, chat_enabled, created_at")
        .order("created_at", { ascending: true });
      if (err) throw err;
      if (!activeRef.current) return;
      setUsers((data || []).map(rowToUser));
    } catch (e) {
      if (!activeRef.current) return;
      setError(e);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    activeRef.current = true;
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!enabled) { setUsers([]); setLoading(false); return; }
    fetchAll();
    // Nome de canal único por instância — evita colisão quando o hook é
    // usado por múltiplos componentes ao mesmo tempo (App.jsx + telas de RH).
    const channelName = `profiles-list-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        if (!activeRef.current) return;
        if (payload.eventType === "DELETE") {
          setUsers(prev => prev.filter(u => u.id !== payload.old.id));
        } else if (payload.eventType === "INSERT") {
          setUsers(prev => {
            if (prev.some(u => u.id === payload.new.id)) return prev;
            return [...prev, rowToUser(payload.new)];
          });
        } else if (payload.eventType === "UPDATE") {
          setUsers(prev => prev.map(u => u.id === payload.new.id ? rowToUser(payload.new) : u));
        }
      })
      .subscribe();
    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [enabled, fetchAll]);

  const updateUser = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) {
      setFallbackUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
      return;
    }
    const dbPatch = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.role !== undefined) dbPatch.role = patch.role;
    // roles não precisa ser setado toda vez que role muda — o trigger
    // profiles_sync_roles já mantém role ∈ roles sozinho. Só grava roles
    // quando o chamador manda explicitamente (ex: editor multi-cargo).
    if (patch.roles !== undefined) dbPatch.roles = patch.roles;
    if (patch.mentionNotificationsEnabled !== undefined) dbPatch.mention_notifications_enabled = patch.mentionNotificationsEnabled;
    if (patch.companies !== undefined) dbPatch.companies = patch.companies;
    if (patch.initials !== undefined) dbPatch.initials = patch.initials;
    if (patch.avatarBg !== undefined) dbPatch.avatar_bg = patch.avatarBg;
    if (patch.sectors !== undefined) dbPatch.sectors = patch.sectors;
    if (patch.supervisorId !== undefined) dbPatch.supervisor_id = patch.supervisorId || null;
    if (patch.supplierId !== undefined) dbPatch.supplier_id = patch.supplierId || null;
    if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl;
    // Campos de RH que também vivem em profiles pra quem tem login (ver
    // 20260706_rh_overview_colaboradores_sync.sql) — faltavam aqui, então o
    // "Editar" de Funcionários parecia salvar (estado otimista) mas nunca
    // persistia de fato, revertendo num refresh.
    if (patch.job_title !== undefined) dbPatch.job_title = patch.job_title;
    if (patch.frente !== undefined) dbPatch.frente = patch.frente;
    if (patch.department !== undefined) dbPatch.department = patch.department;
    if (patch.contract_type !== undefined) dbPatch.contract_type = patch.contract_type;
    if (patch.admission_date !== undefined) dbPatch.admission_date = patch.admission_date;
    if (patch.employee_status !== undefined) dbPatch.employee_status = patch.employee_status;
    if (patch.chatEnabled !== undefined) dbPatch.chat_enabled = patch.chatEnabled;

    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
    // ai_config vive em `profile_secrets` (own-only), não em `profiles` —
    // ver migration 20260819_sec_profile_secrets_split.sql. RLS dessa
    // tabela só permite id = auth.uid(), então esse upsert só funciona
    // quando `id` é o próprio usuário logado (único caso real: Configurações).
    if (patch.aiConfig !== undefined) {
      const { error: secErr } = await supabase
        .from("profile_secrets")
        .upsert({ id, ai_config: patch.aiConfig, updated_at: new Date().toISOString() });
      if (secErr) {
        setError(secErr);
        throw secErr;
      }
    }
    if (Object.keys(dbPatch).length === 0) return;
    const { error: err } = await supabase.from("profiles").update(dbPatch).eq("id", id);
    if (err) {
      setError(err);
      fetchAll();
      throw err;
    }
  }, [setFallbackUsers, fetchAll]);

  const deleteUser = useCallback(async (id) => {
    if (!isSupabaseConfigured) {
      setFallbackUsers(prev => prev.filter(u => u.id !== id));
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== id));
    const { error: err } = await supabase.functions.invoke("delete-user", { body: { user_id: id } });
    if (err) {
      setError(err);
      fetchAll();
      // supabase-js não expõe o corpo JSON da edge function em err.message
      // (só "Edge Function returned a non-2xx status code") — sem isso, o
      // motivo real (ex: FK bloqueando a exclusão) nunca chegava no alert.
      let message = err.message;
      try {
        const body = await err.context?.json?.();
        if (body?.error) message = body.error;
      } catch { /* mantém a mensagem genérica se o corpo não vier como JSON */ }
      throw new Error(message);
    }
  }, [setFallbackUsers, fetchAll]);

  const effectiveUsers = isSupabaseConfigured ? users : fallbackUsers;

  return useMemo(() => ({
    users: effectiveUsers,
    loading,
    error,
    updateUser,
    deleteUser,
    refetch: fetchAll,
    setFallbackUsers,
    fallbackMode,
  }), [effectiveUsers, loading, error, updateUser, deleteUser, fetchAll, setFallbackUsers, fallbackMode]);
}
