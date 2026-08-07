import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { DEFAULT_TAG_CATALOG } from "../constants/personal-tasks";

const TABLE = "personal_task_tags";

// Catálogo fixo de etiquetas do usuário (decisão B do mockup — dropdown de
// múltipla escolha em vez de texto livre). Semeia o catálogo padrão só na
// PRIMEIRA vez que confirma zero linhas — se o usuário apagar tudo depois,
// respeita (não semeia de novo), `seededRef` cobre isso dentro da sessão.
export function usePersonalTaskTags(userId) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const seededRef = useRef(false);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) { setLoading(false); return; }
    const { data, error } = await supabase.from(TABLE).select("*").order("label", { ascending: true });
    if (error) { setLoading(false); return; }
    if ((data || []).length === 0 && !seededRef.current) {
      seededRef.current = true;
      const { data: seeded } = await supabase
        .from(TABLE)
        .insert(DEFAULT_TAG_CATALOG.map(label => ({ user_id: userId, label })))
        .select();
      setTags(seeded || []);
    } else {
      setTags(data || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addTag = useCallback(async (label) => {
    const trimmed = (label || "").trim();
    if (!trimmed || !isSupabaseConfigured || !userId) return null;
    const { data, error } = await supabase
      .from(TABLE).insert({ user_id: userId, label: trimmed }).select().single();
    if (error) return null;
    setTags(prev => [...prev, data].sort((a, b) => a.label.localeCompare(b.label)));
    return data;
  }, [userId]);

  const deleteTag = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    await supabase.from(TABLE).delete().eq("id", id);
    setTags(prev => prev.filter(t => t.id !== id));
  }, []);

  const options = tags.map(t => ({ id: t.label, label: t.label }));

  return { tags, options, loading, addTag, deleteTag, refetch: fetchAll };
}

export default usePersonalTaskTags;
