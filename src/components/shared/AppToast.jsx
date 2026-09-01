import React from "react";
import { createPortal } from "react-dom";
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
  danger: { background: "var(--danger-bg)", borderColor: "var(--danger)", color: "var(--danger)", iconColor: "var(--danger)" },
};

const POSITIONS = {
  "bottom-right": {}, // now handled via responsive className below (mobile-safe bottom offset)
  "top-right": { top: 16, right: 16 },
};

const POSITION_CLASSES = {
  "bottom-right": "bottom-20 right-4 lg:bottom-5 lg:right-5",
  "top-right": "",
};

// PORTAL + faixa acima de tudo (2200), 01/09/2026 — varredura de
// empilhamento pedida pelo Daniel.
//
// Antes: `fixed z-50`, renderizado no lugar onde a view o declara. Duas
// consequências, as duas achadas na mesma varredura:
//
//   1. Em 5 telas (Comex, Pós-venda, Férias, Campanhas, Tarefas) o toast é
//      declarado ANTES do drawer de detalhe, que é `fixed inset-0 z-50` com
//      scrim de tela cheia. Empatados em 50, quem vem depois no DOM ganha:
//      o erro nascia ATRÁS do scrim, escurecido e inalcançável. E é
//      justamente o canal que reporta gravação recusada pela RLS — a pessoa
//      clicava, nada acontecia, e não havia como saber por quê.
//   2. Existe uma segunda escala de z-index nesta plataforma, escrita à mão,
//      que vai de 999 a 2101 (~40 modais). Contra ela, `z-50` perde por
//      aritmética: os toasts de nível de App (nova versão, sincronização,
//      Novidades, mensagem de chat) sumiam por completo com qualquer um
//      desses modais aberto.
//
// 2200 fica acima das duas escalas, inclusive do tour guiado (2100/2101).
// É deliberado: aviso de ERRO tem que ser visível mesmo por cima de um tour
// — um erro que ninguém vê é pior que um tour interrompido. O portal tira o
// toast de qualquer contexto de empilhamento criado por ancestral com
// transform/filter/opacity, que é o jeito de o z-index alto virar inútil sem
// deixar rastro.
const TOAST_Z = 2200;

export function AppToast({
  icon: Icon,
  iconBadge = false,
  title,
  description,
  children,
  onDismiss,
  action,
  variant = "default",
  position = "bottom-right",
}) {
  const v = VARIANTS[variant] || VARIANTS.default;
  const pos = POSITIONS[position] || POSITIONS["bottom-right"];

  const node = (
    <div
      className={`fixed flex items-start gap-2.5 rounded-xl shadow-lg ${POSITION_CLASSES[position] ?? POSITION_CLASSES["bottom-right"]}`}
      style={{
        zIndex: TOAST_Z,
        ...pos,
        maxWidth: 380,
        padding: "12px 14px",
        background: v.background,
        border: `1px solid ${v.borderColor}`,
        color: v.color,
        boxShadow: "var(--shadow-pop)",
      }}
    >
      {Icon && (
        iconBadge ? (
          <span className="shrink-0 flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 8, background: "var(--accent-tint)", color: "var(--accent)" }}>
            <Icon size={14} />
          </span>
        ) : (
          <Icon size={15} className="shrink-0 mt-0.5" style={{ color: v.iconColor }} />
        )
      )}
      <div className="flex-1 min-w-0">
        {title && <div className="text-sm font-semibold mb-0.5">{title}</div>}
        {description && <div className="text-xs" style={{ color: "var(--text-dim)" }}>{description}</div>}
        {children && <div className="text-xs" style={{ color: variant === "danger" ? v.color : "var(--text-dim)" }}>{children}</div>}
        {action && (
          action.solid ? (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 text-xs font-bold mt-2 cursor-pointer"
              style={{ color: "var(--on-accent)", background: "var(--accent)", border: "none", borderRadius: 7, padding: "6px 12px" }}
            >
              {action.icon && <action.icon size={11} />}
              {action.label}
            </button>
          ) : (
            <button
              onClick={action.onClick}
              className="text-xs font-semibold mt-2 cursor-pointer"
              style={{ color: "var(--accent)", background: "none", border: "none", padding: 0 }}
            >
              {action.label}
            </button>
          )
        )}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0" style={{ color: v.iconColor, background: "none", border: "none", cursor: "pointer", padding: 0 }} aria-label="Fechar">
          <X size={14} />
        </button>
      )}
    </div>
  );

  // SSR/teste sem DOM: cai pro render inline em vez de quebrar.
  return typeof document === "undefined" ? node : createPortal(node, document.body);
}

export default AppToast;
