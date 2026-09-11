import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Comunicação interna (Onda 4, item 11): comunicados (broadcast via
// notifications) + pesquisas anônimas (definição em rh_pesquisas; respostas
// só lidas via RPC de agregação, nunca com identidade).
const BUCKET_ANEXOS = "comunicado-anexos";
// O PDF de assinatura NÃO vai pro bucket de anexos: a edge function `d4sign-send`
// só aceita `rh-documentos-assinatura`, e só um caminho `${domain}/${recordId}/`.
// Isso é decisão de segurança fechada — uma versão anterior aceitava bucket
// arbitrário e dava pra mandar currículo e comprovante pra D4Sign
// (d4sign-send/index.ts:73). Então o comunicado se adapta ao contrato, em vez
// de afrouxá-lo.
const BUCKET_ASSINATURA = "rh-documentos-assinatura";

export function useRHComunicacao({ userId } = {}) {
  const [pesquisas, setPesquisas] = useState([]);
  const [comunicados, setComunicados] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: pesq }, { data: coms }, { data: mods }] = await Promise.all([
        supabase.from("rh_pesquisas").select("*").order("created_at", { ascending: false }),
        supabase.from("rh_comunicados").select("*").order("enviado_em", { ascending: false }).limit(200),
        supabase.from("rh_comunicado_modelos").select("*").order("ordem").order("nome"),
      ]);
      if (!isActive()) return;
      setPesquisas(pesq || []);
      // RLS decide: quem não é gestão de RH/diretoria recebe [] sem erro.
      setComunicados(coms || []);
      setModelos(mods || []);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAll(() => active);
    if (!isSupabaseConfigured) return;
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channel = supabase
      .channel(`rh-pesquisas-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_pesquisas" }, debouncedFetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_comunicados" }, debouncedFetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_comunicado_modelos" }, debouncedFetchAll)
      .subscribe();
    return () => { active = false; debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [fetchAll]);

  // Prévia de alcance ANTES de enviar. Só contagens — a lista de e-mails não
  // sai do banco (comunicado_destinatarios não é chamável pelo client).
  const carregarAlcance = useCallback(async (scopeType = "todos", scopeValue = null) => {
    const { data, error } = await supabase.rpc("comunicado_alcance", {
      p_scope_type: scopeType, p_scope_value: scopeType === "todos" ? null : scopeValue,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      total: Number(row?.total || 0),
      comNotificacao: Number(row?.com_notificacao || 0),
      comEmail: Number(row?.com_email || 0),
      semEmail: Number(row?.sem_email || 0),
    };
  }, []);

  // Dispara o e-mail de um comunicado já registrado. Devolve quantos foram,
  // ou lança com a mensagem REAL da edge function.
  //
  // O desembrulho de `error.context` não é detalhe: `functions.invoke` devolve
  // "Edge Function returned a non-2xx status code" pra qualquer 4xx/5xx e não
  // lê o corpo. Sem isto, toda mensagem que o servidor escreveu em português
  // ("Nenhum destinatário do escopo tem e-mail cadastrado.") morre no SDK e o
  // RH lê inglês genérico. Mesmo padrão de use-ai.js:48 e use-lead-emails.js:56.
  const dispararEmail = useCallback(async (comunicadoId) => {
    const { data, error } = await supabase.functions.invoke("rh-send-email", {
      body: { type: "comunicado", comunicadoId },
    });
    if (error) {
      const corpo = await error.context?.json?.().catch(() => null);
      throw new Error(corpo?.error || error.message);
    }
    return Number(data?.sent || 0);
  }, []);

  // Reenvio do e-mail de um comunicado que ficou pendente ou falhou — sem isso
  // os dois estados eram terminais na tela (a edge function já aceitava a
  // retomada: `.in("email_status", ["pendente","falhou"])`), e a única saída
  // do RH era criar um comunicado novo, duplicando a notificação de quem já
  // tinha recebido pela plataforma.
  const reenviarEmailComunicado = useCallback(async (comunicadoId) => {
    try {
      const enviados = await dispararEmail(comunicadoId);
      return { enviados, erro: null };
    } catch (e) {
      return { enviados: 0, erro: e?.message || "Falha ao enviar por e-mail." };
    } finally {
      await fetchAll();
    }
  }, [dispararEmail, fetchAll]);

  // Comunicado. A RPC grava o registro em `rh_comunicados` e devolve o alcance
  // MEDIDO no envio; o e-mail é um segundo passo, feito pela edge function a
  // partir do id — o client nunca monta a lista de destinatários.
  //
  // `importante` ignora o opt-out de notificações
  // (mention_notifications_enabled), que vale só pro canal plataforma: quem
  // desligou o sino continua recebendo o e-mail, que é o motivo do 2º canal.
  //
  // O e-mail NÃO derruba o envio: a notificação na plataforma já foi gravada e
  // não dá pra desfazer. Falha de e-mail volta como `emailErro` pra tela dizer
  // o que saiu e o que não saiu, em vez de um erro genérico que faria o RH
  // reenviar tudo e duplicar a notificação.
  // Sobe anexo ANTES do comunicado existir, então o caminho usa um id
  // temporário e o arquivo é movido depois? Não: o caminho leva o id do
  // comunicado, e por isso o upload acontece DEPOIS do broadcast — a policy de
  // leitura do destinatário casa a pasta com o id do comunicado, e um arquivo
  // fora dessa pasta seria invisível pra quem recebeu.
  const subirAnexo = useCallback(async (comunicadoId, file, prefixo) => {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const assinatura = prefixo === "documento";
    const bucket = assinatura ? BUCKET_ASSINATURA : BUCKET_ANEXOS;
    const path = assinatura
      ? `comunicado/${comunicadoId}/${Date.now()}.${ext}`
      : `${comunicadoId}/${prefixo}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    return path;
  }, []);

  const enviarComunicado = useCallback(async ({ title, body, scopeType = "todos", scopeValue = null, importante = false, canais = ["plataforma"], sensivel = false, imagem = null, documento = null }) => {
    const { data, error } = await supabase.rpc("broadcast_announcement", {
      p_title: title, p_body: body || null, p_scope_type: scopeType, p_scope_value: scopeValue,
      p_link: null, p_importante: importante, p_canais: canais,
      p_sensivel: sensivel, p_imagem_path: null, p_documento_path: null,
    });
    if (error) throw new Error(error.message);

    const res = {
      canais,
      sensivel,
      comunicadoId: data?.comunicado_id || null,
      anexoErro: null,
      alcancePlataforma: Number(data?.alcance_plataforma || 0),
      alcanceEmail: Number(data?.alcance_email || 0),
      semEmail: Number(data?.sem_email || 0),
      emailEnviado: 0,
      emailErro: null,
    };

    // Anexos depois do registro existir (o caminho precisa do id). Falha aqui
    // NÃO derruba o comunicado: a notificação da plataforma já foi gravada e
    // não dá pra desfazer — a tela diz o que subiu e o que não.
    if (res.comunicadoId && (imagem || documento)) {
      try {
        const patch = {};
        if (imagem)    patch.imagem_path    = await subirAnexo(res.comunicadoId, imagem, "imagem");
        if (documento) patch.documento_path = await subirAnexo(res.comunicadoId, documento, "documento");
        const { data: upd } = await supabase.from("rh_comunicados").update(patch).eq("id", res.comunicadoId).select("id");
        if (!upd || upd.length === 0) res.anexoErro = "O anexo subiu mas não ficou vinculado ao comunicado.";
      } catch (e) {
        res.anexoErro = e?.message || "Não foi possível anexar o arquivo.";
      }
    }

    if (canais.includes("email") && res.comunicadoId) {
      try {
        res.emailEnviado = await dispararEmail(res.comunicadoId);
      } catch (e) {
        res.emailErro = e?.message || "Falha ao enviar por e-mail.";
      }
    }

    await fetchAll();
    return res;
  }, [dispararEmail, fetchAll, subirAnexo]);

  // Assinantes do comunicado: os mesmos destinatários, com nome e e-mail. Sai
  // da lista de leitura (gravada no envio) e não de um recálculo de escopo —
  // quem assina é quem recebeu, não quem estaria no escopo hoje.
  const carregarAssinantes = useCallback(async (comunicadoId) => {
    const { data, error } = await supabase
      .from("rh_comunicado_leituras")
      .select("profiles(name, email)")
      .eq("comunicado_id", comunicadoId);
    if (error) throw new Error(error.message);
    const vistos = new Set();
    const out = [];
    for (const r of data || []) {
      const email = (r.profiles?.email || "").trim();
      if (!email || vistos.has(email.toLowerCase())) continue;
      vistos.add(email.toLowerCase());
      out.push({ name: r.profiles?.name || email, email });
    }
    return out;
  }, []);

  const carregarLeituras = useCallback(async (comunicadoId) => {
    const { data, error } = await supabase.rpc("comunicado_leituras", { p_comunicado_id: comunicadoId });
    if (error) throw new Error(error.message);
    return (data || []).map(r => ({
      profileId: r.profile_id,
      nome: r.nome,
      confirmadoEm: r.confirmado_em,
      origem: r.origem,
      // Quem não tinha canal nenhum não DEIXOU de confirmar — nunca teve como.
      // É a terceira coluna da tela, e ela existe porque somar essa pessoa com
      // quem ignorou faria o número mentir (regra 14).
      semCanal: !r.canal_email && !r.canal_plataforma,
    }));
  }, []);

  const salvarModelo = useCallback(async (modelo) => {
    const row = {
      nome: modelo.nome, titulo: modelo.titulo || null, corpo: modelo.corpo || null,
      importante: !!modelo.importante, sensivel: !!modelo.sensivel,
      icone: modelo.icone || null, created_by: userId,
    };
    const q = modelo.id
      ? supabase.from("rh_comunicado_modelos").update({ ...row, updated_at: new Date().toISOString() }).eq("id", modelo.id).select()
      : supabase.from("rh_comunicado_modelos").insert(row).select();
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar o modelo — sem permissão.");
    await fetchAll();
    return data[0];
  }, [userId, fetchAll]);

  const deletarModelo = useCallback(async (id) => {
    const { data, error } = await supabase.from("rh_comunicado_modelos").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível excluir o modelo — sem permissão.");
    setModelos(prev => prev.filter(m => m.id !== id));
  }, []);

  const criarPesquisa = useCallback(async (data) => {
    const row = {
      titulo: data.titulo,
      descricao: data.descricao || null,
      perguntas: data.perguntas || [],
      abre_em: data.abreEm || null,
      fecha_em: data.fechaEm || null,
      modo: data.modo || "anonima",
      scope_type: data.scopeType || "todos",
      scope_value: data.scopeType && data.scopeType !== "todos" ? data.scopeValue : null,
      created_by: userId,
    };
    const { data: nova, error } = await supabase.from("rh_pesquisas").insert(row).select().single();
    if (error) throw new Error(error.message);
    setPesquisas(prev => [nova, ...prev]);
    return nova;
  }, [userId]);

  // Notifica os colaboradores do escopo — só faz sentido pra pesquisas
  // "identificada" (a RPC recusa pra "anonima").
  const enviarPesquisaNotificacao = useCallback(async (pesquisaId) => {
    const { data, error } = await supabase.rpc("enviar_pesquisa_notificacao", { p_pesquisa_id: pesquisaId });
    if (error) throw new Error(error.message);
    return data ?? 0;
  }, []);

  const setPesquisaStatus = useCallback(async (id, status) => {
    const { data, error } = await supabase.from("rh_pesquisas").update({ status }).eq("id", id).select();
    if (error) throw new Error(error.message);
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    // NÃO lança: src/components/views/RHComunicacaoView.jsx:498 chama sem await
    // e sem catch, então um throw viraria rejeição sem dono, sem avisar
    // ninguém. Refaz o fetch — a tela volta pro estado real do banco em
    // vez de exibir uma mudança que não foi gravada (mesmo desenho do
    // reorder em use-pipelines.js).
    if (!data || data.length === 0) { await fetchAll(); return; }
    setPesquisas(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  }, [fetchAll]);

  const deletarPesquisa = useCallback(async (id) => {
    const { error } = await supabase.from("rh_pesquisas").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setPesquisas(prev => prev.filter(p => p.id !== id));
  }, []);

  // Só o agregado (total + array de respostas sem identidade).
  const carregarRespostas = useCallback(async (pesquisaId) => {
    const { data, error } = await supabase.rpc("pesquisa_respostas_aggregado", { p_pesquisa_id: pesquisaId });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    // `liberado` false = pesquisa anônima que ainda não bateu o mínimo de
    // respondentes. O banco devolve a contagem e NENHUMA resposta — o piso
    // vive lá, não aqui, porque a função é chamável direto por quem tem token.
    return {
      total: Number(row?.total || 0),
      respostas: Array.isArray(row?.respostas) ? row.respostas : [],
      // Nomes na MESMA ordem das respostas (o banco ordena os dois agregados
      // igual). Vem vazio pra pesquisa anônima — e vazio porque o banco não
      // devolve, não porque a tela não pede.
      respondentes: Array.isArray(row?.respondentes) ? row.respondentes : [],
      minimo: Number(row?.minimo || 0),
      liberado: row?.liberado !== false,
    };
  }, []);

  return useMemo(() => ({
    pesquisas, comunicados, modelos, loading,
    enviarComunicado, reenviarEmailComunicado, carregarAlcance, carregarLeituras, carregarAssinantes,
    salvarModelo, deletarModelo,
    criarPesquisa, setPesquisaStatus, deletarPesquisa, carregarRespostas, enviarPesquisaNotificacao,
    refetch: fetchAll,
  }), [pesquisas, comunicados, modelos, loading, enviarComunicado, reenviarEmailComunicado, carregarAlcance, carregarLeituras, carregarAssinantes, salvarModelo, deletarModelo, criarPesquisa, setPesquisaStatus, deletarPesquisa, carregarRespostas, enviarPesquisaNotificacao, fetchAll]);
}
