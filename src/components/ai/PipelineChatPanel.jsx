import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, X, Send, Loader2, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAI } from "../../hooks/use-ai";
import { pipelineChatPrompt } from "../../constants/ai-prompts";
import { aggregatePipeline } from "../../utils/pipeline-metrics";
import { formatK } from "../../utils/currency";
import { useEscToClose } from "../../hooks/use-esc-to-close";

const RED = "var(--accent)";

// Detecta se a pergunta pede algo "por vendedor/responsável" ou "por etapa"
// — nesses casos, um gráfico com os dados já calculados (não os números que
// a IA responde em texto) é anexado embaixo da resposta.
function detectChartIntent(question) {
  const q = question.toLowerCase();
  if (/vendedor|responsáve|responsave/.test(q)) return "byOwner";
  if (/etapa|funil|estágio|estagio/.test(q)) return "byStage";
  return null;
}

export function PipelineChatPanel({ leads, users, currentUser, isOpen, onClose }) {
  const { complete, isConfigured } = useAI(currentUser);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  useEscToClose(onClose, isOpen);

  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const aggregate = useMemo(() => aggregatePipeline(leads, users), [leads, users]);

  const systemPrompt = useMemo(() => {
    return pipelineChatPrompt("", aggregate)[0];
  }, [aggregate]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg = { role: "user", content: question };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    const chart = detectChartIntent(question);

    try {
      // For multi-turn: inject prior assistant/user messages after the system prompt
      const systemMsg = systemPrompt;
      const priorTurns = messages.flatMap(m => [{ role: m.role, content: m.content }]);
      const finalMessages = [systemMsg, ...priorTurns, { role: "user", content: question }];

      const text = await complete(finalMessages);
      setMessages(prev => [...prev, { role: "assistant", content: text, chart }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `__error__:${err.message || "Erro ao gerar resposta."}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.15)" }}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--surface)",
          boxShadow: "var(--shadow-pop)",
          borderLeft: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Bot size={17} style={{ color: RED }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
              Chat com Funil de Vendas
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Not-configured banner */}
        {!isConfigured && (
          <div
            className="flex items-start gap-2 px-4 py-2.5 text-sm flex-shrink-0"
            style={{ background: "var(--warning-bg)", color: "var(--warning)", borderBottom: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)" }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Configure sua LLM nas Configurações → Integrações de IA</span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "#FBE9EB" }}
              >
                <Bot size={22} style={{ color: RED }} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                  Pergunte sobre seu pipeline
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
                  Ex: "Quais leads estão parados há mais de 15 dias?" ou "Qual o valor total em negociação?"
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isError = msg.role === "assistant" && msg.content.startsWith("__error__:");
            const content = isError ? msg.content.slice(10) : msg.content;

            if (msg.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div
                    className="text-sm px-3 py-2 rounded-2xl rounded-tr-sm max-w-[85%]"
                    style={{ background: RED, color: "var(--on-accent)" }}
                  >
                    {content}
                  </div>
                </div>
              );
            }

            return (
              <div key={i} className="flex flex-col items-start gap-2">
                <div
                  className="text-sm px-3 py-2 rounded-2xl rounded-tl-sm max-w-[90%] whitespace-pre-line leading-relaxed"
                  style={
                    isError
                      ? { background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }
                      : { background: "var(--surface-alt)", color: "var(--text)" }
                  }
                >
                  {isError && <AlertCircle size={12} style={{ display: "inline", marginRight: 4 }} />}
                  {content}
                </div>
                {!isError && msg.chart && <PipelineMiniChart type={msg.chart} aggregate={aggregate} />}
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-2xl rounded-tl-sm"
                style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}
              >
                <Loader2 size={13} className="animate-spin" />
                Analisando pipeline...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div
          className="px-4 py-3 border-t flex-shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
        >
          <div
            className="flex items-end gap-2 rounded-xl border"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isConfigured ? "Pergunte sobre o pipeline... (Enter para enviar)" : "Configure a IA para usar o chat"}
              disabled={!isConfigured || loading}
              rows={2}
              className="flex-1 text-sm px-3 py-2.5 resize-none outline-none rounded-xl"
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text)",
                fontFamily: "inherit",
                lineHeight: "1.5",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!isConfigured || loading || !input.trim()}
              className="m-1.5 p-2 rounded-lg flex-shrink-0 transition-all active:scale-95"
              style={{
                background: !isConfigured || !input.trim() || loading ? "var(--surface-alt)" : RED,
                color: !isConfigured || !input.trim() || loading ? "var(--text-dim)" : "var(--on-accent)",
                border: "none",
                cursor: !isConfigured || !input.trim() || loading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={e => {
                if (isConfigured && input.trim() && !loading) {
                  e.currentTarget.style.filter = "brightness(0.9)";
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.filter = "brightness(1)";
              }}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <p className="text-[10px] mt-1.5 text-center" style={{ color: "#B0ABA5" }}>
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </>
  );
}

// Gráfico com os mesmos números já calculados em aggregatePipeline — nunca
// com valores vindos da resposta da IA, pra não repetir o problema de
// números "chutados".
function PipelineMiniChart({ type, aggregate }) {
  if (type === "byOwner") {
    const data = aggregate.byOwner.slice(0, 8).map(o => ({ name: o.name.split(" ")[0], valor: o.valueWon }));
    if (data.length === 0) return null;
    return (
      <div className="w-full rounded-xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <ResponsiveContainer width="100%" height={Math.max(120, data.length * 28 + 20)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={formatK} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={64} />
            <Tooltip formatter={(v) => formatK(v)} />
            <Bar dataKey="valor" radius={[0, 5, 5, 0]} fill={RED} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "byStage") {
    const data = aggregate.byStage.map(s => ({ name: s.stage, count: s.count }));
    if (data.length === 0) return null;
    return (
      <div className="w-full rounded-xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" radius={[5, 5, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={RED} fillOpacity={1 - i * 0.08} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}
