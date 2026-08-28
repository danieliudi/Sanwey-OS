import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Resumo de execução por automação (Agent Builder, docs/prd-agent-builder.md
// seção 3) — "quando rodou pela última vez" e contagem de sugestões geradas,
// usado pelos cards da aba "Agentes de IA" em AutomationsView.jsx. Calculado
// client-side a partir de agent_actions; não existe coluna "last_run_at" na
// tabela automations, então isto lê o rastro que o agent-runner já deixa.
export function useAgentRunsSummary() {
  const [summary, setSummary] = useState(new Map());

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from("agent_actions")
      .select("automation_id, created_at, status")
      .not("automation_id", "is", null);
    if (error || !isActive()) return;
    const map = new Map();
    for (const row of data || []) {
      const id = row.automation_id;
      if (!id) continue;
      const entry = map.get(id) || { lastRunAt: null, totalCount: 0, pendingCount: 0 };
      entry.totalCount += 1;
      if (row.status === "pending") entry.pendingCount += 1;
      if (!entry.lastRunAt || new Date(row.created_at) > new Date(entry.lastRunAt)) entry.lastRunAt = row.created_at;
      map.set(id, entry);
    }
    setSummary(map);
  }, []);

  useEffect(() => {
    let active = true;
    fetchAll(() => active);
    if (!isSupabaseConfigured) return undefined;
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channel = supabase
      .channel(`agent-runs-summary-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_actions" }, debouncedFetchAll)
      .subscribe();
    return () => {
      active = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  return summary;
}

export default useAgentRunsSummary;
