import React, { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { KanbanColumnSortMenu } from "../shared/KanbanColumnSortMenu";
import { stageTextColor } from "../../utils/stage-colors";

// Mesmo visual/comportamento do Kanban mobile do Pipeline Comercial
// (CRMView.jsx: "Mobile kanban: vertical collapsible stages") — etapa
// vira um pill colapsável, em vez de reaproveitar a coluna larga do
// desktop encolhida. Compartilhado por Recrutamento (Vagas/Candidatos),
// Onboarding, Avaliação de Desempenho, Férias, Treinamentos, Comex e
// Pós-venda — e, desde a consolidação de 08/08/2026, também por Funil de
// Vendas, Entregas, Tarefas de Marketing, Campanhas (CRM/Marketing tinham
// cada um sua própria cópia hand-rolled do mesmo acordeão).
//
// getSortCriteria/setSortCriteria/sortOptions (opcionais, 30/07/2026):
// ícone de ordenação por etapa — mesmo controle do header desktop
// (KanbanColumnSortMenu). Sem eles, nenhum ícone aparece (compatível com
// qualquer chamador que ainda não passe ordenação).
//
// stage.stageKey ?? stage.id (08/08/2026): os chamadores de RH/Comex/
// Pós-venda usam objetos vindos direto de `useRHPipelineStages` (têm
// `stageKey`); CRM/Entregas/Tarefas/Campanhas normalizam suas etapas pra
// `{ id, name, color, ... }` (o `id` já É a stage key, só com outro nome
// de campo, convenção antiga de cada arquivo). Em vez de forçar os 4
// arquivos a remapear cada array de etapas só pra bater o nome do campo,
// o componente aceita os dois — nenhum chamador existente tem as duas
// chaves ao mesmo tempo, então não há ambiguidade.
//
// renderStageExtra(stage) (opcional, 08/08/2026): conteúdo extra no canto
// direito do header, entre o menu de ordenação e o chevron — foi onde o
// ícone "Editar campos desta etapa" (Settings2) já vivia nas 3 cópias
// hand-rolled que tinham essa ação (Entregas/Tarefas de Marketing/
// Campanhas). Sem essa prop, nada extra renderiza (compatível com todo
// chamador atual).
//
// renderStageBadge(stage) (opcional, 08/08/2026): conteúdo extra logo
// depois do nome da etapa, no cluster esquerdo do header — mesmo lugar
// onde CRM/Entregas/Tarefas/Campanhas já mostravam um badge de SLA ou de
// valor/orçamento total da etapa antes da consolidação. Slot separado de
// `renderStageExtra` porque nenhuma das 2 versões hand-rolled colocava os
// dois no mesmo lado — manter os 2 slots preserva a posição exata de cada
// um em vez de empilhar tudo do mesmo lado.
//
// contentBackground (opcional, default "var(--surface-alt)", 08/08/2026):
// cor de fundo do painel expandido. Todo chamador usa o token padrão
// exceto Campanhas, que já usava `var(--surface)` antes da consolidação —
// prop existe só pra não mudar essa cor ao migrar aquele arquivo.
//
// initialExpandedKeys (opcional, array, 08/08/2026): mesma ideia de
// `initialExpandedKey`, mas aceita mais de uma chave já expandida de
// início — Entregas e Tarefas de Marketing abrem a etapa padrão MAIS a
// etapa vinda de `location.state?.filterStage` (deep link de outra tela).
// Os dois props se somam quando usados juntos.
//
// footer (opcional, 08/08/2026): nó extra renderizado como último item
// dentro do MESMO container `space-y-1.5 pb-24` da lista de etapas — não
// um elemento solto depois. Entregas/Tarefas de Marketing/Campanhas têm
// um botão "+ Nova etapa" ali, que precisa herdar o gap de 6px do
// `space-y-1.5` (como as próprias etapas) e ficar antes do `pb-24` de
// respiro do final da lista — colocar esse botão como sibling FORA do
// componente duplicaria o pb-24 (96px) ou perderia o gap de 6px.
export function RHMobileKanbanAccordion({
  stages, itemsByStage, renderCard, onAdd, addLabel, emptyLabel, initialExpandedKey, initialExpandedKeys,
  getSortCriteria, setSortCriteria, sortOptions, renderStageExtra, renderStageBadge, contentBackground, footer,
}) {
  const keyOf = (stage) => stage.stageKey ?? stage.id;
  const [expanded, setExpanded] = useState(() => {
    const initial = new Set(initialExpandedKeys || []);
    if (initialExpandedKey) initial.add(initialExpandedKey);
    return initial;
  });
  const toggle = (key) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  return (
    <div className="lg:hidden space-y-1.5 pb-24">
      {stages.map(stage => {
        const key = keyOf(stage);
        const items = itemsByStage[key] || [];
        const isExpanded = expanded.has(key);
        return (
          <div key={key} className="rounded-xl overflow-hidden border" style={{ borderColor: stage.color + "28" }}>
            <button
              className="w-full flex items-center justify-between gap-2 px-4 py-3.5 cursor-pointer"
              style={{ background: stage.color + "12", border: "none" }}
              onClick={() => toggle(key)}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
                <span className="font-bold text-sm truncate" style={{ color: stageTextColor(stage.color) }}>{stage.name}</span>
                {renderStageBadge && renderStageBadge(stage)}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-sm" style={{ color: stageTextColor(stage.color) }}>{items.length}</span>
                {getSortCriteria && (
                  <div onClick={e => e.stopPropagation()}>
                    <KanbanColumnSortMenu
                      criteria={getSortCriteria(key)}
                      onChange={(v) => setSortCriteria(key, v)}
                      options={sortOptions || ["recent", "alpha"]}
                      accentColor={stage.color}
                    />
                  </div>
                )}
                {renderStageExtra && (
                  <div onClick={e => e.stopPropagation()}>
                    {renderStageExtra(stage)}
                  </div>
                )}
                <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${stage.color}`, display: "flex", alignItems: "center", justifyContent: "center", color: stage.color, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                  <ChevronDown size={13} />
                </div>
              </div>
            </button>
            {isExpanded && (
              <div className="p-2.5 space-y-2" style={{ background: contentBackground || "var(--surface-alt)" }}>
                {items.length === 0 ? (
                  <div className="text-center py-4 text-xs" style={{ color: "var(--text-dim)" }}>{emptyLabel || "Nada nesta etapa"}</div>
                ) : (
                  items.map(item => renderCard(item))
                )}
                {onAdd && !stage.terminal && (
                  <button
                    onClick={() => onAdd(key)}
                    className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                    style={{ background: stage.color + "18", color: stageTextColor(stage.color), border: `1px dashed ${stage.color}44` }}
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
      {footer}
    </div>
  );
}

export default RHMobileKanbanAccordion;
