import React, { memo, useMemo, useRef, useState } from "react";
import { Check, X as XIcon } from "lucide-react";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { CompanyTag } from "../ui/CompanyTag";
import { AvatarStack } from "../shared/AvatarStack";
import { MoveStageMenu } from "../shared/MoveStageMenu";
import { KanbanCardStatusChips } from "../shared/KanbanCardStatusChips";
import { formatK } from "../../utils/currency";
import { formatDateBR, closeDateUrgencyStyle } from "../../utils/date";

function daysFromDate(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

// Renderiza um dos campos escolháveis em stage.cardPreviewFields (item
// "preview de campo configurável" do comparativo com o Pipefy) — retorna
// null quando o lead não tem valor pro campo, pra a chamadora pular sem
// deixar separador órfão. Mantém a mesma paleta já usada no resto do card.
function renderPreviewField(key, lead, { probDisplay, closeStyle }) {
  switch (key) {
    case "value":
      return lead.value > 0 ? { text: formatK(lead.value), color: "#15803D", weight: 600 } : null;
    case "probability":
      return Number.isFinite(lead.probability) ? { text: `${probDisplay}%`, color: "var(--text-dim)" } : null;
    case "closeDate":
      if (!lead.closeDate) return null;
      return closeStyle
        ? { text: formatDateBR(lead.closeDate), pill: closeStyle }
        : { text: formatDateBR(lead.closeDate), color: "var(--text-dim)" };
    case "sector":
      return lead.sector ? { text: lead.sector, color: "var(--text-dim)" } : null;
    case "city":
      return lead.city ? { text: lead.city, color: "var(--text-dim)" } : null;
    case "decisionMaker":
      return (lead.decisionMaker?.name && lead.decisionMaker.name !== "—") ? { text: lead.decisionMaker.name, color: "var(--text-dim)" } : null;
    default:
      return null;
  }
}

function LeadKanbanCardImpl({ lead, users, showOwnerFooter, isGroupView, onClick, onDragStart, onDragEnd, stages, onMoveToStage, onDeleteCard, completeness, unread, pipelineTransitions, showMoveOptions = true }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef(null);

  // FASE 5: mais de um responsável por card — resolve owner_ids (com
  // fallback pro owner escalar em leads legados) contra a lista de
  // usuários pra alimentar o AvatarStack do rodapé.
  const resolvedOwners = useMemo(() => {
    const ids = Array.isArray(lead.ownerIds) && lead.ownerIds.length ? lead.ownerIds : (lead.owner ? [lead.owner] : []);
    return ids.map(id => (users || []).find(u => u.id === id)).filter(Boolean);
  }, [lead.ownerIds, lead.owner, users]);

  const currentStage = stages?.find(s => s.id === lead.stage);
  const daysInStage = daysFromDate(lead.stageChangedAt);
  const probDisplay = lead.probability > 1
    ? Math.round(lead.probability)
    : Math.round(lead.probability * 100);

  // Restringe o menu "..." às transições configuradas em Comercial > Editar
  // etapas — mesma regra que já bloqueia o drop no drag-and-drop (ver
  // CRMView.jsx); sem regra configurada, permanece aberto (comportamento
  // anterior).
  //
  // showMoveOptions=false no board desktop (drag-and-drop já cobre mover) —
  // o card então só oferece excluir, com um ícone de lixeira direto no lugar
  // dos "3 pontinhos" (ver MoveStageMenu). O card mobile (acordeão, sem
  // drag) continua passando showMoveOptions=true, único jeito de mover lá.
  const moveTargets = showMoveOptions && stages
    ? stages.filter(s =>
        s.id !== lead.stage && !s.terminal &&
        (!pipelineTransitions || pipelineTransitions.isTransitionAllowed(lead.companyId, lead.stage, s.id))
      )
    : [];

  // Card de etapa terminal (ganho/perdido) fica visualmente "arquivado" —
  // menos ênfase que os cards ainda em jogo, com um selo do resultado.
  const isTerminal = Boolean(currentStage?.terminal);
  const closeStyle = !isTerminal ? closeDateUrgencyStyle(lead.closeDate) : null;

  const shadowBase  = `var(--shadow-card)`;
  const shadowHover = `var(--shadow-pop)`;

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={() => onDragStart?.(lead)}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => { if (!menuOpen) onClick?.(lead); }}
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
      {/* Company + aging badge + score + menu */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-[13px] leading-snug flex-1 flex items-start gap-1.5" style={{ color: "var(--text)", minHeight: 34 }}>
          {isTerminal && (
            currentStage.won
              ? <Check size={13} strokeWidth={3} style={{ color: "#16A34A", flexShrink: 0, marginTop: 1 }} />
              : <XIcon size={13} strokeWidth={3} style={{ color: "#DC2626", flexShrink: 0, marginTop: 1 }} />
          )}
          <span className="line-clamp-2">{lead.company}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <KanbanCardStatusChips
            unread={unread}
            agingDays={daysInStage}
            slaDays={currentStage?.slaDays}
            tightTracking
            completeness={completeness}
            completenessSize={30}
          />
          <FitScoreCircle score={lead.fitScore} size={30} />
          {((moveTargets.length > 0 && onMoveToStage) || onDeleteCard) && (
            <MoveStageMenu
              targets={moveTargets.map(s => ({ key: s.id, name: s.name, color: s.color }))}
              onMove={onMoveToStage ? (key) => onMoveToStage(lead.id, key) : undefined}
              onDelete={onDeleteCard ? () => onDeleteCard(lead.id) : undefined}
              onOpenChange={setMenuOpen}
            />
          )}
        </div>
      </div>

      {/* SKU — só ocupa espaço quando existe; antes ficava uma linha vazia
          (com margem) em todo card sem SKU, quebrando o ritmo vertical entre
          cards de um mesmo board. */}
      {lead.skuName && (
        <div className="text-xs mb-2.5 line-clamp-1" style={{ color: "var(--text-dim)" }}>
          {lead.skuName}
        </div>
      )}

      {/* Preview de campos — configurável por etapa (Editar fase); sem
          config, mantém o trio fixo valor/probabilidade/fechamento de
          sempre, pra não regredir o visual do caso comum. */}
      {Array.isArray(currentStage?.cardPreviewFields) && currentStage.cardPreviewFields.length > 0 ? (
        <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs">
          {currentStage.cardPreviewFields.map(key => {
            const f = renderPreviewField(key, lead, { probDisplay, closeStyle });
            if (!f) return null;
            return f.pill ? (
              <span
                key={key}
                className="px-1 py-0.5 rounded font-bold"
                style={{ background: f.pill.bg, color: f.pill.text, border: `1px solid ${f.pill.border}` }}
              >
                {f.text}
              </span>
            ) : (
              <span key={key} style={{ color: f.color, fontWeight: f.weight }}>{f.text}</span>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold" style={{ color: "var(--text)" }}>
            {formatK(lead.value)}
          </span>
          <span style={{ color: "var(--text-dim)" }}>
            {probDisplay}%{" "}·{" "}
            {closeStyle ? (
              <span
                className="px-1 py-0.5 rounded font-bold"
                style={{
                  background: closeStyle.bg,
                  color: closeStyle.text,
                  border: `1px solid ${closeStyle.border}`,
                }}
              >
                {formatDateBR(lead.closeDate)}
              </span>
            ) : (
              formatDateBR(lead.closeDate)
            )}
          </span>
        </div>
      )}

      {/* Owner footer */}
      {showOwnerFooter && resolvedOwners.length > 0 && (
        <div
          className="mt-2.5 pt-2 border-t text-[11px] flex items-center justify-between"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
        >
          <AvatarStack users={resolvedOwners} size={18} max={3} />
          {isGroupView && <CompanyTag companyId={lead.companyId} />}
        </div>
      )}
    </div>
  );
}

export const LeadKanbanCard = memo(LeadKanbanCardImpl);
export default LeadKanbanCard;
