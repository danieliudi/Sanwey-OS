import React, { useCallback, useEffect, useState } from "react";
import {
  X, Plus, Trash2, GripVertical, ChevronUp, ChevronDown,
  Pencil, Check, Type, AlignLeft, Hash, DollarSign, Calendar,
  Clock, Mail, Phone, Link, CheckSquare, List, RadioTower,
  ListChecks, User, Settings2,
} from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { FIELD_TYPES, slugifyKey } from "../../hooks/use-stage-fields";

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
  color: NEUTRAL.graphite,
  background: "#FFFFFF",
  outline: "none",
  boxSizing: "border-box",
};

function focusStyle(e) { e.target.style.borderColor = "#b5000b"; e.target.style.boxShadow = "0 0 0 2px rgba(181,0,11,.12)"; }
function blurStyle(e)  { e.target.style.borderColor = "#D1D5DB"; e.target.style.boxShadow = "none"; }

// ── AddFieldForm ──────────────────────────────────────────────────────────────

function AddFieldForm({ onAdd, onCancel, accent, busy }) {
  const [fieldType, setFieldType] = useState("text");
  const [label, setLabel]         = useState("");
  const [required, setRequired]   = useState(false);
  const [options, setOptions]      = useState("");
  const [error, setError]          = useState(null);

  const hasOptions = ["select", "radio", "multicheck"].includes(fieldType);

  const handleAdd = () => {
    if (!label.trim()) { setError("Informe um nome para o campo."); return; }
    if (hasOptions && !options.trim()) { setError("Informe pelo menos uma opção."); return; }
    setError(null);
    const parsed = hasOptions
      ? options.split("\n").map(s => s.trim()).filter(Boolean)
      : [];
    onAdd({ fieldType, label: label.trim(), required, options: parsed });
  };

  return (
    <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
        Novo campo
      </div>

      {/* Tipo */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: NEUTRAL.slate, marginBottom: 4 }}>Tipo</label>
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
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: NEUTRAL.slate, marginBottom: 4 }}>Nome do campo</label>
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
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: NEUTRAL.slate, marginBottom: 4 }}>
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
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: NEUTRAL.graphite, marginBottom: 12, cursor: "pointer", userSelect: "none" }}>
        <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} style={{ accentColor: accent }} />
        Campo obrigatório
      </label>

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
          style={{ fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: busy ? "not-allowed" : "pointer" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── FieldRow ──────────────────────────────────────────────────────────────────

function FieldRow({ field, accent, onDelete, onMoveUp, onMoveDown, onToggleRequired, isFirst, isLast, busy }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const Icon = TYPE_ICON[field.fieldType] || Settings2;
  const typeMeta = FIELD_TYPES.find(t => t.value === field.fieldType);

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 12px", borderRadius: 8,
        background: "#FFFFFF", border: "1px solid #E5E7EB",
        marginBottom: 6,
      }}
    >
      {/* Drag handle (visual only) */}
      <GripVertical size={14} style={{ color: "#CBD5E1", flexShrink: 0, cursor: "grab" }} />

      {/* Type icon */}
      <Icon size={14} style={{ color: NEUTRAL.slate, flexShrink: 0 }} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: NEUTRAL.graphite, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {field.required && <span style={{ color: accent, marginRight: 2 }}>*</span>}
          {field.label}
        </div>
        <div style={{ fontSize: 11, color: NEUTRAL.slate }}>{typeMeta?.label || field.fieldType}</div>
      </div>

      {/* Required toggle */}
      <button
        onClick={() => !busy && onToggleRequired(field.id, !field.required)}
        title={field.required ? "Remover obrigatoriedade" : "Tornar obrigatório"}
        style={{
          fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, cursor: busy ? "wait" : "pointer", flexShrink: 0,
          border: `1px solid ${field.required ? accent + "60" : "#E5E7EB"}`,
          background: field.required ? accent + "12" : "transparent",
          color: field.required ? accent : NEUTRAL.slate,
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
          style={{ background: "none", border: "none", cursor: isFirst ? "default" : "pointer", color: isFirst ? "#E5E7EB" : NEUTRAL.slate, padding: 1, lineHeight: 0 }}
        >
          <ChevronUp size={12} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          style={{ background: "none", border: "none", cursor: isLast ? "default" : "pointer", color: isLast ? "#E5E7EB" : NEUTRAL.slate, padding: 1, lineHeight: 0 }}
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
            style={{ fontSize: 11, padding: "3px 6px", borderRadius: 5, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: "pointer" }}
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

  if (!open || !stage) return null;

  const company = COMPANIES[companyId];
  const accent  = company?.primary || NEUTRAL.graphite;
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

  const handleAdd = ({ fieldType, label, required, options }) =>
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
        style={{ background: "#FFFFFF", borderRadius: "16px 16px 0 0", boxShadow: "0 24px 64px rgba(0,0,0,0.24)" }}
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
            <span className="font-bold text-sm" style={{ color: NEUTRAL.graphite }}>
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
            style={{ background: "none", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, lineHeight: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = NEUTRAL.graphite; }}
            onMouseLeave={e => { e.currentTarget.style.color = NEUTRAL.slate; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 space-y-3">
          <div className="text-xs" style={{ color: NEUTRAL.slate }}>
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
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.slate }}
            >
              Nenhum campo configurado para esta etapa.
            </div>
          )}

          {fields.map((f, idx) => (
            <FieldRow
              key={f.id}
              field={f}
              accent={accent}
              isFirst={idx === 0}
              isLast={idx === fields.length - 1}
              busy={busy}
              onDelete={handleDelete}
              onToggleRequired={handleToggleRequired}
              onMoveUp={() => handleMoveUp(idx)}
              onMoveDown={() => handleMoveDown(idx)}
            />
          ))}

          {/* Add form or button */}
          {showAdd ? (
            <AddFieldForm accent={accent} onAdd={handleAdd} onCancel={() => setShowAdd(false)} busy={busy} />
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
