import React from "react";
import { StageFieldsPanel } from "../shared/stage-editor/StageFieldsPanel";

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
