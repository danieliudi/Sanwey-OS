import React, { memo, useEffect, useRef, useState } from "react";
import { Clock, Star, MoreVertical, ArrowRight } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { DELIVERABLE_STAGES, DELIVERABLE_PRIORITIES } from "../../constants/marketing-pipelines";
import { formatDateBR } from "../../utils/date";

const PRIORITY_COLORS = { baixa: "#16A34A", media: "#D97706", alta: "#DC2626" };
const PRIORITY_LABELS = { baixa: "Baixa",   media: "Média",   alta: "Alta"  };

function daysFromDate(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function agingStyle(days) {
  if (days > 14) return { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" };
  if (days > 7)  return { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" };
  if (days > 0)  return { bg: "#DCFCE7", text: "#16A34A", border: "#BBF7D0" };
  return null;
}

function DeliverableKanbanCardImpl({
  item, ownerName, onClick, onDragStart, onDragEnd,
  stages, onMoveToStage, canWrite, onToggleStar,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const daysInStage = daysFromDate(item.stageChangedAt);
  const ageStyle    = daysInStage !== null ? agingStyle(daysInStage) : null;
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
      className="p-3.5 rounded-xl cursor-pointer transition-all duration-150"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        boxShadow: shadowBase,
        position: "relative",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = shadowHover;
        e.currentTarget.style.borderColor = "#e9bcb6";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = shadowBase;
        e.currentTarget.style.borderColor = "#E5E7EB";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Title + priority + star */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-[13px] leading-snug min-w-0 flex-1" style={{ color: NEUTRAL.graphite }}>
          {item.title}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {item.starred && <Star size={11} fill="#F59E0B" color="#F59E0B" />}
          {priColor && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-md font-bold"
              style={{ fontSize: 10, background: priColor + "18", color: priColor, border: `1px solid ${priColor}40` }}
            >
              {PRIORITY_LABELS[item.priority]}
            </span>
          )}
        </div>
      </div>

      {/* Requester · dept */}
      {item.requesterName && (
        <div className="text-[11px] mb-1.5" style={{ color: NEUTRAL.slate }}>
          {item.requesterName}{item.department ? ` · ${item.department}` : ""}
        </div>
      )}

      {/* Owner pill + deadline */}
      <div className="flex items-center justify-between text-[11px] mb-2" style={{ color: NEUTRAL.slate }}>
        {ownerName
          ? <span className="px-1.5 py-0.5 rounded-full" style={{ background: "#F3F4F6", fontWeight: 500 }}>{ownerName}</span>
          : <span />
        }
        {item.deadline && (
          <span style={{ color: isOverdue ? "#DC2626" : NEUTRAL.slate, fontWeight: isOverdue ? 600 : 400 }}>
            {formatDateBR(item.deadline)}
          </span>
        )}
      </div>

      {/* Aging badge + quick-move menu + star toggle */}
      <div className="flex items-center justify-between">
        <div>
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
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {canWrite && onToggleStar && (
            <button
              onClick={e => { e.stopPropagation(); onToggleStar?.(item.id); }}
              title={item.starred ? "Remover dos favoritos" : "Favoritar"}
              className="flex items-center justify-center rounded-md p-1 transition-colors"
              style={{ color: item.starred ? "#F59E0B" : NEUTRAL.slate, background: "transparent", border: "none" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <Star size={12} fill={item.starred ? "#F59E0B" : "none"} />
            </button>
          )}
          {canWrite && moveTargets.length > 0 && onMoveToStage && (
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                className="flex items-center justify-center rounded-md p-1 transition-colors"
                style={{ color: NEUTRAL.slate, background: "transparent", border: "none" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                title="Mover para etapa"
              >
                <MoreVertical size={13} />
              </button>
              {menuOpen && (
                <div
                  className="absolute rounded-xl border overflow-hidden"
                  style={{ right: 0, bottom: "calc(100% + 4px)", background: "#FFF", borderColor: "#E5E7EB", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, minWidth: 160 }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: NEUTRAL.slate }}>
                    Mover para
                  </div>
                  {moveTargets.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { onMoveToStage(item.id, s.id); setMenuOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors"
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.graphite }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#F9FAFB"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                      {s.name}
                      <ArrowRight size={10} style={{ marginLeft: "auto", opacity: 0.4 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const DeliverableKanbanCard = memo(DeliverableKanbanCardImpl);
