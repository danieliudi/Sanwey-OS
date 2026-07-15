import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, ShieldCheck, FileText, ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

const ACCENT = "#C7212B";

// Página pública sem login (item 8): o gestor de área recebe um link por
// e-mail e confirma o próprio e-mail aqui antes de ver qualquer candidato —
// segunda camada de defesa além do token de alta entropia na URL. Tudo passa
// pela edge function manager-vaga-review (service role), nunca lê tabelas
// diretamente.
export default function ManagerVagaReviewPage() {
  const { token } = useParams();
  const [email, setEmail] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null); // { vaga, managerName, candidatos }
  const [decidingId, setDecidingId] = useState(null);

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setUnlocking(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("manager-vaga-review", {
        body: { action: "list", token, email: email.trim() },
      });
      if (err || res?.error) throw new Error(res?.error || err?.message || "Não foi possível abrir o link.");
      setData(res);
    } catch (err) {
      setError(err.message || "Link inválido, expirado ou e-mail não confere.");
    } finally {
      setUnlocking(false);
    }
  };

  const handleDecide = async (aplicacaoId, decision, notes) => {
    setDecidingId(aplicacaoId);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("manager-vaga-review", {
        body: { action: "decide", token, email: email.trim(), aplicacaoId, decision, notes },
      });
      if (err || res?.error) throw new Error(res?.error || err?.message || "Não foi possível registrar a decisão.");
      setData(prev => ({
        ...prev,
        candidatos: prev.candidatos.map(c => c.aplicacaoId === aplicacaoId ? { ...c, managerDecision: decision, managerDecisionNotes: notes || null } : c),
      }));
    } catch (err) {
      setError(err.message || "Não foi possível registrar a decisão.");
    } finally {
      setDecidingId(null);
    }
  };

  if (!data) {
    return (
      <ShellCard>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <ShieldCheck size={20} color={ACCENT} />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#201a1a", margin: 0 }}>Confirme seu e-mail</h1>
        </div>
        <p style={{ color: "#5c5f60", fontSize: 14, lineHeight: 1.55, marginBottom: 20 }}>
          Por segurança, confirme o e-mail que recebeu este link antes de ver os candidatos.
        </p>
        <form onSubmit={handleUnlock} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu-email@empresa.com"
            autoFocus
            style={input}
          />
          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", fontSize: 13, border: "1px solid #FECACA" }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}
          <button type="submit" disabled={unlocking || !email.trim()} style={{ ...button, opacity: unlocking || !email.trim() ? 0.6 : 1 }}>
            {unlocking && <Loader2 size={14} className="animate-spin" />}
            {unlocking ? "Verificando…" : "Acessar candidatos"}
          </button>
        </form>
      </ShellCard>
    );
  }

  return (
    <ShellCard wide>
      <header style={{ marginBottom: 24 }}>
        {data.vaga?.department && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999,
            background: ACCENT + "14", color: ACCENT, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12,
          }}>
            {data.vaga.department}
          </div>
        )}
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#201a1a", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          {data.vaga?.title}
        </h1>
        <p style={{ color: "#5c5f60", fontSize: 13, margin: 0 }}>
          Olá, <strong>{data.managerName}</strong>. Avalie cada candidato abaixo.
        </p>
      </header>

      {error && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", fontSize: 13, border: "1px solid #FECACA", marginBottom: 16 }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {data.candidatos.length === 0 ? (
        <p style={{ color: "#5c5f60", fontSize: 14 }}>Ainda não há candidatos nesta vaga.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.candidatos.map((c) => (
            <CandidatoCard key={c.aplicacaoId} candidato={c} deciding={decidingId === c.aplicacaoId} onDecide={handleDecide} />
          ))}
        </div>
      )}
    </ShellCard>
  );
}

function CandidatoCard({ candidato, deciding, onDecide }) {
  const [notes, setNotes] = useState("");
  const decided = !!candidato.managerDecision;

  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 16, background: "#FAFAFA" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#201a1a" }}>{candidato.nome}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>Etapa atual: {candidato.etapa}</div>
        </div>
        {candidato.fitScore != null && (
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, background: ACCENT + "14", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>
            Fit: {candidato.fitScore}%
          </div>
        )}
      </div>

      {candidato.justificativa && (
        <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, margin: "0 0 8px" }}>{candidato.justificativa}</p>
      )}

      {(candidato.pontosFortes?.length > 0 || candidato.gaps?.length > 0) && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8, fontSize: 12 }}>
          {candidato.pontosFortes?.length > 0 && (
            <div>
              <strong style={{ color: "#16A34A" }}>Pontos fortes:</strong> {candidato.pontosFortes.join(", ")}
            </div>
          )}
          {candidato.gaps?.length > 0 && (
            <div>
              <strong style={{ color: "#DC2626" }}>Gaps:</strong> {candidato.gaps.join(", ")}
            </div>
          )}
        </div>
      )}

      {candidato.resumeUrl && (
        <a href={candidato.resumeUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: ACCENT, fontWeight: 600, textDecoration: "none", marginBottom: 12 }}>
          <FileText size={13} /> Ver currículo
        </a>
      )}

      {decided ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: candidato.managerDecision === "aprovado" ? "#16A34A" : "#DC2626" }}>
          <CheckCircle2 size={14} />
          {candidato.managerDecision === "aprovado" ? "Você aprovou este candidato" : "Você reprovou este candidato"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações (opcional)"
            style={{ ...input, fontSize: 12, padding: "8px 10px" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => onDecide(candidato.aplicacaoId, "aprovado", notes)}
              disabled={deciding}
              style={{ ...button, flex: 1, background: "#16A34A", padding: "8px 12px", fontSize: 12, opacity: deciding ? 0.6 : 1 }}
            >
              <ThumbsUp size={13} /> Aprovar
            </button>
            <button
              onClick={() => onDecide(candidato.aplicacaoId, "reprovado", notes)}
              disabled={deciding}
              style={{ ...button, flex: 1, background: "#DC2626", padding: "8px 12px", fontSize: 12, opacity: deciding ? 0.6 : 1 }}
            >
              <ThumbsDown size={13} /> Reprovar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const input = {
  width: "100%",
  fontSize: 14,
  borderRadius: 6,
  border: "1px solid #D1D5DB",
  padding: "10px 12px",
  color: "#201a1a",
  background: "#FFFFFF",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const button = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: ACCENT, color: "#FFFFFF", border: "none", borderRadius: 8,
  padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer",
};

function ShellCard({ children, wide }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#F9FAFB",
      padding: "32px 16px",
      fontFamily: "'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        maxWidth: wide ? 720 : 480,
        margin: "0 auto",
        background: "#FFFFFF",
        borderRadius: 12,
        boxShadow: "var(--shadow-pop)",
        border: "1px solid #E5E7EB",
        padding: 32,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: ACCENT }} />
        {children}
      </div>
      <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 11, marginTop: 16 }}>
        © Grupo Sanwey · Avaliação de candidatos
      </p>
    </div>
  );
}
