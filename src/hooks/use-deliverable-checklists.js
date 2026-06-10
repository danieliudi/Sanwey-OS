import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "deliverable_checklists";

function makeItem(text) {
  return { id: crypto.randomUUID(), text, done: false, createdAt: new Date().toISOString() };
}

export function useDeliverableChecklists(deliverableId) {
  const [checklists, setChecklists] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  const fetch = useCallback(async () => {
    if (!deliverableId || !isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .eq("deliverable_id", deliverableId)
        .order("created_at", { ascending: true });
      if (err) throw err;
      setChecklists(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [deliverableId]);

  useEffect(() => { fetch(); }, [fetch]);

  const patch = useCallback(async (id, updates) => {
    const { data, error: err } = await supabase
      .from(TABLE)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (err) { setError(err.message); return; }
    setChecklists(prev => prev.map(c => c.id === id ? data : c));
  }, []);

  const createChecklist = useCallback(async ({ title = "Checklist", createdBy } = {}) => {
    const { data, error: err } = await supabase
      .from(TABLE)
      .insert({ deliverable_id: deliverableId, title, items: [], created_by: createdBy || null })
      .select()
      .single();
    if (err) { setError(err.message); return null; }
    setChecklists(prev => [...prev, data]);
    return data;
  }, [deliverableId]);

  const deleteChecklist = useCallback(async (id) => {
    await supabase.from(TABLE).delete().eq("id", id);
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
