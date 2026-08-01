import React, { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, X, ChevronRight, ChevronLeft, Download, Check } from "lucide-react";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { CLIENT_CATEGORIES } from "../../constants/client-categories";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { parseCurrencyBR } from "../../utils/currency";
import { findClientByCnpj } from "../../utils/client-dedup";

// Assistente de importação DEDICADO a Clientes — não reaproveita o
// ImportModal.jsx de Leads (esse sempre cria negócio no Funil de Vendas via
// onAddLead). Achado real: o botão "Importar planilha" de Clientes estava
// ligado ao importador de leads, o que geraria uma oportunidade fantasma por
// linha só pra povoar a lista de clientes — planilha de carteira (com
// faturamento histórico, como a da Resibag) não é lista de oportunidade nova.
// Mockup aprovado com o Daniel (ver conversa) — segue exatamente o desenho:
// "empresa de origem" único por importação, código externo por empresa
// (não genérico), ano só aparece pra Faturamento/Nº de pedidos, e dedup por
// CNPJ atualiza em vez de duplicar (mesmo createClient/findClientByCnpj já
// usado no resto da plataforma).

const STATIC_FIELDS_BEFORE = [
  { id: "", label: "— Ignorar —" },
  { id: "name", label: "Nome *" },
  { id: "cnpj", label: "CNPJ" },
  { id: "category", label: "Categoria" },
  { id: "city", label: "Cidade" },
  { id: "state", label: "Estado (UF)" },
];
const STATIC_FIELDS_AFTER = [
  { id: "status", label: "Status (Ativo/Inativo)" },
  { id: "billing_total", label: "Faturamento (R$)" },
  { id: "billing_orders", label: "Nº de pedidos" },
  { id: "notes", label: "Observações" },
];
const BILLING_FIELD_IDS = new Set(["billing_total", "billing_orders"]);

function clientFields() {
  const companyFields = COMPANY_IDS.map(id => ({ id: `external_code:${id}`, label: `Código externo — ${COMPANIES[id].short}` }));
  return [...STATIC_FIELDS_BEFORE, ...companyFields, ...STATIC_FIELDS_AFTER];
}

// Cabeçalhos comuns → campo do cliente. "Categoria" (Posto/Indústria/...) e
// "Classificação" (Ativo/Inativo) são conceitos DIFERENTES no cadastro — não
// misturar, mesmo que soem parecido numa planilha de origem.
const AUTO_DETECT_MAP = {
  cnpj: "cnpj", "cnpj/cpf": "cnpj",
  cliente: "name", empresa: "name", "nome empresa": "name", "razão social": "name", "razao social": "name", nome: "name",
  categoria: "category", segmento: "category",
  cidade: "city", city: "city",
  estado: "state", uf: "state", state: "state",
  classificação: "status", classificacao: "status", status: "status",
  observações: "notes", observacoes: "notes", notes: "notes", obs: "notes",
  "kronos sw": "external_code:industria",
  "kronos rb": "external_code:resibag",
};

const SAMPLE_CSV_HEADERS = "Nome,CNPJ,Categoria,Cidade,Estado,Classificação,Observações\n";
function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV_HEADERS], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "modelo-importacao-clientes.csv"; a.click();
  URL.revokeObjectURL(url);
}

function normalizeCNPJ(raw) {
  if (!raw) return "";
  return String(raw).replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
function parseValue(raw) {
  if (!raw) return 0;
  if (typeof raw === "number") return raw;
  const { value } = parseCurrencyBR(raw);
  return value ?? 0;
}
function normalizeStatus(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (v.startsWith("inativ")) return "inativo";
  if (v.startsWith("ativ")) return "ativo";
  return "ativo";
}
function normalizeCategory(raw) {
  const v = String(raw || "").trim().toLowerCase();
  const match = CLIENT_CATEGORIES.find(c => c.value === v || c.label.toLowerCase() === v);
  return match?.value || "";
}
function extractYearFromHeader(header) {
  const m = String(header || "").match(/\b(20\d{2})\b/);
  return m ? m[1] : "";
}
function excelColumnLetter(index) {
  let n = index + 1, label = "";
  while (n > 0) { const rem = (n - 1) % 26; label = String.fromCharCode(65 + rem) + label; n = Math.floor((n - 1) / 26); }
  return label;
}
function firstSample(rows, colIdx, limit = 15) {
  for (let r = 0; r < Math.min(rows.length, limit); r++) {
    const v = rows[r]?.[colIdx];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

const BTN_PRIMARY = { background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
const BTN_SECONDARY = { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
const BTN_GHOST = { background: "transparent", color: "var(--text-dim)", border: "1px solid transparent", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
const LABEL_STYLE = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-dim)", display: "block", marginBottom: 6 };
const SELECT_STYLE = { width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text)", background: "var(--surface)", outline: "none" };

export function ClientImportModal({ isOpen, onClose, clients = [], onCreateClient, onUpdateClient, onUpsertBillingHistory }) {
  useEscToClose(onClose, isOpen);
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [mapping, setMapping] = useState({});     // colIndex → fieldId
  const [yearByCol, setYearByCol] = useState({});  // colIndex → "2023" (só pra billing_total/billing_orders)
  const [originCompany, setOriginCompany] = useState(COMPANY_IDS[0]);

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importDone, setImportDone] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [failedRows, setFailedRows] = useState([]);

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef();
  const FIELDS = clientFields();

  const reset = useCallback(() => {
    setStep(1); setFile(null); setHeaders([]); setRows([]); setParseError(null);
    setMapping({}); setYearByCol({}); setOriginCompany(COMPANY_IDS[0]);
    setImporting(false); setImportProgress(0); setImportDone(false);
    setCreatedCount(0); setUpdatedCount(0); setFailedRows([]);
  }, []);
  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const parseFile = useCallback((f) => {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target.result;
        const wb = XLSX.read(buffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (!data || data.length < 2) { setParseError("Arquivo vazio ou sem linhas de dados."); return; }

        const hdrsRaw = (data[0] || []).map(h => String(h).trim());
        const dataRowsRaw = data.slice(1).filter(r => r.some(c => String(c).trim() !== ""));

        let lastUsedCol = -1;
        hdrsRaw.forEach((h, i) => { if (h !== "") lastUsedCol = Math.max(lastUsedCol, i); });
        dataRowsRaw.forEach(row => { row.forEach((c, i) => { if (String(c).trim() !== "") lastUsedCol = Math.max(lastUsedCol, i); }); });
        if (lastUsedCol < 0) { setParseError("Não foi possível identificar colunas com dados nessa planilha."); return; }

        const hdrs = hdrsRaw.slice(0, lastUsedCol + 1);
        const dataRows = dataRowsRaw.map(r => r.slice(0, lastUsedCol + 1));

        const autoMap = {};
        const autoYear = {};
        hdrs.forEach((h, i) => {
          const key = h.toLowerCase().trim();
          if (AUTO_DETECT_MAP[key]) autoMap[i] = AUTO_DETECT_MAP[key];
          // "TOTAL 2023" → billing_total ano 2023; header com "no"/"nº" isolado
          // não carrega ano no próprio texto — fica pro usuário confirmar.
          else if (/total/.test(key) && extractYearFromHeader(h)) { autoMap[i] = "billing_total"; autoYear[i] = extractYearFromHeader(h); }
        });

        setHeaders(hdrs); setRows(dataRows); setMapping(autoMap); setYearByCol(autoYear); setFile(f);
      } catch (e) {
        setParseError(`Erro ao ler o arquivo: ${e?.message || String(e)}`);
      }
    };
    reader.onerror = () => setParseError("Não foi possível ler o arquivo.");
    reader.readAsArrayBuffer(f);
  }, []);

  const handleFileChange = useCallback((e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }, [parseFile]);
  const handleDrop = useCallback((e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); }, [parseFile]);

  const getFieldValue = useCallback((row, fieldId) => {
    const idx = Object.entries(mapping).find(([, fId]) => fId === fieldId)?.[0];
    if (idx === undefined) return "";
    return String(row[Number(idx)] ?? "").trim();
  }, [mapping]);

  // Uma linha pode ter faturamento de VÁRIOS anos mapeados (ex.: TOTAL 2023 +
  // No. do mesmo ano numa coluna vizinha, TOTAL 2024 + No. noutra) — agrupa
  // por ano antes de gravar em client_billing_history.
  const buildBillingByYear = useCallback((row) => {
    const byYear = {};
    Object.entries(mapping).forEach(([colIdx, fieldId]) => {
      if (!BILLING_FIELD_IDS.has(fieldId)) return;
      const year = Number(yearByCol[colIdx]);
      if (!year) return;
      const raw = String(row[Number(colIdx)] ?? "").trim();
      if (!raw) return;
      byYear[year] = byYear[year] || { year, totalValue: 0, orderCount: 0 };
      if (fieldId === "billing_total") byYear[year].totalValue = parseValue(raw);
      else byYear[year].orderCount = Math.round(parseValue(raw));
    });
    return Object.values(byYear);
  }, [mapping, yearByCol]);

  const buildClientPatch = useCallback((row) => {
    const externalCodes = {};
    COMPANY_IDS.forEach(id => {
      const v = getFieldValue(row, `external_code:${id}`);
      if (v) externalCodes[id] = v;
    });
    return {
      name: getFieldValue(row, "name"),
      cnpj: normalizeCNPJ(getFieldValue(row, "cnpj")),
      category: normalizeCategory(getFieldValue(row, "category")),
      city: getFieldValue(row, "city"),
      state: getFieldValue(row, "state"),
      status: normalizeStatus(getFieldValue(row, "status")),
      notes: getFieldValue(row, "notes"),
      externalCodes,
      companyIds: [originCompany],
    };
  }, [getFieldValue, originCompany]);

  const { previewCounts } = React.useMemo(() => {
    let novo = 0, atualiza = 0;
    for (const row of rows) {
      const cnpj = normalizeCNPJ(getFieldValue(row, "cnpj"));
      const dup = cnpj ? findClientByCnpj(clients, cnpj) : null;
      if (dup) atualiza++; else novo++;
    }
    return { previewCounts: { novo, atualiza } };
  }, [rows, clients, getFieldValue]);

  const handleImport = useCallback(async () => {
    if (importing) return;
    setImporting(true); setImportProgress(0);
    let created = 0, updated = 0;
    const failures = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const patch = buildClientPatch(row);
      const billing = buildBillingByYear(row);
      try {
        const cnpj = patch.cnpj;
        const existing = cnpj ? findClientByCnpj(clients, cnpj) : null;
        let clientId;
        if (existing) {
          const mergedCodes = { ...(existing.externalCodes || {}), ...patch.externalCodes };
          const mergedCompanies = Array.from(new Set([...(existing.companyIds || []), ...patch.companyIds]));
          await onUpdateClient(existing.id, {
            city: patch.city || existing.city, state: patch.state || existing.state,
            category: patch.category || existing.category, status: patch.status,
            notes: patch.notes || existing.notes, externalCodes: mergedCodes, companyIds: mergedCompanies,
          });
          clientId = existing.id;
          updated++;
        } else {
          const saved = await onCreateClient(patch);
          clientId = saved.id;
          created++;
        }
        if (billing.length > 0) await onUpsertBillingHistory(clientId, billing);
      } catch (err) {
        failures.push({ row: i + 1, name: patch.name || "(sem nome)", error: err?.message || String(err) });
      }
      setImportProgress(i + 1);
    }
    setCreatedCount(created); setUpdatedCount(updated); setFailedRows(failures); setImportDone(true); setImporting(false);
  }, [importing, rows, buildClientPatch, buildBillingByYear, clients, onCreateClient, onUpdateClient, onUpsertBillingHistory]);

  if (!isOpen) return null;

  const overlayStyle = { position: "fixed", inset: 0, zIndex: 60, background: "var(--overlay-scrim)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" };
  const cardStyle = { width: "100%", maxWidth: 720, background: "var(--surface)", borderRadius: 12, maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-pop)", marginTop: "auto", marginBottom: "auto" };

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>Importar clientes</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
              {step === 1 && "Passo 1 de 3 — Upload do arquivo"}
              {step === 2 && "Passo 2 de 3 — Empresa de origem e mapeamento"}
              {step === 3 && "Passo 3 de 3 — Prévia e importação"}
            </div>
          </div>
          <button onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ padding: "16px 24px 0", display: "flex", gap: 8 }}>
          {[1, 2, 3].map(s => <div key={s} style={{ height: 4, flex: 1, borderRadius: 2, background: s <= step ? "var(--accent)" : "var(--border)", transition: "background 0.2s" }} />)}
        </div>

        <div style={{ padding: 24 }}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <p style={{ fontSize: 14, color: "var(--text-dim)", margin: 0 }}>
                Sobe uma planilha CSV ou Excel (.xlsx) com sua carteira de clientes. Cada linha vira um cliente no cadastro — não um negócio no Funil de Vendas.
              </p>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                style={{ border: `2px dashed ${isDragging ? "var(--accent)" : "var(--border)"}`, borderRadius: 10, padding: "40px 24px", textAlign: "center", cursor: "pointer", background: isDragging ? "var(--accent-tint)" : "var(--surface-alt)", transition: "all 0.15s" }}
              >
                <Upload size={32} color={isDragging ? "var(--accent)" : "var(--text-dim)"} style={{ margin: "0 auto 12px" }} />
                {file ? (
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>{file.name}</div>
                    <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 4 }}>{rows.length} linhas encontradas</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 14 }}>Clique ou arraste o arquivo aqui</div>
                    <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 4 }}>Formatos suportados: CSV, XLSX, XLS</div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} style={{ display: "none" }} />
              </div>
              {parseError && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>{parseError}</div>}
              <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
                <strong>Colunas recomendadas:</strong> Nome, CNPJ, Categoria, Cidade, Estado, Status, Faturamento por ano, Observações
              </div>
              <button onClick={(e) => { e.stopPropagation(); downloadSampleCSV(); }} style={{ ...BTN_GHOST, alignSelf: "flex-start", fontSize: 13, padding: "8px 14px" }}>
                <Download size={14} /> Download modelo CSV
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={LABEL_STYLE}>Empresa de origem desta planilha *</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COMPANY_IDS.map(id => (
                    <button key={id} type="button" onClick={() => setOriginCompany(id)}
                      style={{
                        padding: "7px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                        border: `1px solid ${originCompany === id ? COMPANIES[id].primary : "var(--border)"}`,
                        background: originCompany === id ? COMPANIES[id].primary + "1A" : "var(--surface)",
                        color: originCompany === id ? COMPANIES[id].primary : "var(--text-dim)",
                      }}>
                      {COMPANIES[id].short}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={LABEL_STYLE}>Mapear colunas</label>
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--surface-alt)" }}>
                        <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "var(--text)", width: "38%" }}>Coluna da planilha</th>
                        <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "var(--text)" }}>Campo do cliente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {headers.map((h, i) => {
                        const sample = firstSample(rows, i);
                        const isBilling = BILLING_FIELD_IDS.has(mapping[i]);
                        return (
                          <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ padding: "8px 14px", color: "var(--text)", verticalAlign: "middle" }}>
                              <div style={{ fontWeight: 500 }}>{h || `Coluna ${excelColumnLetter(i)}`}</div>
                              {sample !== null && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>ex.: {sample.slice(0, 40)}</div>}
                            </td>
                            <td style={{ padding: "8px 14px", verticalAlign: "middle" }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <select
                                  value={mapping[i] ?? ""}
                                  onChange={e => setMapping(prev => ({ ...prev, [i]: e.target.value }))}
                                  style={{ ...SELECT_STYLE, padding: "6px 10px" }}
                                >
                                  {FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                </select>
                                {isBilling && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                                    <span style={{ fontSize: 11, color: "var(--text-faint)" }}>ano:</span>
                                    <input
                                      type="text" value={yearByCol[i] ?? ""} placeholder="2025"
                                      onChange={e => setYearByCol(prev => ({ ...prev, [i]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                                      style={{ width: 56, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12.5, background: "var(--surface)", color: "var(--text)" }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {importDone ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: failedRows.length > 0 ? "var(--danger-bg)" : "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    {failedRows.length > 0 ? <X size={28} color="var(--danger)" /> : <Check size={28} color="var(--success)" />}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
                    {failedRows.length > 0 ? "Importação concluída com falhas" : "Importação concluída!"}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-dim)" }}>
                    {createdCount} clientes criados, {updatedCount} atualizados (já existiam por CNPJ).
                    {failedRows.length > 0 && ` ${failedRows.length} falharam — não foram importados.`}
                  </div>
                  {failedRows.length > 0 && (
                    <div style={{ marginTop: 16, textAlign: "left", maxWidth: 480, marginLeft: "auto", marginRight: "auto", background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 10, padding: 12, maxHeight: 180, overflowY: "auto" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)", marginBottom: 6 }}>Linhas que falharam — corrija e importe novamente:</div>
                      {failedRows.map((f, i) => <div key={i} style={{ fontSize: 12, color: "var(--danger)", marginBottom: 4 }}>Linha {f.row} ({f.name}): {f.error}</div>)}
                    </div>
                  )}
                </div>
              ) : importing ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 16 }}>Importando {importProgress}/{rows.length}…</div>
                  <div style={{ background: "var(--border)", borderRadius: 4, height: 8, overflow: "hidden", maxWidth: 400, margin: "0 auto" }}>
                    <div style={{ height: "100%", background: "var(--accent)", width: `${rows.length > 0 ? (importProgress / rows.length) * 100 : 0}%`, transition: "width 0.1s", borderRadius: 4 }} />
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 14, background: "var(--success-bg)", border: "1px solid var(--success)", borderRadius: 8, padding: "12px 16px" }}>
                    <div style={{ fontSize: 13, color: "var(--text)" }}><strong>{rows.length}</strong> linhas na planilha</div>
                    <div style={{ fontSize: 13, color: "var(--text)" }}><strong>{previewCounts.novo}</strong> novos clientes</div>
                    <div style={{ fontSize: 13, color: "var(--text)" }}><strong>{previewCounts.atualiza}</strong> já existem por CNPJ (atualiza)</div>
                  </div>
                  <div>
                    <div style={{ ...LABEL_STYLE, marginBottom: 8 }}>Prévia (primeiras {Math.min(5, rows.length)} linhas)</div>
                    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 480 }}>
                        <thead>
                          <tr style={{ background: "var(--surface-alt)" }}>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--text)" }}>Nome</th>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--text)" }}>UF</th>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--text)" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, 5).map((row, ri) => (
                            <tr key={ri} style={{ borderTop: "1px solid var(--border)" }}>
                              <td style={{ padding: "7px 12px", color: "var(--text)" }}>{getFieldValue(row, "name") || "—"}</td>
                              <td style={{ padding: "7px 12px", color: "var(--text)" }}>{getFieldValue(row, "state") || "—"}</td>
                              <td style={{ padding: "7px 12px", color: "var(--text)" }}>{normalizeStatus(getFieldValue(row, "status"))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "var(--surface-alt)" }}>
          <div>{step > 1 && !importing && !importDone && <button style={BTN_GHOST} onClick={() => setStep(s => s - 1)}><ChevronLeft size={16} />Voltar</button>}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {importDone ? (
              <button style={BTN_PRIMARY} onClick={handleClose}><Check size={16} />Fechar</button>
            ) : step < 3 ? (
              <>
                <button style={BTN_SECONDARY} onClick={handleClose}>Cancelar</button>
                <button style={{ ...BTN_PRIMARY, opacity: (step === 1 && !file) ? 0.5 : 1, cursor: (step === 1 && !file) ? "not-allowed" : "pointer" }} disabled={step === 1 && !file} onClick={() => setStep(s => s + 1)}>
                  Próximo <ChevronRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button style={BTN_SECONDARY} onClick={handleClose} disabled={importing}>Cancelar</button>
                <button style={{ ...BTN_PRIMARY, opacity: importing ? 0.6 : 1, cursor: importing ? "not-allowed" : "pointer" }} disabled={importing} onClick={handleImport}>
                  <Upload size={16} />Importar {rows.length} clientes
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClientImportModal;
