import React from "react";
import { Clock, MessageCircle } from "lucide-react";
import { CompletenessBadge } from "../ui/CompletenessBadge";

// Extraído de 4 cópias quase idênticas — RHKanbanCard, LeadKanbanCard,
// CampaignKanbanCard, DeliverableKanbanCard (auditoria cross-codebase,
// 22/07) — ver CLAUDE.md, "reaproveitamento obrigatório". Cada arquivo tinha
// sua própria função de threshold de cor + o mesmo JSX de chip. Só o
// CompletenessBadge em si já era compartilhado.
//
// Tempo na etapa (neutro) vs. SLA estourado (âmbar/vermelho) — só fica
// âmbar/vermelho quando de fato passa do slaDays configurado pra etapa; sem
// SLA, ou dentro do prazo, é só um badge neutro (tempo decorrido).
function agingStyle(days, slaDays, dangerColor) {
  if (days == null || days <= 0) return null;
  if (slaDays) {
    const ratio = days / slaDays;
    if (ratio >= 1)   return { bg: "#FEE2E2", text: dangerColor, border: "#FECACA" };
    if (ratio >= 0.7) return { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" };
  }
  return { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" };
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
export function KanbanCardStatusChips({
  unread,
  agingDays,
  slaDays,
  agingTitle,
  dangerColor = "#DC2626",
  tightTracking = false,
  completeness,
  completenessSize = 26,
  children,
}) {
  const ageStyle = agingStyle(agingDays, slaDays, dangerColor);

  return (
    <>
      {unread && (
        <span
          title="Comentário novo"
          className="inline-flex items-center justify-center rounded-full"
          style={{ width: 16, height: 16, background: "var(--accent)", color: "#FFF" }}
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
            ...(tightTracking ? { letterSpacing: "-0.01em" } : null),
          }}
          title={agingTitle ?? `${agingDays} dias nesta etapa`}
        >
          <Clock size={8} strokeWidth={2.5} />
          {agingDays}d
        </span>
      )}
      {completeness?.total > 0 && (
        <CompletenessBadge filled={completeness.filled} total={completeness.total} size={completenessSize} />
      )}
    </>
  );
}

export default KanbanCardStatusChips;
