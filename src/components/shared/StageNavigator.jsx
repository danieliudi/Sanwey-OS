import React, { createContext, useContext, useEffect, useId, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { stageTextColor } from "../../utils/stage-colors";

// Registro consumido pelo SplitPanelDrawer: qualquer StageNavigator montado
// dentro das colunas do drawer se anuncia aqui, e é isso que faz a barra
// "Mover para" do mobile aparecer com os MESMOS destinos/handlers — sem os
// 14 chamadores precisarem passar prop nova. Fora do drawer (ex:
// LeadDetailDrawer) o contexto é null e nada muda.
export const StageMoveRegistryContext = createContext(null);

// "Mover para etapa" — padrão único da plataforma (alinhado à referência
// Pipefy): lista completa das etapas restantes como pills coloridos
// empilhados, sem distinção de anterior/próxima. Cada chamador já filtra
// `targets` de acordo com as próprias regras de negócio (ex: excluir
// etapas terminais, esconder a etapa atual).
export function StageNavigator({ targets, onMove, getKey = (s) => s.stageKey ?? s.id, disabled = false }) {
  const registry = useContext(StageMoveRegistryContext);
  const id = useId();
  // Props ficam num ref (atualizado a cada render) e o registro só
  // acontece quando o navigator entra/sai — registrar com as props nas
  // deps causaria loop de setState no drawer, já que os chamadores criam
  // `targets`/`getKey` inline a cada render.
  const propsRef = useRef(null);
  propsRef.current = { targets, onMove, getKey, disabled };
  const hasTargets = Boolean(targets?.length);

  useEffect(() => {
    if (!registry || !hasTargets) return;
    return registry.register(id, propsRef);
  }, [registry, hasTargets, id]);

  if (!targets?.length) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {targets.map((s) => (
        <button
          key={getKey(s)}
          onClick={() => onMove(getKey(s))}
          disabled={disabled}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          style={{ background: `${s.color}14`, color: stageTextColor(s.color), border: `1px solid ${s.color}30`, opacity: disabled ? 0.6 : 1, cursor: disabled ? "default" : "pointer" }}
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
