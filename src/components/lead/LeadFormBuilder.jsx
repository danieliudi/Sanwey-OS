import React, { useCallback, useRef, useState } from "react";
import {
  X, GripVertical, Trash2, Star, ToggleLeft, ToggleRight,
  Type, Hash, DollarSign, CalendarDays, Mail, Phone, AlignLeft,
  MapPin, Building2, Tag, User,
} from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { FIELD_DEFS, FIELD_DEFS_ARRAY } from "../../constants/lead-form-fields";

const TYPE_ICON = {
  text:     Type,
  textarea: AlignLeft,
  currency: DollarSign,
  email:    Mail,
  phone:    Phone,
  date:     CalendarDays,
  sector:   Tag,
  state:    MapPin,
  user:     User,
};

function FieldTypeIcon({ type, size = 13 }) {
  const Icon = TYPE_ICON[type] || Type;
  return <Icon size={size} strokeWidth={2} />;
}

// ── Drag state shared via ref (avoids re-render noise) ────────────────────────
// We store drag info in a ref so drop handlers don't need it in deps.

export function LeadFormBuilder({ formConfig, onSave, onClose }) {
  const [fields, setFields] = useState(() =>
    formConfig.map(f => ({ ...f, ...FIELD_DEFS[f.id] }))
  );
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragRef = useRef(null);

  const configuredIds = new Set(fields.map(f => f.id));
  const palette = FIELD_DEFS_ARRAY.filter(f => !configuredIds.has(f.id));

  // Toggle required
  const toggleRequired = useCallback((id) => {
    setFields(prev =>
      prev.map(f => f.id === id && !f.locked ? { ...f, required: !f.required } : f)
    );
  }, []);

  // Remove
  const removeField = useCallback((id) => {
    setFields(prev => prev.filter(f => f.id !== id || f.locked));
  }, []);

  // Save
  const handleSave = useCallback(() => {
    onSave(fields.map(f => ({ id: f.id, required: Boolean(f.required), locked: Boolean(f.locked) })));
    onClose();
  }, [fields, onSave, onClose]);

  // ── Drag handlers ────────────────────────────────────────────────────────────

  const handlePaletteDragStart = (e, fieldId) => {
    dragRef.current = { source: "palette", fieldId };
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFormDragStart = (e, fieldId, fromIndex) => {
    dragRef.current = { source: "form", fieldId, fromIndex };
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
  };

  const handleDragLeave = () => setDragOverIdx(null);

  const handleDrop = (e, idx) => {
    e.preventDefault();
    setDragOverIdx(null);
    const info = dragRef.current;
    if (!info) return;

    setFields(prev => {
      const next = [...prev];
      if (info.source === "palette") {
        const def = FIELD_DEFS[info.fieldId];
        if (!def) return prev;
        next.splice(idx, 0, { ...def, required: false });
      } else {
        const from = info.fromIndex;
        const [item] = next.splice(from, 1);
        const insertAt = idx > from ? idx - 1 : idx;
        next.splice(insertAt, 0, item);
      }
      return next;
    });
    dragRef.current = null;
  };

  const handleDropEnd = () => {
    setDragOverIdx(null);
    dragRef.current = null;
  };

  // Group palette by group label
  const groups = FIELD_DEFS_ARRAY.reduce((acc, f) => {
    if (configuredIds.has(f.id)) return acc;
    if (!acc[f.group]) acc[f.group] = [];
    acc[f.group].push(f);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 60, background: "rgba(0,0,0,0.45)" }}
    >
      <div
        className="flex flex-col rounded-xl overflow-hidden shadow-2xl"
        style={{
          width: "min(96vw, 900px)",
          height: "min(94vh, 680px)",
          background: "#FFFFFF",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
          style={{ borderColor: "#E5E7EB", background: "#F8F9FA" }}
        >
          <div>
            <div className="font-bold text-sm" style={{ color: NEUTRAL.graphite }}>
              Configurar formulário de criação
            </div>
            <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>
              Arraste campos da esquerda para o formulário · reordene arrastando
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors"
              style={{ background: "#b5000b" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#8B1419"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#b5000b"; }}
            >
              Salvar
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              style={{ color: NEUTRAL.slate }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left — field palette */}
          <div
            className="overflow-y-auto border-r shrink-0"
            style={{
              width: 220,
              borderColor: "#E5E7EB",
              background: "#F8F9FA",
              padding: "12px 10px",
            }}
          >
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-3 px-1"
              style={{ color: NEUTRAL.slate, letterSpacing: "0.14em" }}
            >
              Campos disponíveis
            </div>
            {Object.entries(groups).length === 0 ? (
              <div className="text-xs px-1" style={{ color: NEUTRAL.slate }}>
                Todos os campos já estão no formulário.
              </div>
            ) : (
              Object.entries(groups).map(([group, gFields]) => (
                <div key={group} className="mb-4">
                  <div
                    className="text-[9px] font-bold uppercase tracking-widest px-1 mb-1.5"
                    style={{ color: NEUTRAL.slate, opacity: 0.7 }}
                  >
                    {group}
                  </div>
                  {gFields.map(f => (
                    <div
                      key={f.id}
                      draggable
                      onDragStart={e => handlePaletteDragStart(e, f.id)}
                      onDragEnd={handleDropEnd}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg mb-1 cursor-grab active:cursor-grabbing select-none"
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E5E7EB",
                        fontSize: 12,
                        color: NEUTRAL.graphite,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#b5000b"; e.currentTarget.style.background = "#FBE9EB"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#FFFFFF"; }}
                    >
                      <FieldTypeIcon type={f.type} size={12} />
                      <span className="font-medium flex-1">{f.label}</span>
                      <GripVertical size={11} style={{ color: NEUTRAL.slate, opacity: 0.5 }} />
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Right — form preview */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ padding: "16px 20px" }}
            onDragOver={e => e.preventDefault()}
          >
            <div
              className="rounded-xl border overflow-hidden"
              style={{ background: "#FFFFFF", borderColor: "#E5E7EB", maxWidth: 520, margin: "0 auto" }}
            >
              {/* Form title bar */}
              <div
                className="px-5 py-3.5 border-b flex items-center gap-2"
                style={{ borderColor: "#E5E7EB", background: "#F8F9FA" }}
              >
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ background: "#b5000b" }}
                >
                  <Star size={12} fill="white" />
                </div>
                <span className="font-bold text-sm" style={{ color: NEUTRAL.graphite }}>
                  Novo card
                </span>
              </div>

              {/* Drop zones + field rows */}
              <div className="px-5 py-4 space-y-0.5">
                <DropZone
                  idx={0}
                  active={dragOverIdx === 0}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                />
                {fields.map((field, index) => (
                  <React.Fragment key={field.id}>
                    <FormFieldRow
                      field={field}
                      index={index}
                      onDragStart={handleFormDragStart}
                      onDragEnd={handleDropEnd}
                      onToggleRequired={() => toggleRequired(field.id)}
                      onRemove={() => removeField(field.id)}
                    />
                    <DropZone
                      idx={index + 1}
                      active={dragOverIdx === index + 1}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    />
                  </React.Fragment>
                ))}
                {fields.length === 0 && (
                  <div
                    className="py-8 text-center text-xs rounded-lg border-2 border-dashed"
                    style={{ color: NEUTRAL.slate, borderColor: "#E5E7EB" }}
                  >
                    Arraste campos aqui
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DropZone({ idx, active, onDragOver, onDragLeave, onDrop }) {
  return (
    <div
      onDragOver={e => onDragOver(e, idx)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop(e, idx)}
      style={{
        height: active ? 32 : 6,
        borderRadius: 6,
        background: active ? "#FBE9EB" : "transparent",
        border: active ? "2px dashed #b5000b" : "2px solid transparent",
        transition: "all 0.12s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        color: "#b5000b",
        fontWeight: 600,
        letterSpacing: "0.06em",
      }}
    >
      {active && "Soltar aqui"}
    </div>
  );
}

function FormFieldRow({ field, index, onDragStart, onDragEnd, onToggleRequired, onRemove }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, field.id, index)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border select-none cursor-grab active:cursor-grabbing"
      style={{
        background: hovered ? "#F8F9FA" : "#FFFFFF",
        borderColor: hovered ? "#D1D5DB" : "#E5E7EB",
        transition: "all 0.1s",
      }}
    >
      <GripVertical size={14} style={{ color: NEUTRAL.slate, opacity: 0.5, flexShrink: 0 }} />
      <FieldTypeIcon type={field.type} size={13} />
      <span className="flex-1 text-sm font-medium" style={{ color: NEUTRAL.graphite }}>
        {field.label}
        {field.required && (
          <span className="ml-1 text-xs font-bold" style={{ color: "#b5000b" }}>*</span>
        )}
      </span>
      {field.locked ? (
        <span
          className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
          style={{ background: "#F0FDF4", color: "#16A34A", letterSpacing: "0.1em" }}
        >
          Fixo
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={onToggleRequired}
            title={field.required ? "Tornar opcional" : "Tornar obrigatório"}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors"
            style={{
              background: field.required ? "#FBE9EB" : "#F3F4F6",
              color: field.required ? "#b5000b" : NEUTRAL.slate,
              border: "none",
              cursor: "pointer",
            }}
          >
            {field.required ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
            {field.required ? "Obrig." : "Opcional"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded transition-colors"
            style={{ color: NEUTRAL.slate, background: "transparent", border: "none", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#B91C1C"; e.currentTarget.style.background = "#FEE2E2"; }}
            onMouseLeave={e => { e.currentTarget.style.color = NEUTRAL.slate; e.currentTarget.style.background = "transparent"; }}
          >
            <Trash2 size={13} />
          </button>
        </>
      )}
    </div>
  );
}

export default LeadFormBuilder;
