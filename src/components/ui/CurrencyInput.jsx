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
    const caret = el.selectionStart ?? raw.length;
    const digitsLeft = (raw.slice(0, caret).match(/\d/g) || []).length;
    const { display: masked, value: numeric } = maskCurrencyBR(raw);
    setDisplay(masked);
    onChange?.(numeric == null ? "" : numeric);
    // Reposiciona o cursor após o reformat: conta os dígitos que ficavam à
    // esquerda do cursor e recoloca depois da mesma quantidade de dígitos.
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      let pos = 0;
      let seen = 0;
      while (pos < masked.length && seen < digitsLeft) {
        if (/\d/.test(masked[pos])) seen++;
        pos++;
      }
      try { node.setSelectionRange(pos, pos); } catch { /* input pode não suportar seleção */ }
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
        style={{ ...(style || {}), ...(prefix ? { paddingLeft: 30 } : {}) }}
        {...rest}
      />
    </div>
  );
}

export default CurrencyInput;
