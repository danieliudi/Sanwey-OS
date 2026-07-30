import React, { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { KanbanColumnSortMenu } from "../shared/KanbanColumnSortMenu";

// Mesmo visual/comportamento do Kanban mobile do Pipeline Comercial
// (CRMView.jsx: "Mobile kanban: vertical collapsible stages") — etapa
// vira um pill colapsável, em vez de reaproveitar a coluna larga do
// desktop encolhida. Compartilhado por Recrutamento (Vagas/Candidatos),
// Onboarding e Avaliação de Desempenho pra manter os 4 boards idênticos.
//
// getSortCriteria/setSortCriteria/sortOptions (opcionais, 30/07/2026):
// ícone de ordenação por etapa — mesmo controle do header desktop
// (KanbanColumnSortMenu). Sem eles, nenhum ícone aparece (compatível com
// qualquer chamador que ainda não passe ordenação).
export function RHMobileKanbanAccordion({
  stages, itemsByStage, renderCard, onAdd, addLabel, emptyLabel, initialExpandedKey,
  getSortCriteria, setSortCriteria, sortOptions,
}) {
  const [expanded, setExpanded] = useState(() => new Set(initialExpandedKey ? [initialExpandedKey] : []));
  const toggle = (key) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  return (
    <div className="lg:hidden space-y-1.5 pb-24">
      {stages.map(stage => {
        const items = itemsByStage[stage.stageKey] || [];
        const isExpanded = expanded.has(stage.stageKey);
        return (
          <div key={stage.stageKey} className="rounded-xl overflow-hidden border" style={{ borderColor: stage.color + "28" }}>
            <button
              className="w-full flex items-center justify-between px-4 py-3.5 cursor-pointer"
              style={{ background: stage.color + "12", border: "none" }}
              onClick={() => toggle(stage.stageKey)}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
                <span className="font-bold text-sm truncate" style={{ color: stage.color }}>{stage.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-sm" style={{ color: stage.color }}>{items.length}</span>
                {getSortCriteria && (
                  <div onClick={e => e.stopPropagation()}>
                    <KanbanColumnSortMenu
                      criteria={getSortCriteria(stage.stageKey)}
                      onChange={(v) => setSortCriteria(stage.stageKey, v)}
                      options={sortOptions || ["recent", "alpha"]}
                      accentColor={stage.color}
                    />
                  </div>
                )}
                <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${stage.color}`, display: "flex", alignItems: "center", justifyContent: "center", color: stage.color, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                  <ChevronDown size={13} />
                </div>
              </div>
            </button>
            {isExpanded && (
              <div className="p-2.5 space-y-2" style={{ background: "var(--surface-alt)" }}>
                {items.length === 0 ? (
                  <div className="text-center py-4 text-xs" style={{ color: "var(--text-dim)" }}>{emptyLabel || "Nada nesta etapa"}</div>
                ) : (
                  items.map(item => renderCard(item))
                )}
                {onAdd && !stage.terminal && (
                  <button
                    onClick={() => onAdd(stage.stageKey)}
                    className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                    style={{ background: stage.color + "18", color: stage.color, border: `1px dashed ${stage.color}44` }}
                  >
                    <Plus size={12} />
                    {addLabel || "Adicionar"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default RHMobileKanbanAccordion;
