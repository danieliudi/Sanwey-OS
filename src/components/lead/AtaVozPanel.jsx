import React, { useMemo, useState } from "react";
import { Mic, Square, Sparkles, Check, X, PencilLine, Loader2, AlertTriangle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAudioRecorder, formatRecordingTime, AUDIO_MAX_SECONDS } from "../../hooks/use-audio-recorder";
import { useLeadAttachments } from "../../hooks/use-lead-attachments";

// Ata de visita por voz — o vendedor sai da reunião, fala um minuto, confere
// o que a IA entendeu e salva. Aprovado com o Daniel em 13/08/2026 (mockup
// das 4 telas).
//
// Três regras combinadas no mockup, e é por elas que o código é assim:
//
//  1. NADA é gravado sem o aceite. A edge function só devolve um rascunho;
//     quem escreve no banco é o botão "Salvar ata" desta tela, pelo mesmo
//     addLeadActivity que a nota manual já usa. É o padrão "IA propõe,
//     humano aprova" do Time de Agentes.
//  2. Campo que a IA não achou fica VAZIO, nunca chutado — por isso todo
//     campo do rascunho é opcional e renderiza em branco quando vem null.
//  3. A IA NUNCA move o card de etapa. Ela sugere próximo passo e data;
//     mover no funil continua sendo ato consciente de quem vende.
//
// O áudio sobe pelo mesmo useLeadAttachments dos outros anexos, então ele
// aparece sozinho na aba Anexos e continua ouvível se a transcrição errar.

const TEMPERATURAS = [
  { id: "frio",   label: "Frio" },
  { id: "morno",  label: "Morno" },
  { id: "quente", label: "Quente" },
];

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

export function AtaVozPanel({ lead, currentUser, onAddActivity, onUpdate, onSaved }) {
  const rec = useAudioRecorder();
  // Mesmo hook dos outros anexos do lead: o áudio da ata entra no bucket e na
  // aba Anexos pelo caminho de sempre, sem storage paralelo — é o que garante
  // que dê pra ouvir de novo quando a transcrição errar.
  const { upload: uploadAttachment } = useLeadAttachments(lead?.id);
  const [phase, setPhase]   = useState("idle"); // idle | processing | review
  const [error, setError]   = useState(null);
  const [typing, setTyping] = useState(false);
  const [texto, setTexto]   = useState("");
  const [draft, setDraft]   = useState(null);
  const [audioInfo, setAudioInfo] = useState(null); // { path, name, seconds }
  const [saving, setSaving] = useState(false);

  const aiConfig = currentUser?.aiConfig;
  const podeIA = isSupabaseConfigured;

  const contexto = useMemo(() => ({
    company: lead?.company || null,
    sector:  lead?.sector || null,
    stage:   lead?.stage || null,
  }), [lead]);

  const chamarIA = async (payload) => {
    const { data, error: err } = await supabase.functions.invoke("crm-ata-voz", {
      body: {
        ...payload,
        context: contexto,
        // Chave pessoal quando existir; sem ela a function cai na chave da
        // empresa (AI_ORG_*), mesmo mecanismo do resto da plataforma.
        ...(aiConfig?.provider && aiConfig?.apiKey && aiConfig?.model ? { aiConfig } : {}),
      },
    });
    // functions.invoke devolve `data: null` em qualquer resposta 4xx/5xx e
    // uma mensagem genérica ("non-2xx status code") no erro — a explicação
    // útil ("IA não configurada", "provedor não recebe áudio") está no CORPO,
    // que só é alcançável por err.context. Sem desembrulhar isso, quem opera
    // vê só "erro" e não sabe o que fazer.
    if (err) {
      let msg = err.message || "Falha ao processar a ata.";
      try {
        const body = await err.context?.json?.();
        if (body?.error) msg = body.error;
      } catch { /* corpo não era JSON — fica a mensagem genérica */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const aoParar = async () => {
    const out = await rec.stop();
    if (!out) { setError("Não veio áudio nenhum. Tente de novo."); return; }
    setPhase("processing");
    setError(null);
    try {
      // `companyId` em camelCase: o objeto de lead no frontend já vem mapeado
      // por use-leads.js (rowToLead), não é a linha crua do banco.
      const anexo = await uploadAttachment(out.file, {
        leadId: lead.id, companyId: lead.companyId, uploadedBy: currentUser?.id || null,
      });
      if (!anexo?.file_path) throw new Error("Não foi possível guardar o áudio.");
      setAudioInfo({ path: anexo.file_path, name: anexo.file_name, seconds: out.durationSeconds });
      const res = await chamarIA({
        audioPath: anexo.file_path, mimeType: out.mimeType, durationSeconds: out.durationSeconds,
      });
      setDraft({ ...(res.structured || {}), transcricao: res.transcript || "" });
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
      setDraft({ ...(res.structured || {}), transcricao: res.transcript || texto.trim() });
      setPhase("review");
    } catch (e) {
      setError(e.message);
      setPhase("idle");
    }
  };

  const descartar = () => {
    setDraft(null); setAudioInfo(null); setTexto(""); setTyping(false);
    setPhase("idle"); setError(null);
  };

  const salvar = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    try {
      const resumo = (draft.resumo || "").trim() || "Ata de visita registrada.";
      await onAddActivity(lead.id, {
        type: "ata_voz",
        userId: currentUser?.id || null,
        userName: currentUser?.name || null,
        body: resumo,
        meta: {
          transcricao: draft.transcricao || null,
          proximoPasso: draft.proximo_passo || null,
          proximoPassoData: draft.proximo_passo_data || null,
          dor: draft.dor || null,
          objecao: draft.objecao || null,
          concorrente: draft.concorrente || null,
          temperatura: draft.temperatura || null,
          pessoas: Array.isArray(draft.pessoas) ? draft.pessoas : [],
          audioPath: audioInfo?.path || null,
          audioSegundos: audioInfo?.seconds || null,
          // Marca a origem: quem ler o histórico daqui a um ano precisa saber
          // que este texto passou por transcrição automática.
          origem: audioInfo ? "audio" : "texto",
        },
      });

      // Só o follow-up é escrito de volta no lead, e só se a IA achou data.
      // Etapa do funil não se move sozinha (regra 3 do cabeçalho).
      // `nextFollowUp` em camelCase: patchToRow (use-leads.js) é quem traduz
      // pra coluna next_follow_up — mandar snake_case aqui seria ignorado.
      if (draft.proximo_passo_data && onUpdate) {
        await onUpdate(lead.id, { nextFollowUp: draft.proximo_passo_data });
      }
      descartar();
      onSaved?.();
    } catch (e) {
      setError(e.message || "Não foi possível salvar a ata.");
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  // ── Gravando ────────────────────────────────────────────────────────────
  if (rec.recording) {
    const perto = rec.seconds >= AUDIO_MAX_SECONDS - 30;
    return (
      <div className="rounded-xl p-5 text-center" style={{ border: "1px solid var(--accent)", background: "var(--surface-alt)" }}>
        <p className="flex items-center justify-center gap-2 m-0" style={{ fontSize: 26, fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.02em" }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: "var(--accent)", display: "inline-block" }} />
          {formatRecordingTime(rec.seconds)}
        </p>
        <p className="text-[11px] mt-1 mb-4" style={{ color: "var(--text-dim)" }}>
          {perto
            ? `Gravando — para sozinho em ${AUDIO_MAX_SECONDS - rec.seconds}s`
            : "Gravando — fale naturalmente, não precisa de roteiro"}
        </p>
        <div className="flex gap-2 justify-center">
          <button onClick={rec.cancel}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}>
            <X size={13} /> Cancelar
          </button>
          <button onClick={aoParar} data-tour="ata-voz-parar"
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
        <p className="text-[13px] font-semibold m-0" style={{ color: "var(--text)" }}>Organizando sua ata…</p>
        <p className="text-[11.5px] mt-1 m-0" style={{ color: "var(--text-dim)" }}>
          Transcrevendo e separando o que ficou combinado. Leva alguns segundos.
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
          <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>O que entendi da sua ata</span>
          <span className="text-[10.5px] ml-auto" style={{ color: "var(--text-dim)" }}>confira antes de salvar</span>
        </div>

        <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Lbl>Resumo</Lbl>
          <textarea rows={3} style={inputStyle} value={draft.resumo || ""}
                    onChange={e => set("resumo", e.target.value)}
                    placeholder="Resumo da visita" />
        </div>

        <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Lbl tag={draft.proximo_passo ? "vira follow-up" : null}>Próximo passo</Lbl>
          <input style={{ ...inputStyle, marginBottom: 6 }} value={draft.proximo_passo || ""}
                 onChange={e => set("proximo_passo", e.target.value)}
                 placeholder="Nada combinado — pode deixar vazio" />
          <input type="date" style={{ ...inputStyle, width: "auto" }} value={draft.proximo_passo_data || ""}
                 onChange={e => set("proximo_passo_data", e.target.value)} />
        </div>

        <div className="px-3.5 py-3 grid gap-3" style={{ borderBottom: "1px solid var(--border)", gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <Lbl>Dor identificada</Lbl>
            <input style={inputStyle} value={draft.dor || ""} onChange={e => set("dor", e.target.value)} placeholder="—" />
          </div>
          <div>
            <Lbl>Objeção</Lbl>
            <input style={inputStyle} value={draft.objecao || ""} onChange={e => set("objecao", e.target.value)} placeholder="—" />
          </div>
          <div>
            <Lbl>Concorrente citado</Lbl>
            <input style={inputStyle} value={draft.concorrente || ""} onChange={e => set("concorrente", e.target.value)} placeholder="—" />
          </div>
          <div>
            <Lbl>Temperatura</Lbl>
            <div className="inline-flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {TEMPERATURAS.map((t, i) => {
                const on = draft.temperatura === t.id;
                return (
                  <button key={t.id} onClick={() => set("temperatura", t.id)}
                          className="text-[10.5px] font-semibold px-2.5 py-1.5"
                          style={{
                            background: on ? "var(--accent)" : "var(--surface)",
                            color: on ? "var(--on-accent)" : "var(--text-dim)",
                            borderRight: i < TEMPERATURAS.length - 1 ? "1px solid var(--border)" : "none",
                          }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
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
          <button onClick={salvar} disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />} Salvar ata
          </button>
          <button onClick={descartar} disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}>
            Descartar
          </button>
          <span className="text-[10.5px] ml-auto" style={{ color: "var(--text-dim)" }}>nada foi gravado ainda</span>
        </div>
      </div>
    );
  }

  // ── Início ──────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl px-4 py-5 text-center" style={{ border: "1px dashed var(--border)" }}>
      <Mic size={22} style={{ color: "var(--text-dim)", margin: "0 auto 8px" }} />
      <p className="text-[13.5px] font-bold m-0" style={{ color: "var(--text)" }}>Registre a visita falando</p>
      <p className="text-[11.5px] mt-1 mb-3.5 mx-auto" style={{ color: "var(--text-dim)", maxWidth: "42ch", lineHeight: 1.5 }}>
        Acabou de sair da reunião? Fale o que aconteceu. A IA transcreve, organiza
        e você confere antes de salvar.
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
                    placeholder="Escreva o que aconteceu na visita — a IA organiza do mesmo jeito." />
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
            onClick={async () => { setError(null); await rec.start(); }}
            disabled={!podeIA || !rec.supported}
            data-tour="ata-voz-gravar"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold"
            style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: (podeIA && rec.supported) ? 1 : 0.5 }}
          >
            <Mic size={14} /> Gravar ata
          </button>
          <div className="mt-2">
            <button onClick={() => setTyping(true)}
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

export default AtaVozPanel;
