import React from "react";

// Ícone "?" com tooltip nativo (title) — padrão único da plataforma pra
// explicar um conceito/label sem elemento próprio pra segurar o hint.
// Extraído de StatCard.jsx/CurrencyInput.jsx/CampaignDetailDrawer.jsx (3ª
// cópia do mesmo SVG, ver CLAUDE.md regra 4/seção de tooltips e toasts).
export function HelpTooltip({ text, size = 13, style, ...rest }) {
  if (!text) return null;
  return (
    <span
      title={text}
      style={{ cursor: "help", opacity: 0.5, display: "inline-flex", alignItems: "center", flexShrink: 0, ...style }}
      {...rest}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
      </svg>
    </span>
  );
}

export default HelpTooltip;
