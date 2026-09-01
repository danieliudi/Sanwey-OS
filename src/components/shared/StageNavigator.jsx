import React, { createContext, useContext, useEffect, useId, useRef } from "react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { stageTextColor } from "../../utils/stage-colors";

// Registro consumido pelo SplitPanelDrawer: qualquer StageNavigator montado
// dentro das colunas do drawer se anuncia aqui, e é isso que faz a barra
// "Mover para" do mobile aparecer com os MESMOS destinos/handlers — sem os
// 14 chamadores precisarem passar prop nova. Fora do drawer (ex:
// LeadDetailDrawer) o contexto é null e nada muda.
export const StageMoveRegistryContext = createContext(null);

function StagePill({ s, getKey, onMove, disabled, direction }) {
  const isBackward = direction === "backward";
  return (
    <button
      onClick={() => onMove(getKey(s))}
      disabled={disabled}
      // Descrição da etapa como `title` (rh_pipeline_stages.description,
      // migration 20260901180000). É aqui que ela mais rende: quem está
      // decidindo PRA ONDE mover é exatamente quem precisa saber o que cada
      // etapa significa. Sem descrição, o title fica só com o nome — mesmo
      // comportamento de antes.
      // Sem descrição, `undefined` e não `s.name`: o nome já é o rótulo
      // visível do botão, e um tooltip nativo repetindo o texto que está na
      // tela é ruído em 13 telas (achado do QA, 01/09/2026).
      title={s.description ? `${s.name} — ${s.description}` : undefined}
      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
      style={isBackward ? {
        background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border-strong)",
        opacity: disabled ? 0.6 : 1, cursor: disabled ? "default" : "pointer", fontWeight: 500,
      } : {
        background: `${s.color}14`, color: stageTextColor(s.color), border: `1px solid ${s.color}30`,
        opacity: disabled ? 0.6 : 1, cursor: disabled ? "default" : "pointer",
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.background = isBackward ? "var(--surface-alt)" : `${s.color}22`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = isBackward ? "transparent" : `${s.color}14`;
      }}
    >
      {isBackward && <ArrowLeft size={13} className="shrink-0" />}
      <span className="truncate">{s.name}</span>
      {!isBackward && <ArrowRight size={13} className="shrink-0" />}
    </button>
  );
}

// "Mover para etapa" — padrão único da plataforma. `targets` já vem
// filtrado por cada chamador (regras de negócio: etapas terminais fora,
// etapa atual fora, transições permitidas). Por padrão renderiza uma
// lista plana (compat retroativa). Passando `currentStageKey` + `allStages`
// (lista completa e ORDENADA do pipeline, incluindo a etapa atual — a
// mesma fonte que já monta `targets`), separa em dois grupos visuais:
// próxima(s) etapa(s) em destaque cheio (seta →), etapas anteriores em
// contorno discreto (seta ←) — referência Pipefy, pedido do Daniel
// 07/08/2026. Sem essas duas props, comportamento idêntico ao anterior.
export function StageNavigator({ targets, onMove, getKey = (s) => s.stageKey ?? s.id, disabled = false, currentStageKey, allStages }) {
  const registry = useContext(StageMoveRegistryContext);
  const id = useId();
  // Props ficam num ref (atualizado a cada render) e o registro só
  // acontece quando o navigator entra/sai — registrar com as props nas
  // deps causaria loop de setState no drawer, já que os chamadores criam
  // `targets`/`getKey` inline a cada render.
  const propsRef = useRef(null);
  propsRef.current = { targets, onMove, getKey, disabled, currentStageKey, allStages };
  const hasTargets = Boolean(targets?.length);

  useEffect(() => {
    if (!registry || !hasTargets) return;
    return registry.register(id, propsRef);
  }, [registry, hasTargets, id]);

  if (!targets?.length) return null;

  const currentIndex = allStages ? allStages.findIndex((s) => getKey(s) === currentStageKey) : -1;
  const canOrder = Boolean(allStages) && currentIndex >= 0;

  if (!canOrder) {
    return (
      <div className="flex flex-col gap-1.5">
        {targets.map((s) => (
          <StagePill key={getKey(s)} s={s} getKey={getKey} onMove={onMove} disabled={disabled} direction="forward" />
        ))}
      </div>
    );
  }

  const forward = [];
  const backward = [];
  for (const s of targets) {
    const idx = allStages.findIndex((s2) => getKey(s2) === getKey(s));
    (idx > currentIndex ? forward : backward).push(s);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {forward.map((s) => (
        <StagePill key={getKey(s)} s={s} getKey={getKey} onMove={onMove} disabled={disabled} direction="forward" />
      ))}
      {forward.length > 0 && backward.length > 0 && (
        <div className="flex items-center gap-2 my-0.5">
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
            etapas anteriores
          </span>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>
      )}
      {backward.map((s) => (
        <StagePill key={getKey(s)} s={s} getKey={getKey} onMove={onMove} disabled={disabled} direction="backward" />
      ))}
    </div>
  );
}
