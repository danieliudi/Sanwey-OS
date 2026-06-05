import React, { useState } from "react";
import {
  Bot, ChevronDown, ChevronUp, Loader2, AlertCircle, RotateCcw, Copy, Check,
} from "lucide-react";
import { useAI } from "../../hooks/use-ai";
import {
  briefingPrompt, emailDraftPrompt, nextStepPrompt, objectionPrompt,
} from "../../constants/ai-prompts";
import { NEUTRAL } from "../../constants/companies";

const RED = "#C7212B";
const CREAM = "#F9F5F1";
const BORDER = "#E5E0DA";
const BG = "#F1EDE8";

const FEATURES = [
  { id: "briefing",   label: "Briefing de reunião" },
  { id: "email",      label: "Rascunho de e-mail IA" },
  { id: "nextstep",   label: "Próximo passo" },
  { id: "objection",  label: "Análise de objeção" },
];

const TONES = [
  { value: "profissional", label: "Profissional" },
  { value: "amigável",     label: "Amigável" },
  { value: "direto",       label: "Direto" },
];

export function LeadAIPanel({ lead, currentUser, activities, linkedEmails }) {
  const { complete, isConfigured } = useAI(currentUser);

  const [open, setOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState("briefing");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Feature-specific state
  const [emailTone, setEmailTone] = useState("profissional");
  const [objectionText, setObjectionText] = useState("");

  const handleFeatureSelect = (id) => {
    setActiveFeature(id);
    setResult(null);
    setError(null);
    setCopied(false);
  };

  const buildMessages = () => {
    switch (activeFeature) {
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
    setError(null);
    setCopied(false);
    try {
      const messages = buildMessages();
      const text = await complete(messages);
      setResult(text);
    } catch (err) {
      setError(err.message || "Erro ao gerar resposta.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRegenerate = () => {
    handleGenerate();
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
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
