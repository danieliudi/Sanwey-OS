import React, { memo, useMemo, useRef, useState } from "react";
import { Clock, Check, X as XIcon } from "lucide-react";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { CompletenessBadge } from "../ui/CompletenessBadge";
import { CompanyTag } from "../ui/CompanyTag";
import { AvatarStack } from "../shared/AvatarStack";
import { MoveStageMenu } from "../shared/MoveStageMenu";
import { formatK } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";

function daysFromDate(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

// Tempo na etapa (neutro, informativo) vs. SLA estourado (vermelho) — antes
// os 3 tons (verde/âmbar/vermelho) eram só por dias corridos fixos (7/21),
// sem nenhuma relação com o slaDays real de cada etapa. Agora só fica
// vermelho/âmbar quando de fato passa do slaDays configurado; sem SLA
// definido, ou dentro do prazo, é só um badge neutro (tempo decorrido).
function agingStyle(days, slaDays) {
  if (days <= 0) return null;
  if (slaDays) {
    const ratio = days / slaDays;
    if (ratio >= 1)   return { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" };
    if (ratio >= 0.7) return { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" };
  }
  return { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" };
}

function LeadKanbanCardImpl({ lead, users, showOwnerFooter, isGroupView, onClick, onDragStart, onDragEnd, stages, onMoveToStage, onDeleteCard, completeness }) {
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
  const ageStyle = daysInStage !== null ? agingStyle(daysInStage, currentStage?.slaDays) : null;
  const probDisplay = lead.probability > 1
    ? Math.round(lead.probability)
    : Math.round(lead.probability * 100);

  const moveTargets = stages
    ? stages.filter(s => s.id !== lead.stage && !s.terminal)
    : [];

  // Card de etapa terminal (ganho/perdido) fica visualmente "arquivado" —
  // menos ênfase que os cards ainda em jogo, com um selo do resultado.
  const isTerminal = Boolean(currentStage?.terminal);

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
              title={`${daysInStage} dias nesta etapa`}
            >
              <Clock size={8} strokeWidth={2.5} />
              {daysInStage}d
            </span>
          )}
          {completeness?.total > 0 && (
            <CompletenessBadge filled={completeness.filled} total={completeness.total} size={30} />
          )}
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

      {/* Value + probability + close date */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold" style={{ color: "var(--text)" }}>
          {formatK(lead.value)}
        </span>
        <span style={{ color: "var(--text-dim)" }}>
          {probDisplay}% · {formatDateBR(lead.closeDate)}
        </span>
      </div>

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
