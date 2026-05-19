import React, { useEffect } from "react";
import { X } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";

export function Modal({ open, onClose, title, children, width = 560 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{ background: "#FFFFFF", maxWidth: width, boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#F0F0F0" }}>
          <h3 className="font-semibold" style={{ fontSize: 16, color: NEUTRAL.graphite }}>{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: NEUTRAL.slate }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F1F3F5"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
