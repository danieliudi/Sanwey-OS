import React, { useEffect } from "react";
import { X, PartyPopper, Check } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";

export function OnboardingModal({ currentUser, onDone }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onDone(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(44,44,43,0.55)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full flex flex-col"
        style={{
          maxWidth: 480,
          background: "#FFFFFF",
          borderRadius: 20,
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
          overflow: "hidden",
        }}
      >
        {/* Red accent bar */}
        <div style={{ height: 4, background: "var(--color-industria)", borderRadius: "20px 20px 0 0" }} />

        {/* Dismiss */}
        <button
          onClick={onDone}
          className="absolute top-4 right-4 flex items-center justify-center rounded-full transition-colors"
          style={{ width: 28, height: 28, background: "#F5F4F2", color: "var(--text-dim)", border: "none", cursor: "pointer" }}
          title="Fechar"
        >
          <X size={14} />
        </button>

        {/* Content */}
        <div className="px-8 pt-8 pb-2 text-center">
          {/* Icon */}
          <div
            className="inline-flex items-center justify-center rounded-2xl mb-5"
            style={{ width: 64, height: 64, background: `${NEUTRAL.red}12` }}
          >
            <PartyPopper size={30} style={{ color: "var(--color-industria)" }} strokeWidth={1.75} />
          </div>

          <h2 className="font-bold mb-3" style={{ fontSize: 20, color: "var(--text)", lineHeight: 1.25, letterSpacing: "-0.01em" }}>
            Bem-vindo ao CRM Sanwey
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
            Vamos te mostrar o essencial conforme você for navegando pelas telas.
          </p>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-center px-8 py-6 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onDone}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all active:scale-95"
            style={{ background: "var(--color-industria)", border: "none", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.9)"; }}
            onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
          >
            <Check size={15} /> Começar
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingModal;
