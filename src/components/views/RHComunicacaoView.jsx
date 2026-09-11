import React, { useEffect, useMemo, useState } from "react";
import {
  Megaphone, Plus, X, Send, ClipboardList, BarChart3, Check,
  Loader2, Lock, AlertTriangle, Search, UserCheck, BellRing,
  Mail, MonitorSmartphone, MessageCircle, History, RefreshCw,
  ImagePlus, FileSignature, EyeOff, LayoutTemplate, Users,
} from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHComunicacao } from "../../hooks/use-rh-comunicacao";
import { RH_DEPARTMENTS } from "../../constants/rh-config";
import { RH_FRENTES, RH_FRENTE_LABELS, rhFrenteLabel } from "../../constants/rh-frentes";
import { QRCodeButton } from "../shared/QRCodeButton";
import { MoveStageMenu } from "../shared/MoveStageMenu";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { formatDateBR } from "../../utils/date";
import { HelpTooltip } from "../ui/HelpTooltip";
import { useRHSignatureRequests } from "../../hooks/use-rh-signature-requests";

const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };

// ── Comunicados ───────────────────────────────────────────────────────────────

// Canais de entrega. WhatsApp aparece desligado de propósito: foi pedido na
// reunião de RH de 10/09/2026 e decidido com o Daniel que fica pra depois (exige
// conta comercial aprovada, modelo de mensagem homologado e custo por envio).
// Mostrar o chip apagado responde "e o WhatsApp?" sem ninguém precisar perguntar.
const CANAIS = [
  { id: "plataforma", label: "Plataforma", icon: MonitorSmartphone, hint: "Notificação no sino de quem tem login." },
  { id: "email",      label: "E-mail",     icon: Mail,              hint: "Chega mesmo pra quem desligou o sino." },
  { id: "whatsapp",   label: "WhatsApp",   icon: MessageCircle,     hint: "Em breve.", indisponivel: true },
];

const TOOLTIP_SENSIVEL =
  "Marque quando o comunicado trouxer dado de pessoa (salário, saúde, advertência, desligamento, documento), " +
  "informação financeira ou de contrato ainda não pública, ou assunto restrito a um grupo. " +
  "Na dúvida, marque: o comunicado continua chegando, só não viaja por e-mail.";

function ComunicadoComposer({ onSend, onPreview, modelos = [] }) {
  const [title, setTitle] = useState("");
  const [body, setBody]   = useState("");
  const [scopeType, setScopeType] = useState("todos");
  const [scopeValue, setScopeValue] = useState("");
  const [importante, setImportante] = useState(false);
  const [canais, setCanais] = useState(["plataforma"]);
  const [sensivel, setSensivel] = useState(false);
  const [imagem, setImagem] = useState(null);
  const [documento, setDocumento] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError]   = useState(null);
  const [result, setResult] = useState(null);
  const [alcance, setAlcance] = useState(null);
  const [alcanceErro, setAlcanceErro] = useState(false);

  // Prévia de alcance: recarrega a cada troca de escopo. Escopo incompleto
  // (frente/departamento ainda não escolhido) zera em vez de mostrar o número
  // do escopo anterior, que seria um número certo para a pergunta errada.
  useEffect(() => {
    let active = true;
    if (scopeType !== "todos" && !scopeValue) { setAlcance(null); setAlcanceErro(false); return; }
    setAlcanceErro(false);
    onPreview(scopeType, scopeType === "todos" ? null : scopeValue)
      .then((a) => { if (active) setAlcance(a); })
      .catch(() => { if (active) { setAlcance(null); setAlcanceErro(true); } });
    return () => { active = false; };
  }, [scopeType, scopeValue, onPreview]);

  const toggleCanal = (id) => {
    setResult(null);
    setCanais((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const handleSend = async () => {
    if (!title.trim()) { setError("Escreva um título."); return; }
    if (scopeType !== "todos" && !scopeValue) { setError("Escolha a frente/departamento."); return; }
    if (!canais.length) { setError("Escolha ao menos um canal."); return; }
    setSending(true); setError(null); setResult(null);
    try {
      const r = await onSend({
        title: title.trim(), body: body.trim() || null, scopeType,
        scopeValue: scopeType === "todos" ? null : scopeValue,
        importante, canais, sensivel, imagem, documento,
      });
      setResult(r);
      setTitle(""); setBody(""); setImportante(false); setSensivel(false);
      setImagem(null); setDocumento(null);
    } catch (e) {
      setError(e?.message || "Erro ao enviar comunicado.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: 620, border: "1px solid var(--border)", borderRadius: 12, padding: 20, background: "var(--surface)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {modelos.length > 0 && (
          <div>
            <label style={labelSt}><LayoutTemplate size={11} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} />Partir de um modelo</label>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {modelos.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  // Modelo preenche e a pessoa edita por cima. Nunca envia
                  // sozinho, e nunca mexe em aparência: o que ele traz é
                  // título, texto e os marcadores — a casca visual do e-mail
                  // continua vindo do template da plataforma.
                  onClick={() => {
                    setTitle(m.titulo || "");
                    setBody(m.corpo || "");
                    setImportante(!!m.importante);
                    setSensivel(!!m.sensivel);
                    setResult(null); setError(null);
                  }}
                  title={m.titulo || m.nome}
                  style={{
                    fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "6px 12px",
                    border: "1px solid var(--border-strong)", background: "var(--surface)",
                    color: "var(--text)", cursor: "pointer",
                  }}
                >
                  {m.nome}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label style={labelSt}>Título *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Recesso de fim de ano" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
        </div>
        <div>
          <label style={labelSt}>Mensagem</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Escreva o comunicado…" className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-y" style={inputSt} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <div>
            <label style={labelSt}>Enviar para</label>
            <select value={scopeType} onChange={(e) => { setScopeType(e.target.value); setScopeValue(""); }} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
              <option value="todos">Todos os colaboradores</option>
              <option value="frente">Por frente</option>
              <option value="departamento">Por departamento</option>
            </select>
          </div>
          {scopeType !== "todos" && (
            <div>
              <label style={labelSt}>{scopeType === "frente" ? "Frente" : "Departamento"}</label>
              <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                <option value="">Selecione…</option>
                {(scopeType === "frente" ? RH_FRENTES.map((id) => ({ id, label: RH_FRENTE_LABELS[id] })) : RH_DEPARTMENTS.map((d) => ({ id: d, label: d }))).map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div data-tour="comunicado-canais">
          <label style={labelSt}>Canais *</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CANAIS.map((c) => {
              const ativo = canais.includes(c.id);
              const Icone = c.icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => !c.indisponivel && toggleCanal(c.id)}
                  disabled={c.indisponivel}
                  title={c.hint}
                  aria-pressed={ativo}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    borderRadius: 999, padding: "7px 13px", fontSize: 12, fontWeight: 600,
                    border: `1px solid ${ativo ? "var(--accent)" : "var(--border-strong)"}`,
                    background: ativo ? "var(--accent)" : "var(--surface)",
                    color: c.indisponivel ? "var(--text-dim)" : ativo ? "var(--on-accent)" : "var(--text)",
                    cursor: c.indisponivel ? "not-allowed" : "pointer",
                    opacity: c.indisponivel ? 0.55 : 1,
                  }}
                >
                  <Icone size={13} /> {c.label}
                  {c.indisponivel && <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>em breve</span>}
                </button>
              );
            })}
          </div>

          {/* Regra 14: o número vem de comunicado_alcance (conta profiles do
              escopo, fora agência/cliente/fornecedor e desligados), e o que
              fica de fora aparece contado em vez de sumir em silêncio. */}
          <div style={{ marginTop: 10, borderRadius: 10, padding: "10px 12px", background: "var(--surface-alt)", border: "1px solid var(--border)", fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
            {alcanceErro ? (
              "Não foi possível calcular o alcance agora — o envio continua funcionando."
            ) : !alcance ? (
              scopeType !== "todos" && !scopeValue ? "Escolha a frente/departamento pra ver o alcance." : "Calculando alcance…"
            ) : (
              <>
                <span style={{ color: alcance.total === 0 ? "var(--warning)" : "var(--text)", fontWeight: 700 }}>{alcance.total}</span> {alcance.total === 1 ? "pessoa" : "pessoas"} no escopo.
                {alcance.total === 0 && <> Enviar agora não alcança ninguém.</>}
                {canais.includes("plataforma") && <> {" · "}Sino: <span style={{ color: "var(--text)", fontWeight: 700 }}>{importante ? alcance.total : alcance.comNotificacao}</span></>}
                {canais.includes("email") && <> {" · "}E-mail: <span style={{ color: "var(--text)", fontWeight: 700 }}>{alcance.comEmail}</span></>}
                {canais.includes("email") && alcance.semEmail > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {alcance.semEmail} {alcance.semEmail === 1 ? "pessoa não tem" : "pessoas não têm"} e-mail cadastrado e não {alcance.semEmail === 1 ? "recebe" : "recebem"} por esse canal.
                  </div>
                )}
                {canais.includes("plataforma") && !importante && alcance.total > alcance.comNotificacao && (
                  <div style={{ marginTop: 4 }}>
                    {alcance.total - alcance.comNotificacao} desligou as notificações do sino — marque “Importante” pra alcançar mesmo assim.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <div>
            <label style={labelSt}><ImagePlus size={11} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} />Imagem</label>
            <input
              type="file" accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setImagem(e.target.files?.[0] || null)}
              className="w-full text-xs" style={{ color: "var(--text-dim)" }}
            />
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3, lineHeight: 1.45 }}>
              {imagem ? imagem.name : "PNG ou JPG, até 10 MB. Aparece acima do texto."}
            </div>
          </div>
          <div>
            <label style={labelSt}><FileSignature size={11} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} />PDF para assinatura</label>
            <input
              type="file" accept="application/pdf"
              onChange={(e) => setDocumento(e.target.files?.[0] || null)}
              className="w-full text-xs" style={{ color: "var(--text-dim)" }}
            />
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3, lineHeight: 1.45 }}>
              {documento ? documento.name : "Opcional. Anexe o documento que vai para a D4Sign."}
            </div>
          </div>
        </div>

        {/* Conteúdo sensível: tira imagem E corpo do e-mail, não só a imagem.
            Decidido com o Daniel — na maioria dos comunicados o sensível é o
            texto, e tirar só a imagem deixaria o marcador decorativo. */}
        <label
          style={{
            display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
            borderRadius: 10, padding: "10px 12px",
            border: `1px solid ${sensivel ? "var(--amber)" : "var(--border)"}`,
            background: sensivel ? "var(--amber-bg)" : "var(--surface-alt)",
          }}
        >
          <input type="checkbox" checked={sensivel} onChange={(e) => setSensivel(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: sensivel ? "var(--amber)" : "var(--text)" }}>
              <EyeOff size={13} /> Conteúdo sensível
              <HelpTooltip text={TOOLTIP_SENSIVEL} />
            </span>
            <span style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, display: "block" }}>
              Fica fora do e-mail — nem o texto, nem a imagem. Quem recebe vê só o título e o caminho para abrir na plataforma.
            </span>
          </span>
        </label>

        <label
          style={{
            display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
            borderRadius: 10, padding: "10px 12px",
            border: `1px solid ${importante ? "var(--danger)" : "var(--border)"}`,
            background: importante ? "var(--danger-bg)" : "var(--surface-alt)",
          }}
        >
          <input type="checkbox" checked={importante} onChange={(e) => setImportante(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: importante ? "var(--danger)" : "var(--text)" }}>
              <AlertTriangle size={13} /> Importante
            </span>
            <span style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, display: "block" }}>
              Entrega mesmo pra quem desativou notificações. Use só pra avisos que ninguém pode perder (segurança, mudança de política, recesso).
            </span>
          </span>
        </label>

        {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
        {result != null && (
          <div style={{ borderRadius: 8, padding: "10px 12px", fontSize: 12, lineHeight: 1.6, background: result.emailErro ? "var(--warning-bg)" : "var(--success-bg)", color: result.emailErro ? "var(--warning)" : "var(--success)" }}>
            {/* A causa do zero é decidida pelo CANAL escolhido, não pelo
                número: antes isto dizia "canal não selecionado" sempre que o
                alcance dava 0, inclusive quando o canal FOI escolhido e não
                havia ninguém pra alcançar (departamento vazio, ou todos com o
                sino desligado e sem "Importante"). Número certo pra pergunta
                errada é o defeito que a regra 14 existe pra evitar. */}
            <div style={{ fontWeight: 700 }}>
              {!result.canais.includes("plataforma")
                ? "Sem envio pela plataforma (canal não selecionado)."
                : result.alcancePlataforma > 0
                  ? `Notificação na plataforma: ${result.alcancePlataforma} ${result.alcancePlataforma === 1 ? "pessoa" : "pessoas"}.`
                  : "Plataforma: não alcançou ninguém — ou o escopo está vazio, ou todos desligaram o sino (marque “Importante” pra passar por cima disso)."}
            </div>
            {/* Canal por canal, com o número de cada um: "enviado" sozinho não
                diz se o e-mail saiu — e ele pode falhar depois da notificação
                já estar gravada. */}
            {/* Não afirma em que status o registro ficou: o servidor pode nem
                ter chegado a marcar nada (queda de rede, função fora do ar), e
                o histórico logo abaixo é a fonte real — dizer "ficou como
                falhou" e o selo mostrar "pendente" seria a tela mentindo. */}
            {result.emailErro
              ? <div style={{ fontWeight: 600 }}>E-mail NÃO saiu: {result.emailErro} Confira o status na lista “Enviados” abaixo — de lá dá pra tentar de novo.</div>
              : result.emailEnviado > 0
                ? <div style={{ fontWeight: 600 }}>E-mail: {result.emailEnviado} {result.emailEnviado === 1 ? "pessoa" : "pessoas"} (em cópia oculta).</div>
                : null}
            {result.semEmail > 0 && !result.emailErro && (
              <div>{result.semEmail} {result.semEmail === 1 ? "pessoa ficou" : "pessoas ficaram"} de fora do e-mail por não ter endereço cadastrado.</div>
            )}
            {result.sensivel && result.canais.includes("email") && (
              <div>Marcado como sensível: o e-mail levou só o título e o link — texto e imagem ficaram na plataforma.</div>
            )}
            {result.anexoErro && (
              <div style={{ fontWeight: 600 }}>Anexo: {result.anexoErro}</div>
            )}
          </div>
        )}
        <div>
          <button
            onClick={handleSend} disabled={sending}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: importante ? "var(--danger)" : "var(--accent)", color: importante ? "var(--on-danger)" : "var(--on-accent)", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, border: "none", cursor: sending ? "default" : "pointer", opacity: sending ? 0.6 : 1 }}
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {sending ? "Enviando…" : importante ? "Enviar comunicado importante" : "Enviar comunicado"}
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Ninguém vê a lista de destinatários: na plataforma cada pessoa recebe a própria notificação, e no e-mail todos vão em cópia oculta.
          {" "}Quem é de fora do Grupo — hoje a agência — nunca entra em comunicado interno, mesmo no escopo “Todos”.
          {" "}Quem não tem login nem e-mail cadastrado não é alcançado por nenhum dos dois canais.
        </p>
      </div>
    </div>
  );
}

// Assinatura do comunicado: reusa o mesmo mecanismo genérico que RH já tem
// (domain/record_id), com `domain = "comunicado"`. Nenhuma peça nova — a
// D4Sign assina ARQUIVO, e o arquivo é o PDF que o RH anexou no envio.
function AssinaturaComunicado({ comunicado, onCarregarAssinantes }) {
  const { requests, sending, sendError, sendForSignature } = useRHSignatureRequests({
    domain: "comunicado", recordId: comunicado.id,
  });
  const [erroLocal, setErroLocal] = useState(null);

  const jaEnviado = requests.length > 0;
  const ultimo = requests[0];

  const enviar = async () => {
    setErroLocal(null);
    try {
      const signers = await onCarregarAssinantes(comunicado.id);
      if (!signers.length) { setErroLocal("Nenhum destinatário com e-mail para assinar."); return; }
      await sendForSignature({
        signers,
        sourceStoragePath: comunicado.documento_path,
        message: `Assinatura do comunicado: ${comunicado.titulo}`,
      });
    } catch (e) {
      setErroLocal(e?.message || "Não foi possível enviar para assinatura.");
    }
  };

  return (
    <div style={{ marginTop: 9 }}>
      {jaEnviado ? (
        <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "3px 9px", background: "var(--surface-alt)", color: "var(--text-dim)" }}>
          <FileSignature size={11} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} />
          Assinatura: {ultimo?.status || "enviada"}
        </span>
      ) : (
        <button
          type="button" onClick={enviar} disabled={sending}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
            borderRadius: 999, padding: "3px 10px", border: "1px solid var(--border-strong)",
            background: "var(--surface)", color: "var(--text)",
            cursor: sending ? "default" : "pointer", opacity: sending ? 0.6 : 1,
          }}
        >
          <FileSignature size={11} /> {sending ? "Enviando…" : "Enviar PDF para assinatura"}
        </button>
      )}
      {(erroLocal || sendError) && (
        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: "var(--danger)" }}>{erroLocal || sendError}</div>
      )}
    </div>
  );
}

// Histórico. Antes disto o comunicado não ficava em lugar nenhum: virava
// notificação e sumia quando a pessoa lia. O RH não conseguia responder "o que
// foi comunicado em agosto" nem conferir se o e-mail saiu.
function HistoricoComunicados({ comunicados, loading, onReenviar, onCarregarLeituras, onCarregarAssinantes }) {
  const [reenviando, setReenviando] = useState(null);
  const [abertoId, setAbertoId] = useState(null);
  const [leituras, setLeituras] = useState({ id: null, carregando: false, lista: [], erro: null });
  const [reenvioResult, setReenvioResult] = useState(null); // { id, enviados, erro }

  const rotuloEscopo = (c) => {
    if (c.scope_type === "frente") return c.scope_value ? rhFrenteLabel(c.scope_value) : "—";
    if (c.scope_type === "departamento") return c.scope_value || "—";
    return "Todos";
  };

  const statusEmail = (c) => {
    if (!(c.canais || []).includes("email")) return null;
    if (c.email_status === "enviado") return { texto: `E-mail: ${c.alcance_email}`, cor: "var(--success)", bg: "var(--success-bg)" };
    if (c.email_status === "falhou")  return { texto: "E-mail falhou", cor: "var(--danger)", bg: "var(--danger-bg)", title: c.email_erro || "" };
    return { texto: "E-mail pendente", cor: "var(--amber)", bg: "var(--amber-bg)" };
  };

  const abrirLeituras = async (id) => {
    if (abertoId === id) { setAbertoId(null); return; }
    setAbertoId(id);
    if (leituras.id === id && !leituras.erro) return;
    setLeituras({ id, carregando: true, lista: [], erro: null });
    try {
      const lista = await onCarregarLeituras(id);
      setLeituras({ id, carregando: false, lista, erro: null });
    } catch (e) {
      setLeituras({ id, carregando: false, lista: [], erro: e?.message || "Não foi possível carregar." });
    }
  };

  const handleReenviar = async (id) => {
    setReenviando(id);
    setReenvioResult(null);
    const r = await onReenviar(id);
    setReenvioResult({ id, ...r });
    setReenviando(null);
  };

  if (loading) return <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>;
  if (!comunicados.length) {
    return <EmptyState icon={History} title="Nenhum comunicado enviado ainda" description="O que for enviado acima fica registrado aqui, com o alcance de cada canal." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {comunicados.map((c) => {
        const email = statusEmail(c);
        // Só 'pendente' e 'falhou' são retomáveis — é exatamente o que a edge
        // function aceita reivindicar. 'enviado' fica travado de propósito
        // (inclusive quando cobre um envio parcial), pra ninguém receber o
        // mesmo comunicado duas vezes.
        const podeReenviar = onReenviar && ["pendente", "falhou"].includes(c.email_status);
        const res = reenvioResult?.id === c.id ? reenvioResult : null;
        return (
          <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", background: "var(--surface)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {c.importante && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--danger)", background: "var(--danger-bg)", borderRadius: 999, padding: "2px 7px" }}>
                      <AlertTriangle size={10} /> Importante
                    </span>
                  )}
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{c.titulo}</span>
                </div>
                {c.corpo && (
                  <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{c.corpo}</p>
                )}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" }}>{formatDateBR(c.enviado_em)}</span>
            </div>

            {/* Cada número traz o canal a que pertence — "enviado para 12" sem
                dizer por onde não responde nada (regra 14). */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-dim)", background: "var(--surface-alt)", borderRadius: 999, padding: "3px 9px" }}>
                Para: {rotuloEscopo(c)}
              </span>
              {(c.canais || []).includes("plataforma") && (
                <span style={{ fontSize: 11, color: "var(--text)", background: "var(--surface-alt)", borderRadius: 999, padding: "3px 9px" }}>
                  Sino: {c.alcance_plataforma}
                </span>
              )}
              {email && (
                <span title={email.title} style={{ fontSize: 11, fontWeight: 600, color: email.cor, background: email.bg, borderRadius: 999, padding: "3px 9px" }}>
                  {email.texto}
                </span>
              )}
              {c.sem_email > 0 && (
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  {c.sem_email} sem e-mail válido cadastrado
                </span>
              )}
              {onCarregarLeituras && (
                <button
                  type="button"
                  onClick={() => abrirLeituras(c.id)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
                    borderRadius: 999, padding: "3px 10px", border: "1px solid var(--border-strong)",
                    background: "var(--surface)", color: "var(--text)", cursor: "pointer",
                  }}
                >
                  <Users size={11} /> {abertoId === c.id ? "Ocultar leitura" : "Quem confirmou"}
                </button>
              )}
              {podeReenviar && (
                <button
                  type="button"
                  onClick={() => handleReenviar(c.id)}
                  disabled={reenviando === c.id}
                  title="Tenta o envio por e-mail de novo. Não reenvia a notificação da plataforma, que já foi entregue."
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "3px 10px",
                    border: "1px solid var(--border-strong)", background: "var(--surface)",
                    color: "var(--text)", cursor: reenviando === c.id ? "default" : "pointer",
                    opacity: reenviando === c.id ? 0.6 : 1,
                  }}
                >
                  {reenviando === c.id
                    ? <><Loader2 size={11} className="animate-spin" /> Enviando…</>
                    : <><RefreshCw size={11} /> Tentar e-mail de novo</>}
                </button>
              )}
            </div>

            {c.documento_path && onCarregarAssinantes && (
              <AssinaturaComunicado comunicado={c} onCarregarAssinantes={onCarregarAssinantes} />
            )}

            {abertoId === c.id && (
              <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                {leituras.carregando ? (
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Carregando…</div>
                ) : leituras.erro ? (
                  <div style={{ fontSize: 12, color: "var(--danger)" }}>{leituras.erro}</div>
                ) : (() => {
                  const confirmaram = leituras.lista.filter(l => l.confirmadoEm);
                  const semCanal = leituras.lista.filter(l => !l.confirmadoEm && l.semCanal);
                  const pendentes = leituras.lista.filter(l => !l.confirmadoEm && !l.semCanal);
                  return (
                    <>
                      {/* Três números, não dois. Quem não tinha canal nenhum
                          não deixou de confirmar — nunca teve como; somar com
                          quem ignorou faria a conta mentir (regra 14). */}
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 9 }}>
                        <span style={{ fontSize: 11, color: "var(--text-dim)" }}><b style={{ color: "var(--success)", fontSize: 14 }}>{confirmaram.length}</b> confirmaram</span>
                        <span style={{ fontSize: 11, color: "var(--text-dim)" }}><b style={{ color: "var(--text)", fontSize: 14 }}>{pendentes.length}</b> não confirmaram</span>
                        {semCanal.length > 0 && (
                          <span style={{ fontSize: 11, color: "var(--text-dim)" }} title="Sem e-mail cadastrado e sem notificação na plataforma — não teve como confirmar.">
                            <b style={{ color: "var(--amber)", fontSize: 14 }}>{semCanal.length}</b> sem canal
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {leituras.lista.map((l) => (
                          <div key={l.profileId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                            <span style={{ color: "var(--text)" }}>{l.nome}</span>
                            <span style={{
                              marginLeft: "auto", fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "2px 8px",
                              background: l.confirmadoEm ? "var(--success-bg)" : l.semCanal ? "var(--amber-bg)" : "var(--surface-alt)",
                              color: l.confirmadoEm ? "var(--success)" : l.semCanal ? "var(--amber)" : "var(--text-dim)",
                            }}>
                              {l.confirmadoEm
                                ? `confirmou ${formatDateBR(l.confirmadoEm)}${l.origem === "email" ? " · por e-mail" : ""}`
                                : l.semCanal ? "sem e-mail nem notificação" : "não confirmou"}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 8, lineHeight: 1.5 }}>
                        Confirmar leitura registra que a pessoa recebeu e reconheceu — não que leu ou entendeu.
                        Para aviso com efeito jurídico, use o PDF com assinatura.
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {res && (
              <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, borderRadius: 8, padding: "6px 10px", background: res.erro ? "var(--danger-bg)" : "var(--success-bg)", color: res.erro ? "var(--danger)" : "var(--success)" }}>
                {res.erro
                  ? `Continuou falhando: ${res.erro}`
                  : `E-mail enviado agora para ${res.enviados} ${res.enviados === 1 ? "pessoa" : "pessoas"}.`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Pesquisas ─────────────────────────────────────────────────────────────────

function NovaPesquisaModal({ onSave, onClose }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fechaEm, setFechaEm] = useState("");
  const [perguntas, setPerguntas] = useState([{ label: "", tipo: "escala" }]);
  const [modo, setModo] = useState("anonima"); // "anonima" | "identificada"
  const [scopeType, setScopeType] = useState("todos");
  const [scopeValue, setScopeValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const upd = (i, patch) => setPerguntas((p) => p.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  const add = () => setPerguntas((p) => [...p, { label: "", tipo: "escala" }]);
  const rem = (i) => setPerguntas((p) => p.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    const valid = perguntas.filter((q) => q.label.trim());
    if (!titulo.trim()) { setError("Título obrigatório."); return; }
    if (valid.length === 0) { setError("Adicione ao menos uma pergunta."); return; }
    if (modo === "identificada" && scopeType !== "todos" && !scopeValue) { setError("Escolha a frente/departamento."); return; }
    setSaving(true); setError(null);
    try {
      await onSave({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        fechaEm: fechaEm || null,
        perguntas: valid.map((q, idx) => ({ key: `q${idx + 1}`, label: q.label.trim(), tipo: q.tipo })),
        modo,
        scopeType: modo === "identificada" ? scopeType : "todos",
        scopeValue: modo === "identificada" && scopeType !== "todos" ? scopeValue : null,
      });
      onClose();
    } catch (e) {
      setError(e?.message || "Erro ao criar pesquisa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "var(--shadow-pop)", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova pesquisa</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelSt}>Título *</label>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Clima organizacional 2026" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} autoFocus />
          </div>
          <div>
            <label style={labelSt}>Descrição</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Modo</label>
            <div className="grid grid-cols-2" style={{ gap: 8 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 2, cursor: "pointer", borderRadius: 10, padding: "10px 12px", border: `1px solid ${modo === "anonima" ? "var(--accent)" : "var(--border)"}`, background: modo === "anonima" ? "var(--accent-tint)" : "var(--surface-alt)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  <input type="radio" checked={modo === "anonima"} onChange={() => setModo("anonima")} /> <Lock size={12} /> Anônima
                </span>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Via QR/link — respostas nunca identificadas.</span>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 2, cursor: "pointer", borderRadius: 10, padding: "10px 12px", border: `1px solid ${modo === "identificada" ? "var(--accent)" : "var(--border)"}`, background: modo === "identificada" ? "var(--accent-tint)" : "var(--surface-alt)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  <input type="radio" checked={modo === "identificada"} onChange={() => setModo("identificada")} /> <UserCheck size={12} /> Identificada
                </span>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Enviada como comunicado — sabe quem respondeu.</span>
              </label>
            </div>
          </div>
          {modo === "identificada" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <div>
                <label style={labelSt}>Enviar para</label>
                <select value={scopeType} onChange={(e) => { setScopeType(e.target.value); setScopeValue(""); }} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  <option value="todos">Todos os colaboradores</option>
                  <option value="frente">Por frente</option>
                  <option value="departamento">Por departamento</option>
                </select>
              </div>
              {scopeType !== "todos" && (
                <div>
                  <label style={labelSt}>{scopeType === "frente" ? "Frente" : "Departamento"}</label>
                  <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                    <option value="">Selecione…</option>
                    {(scopeType === "frente" ? RH_FRENTES.map((id) => ({ id, label: RH_FRENTE_LABELS[id] })) : RH_DEPARTMENTS.map((d) => ({ id: d, label: d }))).map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          <div>
            <label style={labelSt}>Encerra em (opcional)</label>
            <input type="date" value={fechaEm} onChange={(e) => setFechaEm(e.target.value)} className="text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Perguntas</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {perguntas.map((q, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="text" value={q.label} onChange={(e) => upd(i, { label: e.target.value })} placeholder={`Pergunta ${i + 1}`} className="text-sm rounded-lg border px-2 py-1.5 outline-none" style={{ ...inputSt, flex: 1 }} />
                  <select value={q.tipo} onChange={(e) => upd(i, { tipo: e.target.value })} className="text-sm rounded-lg border outline-none px-2 py-1.5" style={{ ...inputSt, flexShrink: 0 }}>
                    <option value="escala">Escala 1-5</option>
                    <option value="texto">Texto</option>
                  </select>
                  <button type="button" onClick={() => rem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", flexShrink: 0 }}><X size={14} /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={add} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <Plus size={12} /> Adicionar pergunta
            </button>
          </div>
          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Criar pesquisa"}
            </button>
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultadosModal({ pesquisa, carregarRespostas, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ total: 0, respostas: [], respondentes: [], minimo: 0, liberado: true });
  const [error, setError] = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await carregarRespostas(pesquisa.id);
        if (active) setData(r);
      } catch (e) {
        if (active) setError(e?.message || "Erro ao carregar respostas.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [pesquisa.id, carregarRespostas]);

  const perguntas = Array.isArray(pesquisa.perguntas) ? pesquisa.perguntas : [];
  const identificada = pesquisa.modo === "identificada";

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 560, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{pesquisa.titulo}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2, display: "inline-flex", alignItems: "center", gap: 4 }}>
              {pesquisa.modo === "identificada" ? <UserCheck size={11} /> : <Lock size={11} />} {data.total} resposta{data.total !== 1 ? "s" : ""} · {pesquisa.modo === "identificada" ? "identificadas" : "anônimas"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim)" }}><Loader2 size={20} className="animate-spin" /></div>
          ) : error ? (
            <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>
          ) : data.total === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Nenhuma resposta ainda.</div>
          ) : !data.liberado ? (
            // Piso de respondentes: abaixo dele nem o RH vê. Se visse, "anônima"
            // seria só "não assinada" — em time pequeno, duas respostas abertas
            // identificam quem escreveu. Decidido com o Daniel em 10/09/2026.
            <div style={{ border: "1px dashed var(--border-strong)", borderRadius: 10, padding: "18px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>
                {data.total} de {data.minimo} respostas
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", maxWidth: 380, margin: "0 auto", lineHeight: 1.5 }}>
                O resultado aparece a partir de {data.minimo} respostas. Em equipe pequena, menos que isso permite
                identificar quem escreveu — e a pesquisa foi anunciada como anônima.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {identificada && (
                // Diz ao RH POR QUE tem nome aqui. Sem esta linha, quem abre a
                // tela não sabe se está vendo algo que não deveria.
                <div style={{ background: "var(--amber-bg)", color: "var(--amber)", borderRadius: 9, padding: "9px 11px", fontSize: 11.5, lineHeight: 1.55 }}>
                  Pesquisa anunciada como identificada — quem respondeu viu, antes de escrever, que a resposta ficaria
                  associada ao perfil. Não há piso de respondentes: identificada não promete anonimato.
                </div>
              )}
              {perguntas.map((q) => {
                // Mantém o índice pra casar com `respondentes`, que vem na
                // mesma ordem — por isso o filtro não pode colapsar o array.
                const brutas = data.respostas.map((r, i) => ({ v: r?.[q.key], quem: data.respondentes[i] }));
                const comValor = brutas.filter((x) => x.v !== undefined && x.v !== null && x.v !== "");
                const vals = comValor.map((x) => x.v);
                if (q.tipo === "escala") {
                  const nums = vals.map(Number).filter((n) => !Number.isNaN(n));
                  const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
                  const dist = [1, 2, 3, 4, 5].map((n) => nums.filter((x) => x === n).length);
                  const maxD = Math.max(1, ...dist);
                  return (
                    <div key={q.key}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{q.label}</div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Média: <b style={{ color: "var(--accent)" }}>{avg.toFixed(1)}</b> / 5 · {nums.length} resposta(s)</div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
                        {dist.map((d, idx) => (
                          <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <div style={{ width: "100%", background: "var(--accent)", opacity: 0.85, borderRadius: 4, height: `${(d / maxD) * 44}px`, minHeight: d > 0 ? 4 : 0 }} />
                            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{idx + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={q.key}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{q.label}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {comValor.length === 0 ? <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Sem respostas.</div> : comValor.map((x, idx) => (
                        <div key={idx} style={{ fontSize: 12, color: "var(--text)", background: "var(--surface-alt)", borderRadius: 8, padding: "6px 10px", display: "flex", gap: 9, alignItems: "flex-start" }}>
                          {identificada && x.quem && (
                            <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 700, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>
                              {x.quem}
                            </span>
                          )}
                          <span>{String(x.v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function RHComunicacaoView({ currentUser, canWrite }) {
  const { pesquisas, comunicados, modelos, loading, enviarComunicado, reenviarEmailComunicado, carregarAlcance, carregarLeituras, carregarAssinantes, criarPesquisa, setPesquisaStatus, deletarPesquisa, carregarRespostas, enviarPesquisaNotificacao } = useRHComunicacao({ userId: currentUser?.id });
  const [tab, setTab] = useState("comunicados");
  const [novaOpen, setNovaOpen] = useState(false);
  const [resultadosDe, setResultadosDe] = useState(null);
  const [pesquisaSearch, setPesquisaSearch] = useState("");
  const [pesquisaStatusFilter, setPesquisaStatusFilter] = useState("all");
  const [pesquisaModoFilter, setPesquisaModoFilter] = useState("all");
  const [notificando, setNotificando] = useState(null); // id da pesquisa sendo notificada
  const [notifyResult, setNotifyResult] = useState(null); // { id, count }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const pesquisasFiltradas = useMemo(() => {
    const q = pesquisaSearch.trim().toLowerCase();
    return pesquisas.filter((p) => {
      if (pesquisaStatusFilter !== "all" && p.status !== pesquisaStatusFilter) return false;
      if (pesquisaModoFilter !== "all" && (p.modo || "anonima") !== pesquisaModoFilter) return false;
      if (q && !p.titulo?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pesquisas, pesquisaSearch, pesquisaStatusFilter, pesquisaModoFilter]);

  const handleNotificar = async (pesquisaId) => {
    setNotificando(pesquisaId);
    setNotifyResult(null);
    try {
      const count = await enviarPesquisaNotificacao(pesquisaId);
      setNotifyResult({ id: pesquisaId, count });
    } catch (e) {
      setNotifyResult({ id: pesquisaId, error: e?.message || "Erro ao notificar." });
    } finally {
      setNotificando(null);
    }
  };

  if (!isSupabaseConfigured) {
    return <EmptyState icon={Megaphone} title="Supabase não configurado" description="Configure as variáveis de ambiente para usar este módulo." />;
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone size={22} style={{ color: "var(--text)" }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Comunicação</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Comunicados internos e pesquisas — anônimas ou identificadas</p>
        </div>
        {canWrite && tab === "pesquisas" && <Button icon={Plus} onClick={() => setNovaOpen(true)}>Nova pesquisa</Button>}
      </div>

      <div className="inline-flex rounded-lg border overflow-hidden mb-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
        {[{ id: "comunicados", label: "Comunicados", icon: Megaphone }, { id: "pesquisas", label: "Pesquisas", icon: ClipboardList }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} role="tab" aria-selected={tab === t.id}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
            style={{ background: tab === t.id ? "var(--accent)" : "var(--surface)", color: tab === t.id ? "var(--on-accent)" : "var(--text-dim)", border: "none" }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Escrever e LER são coisas diferentes aqui. A aba inteira ficava atrás
          de `canWrite` (gerente_rh/admin), então a diretoria — que App.jsx
          deixa entrar na rota e que a policy rh_comunicados_diretoria_read
          autoriza a ler — caía num "Sem permissão" e nunca via o histórico.
          Quem não escreve vê "Enviados" (a RLS decide o que vem) e não vê o
          formulário nem o botão de reenvio.

          Regra 9 (Painel Executivo), decisão registrada: NÃO abre aba nova lá.
          Comunicado não é departamento nem Kanban novo — é uma função dentro
          de RH, que já tem sua entrada na faixa de saúde. Alcance de
          comunicado também não é métrica de decisão de diretoria; o que
          interessa a ela é O QUE foi comunicado, e isso está aqui, na rota
          que ela já acessa. */}
      {tab === "comunicados" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {canWrite
            ? <ComunicadoComposer onSend={enviarComunicado} onPreview={carregarAlcance} modelos={modelos} />
            : <EmptyState icon={Megaphone} title="Só leitura" description="Você acompanha o que o RH comunicou, mas não envia comunicados." />}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <History size={15} style={{ color: "var(--text-dim)" }} />
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>Enviados</h2>
            </div>
            <HistoricoComunicados
              comunicados={comunicados}
              loading={loading}
              onReenviar={canWrite ? reenviarEmailComunicado : null}
              onCarregarLeituras={carregarLeituras}
              onCarregarAssinantes={canWrite ? carregarAssinantes : null}
            />
          </div>
        </div>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : (
        // Achado do Daniel (12/08/2026): sem nenhuma pesquisa cadastrada, a
        // busca e os dois filtros abaixo somiam junto com um EmptyState no
        // lugar — parecia bug. Filtros ficam sempre visíveis; a mensagem de
        // "nenhuma pesquisa" já existe logo abaixo (pesquisasFiltradas vazio
        // cobre tanto "zero pesquisas" quanto "zero pra este filtro").
        <>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <div className="relative" style={{ minWidth: 200 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
              <input
                value={pesquisaSearch}
                onChange={(e) => setPesquisaSearch(e.target.value)}
                placeholder="Buscar pesquisa…"
                className="w-full text-xs rounded-xl border pl-7 pr-3 py-1.5 outline-none"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
              />
            </div>
            <select
              value={pesquisaStatusFilter}
              onChange={(e) => setPesquisaStatusFilter(e.target.value)}
              className="text-xs rounded-xl border px-3 py-1.5 outline-none"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
            >
              <option value="all">Todos os status</option>
              <option value="aberta">Aberta</option>
              <option value="encerrada">Encerrada</option>
            </select>
            <select
              value={pesquisaModoFilter}
              onChange={(e) => setPesquisaModoFilter(e.target.value)}
              className="text-xs rounded-xl border px-3 py-1.5 outline-none"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
            >
              <option value="all">Todos os modos</option>
              <option value="anonima">Anônima</option>
              <option value="identificada">Identificada</option>
            </select>
          </div>
          {pesquisasFiltradas.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-dim)", padding: "24px 0", textAlign: "center" }}>
              {pesquisas.length === 0
                ? "Nenhuma pesquisa ainda — crie uma pesquisa anônima ou identificada acima."
                : "Nenhuma pesquisa encontrada com esses filtros."}
            </div>
          ) : (
        <div className="flex flex-col gap-3" style={{ maxWidth: 720 }}>
          {pesquisasFiltradas.map((p) => {
            const aberta = p.status === "aberta";
            const identificada = p.modo === "identificada";
            const url = `${origin}/pesquisa/${p.id}`;
            return (
              <div key={p.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{p.titulo}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                      {(p.perguntas?.length || 0)} pergunta(s) · {formatDateBR(p.created_at)}{p.fecha_em ? ` · encerra ${formatDateBR(p.fecha_em)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontSize: 11, fontWeight: 700, color: identificada ? "var(--channel-email-text)" : "var(--text-dim)", background: identificada ? "var(--channel-email-bg)" : "var(--surface-alt)", borderRadius: 99, padding: "2px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {identificada ? <UserCheck size={11} /> : <Lock size={11} />} {identificada ? "Identificada" : "Anônima"}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: aberta ? "var(--success)" : "var(--text-dim)", background: aberta ? "var(--success-bg)" : "var(--surface-alt)", borderRadius: 99, padding: "2px 10px" }}>
                      {aberta ? "Aberta" : "Encerrada"}
                    </span>
                  </div>
                </div>
                {canWrite && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                    {aberta && !identificada && <QRCodeButton url={url} title={p.titulo} buttonLabel="QR / link" compact />}
                    {aberta && identificada && (
                      <button onClick={() => handleNotificar(p.id)} disabled={notificando === p.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: notificando === p.id ? "default" : "pointer", opacity: notificando === p.id ? 0.6 : 1 }}>
                        {notificando === p.id ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />} Notificar colaboradores
                      </button>
                    )}
                    <button onClick={() => setResultadosDe(p)} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      <BarChart3 size={12} /> Ver respostas
                    </button>
                    <button onClick={() => setPesquisaStatus(p.id, aberta ? "encerrada" : "aberta")} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--surface)", color: "var(--text-dim)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {aberta ? "Encerrar" : "Reabrir"}
                    </button>
                    <MoveStageMenu
                      onDelete={() => deletarPesquisa(p.id)}
                      deleteLabel="Excluir pesquisa"
                      confirmMessage="Excluir esta pesquisa e todas as respostas? Não pode ser desfeito."
                    />
                  </div>
                )}
                {notifyResult?.id === p.id && (
                  <div style={{ marginTop: 8, fontSize: 12, color: notifyResult.error ? "var(--danger)" : "var(--success)" }}>
                    {notifyResult.error || `Notificação enviada para ${notifyResult.count} colaborador${notifyResult.count !== 1 ? "es" : ""}.`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
          )}
        </>
      )}

      {novaOpen && <NovaPesquisaModal onSave={criarPesquisa} onClose={() => setNovaOpen(false)} />}
      {resultadosDe && <ResultadosModal pesquisa={resultadosDe} carregarRespostas={carregarRespostas} onClose={() => setResultadosDe(null)} />}
    </div>
  );
}

export default RHComunicacaoView;
