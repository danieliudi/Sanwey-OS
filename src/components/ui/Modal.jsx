import React, { useEffect } from "react";
import { X } from "lucide-react";

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
        className="rounded-lg shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          background: "var(--surface)",
          maxWidth: width,
          boxShadow: "0 24px 64px rgba(0,0,0,0.14)",
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
    </div>
  );
}

export default Modal;
