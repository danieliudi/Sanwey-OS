import React, { useEffect, useState } from "react";
import {
  X, Plus, Trash2, GripVertical, ChevronUp, ChevronDown,
  Type, AlignLeft, Hash, DollarSign, Calendar,
  Clock, Mail, Phone, Link, CheckSquare, List, RadioTower,
  ListChecks, User, Settings2, GitBranch, ShieldCheck,
} from "lucide-react";
import { FIELD_TYPES, slugifyKey, useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { VALIDATION_PRESETS, VALIDATION_RULE_TYPES } from "../../utils/field-validation";

// Editor de campos customizados por etapa do pipeline de RH
// (Vagas / Candidatos / Onboarding). Baseado em
// src/components/pipeline/StageFieldEditorModal.jsx, mas sem o conceito de
// empresa (companyId) — os campos aqui são identificados só por
// domain + stageKey — e persistindo via useRHStageFields(domain).

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

const SELECT_STYLE = {
  ...INPUT_BASE, appearance: "none",
  backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
  backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "12px", paddingRight: 28,
};

// Conjunto de operadores suportado por src/utils/field-conditions.js.
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

// ── ConditionBlock ────────────────────────────────────────────────────────────
// UI compartilhada pra configurar uma condição { fieldKey, operator, value }
// (ou null) — usada tanto pro "Mostrar somente se" quanto pro "Exigir
// somente se", no formulário de novo campo e na edição de campos existentes.

function ConditionBlock({ title, otherFields, condition, onChange, accent, disabled, disabledNote }) {
  const enabled = !!condition;
  const hideValue = condition && (condition.operator === "is_empty" || condition.operator === "is_not_empty");
  const canEnable = !disabled && otherFields.length > 0;

  const handleToggle = (checked) => {
    if (checked) {
      onChange({ fieldKey: otherFields[0]?.fieldKey || "", operator: "eq", value: "" });
    } else {
      onChange(null);
    }
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text)", cursor: canEnable ? "pointer" : "not-allowed", userSelect: "none", opacity: canEnable ? 1 : 0.5 }}>
        <input type="checkbox" checked={enabled} disabled={!canEnable} onChange={e => handleToggle(e.target.checked)} style={{ accentColor: accent }} />
        {title}
      </label>
      {disabled && disabledNote && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, marginLeft: 22 }}>{disabledNote}</div>
      )}
      {!disabled && otherFields.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, marginLeft: 22 }}>Nenhum outro campo nesta etapa.</div>
      )}
      {enabled && canEnable && (
        <div style={{ marginTop: 6, marginLeft: 22, display: "flex", flexDirection: "column", gap: 6 }}>
          <select
            value={condition.fieldKey}
            onChange={e => onChange({ ...condition, fieldKey: e.target.value })}
            style={SELECT_STYLE}
            onFocus={focusStyle} onBlur={blurStyle}
          >
            {otherFields.map(f => <option key={f.fieldKey} value={f.fieldKey}>{f.label}</option>)}
          </select>
          <select
            value={condition.operator}
            onChange={e => onChange({ ...condition, operator: e.target.value })}
            style={SELECT_STYLE}
            onFocus={focusStyle} onBlur={blurStyle}
          >
            {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {!hideValue && (
            <input
              type="text"
              value={condition.value ?? ""}
              onChange={e => onChange({ ...condition, value: e.target.value })}
              placeholder="Valor"
              style={INPUT_BASE}
              onFocus={focusStyle} onBlur={blurStyle}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── ValidationRuleBlock ────────────────────────────────────────────────────────
// UI compartilhada pra configurar a regra de validação de formato (camada 2,
// além de required/condicionais) — { type, pattern?, min?, max? } | null. Um
// preset sensato (VALIDATION_PRESETS) pré-preenche a regra ao ligar o toggle
// ou ao trocar pra "regex"/"range", com base no fieldType do campo.

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
      const presetMin = preset?.type === "range" ? preset.min : undefined;
      const presetMax = preset?.type === "range" ? preset.max : undefined;
      onChange({
        type: "range",
        min: rule.type === "range" && rule.min != null ? rule.min : presetMin,
        max: rule.type === "range" && rule.max != null ? rule.max : presetMax,
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
          <select
            value={rule.type}
            onChange={e => handleTypeChange(e.target.value)}
            style={SELECT_STYLE}
            onFocus={focusStyle} onBlur={blurStyle}
          >
            {VALIDATION_RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {rule.type === "regex" && (
            <input
              type="text"
              value={rule.pattern ?? ""}
              onChange={e => onChange({ ...rule, pattern: e.target.value })}
              placeholder="Expressão regular (ex.: ^[0-9]+$)"
              style={INPUT_BASE}
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

function AddFieldForm({ fields, onAdd, onCancel, accent, busy }) {
  const [fieldType, setFieldType] = useState("text");
  const [label, setLabel]         = useState("");
  const [required, setRequired]   = useState(false);
  const [options, setOptions]      = useState("");
  const [visibleIf, setVisibleIf]  = useState(null);
  const [requiredIf, setRequiredIf] = useState(null);
  const [validationRule, setValidationRule] = useState(null);
  const [error, setError]          = useState(null);

  const hasOptions = ["select", "radio", "multicheck"].includes(fieldType);
  // Campo ainda não existe, então "outros campos" = todos os já criados
  // nesta etapa.
  const otherFields = fields || [];

  const handleAdd = () => {
    if (!label.trim()) { setError("Informe um nome para o campo."); return; }
    if (hasOptions && !options.trim()) { setError("Informe pelo menos uma opção."); return; }
    setError(null);
    const parsed = hasOptions
      ? options.split("\n").map(s => s.trim()).filter(Boolean)
      : [];
    onAdd({
      fieldType, label: label.trim(), required, options: parsed,
      visibleIf,
      requiredIf: required ? null : requiredIf,
      validationRule,
    });
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
      <div style={{ borderTop: "1px dashed #E5E7EB", paddingTop: 10, marginBottom: 2 }}>
        <ConditionBlock
          title="Mostrar somente se"
          otherFields={otherFields}
          condition={visibleIf}
          onChange={setVisibleIf}
          accent={accent}
        />
        <ConditionBlock
          title="Exigir somente se"
          otherFields={otherFields}
          condition={requiredIf}
          onChange={setRequiredIf}
          accent={accent}
          disabled={required}
          disabledNote="Já é obrigatório sempre."
        />
      </div>

      {/* Validação de formato */}
      <div style={{ borderTop: "1px dashed #E5E7EB", paddingTop: 10, marginBottom: 2 }}>
        <ValidationRuleBlock
          fieldType={fieldType}
          rule={validationRule}
          onChange={setValidationRule}
          accent={accent}
        />
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

function FieldRow({ field, otherFields, accent, onDelete, onRename, onMoveUp, onMoveDown, onToggleRequired, onSaveConditions, onSaveValidation, isFirst, isLast, busy }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(field.label);
  const [showConditions, setShowConditions] = useState(false);
  const [visibleIf, setVisibleIf]   = useState(field.visibleIf);
  const [requiredIf, setRequiredIf] = useState(field.requiredIf);
  const [showValidation, setShowValidation] = useState(false);
  const [validationRule, setValidationRule] = useState(field.validationRule);
  const Icon = TYPE_ICON[field.fieldType] || Settings2;
  const typeMeta = FIELD_TYPES.find(t => t.value === field.fieldType);
  const hasConditions = Boolean(field.visibleIf || field.requiredIf);
  const hasValidation = Boolean(field.validationRule);

  const openConditions = () => {
    setVisibleIf(field.visibleIf);
    setRequiredIf(field.requiredIf);
    setShowConditions(true);
  };

  const handleSaveConditions = () => {
    onSaveConditions(field.id, { visibleIf, requiredIf: field.required ? null : requiredIf });
    setShowConditions(false);
  };

  const openValidation = () => {
    setValidationRule(field.validationRule);
    setShowValidation(true);
  };

  const handleSaveValidation = () => {
    onSaveValidation(field.id, validationRule);
    setShowValidation(false);
  };

  const commitRename = () => {
    const trimmed = labelDraft.trim();
    setEditingLabel(false);
    if (trimmed && trimmed !== field.label) onRename(field.id, trimmed);
    else setLabelDraft(field.label);
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
          {editingLabel ? (
            <input
              autoFocus
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setLabelDraft(field.label); setEditingLabel(false); } }}
              style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", width: "100%", border: `1px solid ${accent}`, borderRadius: 4, padding: "1px 4px", outline: "none" }}
            />
          ) : (
            <div
              onClick={() => { setLabelDraft(field.label); setEditingLabel(true); }}
              title="Clique para renomear"
              style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
            >
              {field.required && <span style={{ color: accent, marginRight: 2 }}>*</span>}
              {field.label}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{typeMeta?.label || field.fieldType}</div>
        </div>

        {/* Conditions toggle */}
        <button
          onClick={() => (showConditions ? setShowConditions(false) : openConditions())}
          title="Condições (mostrar/exigir somente se…)"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "3px 5px", borderRadius: 4, cursor: "pointer", flexShrink: 0,
            border: `1px solid ${hasConditions || showConditions ? accent + "60" : "#E5E7EB"}`,
            background: hasConditions || showConditions ? accent + "12" : "transparent",
            color: hasConditions || showConditions ? accent : "var(--text-dim)",
          }}
        >
          <GitBranch size={12} />
        </button>

        {/* Validation toggle */}
        <button
          onClick={() => (showValidation ? setShowValidation(false) : openValidation())}
          title="Validação de formato do valor"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "3px 5px", borderRadius: 4, cursor: "pointer", flexShrink: 0,
            border: `1px solid ${hasValidation || showValidation ? accent + "60" : "#E5E7EB"}`,
            background: hasValidation || showValidation ? accent + "12" : "transparent",
            color: hasValidation || showValidation ? accent : "var(--text-dim)",
          }}
        >
          <ShieldCheck size={12} />
        </button>

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

      {/* Painel de condicionais (mostrar/exigir somente se…) */}
      {showConditions && (
        <div style={{ borderTop: "1px solid #E5E7EB", padding: "10px 12px", background: "#F9FAFB" }}>
          <ConditionBlock
            title="Mostrar somente se"
            otherFields={otherFields}
            condition={visibleIf}
            onChange={setVisibleIf}
            accent={accent}
          />
          <ConditionBlock
            title="Exigir somente se"
            otherFields={otherFields}
            condition={requiredIf}
            onChange={setRequiredIf}
            accent={accent}
            disabled={field.required}
            disabledNote="Já é obrigatório sempre."
          />
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button
              onClick={handleSaveConditions}
              disabled={busy}
              style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 6, border: "none", background: busy ? "#9CA3AF" : accent, color: "#FFF", cursor: busy ? "not-allowed" : "pointer" }}
            >
              Salvar condições
            </button>
            <button
              onClick={() => setShowConditions(false)}
              disabled={busy}
              style={{ fontSize: 12, fontWeight: 600, padding: "6px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#FFF", color: "var(--text-dim)", cursor: busy ? "not-allowed" : "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Painel de validação de formato */}
      {showValidation && (
        <div style={{ borderTop: "1px solid #E5E7EB", padding: "10px 12px", background: "#F9FAFB" }}>
          <ValidationRuleBlock
            fieldType={field.fieldType}
            rule={validationRule}
            onChange={setValidationRule}
            accent={accent}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button
              onClick={handleSaveValidation}
              disabled={busy}
              style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 6, border: "none", background: busy ? "#9CA3AF" : accent, color: "#FFF", cursor: busy ? "not-allowed" : "pointer" }}
            >
              Salvar validação
            </button>
            <button
              onClick={() => setShowValidation(false)}
              disabled={busy}
              style={{ fontSize: 12, fontWeight: 600, padding: "6px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#FFF", color: "var(--text-dim)", cursor: busy ? "not-allowed" : "pointer" }}
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

export function RHStageFieldEditorModal({ open, onClose, domain, stageKey, stageName }) {
  const stageFields = useRHStageFields(domain);
  const [showAdd, setShowAdd] = useState(false);
  const [opError, setOpError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setShowAdd(false); setOpError(null); }
  }, [open, stageKey]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open || !stageKey) return null;

  const accent = "var(--accent)";
  const fields  = stageFields.getFields(stageKey);

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
        stageKey,
        fieldKey: slugifyKey(label),
        fieldType,
        label,
        required,
        options,
        orderIdx: fields.length,
        placeholder: "",
        helpText: "",
        visibleIf: visibleIf ?? null,
        requiredIf: requiredIf ?? null,
        validationRule: validationRule ?? null,
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

  // Renomeia só o rótulo visível — nunca o fieldKey, que é a chave estável
  // usada pra guardar os valores já preenchidos nos cards (mudar o fieldKey
  // orfanaria os dados existentes).
  const handleRename = (id, newLabel) =>
    run(() => {
      const f = fields.find(f => f.id === id);
      if (!f) return Promise.resolve();
      return stageFields.updateField(id, { ...f, label: newLabel });
    });

  const handleSaveConditions = (id, { visibleIf, requiredIf }) =>
    run(() => {
      const f = fields.find(f => f.id === id);
      if (!f) return Promise.resolve();
      return stageFields.updateField(id, { ...f, visibleIf: visibleIf ?? null, requiredIf: requiredIf ?? null });
    });

  const handleSaveValidation = (id, validationRule) =>
    run(() => {
      const f = fields.find(f => f.id === id);
      if (!f) return Promise.resolve();
      return stageFields.updateField(id, { ...f, validationRule: validationRule ?? null });
    });

  const handleMoveUp = (idx) => {
    if (idx === 0) return;
    const ordered = [...fields];
    [ordered[idx - 1], ordered[idx]] = [ordered[idx], ordered[idx - 1]];
    run(() => stageFields.reorderFields(stageKey, ordered.map(f => f.id)));
  };

  const handleMoveDown = (idx) => {
    if (idx === fields.length - 1) return;
    const ordered = [...fields];
    [ordered[idx], ordered[idx + 1]] = [ordered[idx + 1], ordered[idx]];
    run(() => stageFields.reorderFields(stageKey, ordered.map(f => f.id)));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "var(--overlay-scrim)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto flex flex-col"
        style={{ background: "#FFFFFF", borderRadius: "16px 16px 0 0", boxShadow: "var(--shadow-pop)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-2 px-5 py-3.5 border-b"
          style={{ background: "var(--surface)", borderColor: "var(--border)", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className="font-bold text-sm"
              title={`Campos da etapa · ${stageName}`}
              style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
            >
              Campos da etapa · {stageName}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, lineHeight: 0, flexShrink: 0 }}
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
              otherFields={fields.filter(other => other.id !== f.id)}
              accent={accent}
              isFirst={idx === 0}
              isLast={idx === fields.length - 1}
              busy={busy}
              onDelete={handleDelete}
              onToggleRequired={handleToggleRequired}
              onRename={handleRename}
              onSaveConditions={handleSaveConditions}
              onSaveValidation={handleSaveValidation}
              onMoveUp={() => handleMoveUp(idx)}
              onMoveDown={() => handleMoveDown(idx)}
            />
          ))}

          {/* Add form or button */}
          {showAdd ? (
            <AddFieldForm fields={fields} accent={accent} onAdd={handleAdd} onCancel={() => setShowAdd(false)} busy={busy} />
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed text-xs font-semibold transition-colors cursor-pointer"
              style={{ borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)", color: accent, background: "var(--accent-tint)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 16%, transparent)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--accent-tint)"; }}
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

export default RHStageFieldEditorModal;
