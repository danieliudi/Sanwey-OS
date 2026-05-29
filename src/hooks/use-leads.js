import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { generateLeadsForAllCompanies } from "../data/generate-leads";

// Maps DB snake_case row to camelCase lead object the rest of the app expects.
function rowToLead(r) {
  return {
    id: r.id,
    companyId: r.company_id,
    cnpj: r.cnpj,
    company: r.company,
    razaoSocial: r.razao_social,
    sector: r.sector,
    cnae: r.cnae,
    size: r.size,
    city: r.city,
    state: r.state,
    address: r.address,
    capitalSocial: Number(r.capital_social || 0),
    contactEmail: r.contact_email,
    phone: r.phone,
    situacao: r.situacao,
    trigger: r.trigger,
    triggerLabel: r.trigger_label,
    evidence: r.evidence,
    fitScore: r.fit_score ?? 0,
    sku: r.sku,
    skuName: r.sku_name,
    unitPrice: Number(r.unit_price || 0),
    quantity: r.quantity ?? 0,
    value: Number(r.value || 0),
    probability: Number(r.probability || 0),
    closeDate: r.close_date,
    dateDetected: r.date_detected,
    daysAgo: r.days_ago ?? 0,
    stage: r.stage,
    status: r.status,
    owner: r.owner,
    urgency: r.urgency,
    decisionMaker: r.decision_maker || { name: "—", role: "—" },
    starred: Boolean(r.starred),
    notes: Array.isArray(r.notes) ? r.notes : [],
    clientClassification: r.client_classification ?? null,
    orderCount: r.order_count ?? 0,
    customFields: r.custom_fields && typeof r.custom_fields === "object" ? r.custom_fields : {},
    nextFollowUp: r.next_follow_up,
    createdAt: r.created_at,
    lastActivity: r.last_activity,
    stageChangedAt: r.stage_changed_at,
    isDemo: Boolean(r.is_demo),
  };
}

function leadToRow(l, extras = {}) {
  return {
    id: l.id,
    company_id: l.companyId,
    cnpj: l.cnpj,
    company: l.company,
    razao_social: l.razaoSocial ?? null,
    sector: l.sector ?? null,
    cnae: l.cnae ?? null,
    size: l.size ?? null,
    city: l.city ?? null,
    state: l.state ?? null,
    address: l.address ?? null,
    capital_social: l.capitalSocial ?? 0,
    contact_email: l.contactEmail ?? null,
    phone: l.phone ?? null,
    situacao: l.situacao ?? null,
    trigger: l.trigger ?? null,
    trigger_label: l.triggerLabel ?? null,
    evidence: l.evidence ?? null,
    fit_score: l.fitScore ?? 0,
    sku: l.sku ?? null,
    sku_name: l.skuName ?? null,
    unit_price: l.unitPrice ?? 0,
    quantity: l.quantity ?? 0,
    value: l.value ?? 0,
    probability: l.probability ?? 0,
    close_date: l.closeDate ?? null,
    date_detected: l.dateDetected ?? null,
    days_ago: l.daysAgo ?? 0,
    stage: l.stage ?? "prospeccao",
    status: l.status ?? l.stage ?? "prospeccao",
    owner: l.owner ?? null,
    urgency: l.urgency ?? null,
    decision_maker: l.decisionMaker ?? {},
    starred: Boolean(l.starred),
    notes: l.notes ?? [],
    client_classification: l.clientClassification ?? null,
    order_count: l.orderCount ?? 0,
    custom_fields: l.customFields && typeof l.customFields === "object" ? l.customFields : {},
    next_follow_up: l.nextFollowUp ?? null,
    ...extras,
  };
}

function patchToRow(patch) {
  const map = {
    companyId: "company_id",
    razaoSocial: "razao_social",
    capitalSocial: "capital_social",
    clientClassification: "client_classification",
    orderCount: "order_count",
    contactEmail: "contact_email",
    triggerLabel: "trigger_label",
    fitScore: "fit_score",
    skuName: "sku_name",
    unitPrice: "unit_price",
    closeDate: "close_date",
    dateDetected: "date_detected",
    daysAgo: "days_ago",
    decisionMaker: "decision_maker",
    lastActivity: "last_activity",
    stageChangedAt: "stage_changed_at",
    customFields: "custom_fields",
    nextFollowUp: "next_follow_up",
  };
  const out = {};
  for (const [k, v] of Object.entries(patch)) {
    out[map[k] || k] = v;
  }
  return out;
}

// Supabase-backed leads hook. Falls back to localStorage when Supabase isn't
// configured (keeps the mock-picker path working for local dev).
export function useLeads({ userId, role, companies } = {}) {
  const fallbackEnabled = !isSupabaseConfigured;
  const [fallbackLeads, setFallbackLeads] = usePersistentState(STORAGE_KEYS.leads, []);

  const [remoteLeads, setRemoteLeads] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);
  const activeRef = useRef(true);

  const canQuery = isSupabaseConfigured && Boolean(userId) && (
    role === "admin" ||
    (role === "gerente" && Array.isArray(companies)) ||
    (role === "vendedor" && Array.isArray(companies)) ||
    (role === "consultor" && Array.isArray(companies))
  );

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) return;
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      if (!activeRef.current) return;
      setRemoteLeads((data || []).map(rowToLead));
    } catch (e) {
      if (!activeRef.current) return;
      setError(e);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    activeRef.current = true;
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!userId) { setRemoteLeads([]); setLoading(false); return; }
    fetchAll();
    // Realtime — pushes any INSERT/UPDATE/DELETE from other sessions/devices.
    const channel = supabase
      .channel(`leads-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, (payload) => {
        if (!activeRef.current) return;
        if (payload.eventType === "DELETE") {
          setRemoteLeads(prev => prev.filter(l => l.id !== payload.old.id));
        } else if (payload.eventType === "INSERT") {
          setRemoteLeads(prev => {
            if (prev.some(l => l.id === payload.new.id)) return prev;
            return [rowToLead(payload.new), ...prev];
          });
        } else if (payload.eventType === "UPDATE") {
          setRemoteLeads(prev => prev.map(l => l.id === payload.new.id ? rowToLead(payload.new) : l));
        }
      })
      .subscribe();
    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [userId, fetchAll]);

  // Public leads array — from Supabase or localStorage depending on mode.
  const leads = isSupabaseConfigured ? remoteLeads : fallbackLeads;

  const addLead = useCallback(async (lead) => {
    // Deduplicate on CNPJ + companyId — only when the lead actually has a CNPJ.
    // Leads created manually (no CNPJ) must always be inserted.
    const digits = (lead.cnpj || "").replace(/\D/g, "");
    if (digits) {
      const dup = leads.find(l => (l.cnpj || "").replace(/\D/g, "") === digits && l.companyId === lead.companyId);
      if (dup) return dup;
    }

    if (!isSupabaseConfigured) {
      setFallbackLeads(prev => [lead, ...prev]);
      return lead;
    }
    const row = leadToRow(lead, { created_by: userId });
    const { data, error: err } = await supabase.from("leads").insert(row).select().single();
    if (err) { setError(err); throw err; }
    const saved = rowToLead(data);
    setRemoteLeads(prev => prev.some(l => l.id === saved.id) ? prev : [saved, ...prev]);
    return saved;
  }, [leads, setFallbackLeads, userId]);

  const updateLead = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) {
      setFallbackLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch, lastActivity: new Date().toISOString() } : l));
      return;
    }
    const dbPatch = patchToRow(patch);
    // Optimistic update
    setRemoteLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    const { error: err } = await supabase.from("leads").update(dbPatch).eq("id", id);
    if (err) {
      setError(err);
      // Rollback by refetching
      fetchAll();
      throw err;
    }
  }, [setFallbackLeads, fetchAll]);

  const toggleStar = useCallback(async (id) => {
    const target = leads.find(l => l.id === id);
    if (!target) return;
    await updateLead(id, { starred: !target.starred });
  }, [leads, updateLead]);

  const changeStage = useCallback(async (id, stage) => {
    // status espelha stage no banco (mesmo CHECK, default igual). Sem este
    // patch, status fica defasado e relatórios baseados em status quebram.
    await updateLead(id, { stage, status: stage, stageChangedAt: new Date().toISOString() });
  }, [updateLead]);

  const loadDemoLeads = useCallback(async () => {
    const demo = generateLeadsForAllCompanies();
    if (!isSupabaseConfigured) {
      setFallbackLeads(demo);
      return;
    }
    // Strip owner (mock ids won't match real users) and tag as demo.
    const rows = demo.map(l => leadToRow({ ...l, owner: null }, { created_by: userId, is_demo: true }));
    // Insert in chunks of 30 to stay well below any request size limits.
    for (let i = 0; i < rows.length; i += 30) {
      const chunk = rows.slice(i, i + 30);
      const { error: err } = await supabase.from("leads").upsert(chunk, { onConflict: "id" });
      if (err) { setError(err); throw err; }
    }
    await fetchAll();
  }, [setFallbackLeads, userId, fetchAll]);

  const clearAllLeads = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFallbackLeads([]);
      return;
    }
    // Delete demo first (allowed for gerente+admin); other rows only admin can delete.
    const { error: err } = await supabase.from("leads").delete().not("id", "is", null);
    if (err) { setError(err); throw err; }
    setRemoteLeads([]);
  }, [setFallbackLeads]);

  const clearDemoLeads = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFallbackLeads(prev => prev.filter(l => !l.isDemo));
      return;
    }
    const { error: err } = await supabase.from("leads").delete().eq("is_demo", true);
    if (err) { setError(err); throw err; }
    setRemoteLeads(prev => prev.filter(l => !l.isDemo));
  }, [setFallbackLeads]);

  return useMemo(() => ({
    leads,
    loading,
    error,
    addLead,
    updateLead,
    toggleStar,
    changeStage,
    loadDemoLeads,
    clearAllLeads,
    clearDemoLeads,
    refetch: fetchAll,
    canQuery,
  }), [leads, loading, error, addLead, updateLead, toggleStar, changeStage, loadDemoLeads, clearAllLeads, clearDemoLeads, fetchAll, canQuery]);
}
