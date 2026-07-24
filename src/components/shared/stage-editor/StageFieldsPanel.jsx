import React, { useEffect, useMemo, useState } from "react";
import {
  X, Trash2, ChevronUp, ChevronDown, Plus, Check,
  GitBranch, ShieldCheck, Settings2, SlidersHorizontal, Zap,
} from "lucide-react";
import { FIELD_TYPES, TYPE_ICON, OPTION_FIELD_TYPES } from "../../../constants/field-types";
import { VALIDATION_PRESETS, VALIDATION_RULE_TYPES } from "../../../utils/field-validation";
import { slugifyKey } from "../../../hooks/use-stage-fields";
import { StageConditionsModal } from "./StageConditionsModal";
import { StageAdvancedModal } from "./StageAdvancedModal";

// Editor de campos da fase ("Editar fase") no layout do Pipefy: sidebar de
// tipos de campo à esquerda, canvas com tint da cor da fase, card "Fase
// atual" com a lista de campos, e ações "Condicionais em campos" + "Opções
// Avançadas" no topo. Agnóstico de tabela: a diferença CRM vs RH fica nos
// wrappers (CRMStageFieldsPanel / RHStageFieldsPanel), que injetam o hook
// de dados certo.

const INPUT_BASE = {
  width: "100%", fontSize: 13, borderRadius: 6, border: "1px solid var(--border-strong)",
  padding: "7px 10px", color: "var(--text)", background: "var(--surface)",
  outline: "none", boxSizing: "border-box",
};
const SELECT_STYLE = {
  ...INPUT_BASE, appearance: "none",
  backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
  backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "12px", paddingRight: 28,
};

function focusStyle(e) { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--accent) 12%, transparent)"; }
function blurStyle(e)  { e.target.style.borderColor = "var(--border-strong)"; e.target.style.boxShadow = "none"; }

// ── ValidationRuleBlock ───────────────────────────────────────────────────────

function ValidationRuleBlock({ fieldType, rule, onChange, accent }) {
  const enabled = !!rule;
  const preset = VALIDATION_PRESETS[fieldType];

  const handleToggle = (checked) => {
    if (!checked) { onChange(null); return; }
    if (preset) {
      onChange({
        type: preset.type,
        ...(preset.pattern != null ? { pattern: preset.pattern } : {}),
        ...(preset.min != null ? { min: preset.min } : {}),
        ...(preset.max != null ? { max: preset.max } : {}),
      });
    } else {
      onChange({ type: "cnpj" });
    }
  };

  const handleTypeChange = (newType) => {
    if (newType === "regex") {
      const presetPattern = preset?.type === "regex" ? preset.pattern : "";
      onChange({ type: "regex", pattern: rule.type === "regex" && rule.pattern ? rule.pattern : presetPattern });
    } else if (newType === "range") {
      onChange({
        type: "range",
        min: rule.type === "range" && rule.min != null ? rule.min : (preset?.type === "range" ? preset.min : undefined),
        max: rule.type === "range" && rule.max != null ? rule.max : (preset?.type === "range" ? preset.max : undefined),
      });
    } else {
      onChange({ type: newType });
    }
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text)", cursor: "pointer", userSelect: "none" }}>
        <input type="checkbox" checked={enabled} onChange={e => handleToggle(e.target.checked)} style={{ accentColor: accent }} />
        Validar formato do valor
      </label>
      {enabled && (
        <div style={{ marginTop: 6, marginLeft: 22, display: "flex", flexDirection: "column", gap: 6 }}>
          <select value={rule.type} onChange={e => handleTypeChange(e.target.value)} style={SELECT_STYLE} onFocus={focusStyle} onBlur={blurStyle}>
            {VALIDATION_RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {rule.type === "regex" && (
            <input
              type="text"
              value={rule.pattern ?? ""}
              onChange={e => onChange({ ...rule, pattern: e.target.value })}
              placeholder="Expressão regular (ex.: ^[0-9]+$)"
              style={{ ...INPUT_BASE, fontFamily: "monospace" }}
              onFocus={focusStyle} onBlur={blurStyle}
            />
          )}
          {rule.type === "range" && (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number"
                value={rule.min ?? ""}
                onChange={e => onChange({ ...rule, min: e.target.value === "" ? undefined : Number(e.target.value) })}
                placeholder="Mínimo"
                style={{ ...INPUT_BASE, flex: 1 }}
                onFocus={focusStyle} onBlur={blurStyle}
              />
              <input
                type="number"
                value={rule.max ?? ""}
                onChange={e => onChange({ ...rule, max: e.target.value === "" ? undefined : Number(e.target.value) })}
                placeholder="Máximo"
                style={{ ...INPUT_BASE, flex: 1 }}
                onFocus={focusStyle} onBlur={blurStyle}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AddFieldForm ──────────────────────────────────────────────────────────────
// Aberto ao clicar num chip de tipo na sidebar (tipo já vem escolhido).
// Condicionais são configuradas depois, no modal "Condicionais em campos".

function AddFieldForm({ presetType, onAdd, onCancel, accent, busy }) {
  const [fieldType, setFieldType] = useState(presetType || "text");
  const [label, setLabel]         = useState("");
  const [required, setRequired]   = useState(false);
  const [options, setOptions]     = useState("");
  const [validationRule, setValidationRule] = useState(null);
  const [error, setError]         = useState(null);

  useEffect(() => { if (presetType) setFieldType(presetType); }, [presetType]);

  const hasOptions = OPTION_FIELD_TYPES.includes(fieldType);
  const Icon = TYPE_ICON[fieldType] || Settings2;
  const typeMeta = FIELD_TYPES.find(t => t.value === fieldType);

  const handleAdd = () => {
    if (!label.trim()) { setError("Informe um nome para o campo."); return; }
    if (hasOptions && !options.trim()) { setError("Informe pelo menos uma opção."); return; }
    setError(null);
    const parsed = hasOptions ? options.split("\n").map(s => s.trim()).filter(Boolean) : [];
    onAdd({ fieldType, label: label.trim(), required, options: parsed, validationRule });
  };

  return (
    <div style={{ background: "var(--surface-alt)", border: `1px solid ${accent}40`, borderRadius: 10, padding: 14 }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} style={{ color: accent }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
          Novo campo · {typeMeta?.label || fieldType}
        </span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: 4 }}>Nome do campo</label>
        <input
          type="text"
          autoFocus
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Ex.: Método de Contato"
          style={INPUT_BASE}
          onFocus={focusStyle} onBlur={blurStyle}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
      </div>

      {hasOptions && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: 4 }}>
            Opções <span style={{ fontWeight: 400 }}>(uma por linha)</span>
          </label>
          <textarea
            value={options}
            onChange={e => setOptions(e.target.value)}
            placeholder={"Opção 1\nOpção 2\nOpção 3"}
            rows={4}
            style={{ ...INPUT_BASE, resize: "vertical", fontFamily: "inherit" }}
            onFocus={focusStyle} onBlur={blurStyle}
          />
        </div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text)", marginBottom: 12, cursor: "pointer", userSelect: "none" }}>
        <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} style={{ accentColor: accent }} />
        Campo obrigatório
      </label>

      <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 10, marginBottom: 2 }}>
        <ValidationRuleBlock fieldType={fieldType} rule={validationRule} onChange={setValidationRule} accent={accent} />
      </div>

      {error && (
        <div style={{ fontSize: 12, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "6px 10px", marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={handleAdd}
          disabled={busy}
          style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 6, border: "none", background: busy ? "#9CA3AF" : accent, color: "#FFF", cursor: busy ? "not-allowed" : "pointer" }}
        >
          {busy ? "Adicionando…" : "Adicionar campo"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{ fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: busy ? "not-allowed" : "pointer" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── FieldRow ──────────────────────────────────────────────────────────────────

function FieldRow({ field, accent, busy, isFirst, isLast, onDelete, onRename, onMoveUp, onMoveDown, onToggleRequired, onSaveValidation, onOpenConditions }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(field.label);
  const [showValidation, setShowValidation] = useState(false);
  const [validationRule, setValidationRule] = useState(field.validationRule);

  const Icon = TYPE_ICON[field.fieldType] || Settings2;
  const typeMeta = FIELD_TYPES.find(t => t.value === field.fieldType);
  const hasConditions = Boolean(field.visibleIf || field.requiredIf);
  const hasValidation = Boolean(field.validationRule);
  const showOptionsPreview = OPTION_FIELD_TYPES.includes(field.fieldType) && field.options?.length > 0;

  const commitRename = () => {
    const trimmed = labelDraft.trim();
    setEditingLabel(false);
    if (trimmed && trimmed !== field.label) onRename(field.id, trimmed);
    else setLabelDraft(field.label);
  };

  return (
    <div className="py-3" style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
      <div className="flex items-start gap-2.5">
        <Icon size={15} style={{ color: "var(--text-dim)", flexShrink: 0, marginTop: 2 }} />

        <div className="flex-1 min-w-0">
          {editingLabel ? (
            <input
              autoFocus
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setLabelDraft(field.label); setEditingLabel(false); } }}
              style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", width: "100%", border: `1px solid ${accent}`, borderRadius: 4, padding: "1px 4px", outline: "none" }}
            />
          ) : (
            <div
              onClick={() => { setLabelDraft(field.label); setEditingLabel(true); }}
              title="Clique para renomear"
              style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
            >
              {field.required && <span style={{ color: "#B91C1C", marginRight: 3 }}>*</span>}
              {field.label}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>
            {typeMeta?.label || field.fieldType}
            {hasConditions && <span style={{ color: accent, fontWeight: 600 }}> · Condicional</span>}
          </div>

          {/* Preview das opções (estilo Pipefy) */}
          {showOptionsPreview && (
            <div className="mt-1.5 space-y-1">
              {field.options.slice(0, 4).map((opt, i) => (
                <div key={i} className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  <span
                    style={{
                      width: 12, height: 12, flexShrink: 0,
                      borderRadius: field.fieldType === "multicheck" ? 3 : "50%",
                      border: "1.5px solid var(--border-strong)", background: "var(--surface-alt)",
                    }}
                  />
                  {opt}
                </div>
              ))}
              {field.options.length > 4 && (
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>+{field.options.length - 4} opções</div>
              )}
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => !busy && onToggleRequired(field.id, !field.required)}
            title={field.required ? "Remover obrigatoriedade" : "Tornar obrigatório"}
            style={{
              fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, cursor: busy ? "wait" : "pointer", flexShrink: 0,
              border: `1px solid ${field.required ? accent + "60" : "var(--border)"}`,
              background: field.required ? accent + "12" : "transparent",
              color: field.required ? accent : "var(--text-dim)",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {field.required ? "Obrig." : "Opcional"}
          </button>

          <button
            onClick={() => onOpenConditions(field)}
            title="Condicionais de campo"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "3px 5px", borderRadius: 4, cursor: "pointer", flexShrink: 0,
              border: `1px solid ${hasConditions ? accent + "60" : "var(--border)"}`,
              background: hasConditions ? accent + "12" : "transparent",
              color: hasConditions ? accent : "var(--text-dim)",
            }}
          >
            <GitBranch size={12} />
          </button>

          <button
            onClick={() => { if (showValidation) { setShowValidation(false); } else { setValidationRule(field.validationRule); setShowValidation(true); } }}
            title="Validação de formato do valor"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "3px 5px", borderRadius: 4, cursor: "pointer", flexShrink: 0,
              border: `1px solid ${hasValidation || showValidation ? accent + "60" : "var(--border)"}`,
              background: hasValidation || showValidation ? accent + "12" : "transparent",
              color: hasValidation || showValidation ? accent : "var(--text-dim)",
            }}
          >
            <ShieldCheck size={12} />
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              style={{ background: "none", border: "none", cursor: isFirst ? "default" : "pointer", color: isFirst ? "var(--border)" : "var(--text-dim)", padding: 1, lineHeight: 0 }}
            >
              <ChevronUp size={12} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              style={{ background: "none", border: "none", cursor: isLast ? "default" : "pointer", color: isLast ? "var(--border)" : "var(--text-dim)", padding: 1, lineHeight: 0 }}
            >
              <ChevronDown size={12} />
            </button>
          </div>

          {confirmDel ? (
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => onDelete(field.id)}
                style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 5, border: "none", background: "#B91C1C", color: "#FFF", cursor: "pointer" }}
              >
                Remover
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                style={{ fontSize: 11, padding: "3px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--border-strong)", padding: 2, lineHeight: 0, flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--border-strong)"; }}
              title="Remover campo"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {showValidation && (
        <div className="mt-2 rounded-lg" style={{ border: "1px solid var(--border)", padding: "10px 12px", background: "var(--surface-alt)" }}>
          <ValidationRuleBlock fieldType={field.fieldType} rule={validationRule} onChange={setValidationRule} accent={accent} />
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button
              onClick={() => { onSaveValidation(field.id, validationRule); setShowValidation(false); }}
              disabled={busy}
              style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 6, border: "none", background: busy ? "#9CA3AF" : accent, color: "#FFF", cursor: busy ? "not-allowed" : "pointer" }}
            >
              Salvar validação
            </button>
            <button
              onClick={() => setShowValidation(false)}
              disabled={busy}
              style={{ fontSize: 12, fontWeight: 600, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: busy ? "not-allowed" : "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Painel principal ──────────────────────────────────────────────────────────

export function StageFieldsPanel({
  open,
  onClose,
  stage,               // { name, color, probability?, slaDays?, terminal?, won?, lost? }
  fields,
  onAddField,          // async ({ fieldType, label, required, options, validationRule, fieldKey, orderIdx })
  onUpdateField,       // async (id, mergedField)
  onDeleteField,       // async (id)
  onReorderFields,     // async (orderedIds)
  onRefetch,           // async ()
  accent = "var(--accent)",
  headerBadge = null,
  automationCount = 0,
  cardPreview = null,  // { selected, catalog, max, onToggle(key), busy }
  onSaveStage = null,  // async (patch) — habilita "Opções Avançadas"
  onDeleteStage = null, // async () — habilita "Excluir esta etapa" dentro de Opções Avançadas
  showProbability = false,
  isProtectedStage = false,
  protectedLabel = "",
}) {
  const [addingType, setAddingType] = useState(null);
  const [opError, setOpError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (open) { setAddingType(null); setOpError(null); setConditionsOpen(false); setAdvancedOpen(false); }
  }, [open, stage?.stageKey, stage?.id]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape" && !conditionsOpen && !advancedOpen) onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose, conditionsOpen, advancedOpen]);

  if (!open || !stage) return null;

  const stageColor = stage.color || "#64748B";
  const canvasTint = `color-mix(in srgb, ${stageColor} 7%, var(--surface))`;

  const run = async (fn) => {
    setBusy(true);
    setOpError(null);
    try {
      await fn();
      if (onRefetch) await onRefetch();
    } catch (e) {
      setOpError(e.message || "Erro ao salvar. Verifique a conexão.");
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = ({ fieldType, label, required, options, validationRule }) =>
    run(async () => {
      await onAddField({
        fieldType, label, required, options,
        fieldKey: slugifyKey(label),
        orderIdx: fields.length,
        placeholder: "", helpText: "",
        visibleIf: null, requiredIf: null,
        validationRule: validationRule ?? null,
      });
      setAddingType(null);
    });

  const mergePatch = (id, patch) =>
    run(() => {
      const f = fields.find(f => f.id === id);
      if (!f) return Promise.resolve();
      return onUpdateField(id, { ...f, ...patch });
    });

  const handleMove = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    const ordered = [...fields];
    [ordered[idx], ordered[target]] = [ordered[target], ordered[idx]];
    run(() => onReorderFields(ordered.map(f => f.id)));
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "var(--overlay-scrim)", backdropFilter: "blur(3px)" }}
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-4xl flex flex-col overflow-hidden"
          style={{
            background: "var(--surface)",
            borderRadius: "16px 16px 0 0",
            boxShadow: "var(--shadow-pop)",
            height: "min(88vh, 780px)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between gap-2 px-5 py-3 border-b shrink-0 flex-wrap"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="font-bold text-sm px-3 py-1.5 rounded-lg"
                title={`Editar fase: ${stage.name}`}
                style={{
                  background: `color-mix(in srgb, ${stageColor} 14%, var(--surface))`,
                  color: stageColor,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {stage.name}
              </span>
              {headerBadge}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setConditionsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
                style={{ border: "none", background: "transparent", color: "var(--text)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <GitBranch size={12} />
                Condicionais em campos
              </button>
              {onSaveStage && (
                <button
                  onClick={() => setAdvancedOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border cursor-pointer"
                  style={{ borderColor: accent, color: accent, background: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 8%, transparent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <SlidersHorizontal size={12} />
                  Opções Avançadas
                </button>
              )}
              <button
                onClick={onClose}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, lineHeight: 0 }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Corpo: sidebar de tipos + canvas */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0">
            {/* Sidebar de tipos de campo */}
            <div
              className="md:w-56 shrink-0 md:border-r border-b md:border-b-0 overflow-x-auto md:overflow-y-auto p-3 md:p-4"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="hidden md:block" style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                Tipos de campo
              </div>
              <div className="hidden md:block" style={{ fontSize: 11, color: "var(--text-dim)", margin: "2px 0 10px" }}>
                Clique num tipo para adicionar o campo ao formulário desta fase.
              </div>
              <div className="flex md:flex-col gap-1.5">
                {FIELD_TYPES.map(t => {
                  const Icon = TYPE_ICON[t.value] || Settings2;
                  const active = addingType === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setAddingType(active ? null : t.value)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border text-left cursor-pointer shrink-0 transition-colors"
                      style={{
                        fontSize: 12, fontWeight: 600,
                        borderColor: active ? accent : "var(--border)",
                        background: active ? "color-mix(in srgb, var(--accent) 10%, var(--surface))" : "var(--surface-alt)",
                        color: active ? accent : "var(--text)",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = accent; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = "var(--border)"; }}
                    >
                      <Icon size={13} style={{ color: active ? accent : "var(--text-dim)", flexShrink: 0 }} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Canvas com tint da cor da fase */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ background: canvasTint }}>
              <div
                className="rounded-xl border mx-auto"
                style={{
                  background: "var(--surface)", borderColor: "var(--border)",
                  boxShadow: "var(--shadow-card)", maxWidth: 560, padding: "20px 22px",
                }}
              >
                {/* Fase atual */}
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6 }}>
                  Fase atual
                </div>
                <div
                  className="rounded-lg px-3.5 py-2.5 mb-4"
                  style={{
                    background: `color-mix(in srgb, ${stageColor} 12%, var(--surface))`,
                    color: stageColor, fontSize: 15, fontWeight: 700,
                  }}
                >
                  {stage.name}
                </div>

                {automationCount > 0 && (
                  <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: "var(--text-dim)" }}>
                    <Zap size={12} style={{ color: accent, flexShrink: 0 }} />
                    {automationCount} {automationCount === 1 ? "automação vinculada" : "automações vinculadas"} a esta fase
                  </div>
                )}

                {cardPreview && (
                  <div className="mb-4" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                      Preview do card no Kanban
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8 }}>
                      Escolha até {cardPreview.max} campos pra aparecer no card desta fase. Sem escolha, usa o padrão (Valor, Probabilidade, Fechamento).
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {cardPreview.catalog.map(f => {
                        const checked = cardPreview.selected.includes(f.key);
                        const disabled = cardPreview.busy || (!checked && cardPreview.selected.length >= cardPreview.max);
                        return (
                          <button
                            key={f.key}
                            onClick={() => cardPreview.onToggle(f.key)}
                            disabled={disabled}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
                            style={{
                              border: `1px solid ${checked ? accent : "var(--border)"}`,
                              background: checked ? accent + "12" : "var(--surface)",
                              color: checked ? accent : "var(--text-dim)",
                              cursor: disabled ? "not-allowed" : "pointer",
                              opacity: disabled && !checked ? 0.5 : 1,
                            }}
                          >
                            {checked && <Check size={11} />}
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {opError && (
                  <div className="mb-3" style={{ fontSize: 12, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "6px 10px" }}>
                    {opError}
                  </div>
                )}

                {/* Formulário de novo campo */}
                {addingType && (
                  <div className="mb-3">
                    <AddFieldForm
                      presetType={addingType}
                      accent={accent}
                      busy={busy}
                      onAdd={handleAdd}
                      onCancel={() => setAddingType(null)}
                    />
                  </div>
                )}

                {/* Lista de campos */}
                {fields.length === 0 && !addingType ? (
                  <div
                    className="py-10 text-center rounded-lg border-2 border-dashed text-xs"
                    style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-1" style={{ color: "var(--text-dim)" }}>
                      <Plus size={13} />
                      <span className="font-semibold">Nenhum campo nesta fase</span>
                    </div>
                    Clique num tipo de campo ao lado pra construir o formulário.
                  </div>
                ) : (
                  fields.map((f, idx) => (
                    <FieldRow
                      key={f.id}
                      field={f}
                      accent={accent}
                      busy={busy}
                      isFirst={idx === 0}
                      isLast={idx === fields.length - 1}
                      onDelete={(id) => run(() => onDeleteField(id))}
                      onRename={(id, label) => mergePatch(id, { label })}
                      onToggleRequired={(id, required) => mergePatch(id, { required, ...(required ? { requiredIf: null } : {}) })}
                      onSaveValidation={(id, validationRule) => mergePatch(id, { validationRule: validationRule ?? null })}
                      onOpenConditions={() => setConditionsOpen(true)}
                      onMoveUp={() => handleMove(idx, -1)}
                      onMoveDown={() => handleMove(idx, 1)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <StageConditionsModal
        open={conditionsOpen}
        onClose={() => setConditionsOpen(false)}
        fields={fields}
        accent={accent}
        busy={busy}
        onSaveField={(id, patch) => mergePatch(id, patch)}
      />

      {onSaveStage && (
        <StageAdvancedModal
          open={advancedOpen}
          onClose={() => setAdvancedOpen(false)}
          stage={stage}
          accent={accent}
          showProbability={showProbability}
          onSave={onSaveStage}
          onDelete={onDeleteStage ? async () => { await onDeleteStage(); onClose(); } : undefined}
          isProtectedStage={isProtectedStage}
          protectedLabel={protectedLabel}
        />
      )}
    </>
  );
}

export default StageFieldsPanel;
