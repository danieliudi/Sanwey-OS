import React, { useState } from "react";
import {
  Bot, ChevronDown, ChevronUp, Loader2, AlertCircle, RotateCcw, Copy, Check, Target,
  CalendarClock, History,
} from "lucide-react";
import { useAI } from "../../hooks/use-ai";
import {
  briefingPrompt, emailDraftPrompt, nextStepPrompt, objectionPrompt, scorePrompt,
} from "../../constants/ai-prompts";
import { NEUTRAL } from "../../constants/companies";

const RED = "var(--accent)";
const CREAM = "var(--surface-alt)";
const BORDER = "#E5E7EB";
const BG = "#F1EDE8";

const FEATURES = [
  { id: "score",      label: "Calcular Fit Score" },
  { id: "briefing",   label: "Briefing de reunião" },
  { id: "email",      label: "Rascunho de e-mail IA" },
  { id: "nextstep",   label: "Próximo passo" },
  { id: "objection",  label: "Análise de objeção" },
];

function parseScoreResponse(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta da IA não trouxe um JSON válido.");
  const parsed = JSON.parse(match[0]);
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
  return { score, justificativa: parsed.justificativa || "" };
}

const TONES = [
  { value: "profissional", label: "Profissional" },
  { value: "amigável",     label: "Amigável" },
  { value: "direto",       label: "Direto" },
];

export function LeadAIPanel({ lead, currentUser, activities, linkedEmails, onUpdate, onAddActivity }) {
  const { complete, isConfigured } = useAI(currentUser);

  const [open, setOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState("score");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [scoreResult, setScoreResult] = useState(null);
  const [scheduled, setScheduled] = useState(false);
  const [savedToHistory, setSavedToHistory] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Feature-specific state
  const [emailTone, setEmailTone] = useState("profissional");
  const [objectionText, setObjectionText] = useState("");

  const handleFeatureSelect = (id) => {
    setActiveFeature(id);
    setResult(null);
    setScoreResult(null);
    setError(null);
    setCopied(false);
    setScheduled(false);
    setSavedToHistory(false);
  };

  const buildMessages = () => {
    switch (activeFeature) {
      case "score":
        return scorePrompt(lead, activities);
      case "briefing":
        return briefingPrompt(lead, activities, linkedEmails);
      case "email":
        return emailDraftPrompt(lead, emailTone);
      case "nextstep":
        return nextStepPrompt(lead, activities);
      case "objection":
        return objectionPrompt(lead, objectionText);
      default:
        return null;
    }
  };

  const handleGenerate = async () => {
    if (!isConfigured) return;
    if (activeFeature === "objection" && !objectionText.trim()) {
      setError("Digite a objeção antes de gerar.");
      return;
    }
    setLoading(true);
    setResult(null);
    setScoreResult(null);
    setError(null);
    setCopied(false);
    setScheduled(false);
    setSavedToHistory(false);
    try {
      const messages = buildMessages();
      const text = await complete(messages);
      if (activeFeature === "score") {
        const parsed = parseScoreResponse(text);
        setScoreResult(parsed);
        onUpdate?.(lead.id, { fitScore: parsed.score });
      } else {
        setResult(text);
      }
    } catch (err) {
      setError(err.message || "Erro ao gerar resposta.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRegenerate = () => {
    handleGenerate();
  };

  // Fase 7: transforma a sugestão de "Próximo passo" num follow-up agendado
  // de verdade, reaproveitando o mesmo campo que já dispara lembrete
  // (use-notifications.js) — fecha o ciclo entre a IA sugerir e o sistema
  // cobrar depois.
  const handleScheduleFollowUp = () => {
    if (!onUpdate) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    onUpdate(lead.id, { nextFollowUp: tomorrow.toISOString().slice(0, 10) });
    setScheduled(true);
  };

  // Fase 10: salva o texto gerado como uma atividade do lead, em vez de só
  // deixar na tela até o painel fechar.
  const handleSaveToHistory = async () => {
    if (!result || !onAddActivity) return;
    const featureLabel = FEATURES.find(f => f.id === activeFeature)?.label || "IA";
    await onAddActivity(lead.id, {
      type: "note",
      userId: currentUser?.id || null,
      userName: currentUser?.name || null,
      body: `[${featureLabel}] ${result}`,
    });
    setSavedToHistory(true);
  };

  return (
    <div
      className="rounded-xl border"
      style={{ background: BG, borderColor: BORDER }}
    >
      {/* Header / toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-150"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        <div className="flex items-center gap-2">
          <Bot size={15} style={{ color: RED }} strokeWidth={2} />
          <span className="text-sm font-semibold" style={{ color: NEUTRAL.graphite }}>
            Assistente de IA
          </span>
          {!isConfigured && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: "#FEF3C7", color: "#92400E" }}
            >
              configure nas Configurações
            </span>
          )}
        </div>
        {open
          ? <ChevronUp size={15} style={{ color: NEUTRAL.slate }} />
          : <ChevronDown size={15} style={{ color: NEUTRAL.slate }} />}
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Feature tabs */}
          <div className="flex flex-wrap gap-1.5">
            {FEATURES.map(f => (
              <button
                key={f.id}
                onClick={() => handleFeatureSelect(f.id)}
                className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150"
                style={{
                  background: activeFeature === f.id ? RED : "#FFFFFF",
                  color: activeFeature === f.id ? "#FFFFFF" : NEUTRAL.graphite,
                  borderColor: activeFeature === f.id ? RED : BORDER,
                  cursor: "pointer",
                }}
                onMouseEnter={e => {
                  if (activeFeature !== f.id) {
                    e.currentTarget.style.background = CREAM;
                    e.currentTarget.style.borderColor = RED;
                    e.currentTarget.style.color = RED;
                  }
                }}
                onMouseLeave={e => {
                  if (activeFeature !== f.id) {
                    e.currentTarget.style.background = "#FFFFFF";
                    e.currentTarget.style.borderColor = BORDER;
                    e.currentTarget.style.color = NEUTRAL.graphite;
                  }
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Email tone selector */}
          {activeFeature === "email" && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium" style={{ color: NEUTRAL.slate }}>Tom:</span>
              {TONES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setEmailTone(t.value)}
                  className="text-xs px-2.5 py-1 rounded-full border transition-all duration-150"
                  style={{
                    background: emailTone === t.value ? NEUTRAL.graphite : "#FFFFFF",
                    color: emailTone === t.value ? "#FFFFFF" : NEUTRAL.graphite,
                    borderColor: emailTone === t.value ? NEUTRAL.graphite : BORDER,
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => {
                    if (emailTone !== t.value) e.currentTarget.style.borderColor = NEUTRAL.graphite;
                  }}
                  onMouseLeave={e => {
                    if (emailTone !== t.value) e.currentTarget.style.borderColor = BORDER;
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Objection textarea */}
          {activeFeature === "objection" && (
            <textarea
              value={objectionText}
              onChange={e => setObjectionText(e.target.value)}
              placeholder="Descreva a objeção do cliente..."
              rows={3}
              className="w-full text-sm rounded-lg border px-3 py-2 resize-none outline-none transition-colors"
              style={{
                borderColor: BORDER,
                background: "#FFFFFF",
                color: NEUTRAL.graphite,
                fontFamily: "inherit",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = RED; }}
              onBlur={e => { e.currentTarget.style.borderColor = BORDER; }}
            />
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !isConfigured}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 active:scale-95"
            style={{
              background: !isConfigured ? "#E5E7EB" : RED,
              color: !isConfigured ? NEUTRAL.slate : "#FFFFFF",
              cursor: loading || !isConfigured ? "not-allowed" : "pointer",
              border: "none",
              opacity: loading ? 0.8 : 1,
            }}
            onMouseEnter={e => {
              if (!loading && isConfigured) e.currentTarget.style.filter = "brightness(0.9)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.filter = "brightness(1)";
            }}
            title={!isConfigured ? "Configure sua LLM nas Configurações → Integrações de IA" : undefined}
          >
            {loading
              ? <Loader2 size={14} className="animate-spin" />
              : <Bot size={14} />}
            {loading ? "Gerando..." : "Gerar com IA"}
          </button>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg"
              style={{ background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Score result */}
          {scoreResult && (
            <div className="space-y-2">
              <div
                className="flex items-start gap-3 p-3 rounded-lg border"
                style={{ background: CREAM, borderColor: BORDER }}
              >
                <div
                  className="flex items-center justify-center rounded-full font-bold flex-shrink-0"
                  style={{
                    width: 44, height: 44, fontSize: 16,
                    color: scoreResult.score >= 70 ? "#16A34A" : scoreResult.score >= 40 ? "#D97706" : "#DC2626",
                    background: scoreResult.score >= 70 ? "#DCFCE7" : scoreResult.score >= 40 ? "#FEF3C7" : "#FEE2E2",
                  }}
                >
                  {scoreResult.score}
                </div>
                <div className="text-sm leading-relaxed" style={{ color: NEUTRAL.graphite }}>
                  {scoreResult.justificativa}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRegenerate}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150"
                  style={{ background: "#FFFFFF", color: NEUTRAL.slate, borderColor: BORDER, cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = NEUTRAL.graphite; e.currentTarget.style.color = NEUTRAL.graphite; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = NEUTRAL.slate; }}
                >
                  <RotateCcw size={11} />
                  Recalcular
                </button>
                <span className="flex items-center gap-1 text-xs" style={{ color: "#16A34A" }}>
                  <Target size={11} /> Score salvo no lead
                </span>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-2">
              <div
                className="text-sm leading-relaxed whitespace-pre-line p-3 rounded-lg border"
                style={{ background: CREAM, borderColor: BORDER, color: NEUTRAL.graphite }}
              >
                {result}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRegenerate}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150"
                  style={{ background: "#FFFFFF", color: NEUTRAL.slate, borderColor: BORDER, cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = NEUTRAL.graphite; e.currentTarget.style.color = NEUTRAL.graphite; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = NEUTRAL.slate; }}
                >
                  <RotateCcw size={11} />
                  Regenerar
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150"
                  style={{
                    background: copied ? "#F0FDF4" : "#FFFFFF",
                    color: copied ? "#16A34A" : NEUTRAL.slate,
                    borderColor: copied ? "#BBF7D0" : BORDER,
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => {
                    if (!copied) { e.currentTarget.style.borderColor = NEUTRAL.graphite; e.currentTarget.style.color = NEUTRAL.graphite; }
                  }}
                  onMouseLeave={e => {
                    if (!copied) { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = NEUTRAL.slate; }
                  }}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? "Copiado!" : "Copiar"}
                </button>
                {activeFeature === "nextstep" && onUpdate && (
                  <button
                    onClick={handleScheduleFollowUp}
                    disabled={scheduled}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150"
                    style={{
                      background: scheduled ? "#F0FDF4" : "#FFFFFF",
                      color: scheduled ? "#16A34A" : NEUTRAL.slate,
                      borderColor: scheduled ? "#BBF7D0" : BORDER,
                      cursor: scheduled ? "default" : "pointer",
                    }}
                  >
                    {scheduled ? <Check size={11} /> : <CalendarClock size={11} />}
                    {scheduled ? "Follow-up agendado" : "Agendar follow-up p/ amanhã"}
                  </button>
                )}
                {onAddActivity && (
                  <button
                    onClick={handleSaveToHistory}
                    disabled={savedToHistory}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150"
                    style={{
                      background: savedToHistory ? "#F0FDF4" : "#FFFFFF",
                      color: savedToHistory ? "#16A34A" : NEUTRAL.slate,
                      borderColor: savedToHistory ? "#BBF7D0" : BORDER,
                      cursor: savedToHistory ? "default" : "pointer",
                    }}
                  >
                    {savedToHistory ? <Check size={11} /> : <History size={11} />}
                    {savedToHistory ? "Salvo no histórico" : "Salvar no histórico"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
