import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

// Documentos de admissão (opção B, decidida com o Daniel em 11/09/2026).
//
// Origem dos números que este hook alimenta (CLAUDE.md regra 14): a contagem
// do cabeçalho vem de `rh_colaborador_documentos.status` — `recebido` conta
// como entregue, `nao_se_aplica` sai do denominador (não é pendência de
// ninguém), e o denominador exibido é sempre o total menos os dispensados.
// Nenhum percentual: são 17 itens, contagem inteira é mais honesta e mais
// legível que "88%".
const BUCKET = "rh-documentos-colaborador";
// Igual ao `file_size_limit` do bucket. Conferir aqui evita o usuário esperar
// o upload inteiro pra receber a mensagem crua do Storage — mesmo cuidado que
// NovoColaboradorModal.jsx já toma pro mesmo bucket.
const MAX_BYTES = 10 * 1024 * 1024;

export function useRHDocumentos({ colaboradorId } = {}) {
  const [tipos, setTipos]           = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading]       = useState(true);

  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured || !colaboradorId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: tiposData }, { data: docsData }] = await Promise.all([
        supabase.from("rh_documento_tipos").select("*").eq("ativo", true).order("ordem", { ascending: true }),
        supabase.from("rh_colaborador_documentos").select("*").eq("colaborador_id", colaboradorId),
      ]);
      if (!isActive()) return;
      setTipos(tiposData || []);
      setDocumentos(docsData || []);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [colaboradorId]);

  useEffect(() => {
    let active = true;
    fetchAll(() => active);
    if (!isSupabaseConfigured || !colaboradorId) return;
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channelName = `rh-documentos-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_colaborador_documentos", filter: `colaborador_id=eq.${colaboradorId}` }, debouncedFetchAll)
      .subscribe();
    return () => {
      active = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll, colaboradorId]);

  // Abre a relação inteira pra este colaborador. Idempotente do lado do banco
  // — chamar de novo só acrescenta tipo que passou a existir depois.
  const abrirRelacao = useCallback(async () => {
    const { data, error } = await supabase.rpc("abrir_documentos_admissao", { p_colaborador_id: colaboradorId });
    if (error) throw new Error(error.message);
    await fetchAll();
    return Number(data || 0);
  }, [colaboradorId, fetchAll]);

  // RLS nega devolvendo `data: []` com `error: null` (classe de bug já
  // conhecida nesta plataforma) — por isso todo update confere a contagem
  // do `.select()` em vez de acreditar na ausência de erro.
  const salvar = useCallback(async (docId, patch) => {
    const { data, error } = await supabase
      .from("rh_colaborador_documentos").update(patch).eq("id", docId).select("*");
    if (error) return { ok: false, motivo: error.message };
    if (!data || data.length === 0) return { ok: false, motivo: "Sem permissão para alterar este documento." };
    setDocumentos((prev) => prev.map((d) => (d.id === docId ? data[0] : d)));
    return { ok: true, documento: data[0] };
  }, []);

  const marcarStatus = useCallback((docId, status) => salvar(docId, { status }), [salvar]);

  const anexar = useCallback(async (doc, file) => {
    if (file.size > MAX_BYTES) {
      return { ok: false, motivo: `O arquivo tem ${(file.size / 1048576).toFixed(1)} MB — o limite é 10 MB.` };
    }
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${doc.colaborador_id}/${doc.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { ok: false, motivo: error.message };
    // Anexar já marca recebido: quem sobe o arquivo está dizendo que chegou.
    // Quem assina o "recebido" é o banco (trigger), não este objeto.
    return salvar(doc.id, { arquivo_path: path, arquivo_nome: file.name, status: "recebido" });
  }, [salvar]);

  // Apaga o arquivo ANTES de limpar o ponteiro, e só limpa se a remoção deu
  // certo. Na ordem contrária (ou ignorando o erro), um RG negado pelo Storage
  // ficaria órfão no bucket privado sem nada apontando pra ele — ninguém mais
  // acharia pra apagar depois.
  const removerArquivo = useCallback(async (doc) => {
    if (doc.arquivo_path) {
      const { error } = await supabase.storage.from(BUCKET).remove([doc.arquivo_path]);
      if (error) return { ok: false, motivo: `Não foi possível apagar o arquivo: ${error.message}` };
    }
    return salvar(doc.id, { arquivo_path: null, arquivo_nome: null, status: "pendente" });
  }, [salvar]);

  // Tipo com `aceita_varios` (dependentes, vacinação, certificados) guarda
  // mais de um arquivo criando outra LINHA do mesmo tipo, não um array dentro
  // da linha: assim cada arquivo mantém o próprio status, observação e
  // carimbo de quem recebeu, que é o que o RH confere um a um.
  const duplicarItem = useCallback(async (doc) => {
    const { data, error } = await supabase
      .from("rh_colaborador_documentos")
      .insert({ colaborador_id: doc.colaborador_id, tipo_id: doc.tipo_id })
      .select("*");
    if (error) return { ok: false, motivo: error.message };
    if (!data || data.length === 0) return { ok: false, motivo: "Sem permissão para acrescentar este documento." };
    setDocumentos((prev) => [...prev, data[0]]);
    return { ok: true, documento: data[0] };
  }, []);

  const removerItem = useCallback(async (doc) => {
    if (doc.arquivo_path) {
      const { error } = await supabase.storage.from(BUCKET).remove([doc.arquivo_path]);
      if (error) return { ok: false, motivo: `Não foi possível apagar o arquivo: ${error.message}` };
    }
    const { data, error } = await supabase
      .from("rh_colaborador_documentos").delete().eq("id", doc.id).select("id");
    if (error) return { ok: false, motivo: error.message };
    if (!data || data.length === 0) return { ok: false, motivo: "Sem permissão para excluir este documento." };
    setDocumentos((prev) => prev.filter((d) => d.id !== doc.id));
    return { ok: true };
  }, []);

  // URL assinada em vez de bucket público: o bucket guarda RG e CPF.
  const abrirArquivo = useCallback(async (doc) => {
    if (!doc.arquivo_path) return { ok: false, motivo: "Sem arquivo." };
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.arquivo_path, 60);
    if (error || !data?.signedUrl) return { ok: false, motivo: error?.message || "Não foi possível abrir o arquivo." };
    return { ok: true, url: data.signedUrl };
  }, []);

  return { tipos, documentos, loading, abrirRelacao, marcarStatus, salvar, anexar, removerArquivo, duplicarItem, removerItem, abrirArquivo, refetch: fetchAll };
}
