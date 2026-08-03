import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, HeartHandshake, CheckCircle2, Clock, Check } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { friendlyError } from "../../utils/friendly-error";

// Agendamento de bem-estar (reunião com o RH, 20/07): página pública sem
// login, agora por horário marcado — igual reserva de restaurante — em vez
// da antiga fila FIFO. A pessoa escolhe um horário livre, informa contato
// (e-mail e/ou WhatsApp) e recebe confirmação por e-mail.
const ACCENT = "#CC2936";
const UNIDADES = [
  { id: "", label: "Não informar" },
  { id: "sanwey", label: "Sanwey" },
  { id: "resibag", label: "Resibag" },
  { id: "montemor", label: "Monte Mor" },
];

export default function BemEstarPublicaForm() {
  const { id } = useParams();
  const [sessao, setSessao] = useState(undefined); // undefined=loading, null=indisponível
  const [horarios, setHorarios] = useState([]);
  const [horarioEscolhido, setHorarioEscolhido] = useState("");
  const [nome, setNome] = useState("");
  const [ramal, setRamal] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [unidade, setUnidade] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmado, setConfirmado] = useState(null); // { horario }
  const [error, setError] = useState(null);
  // Passo 1 (dados de contato) precisa ser preenchido e validado antes do
  // passo 2 (horário) aparecer — o link só "libera" a agenda depois de nome
  // completo + e-mail + celular, pedido explícito do Daniel.
  const [step, setStep] = useState("contato"); // "contato" | "horario"

  useEffect(() => { document.title = "Bem-estar — Grupo Sanwey"; }, []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) { setSessao(null); return; }
    (async () => {
      const [{ data, error: err }, { data: hData }] = await Promise.all([
        supabase.rpc("get_bemestar_sessao_publica", { p_id: id }),
        supabase.rpc("get_bemestar_horarios_disponiveis", { p_id: id }),
      ]);
      if (!active) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (err || !row) { setSessao(null); return; }
      setSessao(row);
      setHorarios(hData || []);
    })();
    return () => { active = false; };
  }, [id]);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const canAdvance = nome.trim().length >= 2 && EMAIL_RE.test(email.trim()) && whatsapp.trim().length >= 8;
  const canSubmit = canAdvance && Boolean(horarioEscolhido) && !submitting;

  const handleAdvance = (e) => {
    e.preventDefault();
    if (nome.trim().length < 2) { setError("Digite seu nome completo."); return; }
    if (!EMAIL_RE.test(email.trim())) { setError("Digite um e-mail válido."); return; }
    if (whatsapp.trim().length < 8) { setError("Digite seu celular."); return; }
    setError(null);
    setStep("horario");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!horarioEscolhido) { setError("Escolha um horário."); return; }
    setSubmitting(true); setError(null);
    try {
      const { data, error: err } = await supabase.rpc("submit_bemestar_agendamento", {
        p_sessao_id: id, p_horario: horarioEscolhido, p_nome: nome.trim(),
        p_ramal: ramal.trim() || null, p_email: email.trim() || null, p_whatsapp: whatsapp.trim() || null,
        p_frente: unidade || null,
      });
      if (err) throw err;
      const row = Array.isArray(data) ? data[0] : data;
      setConfirmado({ horario: row?.horario || horarioEscolhido });
      if (row?.id && email.trim()) {
        supabase.functions.invoke("rh-send-email", { body: { type: "bemestar_confirmado", agendamentoId: row.id } }).catch(() => {});
      }
    } catch (err) {
      setError(friendlyError(err, "Não foi possível reservar esse horário. Tente novamente."));
      // Horário pode ter sido ocupado por outra pessoa nesse meio-tempo — recarrega a lista.
      const { data: hData } = await supabase.rpc("get_bemestar_horarios_disponiveis", { p_id: id });
      setHorarios(hData || []);
      setHorarioEscolhido("");
    } finally {
      setSubmitting(false);
    }
  };

  const temHorariosLivres = useMemo(() => horarios.some((h) => h.disponivel), [horarios]);

  if (sessao === undefined) {
    return <Shell><div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><Loader2 size={24} className="animate-spin" style={{ color: ACCENT }} /></div></Shell>;
  }
  if (!sessao) {
    return <Shell><h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Agendamento indisponível</h1><p style={{ color: "#5c5f60", fontSize: 14 }}>Este link não corresponde a nenhuma sessão aberta no momento — se você está no local, avise o RH ou o responsável pelo atendimento.</p></Shell>;
  }
  if (confirmado) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: ACCENT + "1A", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCircle2 size={28} color={ACCENT} /></div>
          <div style={{ fontSize: 13, color: "#5c5f60", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginTop: 4 }}>Horário reservado</div>
          <div style={{ fontSize: 56, fontWeight: 800, color: ACCENT, lineHeight: 1, fontFamily: "'Barlow Condensed', Inter, sans-serif" }}>{(confirmado.horario || "").slice(0, 5)}</div>
          <p style={{ fontSize: 14, color: "#201a1a", marginTop: 4, maxWidth: 320 }}>Chegue no horário combinado. Você vai receber um lembrete quando estiver chegando a hora.</p>
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
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18 }}>
        <StepPill n={1} label="Seus dados" active={step === "contato"} done={step === "horario"} />
        <div style={{ width: 16, height: 1, background: "#E5E7EB" }} />
        <StepPill n={2} label="Horário" active={step === "horario"} done={false} />
      </div>

      {step === "contato" ? (
        <form onSubmit={handleAdvance} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 13, color: "#5c5f60", margin: "-8px 0 0" }}>Informe seu nome completo e e-mail pra liberar os horários disponíveis.</p>
          <div>
            <label htmlFor="bemestar-nome" style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#201a1a", marginBottom: 6 }}>Nome completo *</label>
            <input id="bemestar-nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como o RH vai te chamar" style={input} autoFocus />
          </div>
          <div>
            <label htmlFor="bemestar-email" style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#201a1a", marginBottom: 6 }}>E-mail *</label>
            <input id="bemestar-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" style={input} />
          </div>
          <div>
            <label htmlFor="bemestar-whatsapp" style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#201a1a", marginBottom: 6 }}>Celular *</label>
            <input id="bemestar-whatsapp" type="text" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" style={input} />
          </div>
          <div className="grid grid-cols-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label htmlFor="bemestar-ramal" style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#201a1a", marginBottom: 6 }}>Ramal</label>
              <input id="bemestar-ramal" type="text" value={ramal} onChange={(e) => setRamal(e.target.value)} style={input} />
            </div>
            <div>
              <label htmlFor="bemestar-unidade" style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#201a1a", marginBottom: 6 }}>Unidade</label>
              <select id="bemestar-unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} style={input}>
                {UNIDADES.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
          </div>
          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", fontSize: 13, border: "1px solid #FECACA" }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} /><span>{error}</span>
            </div>
          )}
          <button type="submit" disabled={!canAdvance}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: canAdvance ? ACCENT : "#D1D5DB", color: "#FFF", border: "none", borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: canAdvance ? "pointer" : "not-allowed" }}>
            Ver horários disponíveis →
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#201a1a", marginBottom: 8 }}>Escolha um horário livre *</label>
            {!temHorariosLivres ? (
              <div style={{ fontSize: 13, color: "#5c5f60" }}>Nenhum horário livre no momento.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 8 }}>
                {horarios.map((h) => {
                  const label = (h.horario || "").slice(0, 5);
                  const active = horarioEscolhido === h.horario;
                  return (
                    <button key={h.horario} type="button" disabled={!h.disponivel} onClick={() => setHorarioEscolhido(h.horario)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                        padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: h.disponivel ? "pointer" : "not-allowed",
                        border: `1.5px solid ${active ? ACCENT : h.disponivel ? "#D1D5DB" : "#E5E7EB"}`,
                        background: active ? ACCENT : h.disponivel ? "#FFF" : "#F3F4F6",
                        color: active ? "#FFF" : h.disponivel ? "#201a1a" : "#9CA3AF",
                      }}>
                      <Clock size={11} /> {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", fontSize: 13, border: "1px solid #FECACA" }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} /><span>{error}</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => { setError(null); setStep("contato"); }}
              style={{ padding: "12px 16px", borderRadius: 8, fontSize: 14, fontWeight: 700, border: "1px solid #D1D5DB", background: "#FFF", color: "#5c5f60", cursor: "pointer" }}>
              ← Voltar
            </button>
            <button type="submit" disabled={!canSubmit}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: canSubmit ? ACCENT : "#D1D5DB", color: "#FFF", border: "none", borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed" }}>
              {submitting && <Loader2 size={14} className="animate-spin" />} {submitting ? "Reservando…" : "Reservar horário"}
            </button>
          </div>
        </form>
      )}
    </Shell>
  );
}

function StepPill({ n, label, active, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: active ? "#201a1a" : "#9CA3AF" }}>
      <span style={{
        width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
        background: active || done ? ACCENT : "#F3F4F6", color: active || done ? "#FFF" : "#9CA3AF", border: active || done ? "none" : "1px solid #E5E7EB",
      }}>
        {done ? <Check size={11} /> : n}
      </span>
      {label}
    </div>
  );
}

const input = { width: "100%", fontSize: 14, borderRadius: 6, border: "1px solid #D1D5DB", padding: "10px 12px", color: "#201a1a", background: "#FFFFFF", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", padding: "32px 16px", fontFamily: "'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", background: "#FFFFFF", borderRadius: 12, boxShadow: "var(--shadow-pop)", border: "1px solid #E5E7EB", padding: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "#CC2936" }} />
        {children}
      </div>
      <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 11, marginTop: 16 }}>© Grupo Sanwey · Bem-estar</p>
    </div>
  );
}
