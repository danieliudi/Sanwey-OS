import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Fornecedores de RH (convênio médico, seguradora, terceirizada) com
// contrato real (vigência/valor/status) + histórico de eventos (reajuste,
// renovação, fatura, nota, orçamento, compra) — mesmo espírito de
// use-marketing-suppliers.js, mas domínio de RH (contrato de verdade, não
// cadastro+cotação).

function rowToSupplier(r) {
  return {
    id: r.id,
    name: r.name,
    tipo: r.tipo,
    contactName: r.contact_name ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
    notes: r.notes ?? null,
    isActive: r.is_active ?? true,
    createdAt: r.created_at ?? null,
  };
}

function supplierToRow(s) {
  return {
    name: s.name,
    tipo: s.tipo,
    contact_name: s.contactName ?? null,
    email: s.email ?? null,
    phone: s.phone ?? null,
    notes: s.notes ?? null,
    is_active: s.isActive ?? true,
  };
}

function rowToContrato(r) {
  return {
    id: r.id,
    fornecedorId: r.fornecedor_id,
    titulo: r.titulo,
    vigenciaInicio: r.vigencia_inicio ?? null,
    vigenciaFim: r.vigencia_fim ?? null,
    valor: r.valor ?? null,
    status: r.status,
    notes: r.notes ?? null,
    createdAt: r.created_at ?? null,
  };
}

function contratoToRow(c) {
  return {
    fornecedor_id: c.fornecedorId,
    titulo: c.titulo,
    vigencia_inicio: c.vigenciaInicio || null,
    vigencia_fim: c.vigenciaFim || null,
    valor: c.valor ?? null,
    status: c.status ?? "ativo",
    notes: c.notes ?? null,
  };
}

function rowToEvento(r) {
  return {
    id: r.id,
    contratoId: r.contrato_id,
    tipo: r.tipo,
    valorAnterior: r.valor_anterior ?? null,
    valorNovo: r.valor_novo ?? null,
    descricao: r.descricao ?? null,
    dataEvento: r.data_evento,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at ?? null,
  };
}

export function useRHSuppliers({ userId, enabled = true } = {}) {
  const [suppliers, setSuppliers] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    const [f, c, e] = await Promise.all([
      supabase.from("rh_fornecedores").select("*").order("name", { ascending: true }),
      supabase.from("rh_fornecedor_contratos").select("*").order("created_at", { ascending: false }),
      supabase.from("rh_fornecedor_contrato_eventos").select("*").order("data_evento", { ascending: false }),
    ]);
    if (!f.error) setSuppliers((f.data || []).map(rowToSupplier));
    if (!c.error) setContratos((c.data || []).map(rowToContrato));
    if (!e.error) setEventos((e.data || []).map(rowToEvento));
    setLoading(false);
  }, [enabled]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const suffix = Math.random().toString(36).slice(2, 9);
    const channel = supabase
      .channel(`rh-suppliers-${suffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_fornecedores" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_fornecedor_contratos" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_fornecedor_contrato_eventos" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, fetchAll]);

  const createSupplier = useCallback(async (supplier) => {
    const row = supplierToRow(supplier);
    const { data, error } = await supabase.from("rh_fornecedores").insert({ ...row, created_by: userId ?? null }).select().single();
    if (error) throw new Error(error.message);
    return rowToSupplier(data);
  }, [userId]);

  const updateSupplier = useCallback(async (id, patch) => {
    const current = suppliers.find(s => s.id === id);
    if (!current) return;
    const row = supplierToRow({ ...current, ...patch });
    const { error } = await supabase.from("rh_fornecedores").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
  }, [suppliers]);

  const createContrato = useCallback(async (contrato) => {
    const row = contratoToRow(contrato);
    const { data, error } = await supabase.from("rh_fornecedor_contratos").insert({ ...row, created_by: userId ?? null }).select().single();
    if (error) throw new Error(error.message);
    return rowToContrato(data);
  }, [userId]);

  const updateContrato = useCallback(async (id, patch) => {
    const current = contratos.find(c => c.id === id);
    if (!current) return;
    const row = contratoToRow({ ...current, ...patch });
    const { error } = await supabase.from("rh_fornecedor_contratos").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
  }, [contratos]);

  const addEvento = useCallback(async (evento) => {
    const { data, error } = await supabase.from("rh_fornecedor_contrato_eventos").insert({
      contrato_id: evento.contratoId,
      tipo: evento.tipo,
      valor_anterior: evento.valorAnterior ?? null,
      valor_novo: evento.valorNovo ?? null,
      descricao: evento.descricao ?? null,
      data_evento: evento.dataEvento || new Date().toISOString().slice(0, 10),
      created_by: userId ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return rowToEvento(data);
  }, [userId]);

  return {
    suppliers, contratos, eventos, loading,
    createSupplier, updateSupplier, createContrato, updateContrato, addEvento,
    refetch: fetchAll,
  };
}

export default useRHSuppliers;
