import React, { useEffect, useRef, useState } from "react";
import { Bot } from "lucide-react";

// Spotlight apontando pro item "Agentes" da sidebar (ver
// docs/design-spec-agents-sidebar-coachmark.md). Fica em shell/, não
// shared/, porque é acoplado 1:1 ao [data-nav-id="agents"] da Sidebar — só
// vira candidato a shared/ se surgir um 2º coachmark ancorado a item de nav
// (regra da 3ª ocorrência, CLAUDE.md seção 4).
//
// Mesma técnica de posicionamento do tooltip de NavItem (Sidebar.jsx):
// position:fixed ancorado via getBoundingClientRect do elemento alvo, pra
// escapar do overflow:hidden do <nav>.
export function AgentsSidebarCoachmark({ visible, onDismiss }) {
  const [anchor, setAnchor] = useState(null);
  const [rail, setRail] = useState(false);
  const attachedRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setAnchor(null);
      return;
    }

    let disposed = false;
    let ro = null;
    let navEl = null;
    let mo = null;

    const readRail = () => {
      const w = getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width").trim();
      setRail(w === "72px");
    };

    const updateAnchor = () => {
      const el = document.querySelector('[data-nav-id="agents"]');
      if (!el) {
        setAnchor(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setAnchor({ x: rect.right + 12, y: rect.top + rect.height / 2 });
    };

    const handleTargetClick = () => onDismiss?.();

    const attach = (target) => {
      if (disposed) return;
      attachedRef.current = target;
      target.scrollIntoView({ block: "center", behavior: "instant" });
      readRail();
      updateAnchor();
      target.addEventListener("click", handleTargetClick);
      ro = new ResizeObserver(updateAnchor);
      ro.observe(target);
      window.addEventListener("resize", updateAnchor);
      navEl = target.closest("nav");
      navEl?.addEventListener("scroll", updateAnchor);
    };

    const existing = document.querySelector('[data-nav-id="agents"]');
    if (existing) {
      attach(existing);
    } else {
      // Módulo ainda carregando (currentUser/allowedModules) — espera o
      // item aparecer no DOM sem marcar como visto.
      mo = new MutationObserver(() => {
        const el = document.querySelector('[data-nav-id="agents"]');
        if (el) {
          mo.disconnect();
          mo = null;
          attach(el);
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      disposed = true;
      mo?.disconnect();
      ro?.disconnect();
      window.removeEventListener("resize", updateAnchor);
      navEl?.removeEventListener("scroll", updateAnchor);
      attachedRef.current?.removeEventListener("click", handleTargetClick);
      attachedRef.current = null;
    };
  }, [visible, onDismiss]);

  if (!visible || !anchor) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: anchor.x,
        top: anchor.y,
        transform: "translateY(-50%)",
        zIndex: 65,
        maxWidth: rail ? 220 : 260,
        background: "var(--text)",
        color: "var(--bg)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-pop)",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -8,
          top: "50%",
          transform: "translateY(-50%)",
          width: 0,
          height: 0,
          borderTop: "4px solid transparent",
          borderBottom: "4px solid transparent",
          borderRight: "8px solid var(--text)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Bot size={16} style={{ color: "var(--bg)", opacity: 0.9, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--bg)" }}>Novo: Agentes de IA</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 400, color: "var(--bg)", opacity: 0.85, marginBottom: 10 }}>
        Configure e acompanhe agentes de IA que ajudam sua equipe de RH — comece por aqui.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onDismiss}
          style={{
            background: "transparent",
            border: "1px solid color-mix(in srgb, var(--bg) 35%, transparent)",
            color: "var(--bg)",
            borderRadius: "var(--radius-sm)",
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--bg) 15%, transparent)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          Entendi
        </button>
      </div>
    </div>
  );
}

export default AgentsSidebarCoachmark;
