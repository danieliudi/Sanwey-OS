import React, { useEffect, useMemo, useState } from "react";
import { X, GitBranch, Eye, Asterisk, Pencil, Trash2, Plus } from "lucide-react";

// "Condicionais de campo" — apresentação em flow-card (condição → "Então faça
// isso" → ação), no layout do Pipefy, sobre o MESMO dado de sempre:
// visible_if / required_if no shape { fieldKey, operator, value } avaliado
// por src/utils/field-conditions.js. Nenhum motor novo — só a casca.
//
// `extraSources` (27/08/2026) permite que a tela dona ofereça origens de
// condição que NÃO são campos daquela etapa — hoje só o Meu To-Do usa, pra
// condicionar campo por etiqueta da tarefa (ver PersonalStageFieldsPanel e o
// `__etiquetas` injetado em PersonalTaskDetailDrawer). Shape:
// [{ fieldKey, label, hint? }]. Opcional e vazio por padrão: quem não passa
// (Pipeline/RH) se comporta exatamente como antes.

const OPERATORS = [
  { value: "eq",           label: "é igual a" },
  { value: "neq",          label: "é diferente de" },
  { value: "contains",     label: "contém" },
  { value: "gt",           label: "maior que" },
  { value: "lt",           label: "menor que" },
  { value: "gte",          label: "maior ou igual a" },
  { value: "lte",          label: "menor ou igual a" },
  { value: "is_empty",     label: "está vazio" },
  { value: "is_not_empty", label: "não está vazio" },
];
const NO_VALUE_OPERATORS = new Set(["is_empty", "is_not_empty"]);

const INPUT_BASE = {
  width: "100%", fontSize: 12, borderRadius: 6, border: "1px solid var(--border-strong)",
  padding: "6px 9px", color: "var(--text)", background: "var(--surface)",
  outline: "none", boxSizing: "border-box",
};
const SELECT_STYLE = {
  ...INPUT_BASE, appearance: "none",
  backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
  backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "11px", paddingRight: 26,
};

function operatorLabel(op) {
  return OPERATORS.find(o => o.value === op)?.label || op;
}

// Lista achatada de condicionais existentes: uma entrada por (campo alvo, tipo).
function extractConditionals(fields) {
  const out = [];
  for (const f of fields) {
    if (f.visibleIf)  out.push({ targetId: f.id, kind: "visible",  condition: f.visibleIf,  target: f });
    if (f.requiredIf) out.push({ targetId: f.id, kind: "required", condition: f.requiredIf, target: f });
  }
  return out;
}

// ── Caixa de condição/ação do flow ───────────────────────────────────────────

function FlowBox({ icon: Icon, children, accent, dashed = false }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-3 py-2"
      style={{
        background: "var(--surface)",
        borderColor: dashed ? "var(--border-strong)" : "var(--border)",
        borderStyle: dashed ? "dashed" : "solid",
        boxShadow: dashed ? "none" : "0 1px 2px rgba(15, 23, 42, 0.06)",
        fontSize: 13, color: "var(--text)", fontWeight: 600,
      }}
    >
      {Icon && <Icon size={14} style={{ color: accent, flexShrink: 0 }} />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function FlowConnector({ label }) {
  return (
    <div className="flex items-stretch gap-2.5" style={{ marginLeft: 14 }}>
      <div style={{ width: 1.5, background: "var(--border-strong)", borderRadius: 1 }} />
      <div className="py-1.5" style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}

// ── Card de uma condicional (leitura + edição) ───────────────────────────────

function ConditionalCard({ entry, fields, extraSources = [], accent, busy, onSave, onDelete, startEditing = false }) {
  const [editing, setEditing] = useState(startEditing);
  const [confirmDel, setConfirmDel] = useState(false);

  const isNew = !entry.target;
  const [targetId, setTargetId] = useState(entry.targetId || "");
  const [kind, setKind]         = useState(entry.kind || "visible");
  const [cond, setCond]         = useState(entry.condition || { fieldKey: "", operator: "eq", value: "" });
  const [error, setError]       = useState(null);

  const target = fields.find(f => f.id === (isNew ? targetId : entry.targetId)) || entry.target;
  const activeKey = (editing ? cond : entry.condition)?.fieldKey;
  const sourceField =
    fields.find(f => f.fieldKey === activeKey) || extraSources.find(s => s.fieldKey === activeKey);

  // Alvos possíveis: qualquer campo != origem; pra "Exigir", campos já
  // obrigatórios sempre ficam de fora (condição não se aplica).
  const targetChoices = useMemo(
    () => fields.filter(f => (kind === "required" ? !f.required : true)),
    [fields, kind]
  );
  // Origens: as externas primeiro (ex.: etiqueta da tarefa — não pertence a
  // etapa nenhuma, então nunca colide com o campo alvo), depois os campos da
  // própria etapa menos o alvo.
  const sourceChoices = useMemo(
    () => [
      ...extraSources,
      ...fields.filter(f => f.id !== (isNew ? targetId : entry.targetId)),
    ],
    [extraSources, fields, isNew, targetId, entry.targetId]
  );
  const activeExtra = extraSources.find(s => s.fieldKey === cond.fieldKey);

  const handleSave = async () => {
    if (!targetId && isNew) { setError("Escolha o campo alvo da ação."); return; }
    if (!cond.fieldKey) { setError("Escolha o campo da condição."); return; }
    const finalTarget = fields.find(f => f.id === (isNew ? targetId : entry.targetId));
    if (finalTarget && cond.fieldKey === finalTarget.fieldKey) {
      setError("O campo da condição não pode ser o próprio campo alvo.");
      return;
    }
    setError(null);
    await onSave({
      targetId: isNew ? targetId : entry.targetId,
      kind,
      condition: { ...cond, value: NO_VALUE_OPERATORS.has(cond.operator) ? "" : cond.value },
      previous: isNew ? null : entry,
    });
    setEditing(false);
  };

  if (!editing) {
    return (
      <div
        className="rounded-xl border p-3.5"
        style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-0">
            <FlowBox icon={GitBranch} accent={accent}>
              <span style={{ fontWeight: 700 }}>{sourceField?.label || entry.condition?.fieldKey}</span>
              {" "}{operatorLabel(entry.condition?.operator)}
              {!NO_VALUE_OPERATORS.has(entry.condition?.operator) && (
                <> "{String(entry.condition?.value ?? "")}"</>
              )}?
            </FlowBox>
            <FlowConnector label="Então faça isso" />
            <FlowBox icon={entry.kind === "visible" ? Eye : Asterisk} accent={accent}>
              {entry.kind === "visible" ? "Mostrar " : "Exigir "}
              <span style={{ fontWeight: 700 }}>{target?.label}</span>
            </FlowBox>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => { setTargetId(entry.targetId); setKind(entry.kind); setCond(entry.condition); setEditing(true); }}
              disabled={busy}
              className="p-1.5 rounded-md cursor-pointer"
              style={{ color: "var(--text-dim)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
              title="Editar condicional"
            >
              <Pencil size={13} />
            </button>
            {confirmDel ? (
              <button
                onClick={() => onDelete(entry)}
                disabled={busy}
                className="text-[11px] font-bold px-2 py-1 rounded-md cursor-pointer"
                style={{ background: "var(--danger)", color: "var(--on-accent)", border: "none" }}
              >
                Remover
              </button>
            ) : (
              <button
                onClick={() => setConfirmDel(true)}
                disabled={busy}
                className="p-1.5 rounded-md cursor-pointer"
                style={{ color: "var(--text-dim)" }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
                title="Remover condicional"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Modo edição — mesmas caixas do flow, com selects dentro.
  return (
    <div
      className="rounded-xl border p-3.5"
      style={{ borderColor: accent, background: "var(--surface-alt)" }}
    >
      <FlowBox icon={GitBranch} accent={accent}>
        <div className="flex flex-col gap-1.5">
          <select
            value={cond.fieldKey}
            onChange={e => setCond(c => ({ ...c, fieldKey: e.target.value }))}
            style={SELECT_STYLE}
          >
            <option value="">Campo da condição…</option>
            {sourceChoices.map(f => <option key={f.id || f.fieldKey} value={f.fieldKey}>{f.label}</option>)}
          </select>
          {activeExtra?.hint && (
            <div style={{ fontSize: 11, color: "var(--text-faint)", lineHeight: 1.45 }}>{activeExtra.hint}</div>
          )}
          <select
            value={cond.operator}
            onChange={e => setCond(c => ({ ...c, operator: e.target.value }))}
            style={SELECT_STYLE}
          >
            {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {!NO_VALUE_OPERATORS.has(cond.operator) && (
            <input
              type="text"
              value={cond.value ?? ""}
              onChange={e => setCond(c => ({ ...c, value: e.target.value }))}
              placeholder="Valor"
              style={INPUT_BASE}
            />
          )}
        </div>
      </FlowBox>
      <FlowConnector label="Então faça isso" />
      <FlowBox icon={kind === "visible" ? Eye : Asterisk} accent={accent}>
        <div className="flex flex-col gap-1.5">
          <select
            value={kind}
            onChange={e => setKind(e.target.value)}
            style={SELECT_STYLE}
            disabled={!isNew}
            title={isNew ? undefined : "Pra trocar o tipo de ação, remova e crie de novo."}
          >
            <option value="visible">Mostrar campo</option>
            <option value="required">Exigir preenchimento</option>
          </select>
          <select
            value={isNew ? targetId : entry.targetId}
            onChange={e => setTargetId(e.target.value)}
            style={SELECT_STYLE}
            disabled={!isNew}
          >
            <option value="">Campo alvo…</option>
            {targetChoices.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
      </FlowBox>

      {error && (
        <div style={{ fontSize: 12, color: "var(--danger)", background: "var(--danger-bg)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)", borderRadius: 6, padding: "6px 10px", marginTop: 10 }}>
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          onClick={() => { setError(null); setEditing(false); if (isNew) onDelete(entry); }}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
          style={{ background: busy ? "#9CA3AF" : accent, color: "#FFFFFF" }}
        >
          Salvar condicional
        </button>
      </div>
    </div>
  );
}

// ── Modal principal ──────────────────────────────────────────────────────────

export function StageConditionsModal({ open, onClose, fields, extraSources = [], onSaveField, accent = "var(--accent)", busy = false }) {
  const [drafts, setDrafts] = useState([]); // condicionais novas ainda não salvas

  useEffect(() => {
    if (open) setDrafts([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", h, true);
    return () => document.removeEventListener("keydown", h, true);
  }, [open, onClose]);

  const existing = useMemo(() => extractConditionals(fields || []), [fields]);

  if (!open) return null;

  const handleSave = async ({ targetId, kind, condition, previous }) => {
    const field = fields.find(f => f.id === targetId);
    if (!field) return;
    const patch = kind === "visible" ? { visibleIf: condition } : { requiredIf: condition };
    // Movendo a condicional pra outro campo alvo (só em edição de existente
    // não acontece — alvo fica travado); limpa drafts salvos.
    await onSaveField(field.id, patch);
    if (!previous) setDrafts(d => d.slice(0, -1));
  };

  const handleDelete = async (entry) => {
    if (!entry.target) { setDrafts(d => d.filter(x => x !== entry)); return; }
    const patch = entry.kind === "visible" ? { visibleIf: null } : { requiredIf: null };
    await onSaveField(entry.targetId, patch);
  };

  // Com origem externa disponível (ex.: etiqueta), 1 campo já basta — a
  // condição não precisa de um 2º campo da etapa pra comparar contra.
  const canCreate = (fields || []).length >= (extraSources.length > 0 ? 1 : 2);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "var(--overlay-scrim)" }}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ background: "var(--surface)", maxHeight: "88vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-bold flex items-center gap-2" style={{ fontSize: 17, color: "var(--text)" }}>
              <GitBranch size={16} style={{ color: accent }} />
              Condicionais de campo
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg cursor-pointer shrink-0"
              style={{ color: "var(--text-dim)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
            Mostre apenas o que é relevante para quem preenche. Controle a exibição e a obrigatoriedade dos campos com base nas respostas do formulário.
          </p>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-3">
          {existing.length === 0 && drafts.length === 0 && (
            <div
              className="py-10 text-center rounded-xl border-2 border-dashed text-xs"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              {canCreate
                ? "Nenhuma condicional configurada nesta fase."
                : extraSources.length > 0
                  ? "Crie pelo menos 1 campo nesta fase pra poder condicioná-lo."
                  : "Crie pelo menos 2 campos nesta fase pra poder condicionar um ao outro."}
            </div>
          )}

          {existing.map(entry => (
            <ConditionalCard
              key={`${entry.targetId}-${entry.kind}`}
              entry={entry}
              fields={fields}
              extraSources={extraSources}
              accent={accent}
              busy={busy}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          ))}

          {drafts.map((d, i) => (
            <ConditionalCard
              key={`draft-${i}`}
              entry={d}
              fields={fields}
              extraSources={extraSources}
              accent={accent}
              busy={busy}
              onSave={handleSave}
              onDelete={handleDelete}
              startEditing
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => canCreate && setDrafts(d => [...d, { targetId: "", kind: "visible", condition: { fieldKey: "", operator: "eq", value: "" }, target: null }])}
            disabled={!canCreate || busy || drafts.length > 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full cursor-pointer"
            style={{
              background: !canCreate || drafts.length > 0 ? "#9CA3AF" : accent,
              color: "#FFFFFF", border: "none",
              cursor: !canCreate || drafts.length > 0 ? "not-allowed" : "pointer",
            }}
          >
            <Plus size={14} />
            Criar condicional
          </button>
        </div>
      </div>
    </div>
  );
}

export default StageConditionsModal;
