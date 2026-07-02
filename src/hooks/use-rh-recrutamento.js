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
    const channel = supabase
      .channel("rh-recrutamento")
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
      status: "aberta",
      created_by: userId,
    };
    const { data: novaVaga, error } = await supabase.from("rh_vagas").insert(row).select().single();
    if (error) throw new Error(error.message);
    setVagas(prev => [novaVaga, ...prev]);
    return novaVaga;
  }, [userId]);

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

  const changeStage = useCallback(async (aplicacaoId, newStage, motivoReprovacao) => {
    const patch = { etapa_pipeline: newStage, stage_changed_at: new Date().toISOString() };
    if (newStage === "reprovado") patch.motivo_reprovacao = motivoReprovacao || null;
    const { error } = await supabase.from("rh_aplicacoes").update(patch).eq("id", aplicacaoId);
    if (error) throw new Error(error.message);
    setAplicacoes(prev => prev.map(a => a.id === aplicacaoId ? { ...a, ...patch } : a));
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

  return useMemo(() => ({
    vagas,
    candidatos,
    loading,
    createVaga,
    createCandidato,
    changeStage,
    addNote,
    changeRating,
    refetch: fetchAll,
  }), [vagas, candidatos, loading, createVaga, createCandidato, changeStage, addNote, changeRating, fetchAll]);
}
