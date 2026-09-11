import React, { useMemo, useRef, useState } from "react";
import { Check, Paperclip, X, FileText, MessageSquare, Minus, Plus, AlertTriangle } from "lucide-react";
import { useRHDocumentos } from "../../hooks/use-rh-documentos";
import { formatDateBR } from "../../utils/date";

// Relação de documentos de admissão de um colaborador (opção B do mockup de
// 11/09/2026): cada item guarda o arquivo, quem recebeu e uma observação.
//
// Mora dentro da aba "Form" do drawer de Onboarding, junto do checklist de
// integração — não vira aba nova no RHDetailDrawerShell, que serve 6 telas de
// RH e não deve ganhar prop específica de uma delas (CLAUDE.md regra 4: só na
// 3ª ocorrência real se extrai/generaliza).

const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };

const GRUPO_LABELS = {
  identificacao: "Identificação",
  residencia: "Residência",
  trabalho: "Trabalho",
  familia: "Família",
  saude: "Saúde",
  formacao: "Formação",
  outros: "Outros",
};

function StatusBox({ status, onClick, disabled }) {
  const recebido = status === "recebido";
  const dispensado = status === "nao_se_aplica";
  const bg = recebido ? "var(--accent)" : dispensado ? "var(--surface-alt)" : "transparent";
  const border = recebido ? "var(--accent)" : "var(--border-strong)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={recebido ? "Recebido — clique para voltar a pendente" : dispensado ? "Não se aplica — clique para voltar a pendente" : "Marcar como recebido"}
      style={{
        width: 16, height: 16, borderRadius: 5, flexShrink: 0, padding: 0,
        border: `1.5px solid ${border}`, background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
      }}
    >
      {recebido && <Check size={11} color="var(--on-accent)" strokeWidth={3} />}
      {dispensado && <Minus size={11} color="var(--text-dim)" strokeWidth={3} />}
    </button>
  );
}

function DocumentoRow({ doc, tipo, canWrite, recebedor, onToggleStatus, onDispensar, onAnexar, onAbrir, onRemover, onObservacao, onDuplicar, onExcluirItem, podeExcluirItem }) {
  const fileRef = useRef(null);
  const [obsAberta, setObsAberta] = useState(false);
  const [obs, setObs] = useState(doc.observacao || "");
  const [erro, setErro] = useState("");
  const [subindo, setSubindo] = useState(false);
  // Confirmação inline, no lugar de um modal: é o mesmo gesto já usado em
  // exclusão dentro de lista nesta plataforma (RHBemEstarView, cabeçalho do
  // card) e não empilha overlay em cima do drawer, que já é um overlay.
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  const dispensado = doc.status === "nao_se_aplica";
  const desconhecido = !tipo;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErro(""); setSubindo(true);
    const r = await onAnexar(doc, file);
    setSubindo(false);
    if (!r.ok) setErro(r.motivo);
  };

  // A janela é aberta ANTES do await. A URL assinada leva um round-trip, e
  // `window.open` depois de um await perde a ativação do usuário — Safari e
  // Firefox tratam como pop-up programático e barram em silêncio: o botão
  // simplesmente não faz nada, sem erro na tela.
  const handleAbrir = async () => {
    const janela = window.open("", "_blank", "noopener,noreferrer");
    const r = await onAbrir(doc);
    if (!r.ok) { janela?.close(); setErro(r.motivo); return; }
    if (janela) janela.location.href = r.url;
    else window.location.href = r.url;
  };

  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "7px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <StatusBox status={doc.status} disabled={!canWrite} onClick={() => onToggleStatus(doc)} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: desconhecido ? "var(--warning)" : dispensado ? "var(--text-dim)" : "var(--text)", fontWeight: 500, textDecoration: dispensado ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={desconhecido ? "O tipo deste documento foi desativado no catálogo — o arquivo continua aqui." : (tipo?.observacao_padrao || undefined)}>
            {desconhecido ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <AlertTriangle size={11} /> Tipo desativado no catálogo
              </span>
            ) : tipo.nome}
            {tipo?.condicional && (
              <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "var(--text-dim)", border: "1px solid var(--border)", borderRadius: 99, padding: "1px 6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                quando aplicável
              </span>
            )}
          </div>
          {doc.observacao && !obsAberta && (
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{doc.observacao}</div>
          )}
          {/* Quem recebeu e quando: os dois são carimbados pelo banco (trigger
              rh_colaborador_documentos_touch), não pelo formulário. A spec pede
              arquivo + quem recebeu + observação; sem isto, um dos três só
              existiria no banco. */}
          {doc.recebido_em && (
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
              Recebido {formatDateBR(doc.recebido_em)}
              {recebedor ? ` por ${recebedor}` : ""}
            </div>
          )}
        </div>

        {doc.arquivo_path ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleAbrir}
              title={doc.arquivo_nome || "Abrir arquivo"}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, maxWidth: 130, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 99, padding: "3px 8px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}
            >
              <FileText size={11} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.arquivo_nome || "arquivo"}</span>
            </button>
            {canWrite && (
              confirmandoRemocao ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <button type="button" onClick={() => { setConfirmandoRemocao(false); onRemover(doc); }} style={{ background: "var(--danger)", color: "var(--on-danger)", border: "none", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Apagar</button>
                  <button type="button" onClick={() => setConfirmandoRemocao(false)} style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 7px", fontSize: 10, cursor: "pointer" }}>Não</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmandoRemocao(true)} title="Apagar o arquivo (não tem como desfazer)" style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex" }}>
                  <X size={12} color="var(--text-dim)" />
                </button>
              )
            )}
          </div>
        ) : canWrite && !dispensado ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={subindo}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "1px dashed var(--border-strong)", borderRadius: 99, padding: "3px 9px", fontSize: 11, color: "var(--text-dim)", cursor: subindo ? "default" : "pointer", flexShrink: 0 }}
          >
            <Paperclip size={11} /> {subindo ? "Enviando…" : "Anexar"}
          </button>
        ) : null}

        {canWrite && tipo?.aceita_varios && (
          <button
            type="button"
            onClick={() => onDuplicar(doc)}
            title="Este documento aceita mais de um arquivo — acrescenta outra linha do mesmo tipo"
            style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "none", border: "1px dashed var(--border-strong)", borderRadius: 99, padding: "3px 8px", fontSize: 10, color: "var(--text-dim)", cursor: "pointer", flexShrink: 0 }}
          >
            <Plus size={10} /> outro
          </button>
        )}

        {canWrite && podeExcluirItem && (
          <button type="button" onClick={() => onExcluirItem(doc)} title="Tirar esta linha extra da relação" style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex", flexShrink: 0 }}>
            <X size={12} color="var(--text-dim)" />
          </button>
        )}

        {canWrite && (
          <>
            <button
              type="button"
              onClick={() => { setObs(doc.observacao || ""); setObsAberta((v) => !v); }}
              title="Observação"
              style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex", flexShrink: 0 }}
            >
              <MessageSquare size={12} color={doc.observacao ? "var(--accent)" : "var(--text-dim)"} />
            </button>
            {tipo?.condicional && (
              <button
                type="button"
                onClick={() => onDispensar(doc)}
                title={dispensado ? "Voltar a exigir este documento" : "Marcar como não aplicável a esta pessoa"}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 10, color: "var(--text-dim)", textDecoration: "underline", flexShrink: 0 }}
              >
                {dispensado ? "exigir" : "não se aplica"}
              </button>
            )}
          </>
        )}
      </div>

      {obsAberta && canWrite && (
        <div style={{ display: "flex", gap: 6, marginTop: 6, paddingLeft: 24 }}>
          <input
            type="text"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onObservacao(doc, obs); setObsAberta(false); } }}
            placeholder={tipo?.observacao_padrao || "Observação…"}
            className="text-xs rounded-lg border px-2 py-1 outline-none"
            style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface-alt)", flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            onClick={() => { onObservacao(doc, obs); setObsAberta(false); }}
            style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px", fontSize: 11, color: "var(--text)", cursor: "pointer" }}
          >
            Salvar
          </button>
        </div>
      )}

      {erro && (
        <div style={{ fontSize: 11, color: "var(--danger)", background: "var(--danger-bg)", borderRadius: 6, padding: "4px 8px", marginTop: 6 }}>{erro}</div>
      )}

      <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleFile} style={{ display: "none" }} />
    </div>
  );
}

export function DocumentosAdmissao({ colaboradorId, canWrite, users = [] }) {
  const { tipos, documentos, loading, abrirRelacao, marcarStatus, salvar, anexar, removerArquivo, duplicarItem, removerItem, abrirArquivo } = useRHDocumentos({ colaboradorId });
  const [erro, setErro] = useState("");
  const [abrindo, setAbrindo] = useState(false);

  const tiposById = useMemo(() => Object.fromEntries(tipos.map((t) => [t.id, t])), [tipos]);
  const nomePorId = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.name || u.full_name || u.email])),
    [users],
  );

  const linhas = useMemo(() => {
    return [...documentos]
      .map((d) => ({ doc: d, tipo: tiposById[d.tipo_id] }))
      // Desempate por created_at: um tipo que aceita vários tem mais de uma
      // linha com a MESMA ordem, e sem desempate elas trocavam de lugar a cada
      // refetch — a observação parecia pular de arquivo.
      .sort((a, b) =>
        ((a.tipo?.ordem ?? 999) - (b.tipo?.ordem ?? 999))
        || String(a.doc.created_at).localeCompare(String(b.doc.created_at)));
  }, [documentos, tiposById]);

  // Denominador honesto (CLAUDE.md regra 14): dispensado sai da conta em vez
  // de ficar pendente pra sempre, e o que saiu aparece dito, não sumido.
  // Só a linha EXTRA de um tipo pode ser excluída — a última linha de um tipo
  // é o item da relação, e tirá-la faria o documento sumir do checklist em
  // vez de ficar pendente.
  const contagemPorTipo = useMemo(() => {
    const m = {};
    for (const d of documentos) m[d.tipo_id] = (m[d.tipo_id] || 0) + 1;
    return m;
  }, [documentos]);

  const dispensados = linhas.filter((l) => l.doc.status === "nao_se_aplica").length;
  const exigidos    = linhas.length - dispensados;
  const recebidos   = linhas.filter((l) => l.doc.status === "recebido").length;

  const aplicar = async (promise) => {
    setErro("");
    const r = await promise;
    if (r && r.ok === false) setErro(r.motivo);
  };

  // Qualquer status que não seja "pendente" volta pra "pendente" — inclusive
  // "não se aplica". Tratar só "recebido" aqui fazia o clique num item
  // dispensado marcá-lo como ENTREGUE, que é o oposto do que o rótulo diz e
  // ainda empurrava o item de volta pro denominador da contagem.
  const handleToggleStatus = (doc) =>
    aplicar(marcarStatus(doc.id, doc.status === "pendente" ? "recebido" : "pendente"));

  const handleDispensar = (doc) =>
    aplicar(marcarStatus(doc.id, doc.status === "nao_se_aplica" ? "pendente" : "nao_se_aplica"));

  const handleAbrirRelacao = async () => {
    setErro(""); setAbrindo(true);
    try { await abrirRelacao(); }
    catch (e) { setErro(e?.message || "Não foi possível abrir a relação."); }
    finally { setAbrindo(false); }
  };

  // Um tipo criado depois que a relação foi aberta não entra sozinho — a
  // mesma RPC idempotente acrescenta só o que falta.
  //
  // Conta TIPOS ATIVOS sem linha, não `tipos.length - linhas.length`: `tipos`
  // já vem filtrado por `ativo`, enquanto `linhas` inclui documento de tipo
  // desativado (e agora também as linhas extras de um tipo que aceita
  // vários). A subtração dava zero nos dois casos e escondia o botão.
  const faltamAbrir = useMemo(
    () => tipos.filter((t) => !documentos.some((d) => d.tipo_id === t.id)).length,
    [tipos, documentos],
  );

  // Sem catálogo carregado a seção não aparece: ou a migration ainda não foi
  // aplicada, ou quem está olhando não tem leitura em `rh_documento_tipos`.
  // Nos dois casos, meia seção — "0 de 0 recebidos", botão de abrir relação
  // vazia — é pior que seção nenhuma. Cobre também o primeiro instante do
  // carregamento, quando ainda não se sabe se existe relação a anunciar.
  if (tipos.length === 0 && linhas.length === 0) return null;

  let grupoAtual = null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ ...labelSt, marginBottom: 0 }}>Documentos de admissão</div>
        {linhas.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
            {recebidos} de {exigidos} recebidos
            {dispensados > 0 && ` · ${dispensados} não se aplica${dispensados > 1 ? "m" : ""}`}
          </div>
        )}
      </div>

      {erro && (
        <div style={{ fontSize: 11, color: "var(--danger)", background: "var(--danger-bg)", borderRadius: 8, padding: "6px 10px", marginBottom: 8 }}>{erro}</div>
      )}

      {loading && linhas.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Carregando…</div>
      ) : linhas.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          A relação ainda não foi aberta para esta pessoa.
          {canWrite && (
            <button
              type="button"
              onClick={handleAbrirRelacao}
              disabled={abrindo}
              style={{ display: "block", marginTop: 8, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: abrindo ? "default" : "pointer", opacity: abrindo ? 0.6 : 1 }}
            >
              {abrindo ? "Abrindo…" : `Abrir relação (${tipos.length} documentos)`}
            </button>
          )}
        </div>
      ) : (
        <>
          {linhas.map(({ doc, tipo }) => {
            const grupo = tipo?.grupo || "outros";
            const mostraGrupo = grupo !== grupoAtual;
            grupoAtual = grupo;
            return (
              <React.Fragment key={doc.id}>
                {mostraGrupo && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 10, marginBottom: 2 }}>
                    {GRUPO_LABELS[grupo] || grupo}
                  </div>
                )}
                <DocumentoRow
                  doc={doc}
                  tipo={tipo}
                  canWrite={canWrite}
                  recebedor={nomePorId[doc.recebido_por] || null}
                  podeExcluirItem={contagemPorTipo[doc.tipo_id] > 1}
                  onToggleStatus={handleToggleStatus}
                  onDispensar={handleDispensar}
                  onAnexar={anexar}
                  onAbrir={abrirArquivo}
                  onRemover={(d) => aplicar(removerArquivo(d))}
                  onDuplicar={(d) => aplicar(duplicarItem(d))}
                  onExcluirItem={(d) => aplicar(removerItem(d))}
                  onObservacao={(d, texto) => aplicar(salvar(d.id, { observacao: texto.trim() || null }))}
                />
              </React.Fragment>
            );
          })}

          {canWrite && faltamAbrir > 0 && (
            <button
              type="button"
              onClick={handleAbrirRelacao}
              disabled={abrindo}
              style={{ marginTop: 10, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "var(--text)", cursor: abrindo ? "default" : "pointer" }}
            >
              {abrindo ? "Incluindo…" : `Incluir ${faltamAbrir} documento${faltamAbrir > 1 ? "s" : ""} novo${faltamAbrir > 1 ? "s" : ""} da relação`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
