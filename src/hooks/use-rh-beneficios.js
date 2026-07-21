import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Catálogo de benefícios genéricos (VT/VR/VA/Wellhub/convênio médico),
// linkado opcionalmente a um fornecedor (use-rh-suppliers.js), + vínculo
// por colaborador com status de aprovação (solicitado → aprovado → ativo).

function rowToCatalogo(r) {
  return {
    id: r.id,
    tipo: r.tipo,
    nomeExibicao: r.nome_exibicao,
    fornecedorId: r.fornecedor_id ?? null,
    valorPadrao: r.valor_padrao ?? null,
    isActive: r.is_active ?? true,
  };
}

function rowToColaboradorBeneficio(r) {
  return {
    id: r.id,
    colaboradorId: r.colaborador_id,
    beneficioCatalogoId: r.beneficio_catalogo_id,
    status: r.status,
    valor: r.valor ?? null,
    solicitadoEm: r.solicitado_em,
    aprovadoEm: r.aprovado_em ?? null,
    aprovadoPor: r.aprovado_por ?? null,
    notes: r.notes ?? null,
  };
}

export function useRHBeneficios({ userId, enabled = true } = {}) {
  const [catalogo, setCatalogo] = useState([]);
  const [colaboradorBeneficios, setColaboradorBeneficios] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    const [cat, cb] = await Promise.all([
      supabase.from("rh_beneficios_catalogo").select("*").order("nome_exibicao", { ascending: true }),
      supabase.from("rh_colaborador_beneficios").select("*").order("solicitado_em", { ascending: false }),
    ]);
    if (!cat.error) setCatalogo((cat.data || []).map(rowToCatalogo));
    if (!cb.error) setColaboradorBeneficios((cb.data || []).map(rowToColaboradorBeneficio));
    setLoading(false);
  }, [enabled]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const suffix = Math.random().toString(36).slice(2, 9);
    const channel = supabase
      .channel(`rh-beneficios-${suffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_beneficios_catalogo" }, debouncedFetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_colaborador_beneficios" }, debouncedFetchAll)
      .subscribe();
    return () => { debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [enabled, fetchAll]);

  const createCatalogoItem = useCallback(async (item) => {
    const { data, error } = await supabase.from("rh_beneficios_catalogo").insert({
      tipo: item.tipo,
      nome_exibicao: item.nomeExibicao,
      fornecedor_id: item.fornecedorId || null,
      valor_padrao: item.valorPadrao ?? null,
      is_active: item.isActive ?? true,
      created_by: userId ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return rowToCatalogo(data);
  }, [userId]);

  // Exclui de fato se nenhum colaborador já tiver esse benefício vinculado;
  // se tiver (violação de FK, código 23503), desativa em vez de apagar —
  // preserva o histórico de quem já solicitou/tem aprovado esse benefício.
  const deleteCatalogoItem = useCallback(async (id) => {
    const { error } = await supabase.from("rh_beneficios_catalogo").delete().eq("id", id);
    if (!error) return { deactivated: false };
    if (error.code === "23503") {
      const { error: updErr } = await supabase.from("rh_beneficios_catalogo").update({ is_active: false }).eq("id", id);
      if (updErr) throw new Error(updErr.message);
      return { deactivated: true };
    }
    throw new Error(error.message);
  }, []);

  // Solicita um benefício do catálogo pra um colaborador — status inicial
  // "solicitado"; RH aprova depois (updateColaboradorBeneficio).
  const solicitarBeneficio = useCallback(async (colaboradorId, beneficioCatalogoId, valor = null) => {
    const { data, error } = await supabase.from("rh_colaborador_beneficios").insert({
      colaborador_id: colaboradorId,
      beneficio_catalogo_id: beneficioCatalogoId,
      status: "solicitado",
      valor,
    }).select().single();
    if (error) throw new Error(error.message);
    return rowToColaboradorBeneficio(data);
  }, []);

  const aprovarBeneficio = useCallback(async (id) => {
    const { error } = await supabase.from("rh_colaborador_beneficios").update({
      status: "aprovado",
      aprovado_em: new Date().toISOString(),
      aprovado_por: userId ?? null,
    }).eq("id", id);
    if (error) throw new Error(error.message);
  }, [userId]);

  const updateColaboradorBeneficio = useCallback(async (id, patch) => {
    const row = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.valor !== undefined) row.valor = patch.valor;
    if (patch.notes !== undefined) row.notes = patch.notes;
    const { error } = await supabase.from("rh_colaborador_beneficios").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  }, []);

  return {
    catalogo, colaboradorBeneficios, loading,
    createCatalogoItem, deleteCatalogoItem, solicitarBeneficio, aprovarBeneficio, updateColaboradorBeneficio,
    refetch: fetchAll,
  };
}

export default useRHBeneficios;
