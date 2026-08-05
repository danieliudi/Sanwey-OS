import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles, Loader2, AlertCircle, RotateCcw, Copy, Check, History, Target,
} from "lucide-react";
import { useAI } from "../../hooks/use-ai";

// Componente universal de IA por card de Kanban (Frente 10, item 2) — antes
// disso existiam 3 implementações hand-rolled (LeadAIPanel, e um
// CampaignAIPanel/DeliverableAIPanel copiado dentro de cada drawer). Este
// substitui as 3: cada domínio só declara uma lista de `features` (prompt +
// como tratar o resultado); loading/erro/copiar/regenerar/salvar no
// histórico ficam aqui, uma vez só. Mockup aprovado:
// "Padrão universal de IA por Kanban".

function parseScoreResponse(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta da IA não trouxe um JSON válido.");
  const parsed = JSON.parse(match[0]);
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
  return { score, justificativa: parsed.justificativa || "" };
}

const btnBase = {
  fontSize: 11, fontWeight: 600, padding: "6px 11px", borderRadius: 999,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)",
  display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
};

/**
 * @param {object} props
 * @param {object} props.currentUser
 * @param {Array<{
 *   id: string, label: string,
 *   buildMessages: (extraValue: any) => Array<{role:string, content:any}>,
 *   resultType?: "text"|"score",
 *   onScoreApply?: (score:number, justificativa:string) => void,
 *   validateExtra?: (extraValue:any) => string|null,
 *   initialExtra?: any,
 *   renderExtra?: (value:any, setValue:(v:any)=>void) => React.ReactNode,
 *   actions?: Array<{ id:string, label:string, doneLabel:string, icon:React.ComponentType, onRun:(resultText:string)=>void }>,
 * }>} props.features
 * @param {string} [props.defaultFeatureId]
 * @param {(text:string, featureLabel:string) => Promise<void>} [props.onSaveNote] — quando passado, mostra "Salvar no histórico"
 */
export function RecordAIPanel({ currentUser, features, defaultFeatureId, onSaveNote }) {
  const { complete, isConfigured } = useAI(currentUser);
  const [activeId, setActiveId] = useState(defaultFeatureId || features[0]?.id);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [savedToHistory, setSavedToHistory] = useState(false);
  const [extraState, setExtraState] = useState({});
  const [actionDone, setActionDone] = useState({});

  // Geração em andamento quando o card é fechado: sem isso, o `setState` do
  // `finally`/`catch` roda em componente já desmontado (o `complete()` não é
  // cancelável, mas o resultado passa a ser descartado). `useRef` em vez de
  // state pra não provocar render — é só um sinal de "essa geração ainda
  // interessa?".
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const activeFeature = features.find(f => f.id === activeId) || features[0];
  if (!activeFeature) return null;

  const extraValue = Object.prototype.hasOwnProperty.call(extraState, activeFeature.id)
    ? extraState[activeFeature.id]
    : activeFeature.initialExtra;

  const resetResultState = () => {
    setResult(null); setError(null); setCopied(false); setSavedToHistory(false); setActionDone({});
  };

  const handleSelect = (id) => {
    setActiveId(id);
    resetResultState();
  };

  const setExtra = (value) => setExtraState(s => ({ ...s, [activeFeature.id]: value }));

  const handleGenerate = async () => {
    if (!isConfigured) return;
    const validationMsg = activeFeature.validateExtra?.(extraValue);
    if (validationMsg) { setError(validationMsg); return; }
    setLoading(true);
    resetResultState();
    try {
      const messages = activeFeature.buildMessages(extraValue);
      const text = await complete(messages);
      if (!aliveRef.current) return;
      if (activeFeature.resultType === "score") {
        const parsed = parseScoreResponse(text);
        // Só mostra. Gravar no registro é ação separada, por clique — ver o
        // botão "Aplicar ao lead" abaixo. Antes o score era escrito no banco
        // aqui dentro, antes de qualquer confirmação humana.
        setResult({ type: "score", score: parsed.score, justificativa: parsed.justificativa });
      } else {
        setResult({ type: "text", text });
      }
    } catch (err) {
      if (!aliveRef.current) return;
      setError(err.message || "Erro ao gerar resposta.");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  };

  const applyScore = () => {
    if (result?.type !== "score") return;
    activeFeature.onScoreApply?.(result.score, result.justificativa);
    setActionDone(s => ({ ...s, __score: true }));
  };

  const handleCopy = () => {
    if (result?.type !== "text" || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(result.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveToHistory = async () => {
    if (result?.type !== "text" || !onSaveNote) return;
    await onSaveNote(result.text, activeFeature.label);
    setSavedToHistory(true);
  };

  const runAction = (action) => {
    if (result?.type !== "text") return;
    action.onRun(result.text);
    setActionDone(s => ({ ...s, [action.id]: true }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="flex items-center justify-center rounded-lg"
          style={{ width: 26, height: 26, background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}
        >
          <Sparkles size={14} />
        </span>
        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Assistente de IA</span>
        {!isConfigured && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: "var(--warning-bg)", color: "var(--warning)" }}
          >
            configure nas Configurações
          </span>
        )}
      </div>

      {features.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {features.map(f => (
            <button
              key={f.id}
              onClick={() => handleSelect(f.id)}
              className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150"
              style={{
                background: activeFeature.id === f.id ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--surface)",
                color: activeFeature.id === f.id ? "var(--accent)" : "var(--text-dim)",
                borderColor: activeFeature.id === f.id ? "color-mix(in srgb, var(--accent) 40%, var(--border))" : "var(--border)",
                fontWeight: activeFeature.id === f.id ? 600 : 500,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {activeFeature.renderExtra?.(extraValue, setExtra)}

      <button
        onClick={handleGenerate}
        disabled={loading || !isConfigured}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 active:scale-95"
        style={{
          background: !isConfigured ? "var(--border)" : "var(--accent)",
          color: !isConfigured ? "var(--text-dim)" : "#FFFFFF",
          cursor: loading || !isConfigured ? "not-allowed" : "pointer",
          border: "none",
          opacity: loading ? 0.8 : 1,
        }}
        title={!isConfigured ? "Configure sua LLM nas Configurações → Integrações" : undefined}
        onMouseEnter={e => { if (!loading && isConfigured) e.currentTarget.style.filter = "brightness(0.9)"; }}
        onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {loading ? "Gerando..." : "Gerar com IA"}
      </button>

      {error && (
        <div
          className="flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg"
          style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {result?.type === "score" && (
        <div className="space-y-2">
          <div
            className="flex items-start gap-3 p-3 rounded-lg border"
            style={{ background: "var(--surface-alt)", borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center justify-center rounded-full font-bold flex-shrink-0"
              style={{
                width: 44, height: 44, fontSize: 16,
                color: result.score >= 70 ? "var(--success)" : result.score >= 40 ? "var(--warning)" : "var(--danger)",
                background: result.score >= 70 ? "color-mix(in srgb, var(--success) 16%, transparent)" : result.score >= 40 ? "var(--warning-bg)" : "var(--danger-bg)",
              }}
            >
              {result.score}
            </div>
            <div className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
              {result.justificativa}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleGenerate} style={btnBase}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--text)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)"; }}>
              <RotateCcw size={11} />Calcular novamente
            </button>
            {activeFeature.onScoreApply && (
              <button
                onClick={applyScore}
                disabled={Boolean(actionDone.__score)}
                style={{
                  ...btnBase,
                  background: actionDone.__score ? "color-mix(in srgb, var(--success) 12%, transparent)" : "var(--accent)",
                  color: actionDone.__score ? "var(--success)" : "#FFFFFF",
                  borderColor: actionDone.__score ? "color-mix(in srgb, var(--success) 35%, transparent)" : "var(--accent)",
                  cursor: actionDone.__score ? "default" : "pointer",
                }}
              >
                {actionDone.__score ? <Check size={11} /> : <Target size={11} />}
                {actionDone.__score ? "Score salvo no lead" : "Aplicar ao lead"}
              </button>
            )}
          </div>
        </div>
      )}

      {result?.type === "text" && (
        <div className="space-y-2">
          <div
            className="text-sm leading-relaxed whitespace-pre-line p-3 rounded-lg border"
            style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            {result.text}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleGenerate} style={btnBase}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--text)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)"; }}>
              <RotateCcw size={11} />Gerar novamente
            </button>
            <button onClick={handleCopy} style={{
              ...btnBase,
              background: copied ? "color-mix(in srgb, var(--success) 12%, transparent)" : "var(--surface)",
              color: copied ? "var(--success)" : "var(--text-dim)",
              borderColor: copied ? "color-mix(in srgb, var(--success) 35%, transparent)" : "var(--border)",
            }}
              onMouseEnter={e => { if (!copied) { e.currentTarget.style.borderColor = "var(--text)"; e.currentTarget.style.color = "var(--text)"; } }}
              onMouseLeave={e => { if (!copied) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)"; } }}>
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "Copiado!" : "Copiar"}
            </button>
            {activeFeature.actions?.map(action => {
              const done = Boolean(actionDone[action.id]);
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => runAction(action)}
                  disabled={done}
                  style={{
                    ...btnBase,
                    background: done ? "color-mix(in srgb, var(--success) 12%, transparent)" : "var(--surface)",
                    color: done ? "var(--success)" : "var(--text-dim)",
                    borderColor: done ? "color-mix(in srgb, var(--success) 35%, transparent)" : "var(--border)",
                    cursor: done ? "default" : "pointer",
                  }}
                >
                  {done ? <Check size={11} /> : (ActionIcon ? <ActionIcon size={11} /> : null)}
                  {done ? (action.doneLabel || "Feito") : action.label}
                </button>
              );
            })}
            {onSaveNote && (
              <button onClick={handleSaveToHistory} disabled={savedToHistory} style={{
                ...btnBase,
                background: savedToHistory ? "color-mix(in srgb, var(--success) 12%, transparent)" : "var(--surface)",
                color: savedToHistory ? "var(--success)" : "var(--text-dim)",
                borderColor: savedToHistory ? "color-mix(in srgb, var(--success) 35%, transparent)" : "var(--border)",
                cursor: savedToHistory ? "default" : "pointer",
              }}>
                {savedToHistory ? <Check size={11} /> : <History size={11} />}
                {savedToHistory ? "Salvo no histórico" : "Salvar no histórico"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
