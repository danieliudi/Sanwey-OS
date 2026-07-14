import React, { memo, useMemo, useRef, useState, useEffect } from "react";
import { Clock, MoreVertical, ArrowRight, Check, X as XIcon } from "lucide-react";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { CompletenessBadge } from "../ui/CompletenessBadge";
import { CompanyTag } from "../ui/CompanyTag";
import { AvatarStack } from "../shared/AvatarStack";
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

function LeadKanbanCardImpl({ lead, users, showOwnerFooter, isGroupView, onClick, onDragStart, onDragEnd, stages, onMoveToStage, completeness }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
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
          {moveTargets.length > 0 && onMoveToStage && (
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                title="Mover para outra etapa"
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  padding: 2,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  lineHeight: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    boxShadow: "var(--shadow-pop)",
                    zIndex: 50,
                    minWidth: 180,
                    overflow: "hidden",
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: "6px 12px 4px",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text-dim)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Mover para
                  </div>
                  {moveTargets.map(s => (
                    <button
                      key={s.id}
                      onClick={e => {
                        e.stopPropagation();
                        onMoveToStage(lead.id, s.id);
                        setMenuOpen(false);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "var(--text)",
                        textAlign: "left",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--accent)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text)"; }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: s.color,
                          flexShrink: 0,
                        }}
                      />
                      {s.name}
                      <ArrowRight size={11} style={{ marginLeft: "auto", opacity: 0.4 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
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
