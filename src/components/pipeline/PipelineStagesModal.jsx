import React, { useEffect, useMemo, useState } from "react";
import {
  X, RotateCcw, CheckCircle2, Lock, ArrowRight, ChevronDown, ChevronUp,
  Info, Pencil, FastForward, Ban, CheckCheck, Eye, GitBranch,
} from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { CRMStageListManager } from "../shared/stage-editor/StageListManager";
import { SellerPreviewModal } from "./SellerPreviewModal";

/**
 * PipelineStagesModal — versão modal (escopada a uma única empresa) do
 * antigo PipelineBuilderView (página standalone /pipeline-builder,
 * removida). Mostra o fluxo de etapas + a matriz de regras de transição,
 * com atalhos pra abrir o StageEditorModal ("Editar etapas") e o
 * SellerPreviewModal ("Preview vendedor"). Aberto a partir do botão
 * "Editar etapas" na toolbar do Kanban do Funil de Vendas (CRMView) — a empresa
 * já vem resolvida pelo chamador (companyForPipeline), sem seletor de
 * empresa próprio.
 */
export function PipelineStagesModal({
  open,
  onClose,
  companyId,
  stages,
  transitions,
  leads,
  onReplacePipeline,
  onResetPipeline,
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Só fecha no Escape se nenhum modal aninhado (Editor/Preview) estiver
  // aberto — senão o Escape fecharia os dois de uma vez.
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === "Escape" && !editorOpen && !previewOpen) onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose, editorOpen, previewOpen]);

  const companyData = COMPANIES[companyId];
  const accent = companyData?.primary || "var(--text)";
  const hasCustomRules = Boolean(transitions?.rules?.[companyId]);

  const safeStages = stages || [];
  const sourceStages = safeStages.filter(s => !s.lost);
  const stageIndexById = useMemo(
    () => Object.fromEntries(safeStages.map((s, i) => [s.id, i])),
    [safeStages]
  );

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "var(--overlay-scrim)" }}
      >
        <div
          className="rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col"
          style={{ background: "var(--surface)", maxHeight: "90vh" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-5 py-4 border-b flex items-start justify-between gap-3 flex-wrap"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <div className="flex items-center gap-2">
                <GitBranch size={18} style={{ color: accent }} />
                <h2 className="font-bold" style={{ fontSize: 16, color: "var(--text)" }}>
                  Etapas do pipeline · {companyData?.short || companyId}
                </h2>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
                Configure as etapas e as transições permitidas nesta empresa.
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
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg cursor-pointer"
                style={{ color: "var(--text-dim)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-5">
            {/* Flow diagram */}
            <div
              className="rounded-xl border p-5"
              style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
            >
              <div className="flex items-center gap-0 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
                {safeStages.map((stage, idx) => (
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
                      <div className="px-3 pt-3 pb-1 flex items-center gap-2">
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
                              background: stage.won ? "var(--success-bg)" : "var(--danger-bg)",
                              color: stage.won ? "var(--success)" : "var(--danger)",
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
                    {idx < safeStages.length - 1 && (
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
                    onClick={() => transitions.resetCompany(companyId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
                    style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-bg)"; e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--danger) 35%, transparent)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                  >
                    <RotateCcw size={11} />
                    Resetar para padrão
                  </button>
                )}
              </div>

              <div
                className="px-4 py-2.5 flex items-start gap-2 text-xs border-b"
                style={{ background: "color-mix(in srgb, #2563EB 12%, var(--surface))", borderColor: "color-mix(in srgb, #2563EB 35%, transparent)", color: "color-mix(in srgb, #2563EB 60%, var(--text))" }}
              >
                <Info size={12} className="shrink-0 mt-0.5" />
                <span>
                  Clique numa pílula pra alternar a transição. Use os atalhos no canto direito de cada linha pra liberar/bloquear em bloco.
                </span>
              </div>

              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {sourceStages.map(fromStage => {
                  const allStageIds = safeStages.map(s => s.id);
                  const allowedDests = transitions.getAllowedDestinations(companyId, fromStage.id, allStageIds);
                  const possibleDests = safeStages.filter(s => s.id !== fromStage.id);
                  const fromIdx = stageIndexById[fromStage.id];
                  const forwardIds = safeStages
                    .filter((s, i) => i > fromIdx && !s.lost)
                    .map(s => s.id);

                  return (
                    <StageRow
                      key={fromStage.id}
                      fromStage={fromStage}
                      possibleDests={possibleDests}
                      allowedDests={allowedDests}
                      hasCustomRules={hasCustomRules}
                      onToggle={(toId) => transitions.toggleTransition(companyId, safeStages, fromStage.id, toId)}
                      onSetAll={() => transitions.setRowAllowed(companyId, safeStages, fromStage.id, possibleDests.map(s => s.id))}
                      onClearAll={() => transitions.setRowAllowed(companyId, safeStages, fromStage.id, [])}
                      onForwardOnly={() => transitions.setRowAllowed(companyId, safeStages, fromStage.id, forwardIds)}
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
          </div>
        </div>
      </div>

      <CRMStageListManager
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        companyId={companyId}
        companyLabel={companyData?.short}
        accent={accent}
        stages={safeStages}
        leads={leads}
        onReplacePipeline={onReplacePipeline}
        onResetPipeline={onResetPipeline}
      />
      <SellerPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        companyId={companyId}
        stages={safeStages}
        transitions={transitions}
      />
    </>
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
        className="w-full flex items-center gap-3 px-4 py-3 flex-wrap sm:flex-nowrap"
        style={{ background: "var(--surface-alt)" }}
      >
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
        >
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: fromStage.color }} />
          <span className="text-xs font-bold shrink-0" style={{ color: fromStage.color, minWidth: 16 }}>
            {fromStage.code}
          </span>
          <span className="text-xs font-semibold min-w-0 truncate" style={{ color: "var(--text)" }}>
            De: {fromStage.name}
          </span>
          <span className="text-xs shrink-0 hidden sm:inline" style={{ color: "var(--text-dim)" }}>
            · {allowedDests.length} de {possibleDests.length} destinos
          </span>
        </button>

        {/* Bulk actions — empilha abaixo do sm pra não ficar cortada pelo overflow-hidden do card pai */}
        <div className="flex items-center gap-1 flex-wrap w-full sm:w-auto sm:flex-nowrap sm:shrink-0">
          <BulkBtn onClick={onForwardOnly} icon={FastForward} label="Só avançar" tone={accent} />
          <BulkBtn onClick={onSetAll}      icon={CheckCheck}   label="Permitir todas" tone="var(--success)" />
          <BulkBtn onClick={onClearAll}    icon={Ban}          label="Bloquear todas" tone="var(--danger)" />
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
        e.currentTarget.style.background = `color-mix(in srgb, ${tone} 5%, transparent)`;
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
        color: "var(--text-faint)",
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
      style={{ background: "var(--surface-alt)", color: "var(--text-faint)", border: "1px dashed var(--border-strong)", textDecoration: "line-through" }}
    >
      <Lock size={9} /> bloq
    </span>
  );
}

export default PipelineStagesModal;
