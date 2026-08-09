import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, AlertCircle, Download, RotateCcw, Leaf } from "lucide-react";
import { useAI } from "../../hooks/use-ai";
import { proposalPrompt } from "../../constants/ai-prompts";
import { COMPANIES } from "../../constants/companies";
import { useEsgReports } from "../../hooks/use-esg-carbon";
import { formatDateBR } from "../../utils/date";

const RED = "#b5000b";
const BORDER = "#E5E7EB";
const BG = "#F1EDE8";

// Mesma convenção de arredondamento/formatação de toneladas do módulo
// ESG & Carbono (ver kgToT/fmtT em ESGCarbonoView.jsx) — não reimplementar
// diferente aqui, só com o sufixo "CO2e" pro contexto de proposta comercial.
function fmtTonnesCO2e(kg) {
  const t = (kg || 0) / 1000;
  return `${t.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t CO2e`;
}

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

  // Selo ESG Sanwey — perfil de emissões da EMPRESA VENDEDORA (lead.companyId),
  // não do negócio/lead em si (não há dado de carbono por produto/negócio;
  // decisão do spec aprovado). Relatório mais recente da própria empresa;
  // sem relatório (ex.: módulo ESG ainda não usado por essa frente, ou
  // Supabase não configurado neste ambiente) o selo simplesmente não aparece.
  const { reports: esgReports } = useEsgReports({ companyId: lead.companyId });
  const latestEsgReport = esgReports.length > 0 ? esgReports[0] : null;
  const esgTotalKg = latestEsgReport
    ? (latestEsgReport.totalsByScope?.[1] || 0) + (latestEsgReport.totalsByScope?.[2] || 0) + (latestEsgReport.totalsByScope?.[3] || 0)
    : 0;

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
            style={{ background: "var(--warning-bg)", color: "var(--warning)" }}
          >
            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Configure sua LLM nas Configurações → Integrações</span>
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
            style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {latestEsgReport && (
          <div
            className="flex items-start gap-2.5 text-xs px-3 py-2.5 rounded-lg mt-3"
            style={{ background: "var(--surface)", border: `1px solid ${company.primary}`, color: "var(--text)" }}
          >
            <Leaf size={14} style={{ color: company.primary, flexShrink: 0, marginTop: 1 }} />
            <span>
              <strong>Selo ESG Sanwey</strong> será incluído na proposta — {fmtTonnesCO2e(esgTotalKg)} apurados
              ({formatDateBR(latestEsgReport.periodStart)}–{formatDateBR(latestEsgReport.periodEnd)}), Escopos 1+2+3.
            </span>
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

          {latestEsgReport && (
            <div
              style={{
                marginTop: 32,
                padding: "16px 18px",
                border: `1.5px solid ${company.primary}`,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: company.primary, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                Selo ESG
                <br />
                Sanwey
              </div>
              <div style={{ flex: 1, borderLeft: `1px solid ${BORDER}`, paddingLeft: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
                  {fmtTonnesCO2e(esgTotalKg)} apurados · {formatDateBR(latestEsgReport.periodStart)}–{formatDateBR(latestEsgReport.periodEnd)}
                </div>
                <div style={{ fontSize: 11.5, color: "#6B7280", lineHeight: 1.5 }}>
                  Fornecedor com inventário de GEE auditável e rastreável, Escopos 1+2+3.
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 40, paddingTop: 12, borderTop: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF" }}>
            {company.name} · Proposta gerada em {today}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProposalPanel;
