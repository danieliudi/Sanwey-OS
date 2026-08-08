import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBodyScrollLock } from "../../hooks/use-body-scroll-lock";
import { useEscToClose } from "../../hooks/use-esc-to-close";

export function Modal({ open, onClose, title, children, width = 560 }) {
  useBodyScrollLock(open);
  useEscToClose(onClose, open);

  if (!open) return null;
  // Portal pra document.body — sem isso o modal fica aninhado dentro de
  // .app-content-shell, junto do TopBar sticky (z-30). Nenhum ancestral no
  // caminho cria stacking context próprio, então os dois brigam no mesmo
  // nível raiz e o TopBar (sticky, "grudado" no topo) pode pintar por cima
  // do scrim mesmo com z-index nominalmente menor — bug conhecido de
  // sticky vs. fixed no mesmo stacking context. Portal resolve na raiz.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--overlay-scrim)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="rounded-lg shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          background: "var(--surface)",
          maxWidth: width,
          boxShadow: "var(--shadow-pop)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h3 className="font-semibold" style={{ fontSize: 16, color: "var(--text)" }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm transition-colors"
            style={{ color: "var(--text-faint)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-faint)"; }}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export default Modal;
