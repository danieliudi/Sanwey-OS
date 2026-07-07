import React from "react";
import { NEUTRAL } from "../../constants/companies";
import { validateFieldFormat } from "../../utils/field-validation";

// Renderiza um input para um campo customizado de etapa (pipeline_stage_fields),
// reutilizado pelo modal de criação e pelo drawer de detalhe.
export function StageFieldInput({ field, value, onChange, users, companyId }) {
  const input = renderInput({ field, value, onChange, users, companyId });
  // Validação de formato (camada 2, além de presença/obrigatoriedade) — só
  // mostra o erro quando há valor preenchido; campo vazio é responsabilidade
  // do required, não desta camada.
  const error = field.validationRule ? validateFieldFormat(field.validationRule, value) : null;
  const hasValue = !(value === undefined || value === null || value === "");

  return (
    <div>
      {input}
      {hasValue && error && (
        <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}

function renderInput({ field, value, onChange, users, companyId }) {
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

  const t = field.fieldType;
  const opts = Array.isArray(field.options) ? field.options : [];

  if (t === "textarea") {
    return (
      <textarea value={value || ""} onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder} rows={3}
        style={{ ...baseStyle, resize: "vertical", fontFamily: "inherit" }}
        onFocus={handleFocus} onBlur={handleBlur} />
    );
  }
  if (t === "number") {
    return <input type="number" value={value ?? ""} onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder || "0"} style={baseStyle}
      onFocus={handleFocus} onBlur={handleBlur} />;
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
  if (t === "date") return <input type="date" value={value || ""} onChange={e => onChange(e.target.value)} style={baseStyle} onFocus={handleFocus} onBlur={handleBlur} />;
  if (t === "datetime") return <input type="datetime-local" value={value || ""} onChange={e => onChange(e.target.value)} style={baseStyle} onFocus={handleFocus} onBlur={handleBlur} />;
  if (t === "time") return <input type="time" value={value || ""} onChange={e => onChange(e.target.value)} placeholder="00:00" style={baseStyle} onFocus={handleFocus} onBlur={handleBlur} />;
  if (t === "email") return <input type="email" value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} style={baseStyle} onFocus={handleFocus} onBlur={handleBlur} />;
  if (t === "phone") return <input type="tel" value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || "(00) 00000-0000"} style={baseStyle} onFocus={handleFocus} onBlur={handleBlur} />;
  if (t === "url") return <input type="url" value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || "https://"} style={baseStyle} onFocus={handleFocus} onBlur={handleBlur} />;

  if (t === "checkbox") {
    return (
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
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
            <input type="radio" name={field.fieldKey} value={o} checked={value === o} onChange={() => onChange(o)} style={{ accentColor: "var(--accent)" }} />
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
            <input type="checkbox" checked={arr.includes(o)} onChange={() => toggle(o)} style={{ accentColor: "var(--accent)" }} />
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

export default StageFieldInput;
