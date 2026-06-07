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
    companies: Array.isArray(r.companies) ? r.companies : [],
    initials: r.initials || (r.name || r.email || "—").slice(0, 2).toUpperCase(),
    avatarBg: r.avatar_bg || "#1E4D8C",
    avatarUrl: r.avatar_url || null,
    sectors: Array.isArray(r.sectors) ? r.sectors : [],
    supervisorId: r.supervisor_id || null,
    aiConfig: r.ai_config || null,
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
      const { data, error: err } = await supabase
        .from("profiles")
        .select("*")
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
    const channel = supabase
      .channel("profiles-list")
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
    if (patch.companies !== undefined) dbPatch.companies = patch.companies;
    if (patch.initials !== undefined) dbPatch.initials = patch.initials;
    if (patch.avatarBg !== undefined) dbPatch.avatar_bg = patch.avatarBg;
    if (patch.sectors !== undefined) dbPatch.sectors = patch.sectors;
    if (patch.supervisorId !== undefined) dbPatch.supervisor_id = patch.supervisorId || null;
    if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl;
    if (patch.aiConfig !== undefined) dbPatch.ai_config = patch.aiConfig;

    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
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
    const { error: err } = await supabase.from("profiles").delete().eq("id", id);
    if (err) {
      setError(err);
      fetchAll();
      throw err;
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
