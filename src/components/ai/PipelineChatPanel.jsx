import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, X, Send, Loader2, AlertCircle } from "lucide-react";
import { useAI } from "../../hooks/use-ai";
import { pipelineChatPrompt } from "../../constants/ai-prompts";
import { NEUTRAL } from "../../constants/companies";

const RED = "#b5000b";

export function PipelineChatPanel({ leads, users, currentUser, isOpen, onClose }) {
  const { complete, isConfigured } = useAI(currentUser);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const systemPrompt = useMemo(() => {
    return pipelineChatPrompt("", leads, users)[0];
  }, [leads, users]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg = { role: "user", content: question };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // For multi-turn: inject prior assistant/user messages after the system prompt
      const systemMsg = systemPrompt;
      const priorTurns = messages.flatMap(m => [{ role: m.role, content: m.content }]);
      const finalMessages = [systemMsg, ...priorTurns, { role: "user", content: question }];

      const text = await complete(finalMessages);
      setMessages(prev => [...prev, { role: "assistant", content: text }]);
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
        onClick={onClose}
        style={{ background: "rgba(0,0,0,0.15)" }}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#FFFFFF",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          borderLeft: "1px solid #E5E7EB",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-2">
            <Bot size={17} style={{ color: RED }} />
            <span className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>
              Chat com Pipeline
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: NEUTRAL.slate, background: "transparent", border: "none", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.color = NEUTRAL.graphite; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = NEUTRAL.slate; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Not-configured banner */}
        {!isConfigured && (
          <div
            className="flex items-start gap-2 px-4 py-2.5 text-sm flex-shrink-0"
            style={{ background: "#FEF3C7", color: "#92400E", borderBottom: "1px solid #FCD34D" }}
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
                <p className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>
                  Pergunte sobre seu pipeline
                </p>
                <p className="text-xs mt-1" style={{ color: NEUTRAL.slate }}>
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
                    style={{ background: RED, color: "#FFFFFF" }}
                  >
                    {content}
                  </div>
                </div>
              );
            }

            return (
              <div key={i} className="flex justify-start">
                <div
                  className="text-sm px-3 py-2 rounded-2xl rounded-tl-sm max-w-[90%] whitespace-pre-line leading-relaxed"
                  style={
                    isError
                      ? { background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }
                      : { background: "#fef1f0", color: NEUTRAL.graphite }
                  }
                >
                  {isError && <AlertCircle size={12} style={{ display: "inline", marginRight: 4 }} />}
                  {content}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-2xl rounded-tl-sm"
                style={{ background: "#fef1f0", color: NEUTRAL.slate }}
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
          style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
        >
          <div
            className="flex items-end gap-2 rounded-xl border"
            style={{ borderColor: "#E5E7EB", background: "#FFFFFF" }}
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
                color: NEUTRAL.graphite,
                fontFamily: "inherit",
                lineHeight: "1.5",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!isConfigured || loading || !input.trim()}
              className="m-1.5 p-2 rounded-lg flex-shrink-0 transition-all active:scale-95"
              style={{
                background: !isConfigured || !input.trim() || loading ? "#F3F4F6" : RED,
                color: !isConfigured || !input.trim() || loading ? NEUTRAL.slate : "#FFFFFF",
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
