import React, { useEffect, useState } from "react";
import { X, ArrowRight, Check } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { ONBOARDING_STEPS } from "../../data/tutorials";

export function OnboardingModal({ currentUser, onDone }) {
  const role = currentUser?.role || "vendedor";
  const steps = ONBOARDING_STEPS[role] || ONBOARDING_STEPS.vendedor;
  const [step, setStep] = useState(0);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onDone(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onDone]);

  const isLast = step === steps.length - 1;
  const current = steps[step];
  const Icon = current.icon;

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
          title="Pular"
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
            <Icon size={30} style={{ color: "var(--color-industria)" }} strokeWidth={1.75} />
          </div>

          <h2 className="font-bold mb-3" style={{ fontSize: 20, color: "var(--text)", lineHeight: 1.25, letterSpacing: "-0.01em" }}>
            {current.title}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)", minHeight: 60 }}>
            {current.body}
          </p>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 py-5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="rounded-full transition-all"
              style={{
                width: i === step ? 20 : 7,
                height: 7,
                background: i === step ? "var(--color-industria)" : "#E5E7EB",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-8 py-5 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onDone}
            className="text-xs font-medium transition-colors"
            style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Pular tour
          </button>

          <button
            onClick={() => isLast ? onDone() : setStep(s => s + 1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all active:scale-95"
            style={{ background: "var(--color-industria)", border: "none", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.9)"; }}
            onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
          >
            {isLast ? (
              <><Check size={15} /> Começar</>
            ) : (
              <>Próximo <ArrowRight size={15} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingModal;
