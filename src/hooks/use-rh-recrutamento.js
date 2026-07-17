import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Slug único e legível pro link público da vaga: título + sufixo curto.
function slugify(title) {
  const base = (title || "vaga")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "vaga"}-${suffix}`;
}

// Junta rh_aplicacoes + rh_candidatos num objeto de card único, mantendo os
// nomes de campo que RHRecrutamentoView já espera (vaga_id, stage,
// stage_changed_at, name, email…) — só que agora "id" é o id da aplicação,
// não do candidato, porque etapa/nota/avaliação pertencem à aplicação.
function joinAplicacao(aplicacao, candidatosById) {
  const cand = candidatosById.get(aplicacao.candidate_id) || {};
  return {
    id: aplicacao.id,
    candidateId: aplicacao.candidate_id,
    vaga_id: aplicacao.vaga_id,
    name: cand.name || "—",
    email: cand.email || null,
    phone: cand.phone || null,
    linkedin_url: cand.linkedin_url || null,
    resume_ext: cand.resume_ext || null,
    source: cand.source || null,
    stage: aplicacao.etapa_pipeline,
    stage_changed_at: aplicacao.stage_changed_at,
    fit_score: aplicacao.fit_score,
    justificativa: aplicacao.justificativa,
    pontos_fortes: aplicacao.pontos_fortes || [],
    gaps: aplicacao.gaps || [],
    motivo_reprovacao: aplicacao.motivo_reprovacao,
    notes: aplicacao.notes || [],
    rating: aplicacao.rating,
    created_at: aplicacao.created_at,
    hired_at: aplicacao.hired_at || null,
    // Campos customizados por etapa (rh_pipeline_stage_fields) e timeline de
    // atividades — usados pelo RHDetailDrawerShell / RHStageFieldInput.
    customFields: aplicacao.custom_fields || {},
    activities: aplicacao.activities || [],
  };
}

export function useRHRecrutamento({ userId } = {}) {
  const [vagas, setVagas]           = useState([]);
  const [candidatosPool, setCandidatosPool] = useState([]); // talent pool bruto (rh_candidatos)
  const [aplicacoes, setAplicacoes] = useState([]);
  const [loading, setLoading]       = useState(true);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: vagasData }, { data: candData }, { data: aplicData }] = await Promise.all([
        supabase.from("rh_vagas").select("*").order("created_at", { ascending: false }),
        supabase.from("rh_candidatos").select("*").order("created_at", { ascending: false }),
        supabase.from("rh_aplicacoes").select("*").order("created_at", { ascending: false }),
      ]);
      if (!activeRef.current) return;
      setVagas(vagasData || []);
      setCandidatosPool(candData || []);
      setAplicacoes(aplicData || []);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    fetchAll();
    if (!isSupabaseConfigured) return;
    // Realtime: qualquer mudança nas 3 tabelas recarrega tudo. O volume do
    // módulo de RH é baixo, então um refetch simples é mais robusto do que
    // reconciliar patches otimistas em 3 tabelas relacionadas.
    const channelName = `rh-recrutamento-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_vagas" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_candidatos" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_aplicacoes" }, fetchAll)
      .subscribe();
    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const candidatos = useMemo(() => {
    const byId = new Map(candidatosPool.map(c => [c.id, c]));
    return aplicacoes.map(a => joinAplicacao(a, byId));
  }, [aplicacoes, candidatosPool]);

  const createVaga = useCallback(async (data) => {
    const row = {
      ...data,
      link_slug: slugify(data.title),
      created_by: userId,
    };
    const { data: novaVaga, error } = await supabase.from("rh_vagas").insert(row).select().single();
    if (error) throw new Error(error.message);
    setVagas(prev => [novaVaga, ...prev]);
    return novaVaga;
  }, [userId]);

  const updateVaga = useCallback(async (id, patch) => {
    const { error } = await supabase.from("rh_vagas").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    setVagas(prev => prev.map(v => v.id === id ? { ...v, ...patch } : v));
  }, []);

  const changeVagaStage = useCallback(async (id, newStage) => {
    await updateVaga(id, { stage: newStage, stage_changed_at: new Date().toISOString() });
  }, [updateVaga]);

  // Cria/atualiza o candidato no talent pool (dedup por e-mail) e cria a
  // aplicação para a vaga selecionada. Requer vaga — toda aplicação pertence
  // a uma vaga; para só cadastrar no talent pool sem vincular a nada, use a
  // tela de triagem por IA (Fase 2).
  const createCandidato = useCallback(async (data) => {
    if (!data.vaga_id) throw new Error("Selecione a vaga.");
    const email = data.email || null;
    const candidateRow = { name: data.name, email, phone: data.phone || null, source: data.source || null, created_by: userId };
    const { data: cand, error: candErr } = email
      ? await supabase.from("rh_candidatos").upsert(candidateRow, { onConflict: "email" }).select().single()
      : await supabase.from("rh_candidatos").insert(candidateRow).select().single();
    if (candErr) throw new Error(candErr.message);

    const { data: aplic, error: aplicErr } = await supabase
      .from("rh_aplicacoes")
      .upsert(
        { candidate_id: cand.id, vaga_id: data.vaga_id, etapa_pipeline: data.stage || "triagem" },
        { onConflict: "candidate_id,vaga_id" }
      )
      .select()
      .single();
    if (aplicErr) throw new Error(aplicErr.message);

    await fetchAll();
    return aplic;
  }, [userId, fetchAll]);

  // Patch genérico numa aplicação — usado pelo Kanban de Candidatos pra
  // persistir custom_fields (RHStageFieldInput) e activities
  // (RHDetailDrawerShell) sem precisar de um método dedicado por coluna,
  // no mesmo espírito do updateVaga acima.
  const updateAplicacao = useCallback(async (id, patch) => {
    const { error } = await supabase.from("rh_aplicacoes").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    setAplicacoes(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, []);

  const changeStage = useCallback(async (aplicacaoId, newStage, motivoReprovacao) => {
    const patch = { etapa_pipeline: newStage, stage_changed_at: new Date().toISOString() };
    // Não trava mais no id fixo "reprovado" — qualquer etapa customizada
    // marcada como "lost" no editor de etapas passa motivo do mesmo jeito.
    if (motivoReprovacao !== undefined) patch.motivo_reprovacao = motivoReprovacao || null;
    const { error } = await supabase.from("rh_aplicacoes").update(patch).eq("id", aplicacaoId);
    if (error) throw new Error(error.message);
    setAplicacoes(prev => prev.map(a => a.id === aplicacaoId ? { ...a, ...patch } : a));
  }, []);

  // Reprovação em massa (Áudio 8 do RH): move N aplicações pra etapa "lost"
  // com um motivo único e dispara UM e-mail de retorno negativo em cópia
  // oculta pros candidatos que têm e-mail. O envio é NÃO-BLOQUEANTE: a
  // reprovação persiste mesmo se o e-mail falhar. lostStageKey é resolvido
  // pelo chamador (a etapa marcada como lost no editor), não hardcodado.
  const bulkReprovarComEmail = useCallback(async ({ aplicacaoIds = [], lostStageKey, motivo, enviarEmail = true, vagaTitle = "" }) => {
    const ids = [...new Set(aplicacaoIds)].filter(Boolean);
    if (!ids.length) return { movidos: 0, emails: 0, semEmail: 0, emailOk: false };

    // 1) Move em lote pra etapa de reprovação (quando informada).
    if (lostStageKey) {
      const patch = { etapa_pipeline: lostStageKey, stage_changed_at: new Date().toISOString() };
      if (motivo !== undefined) patch.motivo_reprovacao = motivo || null;
      const { error } = await supabase.from("rh_aplicacoes").update(patch).in("id", ids);
      if (error) throw new Error(error.message);
      setAplicacoes(prev => prev.map(a => ids.includes(a.id) ? { ...a, ...patch } : a));
    }

    // 2) Coleta e-mails únicos dos candidatos selecionados (filtra sem e-mail).
    const emailById = new Map(candidatosPool.map(c => [c.id, c.email]));
    const idSet = new Set(ids);
    const selected = aplicacoes.filter(a => idSet.has(a.id));
    const emails = [...new Set(selected.map(a => emailById.get(a.candidate_id)).filter(Boolean))];
    const semEmail = selected.filter(a => !emailById.get(a.candidate_id)).length;

    // 3) Um único disparo em BCC (não-bloqueante).
    let emailOk = false;
    if (enviarEmail && emails.length) {
      try {
        const { error } = await supabase.functions.invoke("rh-send-email", {
          body: {
            type: "candidato_reprovado",
            to: "noreply@sanwey.com.br",
            bcc: emails,
            variables: { VAGA_TITLE: vagaTitle || "—" },
          },
        });
        if (error) throw error;
        emailOk = true;
      } catch (e) {
        console.warn("[use-rh-recrutamento] reprovação em massa: e-mail falhou:", e);
      }
    }
    return { movidos: ids.length, emails: emailOk ? emails.length : 0, semEmail, emailOk };
  }, [aplicacoes, candidatosPool]);

  // Avanço em massa (Onda 2, item 5): move N aplicações pra uma etapa qualquer
  // do funil de uma vez — triagem rápida do banco de talentos. Mesmo padrão
  // .update().in('id', ids) da reprovação em massa, sem o envio de e-mail.
  const bulkMoveStage = useCallback(async ({ aplicacaoIds = [], stageKey }) => {
    const ids = [...new Set(aplicacaoIds)].filter(Boolean);
    if (!ids.length || !stageKey) return { movidos: 0 };
    const patch = { etapa_pipeline: stageKey, stage_changed_at: new Date().toISOString() };
    const { error } = await supabase.from("rh_aplicacoes").update(patch).in("id", ids);
    if (error) throw new Error(error.message);
    setAplicacoes(prev => prev.map(a => ids.includes(a.id) ? { ...a, ...patch } : a));
    return { movidos: ids.length };
  }, []);

  // Marca a aplicação como contratada (usado após converter o candidato em
  // funcionário) — dá sinal durável de "já contratado" e trava a 2ª conversão.
  const markHired = useCallback(async (aplicacaoId) => {
    const when = new Date().toISOString();
    const { error } = await supabase.from("rh_aplicacoes").update({ hired_at: when }).eq("id", aplicacaoId);
    if (error) throw new Error(error.message);
    setAplicacoes(prev => prev.map(a => a.id === aplicacaoId ? { ...a, hired_at: when } : a));
  }, []);

  const addNote = useCallback(async (aplicacaoId, note) => {
    const current = aplicacoes.find(a => a.id === aplicacaoId);
    const notes = [...(current?.notes || []), note];
    const { error } = await supabase.from("rh_aplicacoes").update({ notes }).eq("id", aplicacaoId);
    if (error) throw new Error(error.message);
    setAplicacoes(prev => prev.map(a => a.id === aplicacaoId ? { ...a, notes } : a));
  }, [aplicacoes]);

  const changeRating = useCallback(async (aplicacaoId, rating) => {
    const { error } = await supabase.from("rh_aplicacoes").update({ rating }).eq("id", aplicacaoId);
    if (error) throw new Error(error.message);
    setAplicacoes(prev => prev.map(a => a.id === aplicacaoId ? { ...a, rating } : a));
  }, []);

  // Vincula um candidato do talent pool a uma vaga já com o resultado da
  // triagem por IA preenchido (fit_score/justificativa/pontos_fortes/gaps).
  // Upsert: se o candidato já tinha uma aplicação para essa vaga, atualiza o
  // resultado em vez de duplicar.
  const attachTriagemToVaga = useCallback(async (candidateId, vagaId, triagem) => {
    const { data: aplic, error } = await supabase
      .from("rh_aplicacoes")
      .upsert(
        {
          candidate_id: candidateId,
          vaga_id: vagaId,
          fit_score: triagem.fitScore,
          justificativa: triagem.justificativa,
          pontos_fortes: triagem.pontosFortes || [],
          gaps: triagem.gaps || [],
        },
        { onConflict: "candidate_id,vaga_id" }
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    await fetchAll();
    return aplic;
  }, [fetchAll]);

  return useMemo(() => ({
    vagas,
    candidatos,
    talentPool: candidatosPool,
    aplicacoesRaw: aplicacoes,
    loading,
    createVaga,
    updateVaga,
    changeVagaStage,
    createCandidato,
    changeStage,
    bulkReprovarComEmail,
    bulkMoveStage,
    updateAplicacao,
    addNote,
    changeRating,
    markHired,
    attachTriagemToVaga,
    refetch: fetchAll,
  }), [vagas, candidatos, candidatosPool, aplicacoes, loading, createVaga, updateVaga, changeVagaStage, createCandidato, changeStage, bulkReprovarComEmail, bulkMoveStage, updateAplicacao, addNote, changeRating, markHired, attachTriagemToVaga, fetchAll]);
}
