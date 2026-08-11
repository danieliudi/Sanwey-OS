import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "personal_task_dependencies";

function rowToDep(r) {
  return { id: r.id, taskId: r.task_id, dependsOnId: r.depends_on_id };
}

// Ciclo é checado aqui, em código — não dá pra expressar "task_id não pode
// alcançar de volta depends_on_id percorrendo a cadeia" num CHECK simples do
// Postgres (ver migration personal_task_dependencies_and_automations).
// Percorre a partir de `dependsOnId` seguindo as dependências JÁ salvas
// (dependsOnId depende de quem?) — se `taskId` aparecer nesse caminho,
// significa que dependsOnId (direta ou indiretamente) já depende de taskId,
// então taskId->dependsOnId fecharia um ciclo.
function wouldCreateCycle(taskId, dependsOnId, deps) {
  if (taskId === dependsOnId) return true;
  const visited = new Set();
  const stack = [dependsOnId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const d of deps) {
      if (d.taskId === current) stack.push(d.dependsOnId);
    }
  }
  return false;
}

export function usePersonalTaskDependencies(userId) {
  const [deps, setDeps] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) { setLoading(false); return; }
    const { data, error } = await supabase.from(TABLE).select("*");
    if (!error) setDeps((data || []).map(rowToDep));
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addDependency = useCallback(async (taskId, dependsOnId) => {
    if (!isSupabaseConfigured || !userId || !taskId || !dependsOnId) return { error: "Dados inválidos." };
    if (wouldCreateCycle(taskId, dependsOnId, deps)) {
      return { error: "Isso criaria uma dependência circular — essa tarefa já depende (direta ou indiretamente) da que você escolheu." };
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ user_id: userId, task_id: taskId, depends_on_id: dependsOnId })
      .select()
      .single();
    if (error) return { error: error.code === "23505" ? "Essa dependência já existe." : error.message };
    const mapped = rowToDep(data);
    setDeps(prev => [...prev, mapped]);
    return { data: mapped };
  }, [userId, deps]);

  const removeDependency = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    await supabase.from(TABLE).delete().eq("id", id);
    setDeps(prev => prev.filter(d => d.id !== id));
  }, []);

  const getDependencies = useCallback((taskId) => deps.filter(d => d.taskId === taskId), [deps]);

  // Tarefa "bloqueada" = tem pelo menos 1 dependência cujo status atual (via
  // tasksById, já carregado por usePersonalTasks) não está numa etapa
  // marcada `terminal` (personal_task_stages.terminal — mesmo flag que o
  // editor de etapas já expõe, não a string fixa "feito": etapa é
  // configurável por usuário, então "concluído" pode ser uma etapa custom
  // diferente da 3ª etapa original). `terminalStageKeys` é um Set calculado
  // por quem chama, a partir de `columns`. Vive aqui (não em
  // usePersonalTasks) porque só quem já carregou as duas fontes (deps +
  // tasks) consegue cruzar as duas.
  const getBlockers = useCallback((taskId, tasksById, terminalStageKeys) => {
    return deps
      .filter(d => d.taskId === taskId)
      .map(d => tasksById?.[d.dependsOnId])
      .filter(t => t && !terminalStageKeys?.has(t.status));
  }, [deps]);

  return { deps, loading, addDependency, removeDependency, getDependencies, getBlockers, refetch: fetchAll };
}

export default usePersonalTaskDependencies;
