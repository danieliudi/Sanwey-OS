import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Catálogo único em src/constants/field-types.js; reexportado aqui pra
// manter os importadores existentes deste hook funcionando.
export { FIELD_TYPES } from "../constants/field-types";

function rowToField(r) {
  return {
    id: r.id,
    companyId: r.company_id,
    stageId: r.stage_id,
    fieldKey: r.field_key,
    fieldType: r.field_type,
    label: r.label,
    required: Boolean(r.required),
    options: Array.isArray(r.options) ? r.options : [],
    orderIdx: r.order_idx ?? 0,
    placeholder: r.placeholder || "",
    helpText: r.help_text || "",
    // Condicionais: { fieldKey, operator, value } | null — ver
    // src/utils/field-conditions.js pro avaliador.
    visibleIf: r.visible_if || null,
    requiredIf: r.required_if || null,
    validationRule: r.validation_rule || null,
  };
}

function fieldToRow(f) {
  return {
    company_id: f.companyId,
    stage_id: f.stageId,
    field_key: f.fieldKey,
    field_type: f.fieldType,
    label: f.label,
    required: !!f.required,
    options: Array.isArray(f.options) ? f.options : [],
    order_idx: f.orderIdx ?? 0,
    placeholder: f.placeholder ?? null,
    help_text: f.helpText ?? null,
    visible_if: f.visibleIf ?? null,
    required_if: f.requiredIf ?? null,
    validation_rule: f.validationRule ?? null,
  };
}

// Slugify simples para gerar field_key a partir do label.
export function slugifyKey(label) {
  return (label || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || `field_${Date.now()}`;
}

export function useStageFields() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("pipeline_stage_fields")
        .select("*")
        .order("order_idx", { ascending: true });
      if (err) throw err;
      if (!isActive()) return;
      setFields((data || []).map(rowToField));
    } catch (e) {
      if (!isActive()) return;
      setError(e);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) { setLoading(false); return; }
    fetchAll(() => active);
    // Nome de canal único por instância — evita colisão quando o hook é
    // usado por múltiplos componentes ao mesmo tempo (CRMView + Drawer).
    const channelName = `pipeline-stage-fields-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_stage_fields" }, (payload) => {
        if (!active) return;
        if (payload.eventType === "DELETE") {
          setFields(prev => prev.filter(f => f.id !== payload.old.id));
        } else if (payload.eventType === "INSERT") {
          setFields(prev => prev.some(f => f.id === payload.new.id)
            ? prev
            : [...prev, rowToField(payload.new)].sort((a, b) => a.orderIdx - b.orderIdx));
        } else if (payload.eventType === "UPDATE") {
          setFields(prev => prev
            .map(f => f.id === payload.new.id ? rowToField(payload.new) : f)
            .sort((a, b) => a.orderIdx - b.orderIdx));
        }
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [fetchAll]);

  // Lookup helpers
  const byStage = useMemo(() => {
    const map = new Map();
    for (const f of fields) {
      const key = `${f.companyId}::${f.stageId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    }
    for (const list of map.values()) list.sort((a, b) => a.orderIdx - b.orderIdx);
    return map;
  }, [fields]);

  const getFields = useCallback((companyId, stageId) => {
    return byStage.get(`${companyId}::${stageId}`) || [];
  }, [byStage]);

  const addField = useCallback(async (field) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const row = fieldToRow(field);
    const { data, error: err } = await supabase
      .from("pipeline_stage_fields").insert(row).select().single();
    if (err) throw err;
    return rowToField(data);
  }, []);

  const updateField = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const row = fieldToRow({ ...patch });
    // Remove chaves undefined para não sobrescrever com NULL.
    Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
    const { data, error: err } = await supabase
      .from("pipeline_stage_fields").update(row).eq("id", id).select();
    if (err) throw err;
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível salvar o campo da etapa — verifique suas permissões.");
  }, []);

  const deleteField = useCallback(async (id) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const { error: err } = await supabase
      .from("pipeline_stage_fields").delete().eq("id", id);
    if (err) throw err;
  }, []);

  // Não lança de propósito — mesmo raciocínio do reorderStages em
  // use-rh-pipeline-stages.js (chamador é drag-and-drop, sem await/catch):
  // detecta a falha, inclusive a silenciosa da RLS via `.select()`, e refaz
  // o fetch pra não deixar ordem fantasma na tela.
  const reorderFields = useCallback(async (companyId, stageId, orderedIds) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    // Atualiza order_idx em sequência.
    const results = await Promise.all(orderedIds.map((id, idx) =>
      supabase.from("pipeline_stage_fields").update({ order_idx: idx }).eq("id", id).select()
    ));
    if (results.some(r => r?.error || !r?.data || r.data.length === 0)) await fetchAll();
  }, [fetchAll]);

  // Memoizado: antes retornava um objeto novo a cada render, e componentes
  // que colocavam esse objeto em deps de useEffect (ex.: o scan de nudges em
  // App.jsx) re-rodavam o effect em TODO render — combinado com um effect que
  // dispara notificação, isso virava uma cascata de re-render. Estável agora.
  return useMemo(() => ({
    fields,
    loading,
    error,
    getFields,
    addField,
    updateField,
    deleteField,
    reorderFields,
    refetch: fetchAll,
  }), [fields, loading, error, getFields, addField, updateField, deleteField, reorderFields, fetchAll]);
}

export default useStageFields;
