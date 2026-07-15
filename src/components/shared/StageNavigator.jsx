import React from "react";
import { ArrowRight } from "lucide-react";

// "Mover para etapa" — padrão único da plataforma (alinhado à referência
// Pipefy): lista completa das etapas restantes como pills coloridos
// empilhados, sem distinção de anterior/próxima. Cada chamador já filtra
// `targets` de acordo com as próprias regras de negócio (ex: excluir
// etapas terminais, esconder a etapa atual).
export function StageNavigator({ targets, onMove, getKey = (s) => s.stageKey ?? s.id, disabled = false }) {
  if (!targets?.length) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {targets.map((s) => (
        <button
          key={getKey(s)}
          onClick={() => onMove(getKey(s))}
          disabled={disabled}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          style={{ background: `${s.color}14`, color: s.color, border: `1px solid ${s.color}30`, opacity: disabled ? 0.6 : 1, cursor: disabled ? "default" : "pointer" }}
          onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${s.color}22`; }}
          onMouseLeave={e => { e.currentTarget.style.background = `${s.color}14`; }}
        >
          <span className="truncate">{s.name}</span>
          <ArrowRight size={13} />
        </button>
      ))}
    </div>
  );
}
