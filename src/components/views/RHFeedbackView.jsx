import React, { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Plus, X, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { NEUTRAL } from "../../constants/companies";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHFeedback } from "../../hooks/use-rh-feedback";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { nextPendingCycle } from "../../utils/rh-feedback-cycles";

const TIPOS = [
  { id: "30_dias",   label: "30 dias" },
  { id: "60_dias",   label: "60 dias" },
  { id: "90_dias",   label: "90 dias" },
  { id: "semestral", label: "Semestral" },
  { id: "anual",     label: "Anual" },
  { id: "ad_hoc",    label: "Ad-hoc" },
];

function tipoLabel(id) {
  return TIPOS.find(t => t.id === id)?.label || id;
}

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function ratingColor(r) {
  if (r == null) return NEUTRAL.slate;
  return r >= 7 ? "#16A34A" : r >= 4 ? "#D97706" : "#DC2626";
}

function autoavaliacaoLabel(feedback, colaborador) {
  if (feedback.self_rating != null) return `Autoavaliação: ${Number(feedback.self_rating).toFixed(1)}/10`;
  if (!colaborador?.profileId) return "Sem login — sem autoavaliação";
  return "Aguardando autoavaliação";
}

// ── Modal: novo feedback ad-hoc ────────────────────────────────────────────────

function NovoFeedbackModal({ colaboradores, onSave, onClose }) {
  const [colaboradorId, setColaboradorId]         = useState("");
  const [tipo, setTipo]                           = useState("ad_hoc");
  const [notaGeral, setNotaGeral]                 = useState("");
  const [pontosFortes, setPontosFortes]           = useState("");
  const [pontosDesenvolvimento, setPontosDesenvolvimento] = useState("");
  const [notas, setNotas]                         = useState("");
  const [saving, setSaving]                       = useState(false);
  const [error, setError]                         = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!colaboradorId) { setError("Selecione o colaborador."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        colaboradorId, tipo,
        notaGeral: notaGeral === "" ? null : Number(notaGeral),
        pontosFortes: pontosFortes.trim(),
        pontosDesenvolvimento: pontosDesenvolvimento.trim(),
        notas: notas.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao registrar feedback.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite }}>Novo feedback</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Colaborador *</label>
                <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  <option value="">Selecionar</option>
                  {colaboradores.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelSt}>Nota geral (0-10)</label>
              <input type="number" min="0" max="10" step="0.5" value={notaGeral} onChange={(e) => setNotaGeral(e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={{ ...inputSt, maxWidth: 120 }} />
            </div>
            <div>
              <label style={labelSt}>Pontos fortes</label>
              <textarea value={pontosFortes} onChange={(e) => setPontosFortes(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Pontos de desenvolvimento</label>
              <textarea value={pontosDesenvolvimento} onChange={(e) => setPontosDesenvolvimento(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Notas (texto livre)</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
          </div>

          {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "#1E4D8C", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Registrar feedback"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: completar ciclo pendente (RH) ───────────────────────────────────────

function CompletarFeedbackModal({ feedback, colaborador, onComplete, onClose }) {
  const [managerRating, setManagerRating]         = useState("");
  const [pontosFortes, setPontosFortes]           = useState("");
  const [pontosDesenvolvimento, setPontosDesenvolvimento] = useState("");
  const [notas, setNotas]                         = useState("");
  const [saving, setSaving]                       = useState(false);
  const [error, setError]                         = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onComplete(feedback.id, {
        managerRating: managerRating === "" ? null : Number(managerRating),
        pontosFortes: pontosFortes.trim(),
        pontosDesenvolvimento: pontosDesenvolvimento.trim(),
        notas: notas.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao concluir avaliação.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite }}>Concluir avaliação</div>
          <div style={{ fontSize: 12, color: NEUTRAL.slate, marginTop: 2 }}>
            {colaborador?.fullName || "—"} · {tipoLabel(feedback.tipo)} · {fmt(feedback.period_start)} – {fmt(feedback.period_end)}
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          {feedback.self_rating != null && (
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#1E40AF", marginBottom: 14 }}>
              Autoavaliação do colaborador: <b>{Number(feedback.self_rating).toFixed(1)}/10</b>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelSt}>Nota do gestor (0-10)</label>
              <input type="number" min="0" max="10" step="0.5" value={managerRating} onChange={(e) => setManagerRating(e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={{ ...inputSt, maxWidth: 120 }} autoFocus />
            </div>
            <div>
              <label style={labelSt}>Pontos fortes</label>
              <textarea value={pontosFortes} onChange={(e) => setPontosFortes(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Pontos de desenvolvimento</label>
              <textarea value={pontosDesenvolvimento} onChange={(e) => setPontosDesenvolvimento(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Notas (texto livre)</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
          </div>

          {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "#1E4D8C", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Concluir avaliação"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: autoavaliação (colaborador) ─────────────────────────────────────────

function AutoavaliacaoModal({ feedback, onSubmit, onClose }) {
  const [rating, setRating] = useState(feedback.self_rating ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === "") { setError("Informe uma nota."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(feedback.id, Number(rating));
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao enviar autoavaliação.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 24px 80px rgba(0,0,0,0.22)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite }}>Sua autoavaliação</div>
          <div style={{ fontSize: 12, color: NEUTRAL.slate, marginTop: 2 }}>
            {tipoLabel(feedback.tipo)} · até {fmt(feedback.period_end)}
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <p style={{ fontSize: 12, color: NEUTRAL.slate, marginBottom: 12, lineHeight: 1.5 }}>
            Dê uma nota de 0 a 10 pra como você avalia o seu próprio desempenho neste período. Seu gestor vai preencher a avaliação dele separadamente.
          </p>
          <label style={labelSt}>Sua nota (0-10)</label>
          <input type="number" min="0" max="10" step="0.5" value={rating} onChange={(e) => setRating(e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={{ ...inputSt, maxWidth: 120 }} autoFocus />

          {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "#1E4D8C", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Enviando…" : "Enviar autoavaliação"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Drawer: histórico/tendência por colaborador ────────────────────────────────

function HistoricoDrawer({ colaborador, feedbacksDoColaborador, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const concluidos = useMemo(
    () => feedbacksDoColaborador
      .filter(f => f.status === "concluido")
      .slice()
      .sort((a, b) => new Date(a.period_end) - new Date(b.period_end)),
    [feedbacksDoColaborador]
  );

  const chartData = concluidos
    .filter(f => f.final_rating != null)
    .map(f => ({ data: fmt(f.period_end), nota: Number(f.final_rating), tipo: tipoLabel(f.tipo) }));

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} onClick={onClose} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: "#FFFFFF", zIndex: 1000, display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite }}>{colaborador?.fullName || "—"}</div>
            <div style={{ fontSize: 12, color: NEUTRAL.slate, marginTop: 2 }}>{colaborador?.jobTitle || "—"} · {colaborador?.department || "—"}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, borderRadius: 8, display: "flex", flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Tendência da nota final</div>
          {chartData.length >= 2 ? (
            <div style={{ marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: NEUTRAL.slate }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: NEUTRAL.slate }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="nota" stroke="#1E4D8C" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: NEUTRAL.slate, marginBottom: 20 }}>
              Ainda não há histórico suficiente pra mostrar uma tendência (precisa de pelo menos 2 avaliações concluídas).
            </div>
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Histórico completo</div>
          {concluidos.length === 0 ? (
            <div style={{ fontSize: 12, color: NEUTRAL.slate }}>Nenhuma avaliação concluída ainda.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {concluidos.slice().reverse().map(f => (
                <div key={f.id} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: NEUTRAL.graphite }}>{tipoLabel(f.tipo)}</span>
                    {f.final_rating != null && (
                      <span style={{ fontWeight: 800, fontSize: 14, color: ratingColor(f.final_rating) }}>{Number(f.final_rating).toFixed(1)}/10</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: NEUTRAL.slate, marginTop: 2 }}>{fmt(f.period_end)}</div>
                  {f.conteudo?.pontos_fortes && <div style={{ fontSize: 12, color: NEUTRAL.graphite, marginTop: 4 }}><b>Pontos fortes:</b> {f.conteudo.pontos_fortes}</div>}
                  {f.conteudo?.pontos_desenvolvimento && <div style={{ fontSize: 12, color: NEUTRAL.graphite, marginTop: 2 }}><b>A desenvolver:</b> {f.conteudo.pontos_desenvolvimento}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function RHFeedbackView({ currentUser, canWrite, isRHUser }) {
  const { feedbacks, loading: loadingFeedbacks, createFeedback, createPendingCycle, completeFeedback, submitSelfRating } = useRHFeedback({ userId: currentUser?.id });
  const { colaboradores, loading: loadingColaboradores } = useRHColaboradores({ userId: currentUser?.id });
  const [novoOpen, setNovoOpen]                   = useState(false);
  const [completandoId, setCompletandoId]         = useState(null);
  const [autoavaliandoId, setAutoavaliandoId]     = useState(null);
  const [historicoColaboradorId, setHistoricoColaboradorId] = useState(null);
  const reconciledRef = useRef(false);

  const loading = loadingFeedbacks || loadingColaboradores;

  const colaboradoresById = useMemo(() => new Map(colaboradores.map(c => [c.id, c])), [colaboradores]);

  // Reconciliação automática: ao abrir a tela, gera o próximo ciclo pendente
  // (check-in de onboarding ou semestral recorrente) pra quem já está sem
  // nenhum em aberto. Roda uma vez por sessão, só pra quem pode escrever —
  // evita corrida de duplicação se vários RH abrirem a tela ao mesmo tempo.
  useEffect(() => {
    if (!canWrite || loading || reconciledRef.current) return;
    reconciledRef.current = true;
    (async () => {
      for (const colaborador of colaboradores.filter(c => c.employeeStatus === "ativo")) {
        const feedbacksDoColaborador = feedbacks.filter(f => f.user_id === colaborador.id);
        const proximo = nextPendingCycle(colaborador, feedbacksDoColaborador);
        if (proximo) await createPendingCycle(colaborador.id, proximo.tipo, proximo.periodStart, proximo.periodEnd);
      }
    })();
  }, [canWrite, loading, colaboradores, feedbacks, createPendingCycle]);

  const meuColaborador = useMemo(
    () => colaboradores.find(c => c.profileId === currentUser?.id) || null,
    [colaboradores, currentUser?.id]
  );

  const visible = useMemo(() => {
    if (isRHUser) return feedbacks;
    return feedbacks.filter(f => f.user_id === meuColaborador?.id || f.evaluator_id === currentUser?.id);
  }, [feedbacks, isRHUser, meuColaborador, currentUser?.id]);

  const pendentes  = useMemo(() => visible.filter(f => f.status !== "concluido"), [visible]);
  const concluidos = useMemo(() => visible.filter(f => f.status === "concluido"), [visible]);

  const completandoFeedback = completandoId ? feedbacks.find(f => f.id === completandoId) : null;
  const autoavaliandoFeedback = autoavaliandoId ? feedbacks.find(f => f.id === autoavaliandoId) : null;
  const historicoColaborador = historicoColaboradorId ? colaboradoresById.get(historicoColaboradorId) : null;

  if (!isSupabaseConfigured) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <MessageSquare size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
        <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Supabase não configurado</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare size={22} style={{ color: NEUTRAL.graphite }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em", margin: 0 }}>Feedback</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            {isRHUser ? "Ciclos de avaliação e histórico" : "Seus feedbacks"}
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setNovoOpen(true)} style={{ background: "#1E4D8C", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Novo feedback
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: NEUTRAL.slate, fontSize: 13 }}>Carregando…</div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Pendentes ({pendentes.length})
              </div>
              <div className="flex flex-col gap-2">
                {pendentes.map(f => {
                  const colaborador = colaboradoresById.get(f.user_id);
                  const isMine = !isRHUser && meuColaborador?.id === f.user_id;
                  return (
                    <div key={f.id} style={{ border: "1px solid #FDE68A", background: "#FFFBEB", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {isRHUser && <span style={{ fontWeight: 700, fontSize: 13, color: NEUTRAL.graphite }}>{colaborador?.fullName || "—"}</span>}
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#1E4D8C", background: "#DBEAFE", borderRadius: 99, padding: "2px 9px" }}>{tipoLabel(f.tipo)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: NEUTRAL.slate, marginTop: 3 }}>
                          Prazo {fmt(f.period_end)} · {autoavaliacaoLabel(f, colaborador)}
                        </div>
                      </div>
                      {canWrite && (
                        <button onClick={() => setCompletandoId(f.id)} style={{ background: "#1E4D8C", color: "#FFF", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                          Completar
                        </button>
                      )}
                      {isMine && f.self_rating == null && (
                        <button onClick={() => setAutoavaliandoId(f.id)} style={{ background: "#FFF", color: "#1E4D8C", border: "1px solid #1E4D8C", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                          Preencher autoavaliação
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Histórico ({concluidos.length})
          </div>
          {concluidos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <MessageSquare size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Nenhum feedback concluído ainda</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {concluidos.map(f => {
                const colaborador = colaboradoresById.get(f.user_id);
                return (
                  <div key={f.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isRHUser && (
                          <button onClick={() => setHistoricoColaboradorId(f.user_id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: NEUTRAL.graphite, textDecoration: "underline" }}>{colaborador?.fullName || "—"}</span>
                            <TrendingUp size={12} color={NEUTRAL.slate} />
                          </button>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#1E4D8C", background: "#DBEAFE", borderRadius: 99, padding: "2px 9px" }}>{tipoLabel(f.tipo)}</span>
                      </div>
                      <span style={{ fontSize: 11, color: NEUTRAL.slate }}>{fmt(f.period_end)}</span>
                    </div>
                    {(f.self_rating != null || f.manager_rating != null) && (
                      <div style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: 11, color: NEUTRAL.slate }}>
                        {f.self_rating != null && <span>Autoavaliação: <b style={{ color: NEUTRAL.graphite }}>{Number(f.self_rating).toFixed(1)}</b></span>}
                        {f.manager_rating != null && <span>Gestor: <b style={{ color: NEUTRAL.graphite }}>{Number(f.manager_rating).toFixed(1)}</b></span>}
                      </div>
                    )}
                    {typeof f.final_rating === "number" && (
                      <div style={{ fontWeight: 800, fontSize: 18, color: ratingColor(f.final_rating), marginBottom: 6 }}>
                        {f.final_rating.toFixed(1)}<span style={{ fontSize: 11, color: NEUTRAL.slate, fontWeight: 400 }}> /10 final</span>
                      </div>
                    )}
                    {f.conteudo?.pontos_fortes && (
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: NEUTRAL.slate }}>Pontos fortes: </span>
                        <span style={{ fontSize: 12, color: NEUTRAL.graphite }}>{f.conteudo.pontos_fortes}</span>
                      </div>
                    )}
                    {f.conteudo?.pontos_desenvolvimento && (
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: NEUTRAL.slate }}>A desenvolver: </span>
                        <span style={{ fontSize: 12, color: NEUTRAL.graphite }}>{f.conteudo.pontos_desenvolvimento}</span>
                      </div>
                    )}
                    {f.notes && <div style={{ fontSize: 12, color: NEUTRAL.slate, marginTop: 6, fontStyle: "italic" }}>{f.notes}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {novoOpen && <NovoFeedbackModal colaboradores={colaboradores} onSave={createFeedback} onClose={() => setNovoOpen(false)} />}
      {completandoFeedback && (
        <CompletarFeedbackModal
          feedback={completandoFeedback}
          colaborador={colaboradoresById.get(completandoFeedback.user_id)}
          onComplete={completeFeedback}
          onClose={() => setCompletandoId(null)}
        />
      )}
      {autoavaliandoFeedback && (
        <AutoavaliacaoModal feedback={autoavaliandoFeedback} onSubmit={submitSelfRating} onClose={() => setAutoavaliandoId(null)} />
      )}
      {historicoColaborador && (
        <HistoricoDrawer
          colaborador={historicoColaborador}
          feedbacksDoColaborador={feedbacks.filter(f => f.user_id === historicoColaboradorId)}
          onClose={() => setHistoricoColaboradorId(null)}
        />
      )}
    </div>
  );
}

export default RHFeedbackView;
