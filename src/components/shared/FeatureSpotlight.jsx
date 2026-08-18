import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";

// Tour guiado contextual (mockup "Tour guiado — proposta de spotlight
// contextual", aprovado 07/08/2026, caminho B): destaca UM elemento real da
// tela — escurece tudo ao redor com recorte nítido no alvo (mesma técnica
// do mockup: box-shadow gigante em vez de overlay+clip-path) e mostra um
// tooltip apontando pra ele.
//
// Espera o elemento existir (MutationObserver) em vez de exigir que já
// esteja montado — mesma técnica de AgentsSidebarCoachmark.jsx (o outro
// coachmark ancorado a elemento que a plataforma já tem, esse específico da
// Sidebar). Se o elemento nunca aparecer dentro do tempo limite, dispensa
// em silêncio sem nunca renderizar nada visível — decisão registrada no
// mockup: elemento ausente (feature atrás de permissão, módulo desligado)
// não é erro, só não se aplica a este usuário.
const ORPHAN_TIMEOUT_MS = 4000;
// Depois de achar o elemento, recalcula a posição a cada frame por um
// tempinho — cobre reflow tardio que NÃO muda o tamanho do próprio alvo
// (ResizeObserver não pega), só a posição dele: fonte carregando, irmão no
// mesmo flex row mudando de largura, dado assíncrono entrando no cabeçalho.
// Achado ao vivo: sem isso o spotlight media a posição cedo demais e ficava
// "torto" — meio pixel de folga não bastava, o layout ainda se mexia depois.
const SETTLE_MS = 900;

export function FeatureSpotlight({ spotlight, onDismiss }) {
  const [rect, setRect] = useState(null);
  const dismissedOrphanRef = useRef(false);

  useEffect(() => {
    if (!spotlight) { setRect(null); return; }
    dismissedOrphanRef.current = false;

    let disposed = false;
    let ro = null;
    let mo = null;
    let orphanTimer = null;
    let attachedTarget = null;
    let settleRaf = null;

    const recalc = () => {
      const el = document.querySelector(spotlight.target);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      // Rede de segurança além do scrollIntoView em attach(): se o alvo
      // continuar fora da viewport por qualquer motivo (contêiner que não
      // rola, aba escondida), não escurece a tela inteira sem um recorte
      // visível pra explicar — melhor não mostrar nada do que parecer que a
      // página travou atrás de algo.
      const onScreen = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
      if (!onScreen) { setRect(null); return; }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom });
    };

    const handleTargetClick = () => onDismiss?.();

    const attach = (target) => {
      if (disposed) return;
      if (orphanTimer) { clearTimeout(orphanTimer); orphanTimer = null; }
      attachedTarget = target;
      // O alvo pode existir no DOM mas estar rolado pra fora da área visível
      // do próprio contêiner (ex.: item baixo na lista da Sidebar, que rola
      // por dentro) — getBoundingClientRect() ainda devolve uma posição
      // "real", só que fora da viewport. Sem isso, o recorte do spotlight
      // nascia fora da tela enquanto o box-shadow gigante continuava
      // escurecendo a tela inteira (achado real do Daniel, 18/08/2026) —
      // parecia a página inteira "travada" atrás de algo, sem nenhum
      // recorte visível pra explicar.
      target.scrollIntoView({ block: "nearest", behavior: "auto" });
      recalc();
      target.addEventListener("click", handleTargetClick);
      ro = new ResizeObserver(recalc);
      ro.observe(target);
      window.addEventListener("resize", recalc);
      window.addEventListener("scroll", recalc, true);

      const settleUntil = performance.now() + SETTLE_MS;
      const tick = (now) => {
        recalc();
        if (!disposed && now < settleUntil) settleRaf = requestAnimationFrame(tick);
      };
      settleRaf = requestAnimationFrame(tick);
    };

    const existing = document.querySelector(spotlight.target);
    if (existing) {
      attach(existing);
    } else {
      mo = new MutationObserver(() => {
        const el = document.querySelector(spotlight.target);
        if (el) { mo.disconnect(); mo = null; attach(el); }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      // Órfão: elemento nunca apareceu — pula em silêncio (marca como visto,
      // sem nunca ter renderizado nada), não fica tentando pra sempre.
      orphanTimer = setTimeout(() => {
        if (disposed || attachedTarget || dismissedOrphanRef.current) return;
        dismissedOrphanRef.current = true;
        onDismiss?.();
      }, ORPHAN_TIMEOUT_MS);
    }

    return () => {
      disposed = true;
      if (orphanTimer) clearTimeout(orphanTimer);
      if (settleRaf) cancelAnimationFrame(settleRaf);
      mo?.disconnect();
      ro?.disconnect();
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
      attachedTarget?.removeEventListener("click", handleTargetClick);
    };
  }, [spotlight, onDismiss]);

  useEffect(() => {
    if (!spotlight) return;
    const onKey = (e) => { if (e.key === "Escape") onDismiss?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [spotlight, onDismiss]);

  if (!spotlight || !rect) return null;

  const PAD = 4;
  const cardWidth = 260;
  const cardLeft = Math.max(8, Math.min(rect.left, window.innerWidth - cardWidth - 8));
  const cardTop = rect.bottom + PAD + 10; // position:fixed é viewport-relative, rect já vem de getBoundingClientRect

  return createPortal(
    <>
      <div
        style={{
          position: "fixed",
          top: rect.top - PAD, left: rect.left - PAD,
          width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          borderRadius: 8,
          boxShadow: "0 0 0 9999px rgba(10,12,18,0.62)",
          outline: "2px solid var(--accent)", outlineOffset: 3,
          pointerEvents: "none", zIndex: 2000,
        }}
      />
      <div
        style={{
          position: "fixed", top: cardTop, left: cardLeft, width: cardWidth,
          zIndex: 2001, background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, boxShadow: "var(--shadow-pop)", padding: "12px 14px",
        }}
      >
        <div className="flex items-start gap-2" style={{ marginBottom: 10 }}>
          <Sparkles size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text)" }}>{spotlight.text}</span>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onDismiss}
            style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 12px", borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: "pointer" }}
          >
            Entendi
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

export default FeatureSpotlight;
