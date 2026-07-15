import React, { useMemo } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

// Botões dedicados de "etapa anterior/próxima", no padrão do drawer de
// Lead do CRM (LeadDetailDrawer.jsx) — complementa (não substitui) a grade
// de "mover para qualquer etapa" que já existe em cada drawer, pra cobrir
// o caso mais comum (avançar/voltar um passo) com um clique só e destaque
// visual, sem perder a opção de pular pra uma etapa não-adjacente (ex:
// reprovar de qualquer estágio do funil).
export function StageNavigator({ stages, currentStage, onMove, getKey = (s) => s.stageKey ?? s.id }) {
  const { prev, next } = useMemo(() => {
    if (!stages?.length || currentStage == null) return { prev: null, next: null };
    const idx = stages.findIndex((s) => getKey(s) === currentStage);
    if (idx < 0) return { prev: null, next: null };
    return {
      prev: idx > 0 ? stages[idx - 1] : null,
      next: idx < stages.length - 1 ? stages[idx + 1] : null,
    };
  }, [stages, currentStage, getKey]);

  if (!prev && !next) return null;

  return (
    <div className="flex gap-2 mb-2">
      {prev && (
        <button
          onClick={() => onMove(getKey(prev))}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          style={{ background: "var(--surface)", color: prev.color || "var(--text-dim)", border: `1px solid ${(prev.color || "#8A8680")}40` }}
          onMouseEnter={e => { e.currentTarget.style.background = `${prev.color || "#8A8680"}10`; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
        >
          <ArrowLeft size={13} />
          <span className="truncate">{prev.name}</span>
        </button>
      )}
      {next && (
        <button
          onClick={() => onMove(getKey(next))}
          className="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          style={{ background: `${next.color}14`, color: next.color, border: `1px solid ${next.color}30` }}
          onMouseEnter={e => { e.currentTarget.style.background = `${next.color}22`; }}
          onMouseLeave={e => { e.currentTarget.style.background = `${next.color}14`; }}
        >
          <span className="truncate">{next.name}</span>
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
