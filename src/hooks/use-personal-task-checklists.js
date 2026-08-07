import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "personal_task_checklists";

function makeItem(text) {
  return { id: crypto.randomUUID(), text, done: false, createdAt: new Date().toISOString() };
}

// Mesmo formato de use-deliverable-checklists.js — 4ª ocorrência do padrão
// (Lead/Deliverable/RH já usavam), aqui com user_id denormalizado porque
// personal_task_checklists é dado 100% privado (RLS sem exceção de papel).
export function usePersonalTaskChecklists(taskId, userId) {
  const [checklists, setChecklists] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  const fetch = useCallback(async () => {
    if (!taskId || !isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (err) throw err;
      setChecklists(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetch(); }, [fetch]);

  const patch = useCallback(async (id, updates) => {
    if (!isSupabaseConfigured) return;
    const { data, error: err } = await supabase
      .from(TABLE)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (err) { setError(err.message); return; }
    setChecklists(prev => prev.map(c => c.id === id ? data : c));
  }, []);

  const createChecklist = useCallback(async ({ title = "Checklist" } = {}) => {
    if (!isSupabaseConfigured || !userId) return null;
    const { data, error: err } = await supabase
      .from(TABLE)
      .insert({ task_id: taskId, user_id: userId, title, items: [], created_by: userId })
      .select()
      .single();
    if (err) { setError(err.message); return null; }
    setChecklists(prev => [...prev, data]);
    return data;
  }, [taskId, userId]);

  const deleteChecklist = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setChecklists(prev => prev.filter(c => c.id !== id));
  }, []);

  const addItem = useCallback(async (checklistId, text) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;
    await patch(checklistId, { items: [...(checklist.items || []), makeItem(text.trim())] });
  }, [checklists, patch]);

  const toggleItem = useCallback(async (checklistId, itemId) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;
    const items = (checklist.items || []).map(it =>
      it.id === itemId ? { ...it, done: !it.done } : it
    );
    await patch(checklistId, { items });
  }, [checklists, patch]);

  const removeItem = useCallback(async (checklistId, itemId) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;
    await patch(checklistId, { items: (checklist.items || []).filter(it => it.id !== itemId) });
  }, [checklists, patch]);

  const renameChecklist = useCallback(async (id, title) => {
    await patch(id, { title });
  }, [patch]);

  return {
    checklists, loading, error,
    createChecklist, deleteChecklist,
    addItem, toggleItem, removeItem, renameChecklist,
  };
}

export default usePersonalTaskChecklists;
