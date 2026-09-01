import React from "react";
import { Clock, MessageCircle, ListChecks } from "lucide-react";
import { CompletenessBadge } from "../ui/CompletenessBadge";
import { StatusChip } from "./StatusChip";
import { terminalAccentOpacity } from "./terminal-card-style";

// Extraído de 4 cópias quase idênticas — RHKanbanCard, LeadKanbanCard,
// CampaignKanbanCard, DeliverableKanbanCard (auditoria cross-codebase,
// 22/07) — ver CLAUDE.md, "reaproveitamento obrigatório". Cada arquivo tinha
// sua própria função de threshold de cor + o mesmo JSX de chip. Só o
// CompletenessBadge em si já era compartilhado.
//
// ---------------------------------------------------------------------------
// DUAS VARIANTES (01/09/2026)
//
// `variant="default"` — o combo original, inalterado: chip de aging sempre
// presente (neutro quando dentro do prazo), anel de completude sempre que a
// etapa tem campos obrigatórios, badge redondo preenchido pro comentário não
// lido. Continua sendo o que RHKanbanCard/LeadKanbanCard/CampaignKanbanCard
// renderizam — não mexer neles aqui, é rollout separado (ver CLAUDE.md r. 3).
//
// `variant="quiet"` — desenho novo aprovado com o Daniel 01/09/2026, hoje só
// no DeliverableKanbanCard (Entregas, Tarefas de Marketing, Painel de
// Marketing). Regra: **cor significa exceção, nunca decoração**. Um card sem
// nada errado não renderiza chip nenhum daqui.
//   - aging  → só a partir de 70% do SLA da etapa (âmbar), vermelho ao
//              estourar. Dentro do prazo NÃO aparece (antes aparecia cinza).
//   - completude → só quando falta campo. Completo não pede ação de ninguém,
//              então some (antes ficava um anel verde permanente).
//   - unread → NÃO renderiza aqui. Virou ponto no avatar, no rodapé do card,
//              via prop `dot` do AvatarStack — quem chama com `variant="quiet"`
//              é responsável por isso e não deve passar `unread`.
// Use `hasQuietStatusChips(...)` pra saber se algo vai renderizar antes de
// desenhar o container do rodapé (senão sobra margem de um flex vazio).
// ---------------------------------------------------------------------------
//
// Tempo na etapa (neutro) vs. SLA estourado (âmbar/vermelho) — só fica
// âmbar/vermelho quando de fato passa do slaDays configurado pra etapa; sem
// SLA, ou dentro do prazo, é só um badge neutro (tempo decorrido).
function agingStyle(days, slaDays, dangerColor) {
  if (days == null || days <= 0) return null;
  if (slaDays) {
    const ratio = days / slaDays;
    if (ratio >= 1)   return { bg: "var(--danger-bg)", text: dangerColor, border: "color-mix(in srgb, var(--danger) 35%, transparent)" };
    if (ratio >= 0.7) return { bg: "var(--amber-bg)", text: "var(--amber)", border: "color-mix(in srgb, var(--amber) 35%, transparent)" };
  }
  return { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" };
}

// Mesmos limiares do agingStyle acima (0.7 e 1.0) — mas aqui "dentro do
// prazo" devolve null em vez do estado neutro, que é toda a diferença da
// variante quiet.
function quietAgingTone(days, slaDays) {
  if (days == null || days <= 0 || !slaDays) return null;
  const ratio = days / slaDays;
  if (ratio >= 1)   return "danger";
  if (ratio >= 0.7) return "warning";
  return null;
}

function quietIncomplete(completeness) {
  return Boolean(completeness && completeness.total > 0 && completeness.filled < completeness.total);
}

// Predicado pro chamador decidir se desenha o container do rodapé. Recebe as
// mesmas props do componente — mantidos juntos de propósito, pra não
// divergirem quando um limiar mudar.
export function hasQuietStatusChips({ agingDays, slaDays, completeness } = {}) {
  return Boolean(quietAgingTone(agingDays, slaDays)) || quietIncomplete(completeness);
}

// Combo padrão de status do card do Kanban: indicador de comentário não lido
// + chip de aging/SLA (relógio + "Xd") + badge de completude (anel
// "filled/total", componente já compartilhado). Renderiza nesta ordem fixa:
// unread → children → aging → completude.
//
// `children` existe só pro CampaignKanbanCard: lá o badge "URGENTE"
// (lançamento em ≤7 dias) precisa ficar entre o unread e o aging na mesma
// ordem de hoje, e ele substitui o aging chip quando ativo (por isso o
// chamador passa agingDays=null nesse caso) — não é um slot genérico, é
// só o jeito de preservar a ordem exata sem duplicar o restante do combo.
//
// dangerColor/tightTracking são as únicas duas diferenças reais que já
// existiam entre as 4 cópias antes deste refactor (Campaign usava
// var(--danger) em vez do #DC2626 hardcoded dos outros 3; só RH/Lead tinham
// letterSpacing no chip) — viraram prop pra não mudar o visual de nenhum
// dos 4 cards. Não é uma decisão nova de estilo, é preservação do que já
// estava divergente.
//
// `muted` (etapa terminal — ver src/components/shared/terminal-card-style.js):
// aplica a mesma opacity reduzida nos 3 chips coloridos daqui (unread, aging,
// completude), sem tocar no card/coluna em volta. Único ponto de verdade pros
// 4 cards que já reusam este componente — não recalcule o valor no chamador.
export function KanbanCardStatusChips({
  unread,
  agingDays,
  slaDays,
  agingTitle,
  dangerColor = "var(--danger)",
  tightTracking = false,
  completeness,
  completenessSize = 26,
  muted = false,
  variant = "default",
  children,
}) {
  const accentOpacity = terminalAccentOpacity(muted);

  if (variant === "quiet") {
    const tone = quietAgingTone(agingDays, slaDays);
    return (
      <>
        {quietIncomplete(completeness) && (
          <StatusChip
            tone="warning"
            icon={ListChecks}
            opacity={accentOpacity}
            title={`${completeness.filled}/${completeness.total} campos obrigatórios preenchidos`}
          >
            {completeness.filled}/{completeness.total}
          </StatusChip>
        )}
        {children}
        {tone && (
          <StatusChip
            tone={tone}
            icon={Clock}
            opacity={accentOpacity}
            title={agingTitle ?? `${agingDays} dias nesta etapa`}
          >
            {agingDays}d
          </StatusChip>
        )}
      </>
    );
  }

  const ageStyle = agingStyle(agingDays, slaDays, dangerColor);

  return (
    <>
      {unread && (
        <span
          title="Comentário novo"
          className="inline-flex items-center justify-center rounded-full"
          style={{ width: 16, height: 16, background: "var(--accent)", color: "var(--on-accent)", opacity: accentOpacity }}
        >
          <MessageCircle size={9} strokeWidth={2.5} fill="currentColor" />
        </span>
      )}
      {children}
      {ageStyle && (
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold"
          style={{
            fontSize: 10,
            background: ageStyle.bg,
            color: ageStyle.text,
            border: `1px solid ${ageStyle.border}`,
            opacity: accentOpacity,
            ...(tightTracking ? { letterSpacing: "-0.01em" } : null),
          }}
          title={agingTitle ?? `${agingDays} dias nesta etapa`}
        >
          <Clock size={8} strokeWidth={2.5} />
          {agingDays}d
        </span>
      )}
      {completeness?.total > 0 && (
        <span className="inline-flex" style={{ opacity: accentOpacity }}>
          <CompletenessBadge filled={completeness.filled} total={completeness.total} size={completenessSize} />
        </span>
      )}
    </>
  );
}

export default KanbanCardStatusChips;
