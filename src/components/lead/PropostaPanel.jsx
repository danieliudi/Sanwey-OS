import React, { useMemo, useState } from "react";
import { FileDown, Printer, Plus, Trash2, Check, AlertCircle, Lock } from "lucide-react";
import { useProposals } from "../../hooks/use-proposals";
import { useConfigComercial } from "../../hooks/use-config-comercial";
import { useEsgReports } from "../../hooks/use-esg-carbon";
import { CAMPOS_FATOS, fatosDivergentes } from "../../constants/fatos-canonicos";
import { CAMPOS_RFP, CAMPOS_BLOQUEADOS, avaliarProposta } from "../../utils/proposta-rfp";
import { formatBRL } from "../../utils/currency";
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

function printarDoc(qual) {
  const alvo = document.getElementById(`proposta-doc-${qual}`);
  if (!alvo) return;
  document.querySelectorAll("[data-proposta-doc]").forEach((el) => {
    el.classList.toggle("doc-print-only", true);
    el.style.display = el === alvo ? "" : "none";
  });
  const style = document.createElement("style");
  style.id = "proposta-print-page";
  style.textContent = "@media print { @page { size: A4 portrait; margin: 1.6cm; } }";
  document.head.appendChild(style);
  document.body.classList.add("printing-doc");
  const limpar = () => {
    document.body.classList.remove("printing-doc");
    document.getElementById("proposta-print-page")?.remove();
    document.querySelectorAll("[data-proposta-doc]").forEach((el) => { el.style.display = "none"; });
    window.removeEventListener("afterprint", limpar);
  };
  window.addEventListener("afterprint", limpar);
  window.print();
  // Alguns navegadores não disparam afterprint de forma confiável — mesmo
  // fallback que a aba antiga já usava.
  setTimeout(limpar, 1500);
}

export function PropostaPanel({ lead, currentUser }) {
  const { proposal, versoes, loading, error, persist } = useProposals(lead.id, lead.companyId);
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

  const salvo = proposal?.rfp_snapshot || {};
  const [rascunho, setRascunho] = useState(() => ({
    vendedor: currentUser?.name || "",
    data: toLocalISODate(new Date()),
    ...(salvo.rfp || {}),
  }));
  const [bloqueados, setBloqueados] = useState(() => salvo.bloqueados || {});
  const [requisitos, setRequisitos] = useState(() => salvo.requisitos || []);
  const [aba, setAba] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const S = useMemo(
    () => avaliarProposta({ lead, rascunho, bloqueados, requisitos, fatos }),
    [lead, rascunho, bloqueados, requisitos, fatos],
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
        items: [],
        createdBy: currentUser?.id,
        // Snapshot, não espelho: o que o cliente recebeu naquele dia fica como
        // estava, mesmo que o negócio mude depois.
        rfpSnapshot: { rfp: S.rfp, bloqueados, requisitos, fatos, esgKg, geradoEm: new Date().toISOString() },
        novaVersao: true,
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
          {CAMPOS_RFP.map((c) => {
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
      </div>

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
          <span style={{ fontSize: 9.5, fontFamily: "ui-monospace, monospace", fontWeight: 700, letterSpacing: "0.08em", color: "var(--danger)", background: "var(--danger-bg)", borderRadius: 99, padding: "1px 7px", marginLeft: "auto" }}>
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
                  background: ok ? "var(--success-bg)" : "var(--danger-bg)", color: ok ? "var(--success)" : "var(--danger)",
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
        <DocPitch S={S} fatos={fatos} esgKg={esgKg} />
      </div>
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

function DocTecnica({ S, fatos, requisitos, bloqueados }) {
  const r = S.rfp;
  const conf = [
    ...(fatos.homologacao ? [{ e: "Homologação de produto", c: fatos.homologacao, n: "INMETRO" }] : []),
    ...(fatos.sgq ? [{ e: "Sistema de gestão da qualidade", c: fatos.sgq, n: "ISO 9001:2015" }] : []),
    ...(fatos.codigo_onu ? [{ e: "Marcação ONU", c: fatos.codigo_onu, n: "Marca ONU" }] : []),
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
            ["Quantidade", r.qtd ? `${Number(r.qtd).toLocaleString("pt-BR")} un` : pend(null)],
            ["Preço unitário", r.preco ? formatBRL(Number(r.preco)) : pend(null)],
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

      <h2 style={h2St}>2 · Matriz de conformidade</h2>
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

      <h2 style={h2St}>3 · Contato</h2>
      <p style={{ margin: 0 }}>{pend(r.vendedor)}{r.contato ? ` · comprador: ${r.contato}` : ""}</p>
      <Rodape fatos={fatos} />
    </div>
  );
}

// ESG & Carbono — mesma formatação de ESGCarbonoView (kgToT/fmtT), só com o
// sufixo CO2e pro contexto de proposta. Não reimplementar diferente.
function fmtTonnesCO2e(kg) {
  const t = (Number(kg) || 0) / 1000;
  return `${t.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t CO2e`;
}

function DocPitch({ S, fatos, esgKg = 0 }) {
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

      <div style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: P_DIM, fontWeight: 700 }}>Documento 2 · proposta comercial</div>
      <h1 style={h1St}>{pend(r.cliente)}</h1>
      <p style={{ color: P_DIM, margin: "0 0 4px" }}>{[r.aplicacao, r.data && formatDateBR(r.data)].filter(Boolean).join(" · ")}</p>

      <h2 style={h2St}>O que está sendo proposto</h2>
      <p>
        {pend(r.produto)}{r.dimensao ? `, ${r.dimensao}` : ""}
        {r.qtd ? `, ${Number(r.qtd).toLocaleString("pt-BR")} unidades` : ""}
        {r.aplicacao ? `, para ${r.aplicacao}` : ""}.
      </p>

      <h2 style={h2St}>O que a embalagem comprova em auditoria</h2>
      <p>{fatos.homologacao || <span style={{ color: P_DIM }}>Homologação não preenchida na base da marca.</span>}</p>
      {fatos.sgq && <p style={{ fontSize: 11.5, color: P_DIM }}>{fatos.sgq}</p>}

      <h2 style={h2St}>Condições</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {[
            ["Preço unitário", r.preco ? formatBRL(Number(r.preco)) : pend(null)],
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
