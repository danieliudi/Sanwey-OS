import React, { useCallback, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Upload, AlertTriangle, Check, X, ChevronDown, ChevronUp,
  Users, Building2, Loader2, CheckCircle2, TriangleAlert, RefreshCw,
} from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { findClientByCnpj } from "../../utils/client-dedup";
import { computeFitScore } from "../../utils/pipeline-metrics";
const uuidv4 = () => crypto.randomUUID();

// ── Column detection helpers ─────────────────────────────────────────────────

const SWAPCARD_COLUMNS = {
  firstName:    ["first name", "nome", "first_name"],
  lastName:     ["last name", "sobrenome", "last_name"],
  jobTitle:     ["job title", "cargo", "função"],
  company:      ["company", "empresa", "organização"],
  email:        ["email", "e-mail"],
  mobilePhone:  ["mobile phone", "celular", "telefone celular"],
  city:         ["city", "cidade"],
  state:        ["state", "estado"],
  cnpj:         ["cnpj (pt_br)", "cnpj"],
  cargoType:    ["quais são os tipos de carga", "tipos de carga"],
  companySize:  ["qual o porte da sua empresa", "porte"],
  sector:       ["qual a área de atuação", "setor", "área de atuação"],
  buyerRole:    ["qual é o seu papel no processo de compras", "papel no processo"],
  level:        ["qual sua posição/nível", "nível hierárquico"],
  exhibitor:    ["exhibitor member", "membro expositor"],
  note:         ["note", "observações e comentários", "obs"],
  scoring:      ["scoring", "score"],
  connectionDate: ["first connection date", "connection date", "data de conexão"],
};

function detectColumn(headers, candidates) {
  const normalized = headers.map(h => (h || "").toLowerCase().trim());
  for (const c of candidates) {
    const idx = normalized.findIndex(h => h.includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

function buildColumnMap(headers) {
  const map = {};
  for (const [key, candidates] of Object.entries(SWAPCARD_COLUMNS)) {
    const idx = detectColumn(headers, candidates);
    if (idx !== -1) map[key] = idx;
  }
  return map;
}

// ── Seller name → user matching ──────────────────────────────────────────────

function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

function matchExhibitorToUser(exhibitorName, users) {
  if (!exhibitorName || !users?.length) return null;
  const exNorm = normalizeName(exhibitorName);
  const exTokens = exNorm.split(/\s+/).filter(Boolean);

  let bestUser = null;
  let bestScore = 0;

  for (const u of users) {
    const uNorm = normalizeName(u.name);
    const uTokens = uNorm.split(/\s+/).filter(Boolean);
    const matches = exTokens.filter(t => uTokens.includes(t)).length;
    const score = matches / Math.max(exTokens.length, uTokens.length);
    if (score > bestScore) { bestScore = score; bestUser = u; }
  }

  return bestScore >= 0.4 ? bestUser : null;
}

// ── Company auto-assignment ──────────────────────────────────────────────────

const RESIBAG_SELLERS = ["leonardo braga"];

function autoCompanyId(matchedUser) {
  if (!matchedUser) return "industria";
  const name = normalizeName(matchedUser.name);
  if (RESIBAG_SELLERS.some(n => name.includes(n))) return "resibag";
  // Use user's companies[0] if set
  if (matchedUser.companies?.includes("resibag")) return "resibag";
  return matchedUser.companies?.[0] || "industria";
}

// ── Internal Sanwey emails (filter out) ──────────────────────────────────────
const INTERNAL_DOMAINS = ["sanwey.com.br"];
function isInternal(email) {
  if (!email) return false;
  const domain = (email || "").split("@")[1]?.toLowerCase() || "";
  return INTERNAL_DOMAINS.some(d => domain.includes(d));
}

// ── Size normalization ───────────────────────────────────────────────────────
function normalizeSize(raw) {
  if (raw == null || raw === "") return null;
  // XLSX pode entregar número/Date — converter para string antes de lower.
  const r = String(raw).toLowerCase();
  if (r.includes("grande")) return "Grande";
  if (r.includes("média") || r.includes("media")) return "Média";
  if (r.includes("pequena") || r.includes("micro")) return "Pequena";
  if (r.includes("startup")) return "Startup";
  return raw;
}

// ── Parse XLSX ───────────────────────────────────────────────────────────────

function parseXLSX(buffer, users) {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  // Prefer "Contacts" sheet; fallback to first
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().startsWith("contacts") && !n.toLowerCase().includes("dup"))
    || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  if (!rawData?.length) return [];
  const headers = rawData[0].map(h => String(h || ""));
  const colMap = buildColumnMap(headers);
  const dataRows = rawData.slice(1);

  return dataRows
    .map((row, i) => {
      const get = (key) => {
        const idx = colMap[key];
        return idx !== undefined ? (row[idx] ?? null) : null;
      };

      const firstName = (get("firstName") || "").toString().trim();
      const lastName  = (get("lastName")  || "").toString().trim();
      const email     = (get("email")     || "").toString().trim().toLowerCase();
      const exhibitor = (get("exhibitor") || "").toString().trim();
      const company   = (get("company")   || "").toString().trim();

      // Skip empty rows and internal Sanwey staff
      if (!firstName && !company) return null;
      if (isInternal(email)) return null;
      // Skip rows where the person IS the exhibitor (self-scan)
      if (email && exhibitor && normalizeName(firstName + " " + lastName).includes(normalizeName(exhibitor).split(" ")[0])) return null;

      const matchedUser = matchExhibitorToUser(exhibitor, users);
      const companyId   = autoCompanyId(matchedUser);

      const cnpj = (get("cnpj") || "").toString().replace(/\D/g, "");

      const row = {
        _importId: `import-${i}-${Date.now()}`,
        // CRM fields
        id: uuidv4(),
        company: company || `${firstName} ${lastName}`.trim(),
        cnpj: cnpj || null,
        contactEmail: email || null,
        phone: (get("mobilePhone") || "").toString().trim() || null,
        city: (get("city") || "").toString().trim() || null,
        state: (get("state") || "").toString().replace(/^BR-/, "").trim() || null,
        size: normalizeSize(get("companySize")),
        sector: (get("sector") || "").toString().trim() || null,
        decisionMaker: {
          name: `${firstName} ${lastName}`.trim() || "—",
          role: (get("jobTitle") || get("cargoType") || "—").toString().trim(),
        },
        // Fair-specific
        trigger: "feira",
        stage: "prospeccao",
        status: "prospeccao",
        fitScore: 0,
        value: 0,
        probability: 0.1,
        quantity: 0,
        unitPrice: 0,
        dateDetected: new Date().toISOString().split("T")[0],
        daysAgo: 0,
        starred: false,
        notes: [],
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        // UI state (not persisted)
        _exhibitor: exhibitor || "—",
        _cargoType: (get("cargoType") || "").toString().trim(),
        _note: (get("note") || "").toString().trim(),
        _scoring: (get("scoring") || "").toString().trim(),
        // Assignable
        owner: matchedUser?.id || null,
        companyId,
        // Validation
        _isDuplicate: false,
        _selected: true,
        _matchedUserName: matchedUser?.name || null,
      };
      row.fitScore = computeFitScore(row);
      return row;
    })
    .filter(Boolean);
}

// ── Company options ──────────────────────────────────────────────────────────
const COMPANY_OPTIONS = [
  { value: "industria", label: "Sanwey" },
  { value: "resibag",   label: "Resibag" },
];

// ── Main component ────────────────────────────────────────────────────────────
export function FairImportView({ addLead, leads: existingLeads, users, currentUser, campaigns = [], clients = [], state, setState }) {
  const fileRef = useRef(null);
  // Persistent across tab switches — held in App.jsx
  const { fairName, fairCampaignId = "", phase, rows, importResult, importing } = state;
  const setFairName    = (v) => setState(s => ({ ...s, fairName: typeof v === "function" ? v(s.fairName) : v }));
  const setFairCampaignId = (v) => setState(s => ({ ...s, fairCampaignId: typeof v === "function" ? v(s.fairCampaignId) : v }));

  // Feira = campanha de canal "Evento" (o modelo que a plataforma já usa —
  // é o mesmo canal que dispara o checklist de evento). Antes o nome da feira
  // era texto livre digitado a cada importação, então "Intermodal 2026" e
  // "intermodal 26" viravam feiras diferentes na hora de agregar. Agora a
  // seleção grava `campaignId`, que é a chave estável do relatório de feiras.
  const eventCampaigns = useMemo(
    () => (campaigns || []).filter(c => c.channel === "Evento"),
    [campaigns]
  );
  const selectedCampaign = eventCampaigns.find(c => c.id === fairCampaignId) || null;
  // `triggerLabel` continua sendo gravado (o export CSV e telas antigas leem
  // esse campo) — só que derivado do nome da campanha, não mais digitado.
  const effectiveFairName = selectedCampaign ? selectedCampaign.name : fairName.trim();
  const setPhase       = (v) => setState(s => ({ ...s, phase: typeof v === "function" ? v(s.phase) : v }));
  const setRows        = (v) => setState(s => ({ ...s, rows: typeof v === "function" ? v(s.rows) : v }));
  const setImportResult = (v) => setState(s => ({ ...s, importResult: typeof v === "function" ? v(s.importResult) : v }));
  const setImporting   = (v) => setState(s => ({ ...s, importing: typeof v === "function" ? v(s.importing) : v }));
  // Ephemeral UI state — fine to reset on remount
  const [expandedRow, setExpandedRow] = useState(null);

  // Build seller options for dropdown
  const sellerOptions = useMemo(() => [
    { value: "", label: "Sem responsável" },
    ...users
      .filter(u => u.role === "vendedor" || u.role === "gerente")
      .map(u => ({ value: u.id, label: u.name })),
  ], [users]);

  // Mark duplicates against existing leads
  function markDuplicates(parsed) {
    const existing = new Set(
      existingLeads
        .filter(l => l.cnpj)
        .map(l => `${l.cnpj.replace(/\D/g, "")}-${l.companyId}`)
    );
    return parsed.map(r => ({
      ...r,
      _isDuplicate: Boolean(r.cnpj && existing.has(`${r.cnpj}-${r.companyId}`)),
      _selected: r._isDuplicate ? false : r._selected,
    }));
  }

  const handleFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target.result;
      const parsed = parseXLSX(new Uint8Array(buffer), users);
      const withDups = markDuplicates(parsed);
      setRows(withDups);
      setPhase("preview");
    };
    reader.readAsArrayBuffer(file);
  }, [users, existingLeads]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const updateRow = (importId, patch) => {
    setRows(prev => prev.map(r => r._importId === importId ? { ...r, ...patch } : r));
  };

  const toggleSelect = (importId) => {
    setRows(prev => prev.map(r => r._importId === importId ? { ...r, _selected: !r._selected } : r));
  };

  // ── Vínculo com o cadastro central de clientes (FASE 3 / buraco 4) ────────
  // O lead de feira nascia sem `clientId`, então nunca aparecia na linha do
  // tempo do cliente — justamente a origem que o Daniel quer medir.
  //
  // Casamos por CNPJ contra `clients` usando o MESMO utilitário que a dedupe
  // de cliente já usa em todo caminho de criação (`findClientByCnpj`, que
  // normaliza os dígitos e exige os 14 completos) — não uma segunda regra de
  // matching escrita aqui.
  //
  // Quando não há cliente correspondente, o lead entra SEM vínculo e a tela
  // diz quantos ficaram assim. Deliberadamente NÃO criamos cliente
  // automaticamente: a coluna CNPJ é opcional nos exports de feira, e boa
  // parte das linhas vem sem ela — sem CNPJ a dedupe não protege nada, e
  // "Transportes ABC" e "Transportes ABC Ltda" da mesma feira virariam dois
  // cadastros. Lista de feira também é contato cru (crachá escaneado), não
  // cliente qualificado. Vincular depois é barato e seguro: o
  // LeadDetailDrawer já tem ClientSelector + mini-cadastro com checagem de
  // duplicata.
  const clientIdByRow = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const match = findClientByCnpj(clients, r.cnpj);
      if (match) map.set(r._importId, match.id);
    }
    return map;
  }, [rows, clients]);

  const selectedRows = rows.filter(r => r._selected && !r._isDuplicate);
  const dupCount = rows.filter(r => r._isDuplicate).length;
  const unassignedCount = selectedRows.filter(r => !r.owner).length;
  const linkedClientCount = selectedRows.filter(r => clientIdByRow.has(r._importId)).length;
  const noClientCount = selectedRows.length - linkedClientCount;

  const handleImport = async () => {
    if (!selectedRows.length) return;
    if (!effectiveFairName) { alert("Selecione a feira antes de importar."); return; }

    setImporting(true);
    setPhase("importing");

    const results = { ok: 0, skipped: 0, errors: [] };

    for (const row of selectedRows) {
      try {
        const lead = {
          ...row,
          // null quando nenhum cliente casou por CNPJ — ver nota em
          // `clientIdByRow`. Vínculo manual depois, sem cadastro duplicado.
          clientId: clientIdByRow.get(row._importId) || null,
          triggerLabel: effectiveFairName,
          campaignId: selectedCampaign ? selectedCampaign.id : null,
          evidence: `Contato realizado na ${effectiveFairName}`,
          notes: row._note ? [{ text: row._note, author: "Import", ts: new Date().toISOString() }] : [],
        };
        // Remove UI-only fields
        delete lead._importId;
        delete lead._exhibitor;
        delete lead._cargoType;
        delete lead._note;
        delete lead._scoring;
        delete lead._isDuplicate;
        delete lead._selected;
        delete lead._matchedUserName;

        await addLead(lead);
        results.ok++;
      } catch (err) {
        results.errors.push({ company: row.company, err: err.message });
        results.skipped++;
      }
    }

    setImportResult(results);
    setPhase("done");
    setImporting(false);
  };

  const reset = () => {
    setPhase("idle");
    setRows([]);
    setImportResult(null);
    // Sem limpar a feira selecionada, "Importar outra lista" deixava a feira
    // anterior escolhida e o botão já habilitado — dava pra subir a lista da
    // feira B dentro da feira A com um clique.
    setFairCampaignId("");
    setFairName("");
    setExpandedRow(null);
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────

  if (phase === "done") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <CheckCircle2 size={56} color="var(--success)" />
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            Import concluído
          </div>
          <div className="text-base mt-1" style={{ color: "var(--text-dim)" }}>
            {importResult.ok} leads importados para "{effectiveFairName}"
            {importResult.skipped > 0 && ` · ${importResult.skipped} erros`}
          </div>
        </div>
        {importResult.errors.length > 0 && (
          <div className="p-4 rounded-xl border text-sm max-w-md w-full" style={{ background: "var(--danger-bg)", borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)" }}>
            <div className="font-semibold mb-2" style={{ color: "var(--danger)" }}>Erros:</div>
            {importResult.errors.map((e, i) => (
              <div key={i} style={{ color: "var(--danger)" }}>{e.company}: {e.err}</div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="primary" onClick={reset}>Novo import</Button>
          <Button variant="ghost" onClick={reset}>Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            Importar Leads de Feira
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            Sobe a planilha exportada do app da feira (Swapcard, RD Station Events, etc.) para distribuição de leads.
          </p>
        </div>
        <a
          href="/template-leads-feira.csv"
          download="template-leads-feira.csv"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", textDecoration: "none" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
        >
          <Upload size={13} style={{ transform: "rotate(180deg)" }} />
          Baixar modelo .csv
        </a>
      </div>

      {/* Format instructions */}
      <div
        className="p-4 rounded-xl border text-xs leading-relaxed"
        style={{ background: "var(--warning-bg)", borderColor: "color-mix(in srgb, var(--warning) 35%, transparent)", color: "var(--warning)" }}
      >
        <div className="font-semibold mb-1.5">Colunas esperadas (Swapcard / RD Station Events)</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ color: "var(--warning)" }}>
          <span>✓ First Name / Last Name</span>
          <span>✓ Company / Email</span>
          <span>✓ Job Title / Mobile Phone</span>
          <span>✓ City / State / CNPJ</span>
          <span>✓ Porte da empresa / Área de atuação</span>
          <span>✓ Exhibitor Member (para atribuição ao vendedor)</span>
        </div>
        <div className="mt-1.5" style={{ color: "var(--warning)" }}>
          Formatos aceitos: <strong>.xlsx</strong> e <strong>.csv</strong> · Máx. 5 MB · Use o modelo acima como referência.
        </div>
      </div>

      {/* Fair name + file upload — always visible */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
            style={{ color: "var(--text-dim)", letterSpacing: "0.15em" }}>
            Feira
          </label>
          {eventCampaigns.length > 0 ? (
            <>
              <Select
                value={fairCampaignId}
                onChange={e => setFairCampaignId(e.target.value)}
                className="w-full"
              >
                <option value="">Selecione a feira…</option>
                {eventCampaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <p className="mt-1.5" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                A feira é a campanha de canal “Evento”. É ela que amarra custo e
                leads no relatório — não está na lista? Cadastre em Marketing →
                Campanhas.
              </p>
            </>
          ) : (
            <div className="rounded-xl border px-3 py-2.5"
              style={{ borderColor: "var(--warning)", background: "var(--warning-bg)" }}>
              <p style={{ fontSize: 12, color: "var(--text)", fontWeight: 600 }}>
                Nenhuma feira cadastrada
              </p>
              <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                Cadastre a feira como campanha de canal “Evento” em Marketing →
                Campanhas antes de importar. Sem isso os leads entram sem
                origem e ficam de fora do relatório de feiras.
              </p>
            </div>
          )}
        </div>

        {phase === "idle" && (
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
              style={{ color: "var(--text-dim)", letterSpacing: "0.15em" }}>
              Planilha (.xlsx)
            </label>
            <div
              className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors"
              style={{ borderColor: "var(--border-strong)", background: "var(--surface-alt)" }}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={24} style={{ color: "var(--text-dim)" }} />
              <span className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>
                Arraste o arquivo ou clique para selecionar
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
          </div>
        )}

        {phase !== "idle" && (
          <div className="flex items-end">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-colors"
              style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <RefreshCw size={14} />Trocar arquivo
            </button>
          </div>
        )}
      </div>

      {/* Stats bar */}
      {phase !== "idle" && (
        <div className="flex flex-wrap gap-4 p-4 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <Stat label="Total parseado" value={rows.length} />
          <Stat label="Selecionados" value={selectedRows.length} color="var(--color-resibag)" />
          <Stat label="Duplicados" value={dupCount} color={dupCount > 0 ? "var(--amber)" : undefined} />
          <Stat label="Sem responsável" value={unassignedCount} color={unassignedCount > 0 ? "var(--amber)" : undefined} />
          <Stat label="Cliente vinculado" value={linkedClientCount} color={linkedClientCount > 0 ? "var(--color-resibag)" : undefined} />
        </div>
      )}

      {/* Preview table */}
      {phase === "preview" && rows.length > 0 && (
        <>
          {unassignedCount > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl border-l-4 text-sm"
              style={{ background: "var(--amber-bg)", borderLeftColor: "var(--amber)", color: "var(--text)" }}>
              <TriangleAlert size={14} style={{ color: "var(--amber)", flexShrink: 0 }} />
              {unassignedCount} lead{unassignedCount > 1 ? "s" : ""} sem vendedor atribuído — defina antes de importar ou deixe para o gerente redistribuir depois.
            </div>
          )}

          {/* Vínculo com o cadastro de clientes. Informativo, não bloqueia a
              importação — por isso token neutro, não --amber/--danger: quem
              importa não tem como resolver isso aqui (o cliente pode
              simplesmente ainda não existir), e nenhum cadastro é criado
              automaticamente pra evitar cliente duplicado. */}
          {noClientCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl border-l-4 text-sm"
              style={{ background: "var(--surface-alt)", borderLeftColor: "var(--border-strong)", color: "var(--text)" }}>
              <Building2 size={14} style={{ color: "var(--text-dim)", flexShrink: 0, marginTop: 2 }} />
              <span>
                {noClientCount} de {selectedRows.length} lead{selectedRows.length > 1 ? "s" : ""} ficará{noClientCount > 1 ? "o" : ""} sem
                cliente vinculado (CNPJ ausente ou ainda não cadastrado) — não vão aparecer no histórico do
                cliente até alguém vincular pelo negócio. Nenhum cliente novo é criado automaticamente, pra
                não duplicar cadastro.
              </span>
            </div>
          )}

          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {/* Horizontal scroll instead of clipping selects on narrow screens */}
            <div className="overflow-x-auto">
              {/* Table header */}
              <div className="grid text-[10px] uppercase font-bold tracking-widest px-3 py-2 border-b min-w-[584px]"
                style={{ gridTemplateColumns: "32px 1fr 120px 140px 160px 100px 32px", background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-dim)", letterSpacing: "0.12em" }}>
                <span></span>
                <span>Empresa / Contato</span>
                <span>Cidade/UF</span>
                <span>Empresa CRM</span>
                <span>Vendedor</span>
                <span>Capturado por</span>
                <span></span>
              </div>

              {/* Rows */}
              <div className="divide-y min-w-[584px]" style={{ divideColor: "#EFEFEF" }}>
                {rows.map(row => (
                  <ImportRow
                    key={row._importId}
                    row={row}
                    sellerOptions={sellerOptions}
                    companyOptions={COMPANY_OPTIONS}
                    expanded={expandedRow === row._importId}
                    onToggleExpand={() => setExpandedRow(expandedRow === row._importId ? null : row._importId)}
                    onToggleSelect={() => toggleSelect(row._importId)}
                    onUpdate={(patch) => updateRow(row._importId, patch)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Import CTA */}
          <div className="flex items-center justify-between p-4 rounded-xl border sticky bottom-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-pop)" }}>
            <div className="text-sm" style={{ color: "var(--text-dim)" }}>
              <span className="font-semibold" style={{ color: "var(--text)" }}>{selectedRows.length} leads</span> serão adicionados ao pipeline em <strong>Prospecção</strong>
            </div>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={!selectedRows.length || !effectiveFairName || importing}
              icon={importing ? Loader2 : undefined}
            >
              {importing ? "Importando…" : `Importar ${selectedRows.length} leads`}
            </Button>
          </div>
        </>
      )}

      {phase === "importing" && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={40} className="animate-spin" style={{ color: "var(--text-dim)" }} />
          <div className="text-sm" style={{ color: "var(--text-dim)" }}>Importando leads…</div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, value, color }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "var(--text-dim)", letterSpacing: "0.12em" }}>{label}</span>
      <span className="text-2xl font-bold" style={{ color: color || "var(--text)" }}>{value}</span>
    </div>
  );
}

function ImportRow({ row, sellerOptions, companyOptions, expanded, onToggleExpand, onToggleSelect, onUpdate }) {
  const company = COMPANIES[row.companyId];
  const isDup = row._isDuplicate;

  return (
    <div style={{ opacity: isDup ? 0.5 : 1 }}>
      <div
        className="grid items-center px-3 py-2.5 transition-colors"
        style={{ gridTemplateColumns: "32px 1fr 120px 140px 160px 100px 32px" }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        {/* Checkbox */}
        <button
          onClick={onToggleSelect}
          disabled={isDup}
          className="w-5 h-5 rounded border flex items-center justify-center transition-colors"
          style={{
            borderColor: row._selected ? company?.primary || "var(--accent)" : "#DCDCDC",
            background: row._selected ? company?.primary || "var(--accent)" : "#FFFFFF",
          }}
        >
          {row._selected && <Check size={10} color="#FFFFFF" />}
        </button>

        {/* Company / contact */}
        <div className="min-w-0 pr-2">
          <div className="font-semibold text-xs truncate" style={{ color: "var(--text)" }}>
            {row.company}
            {isDup && (
              <span className="ml-2 text-[9px] font-normal px-1.5 py-0.5 rounded"
                style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>
                duplicado
              </span>
            )}
          </div>
          <div className="text-[11px] truncate" style={{ color: "var(--text-dim)" }}>
            {row.decisionMaker?.name !== "—" ? row.decisionMaker.name : row.contactEmail || "—"}
            {row.decisionMaker?.role && row.decisionMaker.role !== "—" && ` · ${row.decisionMaker.role}`}
          </div>
        </div>

        {/* City/state */}
        <div className="text-xs" style={{ color: "var(--text-dim)" }}>
          {[row.city, row.state].filter(Boolean).join("/") || "—"}
        </div>

        {/* Company CRM */}
        <div onClick={e => e.stopPropagation()}>
          <select
            value={row.companyId}
            onChange={e => onUpdate({ companyId: e.target.value })}
            disabled={isDup || !row._selected}
            className="text-xs rounded-xl border px-2 py-1 w-full"
            style={{ borderColor: "#DCDCDC", color: "var(--text)", background: "var(--surface)" }}
          >
            {companyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Vendedor */}
        <div onClick={e => e.stopPropagation()}>
          <select
            value={row.owner || ""}
            onChange={e => onUpdate({ owner: e.target.value || null })}
            disabled={isDup || !row._selected}
            className="text-xs rounded-xl border px-2 py-1 w-full"
            style={{
              borderColor: !row.owner && row._selected ? "var(--amber)" : "#DCDCDC",
              color: "var(--text)",
              background: "var(--surface)",
            }}
          >
            {sellerOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Exhibitor */}
        <div className="text-[11px] truncate" style={{ color: "var(--text-dim)" }}>
          {row._exhibitor !== "—" ? row._exhibitor : "—"}
          {row._matchedUserName && (
            <span className="block text-[9px]" style={{ color: "var(--color-resibag)" }}>
              ↳ {row._matchedUserName}
            </span>
          )}
        </div>

        {/* Expand */}
        <button
          onClick={onToggleExpand}
          className="p-1 rounded transition-colors"
          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          {expanded ? <ChevronUp size={14} style={{ color: "var(--text-dim)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-dim)" }} />}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-10 pb-3 pt-1 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border-t"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <DetailField label="CNPJ" value={row.cnpj || "—"} />
          <DetailField label="Email" value={row.contactEmail || "—"} />
          <DetailField label="Telefone" value={row.phone || "—"} />
          <DetailField label="Porte" value={row.size || "—"} />
          <DetailField label="Setor" value={row.sector || "—"} />
          <DetailField label="Tipo de carga" value={row._cargoType || "—"} />
          {row._note && (
            <div className="col-span-2">
              <DetailField label="Observação" value={row._note} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest font-bold mb-0.5"
        style={{ color: "var(--text-dim)", letterSpacing: "0.12em" }}>{label}</div>
      <div style={{ color: "var(--text)" }}>{value}</div>
    </div>
  );
}

export default FairImportView;
