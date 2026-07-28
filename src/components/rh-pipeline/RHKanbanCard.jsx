import React, { memo, useRef, useState } from "react";
import { Check, X as XIcon } from "lucide-react";
import { MoveStageMenu } from "../shared/MoveStageMenu";
import { KanbanCardStatusChips } from "../shared/KanbanCardStatusChips";
import { terminalCardBackground, terminalAccentOpacity } from "../shared/terminal-card-style";

function stageKeyOf(s) {
  return s?.stageKey ?? s?.id;
}

function RHKanbanCardImpl({ id, stage, stages, onClick, onDragStart, onDragEnd, onMoveToStage, onDeleteCard, onDuplicateCard, deleteLabel, deleteConfirmMessage, agingDays, completeness, unread, children, showMoveOptions = true }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef(null);

  const currentStage = stages?.find(s => stageKeyOf(s) === stage);
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
        background: terminalCardBackground(isTerminal),
        border: "1px solid var(--border)",
        boxShadow: shadowBase,
        position: "relative",
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
              ? <Check size={13} strokeWidth={3} style={{ color: "#16A34A", opacity: terminalAccentOpacity(isTerminal) }} />
              : currentStage.lost
                ? <XIcon size={13} strokeWidth={3} style={{ color: "#DC2626", opacity: terminalAccentOpacity(isTerminal) }} />
                : null
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <KanbanCardStatusChips
            unread={unread}
            agingDays={agingDays}
            slaDays={currentStage?.slaDays}
            tightTracking
            completeness={completeness}
            completenessSize={26}
            muted={isTerminal}
          />
          {((moveTargets.length > 0 && onMoveToStage) || onDeleteCard || onDuplicateCard) && (
            <MoveStageMenu
              targets={moveTargets.map(s => {
                const dir = stages.findIndex(x => stageKeyOf(x) === stageKeyOf(s)) < stages.findIndex(x => stageKeyOf(x) === stage) ? "before" : "after";
                return { key: stageKeyOf(s), name: s.name, color: s.color, direction: dir };
              })}
              onMove={onMoveToStage ? (key) => onMoveToStage(id, key) : undefined}
              onDelete={onDeleteCard ? () => onDeleteCard(id) : undefined}
              onDuplicate={onDuplicateCard ? () => onDuplicateCard(id) : undefined}
              deleteLabel={deleteLabel}
              confirmMessage={deleteConfirmMessage}
              onOpenChange={setMenuOpen}
            />
          )}
        </div>
      </div>

      {/* `children` é o conteúdo específico de cada um dos 5 boards de RH
          (título, badges, avatares — definidos nos respectivos *View.jsx,
          fora do escopo deste componente-shell). Sem acesso ao que é texto
          vs. cor lá dentro, aplica a mesma opacity de acento aqui uma vez só
          — resultado equivalente ao tratamento por elemento dos outros 4
          cards, sem duplicar a lógica nos 5 arquivos de board. */}
      <div style={{ opacity: terminalAccentOpacity(isTerminal) }}>
        {children}
      </div>
    </div>
  );
}

export const RHKanbanCard = memo(RHKanbanCardImpl);
export default RHKanbanCard;
