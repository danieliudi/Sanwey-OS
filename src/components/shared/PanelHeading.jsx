import React, { useState } from "react";
import { ArrowRight } from "lucide-react";

// "Eyebrow" de cluster — rótulo que agrupa várias caixas, sem borda/fundo
// próprio, sentado direto no fundo da página. Ação opcional usa o recipe
// canônico de "ver mais" (fundo accent+"0D" idle → accent+"18" hover).
export function Eyebrow({ children, action, onAction, accent = "var(--accent)", className = "" }) {
  const [hover, setHover] = useState(false);
  return (
    <div className={`flex items-center justify-between ${className}`} style={{ marginBottom: 12 }}>
      <span style={{
        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.08em", color: "var(--text-dim)",
      }}>
        {children}
      </span>
      {action && (
        <button
          onClick={onAction}
          className="text-xs font-semibold flex items-center gap-1 rounded-lg transition-all duration-150 py-3 px-2.5 lg:py-1.5"
          style={{ color: accent, background: hover ? accent + "18" : accent + "0D" }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {action} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

// Título de painel — rótulo dentro de uma caixa com borda (o "Painel"),
// descreve o conteúdo daquele painel específico. A borda inferior +
// padding-bottom só aparece quando há uma ação "ver mais" ao lado (recipe
// canônico pra painel-com-ação); sem ação, é só o título/subtítulo soltos.
export function PanelTitle({ title, subtitle, action, onAction, actionColor = "var(--accent)" }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        marginBottom: action ? 14 : 10,
        paddingBottom: action ? 10 : 0,
        borderBottom: action ? "1px solid var(--border)" : "none",
      }}
    >
      <div>
        {title && (
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{title}</div>
        )}
        {subtitle && (
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>{subtitle}</div>
        )}
      </div>
      {action && (
        <button
          onClick={onAction}
          className="flex items-center font-semibold text-xs px-1 py-2.5 lg:px-0 lg:py-0"
          style={{ background: "none", border: "none", cursor: "pointer", color: actionColor, gap: 3 }}
        >
          {action}
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

export default PanelTitle;
