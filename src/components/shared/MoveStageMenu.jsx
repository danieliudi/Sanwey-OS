import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, ArrowRight } from "lucide-react";

// Botão "…" + dropdown "Mover para" compartilhado por todos os Kanbans
// (Entregas, Campanhas, Leads, RH). O dropdown é renderizado via portal em
// document.body e posicionado com coordenadas de viewport (position: fixed)
// — toda coluna de Kanban aqui tem a lista de cards num container com
// overflow-y: auto separado do cabeçalho; um menu posicionado como filho
// normal (position: absolute) que abre pra cima perto do topo da lista era
// cortado por esse overflow e "sumia" atrás do cabeçalho da coluna (bug
// real, reportado no RH e reproduzível em qualquer Kanban). Fora da coluna,
// via portal, o overflow dela deixa de valer pro menu.
export function MoveStageMenu({ targets, onMove, onOpenChange }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pos, setPos] = useState(null); // { top | bottom, left } em coordenadas de viewport
  const wrapRef = useRef(null);
  const dropdownRef = useRef(null);

  // Avisa o card pai quando o menu abre/fecha — o card usa isso pra não
  // disparar o onClick de "abrir detalhe" no clique que só fechou o menu.
  useEffect(() => { onOpenChange?.(menuOpen); }, [menuOpen, onOpenChange]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e) => {
      if (wrapRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    // Fecha ao rolar qualquer ancestral com scroll — o menu é fixed e não
    // acompanharia o botão, ficando "flutuando" solto na tela.
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
  }, [menuOpen, targets.length]);

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
            boxShadow: "var(--shadow-pop)", zIndex: 2000, minWidth: 180, overflow: "hidden",
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
        </div>,
        document.body
      )}
    </div>
  );
}
