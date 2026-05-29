import React, { useCallback, useMemo, useRef, useState } from "react";
import { X, Settings, Star, Loader2, ChevronDown } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { CANONICAL_SECTORS } from "../../constants/taxonomy";
import { CANONICAL_STATES } from "../../constants/taxonomy";
import { FIELD_DEFS } from "../../constants/lead-form-fields";
import { LeadFormBuilder } from "./LeadFormBuilder";

// ── Field renderer ────────────────────────────────────────────────────────────

function FieldInput({ def, configEntry, value, onChange, users, companyId }) {
  const baseStyle = {
    width: "100%",
    fontSize: 13,
    borderRadius: 6,
    border: "1px solid #D1D5DB",
    padding: "8px 12px",
    color: NEUTRAL.graphite,
    background: "#FFFFFF",
    outline: "none",
    boxSizing: "border-box",
  };

  const handleFocus = e => { e.target.style.borderColor = "#C7212B"; e.target.style.boxShadow = "0 0 0 2px rgba(199,33,43,.1)"; };
  const handleBlur  = e => { e.target.style.borderColor = "#D1D5DB"; e.target.style.boxShadow = "none"; };

  if (def.type === "sector") {
    return (
      <select
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        style={{ ...baseStyle, appearance: "none", paddingRight: 32,
          backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
          backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "14px",
          borderColor: configEntry.required && !value ? "#C7212B" : "#D1D5DB",
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <option value="">Selecione o setor{configEntry.required ? " *" : ""}</option>
        {CANONICAL_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }

  if (def.type === "state") {
    return (
      <select
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        style={{ ...baseStyle, appearance: "none", paddingRight: 32,
          backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
          backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "14px",
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <option value="">UF</option>
        {CANONICAL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }

  if (def.type === "user") {
    const visible = (users || []).filter(u =>
      u.companies?.includes(companyId) &&
      (u.role === "vendedor" || u.role === "consultor" || u.role === "gerente" || u.role === "admin")
    );
    return (
      <select
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        style={{ ...baseStyle, appearance: "none", paddingRight: 32,
          backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
          backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "14px",
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <option value="">Responsável</option>
        {visible.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    );
  }

  if (def.type === "textarea") {
    return (
      <textarea
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={def.placeholder}
        rows={3}
        style={{ ...baseStyle, resize: "vertical", fontFamily: "inherit" }}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  }

  if (def.type === "currency") {
    return (
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
          fontSize: 12, color: NEUTRAL.slate, fontWeight: 600, pointerEvents: "none",
        }}>R$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder="0,00"
          style={{ ...baseStyle, paddingLeft: 30 }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>
    );
  }

  if (def.type === "date") {
    return (
      <input
        type="date"
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        style={baseStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  }

  if (def.type === "email") {
    return (
      <input
        type="email"
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={def.placeholder}
        style={baseStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  }

  if (def.type === "phone") {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px",
          background: "#F9FAFB", fontSize: 12, color: NEUTRAL.graphite, flexShrink: 0,
        }}>
          🇧🇷 +55
        </div>
        <input
          type="tel"
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder="(00) 00000-0000"
          style={{ ...baseStyle, flex: 1 }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>
    );
  }

  // default text
  return (
    <input
      type="text"
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder={def.placeholder}
      style={baseStyle}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function LeadCreateModal({
  open, onClose,
  stageId, stage, companyId,
  currentUser, users,
  onAdd,
  isManager,
  formConfig,
  onUpdateFormConfig,
}) {
  const [values, setValues] = useState(() => ({
    owner: currentUser?.id || "",
    sector: currentUser?.sector || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const firstRef = useRef(null);

  // Focus first input when modal opens
  React.useEffect(() => {
    if (open) {
      setValues({ owner: currentUser?.id || "", sector: currentUser?.sector || "" });
      setError(null);
      setSaving(false);
      setTimeout(() => firstRef.current?.focus(), 80);
    }
  }, [open, currentUser]);

  const set = useCallback((fieldId, val) => {
    setValues(prev => ({ ...prev, [fieldId]: val }));
  }, []);

  const newId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "lead_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    // Validate required fields
    for (const entry of formConfig) {
      if (!entry.required) continue;
      const val = values[entry.id];
      if (!val || (typeof val === "string" && !val.trim())) {
        const def = FIELD_DEFS[entry.id];
        setError(`O campo "${def?.label || entry.id}" é obrigatório.`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      const closeDate = values.closeDate
        ? new Date(values.closeDate).toISOString()
        : new Date(now.getTime() + 30 * 86400000).toISOString();

      const resolvedOwner = values.owner || currentUser?.id || null;
      const ownerUser = (users || []).find(u => u.id === resolvedOwner);

      const lead = {
        id: newId(),
        company: (values.company || "").trim(),
        razaoSocial: values.razaoSocial || null,
        cnpj: values.cnpj || null,
        companyId,
        stage: stageId,
        status: stageId,
        owner: resolvedOwner,
        sector: values.sector || ownerUser?.sector || currentUser?.sector || null,
        value: parseFloat(values.value) || 0,
        probability: Number.isFinite(stage?.probability) ? stage.probability : 10,
        contactEmail: values.contactEmail || null,
        phone: values.phone || null,
        city: values.city || null,
        state: values.state || null,
        closeDate,
        fitScore: 0,
        starred: false,
        notes: values.notes ? [{ text: values.notes, createdAt: now.toISOString() }] : [],
        daysAgo: 0,
        dateDetected: now.toISOString(),
        createdAt: now.toISOString(),
        lastActivity: now.toISOString(),
        stageChangedAt: now.toISOString(),
        decisionMaker: { name: "—", role: "—" },
        customFields: {},
      };
      await onAdd(lead);
      onClose();
    } catch (err) {
      setError(err?.message || "Não foi possível criar o card.");
    } finally {
      setSaving(false);
    }
  }, [values, formConfig, currentUser, users, companyId, stageId, stage, onAdd, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 55 }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        onKeyDown={handleKeyDown}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 56,
          width: "min(96vw, 520px)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          background: "#FFFFFF",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.1)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderBottom: "1px solid #E5E7EB",
            background: "#F8F9FA",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 28, height: 28,
              borderRadius: 7,
              background: "#FBE9EB",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Star size={13} style={{ color: "#C7212B" }} fill="#C7212B" />
          </div>
          <span
            style={{ fontWeight: 700, fontSize: 15, color: NEUTRAL.graphite, flex: 1 }}
          >
            Novo card
          </span>
          {isManager && (
            <button
              onClick={() => setShowBuilder(true)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 12, fontWeight: 600,
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                color: NEUTRAL.slate,
                cursor: "pointer",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#C7212B"; e.currentTarget.style.color = "#C7212B"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = NEUTRAL.slate; }}
              title="Configurar campos do formulário"
            >
              <Settings size={13} />
              Editar
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: NEUTRAL.slate,
              cursor: "pointer",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}
        >
          {formConfig.map((entry, idx) => {
            const def = FIELD_DEFS[entry.id];
            if (!def) return null;
            return (
              <div key={entry.id} style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: NEUTRAL.graphite,
                    marginBottom: 5,
                  }}
                >
                  {entry.required && (
                    <span style={{ color: "#C7212B", marginRight: 2 }}>*</span>
                  )}
                  {def.label}
                </label>
                <FieldInput
                  def={def}
                  configEntry={entry}
                  value={values[entry.id]}
                  onChange={val => set(entry.id, val)}
                  users={users}
                  companyId={companyId}
                  inputRef={idx === 0 ? firstRef : undefined}
                />
              </div>
            );
          })}

          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                background: "#FEF2F2",
                color: "#B91C1C",
                fontSize: 12,
                border: "1px solid #FECACA",
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #E5E7EB",
            background: "#F8F9FA",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 8,
              border: "none",
              background: saving ? "#9CA3AF" : "#C7212B",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = "#8B1419"; }}
            onMouseLeave={e => { if (!saving) e.currentTarget.style.background = "#C7212B"; }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Criando…" : "Criar card"}
          </button>
        </div>
      </div>

      {/* Form builder (rendered on top) */}
      {showBuilder && (
        <LeadFormBuilder
          formConfig={formConfig}
          onSave={onUpdateFormConfig}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </>
  );
}

export default LeadCreateModal;
