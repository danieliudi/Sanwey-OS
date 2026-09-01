import React from "react";

// Chip de status do card do Kanban — forma ÚNICA pra todo sinal (prazo, SLA,
// completude, prioridade). Decidido com o Daniel 01/09/2026, "direção C" do
// mockup de redesenho do card.
//
// O problema que resolve: cada sinal tinha forma, altura e peso próprios
// (círculo preenchido pro comentário, pill com fundo pra prioridade, anel SVG
// pra completude, texto solto pro SLA). Três deles lado a lado no rodapé não
// pareciam um conjunto — pareciam sobras encostadas na direita, sem rótulo,
// e o usuário tinha que decodificar em vez de ler. Ícone + valor, mesma
// altura e mesmo raio, viram um conjunto legível.
//
// **Contorno é o padrão.** `tone="solid"` existe pra exatamente UM caso na
// plataforma hoje — prazo vencido (ver DeliverableKanbanCard) — e é o único
// elemento preenchido do card inteiro. É isso que faz o atraso saltar. Não
// use `solid` em mais nada sem decidir antes: dois preenchidos no mesmo card
// anulam o efeito e o card volta a ser o que era.
//
// A regra que acompanha este componente e vale pra todo chamador: **fora da
// condição de exceção, o chip não renderiza** — não fica cinza, não fica
// vazio, não existe. Card saudável fica sem chip nenhum além do prazo.
const TONES = {
  neutral: {
    background: "transparent",
    border: "var(--border-strong)",
    color: "var(--text-dim)",
  },
  warning: {
    background: "transparent",
    border: "color-mix(in srgb, var(--amber) 40%, transparent)",
    color: "var(--amber)",
  },
  danger: {
    background: "transparent",
    border: "color-mix(in srgb, var(--danger) 40%, transparent)",
    color: "var(--danger)",
  },
  solid: {
    background: "var(--danger)",
    border: "var(--danger)",
    color: "var(--on-danger)",
  },
};

export function StatusChip({
  tone = "neutral",
  icon: Icon,
  size = "normal",
  title,
  opacity = 1,
  children,
}) {
  const t = TONES[tone] || TONES.neutral;
  const tiny = size === "tiny";

  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-md font-semibold shrink-0 whitespace-nowrap"
      style={{
        height: tiny ? 17 : 19,
        padding: tiny ? "0 5px" : "0 6px",
        fontSize: tiny ? 9.5 : 10.5,
        letterSpacing: tiny ? "0.04em" : undefined,
        textTransform: tiny ? "uppercase" : undefined,
        background: t.background,
        border: `1px solid ${t.border}`,
        color: t.color,
        fontVariantNumeric: "tabular-nums",
        opacity,
      }}
    >
      {Icon ? <Icon size={10} strokeWidth={2.4} /> : null}
      {children}
    </span>
  );
}

export default StatusChip;
