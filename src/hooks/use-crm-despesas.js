import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const BUCKET = "crm-comprovantes";

export function useCRMDespesas({ userId } = {}) {
  const [despesas, setDespesas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("crm_viagem_despesas").select("*").order("data_despesa", { ascending: false });
      if (!activeRef.current) return;
      setDespesas(data || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("crm-viagem-despesas")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_viagem_despesas" }, fetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const createDespesa = useCallback(async (data) => {
    const row = { ...data, vendedor_id: userId, created_by: userId };
    const { data: nova, error } = await supabase.from("crm_viagem_despesas").insert(row).select().single();
    if (error) throw new Error(error.message);
    setDespesas(prev => [nova, ...prev]);
    return nova;
  }, [userId]);

  const updateDespesa = useCallback(async (id, patch) => {
    const { error } = await supabase.from("crm_viagem_despesas").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    setDespesas(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }, []);

  const deleteDespesa = useCallback(async (id) => {
    const { error } = await supabase.from("crm_viagem_despesas").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setDespesas(prev => prev.filter(d => d.id !== id));
  }, []);

  // Caminho `${vendedor_id}/${despesa_id}.${ext}` — o primeiro segmento
  // precisa bater com auth.uid() pra passar na RLS do bucket, por isso usa
  // sempre o userId do próprio hook (só o vendedor sobe o próprio comprovante).
  const uploadComprovante = useCallback(async (despesaId, file) => {
    const ext = file.type === "application/pdf" ? "pdf" : (file.type.split("/")[1] || "jpg");
    const path = `${userId}/${despesaId}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: true });
    if (uploadErr) throw new Error(uploadErr.message);
    await updateDespesa(despesaId, { comprovante_path: path, comprovante_ext: ext });
    return path;
  }, [userId, updateDespesa]);

  const getComprovanteUrl = useCallback(async (path) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }, []);

  // Chamado pelo gestor: userId aqui é o id de quem está decidindo.
  const decidirReembolso = useCallback(async (id, statusReembolso, observacaoGestor) => {
    await updateDespesa(id, {
      status_reembolso: statusReembolso,
      observacao_gestor: observacaoGestor || null,
      aprovado_por: userId,
      aprovado_em: new Date().toISOString(),
    });
  }, [userId, updateDespesa]);

  return {
    despesas,
    loading,
    createDespesa,
    updateDespesa,
    deleteDespesa,
    uploadComprovante,
    getComprovanteUrl,
    decidirReembolso,
    refetch: fetchAll,
  };
}
