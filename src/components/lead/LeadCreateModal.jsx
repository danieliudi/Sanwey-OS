import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, Settings, Loader2 } from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { CANONICAL_SECTORS } from "../../constants/taxonomy";
import { CANONICAL_STATES } from "../../constants/taxonomy";
import { FIELD_DEFS } from "../../constants/lead-form-fields";
import { LeadFormBuilder } from "./LeadFormBuilder";
import { useStageFields } from "../../hooks/use-stage-fields";
import { resolveVisibleFields, getMissingRequiredFields } from "../../utils/field-conditions";
import { isValidCnpj, EMAIL_PATTERN } from "../../utils/field-validation";
import { StageFieldInput } from "./StageFieldInput";
import { CurrencyInput } from "../ui/CurrencyInput";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { localDateInputToISOString } from "../../utils/date";

// ── Customer search helpers ───────────────────────────────────────────────────

function normalizeName(name) {
  return (name || "").trim().toLowerCase();
}

function cnpjDigits(s) {
  return (s || "").replace(/\D/g, "");
}

// Array vazio é truthy em JS — sem isso, "owner" virando array (múltiplos
// responsáveis) faria um required ficar sempre satisfeito mesmo sem
// ninguém selecionado.
function isFieldEmpty(val) {
  if (Array.isArray(val)) return val.length === 0;
  return !val || (typeof val === "string" && !val.trim());
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

function FieldInput({ def, configEntry, value, onChange, users, companyId, inputRef, touched }) {
  const baseStyle = {
    width: "100%",
    fontSize: 13,
    borderRadius: 6,
    border: "1px solid #D1D5DB",
    padding: "8px 12px",
    color: "var(--text)",
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
          borderColor: touched && configEntry.required && !value ? "var(--danger)" : "#D1D5DB",
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
    // FASE 5: mais de um responsável por card, igual ao resto do CRM
    // (LeadDetailDrawer, campanhas) — antes só dava pra escolher um único
    // responsável já na criação, diferente de qualquer outro card já criado.
    const visible = (users || []).filter(u =>
      u.companies?.includes(companyId) &&
      (u.role === "vendedor" || u.role === "consultor" || u.role === "gerente" || u.role === "admin")
    );
    return (
      <AssigneeMultiSelect
        value={Array.isArray(value) ? value : (value ? [value] : [])}
        onChange={onChange}
        options={visible}
        placeholder="Selecionar responsáveis…"
      />
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
      <CurrencyInput
        value={value}
        onChange={onChange}
        placeholder="0,00"
        style={baseStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
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
          background: "#F9FAFB", fontSize: 12, color: "var(--text)", flexShrink: 0,
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
    owner: currentUser?.id ? [currentUser.id] : [],
    sector: currentUser?.sectors?.[0] || "",
    contactEmail: "",
  }));
  // Valores dos campos customizados da ETAPA de destino (pipeline_stage_fields)
  // — mesmo mecanismo do drawer/enforcement, mas coletado já na criação, pra
  // não precisar abrir o card de novo só pra preencher o que a fase pede.
  const [customValues, setCustomValues] = useState({});
  const [saving, setSaving] = useState(false);
  // Evita a validação "Campo obrigatório" aparecer antes de qualquer
  // interação (QW2): só sinaliza um campo depois que ele foi tocado (blur)
  // ou depois de uma tentativa de submit que falhou. Chaves prefixadas por
  // namespace ("base:"/"stage:") porque fieldKey de campo customizado da
  // etapa é livre (definido pelo admin) e pode colidir com um id de campo
  // base (ex.: "sector").
  const [touchedKeys, setTouchedKeys] = useState(() => new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const markTouched = useCallback((key) => {
    setTouchedKeys(prev => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);

  // Guarda contra descarte acidental: fechar por clique-fora/ESC/X com o
  // formulário preenchido pede confirmação. Achado da 2ª auditoria.
  const initialSnapshotRef = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = JSON.stringify({ values, customValues });
  if (initialSnapshotRef.current === null) initialSnapshotRef.current = stateRef.current;
  const guardedClose = useCallback(() => {
    if (stateRef.current !== initialSnapshotRef.current
        && !window.confirm("Descartar os dados preenchidos? As informações não salvas serão perdidas.")) return;
    onClose();
  }, [onClose]);
  const [error, setError] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const firstRef = useRef(null);

  const stageFields = useStageFields();
  const visibleStageFields = resolveVisibleFields(
    stageFields.getFields(companyId, stageId),
    customValues
  );

  // Focus first input when modal opens
  //
  // Dependência é `currentUser?.id`, não o objeto `currentUser` inteiro —
  // mesmo com o objeto já memoizado em use-supabase-auth.js, o profile
  // ainda troca de referência legitimamente quando o refetch assíncrono
  // resolve (mesmo usuário, dado preenchido depois do mount). Antes disso,
  // o formulário zerava sozinho ~1-2s após abrir, mesmo com o usuário já
  // digitando (BUG-03 da auditoria de QA).
  React.useEffect(() => {
    if (open) {
      setValues({ owner: currentUser?.id ? [currentUser.id] : [], sector: currentUser?.sectors?.[0] || "", contactEmail: "" });
      setCustomValues({});
      setError(null);
      setSaving(false);
      setDuplicates([]);
      setTouchedKeys(new Set());
      setSubmitAttempted(false);
      setTimeout(() => firstRef.current?.focus(), 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentUser?.id]);

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
      if (isFieldEmpty(values[entry.id])) {
        const def = FIELD_DEFS[entry.id];
        setSubmitAttempted(true);
        setError(`O campo "${def?.label || entry.id}" é obrigatório.`);
        return;
      }
    }
    // Campos obrigatórios da etapa de destino — mesmo enforcement que já
    // bloqueia mover um card com campo vazio, só que antes mesmo dele existir.
    const missing = getMissingRequiredFields(visibleStageFields, customValues);
    if (missing.length > 0) {
      setSubmitAttempted(true);
      setError(`Preencha antes: ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    if (values.value && parseFloat(values.value) < 0) {
      setError("O valor não pode ser negativo.");
      return;
    }
    if (values.cnpj && !isValidCnpj(values.cnpj)) {
      setError("CNPJ inválido.");
      return;
    }
    if (values.contactEmail && !new RegExp(EMAIL_PATTERN).test(values.contactEmail.trim())) {
      setError("E-mail inválido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      const closeDate = values.closeDate
        ? localDateInputToISOString(values.closeDate)
        : new Date(now.getTime() + 30 * 86400000).toISOString();

      // FASE 5: "owner" agora é um array (AssigneeMultiSelect) — mesmo
      // padrão de ownerIds[] + owner escalar (primeiro da lista) usado em
      // todo o resto do CRM (LeadDetailDrawer, campanhas, entregas).
      const ownerIds = Array.isArray(values.owner) ? values.owner : (values.owner ? [values.owner] : []);
      const primaryOwner = ownerIds[0] || currentUser?.id || null;
      const ownerUser = (users || []).find(u => u.id === primaryOwner);

      const lead = {
        id: newId(),
        company: (values.company || "").trim(),
        razaoSocial: values.razaoSocial || null,
        cnpj: values.cnpj || null,
        companyId,
        stage: stageId,
        status: stageId,
        owner: primaryOwner,
        ownerIds: ownerIds.length ? ownerIds : (primaryOwner ? [primaryOwner] : []),
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
        customFields: customValues,
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
  }, [values, formConfig, currentUser, users, companyId, stageId, stage, onAdd, onClose, customValues, visibleStageFields]);

  // ESC fecha o modal via hook global (pilha LIFO) — funciona mesmo sem foco
  // dentro do modal, diferente do antigo onKeyDown na raiz.
  useEscToClose(guardedClose, open);

  const company = COMPANIES[companyId];
  const requiredMissing = (formConfig || []).some(e => e.required && isFieldEmpty(values[e.id]));
  const isSubmitDisabled = saving || requiredMissing;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
      style={{ background: "var(--overlay-scrim)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl max-h-full overflow-y-auto rounded-2xl flex flex-col"
        style={{
          background: "#FFFFFF",
          boxShadow: "var(--shadow-pop)",
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
              <p className="font-bold text-sm leading-tight" style={{ color: "var(--text)" }}>
                Novo card
              </p>
              {stage?.name && (
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>{stage.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isManager && (
              <button
                onClick={() => setShowBuilder(true)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: "var(--text-dim)", background: "transparent", border: "none", fontSize: 12, fontWeight: 600 }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F1F3F5"; e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                title="Configurar campos do formulário"
                aria-label="Configurar formulário"
              >
                <Settings size={15} /> Configurar formulário
              </button>
            )}
            <button
              onClick={guardedClose}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: "var(--text-dim)", background: "transparent", border: "none" }}
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
          id="lead-create-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 pt-5 pb-0"
        >
          {formConfig.map((entry, idx) => {
            const def = FIELD_DEFS[entry.id];
            if (!def) return null;
            return (
              <React.Fragment key={entry.id}>
                <div
                  style={{ marginBottom: entry.id === "company" && duplicates.length > 0 ? 8 : 16 }}
                  onBlur={() => markTouched(`base:${entry.id}`)}
                >
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-dim)",
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
                    touched={submitAttempted || touchedKeys.has(`base:${entry.id}`)}
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
                              cursor: "pointer", color: "var(--text)",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "#93C5FD"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.borderColor = "#DBEAFE"; }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {dup.company}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>
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

          {/* Campos da etapa de destino (pipeline_stage_fields) — o que a
              fase pede além do formulário básico acima, igual ao Pipefy: já
              coletado na criação, não só depois no drawer. */}
          {visibleStageFields.length > 0 && (
            <div style={{ marginBottom: 16, paddingTop: 12, borderTop: "1px dashed #E5E7EB" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                Campos desta etapa {stage?.name ? `· ${stage.name}` : ""}
              </div>
              <div className="flex flex-col gap-3">
                {visibleStageFields.map(f => (
                  <div key={f.id} onBlur={() => markTouched(`stage:${f.fieldKey}`)}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                      {f.effectiveRequired && <span style={{ color: "var(--accent)", marginRight: 2 }}>*</span>}
                      {f.label}
                    </label>
                    <StageFieldInput
                      field={f}
                      value={customValues[f.fieldKey]}
                      onChange={val => setCustomValues(prev => ({ ...prev, [f.fieldKey]: val }))}
                      users={users}
                      companyId={companyId}
                      touched={submitAttempted || touchedKeys.has(`stage:${f.fieldKey}`)}
                    />
                  </div>
                ))}
              </div>
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
          className="px-5 py-4 border-t shrink-0 flex gap-2"
          style={{ borderColor: "#E5E7EB", background: "rgba(250,250,248,0.97)" }}
        >
          <button
            type="submit"
            form="lead-create-form"
            disabled={isSubmitDisabled}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors"
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
          <button
            type="button"
            onClick={guardedClose}
            className="py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors"
            style={{ border: "1px solid #E5E7EB", background: "#FFFFFF", color: "var(--text-dim)", cursor: "pointer" }}
          >
            Cancelar
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
