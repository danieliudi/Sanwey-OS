import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, AlertCircle, Download, RotateCcw } from "lucide-react";
import { useAI } from "../../hooks/use-ai";
import { proposalPrompt } from "../../constants/ai-prompts";
import { COMPANIES } from "../../constants/companies";

const RED = "#b5000b";
const BORDER = "#E5E7EB";
const BG = "#F1EDE8";

// Injeta um <style> temporário só com a orientação de página (retrato) —
// @page não pode ser condicionado por seletor de classe, então isso não dá
// pra resolver direto no index.css sem afetar outras impressões do app.
function printDocument() {
  const style = document.createElement("style");
  style.id = "doc-print-page-style";
  style.textContent = "@media print { @page { size: A4 portrait; margin: 2cm; } }";
  document.head.appendChild(style);
  document.body.classList.add("printing-doc");

  const cleanup = () => {
    document.body.classList.remove("printing-doc");
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  // Fallback: alguns navegadores não disparam afterprint de forma confiável.
  setTimeout(cleanup, 3000);
}

export function ProposalPanel({ lead, currentUser, allLeads }) {
  const { complete, isConfigured } = useAI(currentUser);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const generatedOnce = useRef(false);

  // Outros negócios já ganhos do mesmo cliente — vira base pra sugestão de
  // upsell/cross-sell no corpo da proposta.
  const orderHistory = useMemo(() => {
    if (!lead.clientId || !Array.isArray(allLeads)) return [];
    return allLeads.filter(l => l.clientId === lead.clientId && l.stage === "ganho" && l.id !== lead.id);
  }, [lead.clientId, lead.id, allLeads]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await complete(proposalPrompt(lead, orderHistory));
      setDraft(text);
      generatedOnce.current = true;
    } catch (err) {
      setError(err.message || "Erro ao gerar proposta.");
    } finally {
      setLoading(false);
    }
  };

  const company = COMPANIES[lead.companyId] || COMPANIES.all;
  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="space-y-3">
      <div className="rounded-xl border" style={{ background: BG, borderColor: BORDER, padding: 16 }}>
        <div className="flex items-center gap-2 mb-3">
          <Bot size={15} style={{ color: RED }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Proposta comercial
          </span>
        </div>

        {!isConfigured && (
          <div
            className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg mb-3"
            style={{ background: "#FEF3C7", color: "#92400E" }}
          >
            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Configure sua LLM nas Configurações → Integrações de IA</span>
          </div>
        )}

        {!draft ? (
          <button
            onClick={handleGenerate}
            disabled={loading || !isConfigured}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150"
            style={{
              background: !isConfigured ? "var(--surface-alt)" : RED,
              color: !isConfigured ? "var(--text-dim)" : "#FFFFFF",
              cursor: loading || !isConfigured ? "not-allowed" : "pointer",
              border: "none",
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
            {loading ? "Gerando..." : "Gerar proposta com IA"}
          </button>
        ) : (
          <div className="space-y-3">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={14}
              className="w-full text-sm rounded-lg border px-3 py-2.5 outline-none resize-vertical"
              style={{ borderColor: BORDER, background: "var(--surface)", color: "var(--text)", fontFamily: "inherit", lineHeight: 1.6 }}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150"
                style={{ background: "var(--surface)", color: "var(--text-dim)", borderColor: BORDER, cursor: "pointer" }}
              >
                <RotateCcw size={11} />
                Gerar novamente
              </button>
              <button
                onClick={() => printDocument()}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-150"
                style={{ background: RED, color: "#FFFFFF", border: "none", cursor: "pointer" }}
              >
                <Download size={11} />
                Baixar PDF
              </button>
            </div>
          </div>
        )}

        {error && (
          <div
            className="flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg mt-3"
            style={{ background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Conteúdo só visível na impressão (ver .doc-print-only em index.css) */}
      <div className="doc-print-only">
        <div style={{ fontFamily: "Georgia, serif", color: "#201a1a", padding: "24px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `3px solid ${company.primary}`, paddingBottom: 12, marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>{company.name}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{today}</div>
          </div>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4 }}>Proposta comercial para</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>{lead.company}</div>
          <div style={{ fontSize: 13, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{draft}</div>
          <div style={{ marginTop: 40, paddingTop: 12, borderTop: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF" }}>
            {company.name} · Proposta gerada em {today}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProposalPanel;
