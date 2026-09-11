import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, HeartHandshake, CheckCircle2, Clock, Check, CalendarDays } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { friendlyError } from "../../utils/friendly-error";

// Inscrição em programa (ex-"bem-estar"): página pública sem login, por
// horário marcado — igual reserva de restaurante. A pessoa informa contato,
// escolhe a DATA (um programa pode ter várias, desde 11/09/2026), escolhe um
// horário e recebe confirmação por e-mail.
//
// A rota continua `/bem-estar/:id` de propósito: ela já está impressa em QR
// code (CLAUDE.md regra 18 — identificador que outro lado lê é contrato).
//
// "Nenhum horário livre no momento" era a mesma frase pra programa encerrado,
// programa sem horário configurado e horário de fim faltando — e a causa
// quase sempre era a configuração, enquanto a frase culpava a lotação. Agora
// o motivo vem do banco (`motivo`) e cada um tem a sua frase.
const ACCENT = "#CC2936";

// "AAAA-MM-DD" → "seg, 15/09". Monta a data a partir dos componentes: passar a
// string pura pro construtor daria meia-noite UTC e "voltaria" um dia em BRT.
// Esta página é pública e não importa de `utils/date` — o bundle público é
// carregado por quem só vai marcar um horário.
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function fmtData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return "";
  const d = new Date(2000, 0, 1);
  d.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${DIAS_CURTOS[d.getDay()]}, ${m[3]}/${m[2]}`;
}
const UNIDADES = [
  { id: "", label: "Não informar" },
  { id: "sanwey", label: "Sanwey" },
  { id: "resibag", label: "Resibag" },
  { id: "montemor", label: "Monte Mor" },
];

export default function BemEstarPublicaForm() {
  const { id } = useParams();
  const [sessao, setSessao] = useState(undefined); // undefined=loading, null=link inexistente
  const [dataEscolhida, setDataEscolhida] = useState(null); // objeto de sessao.datas
  const [horarios, setHorarios] = useState([]);
  const [horarioEscolhido, setHorarioEscolhido] = useState("");
  const [aceitaEspera, setAceitaEspera] = useState(false);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [nome, setNome] = useState("");
  const [ramal, setRamal] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [unidade, setUnidade] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmado, setConfirmado] = useState(null); // { horario, status, posicao, data }
  const [error, setError] = useState(null);
  // Passo 1 (dados de contato) precisa ser preenchido e validado antes do
  // passo 2 (horário) aparecer — o link só "libera" a agenda depois de nome
  // completo + e-mail + celular, pedido explícito do Daniel.
  const [step, setStep] = useState("contato"); // "contato" | "data" | "horario"
  // Achado F-04 (mesmo padrão de JobApplicationForm/PesquisaPublicaForm):
  // erro de rede caía no mesmo texto de "sessão indisponível", sem timeout
  // o spinner girava pra sempre, e o Promise.all sem try/catch fazia
  // qualquer falha de rede virar unhandled rejection — nem chegava a setar
  // sessao=null, ficava preso em loading pra sempre.
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { document.title = "Bem-estar — Grupo Sanwey"; }, []);

  useEffect(() => {
    let active = true;
    setSessao(undefined);
    setLoadError(false);
    if (!isSupabaseConfigured) { setSessao(null); return; }
    const timeoutId = setTimeout(() => { if (active) setLoadError(true); }, 10000);
    (async () => {
      try {
        const { data, error: err } = await supabase.rpc("get_bemestar_sessao_publica", { p_id: id });
        clearTimeout(timeoutId);
        if (!active) return;
        if (err) { setLoadError(true); return; }
        const row = Array.isArray(data) ? data[0] : data;
        // Linha vazia = o id não corresponde a programa nenhum. Programa
        // encerrado ou sem data VOLTA com linha e com `motivo` — é isso que
        // permite a página dizer o que houve em vez de chutar "indisponível".
        if (!row) { setSessao(null); return; }
        setSessao(row);
        const datas = Array.isArray(row.datas) ? row.datas : [];
        // Data única: escolher entre uma opção só é passo a toa.
        if (datas.length === 1) setDataEscolhida(datas[0]);
      } catch {
        clearTimeout(timeoutId);
        if (active) setLoadError(true);
      }
    })();
    return () => { active = false; clearTimeout(timeoutId); };
  }, [id, reloadKey]);

  const carregarHorarios = useCallback(async (dataId) => {
    if (!dataId) { setHorarios([]); return; }
    setCarregandoHorarios(true);
    const { data } = await supabase.rpc("get_bemestar_horarios_por_data", { p_data_id: dataId });
    setHorarios(data || []);
    setCarregandoHorarios(false);
  }, []);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const canAdvance = nome.trim().length >= 2 && EMAIL_RE.test(email.trim()) && whatsapp.trim().length >= 8;
  // Horário lotado só envia se a pessoa disser que aceita a espera — senão o
  // banco recusa e ela levaria um erro por um clique que a tela permitiu.
  const canSubmit = canAdvance && Boolean(horarioEscolhido) && !submitting && (!escolhidoLotado || aceitaEspera);

  const handleAdvance = (e) => {
    e.preventDefault();
    if (nome.trim().length < 2) { setError("Digite seu nome completo."); return; }
    if (!EMAIL_RE.test(email.trim())) { setError("Digite um e-mail válido."); return; }
    if (whatsapp.trim().length < 8) { setError("Digite seu celular."); return; }
    setError(null);
    const datas = Array.isArray(sessao?.datas) ? sessao.datas : [];
    if (datas.length > 1 && !dataEscolhida) { setStep("data"); return; }
    if (dataEscolhida) carregarHorarios(dataEscolhida.id);
    setStep("horario");
  };

  const escolherData = (d) => {
    setDataEscolhida(d);
    setHorarioEscolhido("");
    setAceitaEspera(false);
    carregarHorarios(d.id);
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
        p_data_id: dataEscolhida?.id || null,
        p_aceita_espera: aceitaEspera,
      });
      if (err) throw err;
      const row = Array.isArray(data) ? data[0] : data;
      setConfirmado({
        horario: row?.horario || horarioEscolhido,
        status: row?.status || "na_fila",
        posicao: row?.posicao_espera || null,
        data: dataEscolhida?.data || null,
      });
      if (row?.id && email.trim()) {
        supabase.functions.invoke("rh-send-email", { body: { type: "bemestar_confirmado", agendamentoId: row.id } }).catch(() => {});
      }
    } catch (err) {
      setError(friendlyError(err, "Não foi possível reservar esse horário. Tente novamente."));
      // Horário pode ter lotado nesse meio-tempo — recarrega a lista.
      await carregarHorarios(dataEscolhida?.id);
      setHorarioEscolhido("");
      setAceitaEspera(false);
    } finally {
      setSubmitting(false);
    }
  };

  const datas = useMemo(() => (Array.isArray(sessao?.datas) ? sessao.datas : []), [sessao]);
  const temVariasDatas = datas.length > 1;
  const temHorariosLivres = useMemo(() => horarios.some((h) => h.vagas_livres > 0), [horarios]);
  const escolhido = useMemo(() => horarios.find((h) => h.horario === horarioEscolhido) || null, [horarios, horarioEscolhido]);
  const escolhidoLotado = Boolean(escolhido && escolhido.vagas_livres === 0);

  if (loadError) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center", padding: "24px 0" }}>
          <AlertCircle size={28} color={ACCENT} />
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Não conseguimos carregar agora</h1>
          <p style={{ color: "#5c5f60", fontSize: 14, maxWidth: 340, margin: 0 }}>Verifique sua conexão e tente de novo.</p>
          <button type="button" onClick={() => setReloadKey(k => k + 1)} style={{ padding: "10px 18px", borderRadius: 10, background: ACCENT, color: "#FFF", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>Tentar de novo</button>
        </div>
      </Shell>
    );
  }
  if (sessao === undefined) {
    return <Shell><div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><Loader2 size={24} className="animate-spin" style={{ color: ACCENT }} /></div></Shell>;
  }
  if (!sessao) {
    return <Shell><h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Link não encontrado</h1><p style={{ color: "#5c5f60", fontSize: 14 }}>Este endereço não corresponde a nenhum programa. Confira o link ou o QR code — se você está no local, avise o RH.</p></Shell>;
  }
  // Cada motivo tem a sua frase. Antes os três caíam em "Nenhum horário livre
  // no momento", que descrevia lotação — e a causa real quase nunca era essa.
  if (sessao.motivo) {
    const FRASES = {
      encerrado: ["Inscrições encerradas", "Este programa não está mais recebendo inscrições. Se precisar de atendimento, fale com o RH."],
      sem_datas: ["Datas ainda não definidas", "O programa existe, mas ainda não teve as datas e os horários configurados. Tente de novo mais tarde ou avise o RH."],
      sem_datas_futuras: ["Sem datas disponíveis", "As datas deste programa já passaram. Se for haver uma nova, o RH divulga o link atualizado."],
    };
    const [titulo, texto] = FRASES[sessao.motivo] || FRASES.sem_datas;
    return (
      <Shell>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{titulo}</h1>
        <p style={{ color: "#5c5f60", fontSize: 14, marginBottom: 4 }}>{texto}</p>
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>{sessao.titulo}</p>
      </Shell>
    );
  }
  if (confirmado) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: ACCENT + "1A", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCircle2 size={28} color={ACCENT} /></div>
          <div style={{ fontSize: 13, color: "#5c5f60", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginTop: 4 }}>
            {confirmado.status === "espera" ? "Você entrou na lista de espera" : "Horário reservado"}
          </div>
          <div style={{ fontSize: 56, fontWeight: 800, color: ACCENT, lineHeight: 1, fontFamily: "'Barlow Condensed', Inter, sans-serif" }}>{(confirmado.horario || "").slice(0, 5)}</div>
          {confirmado.data && (
            <div style={{ fontSize: 14, fontWeight: 700, color: "#201a1a" }}>{fmtData(confirmado.data)}</div>
          )}
          <p style={{ fontSize: 14, color: "#201a1a", marginTop: 4, maxWidth: 320 }}>
            {confirmado.status === "espera"
              ? `Você é o ${confirmado.posicao || 1}º da espera nesse horário. Se alguém desistir, o RH entra em contato — não é preciso ficar acompanhando.`
              : "Chegue no horário combinado. Você vai receber um lembrete quando estiver chegando a hora."}
          </p>
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

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        <StepPill n={1} label="Seus dados" active={step === "contato"} done={step !== "contato"} />
        <div style={{ width: 16, height: 1, background: "#E5E7EB" }} />
        {temVariasDatas && (
          <>
            <StepPill n={2} label="Data" active={step === "data"} done={step === "horario"} />
            <div style={{ width: 16, height: 1, background: "#E5E7EB" }} />
          </>
        )}
        <StepPill n={temVariasDatas ? 3 : 2} label="Horário" active={step === "horario"} done={false} />
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
      ) : step === "data" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#201a1a" }}>Escolha a data *</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {datas.map((d) => {
              const lotada = d.vagas_livres === 0;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => escolherData(d)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                    padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                    border: `1.5px solid ${dataEscolhida?.id === d.id ? ACCENT : "#D1D5DB"}`,
                    background: "#FFF", color: "#201a1a",
                  }}
                >
                  <CalendarDays size={16} color={ACCENT} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{fmtData(d.data)}</span>
                    <span style={{ display: "block", fontSize: 12, color: "#5c5f60" }}>
                      {String(d.horario_inicio).slice(0, 5)}–{String(d.horario_fim).slice(0, 5)}
                    </span>
                  </span>
                  {/* Origem do número: `vagas_livres` vem do banco
                      (get_bemestar_sessao_publica) como total de lugares da
                      data menos os já ocupados. Contagem, não percentual. */}
                  <span style={{ fontSize: 12, fontWeight: 700, color: lotada ? "#9CA3AF" : ACCENT, flexShrink: 0 }}>
                    {lotada ? "lotada" : `${d.vagas_livres} vaga${d.vagas_livres > 1 ? "s" : ""}`}
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => { setError(null); setStep("contato"); }}
            style={{ alignSelf: "flex-start", padding: "12px 16px", borderRadius: 8, fontSize: 14, fontWeight: 700, border: "1px solid #D1D5DB", background: "#FFF", color: "#5c5f60", cursor: "pointer" }}>
            ← Voltar
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {dataEscolhida && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5c5f60" }}>
              <CalendarDays size={14} color={ACCENT} />
              <strong style={{ color: "#201a1a" }}>{fmtData(dataEscolhida.data)}</strong>
              {temVariasDatas && (
                <button type="button" onClick={() => { setHorarioEscolhido(""); setAceitaEspera(false); setStep("data"); }}
                  style={{ background: "none", border: "none", padding: 0, color: ACCENT, fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
                  trocar
                </button>
              )}
            </div>
          )}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#201a1a", marginBottom: 8 }}>Escolha um horário *</label>
            {carregandoHorarios ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}><Loader2 size={18} className="animate-spin" style={{ color: ACCENT }} /></div>
            ) : horarios.length === 0 ? (
              <div style={{ fontSize: 13, color: "#5c5f60" }}>Esta data ainda não teve os horários configurados. Avise o RH.</div>
            ) : (
              <>
                {!temHorariosLivres && (
                  <div style={{ fontSize: 13, color: "#5c5f60", marginBottom: 8 }}>
                    Todos os horários desta data estão lotados. Dá pra escolher um mesmo assim e entrar na lista de espera.
                  </div>
                )}
                {/* Horário lotado continua CLICÁVEL — é assim que se entra na
                    espera. Desabilitar tiraria a única porta que sobrou. */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 8 }}>
                  {horarios.map((h) => {
                    const label = (h.horario || "").slice(0, 5);
                    const active = horarioEscolhido === h.horario;
                    const livre = h.vagas_livres > 0;
                    return (
                      <button key={h.horario} type="button"
                        onClick={() => { setHorarioEscolhido(h.horario); setAceitaEspera(false); }}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                          padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                          border: `1.5px solid ${active ? ACCENT : livre ? "#D1D5DB" : "#E5E7EB"}`,
                          background: active ? ACCENT : livre ? "#FFF" : "#F3F4F6",
                          color: active ? "#FFF" : livre ? "#201a1a" : "#6B7280",
                        }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {label}</span>
                        {/* Origem: vagas_livres e vagas_total vêm de
                            get_bemestar_horarios_por_data. "3 de 5" e não
                            "60%": com 5 lugares, o inteiro é mais honesto. */}
                        <span style={{ fontSize: 10, fontWeight: 600, opacity: active ? 0.9 : 1, color: active ? "#FFF" : livre ? "#5c5f60" : "#9CA3AF" }}>
                          {livre ? `${h.vagas_livres} de ${h.vagas_total}` : h.na_espera > 0 ? `espera: ${h.na_espera}` : "lotado"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {escolhidoLotado && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 8, background: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 13, color: "#201a1a", cursor: "pointer" }}>
              <input type="checkbox" checked={aceitaEspera} onChange={(e) => setAceitaEspera(e.target.checked)} style={{ marginTop: 2 }} />
              <span>
                Esse horário está lotado. Quero entrar na <strong>lista de espera</strong> — se alguém desistir, o RH me chama.
                {escolhido?.na_espera > 0 && ` Hoje há ${escolhido.na_espera} pessoa${escolhido.na_espera > 1 ? "s" : ""} na frente.`}
              </span>
            </label>
          )}
          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", fontSize: 13, border: "1px solid #FECACA" }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} /><span>{error}</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => { setError(null); setStep(temVariasDatas ? "data" : "contato"); }}
              style={{ padding: "12px 16px", borderRadius: 8, fontSize: 14, fontWeight: 700, border: "1px solid #D1D5DB", background: "#FFF", color: "#5c5f60", cursor: "pointer" }}>
              ← Voltar
            </button>
            <button type="submit" disabled={!canSubmit}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: canSubmit ? ACCENT : "#D1D5DB", color: "#FFF", border: "none", borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed" }}>
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Reservando…" : escolhidoLotado ? "Entrar na lista de espera" : "Reservar horário"}
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
