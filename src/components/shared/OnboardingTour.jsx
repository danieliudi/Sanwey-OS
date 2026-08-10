import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Tour guiado sequencial da plataforma — decidido com o Daniel 10/08/2026
// (mockup "Tour guiado — cobertura completa da plataforma"). Mesma técnica
// visual de FeatureSpotlight.jsx (box-shadow gigante faz o recorte, sem
// overlay separado), mas percorrendo uma LISTA de paradas com Anterior/
// Próximo/Pular em vez de um "Entendi" único — a diferença real entre os
// dois mecanismos (ver use-onboarding-tour.js pro porquê de serem hooks
// separados).
//
// Não usa MutationObserver/orphan-timeout como o FeatureSpotlight: os steps
// já chegam pré-filtrados pelo hook (só o que existe no DOM no momento em
// que o tour começa) — se um alvo ainda assim sumir no meio do caminho
// (nunca deveria, mas é código defensivo barato), pula pro próximo em vez de
// travar em silêncio.
const SETTLE_MS = 500;

export function OnboardingTour({ tour }) {
  const { active, step, stepIndex, totalSteps, next, prev, skipTour } = tour;
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!active || !step) { setRect(null); return undefined; }
    let disposed = false;
    let ro = null;
    let settleRaf = null;

    const selector = `[data-tour="sidebar-nav-${step.id}"]`;

    const recalc = () => {
      const el = document.querySelector(selector);
      if (!el) { if (!disposed) next(); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right });
    };

    const el = document.querySelector(selector);
    if (!el) { next(); return undefined; }
    el.scrollIntoView({ block: "nearest" });
    recalc();
    ro = new ResizeObserver(recalc);
    ro.observe(el);
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);

    // Mesmo "settle" do FeatureSpotlight — cobre reflow tardio (fonte
    // carregando, badge assíncrono mudando a largura) que o ResizeObserver
    // sozinho não pega porque o próprio alvo não muda de tamanho, só de
    // posição relativa.
    const settleUntil = performance.now() + SETTLE_MS;
    const tick = (now) => {
      recalc();
      if (!disposed && now < settleUntil) settleRaf = requestAnimationFrame(tick);
    };
    settleRaf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      if (settleRaf) cancelAnimationFrame(settleRaf);
      ro?.disconnect();
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [active, step, next]);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => { if (e.key === "Escape") skipTour(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, skipTour]);

  if (!active || !step || !rect) return null;

  const PAD = 4;
  const cardWidth = Math.min(300, window.innerWidth - 24);
  // Prefere encostar à direita do item (como no mockup) — mas em telas
  // estreitas (mobile, sidebar ocupa a largura toda quando aberta) não sobra
  // espaço lateral nenhum, então cai pra "abaixo do item" automaticamente.
  const spaceRight = window.innerWidth - rect.right;
  const placeBelow = spaceRight < cardWidth + 24;
  const cardLeft = placeBelow
    ? Math.max(12, Math.min(rect.left, window.innerWidth - cardWidth - 12))
    : Math.min(rect.right + 14, window.innerWidth - cardWidth - 12);
  const cardTop = placeBelow
    ? Math.min(rect.bottom + 12, window.innerHeight - 200)
    : Math.max(12, Math.min(rect.top - 6, window.innerHeight - 210));

  const isFirst = stepIndex === 0;
  const isLast = stepIndex + 1 >= totalSteps;

  return createPortal(
    <>
      <div
        style={{
          position: "fixed",
          top: rect.top - PAD, left: rect.left - PAD,
          width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          borderRadius: 8,
          boxShadow: "0 0 0 9999px rgba(10,12,18,0.58)",
          outline: "2px solid var(--accent)", outlineOffset: 3,
          pointerEvents: "none", zIndex: 2100,
          transition: "top 0.15s ease, left 0.15s ease",
        }}
      />
      <div
        style={{
          position: "fixed", top: cardTop, left: cardLeft, width: cardWidth,
          zIndex: 2101, background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, boxShadow: "var(--shadow-pop)", padding: "16px 18px 14px",
        }}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: 8, fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{step.icon}</span> {step.title}
        </div>
        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-dim)", marginBottom: 14 }}>
          {step.blurb}
        </div>
        <div className="flex items-center justify-between" style={{ paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--text-faint)" }}>
            {stepIndex + 1} de {totalSteps}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={skipTour}
              style={{ fontSize: 12, color: "var(--text-faint)", background: "none", border: "none", cursor: "pointer", padding: "4px 6px" }}
            >
              Pular tour
            </button>
            {!isFirst && (
              <button
                onClick={prev}
                style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}
              >
                Anterior
              </button>
            )}
            <button
              onClick={next}
              style={{ fontSize: 12, fontWeight: 600, color: "var(--on-accent)", background: "var(--accent)", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}
            >
              {isLast ? "Concluir" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export default OnboardingTour;
