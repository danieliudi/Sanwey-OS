import React, { memo, useRef, useState, useEffect } from "react";
import { Clock, MoreVertical, ArrowRight } from "lucide-react";
import { CompletenessBadge } from "../ui/CompletenessBadge";

function agingStyle(days) {
  if (days > 21) return { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" };
  if (days > 7)  return { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" };
  if (days > 0)  return { bg: "#DCFCE7", text: "#16A34A", border: "#BBF7D0" };
  return null;
}

function stageKeyOf(s) {
  return s?.stageKey ?? s?.id;
}

function RHKanbanCardImpl({ id, stage, stages, onClick, onDragStart, onDragEnd, onMoveToStage, agingDays, completeness, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const ageStyle = agingDays != null ? agingStyle(agingDays) : null;

  const moveTargets = stages
    ? stages.filter(s => stageKeyOf(s) !== stage && !s.terminal)
    : [];

  const shadowBase  = `inset 3px 0 0 var(--border-strong), 0 1px 4px rgba(0,0,0,0.04)`;
  const shadowHover = `inset 3px 0 0 var(--border-strong), 0 4px 16px rgba(0,0,0,0.08)`;

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
      onDragStart={() => onDragStart?.(id)}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => { if (!menuOpen) onClick?.(id); }}
      className="p-3.5 rounded-xl cursor-pointer transition-all duration-150"
      style={{
        background: "var(--surface)",
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
      {/* Aging badge + move menu — right-aligned top row; card body lives in children below */}
      <div className="flex items-start justify-end gap-2 mb-2">
        <div className="flex items-center gap-1 shrink-0">
          {completeness?.total > 0 && (
            <CompletenessBadge filled={completeness.filled} total={completeness.total} size={26} />
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
                      color: "var(--text-dim)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Mover para
                  </div>
                  {moveTargets.map(s => {
                    const key = stageKeyOf(s);
                    return (
                      <button
                        key={key}
                        onClick={e => {
                          e.stopPropagation();
                          onMoveToStage(id, key);
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
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}

export const RHKanbanCard = memo(RHKanbanCardImpl);
export default RHKanbanCard;
