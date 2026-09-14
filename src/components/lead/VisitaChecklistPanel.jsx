import React, { useMemo, useState } from "react";
import { Mic, ChevronDown, ChevronRight, Check } from "lucide-react";
import { SECOES, CAMPO, DESTINO } from "../../constants/checklist-visita";
import { avaliarChecklist, completudeDasSecoes, respostasDoLead } from "../../utils/checklist-visita";
import { CurrencyInput } from "../ui/CurrencyInput";

// Checklist de visita — a tela que o vendedor usa DENTRO do cliente.
//
// Mockup aprovado com o Daniel em 14/09/2026 ("O checklist não é onde se
// digita"), a partir da folha impressa que o vendedor já leva na visita e de
// uma pergunta dele: um app separado, como um vendedor sugeriu, ou dentro da
// plataforma? Dentro — porque é aqui que o dado já vira funil, e porque o
// volume coletado aqui é o insumo que hoje não existe em coluna nenhuma.
//
// ── A INVERSÃO, QUE É A COISA TODA ────────────────────────────────────────
// Reconstruir as 9 seções como formulário seriam ~60 lacunas num celular, de
// pé, na frente do cliente. O papel funciona porque é escaneável e se preenche
// fora de ordem. Um formulário perde as duas coisas, e na segunda visita o
// vendedor volta pro papel — aí perdemos o dado E a ferramenta.
//
// Então o bloco de cima não é campo a preencher: é A PERGUNTA QUE FALTA FAZER,
// redigida do jeito que se fala, ordenada pelo peso no score. As 9 seções
// ficam embaixo como ÍNDICE, fechadas — abre-se só a que precisa. Na maior
// parte da visita não se abre nenhuma.
//
// O score não aparece como campo a marcar: é somado do que foi coletado.
// Marcar "decisor identificado" sem ter o nome do decisor é como um score de
// priorização vira ficção.
export function VisitaChecklistPanel({ lead, onSalvar, onGravarAta, salvando = false }) {
  const [aberta, setAberta] = useState(null);      // id da seção expandida
  const [rascunho, setRascunho] = useState({});    // edições ainda não salvas

  const leadComRascunho = useMemo(() => ({
    ...lead,
    customFields: { ...(lead?.customFields || {}), ...rascunho },
  }), [lead, rascunho]);

  const avaliacao = useMemo(() => avaliarChecklist(leadComRascunho), [leadComRascunho]);
  const secoes    = useMemo(() => completudeDasSecoes(leadComRascunho, avaliacao), [leadComRascunho, avaliacao]);
  const respostas = useMemo(() => respostasDoLead(leadComRascunho), [leadComRascunho]);

  const sujo = Object.keys(rascunho).length > 0;
  const editar = (chave, valor) => setRascunho(r => ({ ...r, [chave]: valor }));

  const salvar = async () => {
    await onSalvar?.({ respostas: rascunho, score: avaliacao.total, faixa: avaliacao.faixa.id });
    setRascunho({});
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Score e progresso ───────────────────────────────────────────── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 13px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
            Qualificação da visita
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums",
            color: "var(--text-dim)", background: "var(--surface-alt)",
            border: "1px solid var(--border)", borderRadius: 99, padding: "2px 9px", whiteSpace: "nowrap",
          }}>
            {avaliacao.total} · {avaliacao.faixa.id}
          </span>
        </div>
        <div style={{ height: 4, background: "var(--border)", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${avaliacao.pct}%`, borderRadius: 99,
            background: avaliacao.pct >= 80 ? "var(--success)" : avaliacao.pct >= 50 ? "var(--amber)" : "var(--text-faint)",
          }} />
        </div>
        {/* Regra 14: o denominador aparece, e o que ficou de fora é contado —
            nunca "45 de 100" quando um dos itens não pode somar. */}
        <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 6, lineHeight: 1.45 }}>
          {avaliacao.total} de {avaliacao.possivel} possíveis · {avaliacao.faixa.rotulo}
          {avaliacao.naoAvaliaveis.length > 0 && (
            <> · <span style={{ color: "var(--warning)" }}>
              {avaliacao.naoAvaliaveis.map(i => i.rotulo).join(", ")} fora da conta (limiar não configurado)
            </span></>
          )}
        </div>
      </div>

      {/* ── Falta perguntar ─────────────────────────────────────────────── */}
      {avaliacao.faltantes.length > 0 && (
        <div style={{
          background: "var(--warning-bg)", borderRadius: 12, padding: "11px 12px",
          border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
            <b style={{ fontSize: 12, fontWeight: 700, color: "var(--warning)" }}>Falta perguntar</b>
            <span style={{ fontSize: 10.5, color: "var(--warning)", fontVariantNumeric: "tabular-nums" }}>
              +{avaliacao.pontosEmAberto} pts
            </span>
          </div>
          {avaliacao.faltantes.map((item, i) => (
            <div key={item.id} style={{
              display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0",
              borderTop: i === 0 ? "none" : "1px solid color-mix(in srgb, var(--warning) 18%, transparent)",
            }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--warning)", width: 26, flexShrink: 0, paddingTop: 1, fontVariantNumeric: "tabular-nums" }}>
                +{item.peso}
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.4, color: "var(--text)" }}>{item.pergunta}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Ata: quem preenche o resto ──────────────────────────────────── */}
      {onGravarAta && (
        <button
          onClick={onGravarAta}
          style={{
            display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
            background: "var(--accent)", color: "var(--on-accent)", border: "none",
            borderRadius: 12, padding: "12px 14px", cursor: "pointer",
          }}
        >
          <Mic size={17} style={{ flexShrink: 0 }} />
          <span>
            <b style={{ display: "block", fontSize: 13, fontWeight: 700 }}>Gravar a conversa</b>
            <span style={{ fontSize: 10.5, opacity: 0.85 }}>a ata preenche o que for falado</span>
          </span>
        </button>
      )}

      {/* ── Índice das 9 seções ─────────────────────────────────────────── */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
        {secoes.map((s, i) => {
          const def = SECOES.find(x => x.id === s.id);
          const completa = s.total > 0 && s.preenchidos >= s.total;
          const vazia = s.preenchidos === 0;
          const expandida = aberta === s.id;
          return (
            <div key={s.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <button
                onClick={() => setAberta(expandida ? null : s.id)}
                disabled={def?.calculada}
                style={{
                  display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
                  background: "none", border: "none", padding: "9px 11px", fontSize: 12,
                  color: "var(--text)", cursor: def?.calculada ? "default" : "pointer",
                }}
              >
                <span style={{ fontSize: 10, color: "var(--text-faint)", width: 13, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{s.numero}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.nome}</span>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0,
                  background: completa ? "var(--success-bg)" : vazia ? "var(--surface-alt)" : "var(--warning-bg)",
                  color:      completa ? "var(--success)"    : vazia ? "var(--text-faint)" : "var(--warning)",
                }}>
                  {def?.calculada ? `${s.preenchidos} de ${s.total}`
                    : completa ? "completa"
                    : vazia ? "vazia"
                    : `falta ${s.total - s.preenchidos}`}
                </span>
                {!def?.calculada && (expandida ? <ChevronDown size={13} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                                               : <ChevronRight size={13} style={{ color: "var(--text-faint)", flexShrink: 0 }} />)}
              </button>

              {expandida && def && (
                <div style={{ padding: "2px 11px 12px", display: "flex", flexDirection: "column", gap: 9 }}>
                  {def.campos.map((c) => (
                    <CampoDoChecklist
                      key={c.chave}
                      campo={c}
                      valor={respostas[c.chave] ?? ""}
                      onChange={(v) => editar(c.chave, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sujo && (
        <button
          onClick={salvar}
          disabled={salvando}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: "var(--accent)", color: "var(--on-accent)", border: "none",
            borderRadius: 9, padding: "10px 14px", fontSize: 13, fontWeight: 700,
            cursor: salvando ? "default" : "pointer", opacity: salvando ? 0.6 : 1,
          }}
        >
          <Check size={14} /> {salvando ? "Salvando…" : "Salvar visita"}
        </button>
      )}
    </div>
  );
}

const rotuloSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 3 };
const inputSt  = { width: "100%", background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 9px", fontSize: 12.5 };

function CampoDoChecklist({ campo, valor, onChange }) {
  // Campo vindo do cliente é leitura: a plataforma já sabe, e reperguntar o
  // CNPJ na frente do cliente é o oposto do que esta tela existe pra fazer.
  const somenteLeitura = campo.destino === DESTINO.CLIENTE;

  return (
    <div>
      <label style={rotuloSt}>{campo.rotulo}</label>

      {somenteLeitura ? (
        <div style={{ ...inputSt, color: valor ? "var(--text-dim)" : "var(--text-faint)" }}>
          {valor || "—"}
        </div>
      ) : campo.tipo === CAMPO.DINHEIRO ? (
        <CurrencyInput value={valor} onChange={onChange} style={inputSt} ariaLabel={campo.rotulo} />
      ) : campo.tipo === CAMPO.NUMERO ? (
        <input type="number" inputMode="numeric" value={valor} onChange={(e) => onChange(e.target.value)} style={inputSt} />
      ) : campo.tipo === CAMPO.DATA ? (
        <input type="date" value={valor} onChange={(e) => onChange(e.target.value)} style={inputSt} />
      ) : campo.tipo === CAMPO.SIM_NAO ? (
        <div style={{ display: "flex", gap: 7 }}>
          {["Sim", "Não"].map((o) => (
            <Opcao key={o} rotulo={o} ativa={valor === o} onClick={() => onChange(valor === o ? "" : o)} />
          ))}
        </div>
      ) : campo.tipo === CAMPO.ESCOLHA || campo.tipo === CAMPO.MULTI ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {campo.opcoes.map((o) => {
            const lista = campo.tipo === CAMPO.MULTI ? (Array.isArray(valor) ? valor : []) : null;
            const ativa = lista ? lista.includes(o) : valor === o;
            return (
              <Opcao
                key={o} rotulo={o} ativa={ativa}
                onClick={() => onChange(
                  lista ? (ativa ? lista.filter(x => x !== o) : [...lista, o])
                        : (ativa ? "" : o)
                )}
              />
            );
          })}
        </div>
      ) : campo.longo ? (
        <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={2} style={{ ...inputSt, resize: "vertical" }} />
      ) : (
        <input type="text" value={valor} onChange={(e) => onChange(e.target.value)} style={inputSt} />
      )}
    </div>
  );
}

// Alvo de toque de 32px: isto é operado com o polegar, de pé, numa planta.
function Opcao({ rotulo, ativa, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 32, padding: "6px 11px", borderRadius: 8, fontSize: 12, cursor: "pointer",
        border: `1.5px solid ${ativa ? "var(--accent)" : "var(--border)"}`,
        background: ativa ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--surface)",
        color: ativa ? "var(--accent)" : "var(--text)",
        fontWeight: ativa ? 700 : 500,
      }}
    >
      {rotulo}
    </button>
  );
}

export default VisitaChecklistPanel;
