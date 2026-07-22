import React from "react";
import { X } from "lucide-react";

// Shell de toast compartilhado — nasceu pra "nova versão disponível" +
// "novidades" (ver specautoupdatechangelogtoast.md), mas também absorve o
// toast de erro que já existia duplicado em 4 telas (CRMView, MarketingView,
// EntregasView, RHRecrutamentoView — mesmo markup, `fixed z-50 ... shadow-lg`
// vermelho, canto superior direito) — 4 repetições já passa da regra de
// extração da 3ª vez (CLAUDE.md seção 4), então em vez de nascer um 5º
// padrão paralelo, esse componente já cobre os dois casos via `variant`.
//
// variant="default": neutro (--surface/--border/--text) — update/novidades,
// nem ação de marca nem erro. variant="danger": vermelho — mensagem de erro
// bloqueante (ex.: falha ao mover card de etapa).
const VARIANTS = {
  default: { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)", iconColor: "var(--text-dim)" },
  danger: { background: "#FEF2F2", borderColor: "#FCA5A5", color: "#B91C1C", iconColor: "#B91C1C" },
};

const POSITIONS = {
  "bottom-right": { bottom: 20, right: 20 },
  "top-right": { top: 16, right: 16 },
};

export function AppToast({
  icon: Icon,
  title,
  children,
  onDismiss,
  action,
  variant = "default",
  position = "bottom-right",
}) {
  const v = VARIANTS[variant] || VARIANTS.default;
  const pos = POSITIONS[position] || POSITIONS["bottom-right"];

  return (
    <div
      className="fixed z-50 flex items-start gap-2.5 rounded-xl shadow-lg"
      style={{
        ...pos,
        maxWidth: 380,
        padding: "12px 14px",
        background: v.background,
        border: `1px solid ${v.borderColor}`,
        color: v.color,
        boxShadow: "var(--shadow-pop)",
      }}
    >
      {Icon && <Icon size={15} className="shrink-0 mt-0.5" style={{ color: v.iconColor }} />}
      <div className="flex-1 min-w-0">
        {title && <div className="text-sm font-semibold mb-0.5">{title}</div>}
        {children && <div className="text-xs" style={{ color: variant === "danger" ? v.color : "var(--text-dim)" }}>{children}</div>}
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs font-semibold mt-2 cursor-pointer"
            style={{ color: "var(--accent)", background: "none", border: "none", padding: 0 }}
          >
            {action.label}
          </button>
        )}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0" style={{ color: v.iconColor, background: "none", border: "none", cursor: "pointer", padding: 0 }} aria-label="Fechar">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default AppToast;
