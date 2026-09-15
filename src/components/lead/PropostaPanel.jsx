import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Printer, Plus, Trash2, Check, AlertCircle, Lock, ImageIcon } from "lucide-react";
import { useProposals } from "../../hooks/use-proposals";
import { useConfigComercial } from "../../hooks/use-config-comercial";
import { useEsgReports } from "../../hooks/use-esg-carbon";
import { CAMPOS_FATOS, fatosDivergentes } from "../../constants/fatos-canonicos";
import { CAMPOS_RFP, CAMPOS_BLOQUEADOS, CAMPOS_SUBSTITUIDOS_POR_ITENS, avaliarProposta } from "../../utils/proposta-rfp";
import { SANBAG_MODELS } from "../../data/sanbag-models";
import { useDocumentLibrary } from "../../hooks/use-document-library";
import { formatBRL, formatBRLCentavos } from "../../utils/currency";
import { formatDateBR, toLocalISODate } from "../../utils/date";
import { CurrencyInput } from "../ui/CurrencyInput";
import { ErroDeLeitura } from "../shared/ErroDeLeitura";

// Gerador de proposta de RFP — dentro do negócio.
//
// Substitui a aba "PDF" (ProposalPanel.jsx), decidido com o Daniel em
// 15/09/2026 pelo mockup "O gerador da Resibag dentro do funil". A aba antiga
// existia, funcionava, imprimia — e tinha ZERO propostas criadas em produção,
// nas duas tabelas. Por isso a troca é substituição e não convivência: não há
// nada a migrar, e uma sexta tela ao lado teria a mesma chance de não ser
// usada.
//
// A tese vem do gerador em HTML que o próprio Daniel montou: nem todo dado de
// uma proposta tem a mesma natureza. As três classes estão em
// utils/proposta-rfp.js, com o porquê de cada uma.
//
// O QUE MUDA POR ESTAR AQUI DENTRO, que é o ponto: seis campos da Classe 2
// vêm do negócio e paravam de ser redigitados; o vendedor sai do currentUser;
// cada "Gerar" vira uma VERSÃO com data e autor; e os fatos da marca deixam
// de andar em cópias dentro de cada arquivo HTML — no gerador v5 a tagline
// ainda era a que foi descontinuada em 09/09/2026.

const rotuloSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 3 };
const inputSt = { width: "100%", background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 16 };
const cardSt = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 13px" };

// ESG & Carbono — mesma formatação de ESGCarbonoView (kgToT/fmtT), só com o
// sufixo CO2e pro contexto de proposta. Não reimplementar diferente.
function fmtTonnesCO2e(kg) {
  const t = (Number(kg) || 0) / 1000;
  return `${t.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t CO2e`;
}

// Só UMA impressão por vez, e o handle do timer vive fora da função: sem
// isso, imprimir a Ficha e clicar no Pitch em seguida fazia a limpeza da
// primeira rodar NO MEIO da segunda — tirava `printing-doc`, removia o
// <style> que já era o da segunda, e o que ia pro papel era a UI do app.
let timerLimpeza = null;
let imprimindo = false;

// `window.print()` NÃO espera imagem carregar. O documento fica em
// `display:none` até a hora de imprimir — o navegador até busca `<img>` aí
// dentro, mas não há garantia de que terminou quando o diálogo abre, e a
// folha sai com moldura vazia no lugar da foto. Nenhum dos dois gates da
// regra 3.2 exercita `@media print`, então isto só apareceria no papel.
// Teto de 4s: imagem que não vem (URL assinada expirada, rede caída) não
// pode prender o botão pra sempre — imprime sem ela.
function esperarImagens(alvo) {
  const imgs = Array.from(alvo.querySelectorAll("img")).filter((i) => !i.complete);
  if (imgs.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(imgs.map((img) => new Promise((ok) => {
      img.addEventListener("load", ok, { once: true });
      img.addEventListener("error", ok, { once: true });
    }))),
    new Promise((ok) => setTimeout(ok, 4000)),
  ]);
}

async function printarDoc(qual) {
  if (imprimindo) return;
  const alvo = document.getElementById(`proposta-doc-${qual}`);
  if (!alvo) return;
  imprimindo = true;
  await esperarImagens(alvo);

  // A classe entra SÓ no documento escolhido. Pôr nos dois e esconder o outro
  // com `display:none` inline NÃO funciona: a regra de `index.css` é
  // `display: block !important` dentro de @media print, e `!important` de
  // folha de autor vence estilo inline sem `!important`. Os dois saíam
  // empilhados na mesma coordenada (`position:absolute; top:0`) — o Doc 2
  // impresso por cima do Doc 1. A aba antiga nunca viu isso porque tinha um
  // documento só. É a regra 15 do CLAUDE.md em estado puro: build, ESLint e
  // varredura passam, porque nenhum deles exercita @media print.
  document.querySelectorAll("[data-proposta-doc]").forEach((el) => {
    el.classList.toggle("doc-print-only", el === alvo);
  });

  const style = document.createElement("style");
  style.id = "proposta-print-page";
  style.textContent = "@media print { @page { size: A4 portrait; margin: 1.6cm; } }";
  document.head.appendChild(style);
  document.body.classList.add("printing-doc");

  const limpar = () => {
    if (timerLimpeza) { clearTimeout(timerLimpeza); timerLimpeza = null; }
    document.body.classList.remove("printing-doc");
    document.getElementById("proposta-print-page")?.remove();
    document.querySelectorAll("[data-proposta-doc]").forEach((el) => {
      el.classList.remove("doc-print-only");
    });
    window.removeEventListener("afterprint", limpar);
    imprimindo = false;
  };
  window.addEventListener("afterprint", limpar);
  window.print();
  // Firefox e Safari NÃO bloqueiam em `window.print()` — só Chrome e Edge. Lá
  // o timer dispara com o preview aberto, então a folga tem que ser larga. A
  // aba antiga usava 3s; 1,5s era estreito demais.
  timerLimpeza = setTimeout(limpar, 3000);
}

export function PropostaPanel({ lead, currentUser, onAddActivity }) {
  const { proposal, versoes, lineItems, loading, error, persist } = useProposals(lead.id, lead.companyId);
  const { fatosDe, metaFatosDe, error: erroConfig } = useConfigComercial();

  // Selo ESG — portado da aba antiga em vez de descartado junto com ela. É o
  // perfil de emissões da EMPRESA VENDEDORA (lead.companyId), não do negócio:
  // não existe dado de carbono por produto. Sem relatório, o selo some — a
  // proposta não inventa número.
  const { reports: esgReports } = useEsgReports({ companyId: lead.companyId });
  const esgKg = esgReports.length > 0
    ? (esgReports[0].totalsByScope?.[1] || 0) + (esgReports[0].totalsByScope?.[2] || 0) + (esgReports[0].totalsByScope?.[3] || 0)
    : 0;

  const fatos = useMemo(() => fatosDe(lead.companyId), [fatosDe, lead.companyId]);
  const metaFatos = useMemo(() => metaFatosDe(lead.companyId), [metaFatosDe, lead.companyId]);
  const divergentes = useMemo(
    () => fatosDivergentes(lead.companyId, metaFatos.configurados),
    [lead.companyId, metaFatos.configurados],
  );

  const [rascunho, setRascunho] = useState(() => ({
    vendedor: currentUser?.name || "",
    data: toLocalISODate(new Date()),
  }));
  const [bloqueados, setBloqueados] = useState({});
  const [requisitos, setRequisitos] = useState([]);
  const [itens, setItens] = useState([]);
  // Só as REFERÊNCIAS da biblioteca ({id, title, file_path}). A URL assinada
  // vale 1h e vive em `urlsImagem`, fora do snapshot — ver o efeito abaixo.
  const [imagens, setImagens] = useState([]);
  const [salvando, setSalvando] = useState(false);

  // HIDRATAÇÃO, e ela precisa ser efeito e não estado inicial: `useProposals`
  // é assíncrono e o primeiro render SEMPRE tem `proposal === null`. Lendo o
  // snapshot só no inicializador de `useState`, a tela abria em branco com
  // "Última: v1" no topo — o vendedor reabria o negócio e perdia tudo que
  // tinha digitado, e o "Gerar v2" seguinte gravava um snapshot vazio por
  // cima. O histórico versionado, que é a tese desta tela, registraria
  // regressão em vez de iteração.
  //
  // O ref garante uma vez só: o hook refaz fetch, e sem isso a hidratação
  // atropelaria o que o vendedor está digitando naquele momento. É o mesmo
  // padrão que a aba antiga usava e que se perdeu na reescrita.
  const hidratadoRef = useRef(false);
  useEffect(() => {
    if (hidratadoRef.current || loading) return;
    hidratadoRef.current = true;
    const salvo = proposal?.rfp_snapshot;
    if (!salvo) return;
    setRascunho(r => ({ ...r, ...(salvo.rfp || {}) }));
    setBloqueados(salvo.bloqueados || {});
    setRequisitos(salvo.requisitos || []);
    setImagens(Array.isArray(salvo.imagens) ? salvo.imagens : []);
  }, [loading, proposal]);

  // As linhas de item NÃO vêm do snapshot: elas são linhas de verdade em
  // `proposal_line_items`, lidas pelo hook. O snapshot guarda o retrato do
  // documento; a tabela guarda o dado. Ler as duas faria a tela escolher
  // entre duas versões da mesma coisa.
  const itensHidratadosRef = useRef(false);
  useEffect(() => {
    if (itensHidratadosRef.current || loading) return;
    itensHidratadosRef.current = true;
    if (lineItems.length === 0) return;
    setItens(lineItems.map(li => ({
      modelLabel: li.model_label || "",
      quantity: li.quantity ?? "",
      unitPrice: li.unit_price ?? "",
      certificationNote: li.certification_note || "",
    })));
  }, [loading, lineItems]);

  // ── Imagens do Pitch ──────────────────────────────────────────────────────
  // Bucket `document-library` é privado: a URL é assinada por 1h e refeita a
  // cada abertura. Guardar a assinada no snapshot faria a v1 abrir quebrada
  // no dia seguinte — por isso o snapshot só carrega id/título/caminho.
  const { documents: docsBiblioteca, getSignedUrl, error: erroBiblioteca } = useDocumentLibrary();
  const imagensDisponiveis = useMemo(() => docsBiblioteca.filter(d =>
    (d.mime_type || "").startsWith("image/")
    && (!Array.isArray(d.company_ids) || d.company_ids.length === 0 || d.company_ids.includes(lead.companyId))
  ), [docsBiblioteca, lead.companyId]);

  const [urlsImagem, setUrlsImagem] = useState({});
  useEffect(() => {
    let vivo = true;
    // `in`, não truthy: assinatura que FALHOU grava `null` e fica marcada
    // como tentada. Filtrando por valor verdadeiro, o caminho sem URL
    // continuava "faltando", o efeito rodava de novo a cada render e a tela
    // entrava em laço de requisição — o `urlsImagem` na dependência é o que
    // fecha o ciclo.
    const faltando = imagens.filter(img => img.file_path && !(img.file_path in urlsImagem));
    if (faltando.length === 0) return;
    (async () => {
      const pares = await Promise.all(
        faltando.map(async (img) => [img.file_path, await getSignedUrl(img.file_path)]),
      );
      if (!vivo) return;
      setUrlsImagem(prev => ({ ...prev, ...Object.fromEntries(pares) }));
    })();
    return () => { vivo = false; };
  }, [imagens, urlsImagem, getSignedUrl]);

  const MAX_IMAGENS = 4;
  const alternarImagem = (doc) => setImagens((atual) => {
    if (atual.some(i => i.id === doc.id)) return atual.filter(i => i.id !== doc.id);
    if (atual.length >= MAX_IMAGENS) return atual;
    return [...atual, { id: doc.id, title: doc.title, file_path: doc.file_path }];
  });

  const imagensParaDoc = useMemo(
    () => imagens.map(img => ({ ...img, url: urlsImagem[img.file_path] })).filter(i => i.url),
    [imagens, urlsImagem],
  );
  const [aviso, setAviso] = useState(null);

  const S = useMemo(
    () => avaliarProposta({ lead, rascunho, bloqueados, requisitos, fatos, itens }),
    [lead, rascunho, bloqueados, requisitos, fatos, itens],
  );

  const editar = (chave, valor) => setRascunho(r => ({ ...r, [chave]: valor }));
  const editarBloqueado = (chave, campo, valor) =>
    setBloqueados(b => ({ ...b, [chave]: { ...(b[chave] || {}), [campo]: valor } }));

  const gerar = async () => {
    setSalvando(true);
    setAviso(null);
    try {
      await persist({
        draftText: null,
        // Só manda `items` quando há linha de verdade. `[]` num negócio que
        // nunca teve item continua sendo `undefined` pro hook — ele distingue
        // "não gerencio linha" de "apaguei todas", e passar `[]` sem querer
        // zerava o total pelo gatilho.
        ...(S.itensUsados.length > 0 || lineItems.length > 0 ? { items: S.itensUsados } : {}),
        createdBy: currentUser?.id,
        // Snapshot, não espelho: o que o cliente recebeu naquele dia fica como
        // estava, mesmo que o negócio mude depois.
        // Guarda o RASCUNHO, não `S.rfp` (que é o mesclado com o negócio):
        // salvar o mesclado faria toda chave existir no rascunho ao reabrir, e
        // a etiqueta "· do negócio" nunca mais apareceria. O documento
        // impresso continua sendo retrato do dia porque `fatos` e os valores
        // efetivos vão junto.
        // `imagens` guarda id/título/caminho — NUNCA a URL assinada, que
        // expira em 1h e deixaria o retrato quebrado amanhã.
        rfpSnapshot: { rfp: rascunho, efetivo: S.rfp, bloqueados, requisitos, fatos, esgKg, imagens, itens: S.itensUsados, geradoEm: new Date().toISOString() },
        novaVersao: true,
      });
      // A atividade "proposta gerada" existia na aba antiga (era a Fase 3
      // dela, com comentário próprio: o buraco "proposta gerada não é
      // registrada"). Some se eu não repuser, e some em silêncio — o
      // versionamento em tabela não aparece na linha do tempo do negócio,
      // que é onde o gerente olha.
      const valor = Number(lead.value);
      onAddActivity?.(lead.id, {
        type: "proposal_generated",
        userId: currentUser?.id || null,
        userName: currentUser?.name || null,
        body: Number.isFinite(valor) && valor > 0
          ? `Proposta v${(versoes[0]?.version ?? 0) + 1} gerada — negócio em ${formatBRL(valor)}`
          : `Proposta v${(versoes[0]?.version ?? 0) + 1} gerada`,
        meta: { versao: (versoes[0]?.version ?? 0) + 1, cliente: S.rfp.cliente || null, rfp: S.rfp.rfp || null },
      });
      setAviso({ tipo: "ok", texto: "Versão gerada." });
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message || "Não foi possível gerar a proposta." });
    } finally {
      setSalvando(false);
    }
  };

  if (loading) return <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Carregando proposta…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {error && <ErroDeLeitura oQue="as propostas deste negócio" detalhe={error} />}
      {erroConfig && <ErroDeLeitura oQue="os fatos da marca" detalhe={erroConfig?.message} />}

      {/* ── Estado da peça ──────────────────────────────────────────────── */}
      <div style={cardSt}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Proposta</span>
          <span style={{
            fontSize: 11, fontWeight: 700, borderRadius: 99, padding: "2px 9px", whiteSpace: "nowrap",
            background: S.pronta ? "var(--success-bg)" : "var(--warning-bg)",
            color: S.pronta ? "var(--success)" : "var(--warning)",
          }}>
            {S.pronta ? "Pronta para envio" : "Sai como rascunho"}
          </span>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 6, lineHeight: 1.5 }}>
          {versoes.length > 0
            ? <>Última: <b style={{ color: "var(--text-dim)" }}>v{versoes[0].version}</b> · {formatDateBR(versoes[0].created_at)} · {versoes.length} {versoes.length === 1 ? "versão" : "versões"}</>
            : "Nenhuma versão gerada ainda."}
          {!S.pronta && (
            <>
              {" · "}
              {[
                S.faltamRfp.length ? `${S.faltamRfp.length} campo(s) em branco` : null,
                S.pendentes.length ? `${S.pendentes.length} item(ns) sem confirmação` : null,
                S.requisitosAbertos ? `${S.requisitosAbertos} cláusula(s) sem resposta` : null,
                S.fatosFaltando.length ? `falta ${S.fatosFaltando.join(", ")} na base da marca` : null,
              ].filter(Boolean).join(" · ")}
            </>
          )}
        </div>
      </div>

      {/* O selo é decidido por um dado que o vendedor não vê (relatório de
          ESG da frente). Se ele não souber antes de imprimir se a peça sai
          com selo, descobre depois — e "saiu com selo ou não" importa pro
          comprador industrial. A aba antiga avisava; esta voltou a avisar. */}
      {esgKg > 0 && (
        <p style={{ fontSize: 11, color: "var(--text-dim)", margin: 0, lineHeight: 1.5 }}>
          O <b>Selo ESG</b> entra no Pitch — {fmtTonnesCO2e(esgKg)} apurados no relatório mais recente desta frente.
        </p>
      )}

      {/* ── Classe 1 · fatos da marca ───────────────────────────────────── */}
      <div style={cardSt}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <Lock size={12} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
          <b style={{ fontSize: 12, fontWeight: 700 }}>Fatos da marca</b>
          <span style={{ fontSize: 9.5, fontFamily: "ui-monospace, monospace", fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-dim)", background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 99, padding: "1px 7px", marginLeft: "auto" }}>
            CLASSE 1
          </span>
        </div>
        {CAMPOS_FATOS.filter(c => fatos[c.chave]).map((c) => (
          <div key={c.chave} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0", fontSize: 12, borderTop: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text-dim)", flexShrink: 0 }}>{c.rotulo}</span>
            <span style={{ color: "var(--text)", textAlign: "right", minWidth: 0 }}>
              {fatos[c.chave]}
              {divergentes.includes(c.chave) && (
                <span title="Diferente do padrão versionado no repositório" style={{ color: "var(--amber)", marginLeft: 5, fontSize: 10.5 }}>editado</span>
              )}
            </span>
          </div>
        ))}
        <p style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 8, lineHeight: 1.5 }}>
          Não se digita aqui. Muda em <b>Configurações → Comercial</b>, e vale para toda proposta desta frente.
          {metaFatos.atualizadoEm && <> Última alteração em {formatDateBR(metaFatos.atualizadoEm)}.</>}
          {S.fatosFaltando.length > 0 && (
            <span style={{ color: "var(--warning)" }}> Falta preencher: {S.fatosFaltando.join(", ")}.</span>
          )}
        </p>
      </div>

      {/* ── Classe 2 · desta RFP ────────────────────────────────────────── */}
      <div style={cardSt}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
          <b style={{ fontSize: 12, fontWeight: 700 }}>Dados desta RFP</b>
          <span style={{ fontSize: 9.5, fontFamily: "ui-monospace, monospace", fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-dim)", background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 99, padding: "1px 7px", marginLeft: "auto" }}>
            CLASSE 2
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {CAMPOS_RFP.filter(c => !(S.temItens && CAMPOS_SUBSTITUIDOS_POR_ITENS.includes(c.chave))).map((c) => {
            const veioDoLead = S.doLead[c.chave] !== undefined && rascunho[c.chave] === undefined;
            const valor = S.rfp[c.chave] ?? "";
            return (
              <div key={c.chave}>
                <label style={rotuloSt}>
                  {c.rotulo}
                  {veioDoLead && <span style={{ color: "var(--accent)", marginLeft: 5, textTransform: "none", letterSpacing: 0 }}>· do negócio</span>}
                </label>
                {c.tipo === "dinheiro" ? (
                  <CurrencyInput value={valor} onChange={(v) => editar(c.chave, v)} style={inputSt} ariaLabel={c.rotulo} />
                ) : c.tipo === "escolha" ? (
                  <select value={valor} onChange={(e) => editar(c.chave, e.target.value)} style={inputSt}>
                    <option value="">Selecionar…</option>
                    {c.opcoes.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={c.tipo === "data" ? "date" : c.tipo === "numero" ? "number" : "text"}
                    value={c.tipo === "data" && typeof valor === "string" ? valor.slice(0, 10) : valor}
                    onChange={(e) => editar(c.chave, e.target.value)}
                    style={inputSt}
                  />
                )}
              </div>
            );
          })}
        </div>
        {S.temItens && (
          <p style={{ fontSize: 10.5, color: "var(--text-faint)", margin: "9px 0 0", lineHeight: 1.5 }}>
            Quantidade e preço saíram daqui porque a proposta tem itens — cada um com o seu, logo abaixo.
          </p>
        )}
      </div>

      {/* ── Itens da proposta ───────────────────────────────────────────── */}
      <ItensDaProposta
        itens={itens}
        setItens={setItens}
        S={S}
        proposal={proposal}
        versoes={versoes}
      />

      {/* ── Imagens do Pitch ────────────────────────────────────────────── */}
      <ImagensDoPitch
        disponiveis={imagensDisponiveis}
        selecionadas={imagens}
        alternar={alternarImagem}
        max={MAX_IMAGENS}
        erro={erroBiblioteca}
      />

      {/* ── Matriz de conformidade ──────────────────────────────────────── */}
      <div style={cardSt}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <b style={{ fontSize: 12, fontWeight: 700 }}>Matriz de conformidade</b>
          <button
            type="button"
            onClick={() => setRequisitos(r => [...r, { exigencia: "", resposta: "", norma: "" }])}
            style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 7, padding: "4px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            <Plus size={11} /> Cláusula
          </button>
        </div>
        {requisitos.length === 0 && (
          <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: 0, lineHeight: 1.5 }}>
            Cada linha é uma exigência da RFP e a resposta que o comprador vai levar para a auditoria dele. Nenhuma sai sem norma nomeada.
          </p>
        )}
        {requisitos.map((r, i) => (
          <div key={i} style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <input
                placeholder="Exigência da RFP"
                value={r.exigencia}
                onChange={(e) => setRequisitos(rs => rs.map((x, j) => j === i ? { ...x, exigencia: e.target.value } : x))}
                style={{ ...inputSt, fontSize: 13 }}
              />
              <button
                type="button"
                onClick={() => setRequisitos(rs => rs.filter((_, j) => j !== i))}
                title="Remover cláusula"
                aria-label="Remover cláusula"
                style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 6, flexShrink: 0 }}
              >
                <Trash2 size={13} />
              </button>
            </div>
            <input
              placeholder="Como atendemos"
              value={r.resposta}
              onChange={(e) => setRequisitos(rs => rs.map((x, j) => j === i ? { ...x, resposta: e.target.value } : x))}
              style={{ ...inputSt, fontSize: 13 }}
            />
            <input
              placeholder="Norma / certificação que sustenta"
              value={r.norma}
              onChange={(e) => setRequisitos(rs => rs.map((x, j) => j === i ? { ...x, norma: e.target.value } : x))}
              style={{ ...inputSt, fontSize: 13 }}
            />
          </div>
        ))}
      </div>

      {/* ── Classe 3 · só com confirmação ───────────────────────────────── */}
      <div style={cardSt}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
          <b style={{ fontSize: 12, fontWeight: 700 }}>Só sai com confirmação</b>
          {/* `--warning`, não `--danger`: pela convenção do CLAUDE.md o
              vermelho é bloqueio de input do usuário, e o âmbar é "precisa de
              atenção/configuração, não é responsabilidade de quem preenche
              resolver" — que é exatamente isto. Quem confirma NCM é o fiscal,
              não o vendedor. O chip "Sai como rascunho" lá em cima já usava
              âmbar; o mesmo fato aparecia em duas cores. */}
          <span style={{ fontSize: 9.5, fontFamily: "ui-monospace, monospace", fontWeight: 700, letterSpacing: "0.08em", color: "var(--warning)", background: "var(--warning-bg)", borderRadius: 99, padding: "1px 7px", marginLeft: "auto" }}>
            CLASSE 3 · {S.confirmados.length}/{CAMPOS_BLOQUEADOS.length}
          </span>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "0 0 9px", lineHeight: 1.5 }}>
          Oito afirmações que o vendedor não sustenta sozinho. Cada uma sai com o valor <b>e</b> com quem confirmou — ou não sai.
        </p>
        {CAMPOS_BLOQUEADOS.map((c) => {
          const b = bloqueados[c.chave] || {};
          const ok = b.valor && b.quem;
          return (
            <div key={c.chave} style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                <b style={{ fontSize: 12 }}>{c.rotulo}</b>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap",
                  background: ok ? "var(--success-bg)" : "var(--warning-bg)", color: ok ? "var(--success)" : "var(--warning)",
                }}>
                  {ok ? "CONFIRMADO" : "PENDENTE"}
                </span>
              </div>
              <p style={{ fontSize: 10.5, color: "var(--text-faint)", margin: "0 0 6px", lineHeight: 1.45 }}>{c.porque}</p>
              <input
                placeholder="Valor"
                value={b.valor || ""}
                onChange={(e) => editarBloqueado(c.chave, "valor", e.target.value)}
                style={{ ...inputSt, marginBottom: 5 }}
              />
              <input
                placeholder={`Quem confirmou — ${c.quem}`}
                value={b.quem || ""}
                onChange={(e) => editarBloqueado(c.chave, "quem", e.target.value)}
                style={inputSt}
              />
            </div>
          );
        })}
      </div>

      {/* ── Ações ───────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={gerar}
          disabled={salvando}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 9, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: salvando ? "default" : "pointer", opacity: salvando ? 0.6 : 1 }}
        >
          <Check size={14} /> {salvando ? "Gerando…" : versoes.length ? `Gerar v${(versoes[0].version ?? 0) + 1}` : "Gerar proposta"}
        </button>
        <button type="button" onClick={() => printarDoc(1)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Printer size={14} /> Ficha técnica
        </button>
        <button type="button" onClick={() => printarDoc(2)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <FileDown size={14} /> Pitch
        </button>
      </div>
      {aviso && (
        <p style={{ fontSize: 12, margin: 0, color: aviso.tipo === "erro" ? "var(--danger)" : "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
          {aviso.tipo === "erro" && <AlertCircle size={13} />}{aviso.texto}
        </p>
      )}

      {/* ── Documentos, só na impressão ─────────────────────────────────── */}
      <div id="proposta-doc-1" data-proposta-doc style={{ display: "none" }}>
        <DocTecnica S={S} fatos={fatos} lead={lead} requisitos={requisitos} bloqueados={bloqueados} />
      </div>
      <div id="proposta-doc-2" data-proposta-doc style={{ display: "none" }}>
        <DocPitch S={S} fatos={fatos} esgKg={esgKg} imagens={imagensParaDoc} />
      </div>
    </div>
  );
}

// ── Itens da proposta ──────────────────────────────────────────────────────
// Restaura o CPQ que a aba anterior tinha e que se perdeu na reescrita: a
// tabela `proposal_line_items` seguiu em produção, com gatilho e policies,
// mas sem NINGUÉM escrevendo nela desde 15/09/2026.
function ItensDaProposta({ itens, setItens, S, proposal, versoes }) {
  const editar = (i, campo, valor) =>
    setItens(xs => xs.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  // A primeira linha nasce com o que o NEGÓCIO já respondeu (produto, qtd,
  // preço da Classe 2). Se ela nascesse vazia, o vendedor redigitaria o que
  // o funil sabe — que é justamente o ganho de a proposta morar aqui dentro.
  const adicionar = () => setItens(xs => xs.length === 0
    ? [{
      modelLabel: S.rfp.produto || "",
      quantity: S.rfp.qtd || "",
      unitPrice: S.rfp.preco || "",
      certificationNote: "",
    }]
    : [...xs, { modelLabel: "", quantity: "", unitPrice: "", certificationNote: "" }]);

  // Nota de certificação: o modelo sugere, o vendedor manda. Só preenche
  // campo VAZIO — sobrescrever o que ele escreveu seria perder texto sem aviso.
  const escolherModelo = (i, valor) => setItens(xs => xs.map((x, j) => {
    if (j !== i) return x;
    const dica = SANBAG_MODELS.find(m => m.label === valor)?.certificationHint;
    return { ...x, modelLabel: valor, certificationNote: x.certificationNote || dica || "" };
  }));

  const totalGravado = Number(proposal?.total_value);
  const temTotalGravado = Number.isFinite(totalGravado) && versoes.length > 0;
  // Centavos de diferença entre o numeric do Postgres e o float do JS não são
  // "edição não gerada" — meio centavo de tolerância.
  const divergente = temTotalGravado && Math.abs(totalGravado - S.somaLinhas) > 0.005;

  return (
    <div style={cardSt}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <b style={{ fontSize: 12, fontWeight: 700 }}>Itens da proposta</b>
        <button
          type="button"
          onClick={adicionar}
          style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 7, padding: "4px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          <Plus size={11} /> Item
        </button>
      </div>

      {itens.length === 0 && (
        <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: 0, lineHeight: 1.5 }}>
          Uma RFP de big bag quase nunca cota um modelo só. Com itens aqui, quantidade e preço saem
          da ficha acima e cada linha leva o seu — o primeiro já vem preenchido com o que o negócio respondeu.
        </p>
      )}

      {itens.map((it, i) => (
        <div key={i} style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <input
              list="sanbag-modelos"
              placeholder="Modelo"
              value={it.modelLabel}
              onChange={(e) => escolherModelo(i, e.target.value)}
              style={{ ...inputSt, fontSize: 13 }}
            />
            <button
              type="button"
              onClick={() => setItens(xs => xs.filter((_, j) => j !== i))}
              title="Remover item"
              aria-label="Remover item"
              style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 6, flexShrink: 0 }}
            >
              <Trash2 size={13} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={rotuloSt}>Quantidade (un)</label>
              <input
                type="number"
                min="0"
                value={it.quantity}
                onChange={(e) => editar(i, "quantity", e.target.value)}
                style={{ ...inputSt, fontSize: 13 }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={rotuloSt}>Preço unitário</label>
              <CurrencyInput
                value={it.unitPrice}
                onChange={(v) => editar(i, "unitPrice", v)}
                style={{ ...inputSt, fontSize: 13 }}
                ariaLabel={`Preço unitário do item ${i + 1}`}
              />
            </div>
          </div>
          <input
            placeholder="Certificação que sustenta este modelo"
            value={it.certificationNote}
            onChange={(e) => editar(i, "certificationNote", e.target.value)}
            style={{ ...inputSt, fontSize: 13 }}
          />
          <div style={{ fontSize: 10.5, color: "var(--text-faint)", textAlign: "right" }}>
            {formatBRLCentavos((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0))}
          </div>
        </div>
      ))}

      <datalist id="sanbag-modelos">
        {SANBAG_MODELS.map(m => <option key={m.label} value={m.label} />)}
      </datalist>

      {S.temItens && (
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 9, paddingTop: 8, fontSize: 11.5, lineHeight: 1.6 }}>
          {/* Regra 14 do CLAUDE.md: os dois números aparecem com a origem
              escrita. A soma é do que está na tela agora; o total é o que o
              gatilho calculou no banco na última geração. Mostrar um só, sem
              dizer qual, é o que faz alguém mandar preço errado pro cliente. */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ color: "var(--text-dim)" }}>Soma das linhas (nesta tela)</span>
            <b>{formatBRLCentavos(S.somaLinhas)}</b>
          </div>
          {temTotalGravado && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 2 }}>
              <span style={{ color: "var(--text-dim)" }}>Total da v{versoes[0].version} · calculado no banco</span>
              <b>{formatBRLCentavos(totalGravado)}</b>
            </div>
          )}
          {divergente && (
            <p style={{ color: "var(--warning)", margin: "5px 0 0", fontSize: 10.5 }}>
              A soma atual difere do total da última versão — há edição ainda não gerada.
            </p>
          )}
          {S.itensIncompletos > 0 && (
            <p style={{ color: "var(--warning)", margin: "5px 0 0", fontSize: 10.5 }}>
              {S.itensIncompletos} {S.itensIncompletos === 1 ? "item sem" : "itens sem"} modelo, quantidade ou preço — a proposta sai como rascunho.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Imagens do Pitch ───────────────────────────────────────────────────────
// Vêm da Biblioteca de Documentos, não embutidas na peça. O gerador em HTML
// que originou esta tela carregava ~1,3 MB de base64 dentro do arquivo: cada
// cópia com as próprias imagens, envelhecendo junto — a mesma doença da
// tagline descontinuada que sobreviveu lá dentro.
function ImagensDoPitch({ disponiveis, selecionadas, alternar, max, erro }) {
  const cheio = selecionadas.length >= max;
  return (
    <div style={cardSt}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <ImageIcon size={12} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
        <b style={{ fontSize: 12, fontWeight: 700 }}>Imagens do Pitch</b>
        <span style={{ fontSize: 10.5, color: "var(--text-faint)", marginLeft: "auto" }}>
          {selecionadas.length}/{max}
        </span>
      </div>

      {erro && <ErroDeLeitura oQue="a Biblioteca de Documentos" detalhe={erro} />}

      {!erro && disponiveis.length === 0 && (
        <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: 0, lineHeight: 1.5 }}>
          Nenhuma imagem desta frente na Biblioteca de Documentos. Suba lá (JPEG, PNG ou WebP) e ela
          aparece aqui para toda proposta — em vez de viajar dentro de cada arquivo.
        </p>
      )}

      {disponiveis.map((d) => {
        const marcada = selecionadas.some(i => i.id === d.id);
        return (
          <label
            key={d.id}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
              borderTop: "1px solid var(--border)", fontSize: 12.5,
              cursor: !marcada && cheio ? "not-allowed" : "pointer",
              opacity: !marcada && cheio ? 0.5 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={marcada}
              disabled={!marcada && cheio}
              onChange={() => alternar(d)}
              style={{ flexShrink: 0 }}
            />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.title}
            </span>
          </label>
        );
      })}

      {disponiveis.length > 0 && (
        <p style={{ fontSize: 10.5, color: "var(--text-faint)", margin: "8px 0 0", lineHeight: 1.5 }}>
          Entram no Pitch, não na ficha técnica. A peça guarda a referência ao documento — trocou o
          arquivo na Biblioteca, a próxima proposta já sai com a imagem nova.
        </p>
      )}
    </div>
  );
}

// ── Documentos ─────────────────────────────────────────────────────────────
// Cor fixa e não token: sai em papel, onde não existe tema escuro.
const P_INK = "#1A1A1A", P_DIM = "#5A5A5A", P_LINHA = "#DDDDDD";
const docSt = { background: "#FFFFFF", color: P_INK, fontFamily: "Inter, system-ui, sans-serif", fontSize: 12.5, lineHeight: 1.6 };
const h1St = { fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px" };
const h2St = { fontSize: 14, fontWeight: 700, margin: "20px 0 7px", borderTop: `1px solid ${P_LINHA}`, paddingTop: 10 };
const tdSt = { borderBottom: "1px solid #F0F0F0", padding: "5px 7px", verticalAlign: "top" };
const thSt = { ...tdSt, textAlign: "left", fontSize: 9.5, letterSpacing: "0.09em", textTransform: "uppercase", color: P_DIM, borderBottom: `1px solid ${P_LINHA}` };

const pend = (v) => v ? v : <span style={{ background: "#FEF3F2", color: "#B42318", padding: "0 5px", borderRadius: 3, fontSize: 11 }}>PENDENTE</span>;

function Marca({ S }) {
  if (!S.rascunhoMarcado) return null;
  return (
    <div style={{ border: "1px solid #B42318", color: "#B42318", borderRadius: 4, padding: "5px 9px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 14 }}>
      RASCUNHO — NÃO ENVIAR AO COMPRADOR
    </div>
  );
}

function Rodape({ fatos }) {
  return (
    <div style={{ marginTop: 26, borderTop: `1px solid ${P_LINHA}`, paddingTop: 10, fontSize: 10.5, color: P_DIM, lineHeight: 1.5 }}>
      {fatos.razao_social}{fatos.cnpj ? ` · CNPJ ${fatos.cnpj}` : ""}<br />
      {fatos.sede}<br />
      {[fatos.telefone, fatos.email, fatos.site].filter(Boolean).join(" · ")}
      {fatos.endosso && <><br />{fatos.endosso}</>}
    </div>
  );
}

// Tabela de itens impressa — a MESMA nos dois documentos, porque é o mesmo
// fato. A soma vem de S.somaLinhas (utils/proposta-rfp.js), a única conta que
// o cliente faz, e ela está rotulada lá e aqui.
function TabelaItens({ S }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={thSt}>Modelo</th>
          <th style={{ ...thSt, textAlign: "right" }}>Qtd</th>
          <th style={{ ...thSt, textAlign: "right" }}>Preço un.</th>
          <th style={{ ...thSt, textAlign: "right" }}>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {S.itensUsados.map((it, i) => (
          <tr key={i}>
            <td style={tdSt}>
              {pend(it.modelLabel)}
              {it.certificationNote && (
                <div style={{ fontSize: 10.5, color: P_DIM }}>{it.certificationNote}</div>
              )}
            </td>
            <td style={{ ...tdSt, textAlign: "right" }}>
              {Number(it.quantity) > 0 ? Number(it.quantity).toLocaleString("pt-BR") : pend(null)}
            </td>
            <td style={{ ...tdSt, textAlign: "right" }}>
              {Number(it.unitPrice) > 0 ? formatBRLCentavos(Number(it.unitPrice)) : pend(null)}
            </td>
            <td style={{ ...tdSt, textAlign: "right" }}>
              {formatBRLCentavos((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0))}
            </td>
          </tr>
        ))}
        <tr>
          <td colSpan={3} style={{ ...tdSt, textAlign: "right", fontWeight: 700, borderBottom: "none" }}>Total</td>
          <td style={{ ...tdSt, textAlign: "right", fontWeight: 700, borderBottom: "none" }}>{formatBRLCentavos(S.somaLinhas)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function DocTecnica({ S, fatos, requisitos, bloqueados }) {
  const r = S.rfp;
  const conf = [
    ...(fatos.homologacao ? [{ e: "Homologação de produto", c: fatos.homologacao, n: "INMETRO" }] : []),
    ...(fatos.sgq ? [{ e: "Sistema de gestão da qualidade", c: fatos.sgq, n: "ISO 9001:2015" }] : []),
    // Sempre presente, mesmo vazia: numa matriz que o comprador leva pra
    // auditoria, linha que some sem deixar rastro é pior que "PENDENTE".
    { e: "Marcação ONU", c: fatos.codigo_onu, n: "Marca ONU" },
    ...requisitos.filter(x => x.exigencia).map(x => ({ e: x.exigencia, c: x.resposta, n: x.norma })),
  ];
  return (
    <div style={docSt}>
      <Marca S={S} />
      <div style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: P_DIM, fontWeight: 700 }}>Documento 1 · ficha técnica e de conformidade</div>
      <h1 style={h1St}>{pend(r.cliente)}</h1>
      <p style={{ color: P_DIM, margin: "0 0 4px" }}>
        {[r.rfp && `RFP ${r.rfp}`, r.aplicacao, r.data && formatDateBR(r.data)].filter(Boolean).join(" · ")}
      </p>

      <h2 style={h2St}>1 · Sumário</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {[
            ["Produto ofertado", pend(r.produto)],
            ["Dimensão", r.dimensao || "a definir"],
            // Com itens, quantidade e preço viram a tabela logo abaixo — o
            // mesmo número em dois lugares é o defeito que a regra 14 descreve.
            ...(S.temItens ? [] : [
              ["Quantidade", r.qtd ? `${Number(r.qtd).toLocaleString("pt-BR")} un` : pend(null)],
              ["Preço unitário", r.preco ? formatBRLCentavos(Number(r.preco)) : pend(null)],
            ]),
            ["Prazo de entrega", pend(r.prazo)],
            ["Incoterm", r.incoterm || "a definir"],
            ["Validade da proposta", pend(r.validade)],
            ["Lote mínimo", bloqueados.moq?.valor ? `${bloqueados.moq.valor} · ${bloqueados.moq.quem}` : pend(null)],
            ["Condição de pagamento", bloqueados.pgto?.valor ? `${bloqueados.pgto.valor} · ${bloqueados.pgto.quem}` : pend(null)],
            ["NCM", bloqueados.ncm?.valor ? `${bloqueados.ncm.valor} · ${bloqueados.ncm.quem}` : pend(null)],
            ["Capacidade de carga", bloqueados.swl?.valor ? `${bloqueados.swl.valor} · ${bloqueados.swl.quem}` : pend(null)],
            ["Empilhamento", bloqueados.stack?.valor ? `${bloqueados.stack.valor} · ${bloqueados.stack.quem}` : pend(null)],
            ["Garantia", bloqueados.gar?.valor ? `${bloqueados.gar.valor} · ${bloqueados.gar.quem}` : pend(null)],
          ].map(([k, v]) => (
            <tr key={k}><td style={{ ...tdSt, color: P_DIM, width: "42%" }}>{k}</td><td style={tdSt}>{v}</td></tr>
          ))}
        </tbody>
      </table>

      {S.temItens && (
        <>
          <h2 style={h2St}>2 · Itens cotados</h2>
          <TabelaItens S={S} />
        </>
      )}

      <h2 style={h2St}>{S.temItens ? 3 : 2} · Matriz de conformidade</h2>
      <p style={{ fontSize: 10.5, color: P_DIM, margin: "0 0 5px" }}>
        Cada linha é uma afirmação que o comprador pode levar para a auditoria dele. Nenhuma sai sem norma nomeada.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={thSt}>Exigência</th><th style={thSt}>Como atendemos</th><th style={thSt}>Norma</th></tr></thead>
        <tbody>
          {conf.map((x, i) => (
            <tr key={i}><td style={tdSt}>{x.e}</td><td style={tdSt}>{pend(x.c)}</td><td style={tdSt}>{pend(x.n)}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 style={h2St}>{S.temItens ? 4 : 3} · Contato</h2>
      <p style={{ margin: 0 }}>{pend(r.vendedor)}{r.contato ? ` · comprador: ${r.contato}` : ""}</p>
      <Rodape fatos={fatos} />
    </div>
  );
}

export function DocPitch({ S, fatos, esgKg = 0, imagens = [] }) {
  const r = S.rfp;
  return (
    <div style={docSt}>
      <Marca S={S} />
      <div style={{ background: "#0A0A0A", color: "#FFFFFF", padding: "30px 28px", marginBottom: 20 }}>
        {/* Tagline vem da Classe 1, nunca escrita aqui: foi assim que o
            gerador em HTML acabou com a versão descontinuada dela. */}
        <h1 style={{ ...h1St, color: "#FFFFFF", fontSize: 27 }}>{fatos.tagline}</h1>
        {fatos.endosso && <p style={{ color: "#B0B0B0", margin: "10px 0 0", fontSize: 12 }}>{fatos.endosso}</p>}
      </div>

      {imagens.length > 0 && (
        // `break-inside: avoid` pra a legenda não descolar da foto na quebra
        // de página. Grid de 2 colunas: com 1 imagem ela ocupa a linha toda
        // pelo `minmax`, com 4 fecham duas linhas cheias.
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginBottom: 20 }}>
          {imagens.map((img) => (
            <figure key={img.id} style={{ margin: 0, breakInside: "avoid" }}>
              <img
                src={img.url}
                alt={img.title || ""}
                style={{ width: "100%", height: 150, objectFit: "cover", display: "block", borderRadius: 3 }}
              />
              <figcaption style={{ fontSize: 10, color: P_DIM, marginTop: 4 }}>{img.title}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <div style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: P_DIM, fontWeight: 700 }}>Documento 2 · proposta comercial</div>
      <h1 style={h1St}>{pend(r.cliente)}</h1>
      <p style={{ color: P_DIM, margin: "0 0 4px" }}>{[r.aplicacao, r.data && formatDateBR(r.data)].filter(Boolean).join(" · ")}</p>

      <h2 style={h2St}>O que está sendo proposto</h2>
      {S.temItens ? (
        <>
          <p>
            {S.itensUsados.length} {S.itensUsados.length === 1 ? "modelo cotado" : "modelos cotados"}
            {r.dimensao ? `, ${r.dimensao}` : ""}
            {r.aplicacao ? `, para ${r.aplicacao}` : ""}.
          </p>
          <TabelaItens S={S} />
        </>
      ) : (
        <p>
          {pend(r.produto)}{r.dimensao ? `, ${r.dimensao}` : ""}
          {r.qtd ? `, ${Number(r.qtd).toLocaleString("pt-BR")} unidades` : ""}
          {r.aplicacao ? `, para ${r.aplicacao}` : ""}.
        </p>
      )}

      <h2 style={h2St}>O que a embalagem comprova em auditoria</h2>
      <p>{fatos.homologacao || <span style={{ color: P_DIM }}>Homologação não preenchida na base da marca.</span>}</p>
      {fatos.sgq && <p style={{ fontSize: 11.5, color: P_DIM }}>{fatos.sgq}</p>}

      <h2 style={h2St}>Condições</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {[
            ...(S.temItens ? [] : [["Preço unitário", r.preco ? formatBRLCentavos(Number(r.preco)) : pend(null)]]),
            ["Prazo de entrega", pend(r.prazo)],
            ["Incoterm", r.incoterm || "a definir"],
            ["Validade", pend(r.validade)],
          ].map(([k, v]) => (
            <tr key={k}><td style={{ ...tdSt, color: P_DIM, width: "42%" }}>{k}</td><td style={tdSt}>{v}</td></tr>
          ))}
        </tbody>
      </table>
      {esgKg > 0 && (
        <>
          <h2 style={h2St}>Selo ESG</h2>
          <p style={{ margin: 0 }}>
            Emissões apuradas do fornecedor: <b>{fmtTonnesCO2e(esgKg)}</b>, somando os escopos 1, 2 e 3 do
            relatório mais recente. É o perfil da empresa vendedora, não uma pegada por unidade deste
            fornecimento — não existe medição por produto, e apresentá-la como tal seria inventar número.
          </p>
        </>
      )}

      {S.pendentes.length > 0 && (
        <p style={{ fontSize: 10.5, color: P_DIM, marginTop: 8 }}>
          Os itens marcados como pendentes dependem de validação interna. Esta proposta não é vinculante enquanto não estiverem fechados.
        </p>
      )}
      <Rodape fatos={fatos} />
    </div>
  );
}

export default PropostaPanel;
