import React, { memo, useEffect, useRef, useState } from "react";
import { Clock, Star, MoreVertical, ArrowRight } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { DELIVERABLE_STAGES, DELIVERABLE_PRIORITIES } from "../../constants/marketing-pipelines";
import { formatDateBR } from "../../utils/date";
import { CompletenessBadge } from "../ui/CompletenessBadge";

const PRIORITY_COLORS = { baixa: "#16A34A", media: "#D97706", alta: "#DC2626" };
const PRIORITY_LABELS = { baixa: "Baixa",   media: "Média",   alta: "Alta"  };

function daysFromDate(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

// Tempo na etapa (neutro) vs. SLA estourado (vermelho) — só fica âmbar/
// vermelho de fato passando do SLA da etapa; sem SLA, ou dentro do prazo, é
// só um badge neutro (tempo decorrido).
function agingStyle(days, sla) {
  if (days <= 0) return null;
  if (sla) {
    const ratio = days / sla;
    if (ratio >= 1)   return { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" };
    if (ratio >= 0.7) return { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" };
  }
  return { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" };
}

function DeliverableKanbanCardImpl({
  item, ownerName, onClick, onDragStart, onDragEnd,
  stages, onMoveToStage, canWrite, onToggleStar, completeness,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const stage       = (stages || DELIVERABLE_STAGES).find(s => s.id === item.stage);
  const daysInStage = daysFromDate(item.stageChangedAt);
  const ageStyle    = daysInStage !== null ? agingStyle(daysInStage, stage?.sla) : null;
  const isTerminal  = Boolean(stage?.terminal);
  const priColor    = PRIORITY_COLORS[item.priority] || null;
  const compColor   = item.companyIds?.[0] ? COMPANIES[item.companyIds[0]]?.primary : NEUTRAL.slate;
  const isOverdue   = item.deadline && new Date(item.deadline) < new Date();
  const moveTargets = (stages || DELIVERABLE_STAGES).filter(s => s.id !== item.stage && !s.terminal);

  const shadowBase  = `inset 3px 0 0 ${compColor}, 0 1px 4px rgba(32,26,26,0.06)`;
  const shadowHover = `inset 3px 0 0 ${compColor}, 0 4px 16px rgba(32,26,26,0.10)`;

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
      draggable={canWrite}
      onDragStart={() => canWrite && onDragStart?.(item)}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => { if (!menuOpen) onClick?.(item); }}
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
      {/* Title + badges + priority + star + move-menu — mesma ordem/posição
          (aging, completude, domínio, utilitários) dos outros cards do
          Kanban; antes ficava dividido entre topo e rodapé do card. */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-[13px] leading-snug min-w-0 flex-1" style={{ color: NEUTRAL.graphite }}>
          {item.title}
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {ageStyle && daysInStage !== null && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold"
              style={{ fontSize: 10, background: ageStyle.bg, color: ageStyle.text, border: `1px solid ${ageStyle.border}` }}
              title={`${daysInStage} dias nesta etapa`}
            >
              <Clock size={8} strokeWidth={2.5} />
              {daysInStage}d
            </span>
          )}
          {completeness?.total > 0 && (
            <CompletenessBadge filled={completeness.filled} total={completeness.total} size={22} />
          )}
          {priColor && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-md font-bold"
              style={{ fontSize: 10, background: priColor + "18", color: priColor, border: `1px solid ${priColor}40` }}
            >
              {PRIORITY_LABELS[item.priority]}
            </span>
          )}
          {canWrite && onToggleStar ? (
            <button
              onClick={e => { e.stopPropagation(); onToggleStar?.(item.id); }}
              title={item.starred ? "Remover dos favoritos" : "Favoritar"}
              className="flex items-center justify-center rounded-md p-1 transition-colors"
              style={{ color: item.starred ? "#F59E0B" : NEUTRAL.slate, background: "transparent", border: "none" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <Star size={12} fill={item.starred ? "#F59E0B" : "none"} />
            </button>
          ) : (
            item.starred && <Star size={11} fill="#F59E0B" color="#F59E0B" />
          )}
          {canWrite && moveTargets.length > 0 && onMoveToStage && (
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                title="Mover para outra etapa"
                style={{
                  background: "transparent", border: "none", color: "var(--text-dim)",
                  cursor: "pointer", padding: 2, borderRadius: 4, display: "flex",
                  alignItems: "center", lineHeight: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: "absolute", top: "calc(100% + 4px)", right: 0,
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                    boxShadow: "0 8px 24px rgba(32,26,26,0.12)", zIndex: 50, minWidth: 180, overflow: "hidden",
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ padding: "6px 12px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Mover para
                  </div>
                  {moveTargets.map(s => (
                    <button
                      key={s.id}
                      onClick={e => { e.stopPropagation(); onMoveToStage(item.id, s.id); setMenuOpen(false); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                        background: "transparent", border: "none", cursor: "pointer", fontSize: 13,
                        color: "var(--text)", textAlign: "left", transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--accent)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text)"; }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
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

      {/* Requester · dept */}
      {item.requesterName && (
        <div className="text-[11px] mb-1.5" style={{ color: NEUTRAL.slate }}>
          {item.requesterName}{item.department ? ` · ${item.department}` : ""}
        </div>
      )}

      {/* Owner pill + deadline — só ocupa espaço quando há responsável ou
          prazo; antes era um div sempre presente (com margem), deixando uma
          sobra vazia em cards sem nenhum dos dois. */}
      {(ownerName || item.deadline) && (
      <div className="flex items-center justify-between text-[11px] mb-2" style={{ color: NEUTRAL.slate }}>
        {ownerName
          ? <span className="px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface-alt)", fontWeight: 500 }}>{ownerName}</span>
          : <span />
        }
        {item.deadline && (
          <span style={{ color: isOverdue ? "#DC2626" : NEUTRAL.slate, fontWeight: isOverdue ? 600 : 400 }}>
            {formatDateBR(item.deadline)}
          </span>
        )}
      </div>
      )}

    </div>
  );
}

export const DeliverableKanbanCard = memo(DeliverableKanbanCardImpl);
