import React, { useCallback, useMemo, useState } from "react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { Select } from "../ui/Select";
import { LeadKanbanCard } from "../lead/LeadKanbanCard";
import { useUsersById } from "../../hooks/use-users-by-id";
import { formatK } from "../../utils/currency";

const TERMINAL = new Set(["ganho", "perdido"]);

export function CRMView({ user, activeCompany, leads, pipelines, users, onLeadClick, onStageChange, visibleStages }) {
  const isGroupView = activeCompany === "all";
  const isManager = user.role === "gerente";
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [draggedLead, setDraggedLead] = useState(null);

  const usersById = useUsersById(users);

  const companyForPipeline = isGroupView ? (user.companies[0] || "comercial") : activeCompany;
  const allStages = pipelines[companyForPipeline] || DEFAULT_PIPELINE_STAGES;
  const stages = useMemo(() => (
    visibleStages && visibleStages.length > 0
      ? allStages.filter(s => visibleStages.includes(s.id))
      : allStages
  ), [allStages, visibleStages]);
  const companyData = isGroupView ? null : COMPANIES[activeCompany];
  const accent = companyData?.primary || NEUTRAL.graphite;

  // Pre-owner-filter scope: used to derive the FULL seller dropdown so that
  // filtering by one seller doesn't hide the others.
  const companyScopedLeads = useMemo(() => {
    let s = leads;
    if (!isGroupView) s = s.filter(l => l.companyId === activeCompany);
    if (!isManager) s = s.filter(l => l.owner === user.id);
    return s;
  }, [leads, activeCompany, user.id, isGroupView, isManager]);

  const scopedLeads = useMemo(() => {
    if (isManager && ownerFilter !== "all") {
      return companyScopedLeads.filter(l => l.owner === ownerFilter);
    }
    return companyScopedLeads;
  }, [companyScopedLeads, ownerFilter, isManager]);

  // P1: bucket by stage in a single pass instead of filtering once per column.
  const byStage = useMemo(() => {
    const bucket = Object.create(null);
    for (const s of stages) bucket[s.id] = { leads: [], total: 0 };
    for (const l of scopedLeads) {
      if (bucket[l.stage]) {
        bucket[l.stage].leads.push(l);
        bucket[l.stage].total += l.value;
      }
    }
    return bucket;
  }, [stages, scopedLeads]);

  // Seller dropdown is built from the pre-owner-filter scope so every seller
  // stays selectable even after a filter is applied.
  const ownerOptions = useMemo(() => {
    const ids = Array.from(new Set(companyScopedLeads.map(l => l.owner).filter(Boolean)));
    return [
      { value: "all", label: "Todos os vendedores" },
      ...ids.map(id => ({ value: id, label: usersById.get(id)?.name || id })),
    ];
  }, [companyScopedLeads, usersById]);

  const summary = useMemo(() => {
    let pipelineValue = 0, won = 0, lost = 0;
    for (const l of scopedLeads) {
      if (l.stage === "ganho") won++;
      else if (l.stage === "perdido") lost++;
      else pipelineValue += l.value;
    }
    return { pipelineValue, won, lost };
  }, [scopedLeads]);

  const handleDrop = useCallback((stageId) => {
    if (draggedLead && draggedLead.stage !== stageId) {
      onStageChange(draggedLead.id, stageId);
    }
    setDraggedLead(null);
  }, [draggedLead, onStageChange]);

  const handleDragStart = useCallback((lead) => setDraggedLead(lead), []);
  const handleDragOver = useCallback((e) => e.preventDefault(), []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 28, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            CRM · Pipeline
          </h1>
          <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
            {scopedLeads.length} oportunidades · {formatK(summary.pipelineValue)} aberto ·{" "}
            {summary.won} ganho{summary.won !== 1 ? "s" : ""} · {summary.lost} perdido{summary.lost !== 1 ? "s" : ""}
          </p>
        </div>
        {isManager && (
          <Select
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
            options={ownerOptions}
            className="w-56"
          />
        )}
      </div>

      <div
        className="grid gap-3 overflow-x-auto"
        style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(260px, 1fr))` }}
      >
        {stages.map(stage => {
          const bucket = byStage[stage.id] || { leads: [], total: 0 };
          return (
            <div
              key={stage.id}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stage.id)}
              className="rounded-sm border flex flex-col"
              style={{ background: "#FFFFFF", borderColor: "#EFEFEF", minHeight: 420 }}
            >
              <div
                className="px-3 py-3 border-b flex items-center justify-between"
                style={{ borderColor: "#EFEFEF", borderTop: `3px solid ${stage.color}` }}
              >
                <div>
                  <div
                    className="text-xs uppercase font-bold tracking-wider"
                    style={{ color: NEUTRAL.graphite, letterSpacing: "0.08em" }}
                  >
                    {stage.name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>
                    {formatK(bucket.total)}
                  </div>
                </div>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: stage.color + "20", color: stage.color }}
                >
                  {bucket.leads.length}
                </div>
              </div>
              <div className="p-2 space-y-2 flex-1 overflow-y-auto" style={{ maxHeight: "65vh" }}>
                {bucket.leads.length === 0 ? (
                  <div className="text-center text-xs py-8" style={{ color: NEUTRAL.slate }}>
                    Sem leads aqui
                  </div>
                ) : (
                  bucket.leads.map(lead => {
                    const ownerName = lead.owner
                      ? (usersById.get(lead.owner)?.name?.split(" ")[0] || "—")
                      : null;
                    return (
                      <LeadKanbanCard
                        key={lead.id}
                        lead={lead}
                        ownerName={ownerName}
                        showOwnerFooter={isGroupView || isManager}
                        isGroupView={isGroupView}
                        onClick={onLeadClick}
                        onDragStart={handleDragStart}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="p-3 rounded-sm text-xs text-center"
        style={{ background: "#F5F5F3", color: NEUTRAL.slate }}
      >
        Arraste um card para mover entre etapas · Clique para ver detalhes e editar
      </div>
    </div>
  );
}

export default CRMView;
