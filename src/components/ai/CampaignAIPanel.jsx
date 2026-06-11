import React, { useState } from "react";
import { Sparkles, Loader2, AlertCircle, RotateCcw, Copy, Check } from "lucide-react";
import { useAI } from "../../hooks/use-ai";
import { campaignStageSuggestionPrompt } from "../../constants/ai-prompts";
import { NEUTRAL } from "../../constants/companies";

const PURPLE = "#7C3AED";

export function CampaignAIPanel({ campaign, currentUser }) {
  const { complete, isConfigured } = useAI(currentUser);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [copied,  setCopied]  = useState(false);

  const handleGenerate = async () => {
    if (!isConfigured) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setCopied(false);
    try {
      const text = await complete(campaignStageSuggestionPrompt(campaign));
      setResult(text);
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

  return (
    <div className="space-y-3">
      <div className="p-4 rounded-xl border" style={{ background: "#F5F3FF", borderColor: "#DDD6FE" }}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} style={{ color: PURPLE }} />
          <span className="text-xs font-semibold" style={{ color: PURPLE }}>
            Sugestão de próxima etapa
          </span>
          {!isConfigured && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full ml-auto"
              style={{ background: "#FEF3C7", color: "#92400E" }}>
              configure nas Configurações
            </span>
          )}
        </div>
        <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "#5B21B6" }}>
          A IA analisa etapa, SLA, checklist e datas para recomendar se é hora de avançar.
        </p>
        <button
          onClick={handleGenerate}
          disabled={loading || !isConfigured}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all active:scale-95"
          style={{
            background: !isConfigured ? "#E5E7EB" : PURPLE,
            color: !isConfigured ? NEUTRAL.slate : "#FFFFFF",
            border: "none",
            cursor: loading || !isConfigured ? "not-allowed" : "pointer",
            opacity: loading ? 0.8 : 1,
          }}
          title={!isConfigured ? "Configure sua LLM nas Configurações → Integrações de IA" : undefined}
          onMouseEnter={e => { if (!loading && isConfigured) e.currentTarget.style.filter = "brightness(0.9)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {loading ? "Analisando…" : "Analisar campanha"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-xl"
          style={{ background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="text-xs leading-relaxed whitespace-pre-line p-3 rounded-xl border"
            style={{ background: "#FFFFFF", borderColor: "#DDD6FE", color: NEUTRAL.graphite }}>
            {result}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
              style={{ background: "#FFFFFF", color: NEUTRAL.slate, borderColor: "#E5E7EB", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = PURPLE; e.currentTarget.style.color = PURPLE; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = NEUTRAL.slate; }}
            >
              <RotateCcw size={11} />
              Regenerar
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
              style={{
                background: copied ? "#F0FDF4" : "#FFFFFF",
                color: copied ? "#16A34A" : NEUTRAL.slate,
                borderColor: copied ? "#BBF7D0" : "#E5E7EB",
                cursor: "pointer",
              }}
              onMouseEnter={e => { if (!copied) { e.currentTarget.style.borderColor = NEUTRAL.graphite; e.currentTarget.style.color = NEUTRAL.graphite; } }}
              onMouseLeave={e => { if (!copied) { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = NEUTRAL.slate; } }}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
