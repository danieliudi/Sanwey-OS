import React, { useEffect, useMemo, useState } from "react";
import {
  X, RotateCcw, CheckCircle2, Lock, ArrowRight, ChevronDown, ChevronUp,
  Info, Pencil, FastForward, Ban, CheckCheck, Eye, GitBranch, Filter, Trash2,
} from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { CRMStageListManager } from "../shared/stage-editor/StageListManager";
import { stageTextColor } from "../../utils/stage-colors";
import { SellerPreviewModal } from "./SellerPreviewModal";
import { useStageFields } from "../../hooks/use-stage-fields";
import { Modal } from "../ui/Modal";

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
  // Gate de etapa por valor (18/08/2026) — condição opcional pra um destino
  // específico, além do allowed bool já existente.
  const [conditionEditor, setConditionEditor] = useState(null); // { fromStage, toStage } | null
  const { getFields } = useStageFields();

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
                            color: stageTextColor(stage.color),
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
                      getTransitionCondition={(toId) => transitions.getTransitionCondition(companyId, fromStage.id, toId)}
                      onEditCondition={(toStage) => setConditionEditor({ fromStage, toStage })}
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
      {conditionEditor && (
        <TransitionConditionModal
          fromStage={conditionEditor.fromStage}
          toStage={conditionEditor.toStage}
          fields={getFields(companyId, conditionEditor.fromStage.id)}
          initialGroups={transitions.getTransitionCondition(companyId, conditionEditor.fromStage.id, conditionEditor.toStage.id)}
          onSave={(groups) => transitions.setTransitionCondition(companyId, conditionEditor.fromStage.id, conditionEditor.toStage.id, groups)}
          onClose={() => setConditionEditor(null)}
        />
      )}
    </>
  );
}

// ── Stage row in the matrix ──────────────────────────────────────────────────
function StageRow({
  fromStage, possibleDests, allowedDests, hasCustomRules,
  onToggle, onSetAll, onClearAll, onForwardOnly, accent,
  getTransitionCondition, onEditCondition,
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
            const condition = getTransitionCondition?.(toStage.id);
            const hasCondition = Array.isArray(condition) && condition.length > 0;
            return (
              <DestPill
                key={toStage.id}
                stage={toStage}
                allowed={allowed}
                hasCondition={hasCondition}
                onClick={() => onToggle(toStage.id)}
                onEditCondition={() => onEditCondition(toStage)}
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
//
// Gate de etapa por valor (18/08/2026): botão de condição (Filter) só
// aparece em pílula permitida — condicionar um destino já bloqueado não faz
// sentido. Ícone preenchido quando já existe condição salva pra esse
// destino, contornado quando não existe.
function DestPill({ stage, allowed, hasCondition, onClick, onEditCondition }) {
  if (allowed) {
    return (
      <span
        className="inline-flex items-center rounded-full overflow-hidden"
        style={{ border: `1px solid ${stage.color}` }}
      >
        <button
          onClick={onClick}
          className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-xs font-semibold transition-all cursor-pointer"
          style={{ background: stage.color, color: "#FFFFFF", border: "none" }}
          onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
          title={`Bloquear transição para ${stage.name}`}
        >
          <CheckCircle2 size={11} />
          <span className="font-bold text-[10px]" style={{ opacity: 0.8 }}>{stage.code}</span>
          {stage.name}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEditCondition(); }}
          className="flex items-center justify-center pl-1.5 pr-2.5 py-1.5 cursor-pointer"
          style={{ background: stage.color, color: "#FFFFFF", border: "none", opacity: hasCondition ? 1 : 0.55 }}
          title={hasCondition ? "Condição de avanço configurada — clique pra editar" : "Adicionar condição de avanço"}
        >
          <Filter size={11} fill={hasCondition ? "currentColor" : "none"} />
        </button>
      </span>
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

// ── Gate de etapa por valor — mini-editor de condição por transição ────────

const CONDITION_OPERATORS = [
  { id: "eq",           label: "é igual a" },
  { id: "neq",          label: "é diferente de" },
  { id: "gt",           label: "maior que" },
  { id: "lt",           label: "menor que" },
  { id: "contains",     label: "contém" },
  { id: "is_empty",     label: "está vazio" },
  { id: "is_not_empty", label: "não está vazio" },
];
const CONDITION_NO_VALUE_OPS = new Set(["is_empty", "is_not_empty"]);
const EMPTY_TRANSITION_CONDITION = { field: "", operator: "eq", value: "" };

// Editor compacto de condition_groups (18/08/2026, gap "gate de etapa por
// valor") — mesmo shape de automations.conditionGroups (OR entre grupos,
// AND dentro do grupo), mas escopado a UM destino específico e aos campos
// customizados da ETAPA DE ORIGEM (não uma lista fixa como o editor de
// Automações usa) — não é reaproveitável dali sem reescrever a fonte dos
// campos, e esta é só a 2ª ocorrência de editor de condition_groups na
// plataforma (regra 4 do CLAUDE.md: extrair pra shared/ só na 3ª).
function TransitionConditionModal({ fromStage, toStage, fields, initialGroups, onSave, onClose }) {
  const [groups, setGroups] = useState(() => (Array.isArray(initialGroups) && initialGroups.length ? initialGroups : []));
  const [saving, setSaving] = useState(false);

  const addGroup = () => setGroups(g => [...g, { logic: "AND", conditions: [{ ...EMPTY_TRANSITION_CONDITION }] }]);
  const removeGroup = (gi) => setGroups(g => g.filter((_, i) => i !== gi));
  const addCondition = (gi) => setGroups(g => g.map((grp, i) => i === gi ? { ...grp, conditions: [...grp.conditions, { ...EMPTY_TRANSITION_CONDITION }] } : grp));
  const removeCondition = (gi, ci) => setGroups(g => g.map((grp, i) => i === gi ? { ...grp, conditions: grp.conditions.filter((_, j) => j !== ci) } : grp));
  const patchCondition = (gi, ci, patch) => setGroups(g => g.map((grp, i) => i === gi
    ? { ...grp, conditions: grp.conditions.map((c, j) => j === ci ? { ...c, ...patch } : c) }
    : grp));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Grupo sem campo escolhido em nenhuma condição não serve de gate —
      // limpa antes de salvar pra não gravar lixo.
      const clean = groups
        .map(g => ({ ...g, conditions: g.conditions.filter(c => c.field) }))
        .filter(g => g.conditions.length > 0);
      await onSave(clean.length > 0 ? clean : null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Condição: ${fromStage.name} → ${toStage.name}`} width={480}>
      <div className="space-y-3">
        <div
          className="rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed"
          style={{ borderColor: "var(--border)", background: "var(--surface-alt)", color: "var(--text-dim)" }}
        >
          Opcional — além de "permitido/bloqueado", exige que um campo da etapa <b>{fromStage.name}</b> tenha
          um valor específico antes de avançar pra <b>{toStage.name}</b>. Condições no mesmo grupo exigem <b>E</b>;
          grupos diferentes são <b>OU</b>. Sem nenhuma condição, só o permitido/bloqueado decide.
        </div>

        {fields.length === 0 && (
          <div className="rounded-xl border px-3.5 py-2.5 text-xs" style={{ borderColor: "var(--warning)", background: "var(--warning-bg)", color: "var(--warning)" }}>
            A etapa "{fromStage.name}" não tem campo customizado nenhum — cadastre um em "Editar etapas" antes de configurar uma condição aqui.
          </div>
        )}

        {groups.length === 0 && fields.length > 0 && (
          <button
            onClick={addGroup}
            className="w-full flex items-center justify-center gap-1.5 p-3 text-xs font-semibold rounded-xl border-2 border-dashed cursor-pointer"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface-alt)" }}
          >
            <Filter size={13} />
            Adicionar condição
          </button>
        )}

        {groups.map((group, gi) => (
          <div key={gi} className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                {gi === 0 ? "Grupo 1" : `OU · Grupo ${gi + 1}`}
              </span>
              <button onClick={() => removeGroup(gi)} className="p-1 rounded cursor-pointer" style={{ color: "var(--text-faint)" }} title="Remover grupo">
                <Trash2 size={12} />
              </button>
            </div>

            {group.conditions.map((c, ci) => (
              <div key={ci} className="flex items-center gap-1.5">
                {ci > 0 && <span className="text-[10px] font-bold px-1.5 shrink-0" style={{ color: "var(--text-dim)" }}>E</span>}
                <select
                  value={c.field}
                  onChange={e => patchCondition(gi, ci, { field: e.target.value })}
                  className="flex-1 min-w-0 text-xs rounded-lg border px-2 py-1.5 outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                >
                  <option value="">Campo...</option>
                  {fields.map(f => <option key={f.fieldKey} value={f.fieldKey}>{f.label}</option>)}
                </select>
                <select
                  value={c.operator}
                  onChange={e => patchCondition(gi, ci, { operator: e.target.value })}
                  className="text-xs rounded-lg border px-2 py-1.5 outline-none shrink-0"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", width: 128 }}
                >
                  {CONDITION_OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                {!CONDITION_NO_VALUE_OPS.has(c.operator) && (
                  <input
                    type="text"
                    value={c.value}
                    onChange={e => patchCondition(gi, ci, { value: e.target.value })}
                    placeholder="Valor"
                    className="w-24 text-xs rounded-lg border px-2 py-1.5 outline-none shrink-0"
                    style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                  />
                )}
                <button onClick={() => removeCondition(gi, ci)} className="p-1 rounded cursor-pointer shrink-0" style={{ color: "var(--text-faint)" }} title="Remover condição">
                  <X size={12} />
                </button>
              </div>
            ))}

            <button
              onClick={() => addCondition(gi)}
              className="text-[11px] font-semibold cursor-pointer"
              style={{ color: "var(--accent)" }}
            >
              + condição (E)
            </button>
          </div>
        ))}

        {groups.length > 0 && (
          <button onClick={addGroup} className="text-[11px] font-semibold cursor-pointer" style={{ color: "var(--text-dim)" }}>
            + grupo (OU)
          </button>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer"
                  style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default PipelineStagesModal;
