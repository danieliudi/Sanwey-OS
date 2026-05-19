import React, { useMemo, useState } from "react";
import { GitBranch, RotateCcw, CheckCircle2, Lock, ArrowRight, ChevronDown, ChevronUp, Info } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES, defaultPipelines } from "../../constants/pipelines";

/**
 * PipelineBuilderView — visual stage-flow editor.
 *
 * Lets managers configure which transitions between pipeline stages are allowed.
 * Rules are persisted via the `transitions` prop (from usePipelineTransitions).
 *
 * Layout per company:
 *   [Stage → Stage → Stage …]   (horizontal flow)
 *   Below: from/to matrix showing enabled transitions as toggleable pills.
 */

const COMPANY_ORDER = ["industria", "resibag", "montemor"];

export function PipelineBuilderView({
  pipelines,
  transitions,   // { rules, isTransitionAllowed, toggleTransition, resetCompany }
  accessibleCompanies,
}) {
  const companies = useMemo(() => {
    const base = COMPANY_ORDER.filter(id =>
      !accessibleCompanies || accessibleCompanies.includes(id) || accessibleCompanies.includes("all")
    );
    return base;
  }, [accessibleCompanies]);

  const [activeCompany, setActiveCompany] = useState(companies[0] || "industria");

  const stages = useMemo(() => {
    const p = pipelines || defaultPipelines();
    return p[activeCompany] || DEFAULT_PIPELINE_STAGES;
  }, [pipelines, activeCompany]);

  const companyData = COMPANIES[activeCompany];
  const accent = companyData?.primary || NEUTRAL.graphite;
  const hasCustomRules = Boolean(transitions.rules[activeCompany]);

  // Non-terminal stages (can be sources)
  const sourceStages = stages.filter(s => !s.lost);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch size={22} style={{ color: NEUTRAL.graphite }} />
            <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
              Pipeline Builder
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
            Configure quais transições entre etapas são permitidas para cada empresa.
          </p>
        </div>

        {/* Company tabs */}
        <div className="flex items-center gap-1 rounded-xl border p-1" style={{ background: "#F5F5F3", borderColor: "#E5E5E5" }}>
          {companies.map(id => {
            const c = COMPANIES[id];
            const active = activeCompany === id;
            return (
              <button
                key={id}
                onClick={() => setActiveCompany(id)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
                style={{
                  background: active ? "#FFFFFF" : "transparent",
                  color: active ? (c?.primary || NEUTRAL.graphite) : NEUTRAL.slate,
                  boxShadow: active ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = active ? "#FFFFFF" : "transparent"; }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: c?.primary }} />
                {c?.short || id}
              </button>
            );
          })}
        </div>
      </div>

      {/* Flow diagram */}
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
      >
        <div className="flex items-start gap-0 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
          {stages.map((stage, idx) => (
            <React.Fragment key={stage.id}>
              {/* Stage box */}
              <div
                className="flex flex-col items-center shrink-0"
                style={{ width: 120 }}
              >
                <div
                  className="w-full rounded-xl border-t-2 px-3 py-3 text-center"
                  style={{
                    borderTopColor: stage.color,
                    borderColor: "#E5E7EB",
                    background: "#FFFFFF",
                    borderTopWidth: 3,
                    borderWidth: 1,
                  }}
                >
                  <div
                    className="text-xs font-bold mb-1"
                    style={{ color: stage.color }}
                  >
                    {stage.code}
                  </div>
                  <div className="text-xs font-semibold leading-tight" style={{ color: NEUTRAL.graphite }}>
                    {stage.name}
                  </div>
                  {stage.terminal && (
                    <div className="mt-1.5">
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          background: stage.won ? "#E8F2EC" : "#FEF2F2",
                          color: stage.won ? "#1A6E35" : "#B91C1C",
                        }}
                      >
                        {stage.won ? "Terminal" : "Perdido"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Arrow between stages */}
              {idx < stages.length - 1 && (
                <div className="flex items-center shrink-0 self-center mx-1">
                  <ArrowRight size={16} style={{ color: "#CBD5E1" }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Transition matrix */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
        {/* Matrix header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: "#F8F9FA", borderBottom: "1px solid #E5E7EB" }}
        >
          <div>
            <span className="text-sm font-semibold" style={{ color: NEUTRAL.graphite }}>
              Regras de transição
            </span>
            <span className="ml-2 text-xs" style={{ color: NEUTRAL.slate }}>
              {hasCustomRules
                ? "Regras personalizadas ativas"
                : "Todas as transições permitidas (padrão)"}
            </span>
          </div>
          {hasCustomRules && (
            <button
              onClick={() => transitions.resetCompany(activeCompany)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.slate, background: "#FFFFFF" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "#B91C1C"; e.currentTarget.style.borderColor = "#FECACA"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.color = NEUTRAL.slate; e.currentTarget.style.borderColor = "#E5E7EB"; }}
            >
              <RotateCcw size={11} />
              Resetar para padrão
            </button>
          )}
        </div>

        {/* Info banner */}
        <div
          className="px-4 py-2.5 flex items-start gap-2 text-xs border-b"
          style={{ background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1E40AF" }}
        >
          <Info size={12} className="shrink-0 mt-0.5" />
          <span>
            Clique em uma etapa de destino para habilitar ou bloquear a transição.
            Etapas bloqueadas no drag-and-drop mostrarão um aviso visual.
          </span>
        </div>

        {/* Per-stage rows */}
        <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
          {sourceStages.map(fromStage => {
            const allStageIds = stages.map(s => s.id);
            const allowedDests = transitions.getAllowedDestinations(activeCompany, fromStage.id, allStageIds);
            const possibleDests = stages.filter(s => s.id !== fromStage.id);

            return (
              <StageRow
                key={fromStage.id}
                fromStage={fromStage}
                possibleDests={possibleDests}
                allowedDests={allowedDests}
                hasCustomRules={hasCustomRules}
                onToggle={(toId) => transitions.toggleTransition(activeCompany, stages, fromStage.id, toId)}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs" style={{ color: NEUTRAL.slate }}>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={12} style={{ color: "#1A6E35" }} />
          Transição permitida
        </div>
        <div className="flex items-center gap-1.5">
          <Lock size={12} style={{ color: "#B91C1C" }} />
          Transição bloqueada
        </div>
      </div>
    </div>
  );
}

// ── Stage row in the matrix ──────────────────────────────────────────────────
function StageRow({ fromStage, possibleDests, allowedDests, hasCustomRules, onToggle }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: "#FAFAFA" }}
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: fromStage.color }}
        />
        <span className="text-xs font-semibold" style={{ color: NEUTRAL.graphite }}>
          De: {fromStage.name}
        </span>
        <span className="text-xs ml-auto" style={{ color: NEUTRAL.slate }}>
          {hasCustomRules ? `${allowedDests.length} permitida${allowedDests.length !== 1 ? "s" : ""}` : "Todas"}
        </span>
        <span style={{ color: NEUTRAL.slate }}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {possibleDests.map(toStage => {
            const allowed = !hasCustomRules || allowedDests.includes(toStage.id);
            return (
              <button
                key={toStage.id}
                onClick={() => onToggle(toStage.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all"
                style={{
                  background: allowed ? (toStage.color + "12") : "#F9FAFB",
                  borderColor: allowed ? toStage.color + "60" : "#E5E7EB",
                  color: allowed ? toStage.color : NEUTRAL.slate,
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.75"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                title={allowed ? `Bloquear transição para ${toStage.name}` : `Permitir transição para ${toStage.name}`}
              >
                {allowed
                  ? <CheckCircle2 size={11} />
                  : <Lock size={11} />
                }
                {toStage.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PipelineBuilderView;
