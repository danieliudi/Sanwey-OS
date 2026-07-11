import React, { useCallback, useEffect, useState } from "react";
import {
  X, Plus, Trash2, GripVertical, ChevronUp, ChevronDown,
  Pencil, Check, Type, AlignLeft, Hash, DollarSign, Calendar,
  Clock, Mail, Phone, Link, CheckSquare, List, RadioTower,
  ListChecks, User, Settings2,
} from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { FIELD_TYPES, slugifyKey } from "../../hooks/use-stage-fields";
import { VALIDATION_PRESETS, VALIDATION_RULE_TYPES } from "../../utils/field-validation";

// Ícone por tipo de campo
const TYPE_ICON = {
  text:       Type,
  textarea:   AlignLeft,
  number:     Hash,
  currency:   DollarSign,
  date:       Calendar,
  datetime:   Calendar,
  time:       Clock,
  email:      Mail,
  phone:      Phone,
  url:        Link,
  checkbox:   CheckSquare,
  select:     List,
  radio:      RadioTower,
  multicheck: ListChecks,
  user:       User,
};

const INPUT_BASE = {
  width: "100%",
  fontSize: 13,
  borderRadius: 6,
  border: "1px solid #D1D5DB",
  padding: "7px 10px",
  color: "var(--text)",
  background: "#FFFFFF",
  outline: "none",
  boxSizing: "border-box",
};

function focusStyle(e) { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--accent) 12%, transparent)"; }
function blurStyle(e)  { e.target.style.borderColor = "#D1D5DB"; e.target.style.boxShadow = "none"; }

// Operadores de condição — mesmo conjunto usado nos gatilhos/condições de
// automação (src/components/views/AutomationsView.jsx), reaproveitado aqui
// pro avaliador de campos condicionais (src/utils/field-conditions.js).
const CONDITION_OPERATORS = [
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
const NO_VALUE_CONDITION_OPERATORS = new Set(["is_empty", "is_not_empty"]);

// ── ConditionEditor ───────────────────────────────────────────────────────────
// Editor reutilizável de condição { fieldKey, operator, value } | null, usado
// tanto pra "Mostrar somente se" (visibleIf) quanto "Exigir somente se"
// (requiredIf), no formulário de novo campo e na edição de um campo existente.

function ConditionEditor({ title, condition, onChange, otherFields, accent, disabled, disabledNote }) {
  const enabled = Boolean(condition);

  const toggle = (checked) => {
    if (!checked) { onChange(null); return; }
    onChange({ fieldKey: otherFields[0]?.fieldKey || "", operator: "eq", value: "" });
  };

  const selectStyle = { ...INPUT_BASE, fontSize: 12, padding: "6px 8px", appearance: "none",
    backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
    backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "11px", paddingRight: 26,
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <label
        style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 12,
          color: disabled ? "var(--text-dim)" : "var(--text)",
          cursor: disabled ? "default" : "pointer", userSelect: "none",
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled || otherFields.length === 0}
          onChange={e => toggle(e.target.checked)}
          style={{ accentColor: accent }}
        />
        {title}
      </label>

      {disabled && disabledNote && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3, marginLeft: 20 }}>{disabledNote}</div>
      )}
      {!disabled && otherFields.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3, marginLeft: 20 }}>
          Nenhum outro campo nesta etapa para usar como condição.
        </div>
      )}

      {enabled && !disabled && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${accent}30` }}>
          <select
            value={condition.fieldKey}
            onChange={e => onChange({ ...condition, fieldKey: e.target.value })}
            style={selectStyle}
            onFocus={focusStyle} onBlur={blurStyle}
          >
            <option value="">Selecione o campo...</option>
            {otherFields.map(f => <option key={f.id} value={f.fieldKey}>{f.label}</option>)}
          </select>

          <select
            value={condition.operator}
            onChange={e => onChange({ ...condition, operator: e.target.value })}
            style={selectStyle}
            onFocus={focusStyle} onBlur={blurStyle}
          >
            {CONDITION_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {!NO_VALUE_CONDITION_OPERATORS.has(condition.operator) && (
            <input
              type="text"
              value={condition.value ?? ""}
              onChange={e => onChange({ ...condition, value: e.target.value })}
              placeholder="Valor"
              style={{ ...INPUT_BASE, fontSize: 12, padding: "6px 8px" }}
              onFocus={focusStyle} onBlur={blurStyle}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── ValidationRuleEditor ──────────────────────────────────────────────────────
// Editor reutilizável de regra de validação de formato { type, pattern?, min?,
// max? } | null (camada 2, além de presença/obrigatoriedade — ver
// src/utils/field-validation.js), usado no formulário de novo campo e na
// edição de um campo existente. Mesmo padrão visual do ConditionEditor.

function ValidationRuleEditor({ rule, onChange, fieldType, accent }) {
  const enabled = Boolean(rule);

  const toggle = (checked) => {
    if (!checked) { onChange(null); return; }
    const preset = VALIDATION_PRESETS[fieldType];
    onChange(preset
      ? { type: preset.type, ...(preset.pattern ? { pattern: preset.pattern } : {}), ...(preset.min != null ? { min: preset.min } : {}), ...(preset.max != null ? { max: preset.max } : {}) }
      : { type: "regex", pattern: "" });
  };

  const selectStyle = { ...INPUT_BASE, fontSize: 12, padding: "6px 8px", appearance: "none",
    backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
    backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "11px", paddingRight: 26,
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <label
        style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 12,
          color: "var(--text)", cursor: "pointer", userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => toggle(e.target.checked)}
          style={{ accentColor: accent }}
        />
        Validar formato do valor
      </label>

      {enabled && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${accent}30` }}>
          <select
            value={rule.type}
            onChange={e => onChange({ type: e.target.value })}
            style={selectStyle}
            onFocus={focusStyle} onBlur={blurStyle}
          >
            {VALIDATION_RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {rule.type === "regex" && (
            <input
              type="text"
              value={rule.pattern ?? ""}
              onChange={e => onChange({ ...rule, pattern: e.target.value })}
              placeholder="Ex.: ^[0-9]{5}$"
              style={{ ...INPUT_BASE, fontSize: 12, padding: "6px 8px", fontFamily: "monospace" }}
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
                style={{ ...INPUT_BASE, fontSize: 12, padding: "6px 8px" }}
                onFocus={focusStyle} onBlur={blurStyle}
              />
              <input
                type="number"
                value={rule.max ?? ""}
                onChange={e => onChange({ ...rule, max: e.target.value === "" ? undefined : Number(e.target.value) })}
                placeholder="Máximo"
                style={{ ...INPUT_BASE, fontSize: 12, padding: "6px 8px" }}
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

function AddFieldForm({ onAdd, onCancel, accent, busy, fields }) {
  const [fieldType, setFieldType] = useState("text");
  const [label, setLabel]         = useState("");
  const [required, setRequired]   = useState(false);
  const [options, setOptions]      = useState("");
  const [visibleIf, setVisibleIf]   = useState(null);
  const [requiredIf, setRequiredIf] = useState(null);
  const [validationRule, setValidationRule] = useState(null);
  const [error, setError]          = useState(null);

  const hasOptions = ["select", "radio", "multicheck"].includes(fieldType);
  // Campo ainda não existe — qualquer campo já configurado nesta etapa pode
  // servir de condição.
  const otherFields = fields || [];

  const handleAdd = () => {
    if (!label.trim()) { setError("Informe um nome para o campo."); return; }
    if (hasOptions && !options.trim()) { setError("Informe pelo menos uma opção."); return; }
    setError(null);
    const parsed = hasOptions
      ? options.split("\n").map(s => s.trim()).filter(Boolean)
      : [];
    onAdd({ fieldType, label: label.trim(), required, options: parsed, visibleIf, requiredIf, validationRule });
  };

  return (
    <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
        Novo campo
      </div>

      {/* Tipo */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: 4 }}>Tipo</label>
        <select
          value={fieldType}
          onChange={e => setFieldType(e.target.value)}
          style={{ ...INPUT_BASE, appearance: "none",
            backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
            backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "12px", paddingRight: 28,
          }}
          onFocus={focusStyle} onBlur={blurStyle}
        >
          {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Label */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: 4 }}>Nome do campo</label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Ex.: Método de Contato"
          style={INPUT_BASE}
          onFocus={focusStyle} onBlur={blurStyle}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
      </div>

      {/* Opções (select/radio/multicheck) */}
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

      {/* Obrigatório */}
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text)", marginBottom: 12, cursor: "pointer", userSelect: "none" }}>
        <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} style={{ accentColor: accent }} />
        Campo obrigatório
      </label>

      {/* Condicionais */}
      <ConditionEditor
        title="Adicionar condição de visibilidade"
        condition={visibleIf}
        onChange={setVisibleIf}
        otherFields={otherFields}
        accent={accent}
      />
      <ConditionEditor
        title="Adicionar condição de obrigatoriedade"
        condition={requiredIf}
        onChange={setRequiredIf}
        otherFields={otherFields}
        accent={accent}
        disabled={required}
        disabledNote="Já é obrigatório sempre — condição não se aplica."
      />
      <ValidationRuleEditor
        rule={validationRule}
        onChange={setValidationRule}
        fieldType={fieldType}
        accent={accent}
      />

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
          {busy ? "Adicionando…" : "Adicionar"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{ fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#FFF", color: "var(--text-dim)", cursor: busy ? "not-allowed" : "pointer" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── FieldRow ──────────────────────────────────────────────────────────────────

function FieldRow({ field, accent, otherFields, onDelete, onMoveUp, onMoveDown, onToggleRequired, onSaveConditions, isFirst, isLast, busy }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [editingCond, setEditingCond] = useState(false);
  const [draftVisibleIf, setDraftVisibleIf]   = useState(field.visibleIf || null);
  const [draftRequiredIf, setDraftRequiredIf] = useState(field.requiredIf || null);
  const [draftValidationRule, setDraftValidationRule] = useState(field.validationRule || null);
  const Icon = TYPE_ICON[field.fieldType] || Settings2;
  const typeMeta = FIELD_TYPES.find(t => t.value === field.fieldType);
  const hasConditions = Boolean(field.visibleIf || field.requiredIf);

  const openEdit = () => {
    setDraftVisibleIf(field.visibleIf || null);
    setDraftRequiredIf(field.requiredIf || null);
    setDraftValidationRule(field.validationRule || null);
    setEditingCond(true);
  };

  const handleSave = () => {
    onSaveConditions(field.id, { visibleIf: draftVisibleIf, requiredIf: draftRequiredIf, validationRule: draftValidationRule });
    setEditingCond(false);
  };

  return (
    <div
      style={{
        borderRadius: 8,
        background: "#FFFFFF", border: "1px solid #E5E7EB",
        marginBottom: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
        {/* Drag handle (visual only) */}
        <GripVertical size={14} style={{ color: "#CBD5E1", flexShrink: 0, cursor: "grab" }} />

        {/* Type icon */}
        <Icon size={14} style={{ color: "var(--text-dim)", flexShrink: 0 }} />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {field.required && <span style={{ color: accent, marginRight: 2 }}>*</span>}
            {field.label}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
            {typeMeta?.label || field.fieldType}
            {hasConditions && <span style={{ color: accent }}> · Condicional</span>}
          </div>
        </div>

        {/* Required toggle */}
        <button
          onClick={() => !busy && onToggleRequired(field.id, !field.required)}
          title={field.required ? "Remover obrigatoriedade" : "Tornar obrigatório"}
          style={{
            fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, cursor: busy ? "wait" : "pointer", flexShrink: 0,
            border: `1px solid ${field.required ? accent + "60" : "#E5E7EB"}`,
            background: field.required ? accent + "12" : "transparent",
            color: field.required ? accent : "var(--text-dim)",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {field.required ? "Obrig." : "Opcional"}
        </button>

        {/* Condições (visibleIf/requiredIf) */}
        <button
          onClick={() => !busy && (editingCond ? setEditingCond(false) : openEdit())}
          title="Configurar condições"
          style={{
            background: "none", border: "none", cursor: busy ? "wait" : "pointer", padding: 2, lineHeight: 0, flexShrink: 0,
            color: editingCond || hasConditions ? accent : "var(--text-dim)",
          }}
        >
          <Pencil size={13} />
        </button>

        {/* Reorder */}
        <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            style={{ background: "none", border: "none", cursor: isFirst ? "default" : "pointer", color: isFirst ? "#E5E7EB" : "var(--text-dim)", padding: 1, lineHeight: 0 }}
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            style={{ background: "none", border: "none", cursor: isLast ? "default" : "pointer", color: isLast ? "#E5E7EB" : "var(--text-dim)", padding: 1, lineHeight: 0 }}
          >
            <ChevronDown size={12} />
          </button>
        </div>

        {/* Delete */}
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
              style={{ fontSize: 11, padding: "3px 6px", borderRadius: 5, border: "1px solid #E5E7EB", background: "#FFF", color: "var(--text-dim)", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#E5E7EB", padding: 2, lineHeight: 0, flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#E5E7EB"; }}
            title="Remover campo"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Painel de condições (expansível) */}
      {editingCond && (
        <div style={{ borderTop: "1px solid #E5E7EB", padding: "12px", background: "#F9FAFB" }}>
          <ConditionEditor
            title="Adicionar condição de visibilidade"
            condition={draftVisibleIf}
            onChange={setDraftVisibleIf}
            otherFields={otherFields}
            accent={accent}
          />
          <ConditionEditor
            title="Adicionar condição de obrigatoriedade"
            condition={draftRequiredIf}
            onChange={setDraftRequiredIf}
            otherFields={otherFields}
            accent={accent}
            disabled={field.required}
            disabledNote="Já é obrigatório sempre — condição não se aplica."
          />
          <ValidationRuleEditor
            rule={draftValidationRule}
            onChange={setDraftValidationRule}
            fieldType={field.fieldType}
            accent={accent}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button
              onClick={handleSave}
              disabled={busy}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 6, border: "none", background: busy ? "#9CA3AF" : accent, color: "#FFF", cursor: busy ? "not-allowed" : "pointer" }}
            >
              <Check size={13} />
              Salvar
            </button>
            <button
              onClick={() => setEditingCond(false)}
              disabled={busy}
              style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#FFF", color: "var(--text-dim)", cursor: busy ? "not-allowed" : "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function StageFieldEditorModal({ open, onClose, stage, companyId, stageFields }) {
  const [showAdd, setShowAdd] = useState(false);
  const [opError, setOpError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setShowAdd(false); setOpError(null); }
  }, [open, stage?.id]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open || !stage) return null;

  const company = COMPANIES[companyId];
  const accent  = company?.primary || "var(--text)";
  const fields  = stageFields.getFields(companyId, stage.id);

  const run = async (fn) => {
    setBusy(true);
    setOpError(null);
    try {
      await fn();
      await stageFields.refetch();
    } catch (e) {
      setOpError(e.message || "Erro ao salvar. Verifique a conexão.");
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = ({ fieldType, label, required, options, visibleIf, requiredIf, validationRule }) =>
    run(async () => {
      await stageFields.addField({
        companyId,
        stageId: stage.id,
        fieldKey: slugifyKey(label),
        fieldType,
        label,
        required,
        options,
        orderIdx: fields.length,
        placeholder: "",
        helpText: "",
        visibleIf: visibleIf || null,
        requiredIf: requiredIf || null,
        validationRule: validationRule || null,
      });
      setShowAdd(false);
    });

  const handleDelete = (id) =>
    run(() => stageFields.deleteField(id));

  const handleToggleRequired = (id, newRequired) =>
    run(() => {
      const f = fields.find(f => f.id === id);
      if (!f) return Promise.resolve();
      return stageFields.updateField(id, { ...f, required: newRequired });
    });

  const handleSaveConditions = (id, { visibleIf, requiredIf, validationRule }) =>
    run(() => {
      const f = fields.find(f => f.id === id);
      if (!f) return Promise.resolve();
      return stageFields.updateField(id, { ...f, visibleIf: visibleIf || null, requiredIf: requiredIf || null, validationRule: validationRule || null });
    });

  const handleMoveUp = (idx) => {
    if (idx === 0) return;
    const ordered = [...fields];
    [ordered[idx - 1], ordered[idx]] = [ordered[idx], ordered[idx - 1]];
    run(() => stageFields.reorderFields(companyId, stage.id, ordered.map(f => f.id)));
  };

  const handleMoveDown = (idx) => {
    if (idx === fields.length - 1) return;
    const ordered = [...fields];
    [ordered[idx], ordered[idx + 1]] = [ordered[idx + 1], ordered[idx]];
    run(() => stageFields.reorderFields(companyId, stage.id, ordered.map(f => f.id)));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: "16px 16px 0 0", boxShadow: "var(--shadow-pop)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 border-b"
          style={{ background: "rgba(250,250,248,0.97)", borderColor: "#E5E7EB", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: stage.color || accent }}
            />
            <span className="font-bold text-sm" style={{ color: "var(--text)" }}>
              Editar fase: {stage.name}
            </span>
            {company && (
              <span
                className="text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{ background: accent + "18", color: accent, border: `1px solid ${accent}30` }}
              >
                {company.short}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, lineHeight: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 space-y-3">
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>
            Campos que aparecem no drawer quando um card está nesta etapa.
          </div>

          {opError && (
            <div style={{ fontSize: 12, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "6px 10px" }}>
              {opError}
            </div>
          )}

          {/* Field list */}
          {fields.length === 0 && !showAdd && (
            <div
              className="py-8 text-center rounded-lg border-2 border-dashed text-xs"
              style={{ borderColor: "#E5E7EB", color: "var(--text-dim)" }}
            >
              Nenhum campo configurado para esta etapa.
            </div>
          )}

          {fields.map((f, idx) => (
            <FieldRow
              key={f.id}
              field={f}
              accent={accent}
              otherFields={fields.filter(other => other.id !== f.id)}
              isFirst={idx === 0}
              isLast={idx === fields.length - 1}
              busy={busy}
              onDelete={handleDelete}
              onToggleRequired={handleToggleRequired}
              onSaveConditions={handleSaveConditions}
              onMoveUp={() => handleMoveUp(idx)}
              onMoveDown={() => handleMoveDown(idx)}
            />
          ))}

          {/* Add form or button */}
          {showAdd ? (
            <AddFieldForm accent={accent} onAdd={handleAdd} onCancel={() => setShowAdd(false)} busy={busy} fields={fields} />
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-xs font-semibold transition-colors cursor-pointer"
              style={{ borderColor: accent + "50", color: accent, background: accent + "08" }}
              onMouseEnter={e => { e.currentTarget.style.background = accent + "14"; }}
              onMouseLeave={e => { e.currentTarget.style.background = accent + "08"; }}
            >
              <Plus size={14} />
              Adicionar campo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
