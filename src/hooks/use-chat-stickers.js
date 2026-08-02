import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "chat_stickers";
const BUCKET = "chat-stickers";

const DIACRITICS_RE = new RegExp("[̀-ͯ]", "g");

function slug(name) {
  return (name || "figurinha")
    .normalize("NFD").replace(DIACRITICS_RE, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "figurinha";
}

// Pacote único/global (sem company_id — decisão do Daniel, ver spec seção
// c/e.4). `includeInactive` só faz sentido pro painel de gestão em
// Configurações — a RLS já restringe quem não é chat_is_manager a só ver as
// ativas de qualquer forma, isto é só pra não pedir a coluna a mais no
// picker do composer.
export function useChatStickers({ includeInactive = false } = {}) {
  const [stickers, setStickers] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);

  const fetchStickers = useCallback(async () => {
    if (!isSupabaseConfigured) { setStickers([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from(TABLE).select("*").order("created_at", { ascending: false });
      if (!includeInactive) query = query.eq("active", true);
      const { data, error: err } = await query;
      if (err) throw err;
      setStickers(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => { fetchStickers(); }, [fetchStickers]);

  const getPublicUrl = useCallback((path) => {
    if (!isSupabaseConfigured || !path) return null;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  }, []);

  const uploadSticker = useCallback(async (file, name) => {
    if (!isSupabaseConfigured || !file) return null;
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
    const label = (name || file.name.replace(/\.[^.]+$/, "")).trim() || "figurinha";
    const path = `${Date.now()}-${slug(label)}.${ext}`;

    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (storageErr) throw storageErr;

    const { data: authData } = await supabase.auth.getUser();
    const { data, error: dbErr } = await supabase
      .from(TABLE)
      .insert({ name: label, image_path: path, uploaded_by: authData?.user?.id || null })
      .select()
      .single();
    if (dbErr) throw dbErr;

    setStickers(prev => [data, ...prev]);
    return data;
  }, []);

  const toggleStickerActive = useCallback(async (id, active) => {
    const { data, error: err } = await supabase
      .from(TABLE)
      .update({ active })
      .eq("id", id)
      .select()
      .single();
    if (err) throw err;
    setStickers(prev => prev.map(s => (s.id === id ? data : s)));
  }, []);

  // Remoção definitiva (arquivo + linha) — distinto do toggle, que só some
  // do picker sem apagar nada. Pedido explícito do Daniel: gestor precisa
  // poder remover qualquer figurinha, não só desativar.
  const deleteSticker = useCallback(async (id) => {
    const target = stickers.find(s => s.id === id);
    if (target?.image_path) {
      await supabase.storage.from(BUCKET).remove([target.image_path]);
    }
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setStickers(prev => prev.filter(s => s.id !== id));
  }, [stickers]);

  return {
    stickers, loading, error,
    uploadSticker, toggleStickerActive, deleteSticker, getPublicUrl,
    refetch: fetchStickers,
  };
}

export default useChatStickers;
