import React, { useCallback, useRef, useState } from "react";
import {
  X, GripVertical, Trash2, Star, ToggleLeft, ToggleRight,
  Type, Hash, DollarSign, CalendarDays, Mail, Phone, AlignLeft,
  MapPin, Building2, Tag, User, Plus, ChevronUp, ChevronDown,
} from "lucide-react";
import { FIELD_DEFS, FIELD_DEFS_ARRAY } from "../../constants/lead-form-fields";
import { useEscToClose } from "../../hooks/use-esc-to-close";

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
  useEscToClose(onClose);
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

  // Adiciona ao fim da lista via clique — fallback pra quem usa touch/mobile,
  // onde o drag-and-drop de HTML5 não funciona (achado da auditoria de
  // fricção de 18/07). Reordenar depois disso é via os botões ↑/↓ na linha.
  const addField = useCallback((fieldId) => {
    const def = FIELD_DEFS[fieldId];
    if (!def) return;
    setFields(prev => [...prev, { ...def, required: false }]);
  }, []);

  // Move um campo uma posição pra cima/baixo — mesmo fallback de clique.
  const moveField = useCallback((id, direction) => {
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === id);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
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
      style={{ zIndex: 60, background: "var(--overlay-scrim)" }}
    >
      <div
        className="flex flex-col rounded-xl overflow-hidden shadow-2xl"
        style={{
          width: "min(96vw, 900px)",
          height: "min(94vh, 680px)",
          background: "var(--surface)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
        >
          <div>
            <div className="font-bold text-sm" style={{ color: "var(--text)" }}>
              Configurar formulário de criação
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
              Arraste ou clique num campo à esquerda para adicionar · reordene arrastando ou pelos botões ↑↓
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors"
              style={{ background: "var(--accent)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#8B0000"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
            >
              Salvar
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-dim)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
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
              borderColor: "var(--border)",
              background: "var(--surface-alt)",
              padding: "12px 10px",
            }}
          >
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-3 px-1"
              style={{ color: "var(--text-dim)", letterSpacing: "0.14em" }}
            >
              Campos disponíveis
            </div>
            {Object.entries(groups).length === 0 ? (
              <div className="text-xs px-1" style={{ color: "var(--text-dim)" }}>
                Todos os campos já estão no formulário.
              </div>
            ) : (
              Object.entries(groups).map(([group, gFields]) => (
                <div key={group} className="mb-4">
                  <div
                    className="text-[9px] font-bold uppercase tracking-widest px-1 mb-1.5"
                    style={{ color: "var(--text-dim)", opacity: 0.7 }}
                  >
                    {group}
                  </div>
                  {gFields.map(f => (
                    <div
                      key={f.id}
                      draggable
                      onDragStart={e => handlePaletteDragStart(e, f.id)}
                      onDragEnd={handleDropEnd}
                      onClick={() => addField(f.id)}
                      title="Clique para adicionar ao fim do formulário"
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg mb-1 cursor-grab active:cursor-grabbing select-none"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        fontSize: 12,
                        color: "var(--text)",
                        boxShadow: "var(--shadow-card)",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "#FBE9EB"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#FFFFFF"; }}
                    >
                      <FieldTypeIcon type={f.type} size={12} />
                      <span className="font-medium flex-1">{f.label}</span>
                      <Plus size={12} style={{ color: "var(--text-dim)", opacity: 0.6 }} />
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
              style={{ background: "var(--surface)", borderColor: "var(--border)", maxWidth: 520, margin: "0 auto" }}
            >
              {/* Form title bar */}
              <div
                className="px-5 py-3.5 border-b flex items-center gap-2"
                style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
              >
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ background: "var(--accent)" }}
                >
                  <Star size={12} fill="white" />
                </div>
                <span className="font-bold text-sm" style={{ color: "var(--text)" }}>
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
                      onMoveUp={() => moveField(field.id, -1)}
                      onMoveDown={() => moveField(field.id, 1)}
                      canMoveUp={index > 0}
                      canMoveDown={index < fields.length - 1}
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
                    style={{ color: "var(--text-dim)", borderColor: "var(--border)" }}
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
        border: active ? "2px dashed var(--accent)" : "2px solid transparent",
        transition: "all 0.12s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        color: "var(--accent)",
        fontWeight: 600,
        letterSpacing: "0.06em",
      }}
    >
      {active && "Soltar aqui"}
    </div>
  );
}

function FormFieldRow({ field, index, onDragStart, onDragEnd, onToggleRequired, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
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
        background: hovered ? "var(--surface-alt)" : "var(--surface)",
        borderColor: hovered ? "#D1D5DB" : "#E5E7EB",
        transition: "all 0.1s",
      }}
    >
      <GripVertical size={14} style={{ color: "var(--text-dim)", opacity: 0.5, flexShrink: 0 }} />
      {/* Fallback de clique pra reordenar — o drag-and-drop de HTML5 não
          funciona em touch/mobile (achado da auditoria de fricção de 18/07). */}
      <div className="flex flex-col shrink-0" style={{ gap: 1 }}>
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          title="Mover para cima"
          style={{ display: "flex", background: "none", border: "none", padding: 0, cursor: canMoveUp ? "pointer" : "default", color: canMoveUp ? "var(--text-dim)" : "#E5E7EB" }}
        >
          <ChevronUp size={12} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          title="Mover para baixo"
          style={{ display: "flex", background: "none", border: "none", padding: 0, cursor: canMoveDown ? "pointer" : "default", color: canMoveDown ? "var(--text-dim)" : "#E5E7EB" }}
        >
          <ChevronDown size={12} />
        </button>
      </div>
      <FieldTypeIcon type={field.type} size={13} />
      <span className="flex-1 text-sm font-medium" style={{ color: "var(--text)" }}>
        {field.label}
        {field.required && (
          <span className="ml-1 text-xs font-bold" style={{ color: "var(--danger)" }}>*</span>
        )}
      </span>
      {field.locked ? (
        <span
          className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
          style={{ background: "var(--success-bg)", color: "var(--success)", letterSpacing: "0.1em" }}
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
              background: field.required ? "var(--danger-bg)" : "var(--surface-alt)",
              color: field.required ? "var(--danger)" : "var(--text-dim)",
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
            style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "var(--danger-bg)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.background = "transparent"; }}
          >
            <Trash2 size={13} />
          </button>
        </>
      )}
    </div>
  );
}

export default LeadFormBuilder;
