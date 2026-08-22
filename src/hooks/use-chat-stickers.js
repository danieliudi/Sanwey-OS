import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "chat_stickers";
const BUCKET = "chat-stickers";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

  // Upload passa pela edge function chat-sticker-upload em vez de ir direto
  // pro Storage — ela confere a assinatura binária real do arquivo (magic
  // bytes) contra PNG/WEBP antes de gravar, em vez de confiar só no
  // content-type que o client declara (reforço de moderação, BX-08).
  const uploadSticker = useCallback(async (file, name) => {
    if (!isSupabaseConfigured || !file) return null;
    const label = (name || file.name.replace(/\.[^.]+$/, "")).trim() || "figurinha";
    const fileBase64 = await fileToBase64(file);

    const { data, error: fnErr } = await supabase.functions.invoke("chat-sticker-upload", {
      body: { fileBase64, fileName: file.name, name: label },
    });
    if (fnErr) throw fnErr;
    if (data?.error) throw new Error(data.error);

    setStickers(prev => [data.sticker, ...prev]);
    return data.sticker;
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
