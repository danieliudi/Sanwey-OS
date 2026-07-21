import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

const TABLE = "rh_ferias";
const SELECT = "*, profiles:user_id(id, name, initials, email), approver:approved_by(name)";

export function useRHFeriasRequests({ enabled = true } = {}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLE)
      .select(SELECT)
      .order("created_at", { ascending: false });
    if (!error) setRequests(data || []);
    setLoading(false);
  }, [enabled]);

  useEffect(() => { if (enabled) fetchAll(); else setLoading(false); }, [fetchAll, enabled]);

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const channelName = `rh_ferias_rt_${Math.random().toString(36).slice(2, 9)}`;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, debouncedFetchAll)
      .subscribe();
    return () => { debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [enabled, fetchAll]);

  const createRequest = useCallback(async (data) => {
    const { data: novo, error } = await supabase
      .from(TABLE)
      .insert(data)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    setRequests(prev => [novo, ...prev]);
    return novo;
  }, []);

  // Mover card entre etapas do Kanban (pendente/aprovado/recusado).
  // approvedBy/approvedAt são preenchidos só ao entrar em aprovado/recusado.
  const changeStatus = useCallback(async (id, status, extra = {}) => {
    const patch = { status, status_changed_at: new Date().toISOString(), ...extra };
    const { error } = await supabase.from(TABLE).update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }, []);

  const updateCustomFields = useCallback(async (id, customFields) => {
    const { error } = await supabase.from(TABLE).update({ custom_fields: customFields }).eq("id", id);
    if (error) throw new Error(error.message);
    setRequests(prev => prev.map(r => r.id === id ? { ...r, custom_fields: customFields } : r));
  }, []);

  const deleteRequest = useCallback(async (id) => {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw new Error(error.message);
    setRequests(prev => prev.filter(r => r.id !== id));
  }, []);

  const addActivity = useCallback(async (id, entry) => {
    const current = requests.find(r => r.id === id);
    if (!current) return;
    const nextActivities = [...(Array.isArray(current.activities) ? current.activities : []), entry];
    const { error } = await supabase.from(TABLE).update({ activities: nextActivities }).eq("id", id);
    if (error) throw new Error(error.message);
    setRequests(prev => prev.map(r => r.id === id ? { ...r, activities: nextActivities } : r));
  }, [requests]);

  const updateActivity = useCallback(async (id, activityId, patch) => {
    const current = requests.find(r => r.id === id);
    if (!current) return;
    const nextActivities = (Array.isArray(current.activities) ? current.activities : [])
      .map(a => (a.id === activityId ? { ...a, ...patch } : a));
    const { error } = await supabase.from(TABLE).update({ activities: nextActivities }).eq("id", id);
    if (error) throw new Error(error.message);
    setRequests(prev => prev.map(r => r.id === id ? { ...r, activities: nextActivities } : r));
  }, [requests]);

  return { requests, loading, createRequest, changeStatus, updateCustomFields, deleteRequest, addActivity, updateActivity, refetch: fetchAll };
}
