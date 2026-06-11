import React, { memo, useRef, useState, useEffect } from "react";
import { Clock, MoreVertical, ArrowRight } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { CompanyTag } from "../ui/CompanyTag";
import { formatK } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";

function daysFromDate(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function agingStyle(days) {
  if (days > 21) return { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" };
  if (days > 7)  return { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" };
  if (days > 0)  return { bg: "#DCFCE7", text: "#16A34A", border: "#BBF7D0" };
  return null;
}

function LeadKanbanCardImpl({ lead, ownerName, showOwnerFooter, isGroupView, onClick, onDragStart, onDragEnd, stages, onMoveToStage }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const daysInStage = daysFromDate(lead.stageChangedAt);
  const ageStyle = daysInStage !== null ? agingStyle(daysInStage) : null;
  const probDisplay = lead.probability > 1
    ? Math.round(lead.probability)
    : Math.round(lead.probability * 100);

  const moveTargets = stages
    ? stages.filter(s => s.id !== lead.stage && !s.terminal)
    : [];

  const accentColor = COMPANIES[lead.companyId]?.primary || NEUTRAL.slate;
  const shadowBase  = `inset 3px 0 0 ${accentColor}, 0 1px 4px rgba(32,26,26,0.06)`;
  const shadowHover = `inset 3px 0 0 ${accentColor}, 0 4px 16px rgba(32,26,26,0.10)`;

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
      {/* Company + aging badge + score + menu */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-[13px] leading-snug flex-1" style={{ color: NEUTRAL.graphite }}>
          {lead.company}
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
          <FitScoreCircle score={lead.fitScore} size={30} />
          {moveTargets.length > 0 && onMoveToStage && (
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                title="Mover para outra etapa"
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: NEUTRAL.slate,
                  cursor: "pointer",
                  padding: 2,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  lineHeight: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#fef1f0"; e.currentTarget.style.color = "#b5000b"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = NEUTRAL.slate; }}
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    boxShadow: "0 8px 24px rgba(32,26,26,0.12)",
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
                      color: NEUTRAL.slate,
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
                        color: NEUTRAL.graphite,
                        textAlign: "left",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#fef1f0"; e.currentTarget.style.color = "#b5000b"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = NEUTRAL.graphite; }}
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

      {/* SKU */}
      <div className="text-xs mb-2.5 line-clamp-1" style={{ color: NEUTRAL.slate }}>
        {lead.skuName}
      </div>

      {/* Value + probability + close date */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold" style={{ color: NEUTRAL.graphite }}>
          {formatK(lead.value)}
        </span>
        <span style={{ color: NEUTRAL.slate }}>
          {probDisplay}% · {formatDateBR(lead.closeDate)}
        </span>
      </div>

      {/* Owner footer */}
      {showOwnerFooter && lead.owner && (
        <div
          className="mt-2.5 pt-2 border-t text-[11px] flex items-center justify-between"
          style={{ borderColor: "#F0F0F0", color: NEUTRAL.slate }}
        >
          <span>{ownerName || "—"}</span>
          {isGroupView && <CompanyTag companyId={lead.companyId} />}
        </div>
      )}
    </div>
  );
}

export const LeadKanbanCard = memo(LeadKanbanCardImpl);
export default LeadKanbanCard;
