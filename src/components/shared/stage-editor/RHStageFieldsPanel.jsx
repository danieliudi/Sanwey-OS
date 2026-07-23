import React from "react";
import { useRHStageFields } from "../../../hooks/use-rh-stage-fields";
import { useRHPipelineStages } from "../../../hooks/use-rh-pipeline-stages";
import { StageFieldsPanel } from "./StageFieldsPanel";

// Wrapper RH/Marketing do StageFieldsPanel — identifica os campos por
// domain + stageKey e busca a etapa no próprio domain pra ter cor e
// metadados (e habilitar as "Opções Avançadas" com gravação direta).

export function RHStageFieldsPanel({ open, onClose, domain, stageKey, stageName }) {
  const stageFields = useRHStageFields(domain);
  const { stages, updateStage } = useRHPipelineStages(domain);

  if (!open || !stageKey) return null;

  const stageMeta = stages.find(s => s.stageKey === stageKey)
    || { stageKey, name: stageName, color: "#64748B" };
  const fields = stageFields.getFields(stageKey);

  return (
    <StageFieldsPanel
      open={open}
      onClose={onClose}
      stage={stageMeta}
      fields={fields}
      showProbability
      onSaveStage={stageMeta.id ? (patch) => updateStage(stageMeta.id, patch) : null}
      onAddField={(payload) => stageFields.addField({ stageKey, ...payload })}
      onUpdateField={(id, merged) => stageFields.updateField(id, merged)}
      onDeleteField={(id) => stageFields.deleteField(id)}
      onReorderFields={(ids) => stageFields.reorderFields(stageKey, ids)}
      onRefetch={() => stageFields.refetch()}
    />
  );
}

export default RHStageFieldsPanel;
