import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, AlertCircle, Download, RotateCcw, Leaf, Plus, Trash2 } from "lucide-react";
import { useAI } from "../../hooks/use-ai";
import { proposalPrompt } from "../../constants/ai-prompts";
import { COMPANIES } from "../../constants/companies";
import { useEsgReports } from "../../hooks/use-esg-carbon";
import { useProposals } from "../../hooks/use-proposals";
import { SANBAG_MODELS } from "../../data/sanbag-models";
import { CurrencyInput } from "../ui/CurrencyInput";
import { formatDateBR } from "../../utils/date";
// formatBRL já vem com "R$ " embutido — nunca concatenar outro na frente.
import { formatBRL } from "../../utils/currency";

// Antes hardcoded (#b5000b/#E5E7EB/#F1EDE8) — cor própria, nem o vermelho da
// marca nem dark-mode aware; painel ficava claro fixo mesmo no escuro
// (achado do PR #103, 03/08/2026 — reaplicado aqui porque o arquivo mudou
// desde então). Só cobre a parte INTERATIVA do painel — o bloco impresso
// abaixo (.doc-print-only) usa PRINT_BORDER, fixo de propósito: o PDF
// gerado tem que parecer igual não importa o tema do usuário que gerou.
const RED = "var(--accent)";
const BORDER = "var(--border)";
const BG = "var(--surface-alt)";
const PRINT_BORDER = "#E5E7EB";

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

function newLineItem() {
  return { id: crypto.randomUUID(), modelLabel: "", quantity: 1, unitPrice: 0, certificationNote: "" };
}

export function ProposalPanel({ lead, currentUser, allLeads, onAddActivity }) {
  const { complete, isConfigured } = useAI(currentUser);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const generatedOnce = useRef(false);
  const initializedFromProposalRef = useRef(false);

  // CPQ Fase 1 (19/08/2026) — tabela editável de linha de item acima do
  // botão "Gerar", persistida em proposals/proposal_line_items (nunca um
  // jsonb solto — ver use-proposals.js). Modelo é texto livre OU escolhido
  // da lista canônica (datalist) — Fase 1 não tem preço-base, o vendedor
  // digita o preço unitário.
  const [lineItems, setLineItems] = useState([]);
  const { proposal, lineItems: persistedLineItems, loading: proposalsLoading, persist } = useProposals(lead.id, lead.companyId);

  // Retoma o rascunho salvo (texto + linhas) na primeira vez que a proposta
  // persistida carrega — só uma vez, pra não sobrescrever edição em curso do
  // vendedor caso o hook refaça fetch por outro motivo.
  useEffect(() => {
    if (initializedFromProposalRef.current || proposalsLoading) return;
    initializedFromProposalRef.current = true;
    if (proposal?.ai_draft_text) {
      setDraft(proposal.ai_draft_text);
      generatedOnce.current = true;
    }
    if (persistedLineItems.length > 0) {
      setLineItems(persistedLineItems.map(it => ({
        id: it.id,
        modelLabel: it.model_label,
        quantity: it.quantity,
        unitPrice: it.unit_price,
        certificationNote: it.certification_note || "",
      })));
    }
  }, [proposalsLoading, proposal, persistedLineItems]);

  const addLineItem = () => setLineItems(prev => [...prev, newLineItem()]);
  const updateLineItem = (id, patch) => setLineItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  const removeLineItem = (id) => setLineItems(prev => prev.filter(it => it.id !== id));
  const lineItemsTotal = useMemo(
    () => lineItems.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0),
    [lineItems]
  );

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
      const text = await complete(proposalPrompt(lead, orderHistory, lineItems));
      const isFirstGeneration = !generatedOnce.current;
      setDraft(text);
      generatedOnce.current = true;

      // Persiste texto + linhas — best-effort: se falhar (RLS, rede), o
      // draft já está na tela e o "Baixar PDF" continua funcionando, só se
      // perde o "retomar depois" (mesmo espírito do resto do arquivo, nada
      // aqui pode travar a UI por causa do Supabase).
      try {
        await persist({ draftText: text, items: lineItems, createdBy: currentUser?.id || null });
      } catch (persistErr) {
        setError(persistErr.message || "Proposta gerada, mas não foi possível salvar o rascunho.");
      }

      // FASE 3 — buraco "proposta gerada não é registrada". "Gerada", nunca
      // "enviada": o documento é montado aqui na tela e o envio ao cliente é
      // manual (PDF impresso/anexado por fora) — a plataforma não tem como
      // saber que saiu. Só o 1º "Gerar" de cada abertura do drawer vira
      // activity; "Gerar novamente" é iteração no texto da MESMA proposta e
      // encheria a linha do tempo de ruído. Fire-and-forget (sem await), pelo
      // mesmo motivo do resto do arquivo: nada aqui pode segurar a UI.
      if (isFirstGeneration && onAddActivity) {
        const hasLineItems = lineItems.length > 0;
        const value = hasLineItems ? lineItemsTotal : Number(lead.value);
        onAddActivity(lead.id, {
          type: "proposal_generated",
          userId: currentUser?.id || null,
          userName: currentUser?.name || null,
          body: Number.isFinite(value) && value > 0
            ? `Proposta gerada — negócio em ${formatBRL(value)}`
            : "Proposta gerada",
          meta: {
            leadValue: Number.isFinite(value) ? value : null,
            skuName: lead.skuName || null,
            companyId: lead.companyId || null,
            lineItemsTotal: hasLineItems ? lineItemsTotal : null,
            itemCount: hasLineItems ? lineItems.length : null,
          },
        });
      }
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

        <datalist id="sanbag-models-datalist">
          {SANBAG_MODELS.map(m => <option key={m.label} value={m.label} />)}
        </datalist>

        <div className="mb-3">
          {lineItems.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {lineItems.map(item => (
                <div key={item.id} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    list="sanbag-models-datalist"
                    value={item.modelLabel}
                    onChange={e => updateLineItem(item.id, { modelLabel: e.target.value })}
                    placeholder="Modelo (ex.: Lacrado)"
                    className="text-xs rounded-lg border px-2 py-1.5 outline-none"
                    style={{ borderColor: BORDER, background: "var(--surface)", color: "var(--text)", flex: "1 1 40%", minWidth: 0 }}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity}
                    onChange={e => updateLineItem(item.id, { quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                    placeholder="Qtd"
                    className="text-xs rounded-lg border px-2 py-1.5 outline-none"
                    style={{ borderColor: BORDER, background: "var(--surface)", color: "var(--text)", width: 56 }}
                  />
                  <div style={{ width: 110 }}>
                    <CurrencyInput
                      value={item.unitPrice}
                      onChange={v => updateLineItem(item.id, { unitPrice: v === "" ? 0 : v })}
                      style={{ borderColor: BORDER, background: "var(--surface)", color: "var(--text)", borderRadius: 8, borderWidth: 1, borderStyle: "solid", fontSize: 12, padding: "6px 8px" }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-right" style={{ color: "var(--text)", width: 88, flexShrink: 0 }}>
                    {formatBRL((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                  </span>
                  <button
                    onClick={() => removeLineItem(item.id)}
                    aria-label="Remover item"
                    title="Remover item"
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-bg)"; e.currentTarget.style.color = "var(--danger)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-end gap-2 pt-1.5 mt-1" style={{ borderTop: `1px solid ${BORDER}` }}>
                <span className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>Total</span>
                <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{formatBRL(lineItemsTotal)}</span>
              </div>
            </div>
          )}
          <button
            data-tour="proposal-line-items"
            onClick={addLineItem}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-all duration-150"
            style={{ background: "var(--surface)", color: "var(--text-dim)", borderColor: BORDER, cursor: "pointer" }}
          >
            <Plus size={11} /> Adicionar item
          </button>
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

          {lineItems.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24, fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: `1.5px solid ${company.primary}` }}>
                  <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: 700 }}>Modelo</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 700 }}>Qtd.</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 700 }}>Preço unit.</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 700 }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map(item => (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${PRINT_BORDER}` }}>
                    <td style={{ padding: "6px 4px" }}>{item.modelLabel || "—"}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>{Number(item.quantity) || 0}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatBRL(Number(item.unitPrice) || 0)}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 600 }}>
                      {formatBRL((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>Total</td>
                  <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{formatBRL(lineItemsTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}

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
              <div style={{ flex: 1, borderLeft: `1px solid ${PRINT_BORDER}`, paddingLeft: 14 }}>
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
