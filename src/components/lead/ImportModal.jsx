import React, { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, X, ChevronRight, ChevronLeft, Download, Check } from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";

// ---------------------------------------------------------------------------
// CRM field definitions for column mapping
// ---------------------------------------------------------------------------
const CRM_FIELDS = [
  { id: "", label: "— Ignorar —" },
  { id: "cnpj", label: "CNPJ *" },
  { id: "company", label: "Empresa" },
  { id: "sector", label: "Setor" },
  { id: "city", label: "Cidade" },
  { id: "state", label: "Estado" },
  { id: "phone", label: "Telefone" },
  { id: "contactEmail", label: "Email" },
  { id: "value", label: "Valor (R$)" },
  { id: "owner", label: "Responsável (nome)" },
  { id: "stage", label: "Etapa do pipeline" },
  { id: "clientClassification", label: "Classificação" },
  { id: "notes", label: "Observações" },
];

// Auto-detect heuristics: maps common column names → CRM field id
const AUTO_DETECT_MAP = {
  cnpj: "cnpj",
  "cnpj/cpf": "cnpj",
  empresa: "company",
  "nome empresa": "company",
  "razão social": "company",
  "razao social": "company",
  company: "company",
  setor: "sector",
  "segmento": "sector",
  sector: "sector",
  cidade: "city",
  city: "city",
  estado: "state",
  uf: "state",
  state: "state",
  telefone: "phone",
  celular: "phone",
  fone: "phone",
  phone: "phone",
  email: "contactEmail",
  "e-mail": "contactEmail",
  "email contato": "contactEmail",
  valor: "value",
  "valor (r$)": "value",
  value: "value",
  "responsável": "owner",
  responsavel: "owner",
  "dono": "owner",
  owner: "owner",
  etapa: "stage",
  "etapa do pipeline": "stage",
  stage: "stage",
  classificação: "clientClassification",
  classificacao: "clientClassification",
  classification: "clientClassification",
  observações: "notes",
  observacoes: "notes",
  notes: "notes",
  obs: "notes",
};

const SAMPLE_CSV_HEADERS = "CNPJ,Empresa,Setor,Cidade,Estado,Telefone,Email,Valor,Responsável,Etapa,Classificação\n";

function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV_HEADERS], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-importacao.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeCNPJ(raw) {
  if (!raw) return "";
  return String(raw).replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function parseValue(raw) {
  if (!raw) return 0;
  const s = String(raw).replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Rótulo de coluna no estilo Excel (A, B, ..., Z, AA, AB, ...) — usado quando
// a planilha não tem cabeçalho nessa coluna, já que no Excel colunas são
// identificadas por letra, não por número.
function excelColumnLetter(index) {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

// Primeiro valor não vazio de uma coluna, olhando várias linhas — a linha 0
// sozinha pode estar vazia justo naquela coluna mesmo com dado mais abaixo.
function firstSample(rows, colIdx, limit = 15) {
  for (let r = 0; r < Math.min(rows.length, limit); r++) {
    const v = rows[r]?.[colIdx];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Styles helpers
// ---------------------------------------------------------------------------
const BTN_PRIMARY = {
  background: NEUTRAL.red,
  color: "#FFFFFF",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const BTN_SECONDARY = {
  background: "#FFFFFF",
  color: NEUTRAL.graphite,
  border: `1px solid #E5E7EB`,
  borderRadius: 8,
  padding: "10px 20px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const BTN_GHOST = {
  background: "transparent",
  color: NEUTRAL.slate,
  border: "1px solid transparent",
  borderRadius: 8,
  padding: "10px 20px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const LABEL_STYLE = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.15em",
  color: NEUTRAL.slate,
  display: "block",
  marginBottom: 6,
};

const SELECT_STYLE = {
  width: "100%",
  padding: "8px 12px",
  border: `1px solid #E5E7EB`,
  borderRadius: 8,
  fontSize: 13,
  color: NEUTRAL.graphite,
  background: "#FFFFFF",
  outline: "none",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ImportModal({ isOpen, onClose, users = [], currentUser, onAddLead, companies = [] }) {
  const [step, setStep] = useState(1); // 1=upload, 2=map, 3=preview
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);     // string[]
  const [rows, setRows] = useState([]);            // string[][]  (data rows, no header)
  const [parseError, setParseError] = useState(null);
  const [mapping, setMapping] = useState({});      // colIndex → crmFieldId
  const [selectedCompanyId, setSelectedCompanyId] = useState(companies[0] || COMPANY_IDS[0]);
  const [defaultOwnerId, setDefaultOwnerId] = useState(currentUser?.id || "");

  // Step 3 state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importDone, setImportDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef();

  const reset = useCallback(() => {
    setStep(1);
    setFile(null);
    setHeaders([]);
    setRows([]);
    setParseError(null);
    setMapping({});
    setSelectedCompanyId(companies[0] || COMPANY_IDS[0]);
    setDefaultOwnerId(currentUser?.id || "");
    setImporting(false);
    setImportProgress(0);
    setImportTotal(0);
    setImportDone(false);
    setImportedCount(0);
    setSkippedCount(0);
  }, [companies, currentUser]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // Parse file → headers + rows
  const parseFile = useCallback((f) => {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target.result;
        const wb = XLSX.read(buffer, { type: "array" });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        if (!data || data.length < 2) {
          setParseError("Arquivo vazio ou sem linhas de dados.");
          return;
        }

        const hdrsRaw = (data[0] || []).map(h => String(h).trim());
        const dataRowsRaw = data.slice(1).filter(r => r.some(c => String(c).trim() !== ""));

        // O Excel às vezes exporta dezenas de colunas "fantasma" vazias por
        // causa de formatação residual (!ref inflado). Cortamos tudo depois
        // da última coluna que realmente tem cabeçalho ou algum valor, senão
        // o mapeamento vira uma lista de "Coluna N" sem fim.
        let lastUsedCol = -1;
        hdrsRaw.forEach((h, i) => { if (h !== "") lastUsedCol = Math.max(lastUsedCol, i); });
        dataRowsRaw.forEach(row => {
          row.forEach((c, i) => { if (String(c).trim() !== "") lastUsedCol = Math.max(lastUsedCol, i); });
        });

        if (lastUsedCol < 0) {
          setParseError("Não foi possível identificar colunas com dados nessa planilha.");
          return;
        }

        const hdrs = hdrsRaw.slice(0, lastUsedCol + 1);
        const dataRows = dataRowsRaw.map(r => r.slice(0, lastUsedCol + 1));

        // Auto-detect mapping
        const autoMap = {};
        hdrs.forEach((h, i) => {
          const key = h.toLowerCase().trim();
          if (AUTO_DETECT_MAP[key]) {
            autoMap[i] = AUTO_DETECT_MAP[key];
          }
        });

        setHeaders(hdrs);
        setRows(dataRows);
        setMapping(autoMap);
        setFile(f);
      } catch (e) {
        setParseError(`Erro ao ler o arquivo: ${e?.message || String(e)}`);
      }
    };
    reader.onerror = () => setParseError("Não foi possível ler o arquivo.");
    reader.readAsArrayBuffer(f);
  }, []);

  const handleFileChange = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
  }, [parseFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) parseFile(f);
  }, [parseFile]);

  // Build a lead object from a data row using the current mapping
  const buildLead = useCallback((row) => {
    const get = (fieldId) => {
      const idx = Object.entries(mapping).find(([, fId]) => fId === fieldId)?.[0];
      if (idx === undefined) return "";
      return String(row[Number(idx)] ?? "").trim();
    };

    const rawOwnerName = get("owner");
    const ownerUser = rawOwnerName
      ? users.find(u => u.name?.toLowerCase().includes(rawOwnerName.toLowerCase()))
      : null;
    const ownerId = ownerUser?.id || defaultOwnerId;

    const rawStage = get("stage");
    const matchedStage = rawStage
      ? DEFAULT_PIPELINE_STAGES.find(s =>
          s.name.toLowerCase().includes(rawStage.toLowerCase()) ||
          s.id.toLowerCase() === rawStage.toLowerCase()
        )
      : null;
    const stageId = matchedStage?.id || "prospeccao";

    const cnpj = normalizeCNPJ(get("cnpj"));

    return {
      id: crypto.randomUUID(),
      companyId: selectedCompanyId,
      cnpj,
      company: get("company"),
      sector: get("sector"),
      city: get("city"),
      state: get("state"),
      phone: get("phone"),
      contactEmail: get("contactEmail"),
      value: parseValue(get("value")),
      owner: ownerId,
      stage: stageId,
      status: stageId,
      clientClassification: get("clientClassification"),
      notes: get("notes"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "import",
    };
  }, [mapping, users, defaultOwnerId, selectedCompanyId]);

  // Count already-existing CNPJs (deduplicated by CNPJ+companyId — hook does the same)
  const { newRows, existingCount } = React.useMemo(() => {
    // We can't check the CRM from here without access to all leads;
    // onAddLead handles deduplication. We just show the count.
    return { newRows: rows, existingCount: 0 };
  }, [rows]);

  const handleImport = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    setImportProgress(0);
    setImportTotal(newRows.length);
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < newRows.length; i++) {
      const lead = buildLead(newRows[i]);
      try {
        const result = await onAddLead(lead);
        // If the hook returns null/false it means it was a duplicate
        if (result === null || result === false) {
          skipped++;
        } else {
          imported++;
        }
      } catch {
        skipped++;
      }
      setImportProgress(i + 1);
    }

    setImportedCount(imported);
    setSkippedCount(skipped);
    setImportDone(true);
    setImporting(false);
  }, [importing, newRows, buildLead, onAddLead]);

  if (!isOpen) return null;

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "32px 16px",
    overflowY: "auto",
  };

  const cardStyle = {
    width: "100%",
    maxWidth: 672,
    background: "#FFFFFF",
    borderRadius: 12,
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
    marginTop: "auto",
    marginBottom: "auto",
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div style={cardStyle}>
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid #E5E7EB`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: NEUTRAL.graphite, letterSpacing: "-0.01em" }}>
              Importar planilha
            </div>
            <div style={{ fontSize: 12, color: NEUTRAL.slate, marginTop: 2 }}>
              {step === 1 && "Passo 1 de 3 — Upload do arquivo"}
              {step === 2 && "Passo 2 de 3 — Mapear colunas"}
              {step === 3 && "Passo 3 de 3 — Prévia e importação"}
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div style={{ padding: "16px 24px 0", display: "flex", gap: 8 }}>
          {[1, 2, 3].map(s => (
            <div
              key={s}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 2,
                background: s <= step ? NEUTRAL.red : "#E5E7EB",
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>

          {/* ── STEP 1: Upload ── */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <p style={{ fontSize: 14, color: NEUTRAL.slate, margin: 0 }}>
                Sobe uma planilha CSV ou Excel (.xlsx) com seus clientes, leads ou prospects.
              </p>

              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${isDragging ? NEUTRAL.red : "#E5E7EB"}`,
                  borderRadius: 10,
                  padding: "40px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: isDragging ? "#FBE9EB" : "#fff8f7",
                  transition: "all 0.15s",
                }}
              >
                <Upload size={32} color={isDragging ? NEUTRAL.red : NEUTRAL.slate} style={{ margin: "0 auto 12px" }} />
                {file ? (
                  <div>
                    <div style={{ fontWeight: 700, color: NEUTRAL.graphite, fontSize: 14 }}>{file.name}</div>
                    <div style={{ color: NEUTRAL.slate, fontSize: 13, marginTop: 4 }}>
                      {rows.length} linhas encontradas
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 600, color: NEUTRAL.graphite, fontSize: 14 }}>
                      Clique ou arraste o arquivo aqui
                    </div>
                    <div style={{ color: NEUTRAL.slate, fontSize: 12, marginTop: 4 }}>
                      Formatos suportados: CSV, XLSX, XLS
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </div>

              {parseError && (
                <div style={{ background: "#FEF2F2", color: "#B91C1C", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                  {parseError}
                </div>
              )}

              {/* Tips */}
              <div style={{ fontSize: 12, color: NEUTRAL.slate, lineHeight: 1.6 }}>
                <strong>Colunas recomendadas:</strong> CNPJ, Empresa, Setor, Cidade, Estado, Telefone, Email, Valor, Responsável, Etapa, Classificação
              </div>

              {/* Download sample */}
              <button
                onClick={(e) => { e.stopPropagation(); downloadSampleCSV(); }}
                style={{ ...BTN_GHOST, alignSelf: "flex-start", fontSize: 13, padding: "8px 14px" }}
              >
                <Download size={14} />
                Download modelo CSV
              </button>
            </div>
          )}

          {/* ── STEP 2: Map columns ── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Destination company */}
              <div>
                <label style={LABEL_STYLE}>Empresa destino *</label>
                <select
                  value={selectedCompanyId}
                  onChange={e => setSelectedCompanyId(e.target.value)}
                  style={SELECT_STYLE}
                >
                  {COMPANY_IDS.map(id => (
                    <option key={id} value={id}>{COMPANIES[id]?.name || id}</option>
                  ))}
                </select>
              </div>

              {/* Default owner */}
              <div>
                <label style={LABEL_STYLE}>Responsável padrão (para linhas sem responsável)</label>
                <select
                  value={defaultOwnerId}
                  onChange={e => setDefaultOwnerId(e.target.value)}
                  style={SELECT_STYLE}
                >
                  <option value="">— Nenhum —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {/* Column mapping table */}
              <div>
                <label style={LABEL_STYLE}>Mapear colunas</label>
                <div style={{ border: `1px solid #E5E7EB`, borderRadius: 8, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#F5F5F3" }}>
                        <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: NEUTRAL.graphite, width: "45%" }}>
                          Coluna da sua planilha
                        </th>
                        <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: NEUTRAL.graphite }}>
                          Campo do CRM
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {headers.map((h, i) => {
                        const sample = firstSample(rows, i);
                        return (
                        <tr key={i} style={{ borderTop: `1px solid #EEEEEE` }}>
                          <td style={{ padding: "8px 14px", color: NEUTRAL.graphite, verticalAlign: "middle" }}>
                            <div style={{ fontWeight: 500 }}>{h || `Coluna ${excelColumnLetter(i)}`}</div>
                            {sample !== null && (
                              <div style={{ fontSize: 11, color: NEUTRAL.slate, marginTop: 2 }}>
                                ex.: {sample.slice(0, 40)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "8px 14px", verticalAlign: "middle" }}>
                            <select
                              value={mapping[i] ?? ""}
                              onChange={e => setMapping(prev => ({ ...prev, [i]: e.target.value }))}
                              style={{ ...SELECT_STYLE, padding: "6px 10px" }}
                            >
                              {CRM_FIELDS.map(f => (
                                <option key={f.id} value={f.id}>{f.label}</option>
                              ))}
                            </select>
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

          {/* ── STEP 3: Preview + Import ── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {importDone ? (
                /* Done state */
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div
                    style={{
                      width: 56, height: 56, borderRadius: "50%",
                      background: "#ECFDF5", display: "flex", alignItems: "center",
                      justifyContent: "center", margin: "0 auto 16px",
                    }}
                  >
                    <Check size={28} color="#16A34A" />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: NEUTRAL.graphite, marginBottom: 6 }}>
                    Importação concluída!
                  </div>
                  <div style={{ fontSize: 14, color: NEUTRAL.slate }}>
                    {importedCount} leads importados com sucesso.
                    {skippedCount > 0 && ` ${skippedCount} já existiam ou foram ignorados.`}
                  </div>
                </div>
              ) : importing ? (
                /* Progress state */
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: NEUTRAL.graphite, marginBottom: 16 }}>
                    Importando {importProgress}/{importTotal}…
                  </div>
                  <div style={{ background: "#E5E7EB", borderRadius: 4, height: 8, overflow: "hidden", maxWidth: 400, margin: "0 auto" }}>
                    <div
                      style={{
                        height: "100%",
                        background: NEUTRAL.red,
                        width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%`,
                        transition: "width 0.1s",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* Preview state */
                <>
                  {/* Summary */}
                  <div
                    style={{
                      background: "#F0F9FF",
                      border: "1px solid #BAE6FD",
                      borderRadius: 8,
                      padding: "12px 16px",
                      fontSize: 13,
                      color: "#0C4A6E",
                    }}
                  >
                    <strong>{rows.length}</strong> linhas encontradas.{" "}
                    <strong>{rows.length}</strong> serão importadas para{" "}
                    <strong>{COMPANIES[selectedCompanyId]?.name || selectedCompanyId}</strong>.
                  </div>

                  {/* Preview table */}
                  <div>
                    <div style={{ ...LABEL_STYLE, marginBottom: 8 }}>
                      Prévia (primeiras {Math.min(5, rows.length)} linhas)
                    </div>
                    <div style={{ overflowX: "auto", border: `1px solid #E5E7EB`, borderRadius: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 480 }}>
                        <thead>
                          <tr style={{ background: "#F5F5F3" }}>
                            {Object.entries(mapping)
                              .filter(([, fId]) => fId !== "")
                              .map(([colIdx, fId]) => {
                                const field = CRM_FIELDS.find(f => f.id === fId);
                                return (
                                  <th
                                    key={colIdx}
                                    style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: NEUTRAL.graphite, whiteSpace: "nowrap" }}
                                  >
                                    {field?.label || fId}
                                  </th>
                                );
                              })}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, 5).map((row, ri) => (
                            <tr key={ri} style={{ borderTop: "1px solid #EEEEEE" }}>
                              {Object.entries(mapping)
                                .filter(([, fId]) => fId !== "")
                                .map(([colIdx]) => (
                                  <td
                                    key={colIdx}
                                    style={{ padding: "7px 12px", color: NEUTRAL.graphite, whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}
                                  >
                                    {String(row[Number(colIdx)] ?? "")}
                                  </td>
                                ))}
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

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: `1px solid #E5E7EB`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            background: NEUTRAL.warmWhite,
          }}
        >
          <div>
            {step > 1 && !importing && !importDone && (
              <button style={BTN_GHOST} onClick={() => setStep(s => s - 1)}>
                <ChevronLeft size={16} />
                Voltar
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {importDone ? (
              <button style={BTN_PRIMARY} onClick={handleClose}>
                <Check size={16} />
                Fechar
              </button>
            ) : step < 3 ? (
              <>
                <button style={BTN_SECONDARY} onClick={handleClose}>Cancelar</button>
                <button
                  style={{
                    ...BTN_PRIMARY,
                    opacity: (step === 1 && !file) ? 0.5 : 1,
                    cursor: (step === 1 && !file) ? "not-allowed" : "pointer",
                  }}
                  disabled={step === 1 && !file}
                  onClick={() => setStep(s => s + 1)}
                >
                  Próximo
                  <ChevronRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button style={BTN_SECONDARY} onClick={handleClose} disabled={importing}>Cancelar</button>
                <button
                  style={{ ...BTN_PRIMARY, opacity: importing ? 0.6 : 1, cursor: importing ? "not-allowed" : "pointer" }}
                  disabled={importing}
                  onClick={handleImport}
                >
                  <Upload size={16} />
                  Importar {rows.length} leads
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportModal;
