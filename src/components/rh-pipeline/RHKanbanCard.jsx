import React, { memo, useRef, useState } from "react";
import { Clock, Check, X as XIcon, MessageCircle } from "lucide-react";
import { CompletenessBadge } from "../ui/CompletenessBadge";
import { MoveStageMenu } from "../shared/MoveStageMenu";

// Tempo na etapa (neutro) vs. SLA estourado (vermelho) — só fica âmbar/
// vermelho quando de fato passa do slaDays configurado pra etapa; sem SLA,
// ou dentro do prazo, é só um badge neutro (tempo decorrido).
function agingStyle(days, slaDays) {
  if (days <= 0) return null;
  if (slaDays) {
    const ratio = days / slaDays;
    if (ratio >= 1)   return { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" };
    if (ratio >= 0.7) return { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" };
  }
  return { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" };
}

function stageKeyOf(s) {
  return s?.stageKey ?? s?.id;
}

function RHKanbanCardImpl({ id, stage, stages, onClick, onDragStart, onDragEnd, onMoveToStage, onDeleteCard, deleteLabel, deleteConfirmMessage, agingDays, completeness, unread, children, showMoveOptions = true }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef(null);

  const currentStage = stages?.find(s => stageKeyOf(s) === stage);
  const ageStyle = agingDays != null ? agingStyle(agingDays, currentStage?.slaDays) : null;
  const isTerminal = Boolean(currentStage?.terminal);

  // showMoveOptions=false no board desktop (drag-and-drop já cobre mover) —
  // o "..." vira lixeira direta (ver MoveStageMenu). O acordeão mobile, sem
  // drag, continua passando showMoveOptions=true.
  const moveTargets = showMoveOptions && stages
    ? stages.filter(s => stageKeyOf(s) !== stage && !s.terminal)
    : [];

  const shadowBase  = `var(--shadow-card)`;
  const shadowHover = `var(--shadow-pop)`;

  return (
    <div
      ref={cardRef}
      draggable={!!onDragStart}
      onDragStart={() => onDragStart?.(id)}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => { if (!menuOpen) onClick?.(id); }}
      className="p-3.5 rounded-lg cursor-pointer transition-all duration-150"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: shadowBase,
        position: "relative",
        opacity: isTerminal ? 0.6 : 1,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = shadowHover;
        e.currentTarget.style.borderColor = "var(--border-strong)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = shadowBase;
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Selo de etapa terminal (esquerda) + aging badge/menu (direita) */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center shrink-0">
          {isTerminal && (
            currentStage.won
              ? <Check size={13} strokeWidth={3} style={{ color: "#16A34A" }} />
              : currentStage.lost
                ? <XIcon size={13} strokeWidth={3} style={{ color: "#DC2626" }} />
                : null
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {unread && (
            <span
              title="Comentário novo"
              className="inline-flex items-center justify-center rounded-full"
              style={{ width: 16, height: 16, background: "var(--accent)", color: "#FFF" }}
            >
              <MessageCircle size={9} strokeWidth={2.5} fill="currentColor" />
            </span>
          )}
          {ageStyle && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold"
              style={{
                fontSize: 10,
                background: ageStyle.bg,
                color: ageStyle.text,
                border: `1px solid ${ageStyle.border}`,
                letterSpacing: "-0.01em",
              }}
              title={`${agingDays} dias nesta etapa`}
            >
              <Clock size={8} strokeWidth={2.5} />
              {agingDays}d
            </span>
          )}
          {completeness?.total > 0 && (
            <CompletenessBadge filled={completeness.filled} total={completeness.total} size={26} />
          )}
          {((moveTargets.length > 0 && onMoveToStage) || onDeleteCard) && (
            <MoveStageMenu
              targets={moveTargets.map(s => ({ key: stageKeyOf(s), name: s.name, color: s.color }))}
              onMove={onMoveToStage ? (key) => onMoveToStage(id, key) : undefined}
              onDelete={onDeleteCard ? () => onDeleteCard(id) : undefined}
              deleteLabel={deleteLabel}
              confirmMessage={deleteConfirmMessage}
              onOpenChange={setMenuOpen}
            />
          )}
        </div>
      </div>

      {children}
    </div>
  );
}

export const RHKanbanCard = memo(RHKanbanCardImpl);
export default RHKanbanCard;
