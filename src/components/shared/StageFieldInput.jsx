import React from "react";
import { AlertTriangle } from "lucide-react";
import { validateFieldFormat } from "../../utils/field-validation";
import { CurrencyInput } from "../ui/CurrencyInput";

// Renderiza um input para um campo customizado de etapa (pipeline_stage_fields
// no CRM, rh_pipeline_stage_fields no RH) — reutilizado pelo modal de criação
// e pelo drawer de detalhe do Pipeline, e pelos Kanbans/drawers de RH e
// Marketing. Consolidação de src/components/lead/StageFieldInput.jsx +
// src/components/rh-pipeline/RHStageFieldInput.jsx (P1.1 do backlog Zero
// Bullshit) — ambos os arquivos agora só reexportam este.
//
// `companyId` presente = contexto CRM: o tipo "user" filtra por empresa e por
// papel de venda (vendedor/consultor/gerente/admin). Sem `companyId` (RH,
// Marketing) o tipo "user" lista todos os usuários recebidos — não existe
// conceito de "empresa" ou papel de venda nesses domínios.
export function StageFieldInput({ field, value, onChange, users, companyId, touched = false }) {
  const input = renderInput({ field, value, onChange, users, companyId });
  // Validação de formato (camada 2, além de presença/obrigatoriedade) — só
  // mostra o erro quando há valor preenchido; campo vazio é responsabilidade
  // do required, não desta camada.
  const error = validateFieldFormat(field.validationRule, value);
  const hasValue = !(value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0));
  // Destaque de obrigatório vazio. `touched` (default false, achado de
  // auditoria via vídeo — antes era `true`) nunca sinaliza vermelho antes de
  // alguma interação real: nem card já existente com pendência antiga, nem
  // campo de etapa recém-alcançada devem "nascer" vermelhos. Quem chama passa
  // `touched` ligado à tentativa de mover/salvar que já falhou (mesmo sinal
  // que dispara a mensagem de campo faltando) — é aí que o destaque aparece.
  const isMissingRequired = touched && (field.effectiveRequired ?? field.required) && !hasValue;

  return (
    <div
      style={isMissingRequired ? { background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, padding: 6 } : undefined}
    >
      {input}
      {hasValue && error && (
        <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{error}</div>
      )}
      {isMissingRequired && (
        <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>Campo obrigatório</div>
      )}
    </div>
  );
}

function renderInput({ field, value, onChange, users, companyId }) {
  const baseStyle = {
    width: "100%",
    fontSize: 13,
    borderRadius: 6,
    border: "1px solid var(--border-strong)",
    padding: "8px 12px",
    color: "var(--text)",
    background: "var(--surface)",
    outline: "none",
    boxSizing: "border-box",
  };
  const handleFocus = e => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--accent) 12%, transparent)"; };
  const handleBlur  = e => { e.target.style.borderColor = "var(--border-strong)"; e.target.style.boxShadow = "none"; };

  const t = field.fieldType;
  const opts = Array.isArray(field.options) ? field.options : [];

  // Campo de seleção configurado sem opções (cadastro incompleto/migração) —
  // sem isso, radio/multicheck renderizam uma <div> vazia e select mostra só
  // o placeholder, indistinguível de "ainda não escolhi".
  if ((t === "select" || t === "radio" || t === "multicheck") && opts.length === 0) {
    return (
      <div style={{
        width: "100%", boxSizing: "border-box", display: "flex", alignItems: "flex-start", gap: 6,
        background: "var(--warning-bg)", border: "1px solid #FDE68A", borderRadius: 8,
        padding: "8px 12px", fontSize: 12, color: "var(--warning)",
      }}>
        <AlertTriangle size={14} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
        <span>Nenhuma opção configurada para este campo — configure em Editar fase.</span>
      </div>
    );
  }

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

  if (t === "percent_steps") {
    const steps = [0, 20, 40, 60, 80, 100];
    const current = value === "" || value === null || value === undefined ? null : Number(value);
    return (
      <div>
        <div style={{ height: 8, borderRadius: 999, background: "var(--surface-alt)", overflow: "hidden", marginBottom: 10 }}>
          <div style={{
            width: `${current || 0}%`, height: "100%", borderRadius: 999,
            background: current >= 100 ? "var(--success)" : "var(--accent)",
            transition: "width 0.2s ease",
          }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {steps.map(s => {
            const active = current === s;
            return (
              <button
                key={s} type="button"
                onClick={() => onChange(s)}
                style={{
                  padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent)" : "var(--surface)",
                  color: active ? "#fff" : "var(--text-dim)",
                  cursor: "pointer",
                }}
              >
                {s}%
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (t === "user") {
    // `companyId` presente = contexto CRM: só vendedores/gerência daquela
    // empresa fazem sentido como responsável de um lead. Sem `companyId`
    // (RH/Marketing) não há esse conceito — lista todos os usuários.
    const visible = companyId
      ? (users || []).filter(u =>
          u.companies?.includes(companyId) &&
          (u.role === "vendedor" || u.role === "consultor" || u.role === "gerente" || u.role === "admin")
        )
      : (users || []);
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
