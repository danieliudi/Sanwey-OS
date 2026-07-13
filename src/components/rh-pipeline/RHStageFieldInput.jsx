import React from "react";
import { validateFieldFormat } from "../../utils/field-validation";
import { CurrencyInput } from "../ui/CurrencyInput";

// Renderiza um input para um campo customizado de etapa do pipeline de RH
// (rh_stage_fields), reutilizado pelos Kanbans de Vagas/Candidatos/Onboarding
// e pelos drawers de detalhe.
//
// Cópia de src/components/lead/StageFieldInput.jsx com o acoplamento
// específico de CRM removido: o tipo "user" lá filtrava por
// `u.companies?.includes(companyId)` e por papéis de venda
// (vendedor/consultor/gerente/admin), conceitos que não existem no RH. Aqui
// o tipo "user" simplesmente lista todos os usuários recebidos via `users`.
export function RHStageFieldInput({ field, value, onChange, users }) {
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
  const handleFocus = e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--accent) 12%, transparent)"; };
  const handleBlur  = e => { e.target.style.borderColor = "#D1D5DB"; e.target.style.boxShadow = "none"; };

  const t = field.fieldType;
  const opts = Array.isArray(field.options) ? field.options : [];
  const error = validateFieldFormat(field.validationRule, value);
  const hasValue = !(value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0));
  // Destaque de obrigatório vazio — antes só aparecia como alert() ao tentar
  // mudar de etapa; aqui já sinaliza inline, sem precisar tentar mover o card.
  const isMissingRequired = (field.effectiveRequired ?? field.required) && !hasValue;

  const renderInput = () => {
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
        <span style={{ fontSize: 13, color: "var(--text)" }}>{field.placeholder || "Sim"}</span>
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
          <label key={o} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text)" }}>
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
          <label key={o} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text)" }}>
            <input type="checkbox" checked={arr.includes(o)} onChange={() => toggle(o)} style={{ accentColor: "var(--accent)" }} />
            {o}
          </label>
        ))}
      </div>
    );
  }

  if (t === "user") {
    // Sem conceito de "empresa" ou papel de venda no RH — lista todos os
    // usuários recebidos, sem filtro adicional.
    const visible = users || [];
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
  };

  return (
    <div
      style={isMissingRequired ? { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: 6 } : undefined}
    >
      {renderInput()}
      {hasValue && error && (
        <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{error}</div>
      )}
      {isMissingRequired && (
        <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>Campo obrigatório</div>
      )}
    </div>
  );
}

export default RHStageFieldInput;
