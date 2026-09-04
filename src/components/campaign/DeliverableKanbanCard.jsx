import React, { memo, useMemo, useRef, useState } from "react";
import { Star, Calendar, MessageCircle } from "lucide-react";
import { DELIVERABLE_STAGES, CHANNEL_COLORS } from "../../constants/marketing-pipelines";
import { formatDateBR, formatDateShortBR, daysSince } from "../../utils/date";
import { AvatarStack } from "../shared/AvatarStack";
import { MoveStageMenu } from "../shared/MoveStageMenu";
import { KanbanCardStatusChips, hasQuietStatusChips } from "../shared/KanbanCardStatusChips";
import { StatusChip } from "../shared/StatusChip";
import { terminalCardBackground, terminalTextColor, terminalAccentOpacity } from "../shared/terminal-card-style";

function daysFromDate(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

// Tinta do chip de prazo. Mesmos limiares do `closeDateUrgencyStyle` do Funil
// (vencido / faltando ≤7 dias / resto) pra não divergir o conceito de
// "urgente" entre os dois boards — mas aqui o vencido é `solid`, o ÚNICO
// elemento preenchido do card (decisão do Daniel 01/09/2026: "o único chip
// preenchido tem que ser a data de vencimento, para sinalizar bem o atraso").
function deadlineTone(deadline) {
  const days = daysSince(deadline);
  if (days > 0)   return "solid";
  if (days >= -7) return "warning";
  return "neutral";
}

function DeliverableKanbanCardImpl({
  item, users, onClick, onDragStart, onDragEnd,
  stages, onMoveToStage, onDeleteCard, onDuplicateCard, canWrite, onToggleStar, completeness, unread,
  campaignsById, showMoveOptions = true,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const cardRef = useRef(null);

  // FASE 5: mais de um responsável por entrega — resolve assignee_ids (com
  // fallback pro assignee escalar em entregas legadas) contra a lista de
  // usuários pro AvatarStack compacto do rodapé.
  const resolvedAssignees = useMemo(() => {
    const ids = item.assigneeIds?.length ? item.assigneeIds : (item.assignee ? [item.assignee] : []);
    return ids.map(id => (users || []).find(u => u.id === id)).filter(Boolean);
  }, [item.assigneeIds, item.assignee, users]);

  const stage       = (stages || DELIVERABLE_STAGES).find(s => s.id === item.stage);
  const daysInStage = daysFromDate(item.stageChangedAt);
  const isTerminal  = Boolean(stage?.terminal);
  const accentOp    = terminalAccentOpacity(isTerminal);
  const campaign    = item.campaignId ? campaignsById?.get(item.campaignId) : null;
  // Só "alta" desenha algo. "Média" é o padrão de quem abre a solicitação e
  // não carrega informação nenhuma; "baixa" idem, no outro sentido — um pill
  // em todo card fazia os três estados parecerem igualmente dignos de nota.
  const isHighPriority = item.priority === "alta";
  // showMoveOptions=false no board desktop (drag-and-drop já cobre mover) —
  // o card então só oferece excluir, com um ícone de lixeira direto no lugar
  // dos "3 pontinhos" (ver MoveStageMenu). O acordeão mobile (sem drag)
  // continua com showMoveOptions=true (default), único jeito de mover lá.
  const moveTargets = showMoveOptions
    ? (stages || DELIVERABLE_STAGES).filter(s => s.id !== item.stage && !s.terminal)
    : [];

  // Comentário não lido vira ponto na quina do avatar (ver AvatarStack). Sem
  // responsável atribuído não há avatar onde pendurar o ponto — nesse caso o
  // sinal cai de volta pra um chip da mesma família, em vez de sumir.
  const unreadNeedsChip = Boolean(unread) && resolvedAssignees.length === 0;
  const hasFooter =
    resolvedAssignees.length > 0 ||
    unreadNeedsChip ||
    Boolean(item.deadline) ||
    hasQuietStatusChips({ agingDays: daysInStage, slaDays: stage?.sla, completeness });

  return (
    <div
      ref={cardRef}
      draggable={canWrite}
      onDragStart={() => {
        if (!canWrite) return;
        setDragging(true);
        onDragStart?.(item);
      }}
      onDragEnd={() => { setDragging(false); onDragEnd?.(); }}
      onClick={() => { if (!menuOpen) onClick?.(item); }}
      className={`p-3.5 rounded-lg cursor-pointer polish-kanban-card${dragging ? " is-dragging" : ""}`}
      style={{
        background: terminalCardBackground(isTerminal),
        border: "1px solid var(--border)",
        position: "relative",
      }}
    >
      {/* Linha 1 — identidade do registro (o que ele É): protocolo e
          prioridade à esquerda, utilitários à direita. Os sinais de estado
          (o que ele ESTÁ) desceram todos pro rodapé; separar os dois é o que
          dá uma lógica de leitura ao card.

          Esta linha também é a correção do bug reportado pelo Daniel em
          01/09/2026: o protocolo dividia a coluna esquerda com o título e
          disputava largura com um grupo de 6 chips `shrink-0` à direita, e
          em coluna estreita o texto escapava da própria caixa e corria por
          baixo do badge de comentário. Agora o título tem linha inteira e
          esta linha carrega só 4 elementos curtos — o `overflow-hidden`
          abaixo é cinto de segurança, não deve chegar a atuar. */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden">
          {item.requestNumber && (
            <span
              className="font-mono text-[10.5px] font-medium shrink-0"
              style={{ color: "var(--text-faint)", letterSpacing: "0.03em", opacity: accentOp }}
            >
              {item.requestNumber}
            </span>
          )}
          {isHighPriority && (
            <StatusChip tone="danger" size="tiny" opacity={accentOp} title="Prioridade alta">
              Alta
            </StatusChip>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {canWrite && onToggleStar ? (
            <button
              onClick={e => { e.stopPropagation(); onToggleStar?.(item.id); }}
              title={item.starred ? "Remover dos favoritos" : "Favoritar"}
              className="flex items-center justify-center rounded-md p-1 transition-colors"
              style={{ color: item.starred ? "var(--amber)" : "var(--text-faint)", background: "transparent", border: "none", opacity: accentOp }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <Star size={12} fill={item.starred ? "var(--amber)" : "none"} />
            </button>
          ) : (
            item.starred && <Star size={11} fill="var(--amber)" color="var(--amber)" style={{ opacity: accentOp }} />
          )}
          {canWrite && ((moveTargets.length > 0 && onMoveToStage) || onDeleteCard || onDuplicateCard) && (
            <MoveStageMenu
              targets={moveTargets.map(s => {
                const list = stages || DELIVERABLE_STAGES;
                const dir = list.findIndex(x => x.id === s.id) < list.findIndex(x => x.id === item.stage) ? "before" : "after";
                return { key: s.id, name: s.name, color: s.color, direction: dir };
              })}
              onMove={onMoveToStage ? (key) => onMoveToStage(item.id, key) : undefined}
              onDelete={onDeleteCard ? () => onDeleteCard(item.id) : undefined}
              onDuplicate={onDuplicateCard ? () => onDuplicateCard(item.id) : undefined}
              onOpenChange={setMenuOpen}
            />
          )}
        </div>
      </div>

      {/* Título — linha inteira, o elemento mais forte do card */}
      <div className="font-semibold text-[13px] leading-snug line-clamp-2 mt-0.5" style={{ color: terminalTextColor(isTerminal) }}>
        {item.title}
      </div>

      {/* Requester · dept */}
      {item.requesterName && (
        <div className="text-[11px] mt-1.5" style={{ color: "var(--text-dim)" }}>
          {item.requesterName}{item.department ? ` · ${item.department}` : ""}
        </div>
      )}

      {/* Campanha vinculada — mesmo tratamento discreto da tag de empresa do
          CampaignKanbanCard; sem campaign_id, não renderiza nada (sem
          placeholder "Sem campanha"). */}
      {campaign && (
        <span
          className="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold mt-1.5 truncate max-w-full"
          style={{
            background: (CHANNEL_COLORS[campaign.channel] || { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" }).bg,
            color:      (CHANNEL_COLORS[campaign.channel] || { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" }).text,
            border:     `1px solid ${(CHANNEL_COLORS[campaign.channel] || { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" }).border}`,
          }}
          title={campaign.name}
        >
          {campaign.name}
        </span>
      )}

      {/* Linha 2 — estado do registro (o que ele ESTÁ): responsáveis à
          esquerda, sinais à direita, todos na mesma forma de chip. Cada chip
          só existe quando há exceção — card em dia fica só com o prazo, e
          card sem prazo nem responsável não desenha esta linha. */}
      {hasFooter && (
        <div className="flex items-center justify-between gap-2 mt-2.5">
          {resolvedAssignees.length > 0 ? (
            <AvatarStack
              users={resolvedAssignees}
              // 24, não 28: com dois responsáveis + os três chips de status
              // faltavam 0,9px pra linha caber, e o rodapé quebrava em duas
              // linhas (medido com Playwright, 01/09/2026). O mockup aprovado
              // usava 22 — 24 devolve 6,6px e mantém o avatar legível.
              size={24}
              max={2}
              dot={Boolean(unread)}
              dotTitle="Comentário novo"
            />
          ) : unreadNeedsChip ? (
            <StatusChip tone="danger" icon={MessageCircle} opacity={accentOp} title="Comentário novo">
              Novo
            </StatusChip>
          ) : (
            <span />
          )}
          {/* `flex-wrap` + `min-w-0` em vez de `shrink-0`: com prazo, SLA e
              completude ao mesmo tempo numa coluna estreita, o grupo passava
              da borda do card e vazava pra fora (bug reportado pelo Daniel,
              01/09/2026). Degradar pra uma segunda linha é feio; vazar o card
              é quebrado. */}
          <div className="flex items-center justify-end flex-wrap gap-1.5 min-w-0">
            <KanbanCardStatusChips
              variant="quiet"
              agingDays={daysInStage}
              slaDays={stage?.sla}
              completeness={completeness}
              muted={isTerminal}
            />
            {item.deadline && (
              <StatusChip
                tone={deadlineTone(item.deadline)}
                icon={Calendar}
                opacity={accentOp}
                title={`Prazo: ${formatDateBR(item.deadline)}`}
              >
                {formatDateShortBR(item.deadline)}
              </StatusChip>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export const DeliverableKanbanCard = memo(DeliverableKanbanCardImpl);
