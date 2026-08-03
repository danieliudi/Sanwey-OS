import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, Lock, UserCheck } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { friendlyError } from "../../utils/friendly-error";

// Pesquisa anônima (Onda 4, item 11): página pública sem login. As respostas
// NUNCA carregam identidade/contato — só o conteúdo das respostas é gravado.
const ACCENT = "#CC2936";

export default function PesquisaPublicaForm() {
  const { id } = useParams();
  const [pesquisa, setPesquisa] = useState(undefined); // undefined=loading, null=indisponível
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { document.title = "Pesquisa — Grupo Sanwey"; }, []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) { setPesquisa(null); return; }
    (async () => {
      const { data, error: err } = await supabase.rpc("get_pesquisa_publica", { p_id: id });
      if (!active) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (err || !row) { setPesquisa(null); return; }
      setPesquisa(row);
    })();
    return () => { active = false; };
  }, [id]);

  const perguntas = useMemo(() => Array.isArray(pesquisa?.perguntas) ? pesquisa.perguntas : [], [pesquisa]);
  const set = (k, v) => setAnswers((a) => ({ ...a, [k]: v }));

  // Sem flag de obrigatoriedade por pergunta no cadastro (RHComunicacaoView)
  // — toda pergunta renderizada é, na prática, obrigatória, então o botão
  // segue o mesmo padrão de asterisco + desabilitado dos outros formulários
  // públicos (TalentPoolForm/JobApplicationForm/LeadCaptureForm).
  const isAnswered = (q) => {
    const v = answers[q.key];
    return q.tipo === "escala" ? (v !== undefined && v !== null && v !== "") : Boolean(String(v || "").trim());
  };
  const canSubmit = perguntas.length > 0 && perguntas.every(isAnswered) && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const { error: err } = await supabase.rpc("submit_pesquisa_resposta", { p_pesquisa_id: id, p_respostas: answers });
      if (err) throw err;
      setDone(true);
    } catch (err) {
      setError(friendlyError(err, "Não foi possível enviar sua resposta. Tente novamente."));
    } finally {
      setSubmitting(false);
    }
  };

  if (pesquisa === undefined) {
    return <Shell><div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><Loader2 size={24} className="animate-spin" style={{ color: ACCENT }} /></div></Shell>;
  }
  if (!pesquisa) {
    return <Shell><h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Pesquisa indisponível</h1><p style={{ color: "#5c5f60", fontSize: 14 }}>Este link não corresponde a nenhuma pesquisa aberta no momento — pode ter sido encerrada. Se você recebeu este link recentemente, avise o RH pra conferir.</p></Shell>;
  }
  const identificada = pesquisa?.modo === "identificada";

  if (done) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: ACCENT + "1A", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCircle2 size={28} color={ACCENT} /></div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#201a1a", margin: 0 }}>Resposta enviada!</h1>
          <p style={{ color: "#5c5f60", fontSize: 14, maxWidth: 360, margin: 0 }}>Obrigado por participar.{identificada ? "" : " Sua resposta é anônima."}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#201a1a", margin: "0 0 6px", letterSpacing: "-0.02em" }}>{pesquisa.titulo}</h1>
        {pesquisa.descricao && <p style={{ color: "#5c5f60", fontSize: 14, margin: "0 0 8px", lineHeight: 1.55 }}>{pesquisa.descricao}</p>}
        {identificada ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#5c5f60", fontWeight: 600 }}>
            <UserCheck size={12} /> Sua resposta fica associada ao seu perfil — é preciso estar logado na plataforma.
          </div>
        ) : (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#16A34A", fontWeight: 600 }}>
            <Lock size={12} /> Suas respostas são anônimas
          </div>
        )}
      </header>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {perguntas.map((q) => (
          <div key={q.key}>
            <label htmlFor={q.tipo !== "escala" ? `pergunta-${q.key}` : undefined} style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#201a1a", marginBottom: 8 }}>
              <span style={{ color: ACCENT, marginRight: 4 }}>*</span>{q.label}
            </label>
            {q.tipo === "escala" ? (
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = Number(answers[q.key]) === n;
                  return (
                    <button key={n} type="button" onClick={() => set(q.key, n)}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer",
                        border: `1.5px solid ${active ? ACCENT : "#D1D5DB"}`, background: active ? ACCENT : "#FFF", color: active ? "#FFF" : "#201a1a" }}>
                      {n}
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea id={`pergunta-${q.key}`} value={answers[q.key] || ""} onChange={(e) => set(q.key, e.target.value)} rows={3}
                style={{ width: "100%", fontSize: 14, borderRadius: 8, border: "1px solid #D1D5DB", padding: "10px 12px", color: "#201a1a", outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
            )}
          </div>
        ))}

        {error && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", fontSize: 13, border: "1px solid #FECACA" }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} /><span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={!canSubmit}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: canSubmit ? ACCENT : "#D1D5DB", color: "#FFF", border: "none", borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed" }}>
          {submitting && <Loader2 size={14} className="animate-spin" />} {submitting ? "Enviando…" : "Enviar resposta"}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", padding: "32px 16px", fontFamily: "'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", background: "#FFFFFF", borderRadius: 12, boxShadow: "var(--shadow-pop)", border: "1px solid #E5E7EB", padding: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "#CC2936" }} />
        {children}
      </div>
      <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 11, marginTop: 16 }}>© Grupo Sanwey</p>
    </div>
  );
}
