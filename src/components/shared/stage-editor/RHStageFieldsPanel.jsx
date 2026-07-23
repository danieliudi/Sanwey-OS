import React from "react";
import { useRHStageFields } from "../../../hooks/use-rh-stage-fields";
import { useRHPipelineStages } from "../../../hooks/use-rh-pipeline-stages";
import { StageFieldsPanel } from "./StageFieldsPanel";

// Wrapper RH/Marketing do StageFieldsPanel — identifica os campos por
// domain + stageKey e busca a etapa no próprio domain pra ter cor e
// metadados (e habilitar as "Opções Avançadas" com gravação direta).

// `records`/`stageField` são opcionais — só quando o chamador passa os dois
// é que "Excluir esta etapa" aparece dentro de "Opções Avançadas" (guardado
// pela mesma regra do StageListManager: bloqueia exclusão com registro ativo
// na etapa). Sem eles, o comportamento é o de sempre (sem exclusão aqui) —
// rollout deliberadamente por board (piloto: Entregas), não automático nos
// outros chamadores deste painel.
export function RHStageFieldsPanel({ open, onClose, domain, stageKey, stageName, records, stageField }) {
  const stageFields = useRHStageFields(domain);
  const { stages, updateStage, deleteStage } = useRHPipelineStages(domain);

  if (!open || !stageKey) return null;

  const stageMeta = stages.find(s => s.stageKey === stageKey)
    || { stageKey, name: stageName, color: "#64748B" };
  const fields = stageFields.getFields(stageKey);

  const handleDeleteStage = async () => {
    const count = (records || []).filter(r => r?.[stageField] === stageKey).length;
    if (count > 0) {
      throw new Error(`Não dá pra excluir "${stageMeta.name}": ${count} registro${count !== 1 ? "s" : ""} ainda está${count !== 1 ? "ão" : ""} nessa etapa. Mova esses registros antes.`);
    }
    await deleteStage(stageMeta.id);
  };

  return (
    <StageFieldsPanel
      open={open}
      onClose={onClose}
      stage={stageMeta}
      fields={fields}
      showProbability
      onSaveStage={stageMeta.id ? (patch) => updateStage(stageMeta.id, patch) : null}
      onDeleteStage={stageMeta.id && records && stageField ? handleDeleteStage : null}
      onAddField={(payload) => stageFields.addField({ stageKey, ...payload })}
      onUpdateField={(id, merged) => stageFields.updateField(id, merged)}
      onDeleteField={(id) => stageFields.deleteField(id)}
      onReorderFields={(ids) => stageFields.reorderFields(stageKey, ids)}
      onRefetch={() => stageFields.refetch()}
    />
  );
}

export default RHStageFieldsPanel;
