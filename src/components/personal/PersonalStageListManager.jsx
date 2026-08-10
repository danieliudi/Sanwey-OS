import React, { useMemo } from "react";
import { StageListCore } from "../shared/stage-editor/StageListManager";

const NEW_STAGE_DEFAULTS = { name: "Nova etapa", color: "#64748B", terminal: false };

function slugifyStageKey(label) {
  return (label || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || `etapa_${Date.now().toString(36)}`;
}

// Mesmo "core visual" do Pipeline/RH (StageListCore) — 3º modo de
// persistência (rodada 2 do redesenho da Lista Pessoal), escrevendo em
// personal_task_stages via use-personal-task-stages.js em vez de
// rh_pipeline_stages/replacePipeline.
export function PersonalStageListManager({ open, onClose, stages, stagesHook, tasks }) {
  const { addStage, updateStage, deleteStage, reorderStages } = stagesHook;

  const countsByStage = useMemo(() => {
    const m = {};
    for (const t of tasks || []) { if (t.status) m[t.status] = (m[t.status] || 0) + 1; }
    return m;
  }, [tasks]);

  // `stages` pode vir com linhas "fallback" (isFallback: true) — quando o
  // usuário nunca customizou, o editor abre pré-populado com as 3 etapas
  // padrão (A Fazer/Fazendo/Feito) pra edição parecer "personalizar o que já
  // existe" em vez de "começar do zero". Essas linhas ainda não têm linha
  // real em personal_task_stages: salvar precisa CRIAR (addStage), não
  // UPDATE — mas preservando o stageKey original ('a_fazer' etc.), senão as
  // tarefas já gravadas com esse status ficariam órfãs da coluna certa.
  const realStages = stages.filter(s => !s.isFallback);

  const handleSave = async (draft) => {
    const originalById = new Map(realStages.map(s => [s.id, s]));
    const fallbackByStageKey = new Map(stages.filter(s => s.isFallback).map(s => [s.stageKey, s]));
    const idByRef = new Map();

    const remainingIds = new Set(draft.filter(s => !s.isNew && !s.isFallback).map(s => s.id));
    const blockedDeletes = [];
    for (const orig of realStages) {
      if (remainingIds.has(orig.id)) continue;
      const liveCount = countsByStage[orig.stageKey] || 0;
      if (liveCount > 0) {
        blockedDeletes.push({ name: orig.name, count: liveCount });
        continue;
      }
      await deleteStage(orig.id);
    }
    if (blockedDeletes.length) {
      alert(blockedDeletes.map(b => `Não deu pra remover "${b.name}": ${b.count} tarefa(s) foram movidas pra lá enquanto o editor estava aberto.`).join("\n"));
    }

    const usedKeys = new Set(draft.filter(s => !s.isNew).map(s => s.stageKey));
    for (let i = 0; i < draft.length; i++) {
      const s = draft[i];
      if (s.isNew) {
        let key = slugifyStageKey(s.name);
        let suffix = 1;
        while (usedKeys.has(key)) key = `${slugifyStageKey(s.name)}_${suffix++}`;
        usedKeys.add(key);
        const created = await addStage({ stageKey: key, name: s.name, color: s.color, orderIdx: i, terminal: !!s.terminal });
        if (created?.id) idByRef.set(s.tempId, created.id);
      } else if (fallbackByStageKey.has(s.stageKey)) {
        // Cria a linha real na 1ª vez, mantendo o stageKey original.
        const created = await addStage({ stageKey: s.stageKey, name: s.name, color: s.color, orderIdx: i, terminal: !!s.terminal });
        if (created?.id) idByRef.set(s.stageKey, created.id);
      } else {
        const orig = originalById.get(s.id);
        const changed = orig && (orig.name !== s.name || orig.color !== s.color || orig.terminal !== !!s.terminal);
        if (changed) await updateStage(s.id, { name: s.name, color: s.color, terminal: !!s.terminal });
        idByRef.set(s.stageKey, s.id);
      }
    }

    const orderedIds = draft.map(s => s.isNew ? idByRef.get(s.tempId) : idByRef.get(s.stageKey)).filter(Boolean);
    if (orderedIds.length) await reorderStages(orderedIds);
  };

  return (
    <StageListCore
      open={open}
      onClose={onClose}
      title="Meu To-do"
      warning="Suas etapas são só suas — ninguém mais vê ou é afetado por essa mudança. Não dá pra remover etapa com tarefa dentro."
      stages={stages}
      rowKey={(s) => s.isNew ? s.tempId : s.stageKey}
      getCount={(s) => countsByStage[s.stageKey] || 0}
      makeNewStage={() => ({
        tempId: `new_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        ...NEW_STAGE_DEFAULTS,
      })}
      showProbability={false}
      countLabel="Tarefas"
      onSave={handleSave}
    />
  );
}

export default PersonalStageListManager;
