import React, { useState } from "react";
import { Mic, Square, Sparkles, Check, X, PencilLine, Loader2, AlertTriangle, MessageCircleWarning } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAudioRecorder, formatRecordingTime, blobToBase64, AUDIO_MAX_SECONDS } from "../../hooks/use-audio-recorder";
import { useSalesCases } from "../../hooks/use-sales-cases";

// Aprendizado de venda por voz — clone estrutural de AtaVozPanel.jsx
// (src/components/lead/AtaVozPanel.jsx), mesmo motor gravar → IA propõe →
// conferir → aceite explícito grava, adaptado pro domínio de sales_cases
// (aprovado com o Daniel, mockup "Registrar um Caso" em 21/08/2026).
//
// Duas regras herdadas da AtaVozPanel, e é por elas que o código é assim:
//
//  1. NADA é gravado sem o aceite. A edge function caso-prospeccao-voz só
//     devolve um rascunho; quem escreve no banco é o botão "Salvar caso"
//     desta tela, via useSalesCases (cliente normal do usuário, nunca
//     service_role).
//  2. Campo que a IA não achou fica VAZIO, nunca chutado — todo campo do
//     rascunho é opcional e renderiza em branco quando vem null.
//
// Diferenças deliberadas em relação à AtaVozPanel (não é descuido, é o caso
// de uso sendo mais simples):
//
//  - Sem GPS/reverse-geocode/match de viagem — isso é específico de visita
//    física, sales_cases também cobre negociação por telefone/e-mail.
//  - Sem upload pro Storage: sales_cases não guarda o arquivo de áudio, só a
//    transcrição (raw_transcript). Por isso o áudio SEMPRE vai embutido
//    (audioBase64), nos dois modos — nunca precisa do caminho intermediário
//    em lead-attachments que a ata usa.
//  - Sem escolha de "negócio aberto ou novo" — o caso é um registro à parte,
//    não uma atividade de um lead. `leadId` fica de fora por ora.
//  - Aviso de completude: se `resultado` veio vazio ou `situacao` ficou
//    curta demais, mostra um banner (nunca bloqueia) sugerindo gravar de
//    novo com mais detalhe — decidido com o Daniel em 21/08/2026.
//
// Dois modos:
//  mode="client" — a partir da página de um cliente já cadastrado. client_id
//    e nome preenchidos sozinhos.
//  mode="prospect" — a partir do Funil de Vendas, pra alguém que ainda não é
//    cliente formal. Só o nome, digitado ou dito.

const RESULTADOS = [
  { id: "ganhamos", label: "Ganhamos" },
  { id: "perdemos", label: "Perdemos" },
  { id: "andamento", label: "Andamento" },
];

const CATEGORIAS_LICAO = [
  { id: "preco", label: "Preço" },
  { id: "prazo-entrega", label: "Prazo/entrega" },
  { id: "certificacao-compliance", label: "Certificação/compliance" },
  { id: "decisor-relacionamento", label: "Decisor/relacionamento" },
  { id: "concorrencia", label: "Concorrência" },
  { id: "produto-especificacao", label: "Produto/especificação" },
];

// Abaixo disso, "situacao" é curta demais pra ensinar alguma coisa — mesmo
// threshold citado no mockup aprovado (banner de completude).
const SITUACAO_MIN_LEN = 40;

function Lbl({ children, tag }) {
  return (
    <p className="mb-1 flex items-center gap-1.5" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "var(--text-dim)" }}>
      {children}
      {tag && (
        <span style={{ fontSize: 8.5, letterSpacing: "0.06em", padding: "1px 5px", borderRadius: 3, background: "var(--accent-bg, var(--surface-alt))", color: "var(--accent)" }}>
          {tag}
        </span>
      )}
    </p>
  );
}

const inputStyle = {
  width: "100%", borderRadius: 8, padding: "7px 9px", fontSize: 12.5,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
  lineHeight: 1.5, resize: "vertical",
};

export function SalesCaseVoicePanel({
  mode = "prospect",
  client,
  companyId,
  currentUser,
  onSaved,
}) {
  const rec = useAudioRecorder();
  const { insertCase } = useSalesCases();
  const isClientMode = mode === "client";

  const [phase, setPhase]   = useState("idle"); // idle | processing | review
  const [error, setError]   = useState(null);
  const [typing, setTyping] = useState(false);
  const [texto, setTexto]   = useState("");
  const [draft, setDraft]   = useState(null);
  const [origem, setOrigem] = useState("voz"); // voz | texto — vira sales_cases.source
  const [saving, setSaving] = useState(false);

  const aiConfig = currentUser?.aiConfig;
  const podeIA = isSupabaseConfigured;

  const resolvedCompanyId = isClientMode ? (client?.companyIds?.[0] || companyId) : companyId;

  const chamarIA = async (payload) => {
    const { data, error: err } = await supabase.functions.invoke("caso-prospeccao-voz", {
      body: {
        ...payload,
        context: { company: isClientMode ? (client?.name || null) : null },
        // Chave pessoal quando existir; sem ela a function cai na chave da
        // empresa (AI_ORG_*), mesmo mecanismo do resto da plataforma.
        ...(aiConfig?.provider && aiConfig?.apiKey && aiConfig?.model ? { aiConfig } : {}),
      },
    });
    // functions.invoke devolve `data: null` em qualquer resposta 4xx/5xx e
    // uma mensagem genérica no erro — a explicação útil está no CORPO, só
    // alcançável por err.context (mesmo achado documentado na AtaVozPanel).
    if (err) {
      let msg = err.message || "Falha ao processar o caso.";
      try {
        const body = await err.context?.json?.();
        if (body?.error) msg = body.error;
      } catch { /* corpo não era JSON — fica a mensagem genérica */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const montarDraft = (res, textoDigitado) => {
    const s = res.structured || {};
    return {
      cliente_nome: s.cliente_nome || (isClientMode ? client?.name : "") || "",
      setor: s.setor || "",
      resultado: s.resultado || null,
      situacao: s.situacao || "",
      sinais: s.sinais || "",
      objecao_principal: s.objecao_principal || "",
      concorrente: s.concorrente || "",
      licao: s.licao || "",
      categoria_licao: Array.isArray(s.categoria_licao) ? s.categoria_licao.filter(c => CATEGORIAS_LICAO.some(x => x.id === c)) : [],
      transcricao: res.transcript || textoDigitado || "",
    };
  };

  const aoParar = async () => {
    const out = await rec.stop();
    if (!out) { setError("Não veio áudio nenhum. Tente de novo."); return; }
    setPhase("processing");
    setError(null);
    try {
      const audioBase64 = await blobToBase64(out.blob);
      const res = await chamarIA({ audioBase64, mimeType: out.mimeType, durationSeconds: out.durationSeconds });
      setOrigem("voz");
      setDraft(montarDraft(res));
      setPhase("review");
    } catch (e) {
      setError(e.message);
      setPhase("idle");
    }
  };

  const aoEnviarTexto = async () => {
    if (!texto.trim()) return;
    setPhase("processing");
    setError(null);
    try {
      const res = await chamarIA({ text: texto.trim() });
      setOrigem("texto");
      setDraft(montarDraft(res, texto.trim()));
      setPhase("review");
    } catch (e) {
      setError(e.message);
      setPhase("idle");
    }
  };

  const descartar = () => {
    setDraft(null); setTexto(""); setTyping(false);
    setPhase("idle"); setError(null);
  };

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const toggleCategoria = (id) => setDraft(d => {
    const atual = d.categoria_licao || [];
    return { ...d, categoria_licao: atual.includes(id) ? atual.filter(c => c !== id) : [...atual, id] };
  });

  const salvar = async () => {
    if (!draft || saving) return;
    const clienteNome = (draft.cliente_nome || "").trim();
    if (!clienteNome) { setError("Diz o nome do cliente ou prospect antes de salvar."); return; }
    setSaving(true);
    setError(null);
    try {
      await insertCase({
        companyId: resolvedCompanyId,
        clientId: isClientMode ? (client?.id || null) : null,
        clienteNome,
        setor: draft.setor,
        resultado: draft.resultado,
        situacao: draft.situacao,
        sinais: draft.sinais,
        objecaoPrincipal: draft.objecao_principal,
        concorrente: draft.concorrente,
        licao: draft.licao,
        categoriaLicao: draft.categoria_licao,
        rawTranscript: draft.transcricao,
        source: origem,
        createdBy: currentUser?.id || null,
      });
      descartar();
      onSaved?.();
    } catch (e) {
      setError(e.message || "Não foi possível salvar o caso.");
    } finally {
      setSaving(false);
    }
  };

  // Aviso de completude (não bloqueante) — decidido com o Daniel 21/08/2026:
  // resultado vazio ou situação curta demais não rende aprendizado real.
  const precisaMaisDetalhe = draft
    && (!draft.resultado || (draft.situacao || "").trim().length < SITUACAO_MIN_LEN);

  // ── Gravando ────────────────────────────────────────────────────────────
  if (rec.recording) {
    const perto = rec.seconds >= AUDIO_MAX_SECONDS - 30;
    return (
      <div className="rounded-xl p-5 text-center" style={{ border: "1px solid var(--accent)", background: "var(--surface-alt)" }}>
        <p className="flex items-center justify-center gap-2 m-0" style={{ fontSize: 26, fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.02em" }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: "var(--accent)", display: "inline-block" }} />
          {formatRecordingTime(rec.seconds)}
        </p>
        <p className="text-[11px] mt-1 mb-3" style={{ color: "var(--text-dim)" }}>
          {perto
            ? `Gravando — para sozinho em ${AUDIO_MAX_SECONDS - rec.seconds}s`
            : "Gravando — conte o que aconteceu, não precisa de roteiro"}
        </p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => { rec.cancel(); descartar(); }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}>
            <X size={13} /> Cancelar
          </button>
          <button onClick={aoParar}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            <Square size={12} /> Parar e processar
          </button>
        </div>
      </div>
    );
  }

  // ── Processando ─────────────────────────────────────────────────────────
  if (phase === "processing") {
    return (
      <div className="rounded-xl p-7 text-center" style={{ border: "1px dashed var(--border)" }}>
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)", margin: "0 auto 10px" }} />
        <p className="text-[13px] font-semibold m-0" style={{ color: "var(--text)" }}>Organizando o caso…</p>
        <p className="text-[11.5px] mt-1 m-0" style={{ color: "var(--text-dim)" }}>
          Transcrevendo e separando o que você contou. Leva alguns segundos.
        </p>
      </div>
    );
  }

  // ── Conferência ─────────────────────────────────────────────────────────
  if (phase === "review" && draft) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
          <Sparkles size={13} style={{ color: "var(--accent)" }} />
          <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>O que entendi do seu relato</span>
          <span className="text-[10.5px] ml-auto" style={{ color: "var(--text-dim)" }}>confira antes de salvar</span>
        </div>

        <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Lbl>Cliente / prospect</Lbl>
          <input style={{ ...inputStyle, fontWeight: 700 }} value={draft.cliente_nome}
                 disabled={isClientMode}
                 onChange={e => set("cliente_nome", e.target.value)}
                 placeholder="Nome da empresa" />
        </div>

        <div className="px-3.5 py-3 grid gap-3" style={{ borderBottom: "1px solid var(--border)", gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <Lbl>Setor</Lbl>
            <input style={inputStyle} value={draft.setor} onChange={e => set("setor", e.target.value)} placeholder="—" />
          </div>
          <div>
            <Lbl>Resultado</Lbl>
            <div className="inline-flex rounded-lg overflow-hidden w-full" style={{ border: "1px solid var(--border)" }}>
              {RESULTADOS.map((r, i) => {
                const on = draft.resultado === r.id;
                return (
                  <button key={r.id} onClick={() => set("resultado", r.id)}
                          className="text-[10.5px] font-semibold px-2.5 py-1.5 flex-1"
                          style={{
                            background: on ? "var(--accent)" : "var(--surface)",
                            color: on ? "var(--on-accent)" : "var(--text-dim)",
                            borderRight: i < RESULTADOS.length - 1 ? "1px solid var(--border)" : "none",
                          }}>
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Lbl>Situação <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>— o que aconteceu</span></Lbl>
          <textarea rows={3} style={inputStyle} value={draft.situacao}
                    onChange={e => set("situacao", e.target.value)}
                    placeholder="O que aconteceu com este cliente/prospect" />
        </div>

        <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Lbl>Sinais <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>— o que surpreendeu</span></Lbl>
          <textarea rows={2} style={inputStyle} value={draft.sinais}
                    onChange={e => set("sinais", e.target.value)}
                    placeholder="—" />
        </div>

        <div className="px-3.5 py-3 grid gap-3" style={{ borderBottom: "1px solid var(--border)", gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <Lbl>Objeção principal</Lbl>
            <input style={inputStyle} value={draft.objecao_principal} onChange={e => set("objecao_principal", e.target.value)} placeholder="—" />
          </div>
          <div>
            <Lbl>Concorrente citado</Lbl>
            <input style={inputStyle} value={draft.concorrente} onChange={e => set("concorrente", e.target.value)} placeholder="—" />
          </div>
        </div>

        <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Lbl>Lição <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>— pro vendedor novo</span></Lbl>
          <textarea rows={2} style={{ ...inputStyle, marginBottom: 8 }} value={draft.licao}
                    onChange={e => set("licao", e.target.value)}
                    placeholder="—" />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIAS_LICAO.map(c => {
              const on = (draft.categoria_licao || []).includes(c.id);
              return (
                <button key={c.id} onClick={() => toggleCategoria(c.id)}
                        className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full border"
                        style={{
                          borderColor: on ? "var(--accent)" : "var(--border)",
                          background: on ? "var(--accent-bg, var(--surface-alt))" : "var(--surface)",
                          color: on ? "var(--accent)" : "var(--text-dim)",
                        }}>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {precisaMaisDetalhe && (
          <div className="mx-3.5 my-3 rounded-lg px-3 py-2.5 flex items-start gap-2.5" style={{ background: "var(--warning-bg)", border: "1px solid color-mix(in srgb, var(--warning) 40%, var(--border))" }}>
            <MessageCircleWarning size={15} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
            <div className="text-[12px]" style={{ color: "var(--text)", lineHeight: 1.5 }}>
              <strong className="block mb-0.5">Esse caso ficou com pouco detalhe pra virar aprendizado.</strong>
              Resultado ou situação vieram vazios/curtos — vale gravar de novo contando mais, ou é isso mesmo?
              <div className="flex gap-2 mt-2">
                <button onClick={descartar}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border"
                        style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}>
                  <Mic size={11} /> Gravar de novo
                </button>
                <button onClick={salvar} disabled={saving}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border"
                        style={{ borderColor: "var(--border)", color: "var(--text-faint)", background: "var(--surface)" }}>
                  Salvar assim mesmo
                </button>
              </div>
            </div>
          </div>
        )}

        {draft.transcricao && (
          <details className="px-3.5 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <summary className="text-[11px] cursor-pointer" style={{ color: "var(--accent)" }}>
              Ver transcrição completa
            </summary>
            <p className="text-[11.5px] mt-2 mb-0 whitespace-pre-wrap" style={{ color: "var(--text-dim)", lineHeight: 1.6 }}>
              {draft.transcricao}
            </p>
          </details>
        )}

        {error && (
          <div className="px-3.5 py-2 text-[11.5px] flex items-center gap-1.5" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            <AlertTriangle size={12} /> {error}
          </div>
        )}

        <div className="px-3.5 py-2.5 flex items-center gap-2 flex-wrap" style={{ background: "var(--surface-alt)" }}>
          <button onClick={salvar} disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />} Salvar caso
          </button>
          <button onClick={descartar} disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}>
            Descartar
          </button>
        </div>
      </div>
    );
  }

  // ── Início ──────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl px-4 py-5 text-center" style={{ border: "1px dashed var(--border)" }}>
      <Mic size={22} style={{ color: "var(--text-dim)", margin: "0 auto 8px" }} />
      <p className="text-[13.5px] font-bold m-0" style={{ color: "var(--text)" }}>
        Conte o que aconteceu
      </p>
      <p className="text-[11.5px] mt-1 mb-3.5 mx-auto" style={{ color: "var(--text-dim)", maxWidth: "42ch", lineHeight: 1.5 }}>
        {isClientMode
          ? `Ganhou, perdeu ou ainda está negociando com ${client?.name || "este cliente"}? Fale o que aconteceu, você confere antes de salvar.`
          : "Prospect ainda sem cadastro formal? Fale o nome dele e o que aconteceu — vira munição pro playbook de vendas."}
      </p>

      {(error || rec.error) && (
        <div className="rounded-lg px-3 py-2 mb-3 text-[11.5px] flex items-center gap-1.5 justify-center"
             style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          <AlertTriangle size={12} style={{ flex: "none" }} /> {error || rec.error}
        </div>
      )}

      {typing ? (
        <div className="text-left">
          <textarea rows={4} style={inputStyle} value={texto} autoFocus
                    onChange={e => setTexto(e.target.value)}
                    placeholder="Escreva o que aconteceu — a IA organiza do mesmo jeito." />
          <div className="flex gap-2 mt-2">
            <button onClick={aoEnviarTexto} disabled={!texto.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold"
                    style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: texto.trim() ? 1 : 0.5 }}>
              <Sparkles size={12} /> Organizar
            </button>
            <button onClick={() => { setTyping(false); setTexto(""); }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border"
                    style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={() => rec.start()}
            disabled={!podeIA || !rec.supported}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold"
            style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: (podeIA && rec.supported) ? 1 : 0.5 }}
          >
            <Mic size={14} /> Gravar caso
          </button>
          <div className="mt-2">
            <button
              onClick={() => setTyping(true)}
              className="inline-flex items-center gap-1 text-[11px]"
              style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
              <PencilLine size={11} /> ou escrever à mão
            </button>
          </div>
          {!rec.supported && (
            <p className="text-[10.5px] mt-2 mb-0" style={{ color: "var(--text-dim)" }}>
              Este navegador não grava áudio — use "escrever à mão".
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default SalesCaseVoicePanel;
