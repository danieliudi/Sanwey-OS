import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MoreVertical, ArrowRight } from "lucide-react";

// Botão "…" + dropdown "Mover para" compartilhado por todos os Kanbans
// (Entregas, Campanhas, Leads, RH). Abre pra cima quando não sobra espaço
// entre o botão e o fim do próprio card (boundaryRef) — sem isso, um card
// curto seguido de outro card fazia o menu nascer por cima do card de baixo
// (bug real, reportado no Kanban de Entregas). Usa o fim do card, não da
// viewport/coluna com scroll, porque ambos costumam ter espaço de sobra —
// quem realmente fica "no caminho" é o próximo card da lista.
export function MoveStageMenu({ targets, onMove, onOpenChange, boundaryRef }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const wrapRef = useRef(null);
  const dropdownRef = useRef(null);

  // Avisa o card pai quando o menu abre/fecha — o card usa isso pra não
  // disparar o onClick de "abrir detalhe" no clique que só fechou o menu.
  useEffect(() => { onOpenChange?.(menuOpen); }, [menuOpen, onOpenChange]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menuOpen || !wrapRef.current || !dropdownRef.current) return;
    const btnRect = wrapRef.current.getBoundingClientRect();
    const menuHeight = dropdownRef.current.offsetHeight;
    const boundaryBottom = boundaryRef?.current
      ? boundaryRef.current.getBoundingClientRect().bottom
      : window.innerHeight;
    const spaceBelow = Math.min(boundaryBottom, window.innerHeight) - btnRect.bottom;
    setOpenUpward(spaceBelow < menuHeight + 12);
  }, [menuOpen, targets.length, boundaryRef]);

  if (!targets?.length || !onMove) return null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        title="Mover para outra etapa"
        onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
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
          ref={dropdownRef}
          style={{
            position: "absolute",
            ...(openUpward ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }),
            right: 0,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
            boxShadow: "var(--shadow-pop)", zIndex: 50, minWidth: 180, overflow: "hidden",
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: "6px 12px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Mover para
          </div>
          {targets.map(s => (
            <button
              key={s.key}
              onClick={e => { e.stopPropagation(); onMove(s.key); setMenuOpen(false); }}
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
  );
}
