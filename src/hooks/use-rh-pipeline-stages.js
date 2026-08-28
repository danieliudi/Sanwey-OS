import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "rh_pipeline_stages";

function rowToStage(r) {
  return {
    id: r.id,
    domain: r.domain,
    stageKey: r.stage_key,
    name: r.name,
    color: r.color,
    orderIdx: r.order_idx ?? 0,
    probability: r.probability,
    slaDays: r.sla_days,
    terminal: Boolean(r.terminal),
    won: Boolean(r.won),
    lost: Boolean(r.lost),
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function stageToRow(s) {
  return {
    stage_key: s.stageKey,
    name: s.name,
    color: s.color,
    order_idx: s.orderIdx ?? 0,
    probability: s.probability,
    sla_days: s.slaDays,
    terminal: !!s.terminal,
    won: !!s.won,
    lost: !!s.lost,
  };
}

// camelCase -> coluna, usado só por updateStage (patch parcial — ver abaixo).
const ROW_COLUMN_BY_KEY = {
  stageKey: "stage_key", name: "name", color: "color", orderIdx: "order_idx",
  probability: "probability", slaDays: "sla_days", terminal: "terminal", won: "won", lost: "lost",
};

export function useRHPipelineStages(domain) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .eq("domain", domain)
        .order("order_idx", { ascending: true });
      if (err) throw err;
      if (!isActive()) return;
      setStages((data || []).map(rowToStage));
    } catch (e) {
      if (!isActive()) return;
      setError(e);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) { setLoading(false); return; }
    fetchAll(() => active);
    // Nome de canal único por instância — evita colisão quando o hook é
    // usado por múltiplos componentes ao mesmo tempo.
    const channelName = `rh-pipeline-stages-${domain}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        if (!active) return;
        const matches = payload.new?.domain === domain || payload.old?.domain === domain;
        if (!matches) return;
        if (payload.eventType === "DELETE") {
          setStages(prev => prev.filter(s => s.id !== payload.old.id));
        } else if (payload.eventType === "INSERT") {
          setStages(prev => prev.some(s => s.id === payload.new.id)
            ? prev
            : [...prev, rowToStage(payload.new)].sort((a, b) => a.orderIdx - b.orderIdx));
        } else if (payload.eventType === "UPDATE") {
          setStages(prev => prev
            .map(s => s.id === payload.new.id ? rowToStage(payload.new) : s)
            .sort((a, b) => a.orderIdx - b.orderIdx));
        }
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [fetchAll, domain]);

  const addStage = useCallback(async (stage) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const row = { ...stageToRow(stage), domain };
    const { data, error: err } = await supabase
      .from(TABLE).insert(row).select().single();
    if (err) throw err;
    return rowToStage(data);
  }, [domain]);

  // Update PARCIAL de verdade — só escreve as colunas cuja chave está
  // presente em `patch`. Antes isso passava por stageToRow(patch), que
  // reconstrói o objeto inteiro assumindo todos os campos presentes; pra
  // booleans (terminal/won/lost) ausentes do patch, `!!undefined` virava
  // `false` e SOBRESCREVIA o valor real no banco (não era undefined, então
  // não era removido pelo filtro seguinte) — renomear/recolorir qualquer
  // etapa via RHStageEditorModal (que só manda {name,color,probability,
  // slaDays}) zerava terminal/won/lost silenciosamente. Achado em auditoria
  // ao vivo (22/07), reproduzido em Onboarding e Avaliação de Desempenho.
  const updateStage = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const row = {};
    for (const [key, column] of Object.entries(ROW_COLUMN_BY_KEY)) {
      if (key in patch) row[column] = patch[key];
    }
    const { error: err } = await supabase
      .from(TABLE).update(row).eq("id", id);
    if (err) throw err;
  }, []);

  const deleteStage = useCallback(async (id) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    const { error: err } = await supabase
      .from(TABLE).delete().eq("id", id);
    if (err) throw err;
  }, []);

  const reorderStages = useCallback(async (orderedIds) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado");
    // Atualiza order_idx em sequência.
    await Promise.all(orderedIds.map((id, idx) =>
      supabase.from(TABLE).update({ order_idx: idx }).eq("id", id)
    ));
  }, []);

  // Memoizado — sem isso, cada render devolvia um array novo (mesmo com o
  // mesmo conteúdo), e qualquer useEffect com `stages` na dependência (ex:
  // RHStageEditorModal semeando o rascunho local) disparava de novo a cada
  // render e apagava o que acabou de ser adicionado localmente. Era por
  // isso que "+ Adicionar etapa" parecia não fazer nada.
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.orderIdx - b.orderIdx),
    [stages]
  );

  return {
    stages: sortedStages,
    loading,
    error,
    addStage,
    updateStage,
    deleteStage,
    reorderStages,
    refetch: fetchAll,
  };
}

export default useRHPipelineStages;
