import React, { useMemo, useState } from "react";
import {
  GitBranch, RotateCcw, CheckCircle2, Lock, ArrowRight, ChevronDown, ChevronUp,
  Info, Pencil, FastForward, Ban, CheckCheck, Eye,
} from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES, defaultPipelines } from "../../constants/pipelines";
import { StageEditorModal } from "../pipeline/StageEditorModal";
import { SellerPreviewModal } from "../pipeline/SellerPreviewModal";

/**
 * PipelineBuilderView — visual stage-flow editor.
 *
 * Per company:
 *   - Topo: cards das etapas (overview do fluxo)
 *   - Botão "Editar etapas" → modal com rename/recolor/probability/reorder
 *   - Matriz de transições com bulk actions por linha
 */

const COMPANY_ORDER = ["industria", "resibag"];

export function PipelineBuilderView({
  pipelines,
  transitions,
  accessibleCompanies,
  onReplacePipeline,
  onResetPipeline,
  leads,
}) {
  const companies = useMemo(() => {
    return COMPANY_ORDER.filter(id =>
      !accessibleCompanies || accessibleCompanies.includes(id) || accessibleCompanies.includes("all")
    );
  }, [accessibleCompanies]);

  const [activeCompany, setActiveCompany] = useState(companies[0] || "industria");
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const stages = useMemo(() => {
    const p = pipelines || defaultPipelines();
    return p[activeCompany] || DEFAULT_PIPELINE_STAGES;
  }, [pipelines, activeCompany]);

  const companyData = COMPANIES[activeCompany];
  const accent = companyData?.primary || "var(--text)";
  const hasCustomRules = Boolean(transitions.rules[activeCompany]);

  const sourceStages = stages.filter(s => !s.lost);
  const stageIndexById = useMemo(
    () => Object.fromEntries(stages.map((s, i) => [s.id, i])),
    [stages]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch size={22} style={{ color: "var(--text)" }} />
            <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Pipeline Builder
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>
            Configure as etapas e as transições permitidas em cada empresa.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
          >
            <Eye size={11} />
            Preview vendedor
          </button>
          <button
            onClick={() => setEditorOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
          >
            <Pencil size={11} />
            Editar etapas
          </button>

          {/* Company tabs */}
          <div className="overflow-x-auto max-w-full" style={{ scrollbarWidth: "none" }}>
            <div className="flex items-center gap-1 rounded-xl border p-1" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", width: "max-content" }}>
              {companies.map(id => {
                const c = COMPANIES[id];
                const active = activeCompany === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveCompany(id)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                    style={{
                      background: active ? "var(--surface)" : "transparent",
                      color: active ? (c?.primary || "var(--text)") : "var(--text-dim)",
                      boxShadow: active ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = active ? "var(--surface)" : "transparent"; }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: c?.primary }} />
                    {c?.short || id}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Flow diagram */}
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
      >
        <div className="flex items-center gap-0 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
          {stages.map((stage, idx) => (
            <React.Fragment key={stage.id}>
              {/* Stage card */}
              <div
                className="shrink-0 rounded-xl border flex flex-col"
                style={{
                  minWidth: 130,
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  borderTopWidth: 3,
                  borderTopColor: stage.color,
                  overflow: "hidden",
                }}
              >
                {/* Code badge */}
                <div
                  className="px-3 pt-3 pb-1 flex items-center gap-2"
                >
                  <span
                    className="inline-flex items-center justify-center rounded-md text-xs font-bold shrink-0"
                    style={{
                      width: 22, height: 22,
                      background: stage.color + "18",
                      color: stage.color,
                    }}
                  >
                    {stage.code}
                  </span>
                  {stage.terminal && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{
                        background: stage.won ? "#E8F2EC" : "#FEF2F2",
                        color: stage.won ? "#1A6E35" : "var(--danger)",
                      }}
                    >
                      {stage.won ? "Terminal" : "Perdido"}
                    </span>
                  )}
                </div>

                {/* Name + probability */}
                <div className="px-3 pb-3">
                  <div
                    className="font-semibold leading-snug text-xs"
                    style={{ color: "var(--text)" }}
                  >
                    {stage.name}
                  </div>
                  {Number.isFinite(stage.probability) && !stage.terminal && (
                    <div className="text-[10px] mt-0.5 font-medium" style={{ color: "var(--text-dim)" }}>
                      {stage.probability}%
                    </div>
                  )}
                </div>
              </div>

              {/* Arrow connector */}
              {idx < stages.length - 1 && (
                <div className="flex items-center shrink-0 px-1.5">
                  <ArrowRight size={14} style={{ color: "#CBD5E1" }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Transition matrix */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: "var(--surface-alt)", borderBottom: `1px solid var(--border)` }}
        >
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Regras de transição
            </span>
            <span className="ml-2 text-xs" style={{ color: "var(--text-dim)" }}>
              {hasCustomRules
                ? "Regras personalizadas ativas"
                : "Todas as transições permitidas (padrão)"}
            </span>
          </div>
          {hasCustomRules && (
            <button
              onClick={() => transitions.resetCompany(activeCompany)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.borderColor = "#FECACA"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <RotateCcw size={11} />
              Resetar para padrão
            </button>
          )}
        </div>

        <div
          className="px-4 py-2.5 flex items-start gap-2 text-xs border-b"
          style={{ background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1E40AF" }}
        >
          <Info size={12} className="shrink-0 mt-0.5" />
          <span>
            Clique numa pílula pra alternar a transição. Use os atalhos no canto direito de cada linha pra liberar/bloquear em bloco.
          </span>
        </div>

        <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
          {sourceStages.map(fromStage => {
            const allStageIds = stages.map(s => s.id);
            const allowedDests = transitions.getAllowedDestinations(activeCompany, fromStage.id, allStageIds);
            const possibleDests = stages.filter(s => s.id !== fromStage.id);
            const fromIdx = stageIndexById[fromStage.id];
            const forwardIds = stages
              .filter((s, i) => i > fromIdx && !s.lost)
              .map(s => s.id);

            return (
              <StageRow
                key={fromStage.id}
                fromStage={fromStage}
                possibleDests={possibleDests}
                allowedDests={allowedDests}
                hasCustomRules={hasCustomRules}
                onToggle={(toId) => transitions.toggleTransition(activeCompany, stages, fromStage.id, toId)}
                onSetAll={() => transitions.setRowAllowed(activeCompany, stages, fromStage.id, possibleDests.map(s => s.id))}
                onClearAll={() => transitions.setRowAllowed(activeCompany, stages, fromStage.id, [])}
                onForwardOnly={() => transitions.setRowAllowed(activeCompany, stages, fromStage.id, forwardIds)}
                accent={accent}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs flex-wrap" style={{ color: "var(--text-dim)" }}>
        <div className="flex items-center gap-2">
          <PillSample allowed />
          Transição permitida
        </div>
        <div className="flex items-center gap-2">
          <PillSample />
          Transição bloqueada
        </div>
      </div>

      <StageEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        companyId={activeCompany}
        stages={stages}
        leads={leads}
        onReplacePipeline={onReplacePipeline}
        onResetPipeline={onResetPipeline}
      />
      <SellerPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        companyId={activeCompany}
        stages={stages}
        transitions={transitions}
      />
    </div>
  );
}

// ── Stage row in the matrix ──────────────────────────────────────────────────
function StageRow({
  fromStage, possibleDests, allowedDests, hasCustomRules,
  onToggle, onSetAll, onClearAll, onForwardOnly, accent,
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <div
        className="w-full flex items-center gap-3 px-4 py-3"
        style={{ background: "var(--surface-alt)" }}
      >
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-3 flex-1 text-left cursor-pointer"
        >
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: fromStage.color }} />
          <span className="text-xs font-bold" style={{ color: fromStage.color, minWidth: 16 }}>
            {fromStage.code}
          </span>
          <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
            De: {fromStage.name}
          </span>
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>
            · {allowedDests.length} de {possibleDests.length} destinos
          </span>
        </button>

        {/* Bulk actions */}
        <div className="flex items-center gap-1 shrink-0">
          <BulkBtn onClick={onForwardOnly} icon={FastForward} label="Só avançar" tone={accent} />
          <BulkBtn onClick={onSetAll}      icon={CheckCheck}   label="Permitir todas" tone="#047857" />
          <BulkBtn onClick={onClearAll}    icon={Ban}          label="Bloquear todas" tone="#B91C1C" />
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 ml-1 cursor-pointer"
            style={{ color: "var(--text-dim)" }}
            aria-label={expanded ? "Recolher" : "Expandir"}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {possibleDests.map(toStage => {
            const allowed = !hasCustomRules || allowedDests.includes(toStage.id);
            return (
              <DestPill
                key={toStage.id}
                stage={toStage}
                allowed={allowed}
                onClick={() => onToggle(toStage.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function BulkBtn({ onClick, icon: Icon, label, tone }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border cursor-pointer transition-colors"
      style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = tone;
        e.currentTarget.style.color = tone;
        e.currentTarget.style.background = tone + "0D";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.color = "var(--text-dim)";
        e.currentTarget.style.background = "var(--surface)";
      }}
      title={label}
    >
      <Icon size={10} />
      {label}
    </button>
  );
}

// Pill nova: permitida = preenchida (cor da etapa). Bloqueada = tracejada
// cinza com texto riscado. Affordance fica óbvia batendo o olho.
function DestPill({ stage, allowed, onClick }) {
  if (allowed) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
        style={{
          background: stage.color,
          color: "#FFFFFF",
          border: `1px solid ${stage.color}`,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
        title={`Bloquear transição para ${stage.name}`}
      >
        <CheckCircle2 size={11} />
        <span className="font-bold text-[10px]" style={{ opacity: 0.8 }}>{stage.code}</span>
        {stage.name}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer"
      style={{
        background: "var(--surface-alt)",
        color: "#9CA3AF",
        border: "1px dashed var(--border-strong)",
        textDecoration: "line-through",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = stage.color; e.currentTarget.style.color = stage.color; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "#9CA3AF"; }}
      title={`Permitir transição para ${stage.name}`}
    >
      <Lock size={11} />
      <span className="font-bold text-[10px]">{stage.code}</span>
      {stage.name}
    </button>
  );
}

function PillSample({ allowed }) {
  return allowed ? (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: "#1E3A8A", color: "#FFFFFF" }}
    >
      <CheckCircle2 size={9} /> ok
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
      style={{ background: "var(--surface-alt)", color: "#9CA3AF", border: "1px dashed var(--border-strong)", textDecoration: "line-through" }}
    >
      <Lock size={9} /> bloq
    </span>
  );
}

export default PipelineBuilderView;
