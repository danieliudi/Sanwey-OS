import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, Settings, Loader2 } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { CANONICAL_SECTORS } from "../../constants/taxonomy";
import { CANONICAL_STATES } from "../../constants/taxonomy";
import { FIELD_DEFS } from "../../constants/lead-form-fields";
import { LeadFormBuilder } from "./LeadFormBuilder";

// ── Customer search helpers ───────────────────────────────────────────────────

function normalizeName(name) {
  return (name || "").trim().toLowerCase();
}

function cnpjDigits(s) {
  return (s || "").replace(/\D/g, "");
}

// Procura matches existentes por nome (substring case-insensitive) ou CNPJ.
// Retorna até `limit` candidatos ordenados por relevância (exact > prefix > inclusion).
function findMatches({ name, cnpj }, existingLeads, limit = 5) {
  const typedName = normalizeName(name);
  const typedCnpj = cnpjDigits(cnpj);
  if (typedName.length < 2 && typedCnpj.length < 4) return [];

  const scored = [];
  for (const l of (existingLeads || [])) {
    const ln = normalizeName(l.company);
    const lc = cnpjDigits(l.cnpj);
    let score = 0;
    // CNPJ tem prioridade — match exato pesa muito
    if (typedCnpj && lc) {
      if (lc === typedCnpj) score += 100;
      else if (lc.startsWith(typedCnpj)) score += 60;
      else if (lc.includes(typedCnpj)) score += 30;
    }
    if (typedName && ln) {
      if (ln === typedName) score += 50;
      else if (ln.startsWith(typedName)) score += 25;
      else if (ln.includes(typedName)) score += 10;
    }
    if (score > 0) scored.push({ lead: l, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.lead);
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

  const handleFocus = e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 2px rgba(199,33,43,.1)"; };
  const handleBlur  = e => { e.target.style.borderColor = "#D1D5DB"; e.target.style.boxShadow = "none"; };

  if (def.type === "sector") {
    return (
      <select
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        style={{ ...baseStyle, appearance: "none", paddingRight: 32,
          backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
          backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "14px",
          borderColor: configEntry.required && !value ? "var(--accent)" : "#D1D5DB",
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
  clients,
  createClient,
}) {
  const [values, setValues] = useState(() => ({
    owner: currentUser?.id || "",
    sector: currentUser?.sectors?.[0] || "",
    contactEmail: "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const firstRef = useRef(null);

  // Focus first input when modal opens
  React.useEffect(() => {
    if (open) {
      setValues({ owner: currentUser?.id || "", sector: currentUser?.sectors?.[0] || "", contactEmail: "" });
      setError(null);
      setSaving(false);
      setDuplicates([]);
      setTimeout(() => firstRef.current?.focus(), 80);
    }
  }, [open, currentUser]);

  // Debounced match lookup on company name OR CNPJ change.
  // Procura clientes já cadastrados em qualquer empresa acessível.
  useEffect(() => {
    const name = values.company || "";
    const cnpj = values.cnpj || "";
    if (name.trim().length < 2 && cnpjDigits(cnpj).length < 4) {
      setDuplicates([]);
      return;
    }
    const timer = setTimeout(() => {
      setDuplicates(findMatches({ name, cnpj }, existingLeads));
    }, 250);
    return () => clearTimeout(timer);
  }, [values.company, values.cnpj, existingLeads]);

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
        customFields: {},
      };
      // Auto-link or create client record
      const cnpjNorm = cnpjDigits(values.cnpj || "");
      const nameLower = normalizeName(values.company || "");
      let clientId = null;
      if (cnpjNorm.length >= 8) {
        const found = (clients || []).find(c => cnpjDigits(c.cnpj || "") === cnpjNorm);
        if (found) clientId = found.id;
      }
      if (!clientId && nameLower.length >= 2) {
        const found = (clients || []).find(c => normalizeName(c.name || "") === nameLower);
        if (found) clientId = found.id;
      }
      if (!clientId && (values.company || "").trim().length >= 2) {
        try {
          const newClient = await createClient({
            name: (values.company || "").trim(),
            cnpj: values.cnpj || null,
            city: values.city || null,
            state: values.state || null,
            companyIds: [companyId],
          });
          if (newClient?.id) clientId = newClient.id;
        } catch { /* sem Drive nem errors — lead segue sem cliente */ }
      }
      if (clientId) lead.clientId = clientId;

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

  const company = COMPANIES[companyId];
  const requiredMissing = (formConfig || []).some(e =>
    e.required && (!values[e.id] || (typeof values[e.id] === "string" && !values[e.id].trim()))
  );
  const isSubmitDisabled = saving || requiredMissing;

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
                      <span style={{ color: "var(--accent)", marginRight: 2 }}>*</span>
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
                {(entry.id === "company" || entry.id === "cnpj") && duplicates.length > 0 && (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: "10px 12px",
                      background: "var(--surface-alt)",
                      border: "1px solid #BFDBFE",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#1E40AF", fontWeight: 600 }}>
                        {duplicates.length} cliente{duplicates.length !== 1 ? "s" : ""} já cadastrado{duplicates.length !== 1 ? "s" : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDuplicates([])}
                        style={{
                          fontSize: 11, color: "#1E40AF",
                          background: "transparent", border: "none",
                          cursor: "pointer", textDecoration: "underline",
                        }}
                      >
                        Ignorar e criar novo
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {duplicates.map(dup => {
                        const ownerUser = (users || []).find(u => u.id === dup.owner);
                        const ownerName = ownerUser?.name || "—";
                        const dupCompany = COMPANIES[dup.companyId];
                        return (
                          <button
                            key={dup.id}
                            type="button"
                            onClick={() => {
                              if (onViewExisting) onViewExisting(dup);
                              onClose();
                            }}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              gap: 10, width: "100%", textAlign: "left",
                              padding: "8px 10px", borderRadius: 6,
                              background: "#FFFFFF", border: "1px solid #DBEAFE",
                              cursor: "pointer", color: NEUTRAL.graphite,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "#93C5FD"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.borderColor = "#DBEAFE"; }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 12, color: NEUTRAL.graphite, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {dup.company}
                              </div>
                              <div style={{ fontSize: 11, color: NEUTRAL.slate, marginTop: 1 }}>
                                {dup.cnpj && <span style={{ fontFamily: "monospace" }}>{dup.cnpj} · </span>}
                                {dupCompany?.short || dup.companyId} · {dup.stage} · {ownerName}
                              </div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              Abrir →
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}

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
            disabled={isSubmitDisabled}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors"
            style={{
              background: isSubmitDisabled ? "#9CA3AF" : "var(--accent)",
              color: "#FFFFFF",
              border: "none",
              cursor: isSubmitDisabled ? "not-allowed" : "pointer",
            }}
            onMouseEnter={e => { if (!isSubmitDisabled) e.currentTarget.style.background = "#8B1419"; }}
            onMouseLeave={e => { if (!isSubmitDisabled) e.currentTarget.style.background = isSubmitDisabled ? "#9CA3AF" : "var(--accent)"; }}
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
