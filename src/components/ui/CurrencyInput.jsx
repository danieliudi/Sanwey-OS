import React, { useEffect, useRef, useState } from "react";
import { maskCurrencyBR, formatCurrencyBRForInput } from "../../utils/currency";

// Input de moeda com máscara pt-BR ao vivo (separador de milhar "." e decimal
// "," conforme o usuário digita). Emite pelo onChange um número LIMPO (ou ""
// quando vazio) — nunca o texto formatado, pra não quebrar somas/comparações
// downstream. Aceita `value` como number ou string numérica "crua" (com ponto
// decimal, formato antigo de <input type=number>).
export function CurrencyInput({
  value,
  onChange,
  placeholder = "0,00",
  disabled = false,
  prefix = "R$",
  className,
  style,
  onFocus,
  onBlur,
  id,
  name,
  ariaLabel,
  ...rest
}) {
  const [display, setDisplay] = useState(() => formatCurrencyBRForInput(value));
  const focusedRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const inputRef = useRef(null);

  // Ressincroniza o texto exibido quando o valor externo muda e o campo NÃO
  // está em edição (evita brigar com o cursor durante a digitação).
  useEffect(() => {
    if (focusedRef.current) return;
    setDisplay(formatCurrencyBRForInput(value));
  }, [value]);

  const handleChange = (e) => {
    const el = e.target;
    const raw = el.value;
    const { display: masked, value: numeric } = maskCurrencyBR(raw);
    setDisplay(masked);
    onChange?.(numeric == null ? "" : numeric);
    // Máscara de cents-shift (estilo maquininha): o dígito digitado sempre
    // entra pela direita, então o cursor fica sempre travado no final —
    // não há posição "no meio" que faça sentido pra esse tipo de campo.
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      try { node.setSelectionRange(masked.length, masked.length); } catch { /* input pode não suportar seleção */ }
    });
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {prefix && (
        <span
          style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            fontSize: 12, color: "var(--text-dim)", fontWeight: 600, pointerEvents: "none",
          }}
        >
          {prefix}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        onFocus={(e) => { focusedRef.current = true; onFocus?.(e); }}
        onBlur={(e) => { focusedRef.current = false; setDisplay(formatCurrencyBRForInput(valueRef.current)); onBlur?.(e); }}
        placeholder={placeholder}
        disabled={disabled}
        id={id}
        name={name}
        aria-label={ariaLabel}
        className={className}
        style={{ ...(style || {}), ...(prefix ? { paddingLeft: 30 } : {}), paddingRight: 26 }}
        {...rest}
      />
      {/* Pista visual do padrão "centavos deslizantes" — antes o usuário só
          descobria o comportamento ao errar o valor (achado BUG-09 da
          auditoria de QA). Mesmo padrão de ícone "?" com tooltip nativo já
          usado em StatCard.jsx/CampaignDetailDrawer.jsx. */}
      <span
        title="Digite só os números — os 2 últimos dígitos sempre viram centavos."
        style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          cursor: "help", opacity: 0.5, display: "inline-flex", alignItems: "center", pointerEvents: "auto",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--text-dim)" }}>
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
      </span>
    </div>
  );
}

export default CurrencyInput;
