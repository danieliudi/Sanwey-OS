import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { generateLeadsForAllCompanies } from "../data/generate-leads";
import { mergeGanhoDefaults } from "../utils/won-stage-defaults";
import { useConnectivity } from "./use-connectivity";
import { saveLeadsSnapshot, readLeadsSnapshot, enqueueActivity } from "./use-offline-cache";

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
    ownerIds: Array.isArray(r.owner_ids) ? r.owner_ids : (r.owner ? [r.owner] : []),
    urgency: r.urgency,
    decisionMaker: r.decision_maker || { name: "—", role: "—" },
    starred: Boolean(r.starred),
    notes: Array.isArray(r.notes) ? r.notes : [],
    activities: Array.isArray(r.activities) ? r.activities : [],
    clientClassification: r.client_classification ?? null,
    orderCount: r.order_count ?? 0,
    customFields: r.custom_fields && typeof r.custom_fields === "object" ? r.custom_fields : {},
    nextFollowUp: r.next_follow_up,
    clientId: r.client_id ?? null,
    createdAt: r.created_at,
    lastActivity: r.last_activity,
    stageChangedAt: r.stage_changed_at,
    isDemo: Boolean(r.is_demo),
    createdBy: r.created_by || null,
    badges: Array.isArray(r.badges) ? r.badges : [],
    sentToPosvendaAt: r.sent_to_posvenda_at ?? null,
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
    owner_ids: l.ownerIds ?? (l.owner ? [l.owner] : null),
    urgency: l.urgency ?? null,
    decision_maker: l.decisionMaker ?? {},
    starred: Boolean(l.starred),
    notes: l.notes ?? [],
    activities: l.activities ?? [],
    client_classification: l.clientClassification ?? null,
    order_count: l.orderCount ?? 0,
    custom_fields: l.customFields && typeof l.customFields === "object" ? l.customFields : {},
    next_follow_up: l.nextFollowUp ?? null,
    client_id: l.clientId ?? null,
    sent_to_posvenda_at: l.sentToPosvendaAt ?? null,
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
    clientId: "client_id",
    ownerIds: "owner_ids",
    sentToPosvendaAt: "sent_to_posvenda_at",
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

  const { isOnline } = useConnectivity();
  // Idade do snapshot lido do IndexedDB quando o app abre já offline — só a
  // UI (OfflineBanner) usa isso; não influencia nenhuma lógica de fetch.
  const [cacheAge, setCacheAge] = useState(null);
  const cacheAttemptedRef = useRef(false);

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
      const mapped = (data || []).map(rowToLead);
      setRemoteLeads(mapped);
      // Fire-and-forget — não bloqueia o state update por causa do cache.
      saveLeadsSnapshot(mapped).catch(() => {});
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
    // Nome do canal precisa ser único por instância do hook (mesmo padrão de
    // todo outro hook no app) — `leads-${userId}` sem sufixo aleatório
    // colidia sempre que useLeads() era chamado mais de uma vez pro mesmo
    // usuário (ex.: uma vez em App.jsx pra notificações, outra vez dentro de
    // useMyTasks/MinhasTarefasView) e o realtime-js multiplexa canais pelo
    // nome do tópico: a segunda instância tentava registrar postgres_changes
    // num canal que a primeira já tinha inscrito, e o cliente lança "cannot
    // add postgres_changes callbacks ... after subscribe()" — um throw
    // dentro de useEffect que nenhum ErrorBoundary pega, derrubando a tela
    // inteira pra branco.
    const channel = supabase
      .channel(`leads-${userId}-${Math.random().toString(36).slice(2, 9)}`)
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

  // Primeiro mount já offline: fetchAll() acima vai falhar (sem rede), então
  // popula a partir do último snapshot salvo no IndexedDB em vez de deixar a
  // tela vazia. Só tenta uma vez — não reage a toda transição de conectividade,
  // só ao carregamento inicial sem nenhum lead ainda em memória.
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;
    if (isOnline) return;
    if (cacheAttemptedRef.current) return;
    if (remoteLeads.length > 0) return;
    cacheAttemptedRef.current = true;
    readLeadsSnapshot().then(({ leads: cachedLeads, cachedAt }) => {
      if (!activeRef.current || !cachedLeads.length) return;
      setRemoteLeads(cachedLeads);
      setCacheAge(cachedAt);
      setLoading(false);
    }).catch(() => {});
  }, [isOnline, userId, remoteLeads.length]);

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

  // "Duplicar card" — cria um lead NOVO, sempre. Não passa por addLead: ali o
  // dedupe por CNPJ+companyId devolveria o próprio lead original (ou outro já
  // existente) em vez de criar a cópia, o que quebraria a garantia de
  // "duplicar sempre gera um registro novo". `firstStageId` vem de quem chama
  // (App.jsx conhece pipelines[companyId], configurável por empresa — este
  // hook não tem acesso a isso, só ao array estático de fallback).
  //
  // NÃO copiado: notes/activities (padrão geral), createdAt/createdBy (o
  // duplicador vira o novo criador), stageChangedAt (timestamp novo),
  // dateDetected/daysAgo (fato histórico da detecção do lead original, sem
  // sentido pra um card criado agora), lastActivity, sentToPosvendaAt
  // (transição específica do original), starred/badges (estado do original,
  // não "herdado"), nextFollowUp (lembrete agendado pro card antigo),
  // orderCount (contador não usado em nenhuma tela hoje, tratado como
  // histórico do cliente, não do card). De customFields (jsonb plano,
  // ver won-stage-defaults.js) removemos valor_final/data_fechamento — são
  // preenchidos automaticamente só ao entrar em "ganho" e representariam uma
  // decisão de fechamento já tomada no lead original.
  const duplicateLead = useCallback(async (source, firstStageId) => {
    const { valor_final, data_fechamento, ...restCustomFields } = source.customFields || {};
    const dup = {
      companyId: source.companyId,
      cnpj: source.cnpj,
      company: `${source.company} (cópia)`,
      razaoSocial: source.razaoSocial,
      sector: source.sector,
      cnae: source.cnae,
      size: source.size,
      city: source.city,
      state: source.state,
      address: source.address,
      capitalSocial: source.capitalSocial,
      contactEmail: source.contactEmail,
      phone: source.phone,
      situacao: source.situacao,
      trigger: source.trigger,
      triggerLabel: source.triggerLabel,
      evidence: source.evidence,
      fitScore: source.fitScore,
      sku: source.sku,
      skuName: source.skuName,
      unitPrice: source.unitPrice,
      quantity: source.quantity,
      value: source.value,
      probability: source.probability,
      closeDate: source.closeDate,
      stage: firstStageId,
      status: firstStageId,
      owner: source.owner,
      ownerIds: source.ownerIds,
      urgency: source.urgency,
      decisionMaker: source.decisionMaker,
      clientClassification: source.clientClassification,
      customFields: restCustomFields,
      clientId: source.clientId,
    };

    if (!isSupabaseConfigured) {
      const created = { ...dup, id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, notes: [], activities: [], starred: false, badges: [] };
      setFallbackLeads(prev => [created, ...prev]);
      return created;
    }
    const row = leadToRow(dup, { created_by: userId, is_demo: Boolean(source.isDemo) });
    row.id = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const { data, error: err } = await supabase.from("leads").insert(row).select().single();
    if (err) { setError(err); throw err; }
    const created = rowToLead(data);
    setRemoteLeads(prev => prev.some(l => l.id === created.id) ? prev : [created, ...prev]);
    return created;
  }, [setFallbackLeads, userId]);

  const toggleStar = useCallback(async (id) => {
    const target = leads.find(l => l.id === id);
    if (!target) return;
    await updateLead(id, { starred: !target.starred });
  }, [leads, updateLead]);

  const addLeadActivity = useCallback(async (leadId, activity) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    // Gera o id ANTES de decidir online/offline — mesmo precedente de
    // LeadCreateModal.jsx (crypto.randomUUID() no cliente), garante que a
    // entrada enfileirada localmente e a que aparece otimisticamente na tela
    // sejam idempotentes num retry.
    const id = activity.id || crypto.randomUUID();
    const newActivity = {
      timestamp: new Date().toISOString(),
      ...activity,
      id,
    };

    if (isSupabaseConfigured && !isOnline) {
      // Offline: aplica a MESMA atualização otimista local de sempre (a nota
      // já aparece na tela, marcada com pending:true — metadado só de UI,
      // nunca gravado no banco), mas NÃO chama supabase.update nem o
      // rollback-via-refetch de updateLead — é o desvio de propósito do
      // padrão online, documentado aqui pra não ser "corrigido" de volta.
      const activities = [...(lead.activities || []), { ...newActivity, pending: true }];
      setRemoteLeads(prev => prev.map(l => l.id === leadId ? { ...l, activities } : l));
      await enqueueActivity({ id, leadId, activity: newActivity, userId });
      return;
    }

    const activities = [...(lead.activities || []), newActivity];
    await updateLead(leadId, { activities });
  }, [leads, updateLead, isOnline, userId]);

  const changeStage = useCallback(async (id, stage) => {
    const lead = leads.find(l => l.id === id);
    const oldStage = lead?.stage;
    const nowISO = new Date().toISOString();
    // status espelha stage no banco (mesmo CHECK, default igual). Sem este
    // patch, status fica defasado e relatórios baseados em status quebram.
    const patch = { stage, status: stage, stageChangedAt: nowISO };
    // Auto-preenchimento ao entrar em "ganho": valor_final ← valor da proposta
    // e data_fechamento ← hoje (ver utils/won-stage-defaults.js).
    if (stage === "ganho" && oldStage !== "ganho") {
      const mergedCF = mergeGanhoDefaults(lead?.customFields, lead, nowISO);
      if (mergedCF) patch.customFields = mergedCF;
    }
    await updateLead(id, patch);
    if (oldStage && oldStage !== stage) {
      await addLeadActivity(id, {
        type: 'stage_changed',
        body: `Etapa alterada de "${oldStage}" para "${stage}"`,
        meta: { from: oldStage, to: stage },
      });
    }
  }, [leads, updateLead, addLeadActivity]);

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

  const deleteLead = useCallback(async (id) => {
    if (!isSupabaseConfigured) {
      setFallbackLeads(prev => prev.filter(l => l.id !== id));
      return;
    }
    const removed = leads.find(l => l.id === id);
    setRemoteLeads(prev => prev.filter(l => l.id !== id));
    const { error: err } = await supabase.from("leads").delete().eq("id", id);
    if (err) {
      setError(err);
      if (removed) setRemoteLeads(prev => [removed, ...prev]);
      fetchAll().catch(() => {});
      throw err;
    }
  }, [leads, setFallbackLeads, fetchAll]);

  return useMemo(() => ({
    leads,
    loading,
    error,
    addLead,
    updateLead,
    deleteLead,
    duplicateLead,
    toggleStar,
    changeStage,
    addLeadActivity,
    loadDemoLeads,
    clearAllLeads,
    clearDemoLeads,
    refetch: fetchAll,
    canQuery,
    isOnline,
    cacheAge,
  }), [leads, loading, error, addLead, updateLead, deleteLead, duplicateLead, toggleStar, changeStage, addLeadActivity, loadDemoLeads, clearAllLeads, clearDemoLeads, fetchAll, canQuery, isOnline, cacheAge]);
}
