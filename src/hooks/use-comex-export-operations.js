import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "comex_export_operations";

function rowToOperation(r) {
  return {
    id:                r.id,
    companyIds:        Array.isArray(r.company_ids) ? r.company_ids : [],
    title:             r.title,
    buyerName:         r.buyer_name ?? null,
    buyerCountry:      r.buyer_country ?? null,

    stage:             r.stage,
    stageChangedAt:    r.stage_changed_at ?? null,

    ownerIds:          Array.isArray(r.owner_ids) ? r.owner_ids : [],

    currency:          r.currency ?? "USD",
    saleValue:         r.sale_value ?? null,
    ptaxRate:          r.ptax_rate ?? null,

    customFields:      r.custom_fields && typeof r.custom_fields === "object" ? r.custom_fields : {},

    starred:           r.starred ?? false,
    activities:        Array.isArray(r.activities) ? r.activities : [],
    notes:             Array.isArray(r.notes) ? r.notes : [],
    createdBy:         r.created_by ?? null,
    createdAt:         r.created_at ?? null,
    updatedAt:         r.updated_at ?? null,
  };
}

function operationToRow(o, extras = {}) {
  return {
    company_ids:       o.companyIds ?? [],
    title:             o.title,
    buyer_name:        o.buyerName ?? null,
    buyer_country:     o.buyerCountry ?? null,

    stage:             o.stage ?? "qualificacao_comprador",
    stage_changed_at:  o.stageChangedAt ?? new Date().toISOString(),

    owner_ids:         o.ownerIds ?? [],

    currency:          o.currency ?? "USD",
    sale_value:        o.saleValue ?? null,
    ptax_rate:         o.ptaxRate ?? null,

    custom_fields:     o.customFields && typeof o.customFields === "object" ? o.customFields : {},

    starred:           o.starred ?? false,
    activities:        o.activities ?? [],
    notes:             o.notes ?? [],
    ...extras,
  };
}

export function useComexExportOperations({ userId, role, roles } = {}) {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const roleList = Array.isArray(roles) && roles.length ? roles : (role ? [role] : []);
  const canWrite = roleList.some(r => ["admin", "comex"].includes(r));

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setOperations((data || []).map(rowToOperation));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channelName = `comex_export_operations_rt_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        if (payload.eventType === "INSERT") {
          setOperations(prev =>
            prev.some(o => o.id === payload.new.id)
              ? prev.map(o => o.id === payload.new.id ? rowToOperation(payload.new) : o)
              : [rowToOperation(payload.new), ...prev]
          );
        } else if (payload.eventType === "UPDATE") {
          setOperations(prev => prev.map(o => o.id === payload.new.id ? rowToOperation(payload.new) : o));
        } else if (payload.eventType === "DELETE") {
          setOperations(prev => prev.filter(o => o.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const createOperation = useCallback(async (operation) => {
    if (!isSupabaseConfigured || !canWrite) return null;
    const row = operationToRow(operation, { created_by: userId });
    const { data, error: err } = await supabase
      .from(TABLE)
      .insert(row)
      .select()
      .single();
    if (err) throw err;
    const created = rowToOperation(data);
    setOperations(prev => prev.some(o => o.id === created.id) ? prev : [created, ...prev]);
    return created;
  }, [canWrite, userId]);

  const updateOperation = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = operations.find(o => o.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    const row = operationToRow(merged);
    const { data, error: err } = await supabase.from(TABLE).update(row).eq("id", id).select();
    if (err) throw err;
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta operação.");
    setOperations(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
  }, [canWrite, operations]);

  const duplicateOperation = useCallback(async (source, firstStageKey) => {
    return createOperation({
      companyIds:    source.companyIds,
      title:         `${source.title} (cópia)`,
      buyerName:     source.buyerName,
      buyerCountry:  source.buyerCountry,
      stage:         firstStageKey,
      ownerIds:      source.ownerIds,
      currency:      source.currency,
      saleValue:     source.saleValue,
      ptaxRate:      source.ptaxRate,
      customFields:  source.customFields,
    });
  }, [createOperation]);

  const deleteOperation = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setOperations(prev => prev.filter(o => o.id !== id));
  }, [canWrite]);

  const changeStage = useCallback(async (id, stage) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const now      = new Date().toISOString();
    const current  = operations.find(o => o.id === id);
    const activity = {
      type:        "stage_change",
      description: `Movido para ${stage}`,
      at:          now,
    };
    const activities = [...(current?.activities || []), activity];
    const { data, error: err } = await supabase
      .from(TABLE)
      .update({ stage, stage_changed_at: now, activities })
      .eq("id", id)
      .select();
    if (err) throw err;
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta operação.");
    setOperations(prev =>
      prev.map(o => o.id === id ? { ...o, stage, stageChangedAt: now, activities } : o)
    );
  }, [canWrite, operations]);

  const toggleStar = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = operations.find(o => o.id === id);
    if (!current) return;
    const starred = !current.starred;
    const { data, error: err } = await supabase.from(TABLE).update({ starred }).eq("id", id).select();
    if (err) throw err;
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta operação.");
    setOperations(prev => prev.map(o => o.id === id ? { ...o, starred } : o));
  }, [canWrite, operations]);

  return {
    operations,
    loading,
    error,
    canWrite,
    createOperation,
    updateOperation,
    deleteOperation,
    duplicateOperation,
    changeStage,
    toggleStar,
    refetch: fetchAll,
  };
}
