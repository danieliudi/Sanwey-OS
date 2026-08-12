import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Download,
  Upload,
  FileSpreadsheet,
  MapPin,
  Wallet,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useCRMViagens } from "../../hooks/use-crm-viagens";
import { useCRMDespesas } from "../../hooks/use-crm-despesas";
import { csvRow, triggerDownload, formatBRNumber, formatDate } from "../../utils/export-csv";
import { logExport } from "../../utils/log-export";
import { COMERCIAL_ROLES, monthKeyOf, monthLabel, fmtMoney, STATUS_VISITA, STATUS_REEMBOLSO, computeViagemDivergencias, todayISO } from "../../utils/viagens";

const CATEGORIA_COLORS = ["#7C3AED", "#2563EB", "#DB2777", "#D97706", "#059669", "#DC2626", "#0891B2", "#65A30D"];

// Colunas esperadas no import em lote — nessa ordem por posição, ou
// identificadas pelo nome do cabeçalho (as duas formas são aceitas).
const IMPORT_COLS = ["destino_planejado", "data_planejada", "objetivo", "cliente_nome"];
const MAX_IMPORT_MB = 5;
const IMPORT_EXTENSIONS = [".csv", ".xlsx", ".xls"];

// ── Helpers de data/valor ────────────────────────────────────────────────────

function pad(n) {
  return String(n).padStart(2, "0");
}

function monthLabelShort(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

// Últimos 6 meses até o mês atual (usado como período padrão dos filtros).
function defaultRange() {
  const now = new Date();
  const toMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const fromMonth = `${from.getFullYear()}-${pad(from.getMonth() + 1)}`;
  return { fromMonth, toMonth };
}

function monthRangeList(fromMonth, toMonth) {
  if (!fromMonth || !toMonth || fromMonth > toMonth) return [];
  const [fy, fm] = fromMonth.split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  const result = [];
  let y = fy;
  let m = fm;
  let guard = 0;
  while ((y < ty || (y === ty && m <= tm)) && guard < 240) {
    result.push(`${y}-${pad(m)}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    guard++;
  }
  return result;
}

// Excel guarda datas como serial numérico (dias desde 1899-12-30); 25569 é o
// deslocamento pra época Unix — mesma conversão que o SheetJS usa internamente.
function excelSerialToISO(serial) {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Aceita Date (célula formatada como data no Excel), serial numérico, ou
// texto em AAAA-MM-DD / DD/MM/AAAA — cobre os formatos mais comuns de planilha.
function parseDateCell(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value === "number") return excelSerialToISO(value);
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return null;
}

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
}

// Aceita as colunas por nome de cabeçalho (em qualquer ordem) ou, se não
// reconhecer os nomes, por posição — desde que sejam exatamente 4 colunas.
function resolveColumnMapping(headerRow) {
  const normalized = (headerRow || []).map(normalizeHeader);
  const byName = {};
  let matched = 0;
  IMPORT_COLS.forEach((col) => {
    const idx = normalized.findIndex((h) => h === col);
    if (idx >= 0) { byName[col] = idx; matched++; }
  });
  if (matched === IMPORT_COLS.length) return byName;
  if ((headerRow || []).length === IMPORT_COLS.length) {
    return { destino_planejado: 0, data_planejada: 1, objetivo: 2, cliente_nome: 3 };
  }
  return null;
}

// ── Estilos compartilhados ───────────────────────────────────────────────────

const cardSt = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 };

const sectionHeaderSt = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 };

const inputSt = {
  borderColor: "var(--border)",
  color: "var(--text)",
  background: "var(--surface-alt)",
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid var(--border)",
  padding: "6px 10px",
};

const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };

const errorBannerSt = { background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginTop: 10 };

function btnStyle(kind, disabled) {
  const base = { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, border: "none", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1 };
  if (kind === "primary") return { ...base, background: "var(--accent)", color: "var(--on-accent)" };
  return { ...base, background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border)" };
}

// ── Subcomponentes ───────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ padding: "32px 16px", gap: 8 }}>
      <Icon size={26} style={{ color: "var(--text-faint)" }} />
      <div style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>{text}</div>
    </div>
  );
}

function KpiTile({ label, value, color }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", background: "var(--surface)" }}>
      <div style={{ fontSize: 21, fontWeight: 800, color: color || "var(--text)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── View principal ───────────────────────────────────────────────────────────

export function CRMViagensRelatoriosView({ currentUser, users }) {
  const { registros, loading: loadingRegistros, createRegistro } = useCRMViagens({ userId: currentUser?.id });
  const { despesas, loading: loadingDespesas } = useCRMDespesas({ userId: currentUser?.id });

  const initialRange = defaultRange();
  const [fromMonth, setFromMonth] = useState(initialRange.fromMonth);
  const [toMonth, setToMonth] = useState(initialRange.toMonth);
  const [selectedVendedorId, setSelectedVendedorId] = useState("todos");

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const vendedoresComerciais = useMemo(
    () => (users || []).filter((u) => (u.roles?.length ? u.roles : [u.role]).some(r => COMERCIAL_ROLES.has(r))),
    [users]
  );

  const nomePorId = useMemo(() => {
    const map = new Map();
    (users || []).forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const registrosFiltrados = useMemo(() => {
    return (registros || []).filter((r) => {
      const mk = monthKeyOf(r.mes_referencia);
      if (!mk || mk < fromMonth || mk > toMonth) return false;
      if (selectedVendedorId !== "todos" && r.vendedor_id !== selectedVendedorId) return false;
      return true;
    });
  }, [registros, fromMonth, toMonth, selectedVendedorId]);

  const despesasFiltradas = useMemo(() => {
    return (despesas || []).filter((d) => {
      const mk = monthKeyOf(d.mes_referencia);
      if (!mk || mk < fromMonth || mk > toMonth) return false;
      if (selectedVendedorId !== "todos" && d.vendedor_id !== selectedVendedorId) return false;
      return true;
    });
  }, [despesas, fromMonth, toMonth, selectedVendedorId]);

  const kpis = useMemo(() => {
    const naoCancelados = registrosFiltrados.filter((r) => r.status !== "cancelado");
    const realizados = naoCancelados.filter((r) => r.status === "realizado");
    const pctCumprido = naoCancelados.length > 0 ? Math.round((realizados.length / naoCancelados.length) * 100) : null;
    const totalAprovado = despesasFiltradas
      .filter((d) => d.status_reembolso === "aprovado" || d.status_reembolso === "pago")
      .reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
    const totalPendente = despesasFiltradas
      .filter((d) => d.status_reembolso === "pendente")
      .reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
    return { pctCumprido, totalAprovado, totalPendente, visitasRealizadas: realizados.length };
  }, [registrosFiltrados, despesasFiltradas]);

  // Camada de divergência (mesma regra de CRMViagensGestorView, ver
  // computeViagemDivergencias em utils/viagens.js) — pedido do gerente
  // comercial: relatório pronto pra levar à diretoria, não só cumprimento
  // do planejado.
  const divergencias = useMemo(
    () => computeViagemDivergencias(registrosFiltrados, despesasFiltradas, todayISO()),
    [registrosFiltrados, despesasFiltradas]
  );

  const divergenciaKpis = useMemo(() => ({
    semVisita: divergencias.filter((d) => d.tipo === "sem_visita").length,
    sumiu: divergencias.filter((d) => d.tipo === "sumiu").length,
    totalEstourado: divergencias
      .filter((d) => d.tipo === "estouro")
      .reduce((sum, d) => sum + (d.valorExcedente || 0), 0),
  }), [divergencias]);

  const cumprimentoPorVendedor = useMemo(() => {
    if (selectedVendedorId !== "todos") return [];
    const map = new Map();
    registrosFiltrados.forEach((r) => {
      if (r.status === "cancelado") return;
      const cur = map.get(r.vendedor_id) || { planejado: 0, realizado: 0 };
      cur.planejado += 1;
      if (r.status === "realizado") cur.realizado += 1;
      map.set(r.vendedor_id, cur);
    });
    return Array.from(map.entries())
      .map(([vendedorId, v]) => ({ name: nomePorId.get(vendedorId) || "—", planejado: v.planejado, realizado: v.realizado }))
      .sort((a, b) => b.planejado - a.planejado);
  }, [registrosFiltrados, selectedVendedorId, nomePorId]);

  const despesasPorCategoria = useMemo(() => {
    const map = new Map();
    despesasFiltradas.forEach((d) => {
      const cat = d.categoria || "Outros";
      map.set(cat, (map.get(cat) || 0) + (Number(d.valor) || 0));
    });
    return Array.from(map.entries())
      .map(([categoria, valor], i) => ({ name: categoria, value: valor, fill: CATEGORIA_COLORS[i % CATEGORIA_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [despesasFiltradas]);

  const tendenciaMensal = useMemo(() => {
    return monthRangeList(fromMonth, toMonth).map((mk) => {
      const despesasMes = despesasFiltradas.filter((d) => monthKeyOf(d.mes_referencia) === mk);
      const totalDespesas = despesasMes.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
      const visitas = registrosFiltrados.filter((r) => monthKeyOf(r.mes_referencia) === mk && r.status === "realizado").length;
      return { mes: monthLabelShort(mk), totalDespesas, visitas };
    });
  }, [fromMonth, toMonth, despesasFiltradas, registrosFiltrados]);

  const periodoSlug = `${fromMonth}_a_${toMonth}`;

  function handleExportRegistros() {
    const header = csvRow(["Vendedor", "Mês", "Destino planejado", "Data planejada", "Status", "Destino realizado", "Data realizada", "Resumo", "Motivo divergência"]);
    const rows = registrosFiltrados.map((r) => csvRow([
      nomePorId.get(r.vendedor_id) || r.vendedor_id || "",
      monthLabel(monthKeyOf(r.mes_referencia)),
      r.destino_planejado || "",
      formatDate(r.data_planejada),
      STATUS_VISITA[r.status]?.label || r.status || "",
      r.destino_realizado || "",
      formatDate(r.data_realizada),
      r.resumo_realizado || "",
      r.motivo_divergencia || "",
    ]));
    triggerDownload(`viagens-${periodoSlug}.csv`, [header, ...rows].join("\r\n"));
    logExport(currentUser?.id, "viagens_registros", registrosFiltrados.length);
  }

  function handleExportDespesas() {
    const header = csvRow(["Vendedor", "Categoria", "Valor", "Data", "Status reembolso", "Descrição"]);
    const rows = despesasFiltradas.map((d) => csvRow([
      nomePorId.get(d.vendedor_id) || d.vendedor_id || "",
      d.categoria || "",
      formatBRNumber(d.valor),
      formatDate(d.data_despesa),
      STATUS_REEMBOLSO[d.status_reembolso]?.label || d.status_reembolso || "",
      d.descricao || "",
    ]));
    triggerDownload(`despesas-viagens-${periodoSlug}.csv`, [header, ...rows].join("\r\n"));
    logExport(currentUser?.id, "viagens_despesas", despesasFiltradas.length);
  }

  function handleDownloadTemplate() {
    const header = csvRow(IMPORT_COLS);
    const example = csvRow(["São Paulo - Visita Cliente XPTO", "2026-07-15", "Apresentar nova linha de produtos", "Cliente XPTO Ltda"]);
    triggerDownload("modelo-planejamento-viagens.csv", [header, example].join("\r\n"));
  }

  async function handleImportFile(file) {
    setImportError(null);
    setImportResult(null);
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      if (!data || data.length < 1) {
        setImportError("Arquivo vazio.");
        return;
      }

      const headerRow = data[0] || [];
      const mapping = resolveColumnMapping(headerRow);
      if (!mapping) {
        setImportError(`Colunas não reconhecidas. Esperado exatamente estas 4 colunas, nessa ordem (ou com esses nomes de cabeçalho): ${IMPORT_COLS.join(", ")}.`);
        return;
      }

      const dataRows = data.slice(1).filter((row) => (row || []).some((c) => String(c ?? "").trim() !== ""));

      let imported = 0;
      const skipped = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const linha = i + 2; // +1 pelo cabeçalho, +1 pra contar a partir de 1
        const destino = String(row[mapping.destino_planejado] ?? "").trim();
        const objetivo = String(row[mapping.objetivo] ?? "").trim();
        const clienteNome = String(row[mapping.cliente_nome] ?? "").trim();
        const dataISO = parseDateCell(row[mapping.data_planejada]);

        if (!destino) { skipped.push(`Linha ${linha}: destino planejado vazio`); continue; }
        if (!dataISO) { skipped.push(`Linha ${linha}: data planejada vazia ou inválida`); continue; }

        try {
          await createRegistro({
            mes_referencia: `${dataISO.slice(0, 7)}-01`,
            lead_id: null,
            cliente_nome: clienteNome || null,
            destino_planejado: destino,
            data_planejada: dataISO,
            objetivo: objetivo || null,
          });
          imported++;
        } catch (e) {
          skipped.push(`Linha ${linha}: ${e.message || "erro ao salvar"}`);
        }
      }

      setImportResult({ imported, skipped });
    } catch (e) {
      setImportError(e.message || "Não foi possível ler o arquivo.");
    } finally {
      setImporting(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ext = `.${file.name.split(".").pop().toLowerCase()}`;
    if (!IMPORT_EXTENSIONS.includes(ext)) {
      setImportError(`Formato não suportado. Use ${IMPORT_EXTENSIONS.join(", ")}.`);
      return;
    }
    if (file.size > MAX_IMPORT_MB * 1024 * 1024) {
      setImportError(`Arquivo muito grande (máx. ${MAX_IMPORT_MB}MB).`);
      return;
    }
    handleImportFile(file);
  }

  if (!isSupabaseConfigured) {
    return (
      <div style={cardSt}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Supabase não configurado</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Configure a conexão com o Supabase para ver os relatórios de viagens e reembolsos.</div>
      </div>
    );
  }

  const loading = loadingRegistros || loadingDespesas;
  const periodoInvalido = fromMonth > toMonth;
  const semDadosNoPeriodo = registrosFiltrados.length === 0 && despesasFiltradas.length === 0;

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <div className="flex items-center flex-wrap" style={{ gap: 12 }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChart3 size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Relatórios de viagens</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Planejamento x execução, despesas e importação em lote</div>
          </div>
        </div>

        <div className="flex items-center flex-wrap" style={{ gap: 8, marginLeft: "auto" }}>
          <select value={selectedVendedorId} onChange={(e) => setSelectedVendedorId(e.target.value)} style={inputSt}>
            <option value="todos">Todos os vendedores</option>
            {vendedoresComerciais.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} style={inputSt} />
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>até</span>
          <input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} style={inputSt} />
        </div>
      </div>

      {periodoInvalido && (
        <div style={errorBannerSt}>O mês inicial do período é posterior ao mês final — ajuste os filtros para ver dados.</div>
      )}

      {loading ? (
        <div style={cardSt}>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Carregando...</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 12 }}>
            <KpiTile label="% do planejado realizado" value={kpis.pctCumprido === null ? "—" : `${kpis.pctCumprido}%`} color="var(--accent)" />
            <KpiTile label="Total aprovado" value={fmtMoney(kpis.totalAprovado)} color="var(--success)" />
            <KpiTile label="Total pendente" value={fmtMoney(kpis.totalPendente)} color="var(--warning)" />
            <KpiTile label="Visitas realizadas" value={kpis.visitasRealizadas} color="var(--text)" />
          </div>

          {/* Camada de divergência pra levar à diretoria — ver
              computeViagemDivergencias em utils/viagens.js. Mesmos 3 tipos
              mostrados linha a linha em CRMViagensGestorView, aqui só o
              total do período selecionado. */}
          <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: 12 }}>
            <KpiTile label="Despesas sem visita correspondente" value={divergenciaKpis.semVisita} color="var(--danger)" />
            <KpiTile label="Visitas sem desfecho registrado" value={divergenciaKpis.sumiu} color="var(--danger)" />
            <KpiTile label="Total estourado acima do previsto" value={fmtMoney(divergenciaKpis.totalEstourado)} color="var(--warning)" />
          </div>

          {selectedVendedorId === "todos" && (
            <section style={cardSt}>
              <div style={sectionHeaderSt}>
                <BarChart3 size={16} style={{ color: "var(--text-dim)" }} />
                % cumprido por vendedor — {monthLabel(fromMonth)} a {monthLabel(toMonth)}
              </div>
              {cumprimentoPorVendedor.length === 0 ? (
                <EmptyState icon={MapPin} text="Nenhuma visita planejada no período para comparar vendedores." />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, cumprimentoPorVendedor.length * 42 + 40)}>
                  <BarChart data={cumprimentoPorVendedor} layout="vertical" margin={{ top: 4, right: 20, left: 12, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-faint)" }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "var(--text-dim)" }} width={120} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="planejado" name="Planejado" fill="var(--border)" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="realizado" name="Realizado" fill="var(--accent)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>
          )}

          <div className="grid lg:grid-cols-2" style={{ gap: 16 }}>
            <section style={cardSt}>
              <div style={sectionHeaderSt}>
                <PieChartIcon size={16} style={{ color: "var(--text-dim)" }} />
                Despesas por categoria
              </div>
              {despesasPorCategoria.length === 0 ? (
                <EmptyState icon={Wallet} text="Nenhuma despesa lançada no período." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={despesasPorCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${fmtMoney(value)}`} style={{ fontSize: 11 }}>
                      {despesasPorCategoria.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtMoney(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </section>

            <section style={cardSt}>
              <div style={sectionHeaderSt}>
                <TrendingUp size={16} style={{ color: "var(--text-dim)" }} />
                Tendência mensal
              </div>
              {despesasFiltradas.length === 0 && kpis.visitasRealizadas === 0 ? (
                <EmptyState icon={TrendingUp} text="Sem despesas ou visitas realizadas no período." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={tendenciaMensal} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "var(--text-faint)" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--text-faint)" }} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
                    <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-faint)" }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v, name) => name === "Despesas (R$)" ? fmtMoney(v) : v} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line yAxisId="left" type="monotone" dataKey="totalDespesas" name="Despesas (R$)" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="right" type="monotone" dataKey="visitas" name="Visitas realizadas" stroke="var(--success)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>

          <section style={cardSt}>
            <div style={sectionHeaderSt}>
              <FileSpreadsheet size={16} style={{ color: "var(--text-dim)" }} />
              Exportar dados do período
            </div>
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              <button onClick={handleExportRegistros} disabled={registrosFiltrados.length === 0} style={btnStyle("ghost", registrosFiltrados.length === 0)}>
                <Download size={13} /> Exportar CSV ({registrosFiltrados.length} visitas)
              </button>
              <button onClick={handleExportDespesas} disabled={despesasFiltradas.length === 0} style={btnStyle("ghost", despesasFiltradas.length === 0)}>
                <Download size={13} /> Exportar despesas CSV ({despesasFiltradas.length})
              </button>
            </div>
          </section>

          <section style={cardSt}>
            <div style={sectionHeaderSt}>
              <Upload size={16} style={{ color: "var(--text-dim)" }} />
              Importar planejamento em lote
            </div>
            {!((currentUser?.roles?.length ? currentUser.roles : [currentUser?.role]).some(r => COMERCIAL_ROLES.has(r)) || (currentUser?.roles || [currentUser?.role]).includes("admin")) ? (
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                A importação cria visitas em nome de quem está logado — disponível apenas para usuários com papel comercial (vendedor ou gerente).
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 10 }}>
                  Aceita .csv ou .xlsx com as colunas <strong>destino_planejado</strong>, <strong>data_planejada</strong>, <strong>objetivo</strong> e <strong>cliente_nome</strong> — nessa ordem, ou identificadas pelo nome do cabeçalho. Cada linha válida cria uma visita planejada em nome de {currentUser?.name || "você"}.
                </div>
                <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                  <button onClick={handleDownloadTemplate} style={btnStyle("ghost", false)}>
                    <Download size={13} /> Baixar modelo
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} disabled={importing} style={btnStyle("primary", importing)}>
                    {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {importing ? "Importando..." : "Importar planejamento"}
                  </button>
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} style={{ display: "none" }} />
                </div>
              </>
            )}

            {importError && (
              <div style={errorBannerSt}>
                <div className="flex items-center" style={{ gap: 6 }}>
                  <AlertTriangle size={13} />
                  {importError}
                </div>
              </div>
            )}

            {importResult && (
              <div style={{ marginTop: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                <div className="flex items-center" style={{ gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                  {importResult.imported} importada{importResult.imported === 1 ? "" : "s"}, {importResult.skipped.length} ignorada{importResult.skipped.length === 1 ? "" : "s"}
                </div>
                {importResult.skipped.length > 0 && (
                  <ul style={{ marginTop: 6, paddingLeft: 18, fontSize: 11, color: "var(--text-dim)" }}>
                    {importResult.skipped.map((msg, i) => <li key={i}>{msg}</li>)}
                  </ul>
                )}
              </div>
            )}
          </section>

          {semDadosNoPeriodo && !periodoInvalido && (
            <div style={cardSt}>
              <EmptyState icon={MapPin} text="Nenhuma visita ou despesa registrada no período e filtro selecionados." />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CRMViagensRelatoriosView;
