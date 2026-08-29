import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { slugifyKey } from "./use-stage-fields";

const TABLE = "personal_task_stage_fields";

export { slugifyKey };

function rowToField(r) {
  return {
    id: r.id,
    stageKey: r.stage_key,
    fieldKey: r.field_key,
    fieldType: r.field_type,
    label: r.label,
    required: Boolean(r.required),
    options: Array.isArray(r.options) ? r.options : [],
    orderIdx: r.order_idx ?? 0,
    placeholder: r.placeholder || "",
    helpText: r.help_text || "",
    visibleIf: r.visible_if || null,
    requiredIf: r.required_if || null,
    validationRule: r.validation_rule || null,
  };
}

function fieldToRow(f) {
  return {
    stage_key: f.stageKey,
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

// Mesmo formato de use-rh-stage-fields.js, escopado por usuário (RLS de
// personal_task_stage_fields já isola) em vez de domain.
export function usePersonalTaskStageFields(userId) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("order_idx", { ascending: true });
    if (!error) setFields((data || []).map(rowToField));
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const byStage = useMemo(() => {
    const map = new Map();
    for (const f of fields) {
      if (!map.has(f.stageKey)) map.set(f.stageKey, []);
      map.get(f.stageKey).push(f);
    }
    for (const list of map.values()) list.sort((a, b) => a.orderIdx - b.orderIdx);
    return map;
  }, [fields]);

  const getFields = useCallback((stageKey) => byStage.get(stageKey) || [], [byStage]);

  const addField = useCallback(async (field) => {
    if (!isSupabaseConfigured || !userId) throw new Error("Supabase não configurado");
    const row = { ...fieldToRow(field), user_id: userId };
    const { data, error } = await supabase.from(TABLE).insert(row).select().single();
    if (error) throw error;
    return rowToField(data);
  }, [userId]);

  const updateField = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const row = fieldToRow({ ...patch });
    Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
    const { data, error } = await supabase.from(TABLE).update(row).eq("id", id).select();
    if (error) throw error;
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível salvar o campo — verifique suas permissões.");
  }, []);

  const deleteField = useCallback(async (id) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  }, []);

  // Mesmo raciocínio do reorderStages em use-personal-task-stages.js: não
  // lança (chamador é drag-and-drop, sem await/catch), mas detecta a falha —
  // inclusive a silenciosa da RLS, via `.select()` — e refaz o fetch pra não
  // deixar ordem fantasma na tela.
  const reorderFields = useCallback(async (orderedIds) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const results = await Promise.all(orderedIds.map((id, idx) =>
      supabase.from(TABLE).update({ order_idx: idx }).eq("id", id).select()));
    if (results.some(r => r?.error || !r?.data || r.data.length === 0)) await fetchAll();
  }, [fetchAll]);

  return { fields, loading, getFields, addField, updateField, deleteField, reorderFields, refetch: fetchAll };
}

export default usePersonalTaskStageFields;
