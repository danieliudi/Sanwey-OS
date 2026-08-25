import React, { useRef, useState } from "react";
import { Mic, Square, Sparkles, Check, PencilLine, Loader2, AlertTriangle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { Modal } from "../ui/Modal";
import { useAudioRecorder, formatRecordingTime, blobToBase64 } from "../../hooks/use-audio-recorder";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";

// Registrar um caso de prospecção (ganhamos/perdemos/andamento) por voz —
// clone estrutural do fluxo gravar → conferir → salvar do AtaVozPanel.jsx
// (mesmo motor useAudioRecorder, mesma casca visual: Lbl, inputStyle,
// máquina de fases idle/processing/review), reaproveitado em vez de
// reinventado (regra 1 do CLAUDE.md — "não construa um padrão de UI novo se
// já existe um funcionando"). Diferenças deliberadas em relação à ata:
//
//  1. Sem GPS nem vínculo de visita planejada — sales_cases não tem essas
//     colunas; isto é um registro de playbook, não um check-in de visita.
//  2. O áudio nunca é persistido no Storage: sales_cases só guarda
//     `raw_transcript` (o texto), não tem coluna de caminho de áudio.
//     Sempre manda audioBase64 pra edge function e descarta os bytes depois
//     de transcrever — mais simples que o modo "client" do AtaVozPanel, que
//     precisa adiar o upload até saber o destino porque lead-attachments
//     exige lead_id.
//  3. Um componente só cobre os dois pontos de entrada do pedido original:
//     passar `client` trava cliente_nome/client_id (e a frente, quando o
//     cliente só atende uma); sem `client`, os três ficam livres.
//
// NADA é gravado sem o aceite explícito: a edge function só devolve um
// rascunho; quem escreve no banco é "Confirmar e salvar" desta tela, via
// `onConfirm` (o addCase de use-sales-cases.js, com a sessão do próprio
// vendedor — RLS decide o que ele pode gravar). Mesmo padrão do
// crm-ata-voz: esta tela nunca passa por service_role.

const RESULTADOS = [
  { id: "ganhamos",  label: "Ganhamos" },
  { id: "perdemos",  label: "Perdemos" },
  { id: "andamento", label: "Em andamento" },
];

function Lbl({ children }) {
  return (
    <p className="mb-1" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "var(--text-dim)" }}>
      {children}
    </p>
  );
}

const inputStyle = {
  width: "100%", borderRadius: 8, padding: "7px 9px", fontSize: 12.5,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
  lineHeight: 1.5, resize: "vertical",
};

export function CasoProspeccaoVozPanel({ client, currentUser, onClose, onConfirm }) {
  const rec = useAudioRecorder();

  const [phase, setPhase]   = useState("idle"); // idle | processing | review
  const [error, setError]   = useState(null);
  const [typing, setTyping] = useState(false);
  const [texto, setTexto]   = useState("");
  const [draft, setDraft]   = useState(null);
  const [origem, setOrigem] = useState("voz"); // voz | texto — vira sales_cases.source
  const [saving, setSaving] = useState(false);

  // Cliente já conhecido (entrada 1) trava nome/frente-quando-óbvia; sem
  // cliente (entrada 2, botão solto) os três campos ficam livres — nunca
  // "chuta" uma frente quando o cliente atende mais de uma.
  const frenteConhecida = client?.companyIds?.length === 1 ? client.companyIds[0] : null;
  const [clienteNome, setClienteNome] = useState(client?.name || "");
  const [frente, setFrente] = useState(frenteConhecida);
  // Cliente sem nenhuma empresa vinculada (cadastro incompleto, raro mas
  // possível) cai pra todas as opções — nunca deixa "Frente" sem nenhum
  // botão pra escolher, o que travaria o salvar pra sempre.
  const opcoesFrente = client?.companyIds?.length ? client.companyIds : COMPANY_IDS;

  const startingRef = useRef(false);
  const aiConfig = currentUser?.aiConfig;
  const podeIA = isSupabaseConfigured;

  const chamarIA = async (payload) => {
    const { data, error: err } = await supabase.functions.invoke("caso-prospeccao-voz", {
      body: {
        ...payload,
        context: { company: client?.name || null },
        // Chave pessoal quando existir; sem ela a function cai na chave da
        // empresa (AI_ORG_*), mesmo mecanismo do resto da plataforma.
        ...(aiConfig?.provider && aiConfig?.apiKey && aiConfig?.model ? { aiConfig } : {}),
      },
    });
    // functions.invoke devolve `data: null` em qualquer 4xx/5xx e uma
    // mensagem genérica no erro — a explicação útil só chega por
    // err.context (mesmo desembrulho do AtaVozPanel).
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

  const aplicarRascunho = (res, fallbackTranscript = "") => {
    setDraft({ ...(res.structured || {}), transcricao: res.transcript || fallbackTranscript });
    // Cliente já conhecido: o nome do cadastro é mais confiável que o que a
    // IA extraiu da fala — nunca sobrescreve com um palpite.
    // typeof === "string": o JSON do modelo não passa por validação de
    // schema (parseModelJson só faz JSON.parse) — um drift do modelo
    // devolvendo número/objeto em vez de string não pode virar o valor de
    // clienteNome, que mais adiante leva `.trim()` fora de try/catch
    // (achado real de revisão adversarial: sem essa guarda, um
    // cliente_nome não-string quebra o render inteiro, não só esta tela).
    if (client) setClienteNome(client.name);
    else if (typeof res.structured?.cliente_nome === "string") setClienteNome(res.structured.cliente_nome);
    setPhase("review");
  };

  const aoParar = async () => {
    const out = await rec.stop();
    if (!out) { setError("Não veio áudio nenhum. Tente de novo."); return; }
    setPhase("processing");
    setError(null);
    setOrigem("voz");
    try {
      const audioBase64 = await blobToBase64(out.blob);
      const res = await chamarIA({ audioBase64, mimeType: out.mimeType, durationSeconds: out.durationSeconds });
      aplicarRascunho(res);
    } catch (e) {
      setError(e.message);
      setPhase("idle");
    }
  };

  const aoEnviarTexto = async () => {
    if (!texto.trim()) return;
    setPhase("processing");
    setError(null);
    setOrigem("texto");
    try {
      const res = await chamarIA({ text: texto.trim() });
      aplicarRascunho(res, texto.trim());
    } catch (e) {
      setError(e.message);
      setPhase("idle");
    }
  };

  const descartar = () => {
    setDraft(null); setTexto(""); setTyping(false);
    setPhase("idle"); setError(null);
    if (!client) { setClienteNome(""); setFrente(null); }
  };

  const podeSalvar = Boolean(clienteNome.trim() && draft?.resultado && frente && !saving);

  const salvar = async () => {
    if (!draft || !podeSalvar) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        client_id: client?.id || null,
        cliente_nome: clienteNome.trim(),
        setor: draft.setor || null,
        resultado: draft.resultado,
        situacao: draft.situacao || null,
        sinais: draft.sinais || null,
        licao: draft.licao || null,
        raw_transcript: draft.transcricao || null,
        source: origem,
        frente,
        created_by: currentUser?.id || null,
      });
      descartar();
      onClose?.();
    } catch (e) {
      setError(e.message || "Não foi possível salvar o caso.");
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  return (
    <Modal open onClose={onClose} title="Registrar um caso" width={560}>
      <div className="p-4">
        {/* ── Gravando ──────────────────────────────────────────────────── */}
        {rec.recording && (
          <div className="rounded-xl p-5 text-center" style={{ border: "1px solid var(--accent)", background: "var(--surface-alt)" }}>
            <p className="flex items-center justify-center gap-2 m-0" style={{ fontSize: 26, fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.02em" }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: "var(--accent)", display: "inline-block" }} />
              {formatRecordingTime(rec.seconds)}
            </p>
            <p className="text-[11px] mt-1 mb-3" style={{ color: "var(--text-dim)" }}>
              Gravando — fale naturalmente, não precisa de roteiro
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => { rec.cancel(); descartar(); }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
                      style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}>
                Cancelar
              </button>
              <button onClick={aoParar}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold"
                      style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                <Square size={12} /> Parar e processar
              </button>
            </div>
          </div>
        )}

        {/* ── Processando ───────────────────────────────────────────────── */}
        {!rec.recording && phase === "processing" && (
          <div className="rounded-xl p-7 text-center" style={{ border: "1px dashed var(--border)" }}>
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)", margin: "0 auto 10px" }} />
            <p className="text-[13px] font-semibold m-0" style={{ color: "var(--text)" }}>Organizando seu caso…</p>
            <p className="text-[11.5px] mt-1 m-0" style={{ color: "var(--text-dim)" }}>
              Transcrevendo e separando o que aconteceu. Leva alguns segundos.
            </p>
          </div>
        )}

        {/* ── Conferência ───────────────────────────────────────────────── */}
        {!rec.recording && phase === "review" && draft && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
              <Sparkles size={13} style={{ color: "var(--accent)" }} />
              <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>O que entendi do caso</span>
              <span className="text-[10.5px] ml-auto" style={{ color: "var(--text-dim)" }}>confira antes de salvar</span>
            </div>

            <div className="px-3.5 py-3 grid gap-3" style={{ borderBottom: "1px solid var(--border)", gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <Lbl>Cliente</Lbl>
                {client ? (
                  <p className="m-0 font-semibold" style={{ fontSize: 13, color: "var(--text)" }}>{client.name}</p>
                ) : (
                  <input style={inputStyle} value={clienteNome} onChange={e => setClienteNome(e.target.value)}
                         placeholder="Nome do cliente/prospect" />
                )}
              </div>
              <div>
                <Lbl>Setor</Lbl>
                <input style={inputStyle} value={draft.setor || ""} onChange={e => set("setor", e.target.value)} placeholder="—" />
              </div>
            </div>

            <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <Lbl>Resultado *</Lbl>
              <div className="inline-flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {RESULTADOS.map((r, i) => {
                  const on = draft.resultado === r.id;
                  return (
                    <button key={r.id} onClick={() => set("resultado", r.id)}
                            className="text-[10.5px] font-semibold px-2.5 py-1.5"
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

            <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <Lbl>Frente *</Lbl>
              <div className="flex flex-wrap gap-2">
                {opcoesFrente.map(id => {
                  const co = COMPANIES[id];
                  if (!co) return null;
                  const sel = frente === id;
                  return (
                    <button key={id} onClick={() => setFrente(id)}
                            className="px-2.5 py-1 rounded-full text-xs font-medium border"
                            style={{ borderColor: sel ? co.primary : "var(--border)", background: sel ? co.primary + "1A" : "var(--surface)", color: sel ? co.primary : "var(--text-dim)" }}>
                      {co.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <Lbl>Situação — o que aconteceu</Lbl>
              <textarea rows={3} style={inputStyle} value={draft.situacao || ""}
                        onChange={e => set("situacao", e.target.value)}
                        placeholder="O que aconteceu na visita/negociação" />
            </div>

            <div className="px-3.5 py-3 grid gap-3" style={{ borderBottom: "1px solid var(--border)", gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <Lbl>Sinais — o que surpreendeu</Lbl>
                <textarea rows={3} style={inputStyle} value={draft.sinais || ""} onChange={e => set("sinais", e.target.value)} placeholder="Nada, se não houve" />
              </div>
              <div>
                <Lbl>Lição pra um vendedor novo</Lbl>
                <textarea rows={3} style={inputStyle} value={draft.licao || ""} onChange={e => set("licao", e.target.value)} placeholder="Nada, se não houve" />
              </div>
            </div>

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
              <button onClick={salvar} disabled={!podeSalvar}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold"
                      style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: podeSalvar ? 1 : 0.5 }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />} Confirmar e salvar
              </button>
              <button onClick={descartar} disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
                      style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}>
                Descartar
              </button>
              {!podeSalvar && !saving && (
                <span className="text-[10.5px] ml-auto" style={{ color: "var(--text-dim)" }}>
                  preencha cliente, resultado e frente pra salvar
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Início ────────────────────────────────────────────────────── */}
        {!rec.recording && phase === "idle" && (
          <div className="rounded-xl px-4 py-5 text-center" style={{ border: "1px dashed var(--border)" }}>
            <Mic size={22} style={{ color: "var(--text-dim)", margin: "0 auto 8px" }} />
            <p className="text-[13.5px] font-bold m-0" style={{ color: "var(--text)" }}>
              Conte o que aconteceu
            </p>
            <p className="text-[11.5px] mt-1 mb-3.5 mx-auto" style={{ color: "var(--text-dim)", maxWidth: "42ch", lineHeight: 1.5 }}>
              {client
                ? `Visita, ligação ou negociação com ${client.name} — ganha, perdida ou em andamento. Fale livremente; você confere antes de salvar.`
                : "Visita, ligação ou negociação com um cliente ou prospect — mesmo que ainda não seja cliente formal. Fale livremente; você confere antes de salvar."}
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
                  onClick={async () => {
                    if (startingRef.current || rec.recording) return; // duplo clique — já em andamento
                    startingRef.current = true;
                    try { setError(null); await rec.start(); }
                    finally { startingRef.current = false; }
                  }}
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
        )}
      </div>
    </Modal>
  );
}

export default CasoProspeccaoVozPanel;
