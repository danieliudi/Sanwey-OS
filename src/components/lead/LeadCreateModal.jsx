import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Settings, Loader2, AlertTriangle } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { CANONICAL_SECTORS } from "../../constants/taxonomy";
import { CANONICAL_STATES } from "../../constants/taxonomy";
import { FIELD_DEFS } from "../../constants/lead-form-fields";
import { LeadFormBuilder } from "./LeadFormBuilder";
import { useStageFields } from "../../hooks/use-stage-fields";

// ── Duplicate detection helpers ───────────────────────────────────────────────

function normalizeName(name) {
  return (name || "").trim().toLowerCase();
}

function isSimilar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  // includes check for longer strings
  if (a.length > 4 && b.length > 4) {
    if (a.includes(b) || b.includes(a)) return true;
  }
  return false;
}

function findDuplicates(typedName, existingLeads) {
  const typed = normalizeName(typedName);
  if (typed.length < 2) return [];
  return (existingLeads || []).filter(lead => {
    const existing = normalizeName(lead.company);
    return isSimilar(typed, existing);
  });
}

// ── Field renderer ────────────────────────────────────────────────────────────

function FieldInput({ def, configEntry, value, onChange, users, companyId, inputRef }) {
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

  const handleFocus = e => { e.target.style.borderColor = "#b5000b"; e.target.style.boxShadow = "0 0 0 2px rgba(199,33,43,.1)"; };
  const handleBlur  = e => { e.target.style.borderColor = "#D1D5DB"; e.target.style.boxShadow = "none"; };

  if (def.type === "sector") {
    return (
      <select
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        style={{ ...baseStyle, appearance: "none", paddingRight: 32,
          backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
          backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "14px",
          borderColor: configEntry.required && !value ? "#b5000b" : "#D1D5DB",
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
      ref={inputRef}
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

// ── Stage-field renderer (pipeline_stage_fields) ──────────────────────────────

function StageFieldInput({ field, value, onChange, users, companyId }) {
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
  const handleFocus = e => { e.target.style.borderColor = "#b5000b"; e.target.style.boxShadow = "0 0 0 2px rgba(199,33,43,.1)"; };
  const handleBlur  = e => { e.target.style.borderColor = "#D1D5DB"; e.target.style.boxShadow = "none"; };

  const t = field.fieldType;
  const opts = Array.isArray(field.options) ? field.options : [];

  if (t === "textarea") {
    return (
      <textarea value={value || ""} onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder} rows={3}
        style={{ ...baseStyle, resize: "vertical", fontFamily: "inherit" }}
        onFocus={handleFocus} onBlur={handleBlur}
      />
    );
  }
  if (t === "number") {
    return (
      <input type="number" value={value ?? ""} onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder || "0"} style={baseStyle}
        onFocus={handleFocus} onBlur={handleBlur} />
    );
  }
  if (t === "currency") {
    return (
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
          fontSize: 12, color: NEUTRAL.slate, fontWeight: 600, pointerEvents: "none" }}>R$</span>
        <input type="number" min="0" step="0.01" value={value ?? ""}
          onChange={e => onChange(e.target.value)} placeholder="0,00"
          style={{ ...baseStyle, paddingLeft: 30 }}
          onFocus={handleFocus} onBlur={handleBlur} />
      </div>
    );
  }
  if (t === "date") {
    return <input type="date" value={value || ""} onChange={e => onChange(e.target.value)} style={baseStyle} onFocus={handleFocus} onBlur={handleBlur} />;
  }
  if (t === "datetime") {
    return <input type="datetime-local" value={value || ""} onChange={e => onChange(e.target.value)} style={baseStyle} onFocus={handleFocus} onBlur={handleBlur} />;
  }
  if (t === "time") {
    return <input type="time" value={value || ""} onChange={e => onChange(e.target.value)} placeholder="00:00" style={baseStyle} onFocus={handleFocus} onBlur={handleBlur} />;
  }
  if (t === "email") {
    return <input type="email" value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} style={baseStyle} onFocus={handleFocus} onBlur={handleBlur} />;
  }
  if (t === "phone") {
    return <input type="tel" value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || "(00) 00000-0000"} style={baseStyle} onFocus={handleFocus} onBlur={handleBlur} />;
  }
  if (t === "url") {
    return <input type="url" value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || "https://"} style={baseStyle} onFocus={handleFocus} onBlur={handleBlur} />;
  }
  if (t === "checkbox") {
    return (
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} style={{ accentColor: "#b5000b" }} />
        <span style={{ fontSize: 13, color: NEUTRAL.graphite }}>{field.placeholder || "Sim"}</span>
      </label>
    );
  }
  if (t === "select") {
    return (
      <select value={value || ""} onChange={e => onChange(e.target.value)}
        style={{ ...baseStyle, appearance: "none", paddingRight: 32,
          backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
          backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "14px" }}
        onFocus={handleFocus} onBlur={handleBlur}>
        <option value="">{field.placeholder || "Selecione"}</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (t === "radio") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {opts.map(o => (
          <label key={o} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: NEUTRAL.graphite }}>
            <input type="radio" name={field.fieldKey} value={o} checked={value === o} onChange={() => onChange(o)} style={{ accentColor: "#b5000b" }} />
            {o}
          </label>
        ))}
      </div>
    );
  }
  if (t === "multicheck") {
    const arr = Array.isArray(value) ? value : [];
    const toggle = (o) => onChange(arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o]);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {opts.map(o => (
          <label key={o} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: NEUTRAL.graphite }}>
            <input type="checkbox" checked={arr.includes(o)} onChange={() => toggle(o)} style={{ accentColor: "#b5000b" }} />
            {o}
          </label>
        ))}
      </div>
    );
  }
  if (t === "user") {
    const visible = (users || []).filter(u =>
      u.companies?.includes(companyId) &&
      (u.role === "vendedor" || u.role === "consultor" || u.role === "gerente" || u.role === "admin")
    );
    return (
      <select value={value || ""} onChange={e => onChange(e.target.value)}
        style={{ ...baseStyle, appearance: "none", paddingRight: 32,
          backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
          backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "14px" }}
        onFocus={handleFocus} onBlur={handleBlur}>
        <option value="">Selecione</option>
        {visible.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    );
  }
  return <input type="text" value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} style={baseStyle} onFocus={handleFocus} onBlur={handleBlur} />;
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
  existingLeads,
  onViewExisting,
}) {
  const [values, setValues] = useState(() => ({
    owner: currentUser?.id || "",
    sector: currentUser?.sectors?.[0] || "",
    contactEmail: "",
  }));
  const [customValues, setCustomValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const firstRef = useRef(null);

  const stageFields = useStageFields();
  const customDefs = useMemo(
    () => (stageId && companyId) ? stageFields.getFields(companyId, stageId) : [],
    [stageFields, companyId, stageId]
  );

  // Focus first input when modal opens
  React.useEffect(() => {
    if (open) {
      setValues({ owner: currentUser?.id || "", sector: currentUser?.sectors?.[0] || "", contactEmail: "" });
      setCustomValues({});
      setError(null);
      setSaving(false);
      setDuplicates([]);
      setTimeout(() => firstRef.current?.focus(), 80);
    }
  }, [open, currentUser]);

  // Debounced duplicate detection on company name change
  useEffect(() => {
    const typed = values.company || "";
    if (!typed.trim() || typed.trim().length < 2) {
      setDuplicates([]);
      return;
    }
    const timer = setTimeout(() => {
      const found = findDuplicates(typed, existingLeads);
      setDuplicates(found);
    }, 300);
    return () => clearTimeout(timer);
  }, [values.company, existingLeads]);

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
    // Validate required stage-specific custom fields
    for (const f of customDefs) {
      if (!f.required) continue;
      const v = customValues[f.fieldKey];
      const empty = v === undefined || v === null || v === ""
        || (Array.isArray(v) && v.length === 0)
        || (typeof v === "string" && !v.trim());
      if (empty) {
        setError(`O campo "${f.label}" é obrigatório.`);
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
        sector: values.sector || ownerUser?.sectors?.[0] || currentUser?.sectors?.[0] || null,
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
        customFields: { ...customValues },
      };
      await onAdd(lead);
      onClose();
    } catch (err) {
      setError(err?.message || "Não foi possível criar o card.");
    } finally {
      setSaving(false);
    }
  }, [values, customValues, customDefs, formConfig, currentUser, users, companyId, stageId, stage, onAdd, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  const company = COMPANIES[companyId];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-xl max-h-full overflow-y-auto rounded-2xl flex flex-col"
        style={{
          background: "#FFFFFF",
          boxShadow: "0 24px 64px rgba(0,0,0,0.24)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header — same style as LeadDetailDrawer */}
        <div
          className="sticky top-0 z-10 px-5 py-3.5 border-b flex items-center justify-between shrink-0"
          style={{ background: "rgba(250,250,248,0.97)", borderColor: "#E5E7EB", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {company && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold shrink-0"
                style={{ background: company.primary + "18", color: company.primary, border: `1px solid ${company.primary}30` }}
              >
                {company.name}
              </span>
            )}
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight" style={{ color: NEUTRAL.graphite }}>
                Novo card
              </p>
              {stage?.name && (
                <p className="text-xs" style={{ color: NEUTRAL.slate }}>{stage.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isManager && (
              <button
                onClick={() => setShowBuilder(true)}
                className="flex items-center gap-1 p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: NEUTRAL.slate, background: "transparent", border: "none" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F1F3F5"; e.currentTarget.style.color = NEUTRAL.graphite; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = NEUTRAL.slate; }}
                title="Configurar campos do formulário"
              >
                <Settings size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: NEUTRAL.slate, background: "transparent", border: "none" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F1F3F5"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 pt-5 pb-0"
        >
          {formConfig.map((entry, idx) => {
            const def = FIELD_DEFS[entry.id];
            if (!def) return null;
            return (
              <React.Fragment key={entry.id}>
                <div style={{ marginBottom: entry.id === "company" && duplicates.length > 0 ? 8 : 16 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      color: NEUTRAL.slate,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      marginBottom: 5,
                    }}
                  >
                    {entry.required && (
                      <span style={{ color: "#b5000b", marginRight: 2 }}>*</span>
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
                {entry.id === "company" && duplicates.length > 0 && (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: "10px 12px",
                      background: "#FEF3C7",
                      borderLeft: "3px solid #E8920A",
                      borderRadius: "0 6px 6px 0",
                      color: "#92400E",
                      fontSize: 12,
                    }}
                  >
                    {duplicates.slice(0, 1).map(dup => {
                      const ownerUser = (users || []).find(u => u.id === dup.owner);
                      const ownerName = ownerUser?.name || dup.owner || "—";
                      return (
                        <div key={dup.id}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 8 }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1, color: "#E8920A" }} />
                            <span>
                              <strong>Lead similar já existe:</strong> "{dup.company}" — Etapa: {dup.stage} (responsável: {ownerName})
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginLeft: 20 }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (onViewExisting) onViewExisting(dup);
                                onClose();
                              }}
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#92400E",
                                background: "rgba(255,255,255,0.6)",
                                border: "1px solid #E8920A",
                                borderRadius: 5,
                                padding: "3px 10px",
                                cursor: "pointer",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.9)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.6)"; }}
                            >
                              Ver lead existente
                            </button>
                            <button
                              type="button"
                              onClick={() => setDuplicates([])}
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#78350F",
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                padding: "3px 0",
                                textDecoration: "underline",
                              }}
                            >
                              Criar mesmo assim
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {customDefs.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px dashed #E5E7EB" }}>
              <div
                style={{
                  fontSize: 11, fontWeight: 700, color: NEUTRAL.slate,
                  textTransform: "uppercase", letterSpacing: "0.07em",
                  marginBottom: 12,
                }}
              >
                Detalhes da etapa · {stage?.name}
              </div>
              {customDefs.map(f => (
                <div key={f.id} style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: "block", fontSize: 11, fontWeight: 700,
                      color: NEUTRAL.slate, textTransform: "uppercase",
                      letterSpacing: "0.07em", marginBottom: 5,
                    }}
                  >
                    {f.required && <span style={{ color: "#b5000b", marginRight: 2 }}>*</span>}
                    {f.label}
                  </label>
                  {f.helpText && (
                    <div style={{ fontSize: 11, color: NEUTRAL.slate, marginBottom: 6 }}>{f.helpText}</div>
                  )}
                  <StageFieldInput
                    field={f}
                    value={customValues[f.fieldKey]}
                    onChange={val => setCustomValues(prev => ({ ...prev, [f.fieldKey]: val }))}
                    users={users}
                    companyId={companyId}
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 8,
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
          className="px-5 py-4 border-t shrink-0"
          style={{ borderColor: "#E5E7EB", background: "rgba(250,250,248,0.97)" }}
        >
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors"
            style={{
              background: saving ? "#9CA3AF" : "#b5000b",
              color: "#FFFFFF",
              border: "none",
              cursor: saving ? "not-allowed" : "pointer",
            }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = "#8B1419"; }}
            onMouseLeave={e => { if (!saving) e.currentTarget.style.background = saving ? "#9CA3AF" : "#b5000b"; }}
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
    </div>
  );
}

export default LeadCreateModal;
