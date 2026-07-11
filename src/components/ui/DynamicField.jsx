import React from "react";

// Render de um único campo customizado em formulário (CSS compacto para
// usar tanto no QuickAddForm do kanban quanto em outros lugares).
//
// Props:
//   field     — { fieldKey, fieldType, label, required, options, placeholder, helpText }
//   value     — valor atual (string/number/boolean conforme tipo)
//   onChange  — (newValue) => void
//   users     — opcional, lista de { id, name } para field_type='user'
//   disabled  — booleano
export function DynamicField({ field, value, onChange, users = [], disabled = false }) {
  const baseInputStyle = {
    width: "100%",
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #D1D5DB",
    outline: "none",
    color: "var(--text)",
    background: "#FFFFFF",
    boxSizing: "border-box",
  };

  const handleChange = (e) => onChange(e.target.value);
  const handleNumber = (e) => {
    const v = e.target.value;
    onChange(v === "" ? "" : Number(v));
  };
  const handleCheckbox = (e) => onChange(e.target.checked);

  let input;
  switch (field.fieldType) {
    case "textarea":
      input = (
        <textarea
          value={value ?? ""}
          onChange={handleChange}
          placeholder={field.placeholder || ""}
          disabled={disabled}
          rows={3}
          style={{ ...baseInputStyle, resize: "vertical", minHeight: 60 }}
        />
      );
      break;
    case "number":
    case "currency":
      input = (
        <input
          type="number"
          step={field.fieldType === "currency" ? "0.01" : "any"}
          value={value ?? ""}
          onChange={handleNumber}
          placeholder={field.placeholder || (field.fieldType === "currency" ? "R$ 0,00" : "")}
          disabled={disabled}
          style={baseInputStyle}
        />
      );
      break;
    case "date":
      input = (
        <input type="date" value={value ?? ""} onChange={handleChange} disabled={disabled} style={baseInputStyle} />
      );
      break;
    case "datetime":
      input = (
        <input type="datetime-local" value={value ?? ""} onChange={handleChange} disabled={disabled} style={baseInputStyle} />
      );
      break;
    case "email":
      input = (
        <input type="email" value={value ?? ""} onChange={handleChange} placeholder={field.placeholder || "email@dominio.com"} disabled={disabled} style={baseInputStyle} />
      );
      break;
    case "phone":
      input = (
        <input type="tel" value={value ?? ""} onChange={handleChange} placeholder={field.placeholder || "(11) 99999-9999"} disabled={disabled} style={baseInputStyle} />
      );
      break;
    case "url":
      input = (
        <input type="url" value={value ?? ""} onChange={handleChange} placeholder={field.placeholder || "https://..."} disabled={disabled} style={baseInputStyle} />
      );
      break;
    case "checkbox":
      input = (
        <label className="inline-flex items-center gap-2 cursor-pointer" style={{ fontSize: 12, color: "var(--text)" }}>
          <input type="checkbox" checked={!!value} onChange={handleCheckbox} disabled={disabled} />
          <span>{field.placeholder || "Sim"}</span>
        </label>
      );
      break;
    case "select":
      input = (
        <select value={value ?? ""} onChange={handleChange} disabled={disabled} style={baseInputStyle}>
          <option value="">{field.placeholder || "Selecione…"}</option>
          {(field.options || []).map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>
          ))}
        </select>
      );
      break;
    case "user":
      input = (
        <select value={value ?? ""} onChange={handleChange} disabled={disabled} style={baseInputStyle}>
          <option value="">{field.placeholder || "Selecione um usuário…"}</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      );
      break;
    case "text":
    default:
      input = (
        <input type="text" value={value ?? ""} onChange={handleChange} placeholder={field.placeholder || ""} disabled={disabled} style={baseInputStyle} />
      );
  }

  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold" style={{ color: "var(--text-dim)" }}>
        {field.label}
        {field.required && <span style={{ color: "#B91C1C", marginLeft: 3 }}>*</span>}
      </label>
      {input}
      {field.helpText && (
        <div className="text-[10px]" style={{ color: "var(--text-dim)" }}>{field.helpText}</div>
      )}
    </div>
  );
}

// Validação simples: retorna array de mensagens de erro ou [] se OK.
export function validateFields(fields, values) {
  const errors = [];
  for (const f of fields) {
    if (!f.required) continue;
    const v = values?.[f.fieldKey];
    const empty = v === undefined || v === null || v === "" || (f.fieldType === "checkbox" && !v);
    if (empty) errors.push(`${f.label} é obrigatório.`);
  }
  return errors;
}

export default DynamicField;
