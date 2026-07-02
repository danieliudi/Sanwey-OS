import React, { useEffect, useMemo, useState } from "react";
import { MessageSquare, Plus, X } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHFeedback } from "../../hooks/use-rh-feedback";

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

function NovoFeedbackModal({ users, onSave, onClose }) {
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
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
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

export function RHFeedbackView({ currentUser, users, canWrite, isRHUser }) {
  const { feedbacks, loading, createFeedback } = useRHFeedback({ userId: currentUser?.id });
  const [novoOpen, setNovoOpen] = useState(false);

  const usersById = useMemo(() => new Map((users || []).map(u => [u.id, u])), [users]);

  const visible = useMemo(() => {
    if (isRHUser) return feedbacks;
    return feedbacks.filter(f => f.user_id === currentUser?.id || f.evaluator_id === currentUser?.id);
  }, [feedbacks, isRHUser, currentUser?.id]);

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
            {isRHUser ? "Histórico de avaliações e feedbacks" : "Seus feedbacks recebidos"}
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
      ) : visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <MessageSquare size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Nenhum feedback registrado</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map(f => (
            <div key={f.id} style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {isRHUser && <span style={{ fontWeight: 700, fontSize: 13, color: NEUTRAL.graphite }}>{usersById.get(f.user_id)?.name || "—"}</span>}
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#1E4D8C", background: "#DBEAFE", borderRadius: 99, padding: "2px 9px" }}>{tipoLabel(f.tipo)}</span>
                </div>
                <span style={{ fontSize: 11, color: NEUTRAL.slate }}>{fmt(f.created_at)}</span>
              </div>
              {typeof f.final_rating === "number" && (
                <div style={{ fontWeight: 800, fontSize: 18, color: f.final_rating >= 7 ? "#16A34A" : f.final_rating >= 4 ? "#D97706" : "#DC2626", marginBottom: 6 }}>
                  {f.final_rating.toFixed(1)}<span style={{ fontSize: 11, color: NEUTRAL.slate, fontWeight: 400 }}> /10</span>
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
          ))}
        </div>
      )}

      {novoOpen && <NovoFeedbackModal users={users || []} onSave={createFeedback} onClose={() => setNovoOpen(false)} />}
    </div>
  );
}
