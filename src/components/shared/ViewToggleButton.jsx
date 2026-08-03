import React from "react";

// Extraído das 9 cópias locais quase-idênticas (CRMView, MarketingView,
// EntregasView, ComprasMarketingView, RHFeriasView, RHRecrutamentoView,
// RHFeedbackView, RHTreinamentosView, RHOnboardingView) — mesmo visual em
// todas, sem redesenho. `iconOnlyMobile` (mesmo nome usado em Tabs.jsx) só é
// passado por quem já escondia o label em telas pequenas (CRM/Marketing, que
// já tinham 4 botões no grupo); os outros 6 board mantêm o default e
// continuam mostrando o label sempre, igual hoje.
export function ViewToggleButton({ active, onClick, icon: Icon, label, iconOnlyMobile = false }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      title={label}
      aria-label={label}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
      style={{
        background: active ? "var(--accent)" : "var(--surface)",
        // --on-accent, não #FFFFFF fixo — no dark mode --accent vira um
        // creme claro, e texto branco fixo em cima ficava quase ilegível
        // (achado real, reportado pelo Daniel).
        color: active ? "var(--on-accent)" : "var(--text-dim)",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "var(--surface)"; }}
    >
      <Icon size={13} />
      {iconOnlyMobile ? <span className="hidden sm:inline">{label}</span> : label}
    </button>
  );
}

export default ViewToggleButton;
