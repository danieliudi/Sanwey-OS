import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "marketing_campaigns";

function rowToCampaign(r) {
  return {
    id:               r.id,
    companyIds:       Array.isArray(r.company_ids) ? r.company_ids : [],
    name:             r.name,
    channel:          r.channel ?? null,
    budget:           Number(r.budget || 0),
    kpi:              r.kpi ?? null,
    launchDate:       r.launch_date ?? null,
    endDate:          r.end_date ?? null,
    stage:            r.stage,
    stageChangedAt:   r.stage_changed_at ?? null,
    performanceScore: Number(r.performance_score || 0),
    owner:            r.owner ?? null,
    agencyName:       r.agency_name ?? null,
    utmUrl:           r.utm_url ?? null,
    driveFolderUrl:   r.drive_folder_url ?? null,
    driveFolderId:    r.drive_folder_id ?? null,
    approvalChecklist: Array.isArray(r.approval_checklist) ? r.approval_checklist : [],
    notes:            Array.isArray(r.notes) ? r.notes : [],
    activities:       Array.isArray(r.activities) ? r.activities : [],
    starred:          Boolean(r.starred),
    createdBy:        r.created_by ?? null,
    createdAt:        r.created_at ?? null,
    updatedAt:        r.updated_at ?? null,
  };
}

function campaignToRow(c, extras = {}) {
  return {
    company_ids:        c.companyIds ?? [],
    name:               c.name,
    channel:            c.channel ?? null,
    budget:             c.budget ?? 0,
    kpi:                c.kpi ?? null,
    launch_date:        c.launchDate ?? null,
    end_date:           c.endDate ?? null,
    stage:              c.stage ?? "briefing",
    stage_changed_at:   c.stageChangedAt ?? new Date().toISOString(),
    performance_score:  c.performanceScore ?? 0,
    owner:              c.owner ?? null,
    agency_name:        c.agencyName ?? null,
    utm_url:            c.utmUrl ?? null,
    drive_folder_url:   c.driveFolderUrl ?? null,
    drive_folder_id:    c.driveFolderId ?? null,
    approval_checklist: c.approvalChecklist ?? [],
    notes:              c.notes ?? [],
    activities:         c.activities ?? [],
    starred:            Boolean(c.starred),
    ...extras,
  };
}

export function useMarketingCampaigns({ userId, role } = {}) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const canWrite =
    role === "admin" ||
    role === "marketing" ||
    role === "gerente_marketing";

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
      setCampaigns((data || []).map(rowToCampaign));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Real-time subscription
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("marketing_campaigns_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        if (payload.eventType === "INSERT") {
          setCampaigns(prev => [rowToCampaign(payload.new), ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setCampaigns(prev => prev.map(c => c.id === payload.new.id ? rowToCampaign(payload.new) : c));
        } else if (payload.eventType === "DELETE") {
          setCampaigns(prev => prev.filter(c => c.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const createCampaign = useCallback(async (campaign) => {
    if (!isSupabaseConfigured || !canWrite) return null;
    const row = campaignToRow(campaign, { created_by: userId });
    const { data, error: err } = await supabase
      .from(TABLE)
      .insert(row)
      .select()
      .single();
    if (err) throw err;
    return rowToCampaign(data);
  }, [canWrite, userId]);

  const updateCampaign = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = campaigns.find(c => c.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    const row = campaignToRow(merged);
    const { error: err } = await supabase.from(TABLE).update(row).eq("id", id);
    if (err) throw err;
    // Optimistic update
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, [canWrite, campaigns]);

  const deleteCampaign = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setCampaigns(prev => prev.filter(c => c.id !== id));
  }, [canWrite]);

  const changeStage = useCallback(async (id, stage) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const now = new Date().toISOString();
    const { error: err } = await supabase
      .from(TABLE)
      .update({ stage, stage_changed_at: now })
      .eq("id", id);
    if (err) throw err;
    setCampaigns(prev =>
      prev.map(c => c.id === id ? { ...c, stage, stageChangedAt: now } : c)
    );
  }, [canWrite]);

  const toggleStar = useCallback(async (id) => {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign || !isSupabaseConfigured) return;
    const starred = !campaign.starred;
    await supabase.from(TABLE).update({ starred }).eq("id", id);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, starred } : c));
  }, [campaigns]);

  // Agency-safe checklist tick (no canWrite guard — agency can tick)
  const updateChecklist = useCallback(async (id, checklist) => {
    if (!isSupabaseConfigured) return;
    const { error: err } = await supabase
      .from(TABLE)
      .update({ approval_checklist: checklist })
      .eq("id", id);
    if (err) throw err;
    setCampaigns(prev =>
      prev.map(c => c.id === id ? { ...c, approvalChecklist: checklist } : c)
    );
  }, []);

  return {
    campaigns,
    loading,
    error,
    canWrite,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    changeStage,
    toggleStar,
    updateChecklist,
    refetch: fetchAll,
  };
}
