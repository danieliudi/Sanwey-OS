import React from "react";
import { StageFieldsPanel } from "../shared/stage-editor/StageFieldsPanel";
import { TASK_TAGS_CONDITION_KEY, TASK_TYPE_TAGS } from "../../constants/personal-tasks";

// Origem de condição que não é campo de etapa nenhuma — a etiqueta da própria
// tarefa (27/08/2026). É o que faz o formulário mudar por TIPO de tarefa
// ("Compra" pede fornecedor/valor, "Reunião" pede com quem/pauta) em vez de
// só por etapa, que é o que deixava esses formulários vazios na prática.
const TAG_CONDITION_SOURCE = [{
  fieldKey: TASK_TAGS_CONDITION_KEY,
  label: "Etiqueta da tarefa",
  hint: `Use o operador "contém" e escreva a etiqueta exata — ex.: ${TASK_TYPE_TAGS.slice(0, 3).join(", ")}.`,
}];

// Wrapper da Lista Pessoal do StageFieldsPanel — mesmo motor do Editor de
// campos genérico (Fornecedores/Despesas), aqui alimentado por
// use-personal-task-stage-fields.js/use-personal-task-stages.js em vez do
// par RH/CRM. Sem "Excluir esta etapa" aqui: isso já vive no editor de
// etapas (PersonalStageListManager) pra não duplicar o mesmo fluxo em dois
// lugares.
export function PersonalStageFieldsPanel({ open, onClose, stageKey, stages, stageFieldsHook }) {
  if (!open || !stageKey) return null;

  const stageMeta = stages.find(s => s.stageKey === stageKey) || { stageKey, name: stageKey, color: "#64748B" };
  const fields = stageFieldsHook.getFields(stageKey);

  return (
    <StageFieldsPanel
      open={open}
      onClose={onClose}
      stage={stageMeta}
      fields={fields}
      conditionExtraSources={TAG_CONDITION_SOURCE}
      showProbability={false}
      onAddField={(payload) => stageFieldsHook.addField({ stageKey, ...payload })}
      onUpdateField={(id, merged) => stageFieldsHook.updateField(id, merged)}
      onDeleteField={(id) => stageFieldsHook.deleteField(id)}
      onReorderFields={(ids) => stageFieldsHook.reorderFields(ids)}
      onRefetch={() => stageFieldsHook.refetch()}
    />
  );
}

export default PersonalStageFieldsPanel;
