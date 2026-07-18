import React, { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Users, X, Database, History, ArrowUpRight } from "lucide-react";
import { Modal } from "../ui/Modal";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { CLIENT_CATEGORIES, clientCategoryLabel, clientCategoryColor } from "../../constants/client-categories";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { formatDateBR } from "../../utils/date";
import { formatBRL } from "../../utils/currency";

const BR_STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const EMPTY = { name: "", category: "", city: "", state: "", cnpj: "", companyIds: [], notes: "" };

const STAGE_LABELS = Object.fromEntries(DEFAULT_PIPELINE_STAGES.map(s => [s.id, s.name]));

// Data em que o negócio realmente fechou: data_fechamento (custom field da
// etapa "ganho") tem prioridade, caindo pra stageChangedAt quando o campo
// não foi preenchido — sempre existe, pois é setado em toda troca de etapa.
function wonDate(l) {
  return l.customFields?.data_fechamento || l.stageChangedAt || l.closeDate || l.createdAt || null;
}
function wonValue(l) {
  const v = l.customFields?.valor_final;
  return v !== undefined && v !== null && v !== "" ? Number(v) : Number(l.value || 0);
}

function CategoryTag({ value }) {
  if (!value) return <span style={{ color: "#9CA3AF" }}>—</span>;
  const color = clientCategoryColor(value);
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + "1A", color }}>
      {clientCategoryLabel(value)}
    </span>
  );
}

export function ClientsManager({ clients = [], loading, leads = [], onCreate, onUpdate, onDelete, canDelete, onOpenImport, onOpenLead }) {
  const [query, setQuery] = useState("");
  const [onlyOpportunities, setOnlyOpportunities] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = novo, obj = editando
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [historyClient, setHistoryClient] = useState(null);
  const [sortCol, setSortCol] = useState(null); // null = ordem natural
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Todos os negócios (qualquer etapa) por cliente — usado no histórico e,
  // filtrado por "ganho", pras flags de cross-sell/ticket médio/produtos.
  const dealsByClient = useMemo(() => {
    const map = new Map();
    for (const l of leads) {
      if (!l.clientId) continue;
      if (!map.has(l.clientId)) map.set(l.clientId, []);
      map.get(l.clientId).push(l);
    }
    return map;
  }, [leads]);

  // Estatísticas derivadas dos negócios "ganho" de cada cliente — mais
  // confiável que o tag manual "Empresas relacionadas" pra detectar cross-sell.
  const statsByClient = useMemo(() => {
    const map = new Map();
    for (const [clientId, deals] of dealsByClient) {
      const won = deals.filter(l => l.stage === "ganho");
      if (!won.length) continue;
      const companies = new Set(won.map(l => l.companyId).filter(Boolean));
      const products = [...new Set(won.map(l => l.skuName || l.sku).filter(Boolean))];
      const values = won.map(wonValue);
      const avgTicket = values.reduce((a, b) => a + b, 0) / values.length;
      const lastOrder = won.map(wonDate).filter(Boolean).sort().at(-1);
      map.set(clientId, { companies, products, avgTicket, lastOrder });
    }
    return map;
  }, [dealsByClient]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = clients;
    if (q) {
      list = list.filter(c =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.cnpj || "").includes(q) ||
        clientCategoryLabel(c.category).toLowerCase().includes(q));
    }
    if (onlyOpportunities) {
      list = list.filter(c => (statsByClient.get(c.id)?.companies.size || 0) < COMPANY_IDS.length);
    }
    return list;
  }, [clients, query, onlyOpportunities, statsByClient]);

  // Colunas ordenáveis (key null = não ordena). Achado da 2ª auditoria:
  // faltava ordenação por coluna (a tela de Funcionários já tinha) e
  // paginação em listas potencialmente grandes.
  const COLS = [
    { label: "Nome", key: "name" },
    { label: "Categoria", key: "category" },
    { label: "Cidade / UF", key: "city" },
    { label: "CNPJ", key: "cnpj" },
    { label: "Cross-sell", key: null },
    { label: "Produtos", key: "products" },
    { label: "Último pedido", key: "lastOrder" },
    { label: "Ticket médio", key: "avgTicket", numeric: true },
    { label: "", key: null },
  ];
  const sortValue = (c, col) => {
    const stats = statsByClient.get(c.id);
    switch (col) {
      case "name":      return (c.name || "").toLowerCase();
      case "category":  return clientCategoryLabel(c.category).toLowerCase();
      case "city":      return `${c.city || ""} ${c.state || ""}`.trim().toLowerCase();
      case "cnpj":      return c.cnpj || "";
      case "products":  return stats?.products.length || 0;
      case "lastOrder": return stats?.lastOrder ? new Date(stats.lastOrder).getTime() : 0;
      case "avgTicket": return stats?.avgTicket || 0;
      default:          return "";
    }
  };
  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = sortValue(a, sortCol), vb = sortValue(b, sortCol);
      const cmp = (typeof va === "number" && typeof vb === "number")
        ? va - vb
        : String(va).localeCompare(String(vb), "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortCol, sortDir, statsByClient]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const toggleSort = (col) => {
    if (!col) return;
    if (sortCol === col) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
    setPage(0);
  };

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || "", category: c.category || "", city: c.city || "",
      state: c.state || "", cnpj: c.cnpj || "", companyIds: c.companyIds || [], notes: c.notes || "",
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await onUpdate?.(editing.id, form);
      else await onCreate?.(form);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleCompany = (id) => {
    setForm(f => ({
      ...f,
      companyIds: f.companyIds.includes(id) ? f.companyIds.filter(x => x !== id) : [...f.companyIds, id],
    }));
  };

  const inputStyle = { borderColor: "#E5E7EB", color: "var(--text)", outline: "none", background: "var(--surface)" };
  const onFocusRed = e => { e.target.style.borderColor = "var(--color-industria)"; e.target.style.boxShadow = "0 0 0 3px rgba(199,33,43,0.12)"; };
  const onBlurRed = e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; };

  return (
    <div className="p-5 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "var(--shadow-card)" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2" style={{ fontSize: 15, color: "var(--text)" }}>
            <Users size={16} /> Clientes
          </h2>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-dim)" }}>
            Cadastro central de clientes — usado para vincular aos cards do Pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenImport && (
            <button
              onClick={onOpenImport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border"
              style={{ borderColor: "#E5E7EB", color: "var(--text)", background: "#FFFFFF", cursor: "pointer" }}
            >
              <Database size={15} /> Importar planilha
            </button>
          )}
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--color-industria)", border: "none", cursor: "pointer" }}
          >
            <Plus size={15} /> Novo cliente
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border flex-1" style={{ borderColor: "#E5E7EB", background: "var(--surface)", minWidth: 220 }}>
          <Search size={15} style={{ color: "var(--text-dim)" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome, cidade, CNPJ ou categoria…"
            className="flex-1 text-sm outline-none"
            style={{ border: "none", background: "transparent", color: "var(--text)" }}
          />
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs font-medium select-none" style={{ color: "var(--text-dim)", cursor: "pointer" }}>
          <input type="checkbox" checked={onlyOpportunities} onChange={e => setOnlyOpportunities(e.target.checked)} />
          Somente oportunidades de cross-sell
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>
          {clients.length === 0 ? (
            "Nenhum cliente cadastrado ainda."
          ) : (
            <>
              Nenhum cliente corresponde aos filtros aplicados.{" "}
              <button
                onClick={() => { setQuery(""); setOnlyOpportunities(false); }}
                className="font-semibold underline cursor-pointer"
                style={{ background: "none", border: "none", color: "var(--accent)", padding: 0 }}
              >
                Limpar filtros
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {COLS.map((col, i) => (
                  <th key={i} className={col.numeric ? "text-right font-bold uppercase" : "text-left font-bold uppercase"}
                    onClick={() => toggleSort(col.key)}
                    style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--text-dim)", padding: "10px 12px", borderBottom: "1px solid #E5E7EB", cursor: col.key ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}>
                    {col.label}
                    {col.key && sortCol === col.key && (
                      <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(c => {
                const stats = statsByClient.get(c.id);
                const dealCount = dealsByClient.get(c.id)?.length || 0;
                return (
                <tr key={c.id} style={{ borderBottom: "1px solid #F1F1F1" }}>
                  <td style={{ padding: "12px", fontSize: 13 }}>
                    {dealCount > 0 ? (
                      <button onClick={() => setHistoryClient(c)}
                        className="font-semibold text-left inline-flex items-center gap-1"
                        style={{ color: "var(--color-industria)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        {c.name}
                        <History size={12} />
                      </button>
                    ) : (
                      <span className="font-semibold" style={{ color: "var(--text)" }}>{c.name}</span>
                    )}
                  </td>
                  <td style={{ padding: "12px" }}><CategoryTag value={c.category} /></td>
                  <td style={{ padding: "12px", fontSize: 13, color: "var(--text)" }}>
                    {[c.city, c.state].filter(Boolean).join(" / ") || <span style={{ color: "#9CA3AF" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px", fontSize: 12, fontFamily: "monospace", color: "var(--text-dim)" }}>
                    {c.cnpj || "—"}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div className="flex flex-wrap gap-1">
                      {COMPANY_IDS.map(id => {
                        const co = COMPANIES[id];
                        const won = stats?.companies.has(id);
                        return (
                          <span key={id} title={won ? `Já vende para ${co.name}` : `Oportunidade de cross-sell em ${co.name}`}
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={won
                              ? { background: co.primary + "1A", color: co.primary }
                              : { background: "#F3F4F6", color: "#9CA3AF" }}>
                            {co.short}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td style={{ padding: "12px", fontSize: 12, color: "var(--text-dim)", maxWidth: 180 }}>
                    {stats?.products.length ? stats.products.join(", ") : "—"}
                  </td>
                  <td style={{ padding: "12px", fontSize: 13, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                    {stats?.lastOrder ? formatDateBR(stats.lastOrder) : "—"}
                  </td>
                  <td style={{ padding: "12px", fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {stats?.avgTicket ? formatBRL(stats.avgTicket) : "—"}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => openEdit(c)} title="Editar"
                      className="p-1.5 rounded-lg" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)" }}>
                      <Pencil size={14} />
                    </button>
                    {canDelete && (
                      <button onClick={() => setConfirmId(c.id)} title="Excluir"
                        className="p-1.5 rounded-lg" style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
          {/* Contador + paginação — antes a lista renderizava todas as linhas
              de uma vez. Achado da 2ª auditoria. */}
          <div className="flex items-center justify-between flex-wrap gap-2" style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-dim)" }}>
            <span>
              {sorted.length} {sorted.length === 1 ? "cliente" : "clientes"}
              {totalPages > 1 && ` · pág. ${safePage + 1}/${totalPages}`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                  className="px-2.5 py-1 rounded-lg" style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: safePage === 0 ? "default" : "pointer", opacity: safePage === 0 ? 0.5 : 1 }}>
                  Anterior
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}
                  className="px-2.5 py-1 rounded-lg" style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: safePage >= totalPages - 1 ? "default" : "pointer", opacity: safePage >= totalPages - 1 ? 0.5 : 1 }}>
                  Próxima
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar cliente" : "Novo cliente"} width={480}>
        <div className="px-6 py-5 space-y-3.5">
          <div>
            <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Nome *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome do cliente" autoFocus
              className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} onFocus={onFocusRed} onBlur={onBlurRed} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} onFocus={onFocusRed} onBlur={onBlurRed}>
                <option value="">—</option>
                {CLIENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>CNPJ</label>
              <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                placeholder="00.000.000/0000-00"
                className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} onFocus={onFocusRed} onBlur={onBlurRed} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cidade</label>
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="Cidade"
                className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} onFocus={onFocusRed} onBlur={onBlurRed} />
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>UF</label>
              <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} onFocus={onFocusRed} onBlur={onBlurRed}>
                <option value="">—</option>
                {BR_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Empresas relacionadas</label>
            <div className="flex flex-wrap gap-2">
              {COMPANY_IDS.map(id => {
                const co = COMPANIES[id];
                const sel = form.companyIds.includes(id);
                return (
                  <button key={id} type="button" onClick={() => toggleCompany(id)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium border"
                    style={{ borderColor: sel ? co.primary : "#E5E7EB", background: sel ? co.primary + "1A" : "#FFFFFF", color: sel ? co.primary : "var(--text-dim)", cursor: "pointer" }}>
                    {co.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Observações</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Notas internas…"
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none" style={inputStyle} onFocus={onFocusRed} onBlur={onBlurRed} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-lg border"
              style={{ borderColor: "#E5E7EB", color: "var(--text-dim)", background: "#FFFFFF", cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={save} disabled={!form.name.trim() || saving}
              className="px-4 py-2 text-sm rounded-lg font-semibold text-white"
              style={{ background: "var(--color-industria)", border: "none", opacity: (!form.name.trim() || saving) ? 0.5 : 1, cursor: (!form.name.trim() || saving) ? "not-allowed" : "pointer" }}>
              {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar cliente"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Histórico de negócios do cliente */}
      <Modal open={Boolean(historyClient)} onClose={() => setHistoryClient(null)} title={`Histórico — ${historyClient?.name || ""}`} width={560}>
        <div className="px-6 py-5">
          {(dealsByClient.get(historyClient?.id) || [])
            .slice()
            .sort((a, b) => new Date(wonDate(b) || b.createdAt || 0) - new Date(wonDate(a) || a.createdAt || 0))
            .map(l => {
              const co = COMPANIES[l.companyId];
              const isWon = l.stage === "ganho";
              return (
                <div key={l.id} className="flex items-start justify-between gap-3 py-3" style={{ borderBottom: "1px solid #F1F1F1" }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {co && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: co.primary + "1A", color: co.primary }}>
                          {co.short}
                        </span>
                      )}
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={isWon ? { background: "#DCFCE7", color: "#16A34A" } : { background: "#F3F4F6", color: "var(--text-dim)" }}>
                        {STAGE_LABELS[l.stage] || l.stage}
                      </span>
                    </div>
                    <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                      {l.skuName || l.sku || l.company || "Negócio sem nome"}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                      {formatBRL(isWon ? wonValue(l) : (l.value || 0))} · {formatDateBR(wonDate(l) || l.createdAt)}
                    </div>
                  </div>
                  {onOpenLead && (
                    <button onClick={() => { onOpenLead(l); setHistoryClient(null); }} title="Abrir no pipeline"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shrink-0"
                      style={{ borderColor: "#E5E7EB", color: "var(--text)", background: "#FFFFFF", cursor: "pointer" }}>
                      Abrir <ArrowUpRight size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          {!(dealsByClient.get(historyClient?.id) || []).length && (
            <p className="text-sm text-center py-6" style={{ color: "var(--text-dim)" }}>Nenhum negócio vinculado a este cliente ainda.</p>
          )}
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={Boolean(confirmId)} onClose={() => setConfirmId(null)} title="Excluir cliente" width={400}>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
            {(() => {
              const n = dealsByClient.get(confirmId)?.length || 0;
              return n > 0
                ? `Tem certeza que deseja excluir este cliente? ${n} negócio${n !== 1 ? "s" : ""} vinculado${n !== 1 ? "s" : ""} vão perder a referência a ele.`
                : "Tem certeza que deseja excluir este cliente? Não há negócios vinculados a ele.";
            })()}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmId(null)} className="px-4 py-2 text-sm rounded-lg border"
              style={{ borderColor: "#E5E7EB", color: "var(--text-dim)", background: "#FFFFFF", cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={async () => { await onDelete?.(confirmId); setConfirmId(null); }}
              className="px-4 py-2 text-sm rounded-lg font-semibold text-white"
              style={{ background: "#DC2626", border: "none", cursor: "pointer" }}>
              Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
