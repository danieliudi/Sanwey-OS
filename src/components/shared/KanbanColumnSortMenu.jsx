import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpDown, Check } from "lucide-react";
import { SORT_OPTIONS } from "../../utils/kanban-sort";

// Botão de ordenação por coluna, compartilhado por todo Kanban da plataforma
// (30/07/2026, item "ordenar cada etapa do jeito que eu quiser" — mockup
// aprovado com o Daniel). Cada coluna guarda seu próprio critério (ver
// use-kanban-sort.js), em vez do dropdown único pro board inteiro que existia
// antes.
//
// Dropdown via portal em document.body, posicionado com coordenadas de
// viewport (position: fixed) — mesma técnica de MoveStageMenu.jsx: toda
// coluna de Kanban tem a lista de cards num container com overflow-y: auto
// separado do cabeçalho, e um menu posicionado como filho normal (position:
// absolute) era cortado por esse overflow (bug já resolvido lá, evitado aqui
// desde o início).
//
// `options` = subconjunto de SORT_OPTIONS.value que faz sentido pro board
// que está chamando (ex.: só quem tem campo de prioridade mostra "priority")
// — nunca mostra um critério sem dado real por trás.
export function KanbanColumnSortMenu({ criteria, onChange, options, accentColor = "var(--text-dim)" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e) => {
      if (wrapRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    const close = () => setMenuOpen(false);
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  useEffect(() => { if (!menuOpen) setPos(null); }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menuOpen || !wrapRef.current || !dropdownRef.current) return;
    const btnRect = wrapRef.current.getBoundingClientRect();
    const menuRect = dropdownRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const openUpward = spaceBelow < menuRect.height + 12;
    const left = Math.max(8, Math.min(btnRect.right - menuRect.width, window.innerWidth - menuRect.width - 8));
    setPos(openUpward
      ? { bottom: window.innerHeight - btnRect.top + 4, left }
      : { top: btnRect.bottom + 4, left });
  }, [menuOpen]);

  const visibleOptions = SORT_OPTIONS.filter(o => options.includes(o.value));
  if (visibleOptions.length === 0) return null;
  const isCustomized = criteria && criteria !== "recent";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        title="Ordenar esta etapa"
        onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
        style={{
          background: isCustomized ? "var(--accent-tint)" : "transparent",
          border: "none", color: isCustomized ? "var(--accent)" : accentColor,
          cursor: "pointer", padding: 4, borderRadius: 6, display: "flex",
          alignItems: "center", lineHeight: 1,
        }}
        onMouseEnter={e => { if (!isCustomized) e.currentTarget.style.background = "var(--surface-alt)"; }}
        onMouseLeave={e => { if (!isCustomized) e.currentTarget.style.background = "transparent"; }}
      >
        <ArrowUpDown size={13} />
      </button>
      {menuOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: pos?.top,
            bottom: pos?.bottom,
            left: pos?.left ?? -9999,
            visibility: pos ? "visible" : "hidden",
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
            boxShadow: "var(--shadow-pop)", zIndex: 2000, minWidth: 190, maxWidth: 240, overflow: "hidden",
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: "7px 12px 5px", fontSize: 9.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Ordenar por
          </div>
          {visibleOptions.map(opt => {
            const active = (criteria || "recent") === opt.value;
            return (
              <button
                key={opt.value}
                onClick={e => { e.stopPropagation(); onChange(opt.value); setMenuOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  padding: "7px 12px", background: active ? "var(--surface-alt)" : "transparent", border: "none",
                  cursor: "pointer", fontSize: 12.5, fontWeight: active ? 600 : 400, color: "var(--text)", textAlign: "left",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                {opt.label}
                {active && <Check size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

export default KanbanColumnSortMenu;
