import { useCallback } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { defaultPipelines, DEFAULT_PIPELINE_STAGES } from "../constants/pipelines";

// Gerencia o pipeline de cada empresa (etapas, ordem, cor, probabilidade).
// Hoje persistido em localStorage — pode migrar pra Supabase depois sem
// alterar a API exposta.

export function usePipelines() {
  const [pipelines, setPipelines] = usePersistentState(STORAGE_KEYS.pipelines, defaultPipelines());

  // Patch numa etapa específica (não muda ordem, só campos).
  const updateStage = useCallback((companyId, stageId, patch) => {
    setPipelines(prev => {
      const list = prev[companyId] || DEFAULT_PIPELINE_STAGES.map(s => ({ ...s }));
      const next = list.map(s => s.id === stageId ? { ...s, ...patch } : s);
      return { ...prev, [companyId]: next };
    });
  }, [setPipelines]);

  // Reordena. orderedIds deve conter todos os IDs da empresa (não remove,
  // só rearranja). Terminais permanecem no fim por convenção da UI.
  const reorderStages = useCallback((companyId, orderedIds) => {
    setPipelines(prev => {
      const list = prev[companyId] || DEFAULT_PIPELINE_STAGES.map(s => ({ ...s }));
      const byId = Object.fromEntries(list.map(s => [s.id, s]));
      const next = orderedIds.map(id => byId[id]).filter(Boolean);
      // Garante que toda etapa original sobreviva à reordenação.
      for (const s of list) if (!next.some(n => n.id === s.id)) next.push(s);
      return { ...prev, [companyId]: next };
    });
  }, [setPipelines]);

  const resetCompanyPipeline = useCallback((companyId) => {
    setPipelines(prev => ({
      ...prev,
      [companyId]: DEFAULT_PIPELINE_STAGES.map(s => ({ ...s })),
    }));
  }, [setPipelines]);

  return { pipelines, updateStage, reorderStages, resetCompanyPipeline };
}

export default usePipelines;
