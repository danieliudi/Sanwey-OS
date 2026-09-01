import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { defaultPipelines, DEFAULT_PIPELINE_STAGES } from "../constants/pipelines";
import { debounce } from "../utils/debounce";

// Gerencia o pipeline de cada empresa (etapas, ordem, cor, probabilidade,
// código, SLA). Migrado de localStorage pra Supabase (tabela
// rh_pipeline_stages, domain='comercial', escopada por company_id) — troca
// de armazenamento sem alterar a API exposta, como já estava previsto no
// comentário original deste hook. Compartilhado entre usuários agora,
// diferente de antes (por navegador).

const DOMAIN = "comercial";

function rowToStage(r) {
  return {
    id: r.stage_key,
    dbId: r.id,
    name: r.name,
    code: r.code || "",
    color: r.color,
    probability: r.probability,
    slaDays: r.sla_days,
    // Descrição da etapa (migration 20260901180000). Precisa estar nos DOIS
    // sentidos: `updateStage` monta a linha com {...current, ...patch}, então
    // se o read não trouxesse a descrição, salvar qualquer outro campo da
    // etapa apagaria o texto sem ninguém pedir.
    description: r.description ?? null,
    terminal: r.terminal,
    won: r.won,
    lost: r.lost,
    cardPreviewFields: Array.isArray(r.card_preview_fields) && r.card_preview_fields.length ? r.card_preview_fields : null,
  };
}

function stageToRow(companyId, s, orderIdx) {
  return {
    domain: DOMAIN,
    company_id: companyId,
    stage_key: s.id,
    name: s.name,
    code: s.code || null,
    color: s.color,
    order_idx: orderIdx,
    probability: s.probability ?? null,
    sla_days: s.slaDays ?? null,
    description: s.description ?? null,
    terminal: !!s.terminal,
    won: !!s.won,
    lost: !!s.lost,
    card_preview_fields: Array.isArray(s.cardPreviewFields) && s.cardPreviewFields.length ? s.cardPreviewFields : null,
  };
}

export function usePipelines() {
  const [pipelines, setPipelines] = useState(() => defaultPipelines());

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from("rh_pipeline_stages")
      .select("*")
      .eq("domain", DOMAIN)
      .order("order_idx", { ascending: true });
    if (error || !isActive()) return;
    const grouped = {};
    for (const row of data || []) {
      (grouped[row.company_id] ||= []).push(rowToStage(row));
    }
    // Empresa sem nenhuma linha ainda (nunca deveria acontecer pós-seed,
    // mas defensivo) cai no default local, igual ao comportamento antigo.
    setPipelines(prev => ({ ...prev, ...grouped }));
  }, []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) return;
    fetchAll(() => active);
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channel = supabase
      .channel(`pipeline-stages-comercial-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_pipeline_stages" }, (payload) => {
        if (!active) return;
        const row = payload.new?.domain === DOMAIN ? payload.new : (payload.old?.domain === DOMAIN ? payload.old : null);
        if (!row) return;
        debouncedFetchAll(); // mudança de company/reorder é mais simples de refetch que reconciliar linha a linha
      })
      .subscribe();
    return () => { active = false; debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [fetchAll]);

  // Patch numa etapa específica (não muda ordem, só campos).
  const updateStage = useCallback(async (companyId, stageId, patch) => {
    setPipelines(prev => {
      const list = prev[companyId] || DEFAULT_PIPELINE_STAGES.map(s => ({ ...s }));
      const next = list.map(s => s.id === stageId ? { ...s, ...patch } : s);
      return { ...prev, [companyId]: next };
    });
    if (!isSupabaseConfigured) return;
    const current = (pipelines[companyId] || []).find(s => s.id === stageId);
    if (!current?.dbId) return;
    const row = stageToRow(companyId, { ...current, ...patch }, undefined);
    delete row.order_idx; // não mexe em ordem aqui
    // `.select()`: um UPDATE barrado pela RLS volta error:null/data:[], então
    // sem contar linha o otimista acima ficava de pé como se tivesse gravado.
    // Não lança (o chamador deste hook não trata exceção) — segue o mesmo
    // caminho do erro, que é refetch pra voltar ao estado real do banco.
    const { data, error } = await supabase.from("rh_pipeline_stages").update(row).eq("id", current.dbId).select();
    if (error || !data || data.length === 0) await fetchAll();
  }, [pipelines, fetchAll]);

  // Reordena. orderedIds deve conter todos os IDs da empresa (não remove,
  // só rearranja). Terminais permanecem no fim por convenção da UI.
  const reorderStages = useCallback(async (companyId, orderedIds) => {
    setPipelines(prev => {
      const list = prev[companyId] || DEFAULT_PIPELINE_STAGES.map(s => ({ ...s }));
      const byId = Object.fromEntries(list.map(s => [s.id, s]));
      const next = orderedIds.map(id => byId[id]).filter(Boolean);
      for (const s of list) if (!next.some(n => n.id === s.id)) next.push(s);
      return { ...prev, [companyId]: next };
    });
    if (!isSupabaseConfigured) return;
    const list = pipelines[companyId] || [];
    const results = await Promise.all(orderedIds.map((stageId, idx) => {
      const s = list.find(x => x.id === stageId);
      if (!s?.dbId) return null;
      return supabase.from("rh_pipeline_stages").update({ order_idx: idx }).eq("id", s.dbId).select();
    }));
    // Zero linha conta como falha junto com o erro: RLS barrando o reorder
    // volta error:null/data:[], e sem isso a ordem nova ficava só na tela.
    if (results.some(r => r?.error || (r && (!r.data || r.data.length === 0)))) await fetchAll();
  }, [pipelines, fetchAll]);

  const resetCompanyPipeline = useCallback(async (companyId) => {
    const fresh = DEFAULT_PIPELINE_STAGES.map(s => ({ ...s }));
    setPipelines(prev => ({ ...prev, [companyId]: fresh }));
    if (!isSupabaseConfigured) return;
    // Engole o throw do replacePipeline: aqui não há modal aberto pra
    // segurar — o fetchAll interno já reverteu a UI pro estado do banco.
    await replacePipeline(companyId, fresh).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Substitui o pipeline inteiro de uma empresa. Usado pelo editor que
  // trabalha sobre um draft e só persiste no Save. Faz diff contra o que
  // está no banco pra add/update/delete/reorder em vez de apagar tudo e
  // recriar (preserva referências/FKs de outras tabelas pro stage_key).
  const replacePipeline = useCallback(async (companyId, stages) => {
    setPipelines(prev => ({ ...prev, [companyId]: stages.map(s => ({ ...s })) }));
    if (!isSupabaseConfigured) return;

    const { data: existingRows } = await supabase
      .from("rh_pipeline_stages").select("*").eq("domain", DOMAIN).eq("company_id", companyId);
    const existingByKey = new Map((existingRows || []).map(r => [r.stage_key, r]));
    const keepKeys = new Set(stages.map(s => s.id));
    let hadError = false;

    for (const row of existingRows || []) {
      if (!keepKeys.has(row.stage_key)) {
        const { error } = await supabase.from("rh_pipeline_stages").delete().eq("id", row.id);
        if (error) hadError = true;
        // Limpa dado dependente da etapa removida — sem isso ficavam linhas
        // órfãs em pipeline_stage_transitions (matriz de transição aceitando/
        // bloqueando mover PRA ou DE uma etapa que não existe mais) e em
        // pipeline_stage_fields (campos customizados de uma etapa apagada,
        // nunca mais visíveis/editáveis mas ocupando espaço no banco).
        if (!error) {
          await supabase.from("pipeline_stage_transitions").delete()
            .eq("domain", DOMAIN).eq("company_id", companyId)
            .or(`from_stage_key.eq.${row.stage_key},to_stage_key.eq.${row.stage_key}`);
          await supabase.from("pipeline_stage_fields").delete()
            .eq("company_id", companyId).eq("stage_id", row.stage_key);
        }
      }
    }

    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      const row = stageToRow(companyId, s, i);
      const existing = existingByKey.get(s.id);
      // No ramo de UPDATE, `.select()` + zero linha entra no mesmo hadError:
      // a RLS barrando volta error:null/data:[], e sem isso o editor salvava
      // "com sucesso" um pipeline que o banco não aceitou.
      const { data: escrito, error } = existing
        ? await supabase.from("rh_pipeline_stages").update(row).eq("id", existing.id).select()
        : await supabase.from("rh_pipeline_stages").insert(row).select();
      if (error || !escrito || escrito.length === 0) hadError = true;
    }

    // replacePipeline não é atômico (várias escritas sequenciais) — se
    // alguma falhar no meio, reverte o otimista pro estado real do banco
    // em vez de deixar a UI mostrar um pipeline que só existe no client.
    // E lança: sem o throw, o editor de etapas fechava o modal como se
    // tivesse salvo (o catch/alert do StageListManager nunca disparava).
    if (hadError) {
      await fetchAll();
      throw new Error("Nem todas as etapas foram salvas — o pipeline foi recarregado do banco.");
    }
  }, [fetchAll]);

  return { pipelines, updateStage, reorderStages, resetCompanyPipeline, replacePipeline };
}

export default usePipelines;
