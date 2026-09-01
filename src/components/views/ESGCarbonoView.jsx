import React, { useCallback, useMemo, useState } from "react";
import { Leaf, Plus, Download, Sparkles, FileText } from "lucide-react";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useEsgEmissionFactors, useEsgEmissionRecords, useEsgReports } from "../../hooks/use-esg-carbon";
import { useMarketingPurchaseRequests } from "../../hooks/use-marketing-purchase-requests";
import { Tabs } from "../shared/Tabs";
import { StatCard } from "../ui/StatCard";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { formatDateBR, toLocalISODate } from "../../utils/date";
import { csvRow, triggerDownload } from "../../utils/export-csv";

// Fase 1 do módulo ESG & Carbono — mockup aprovado 07/08/2026 (rigor de
// auditoria primeiro): fatores de emissão versionados, registros
// imutáveis, relatório como snapshot congelado. Ver src/hooks/use-esg-carbon.js
// pro schema e a regra de nunca sobrescrever um fator/registro.

const SCOPE_LABEL = { 1: "Escopo 1", 2: "Escopo 2", 3: "Escopo 3" };
const SCOPE_COLOR = { 1: "var(--scope1, #C2410C)", 2: "var(--scope2, #1D4ED8)", 3: "var(--scope3, #7C3AED)" };
const SCOPE_BG    = { 1: "#FFF7ED", 2: "#EFF6FF", 3: "#FAF5FF" };

function kgToT(kg) {
  return (kg || 0) / 1000;
}
function fmtT(kg) {
  return `${kgToT(kg).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t`;
}

function ScopePill({ scope }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: SCOPE_BG[scope], color: SCOPE_COLOR[scope] }}
    >
      {SCOPE_LABEL[scope]}
    </span>
  );
}

const REPORT_PERIODS = [
  { id: "current_month", label: "Mês atual" },
  { id: "last_month",    label: "Mês anterior" },
  { id: "last_3_months", label: "Últimos 3 meses" },
  { id: "custom",        label: "Personalizado" },
];

// Fase 2: período do relatório deixou de ser fixo em "início do mês →
// hoje" -- vira uma escolha explícita, sempre em dias fechados (YYYY-MM-DD),
// nunca hora corrente.
function computeReportPeriod(choice, customStart, customEnd) {
  const now = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  if (choice === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { periodStart: iso(start), periodEnd: iso(end) };
  }
  if (choice === "last_3_months") {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { periodStart: iso(start), periodEnd: iso(now) };
  }
  if (choice === "custom") {
    return { periodStart: customStart || iso(now), periodEnd: customEnd || iso(now) };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { periodStart: iso(start), periodEnd: iso(now) };
}

// Fase 2: gráfico de tendência mensal (últimos 12 meses), empilhado por
// escopo -- usa só os `records` já carregados, sem tabela nova. Meses sem
// nenhum registro ainda aparecem na régua (barra vazia), pra não distorcer
// o intervalo de 12 meses.
function monthlyTotals(records) {
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), totals: { 1: 0, 2: 0, 3: 0 } });
  }
  const byKey = new Map(months.map(m => [m.key, m]));
  for (const r of records) {
    const key = (r.createdAt || "").slice(0, 7);
    const bucket = byKey.get(key);
    if (bucket) bucket.totals[r.scope] = (bucket.totals[r.scope] || 0) + (r.co2eCalculated || 0);
  }
  return months;
}

// Dossiê ESG exportável (Fase 3) — mesmo mecanismo de impressão do
// ProposalPanel.jsx (Selo ESG na proposta comercial): injeta @page A4 só na
// hora de imprimir, marca body.printing-doc (index.css já sabe esconder
// tudo exceto .doc-print-only), window.print(). Duplicado aqui de propósito
// -- só a 2ª ocorrência (a 1ª é ProposalPanel.jsx); regra 4 do CLAUDE.md só
// manda extrair pra shared/ na 3ª.
function printDossie() {
  const style = document.createElement("style");
  style.id = "esg-dossie-print-page-style";
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
  setTimeout(cleanup, 3000);
}

function TrendChart({ records }) {
  const months = useMemo(() => monthlyTotals(records), [records]);
  const maxTotal = Math.max(1, ...months.map(m => m.totals[1] + m.totals[2] + m.totals[3]));
  const hasAny = months.some(m => m.totals[1] + m.totals[2] + m.totals[3] > 0);
  if (!hasAny) return null;
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>CO2e por mês</h3>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-dim)" }}>
          {[1, 2, 3].map(s => (
            <span key={s} className="inline-flex items-center gap-1">
              <span className="inline-block rounded-sm" style={{ width: 8, height: 8, background: SCOPE_COLOR[s] }} />
              {SCOPE_LABEL[s]}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 110 }}>
        {months.map(m => {
          const total = m.totals[1] + m.totals[2] + m.totals[3];
          const h = Math.max(total > 0 ? 4 : 0, (total / maxTotal) * 100);
          return (
            <div key={m.key} className="flex-1 flex flex-col justify-end" style={{ height: "100%" }} title={`${m.label}: ${fmtT(total)}`}>
              <div className="w-full rounded-sm overflow-hidden flex flex-col-reverse" style={{ height: `${h}%`, minHeight: total > 0 ? 3 : 0 }}>
                <div style={{ height: `${total > 0 ? (m.totals[1] / total) * 100 : 0}%`, background: SCOPE_COLOR[1] }} />
                <div style={{ height: `${total > 0 ? (m.totals[2] / total) * 100 : 0}%`, background: SCOPE_COLOR[2] }} />
                <div style={{ height: `${total > 0 ? (m.totals[3] / total) * 100 : 0}%`, background: SCOPE_COLOR[3] }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {months.map(m => (
          <div key={m.key} className="flex-1 text-center text-[9px]" style={{ color: "var(--text-faint)" }}>{m.label}</div>
        ))}
      </div>
    </div>
  );
}

export function ESGCarbonoView({ currentUser }) {
  const [tab, setTab] = useState("overview");
  const [activeCompany, setActiveCompany] = useState("all");

  const { factors, loading: loadingFactors, createFactor, activeFactorFor } = useEsgEmissionFactors();
  const { records, loading: loadingRecords, createRecords } = useEsgEmissionRecords({ companyId: activeCompany });
  const { reports, generateReport } = useEsgReports({ companyId: activeCompany });
  const { purchases } = useMarketingPurchaseRequests({ enabled: tab === "overview" });

  const totalsByScope = useMemo(() => {
    const totals = { 1: 0, 2: 0, 3: 0 };
    for (const r of records) totals[r.scope] = (totals[r.scope] || 0) + (r.co2eCalculated || 0);
    return totals;
  }, [records]);
  const totalKg = totalsByScope[1] + totalsByScope[2] + totalsByScope[3];

  const factorLabelById = useMemo(() => {
    const map = new Map();
    for (const f of factors) map.set(f.id, `${f.category} · ${f.source}`);
    return map;
  }, [factors]);

  // Escopo 3 a partir de Compras (spend-based) — soma o valor total das
  // solicitações pagas no período que ainda não geraram registro (marcadas
  // via source_type="compras" + source_id). Um cálculo simples, roda sob
  // demanda (nunca automático em background) pra quem gerou o registro
  // ficar registrado com created_by.
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState(null);
  const handleCalcularEscopo3 = useCallback(async () => {
    setCalcError(null);
    const factor = activeFactorFor("Compras gerais — spend-based", 3);
    if (!factor) { setCalcError("Nenhum fator vigente para \"Compras gerais — spend-based\" (Escopo 3). Cadastre um em Fatores de Emissão."); return; }
    const alreadyCovered = new Set(records.filter(r => r.sourceType === "compras").map(r => r.sourceId));
    const eligible = purchases.filter(p =>
      p.stage === "pago" && p.totalValue > 0 && !alreadyCovered.has(p.id) &&
      (activeCompany === "all" || (p.companyIds || []).includes(activeCompany))
    );
    if (eligible.length === 0) { setCalcError("Nenhuma solicitação de compra paga e ainda não computada no período/empresa selecionados."); return; }
    setCalculating(true);
    try {
      const toCreate = eligible.map(p => ({
        // Empresa gravada tem que bater com o escopo usado na checagem de
        // duplicata acima (alreadyCovered) -- senão a mesma compra volta a
        // aparecer como "não coberta" da próxima vez que essa empresa for
        // selecionada e é reinserida a cada clique.
        companyId: activeCompany !== "all" ? activeCompany : ((p.companyIds || [])[0] || activeCompany),
        scope: 3,
        sourceType: "compras",
        sourceId: p.id,
        activityData: p.totalValue,
        activityUnit: "R$",
        emissionFactorId: factor.id,
        co2eCalculated: p.totalValue * factor.factorValue,
        createdBy: currentUser?.id,
      }));
      await createRecords(toCreate);
    } catch (e) {
      setCalcError(e.message || String(e));
    } finally {
      setCalculating(false);
    }
  }, [activeFactorFor, records, purchases, activeCompany, createRecords, currentUser]);

  const handleExportCSV = useCallback(() => {
    const header = ["Origem", "Escopo", "Dado de atividade", "Unidade", "Fator usado", "CO2e (kg)"];
    const rows = records.map(r => [
      r.sourceType,
      SCOPE_LABEL[r.scope],
      r.activityData,
      r.activityUnit,
      factorLabelById.get(r.emissionFactorId) || "",
      r.co2eCalculated,
    ]);
    const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
    triggerDownload(`sanwey-esg-carbono-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [records, factorLabelById]);

  const [generating, setGenerating] = useState(false);
  const [reportPeriodChoice, setReportPeriodChoice] = useState("current_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const handleGerarRelatorio = useCallback(async () => {
    setGenerating(true);
    try {
      const { periodStart, periodEnd } = computeReportPeriod(reportPeriodChoice, customStart, customEnd);
      // O snapshot tem que refletir só o período do relatório -- `records` é
      // a lista inteira já carregada (todo o histórico da empresa
      // selecionada), não o recorte do mês. Sem esse filtro, o relatório
      // "congelado" nascia com o total errado (histórico completo em vez do
      // período declarado em period_start/period_end).
      const periodRecords = records.filter(r => {
        const day = (r.createdAt || "").slice(0, 10);
        return day >= periodStart && day <= periodEnd;
      });
      const periodTotals = { 1: 0, 2: 0, 3: 0 };
      for (const r of periodRecords) periodTotals[r.scope] = (periodTotals[r.scope] || 0) + (r.co2eCalculated || 0);
      await generateReport({
        companyId: activeCompany,
        periodStart,
        periodEnd,
        totalsByScope: periodTotals,
        recordIds: periodRecords.map(r => r.id),
        generatedBy: currentUser?.id,
      });
    } finally {
      setGenerating(false);
    }
  }, [generateReport, activeCompany, records, currentUser, reportPeriodChoice, customStart, customEnd]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Leaf size={22} style={{ color: "var(--text)" }} />
            <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
              ESG &amp; Carbono
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>
            Inventário de GEE por escopo — fator de emissão travado por registro, pronto pra auditoria.
          </p>
        </div>
        <select
          value={activeCompany}
          onChange={e => setActiveCompany(e.target.value)}
          className="text-xs rounded-lg border px-3 py-2 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        >
          <option value="all">Todas as empresas</option>
          {COMPANY_IDS.map(id => <option key={id} value={id}>{COMPANIES[id]?.name || id}</option>)}
        </select>
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Visão Geral" },
          { id: "lancamentos", label: "Lançamentos" },
          { id: "fatores", label: "Fatores de Emissão" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {!isSupabaseConfigured ? (
        <EmptyState icon={Leaf} title="Supabase não configurado" description="Configure as variáveis de ambiente para usar este módulo." />
      ) : <>
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border" style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}>
                <Download size={13} /> Exportar CSV
              </button>
              <button onClick={handleCalcularEscopo3} disabled={calculating} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border" style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)", opacity: calculating ? 0.6 : 1 }}>
                <Sparkles size={13} /> {calculating ? "Calculando…" : "Calcular Escopo 3 (Compras)"}
              </button>
              <select
                value={reportPeriodChoice}
                onChange={e => setReportPeriodChoice(e.target.value)}
                className="text-xs rounded-lg border px-2.5 py-1.5 outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                title="Período do relatório"
              >
                {REPORT_PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              {reportPeriodChoice === "custom" && (
                <>
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-xs rounded-lg border px-2 py-1.5 outline-none" style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }} />
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>até</span>
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs rounded-lg border px-2 py-1.5 outline-none" style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }} />
                </>
              )}
              <Button size="sm" onClick={handleGerarRelatorio} disabled={generating || records.length === 0}>
                {generating ? "Gerando…" : "Gerar relatório (snapshot)"}
              </Button>
              {reports.length > 0 && (
                <button onClick={printDossie} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border" style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}>
                  <FileText size={13} /> Dossiê ESG (PDF)
                </button>
              )}
            </div>
          </div>
          {calcError && (
            <div className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{calcError}</div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Leaf} value={fmtT(totalKg)} label="Total CO2e" />
            <StatCard icon={Leaf} value={fmtT(totalsByScope[1])} label="Escopo 1" valueColor={SCOPE_COLOR[1]} />
            <StatCard icon={Leaf} value={fmtT(totalsByScope[2])} label="Escopo 2" valueColor={SCOPE_COLOR[2]} />
            <StatCard icon={Leaf} value={fmtT(totalsByScope[3])} label="Escopo 3" valueColor={SCOPE_COLOR[3]} />
          </div>

          <TrendChart records={records} />

          {reports.length > 0 && (
            <div className="text-xs" style={{ color: "var(--text-dim)" }}>
              Último relatório gerado: {formatDateBR(reports[0].generatedAt)} — {reports[0].recordIds.length} registro{reports[0].recordIds.length !== 1 ? "s" : ""}
            </div>
          )}

          {loadingRecords ? (
            <div className="text-sm" style={{ color: "var(--text-dim)" }}>Carregando…</div>
          ) : (
            // Achado do Daniel (12/08/2026): sem registro nenhum, a tabela
            // inteira (cabeçalhos incluídos) sumia atrás de um EmptyState —
            // parecia bug. Cabeçalhos ficam sempre visíveis; só o corpo
            // mostra a mensagem quando vazio.
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "var(--surface-alt)" }}>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>Origem</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>Escopo</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>Dado de atividade</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>Fator usado</th>
                    <th className="text-right px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>CO2e</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center" style={{ color: "var(--text-dim)" }}>
                        Nenhum registro de emissão ainda — lance o consumo de combustível/energia em Lançamentos, ou calcule o Escopo 3 a partir de Compras.
                      </td>
                    </tr>
                  ) : records.slice(0, 30).map(r => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2" style={{ color: "var(--text)" }}>{r.sourceType === "compras" ? "Compra" : "Lançamento manual"} · {formatDateBR(r.createdAt)}</td>
                      <td className="px-3 py-2"><ScopePill scope={r.scope} /></td>
                      <td className="px-3 py-2 tabular-nums" style={{ color: "var(--text)" }}>{Number(r.activityData).toLocaleString("pt-BR")} {r.activityUnit}</td>
                      <td className="px-3 py-2" style={{ color: "var(--text-dim)" }}>{factorLabelById.get(r.emissionFactorId) || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: "var(--text)" }}>{fmtT(r.co2eCalculated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "lancamentos" && (
        <LancamentosTab
          activeCompany={activeCompany}
          activeFactorFor={activeFactorFor}
          createRecords={createRecords}
          records={records}
          loadingRecords={loadingRecords}
          factorLabelById={factorLabelById}
          currentUser={currentUser}
        />
      )}

      {tab === "fatores" && (
        <FatoresTab factors={factors} loading={loadingFactors} createFactor={createFactor} currentUser={currentUser} />
      )}
      </>}

      {/* Dossiê ESG (Fase 3) — só o relatório mais recente já gerado (snapshot
          congelado), nunca os `records` ao vivo: é o mesmo princípio de
          auditoria da Fase 1 -- o dossiê tem que refletir exatamente o que
          "Gerar relatório" produziu, não um número que muda se alguém lançar
          um novo registro depois de gerado. Conteúdo só visível na impressão
          (.doc-print-only em index.css, mesmo mecanismo do Selo ESG em
          ProposalPanel.jsx). */}
      {reports.length > 0 && (
        <div className="doc-print-only">
          <div style={{ fontFamily: "Georgia, serif", color: "#201a1a", padding: "24px 8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid #16A34A", paddingBottom: 12, marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>
                {activeCompany !== "all" ? (COMPANIES[activeCompany]?.name || activeCompany) : "Grupo Sanwey"}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateBR(reports[0].generatedAt)}</div>
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4 }}>Dossiê ESG &amp; Carbono</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
              Inventário de emissões de GEE — {formatDateBR(reports[0].periodStart)} a {formatDateBR(reports[0].periodEnd)}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 20 }}>
              {reports[0].recordIds.length} registro{reports[0].recordIds.length !== 1 ? "s" : ""} · fator de emissão travado por registro na data do lançamento
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 24 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 0", borderBottom: "1px solid #E5E7EB", color: "#6B7280", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em" }}>Escopo</th>
                  <th style={{ textAlign: "right", padding: "6px 0", borderBottom: "1px solid #E5E7EB", color: "#6B7280", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em" }}>CO2e</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map(s => (
                  <tr key={s}>
                    <td style={{ padding: "7px 0", borderBottom: "1px solid #F3F4F6" }}>{SCOPE_LABEL[s]}</td>
                    <td style={{ padding: "7px 0", borderBottom: "1px solid #F3F4F6", textAlign: "right", fontWeight: 600 }}>{fmtT(reports[0].totalsByScope?.[s] || 0)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: "9px 0", fontWeight: 700 }}>Total</td>
                  <td style={{ padding: "9px 0", textAlign: "right", fontWeight: 700 }}>
                    {fmtT((reports[0].totalsByScope?.[1] || 0) + (reports[0].totalsByScope?.[2] || 0) + (reports[0].totalsByScope?.[3] || 0))}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ fontSize: 12, lineHeight: 1.6, color: "#374151" }}>
              Metodologia: cada registro de emissão trava o fator vigente na data do lançamento — atualizações
              posteriores no fator não alteram registros já gravados. Fatores utilizados neste dossiê:
              {" "}{[...new Set(factors.filter(f => reports[0].recordIds?.length && factorLabelById.get(f.id)).map(f => factorLabelById.get(f.id)))].join(", ") || "—"}.
            </div>

            <div style={{ marginTop: 40, paddingTop: 12, borderTop: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF" }}>
              {activeCompany !== "all" ? (COMPANIES[activeCompany]?.name || activeCompany) : "Grupo Sanwey"} · Dossiê gerado a partir do relatório de {formatDateBR(reports[0].generatedAt)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aba: Lançamentos (Escopo 1/2 manual) ─────────────────────────────────

function LancamentosTab({ activeCompany, activeFactorFor, createRecords, records, loadingRecords, factorLabelById, currentUser }) {
  const [company, setCompany] = useState(activeCompany !== "all" ? activeCompany : COMPANY_IDS[0]);
  const [combustivel, setCombustivel] = useState("");
  const [energia, setEnergia] = useState("");
  const [gas, setGas] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const manualRecords = useMemo(() => records.filter(r => r.sourceType === "manual"), [records]);

  const handleSalvar = useCallback(async () => {
    setSaveError(null);
    const toCreate = [];
    if (Number(combustivel) > 0) {
      const f = activeFactorFor("Diesel S10 — frota", 1);
      if (!f) { setSaveError("Sem fator vigente para \"Diesel S10 — frota\"."); return; }
      toCreate.push({ companyId: company, scope: 1, sourceType: "manual", activityData: Number(combustivel), activityUnit: "L", emissionFactorId: f.id, co2eCalculated: Number(combustivel) * f.factorValue, createdBy: currentUser?.id });
    }
    if (Number(energia) > 0) {
      const f = activeFactorFor("Energia elétrica (SIN)", 2);
      if (!f) { setSaveError("Sem fator vigente para \"Energia elétrica (SIN)\"."); return; }
      toCreate.push({ companyId: company, scope: 2, sourceType: "manual", activityData: Number(energia), activityUnit: "kWh", emissionFactorId: f.id, co2eCalculated: Number(energia) * f.factorValue, createdBy: currentUser?.id });
    }
    if (Number(gas) > 0) {
      const f = activeFactorFor("Gás refrigerante R-410A — recarga", 1);
      if (!f) { setSaveError("Sem fator vigente para \"Gás refrigerante R-410A — recarga\"."); return; }
      toCreate.push({ companyId: company, scope: 1, sourceType: "manual", activityData: Number(gas), activityUnit: "kg", emissionFactorId: f.id, co2eCalculated: Number(gas) * f.gwp, createdBy: currentUser?.id });
    }
    if (toCreate.length === 0) { setSaveError("Preencha ao menos um consumo antes de salvar."); return; }
    setSaving(true);
    try {
      await createRecords(toCreate);
      setCombustivel(""); setEnergia(""); setGas("");
    } catch (e) {
      setSaveError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }, [company, combustivel, energia, gas, activeFactorFor, createRecords, currentUser]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>Lançamento do mês</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>Empresa</label>
            <select value={company} onChange={e => setCompany(e.target.value)} className="w-full text-xs rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}>
              {COMPANY_IDS.map(id => <option key={id} value={id}>{COMPANIES[id]?.name || id}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>Combustível — frota (L)</label>
            <input type="number" min="0" value={combustivel} onChange={e => setCombustivel(e.target.value)} placeholder="0" className="w-full text-xs rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>Energia elétrica (kWh)</label>
            <input type="number" min="0" value={energia} onChange={e => setEnergia(e.target.value)} placeholder="0" className="w-full text-xs rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>Gás refrigerante — recarga (kg)</label>
            <input type="number" min="0" value={gas} onChange={e => setGas(e.target.value)} placeholder="0" className="w-full text-xs rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }} />
          </div>
        </div>
        {saveError && <div className="text-xs mb-2" style={{ color: "var(--danger)" }}>{saveError}</div>}
        <Button size="sm" onClick={handleSalvar} disabled={saving}>{saving ? "Salvando…" : "Salvar lançamento"}</Button>
      </div>

      <div>
        <h3 className="text-sm font-bold mb-2" style={{ color: "var(--text)" }}>Histórico</h3>
        {loadingRecords ? (
          <div className="text-sm" style={{ color: "var(--text-dim)" }}>Carregando…</div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--surface-alt)" }}>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>Data</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>Escopo</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>Consumo</th>
                  <th className="text-right px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>CO2e</th>
                </tr>
              </thead>
              <tbody>
                {manualRecords.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center" style={{ color: "var(--text-faint)" }}>Nenhum lançamento manual ainda.</td>
                  </tr>
                ) : manualRecords.slice(0, 20).map(r => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-3 py-2" style={{ color: "var(--text)" }}>{formatDateBR(r.createdAt)}</td>
                    <td className="px-3 py-2"><ScopePill scope={r.scope} /></td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: "var(--text)" }}>{Number(r.activityData).toLocaleString("pt-BR")} {r.activityUnit}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: "var(--text)" }}>{fmtT(r.co2eCalculated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Aba: Fatores de Emissão (admin) ──────────────────────────────────────

function NovoFatorModal({ open, onClose, onSave, currentUser }) {
  const [category, setCategory] = useState("");
  const [scope, setScope] = useState(1);
  const [unit, setUnit] = useState("");
  const [factorValue, setFactorValue] = useState("");
  const [gwp, setGwp] = useState("1");
  const [source, setSource] = useState("");
  const [validFrom, setValidFrom] = useState(toLocalISODate(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!category || !unit || !factorValue || !source || !validFrom) { setError("Preencha todos os campos."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ category, scope: Number(scope), unit, factorValue: Number(factorValue), gwp: Number(gwp) || 1, source, validFrom, createdBy: currentUser?.id });
      onClose();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo fator de emissão">
      <div className="p-5 space-y-3">
        <div className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
          Se já existir um fator vigente com a mesma categoria/escopo, ele é encerrado
          automaticamente na data de início desta nova vigência — nunca sobrescrito.
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>Categoria</label>
          <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex.: Diesel S10 — frota" className="w-full text-xs rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>Escopo</label>
            <select value={scope} onChange={e => setScope(e.target.value)} className="w-full text-xs rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}>
              <option value={1}>Escopo 1</option>
              <option value={2}>Escopo 2</option>
              <option value={3}>Escopo 3</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>Unidade</label>
            <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="L, kWh, kg, R$…" className="w-full text-xs rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>Fator (kgCO2e/unidade)</label>
            <input type="number" step="any" value={factorValue} onChange={e => setFactorValue(e.target.value)} className="w-full text-xs rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>GWP</label>
            <input type="number" step="any" value={gwp} onChange={e => setGwp(e.target.value)} className="w-full text-xs rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }} />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>Fonte</label>
          <input value={source} onChange={e => setSource(e.target.value)} placeholder="MCTI, PBGHG, IPCC, Defra…" className="w-full text-xs rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }} />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>Vigente a partir de</label>
          <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="w-full text-xs rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }} />
        </div>
        {error && <div className="text-xs" style={{ color: "var(--danger)" }}>{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="text-xs font-semibold px-3 py-2 rounded-lg border" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>Cancelar</button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : "Salvar fator"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function FatoresTab({ factors, loading, createFactor, currentUser }) {
  const [modalOpen, setModalOpen] = useState(false);
  const sorted = useMemo(() => [...factors].sort((a, b) => a.category.localeCompare(b.category) || b.validFrom.localeCompare(a.validFrom)), [factors]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: "var(--text-dim)" }}>{factors.length} fator{factors.length !== 1 ? "es" : ""} cadastrado{factors.length !== 1 ? "s" : ""}</div>
        <Button size="sm" icon={Plus} onClick={() => setModalOpen(true)}>Novo fator</Button>
      </div>
      {loading ? (
        <div className="text-sm" style={{ color: "var(--text-dim)" }}>Carregando…</div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "var(--surface-alt)" }}>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>Categoria</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>Escopo</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>Unidade</th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>Fator</th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>GWP</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>Fonte</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-faint)" }}>Vigência</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(f => (
                <tr key={f.id} style={{ borderTop: "1px solid var(--border)", opacity: f.validTo ? 0.55 : 1 }}>
                  <td className="px-3 py-2 font-medium" style={{ color: "var(--text)" }}>{f.category}</td>
                  <td className="px-3 py-2"><ScopePill scope={f.scope} /></td>
                  <td className="px-3 py-2" style={{ color: "var(--text-dim)" }}>{f.unit}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--text)" }}>{f.factorValue}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: f.gwp !== 1 ? "var(--text)" : "var(--text-faint)", fontWeight: f.gwp !== 1 ? 700 : 400 }}>{f.gwp}</td>
                  <td className="px-3 py-2" style={{ color: "var(--text-dim)" }}>{f.source}</td>
                  <td className="px-3 py-2">
                    {f.validTo ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--surface-alt)", color: "var(--text-faint)", border: "1px solid var(--border)" }}>
                        Encerrado · {formatDateBR(f.validTo)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                        Vigente · desde {formatDateBR(f.validFrom)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NovoFatorModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={createFactor} currentUser={currentUser} />
    </div>
  );
}

export default ESGCarbonoView;
