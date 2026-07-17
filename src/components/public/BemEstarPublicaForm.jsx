import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, HeartHandshake } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { friendlyError } from "../../utils/friendly-error";

// Fila de bem-estar (Onda 4, item 12): página pública sem login. A pessoa entra
// na fila e recebe uma senha (ordem de chegada) + quantos estão na frente.
// Não vê a lista de ninguém.
const ACCENT = "#C7212B";
const UNIDADES = [
  { id: "", label: "Não informar" },
  { id: "sanwey", label: "Sanwey" },
  { id: "resibag", label: "Resibag" },
  { id: "montemor", label: "Monte Mor" },
];

export default function BemEstarPublicaForm() {
  const { id } = useParams();
  const [sessao, setSessao] = useState(undefined); // undefined=loading, null=indisponível
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState(null); // { senha, na_frente }
  const [error, setError] = useState(null);

  useEffect(() => { document.title = "Bem-estar — Grupo Sanwey"; }, []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) { setSessao(null); return; }
    (async () => {
      const { data, error: err } = await supabase.rpc("get_bemestar_sessao_publica", { p_id: id });
      if (!active) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (err || !row) { setSessao(null); return; }
      setSessao(row);
    })();
    return () => { active = false; };
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (nome.trim().length < 2) { setError("Digite seu nome."); return; }
    setSubmitting(true); setError(null);
    try {
      const { data, error: err } = await supabase.rpc("submit_bemestar_agendamento", { p_sessao_id: id, p_nome: nome.trim(), p_frente: unidade || null });
      if (err) throw err;
      const row = Array.isArray(data) ? data[0] : data;
      setTicket({ senha: row?.senha, naFrente: row?.na_frente ?? 0 });
    } catch (err) {
      setError(friendlyError(err, "Não foi possível entrar na fila. Tente novamente."));
    } finally {
      setSubmitting(false);
    }
  };

  if (sessao === undefined) {
    return <Shell><div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><Loader2 size={24} className="animate-spin" style={{ color: ACCENT }} /></div></Shell>;
  }
  if (!sessao) {
    return <Shell><h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Fila indisponível</h1><p style={{ color: "#5c5f60", fontSize: 14 }}>Este link não corresponde a nenhuma sessão aberta no momento.</p></Shell>;
  }
  if (ticket) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#5c5f60", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>Sua senha</div>
          <div style={{ fontSize: 72, fontWeight: 800, color: ACCENT, lineHeight: 1, fontFamily: "'Barlow Condensed', Inter, sans-serif" }}>#{ticket.senha}</div>
          <div style={{ fontSize: 15, color: "#201a1a", marginTop: 4 }}>
            {ticket.naFrente === 0 ? "Você é o próximo!" : `${ticket.naFrente} pessoa${ticket.naFrente !== 1 ? "s" : ""} na sua frente`}
          </div>
          <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8, maxWidth: 320 }}>Fique por perto — o RH vai chamar sua senha. Guarde esse número.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: ACCENT + "14", color: ACCENT, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>
          <HeartHandshake size={13} /> Bem-estar
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#201a1a", margin: "0 0 6px", letterSpacing: "-0.02em" }}>{sessao.titulo}</h1>
        {sessao.descricao && <p style={{ color: "#5c5f60", fontSize: 14, margin: "0 0 8px", lineHeight: 1.55 }}>{sessao.descricao}</p>}
        <div style={{ fontSize: 13, color: "#5c5f60" }}>{sessao.na_fila} pessoa{sessao.na_fila !== 1 ? "s" : ""} na fila agora.</div>
      </header>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#201a1a", marginBottom: 6 }}>Seu nome</label>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como o RH vai te chamar" style={input} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#201a1a", marginBottom: 6 }}>Unidade</label>
          <select value={unidade} onChange={(e) => setUnidade(e.target.value)} style={input}>
            {UNIDADES.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </div>
        {error && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", fontSize: 13, border: "1px solid #FECACA" }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} /><span>{error}</span>
          </div>
        )}
        <button type="submit" disabled={submitting}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: submitting ? "#D1D5DB" : ACCENT, color: "#FFF", border: "none", borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: submitting ? "default" : "pointer" }}>
          {submitting && <Loader2 size={14} className="animate-spin" />} {submitting ? "Entrando…" : "Entrar na fila"}
        </button>
      </form>
    </Shell>
  );
}

const input = { width: "100%", fontSize: 14, borderRadius: 6, border: "1px solid #D1D5DB", padding: "10px 12px", color: "#201a1a", background: "#FFFFFF", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", padding: "32px 16px", fontFamily: "'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", background: "#FFFFFF", borderRadius: 12, boxShadow: "var(--shadow-pop)", border: "1px solid #E5E7EB", padding: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "#C7212B" }} />
        {children}
      </div>
      <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 11, marginTop: 16 }}>© Grupo Sanwey · Bem-estar</p>
    </div>
  );
}
