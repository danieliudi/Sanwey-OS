import React, { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Users, X, Database, History } from "lucide-react";
import { Modal } from "../ui/Modal";
import { EntityProfileModal } from "../shared/EntityProfileModal";
import { ConnectionsPanel } from "../shared/ConnectionsPanel";
import { useClientConnections } from "../../hooks/use-client-connections";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { CLIENT_CATEGORIES, clientCategoryLabel, clientCategoryColor } from "../../constants/client-categories";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { formatDateBR } from "../../utils/date";
import { formatBRL } from "../../utils/currency";
import { STATUS_VISITA } from "../../utils/viagens";
import { findClientByCnpj, DuplicateClientError } from "../../utils/client-dedup";

const BR_STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const EMPTY = { name: "", category: "", city: "", state: "", cnpj: "", companyIds: [], notes: "" };

const STAGE_LABELS = Object.fromEntries(DEFAULT_PIPELINE_STAGES.map(s => [s.id, s.name]));

const VIAGEM_STATUS_BADGE = {
  planejado:     { bg: "var(--surface-alt)", color: "var(--text-dim)" },
  realizado:     { bg: "var(--success-bg)",  color: "var(--success)" },
  nao_realizado: { bg: "var(--danger-bg)",   color: "var(--danger)" },
  cancelado:     { bg: "var(--surface-alt)", color: "var(--text-faint)" },
};

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
  if (!value) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  const color = clientCategoryColor(value);
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + "1A", color }}>
      {clientCategoryLabel(value)}
    </span>
  );
}

export function ClientsManager({ clients = [], loading, leads = [], onCreate, onUpdate, onDelete, canDelete, onOpenImport, onOpenLead, onOpenViagem }) {
  const [query, setQuery] = useState("");
  const [onlyOpportunities, setOnlyOpportunities] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = novo, obj = editando
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [activeTab, setActiveTab] = useState("dados");
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

  const openNew = () => { setEditing(null); setForm(EMPTY); setActiveTab("dados"); setModalOpen(true); };
  const openDetail = (c, tab = "dados") => {
    setEditing(c);
    setForm({
      name: c.name || "", category: c.category || "", city: c.city || "",
      state: c.state || "", cnpj: c.cnpj || "", companyIds: c.companyIds || [], notes: c.notes || "",
    });
    setActiveTab(tab);
    setModalOpen(true);
  };

  // Dedup por CNPJ ao criar (não ao editar — aí o form já é o próprio
  // duplicateMatch) — mesma checagem já usada em ClientQuickCreateModal.jsx;
  // só faltava aqui, no cadastro "de verdade" de Clientes, que por isso
  // deixava duplicar (achado real: Quimidrol duplicado ao cadastrar puxando
  // de um Sinal). O guard real vive em use-clients.js/createClient — isto
  // aqui só dá o aviso inline antes de tentar salvar.
  const duplicateMatch = useMemo(() => (editing ? null : findClientByCnpj(clients, form.cnpj)), [editing, form.cnpj, clients]);

  const save = async () => {
    if (!form.name.trim() || duplicateMatch) return;
    setSaving(true);
    try {
      if (editing) await onUpdate?.(editing.id, form);
      else await onCreate?.(form);
      setModalOpen(false);
    } catch (err) {
      if (err instanceof DuplicateClientError) {
        setForm(f => ({ ...f, cnpj: err.existingClient.cnpj || f.cnpj }));
      } else {
        throw err;
      }
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

  const inputStyle = { borderColor: "var(--border)", color: "var(--text)", outline: "none", background: "var(--surface)" };
  const onFocusRed = e => { e.target.style.borderColor = "var(--color-industria)"; e.target.style.boxShadow = "0 0 0 3px rgba(199,33,43,0.12)"; };
  const onBlurRed = e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; };

  return (
    <div className="p-5 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2" style={{ fontSize: 15, color: "var(--text)" }}>
            <Users size={16} /> Clientes
          </h2>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-dim)" }}>
            Cadastro central de clientes — usado para vincular aos cards do Funil de Vendas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenImport && (
            <button
              onClick={onOpenImport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", cursor: "pointer" }}
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
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border flex-1" style={{ borderColor: "var(--border)", background: "var(--surface)", minWidth: 220 }}>
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
        <>
          {/* Tabela — só a partir de md; abaixo disso a tabela de 9 colunas
              não cabe e a coluna de Ações fica fora da tela (achado de auditoria). */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {COLS.map((col, i) => (
                    <th key={i} className={col.numeric ? "text-right font-bold uppercase" : "text-left font-bold uppercase"}
                      onClick={() => toggleSort(col.key)}
                      style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--text-dim)", padding: "10px 12px", borderBottom: "1px solid var(--border)", cursor: col.key ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}>
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
                      {/* Nome sempre clicável, com ou sem negócio — antes só
                          abria o perfil quando dealCount>0, deixando cliente
                          sem negócio ainda sem nenhuma forma de abrir o
                          próprio cadastro pelo nome (achado de usabilidade). */}
                      <button onClick={() => openDetail(c, dealCount > 0 ? "conexoes" : "dados")}
                        className="font-semibold text-left inline-flex items-center gap-1"
                        style={{ color: "var(--color-industria)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        {c.name}
                        {dealCount > 0 && <History size={12} />}
                      </button>
                    </td>
                    <td style={{ padding: "12px" }}><CategoryTag value={c.category} /></td>
                    <td style={{ padding: "12px", fontSize: 13, color: "var(--text)" }}>
                      {[c.city, c.state].filter(Boolean).join(" / ") || <span style={{ color: "var(--text-faint)" }}>—</span>}
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
                                : { background: "var(--surface-alt)", color: "var(--text-faint)" }}>
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
                      <button onClick={() => openDetail(c)} title="Editar"
                        className="p-1.5 rounded-lg" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)" }}>
                        <Pencil size={14} />
                      </button>
                      {canDelete && (
                        <button onClick={() => setConfirmId(c.id)} title="Excluir"
                          className="p-1.5 rounded-lg" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>

          {/* Cards — abaixo de md, substitui a tabela (achado de auditoria:
              9 colunas não cabem em ~375-414px e a coluna de Ações ficava fora da tela). */}
          <div className="md:hidden space-y-2.5">
            {paged.map(c => {
              const stats = statsByClient.get(c.id);
              const dealCount = dealsByClient.get(c.id)?.length || 0;
              return (
                <div key={c.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button onClick={() => openDetail(c, dealCount > 0 ? "conexoes" : "dados")}
                        className="font-semibold text-left inline-flex items-center gap-1"
                        style={{ color: "var(--color-industria)", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 14 }}>
                        {c.name}
                        {dealCount > 0 && <History size={12} />}
                      </button>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                        {[c.city, c.state].filter(Boolean).join(" / ") || "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => openDetail(c)} title="Editar"
                        className="p-2 rounded-lg" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)" }}>
                        <Pencil size={16} />
                      </button>
                      {canDelete && (
                        <button onClick={() => setConfirmId(c.id)} title="Excluir"
                          className="p-2 rounded-lg" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-1.5 mt-2">
                    <CategoryTag value={c.category} />
                    {c.cnpj && (
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>{c.cnpj}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {COMPANY_IDS.map(id => {
                      const co = COMPANIES[id];
                      const won = stats?.companies.has(id);
                      return (
                        <span key={id} title={won ? `Já vende para ${co.name}` : `Oportunidade de cross-sell em ${co.name}`}
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={won
                            ? { background: co.primary + "1A", color: co.primary }
                            : { background: "var(--surface-alt)", color: "var(--text-faint)" }}>
                          {co.short}
                        </span>
                      );
                    })}
                  </div>

                  {stats?.products.length ? (
                    <div className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
                      {stats.products.join(", ")}
                    </div>
                  ) : null}

                  {stats && (
                    <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid #F1F1F1", fontSize: 12 }}>
                      <span style={{ color: "var(--text-dim)" }}>{stats.lastOrder ? formatDateBR(stats.lastOrder) : "—"}</span>
                      <span style={{ color: "var(--text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        {stats.avgTicket ? formatBRL(stats.avgTicket) : "—"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

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
        </>
      )}

      {/* Perfil do cliente — Dados + Conexões (Negócios, Viagens) */}
      <ClientDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        form={form}
        setForm={setForm}
        saving={saving}
        onSave={save}
        duplicateMatch={duplicateMatch}
        onUseDuplicate={(c) => { setModalOpen(false); openDetail(c); }}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        toggleCompany={toggleCompany}
        inputStyle={inputStyle}
        onFocusRed={onFocusRed}
        onBlurRed={onBlurRed}
        stats={editing ? statsByClient.get(editing.id) : null}
        dealsByClient={dealsByClient}
        onOpenLead={onOpenLead}
        onOpenViagem={onOpenViagem}
      />

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
              style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={async () => { await onDelete?.(confirmId); setConfirmId(null); }}
              className="px-4 py-2 text-sm rounded-lg font-semibold text-white"
              style={{ background: "var(--danger)", border: "none", cursor: "pointer" }}>
              Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ClientDetailModal({
  open, onClose, editing, form, setForm, saving, onSave,
  duplicateMatch, onUseDuplicate,
  activeTab, onTabChange, toggleCompany, inputStyle, onFocusRed, onBlurRed,
  stats, dealsByClient, onOpenLead, onOpenViagem,
}) {
  const { data, loading } = useClientConnections(editing?.id);

  const tabs = editing
    ? [{ id: "dados", label: "Dados" }, { id: "conexoes", label: "Conexões" }]
    : [{ id: "dados", label: "Dados" }];
  const tab = editing ? activeTab : "dados";

  const groups = [
    {
      key: "negocios",
      label: "Negócios (Funil de Vendas)",
      color: "var(--accent)",
      items: data?.negocios || [],
      renderItem: (item) => ({
        title: item.company || "Negócio sem nome",
        badgeLabel: STAGE_LABELS[item.stage] || item.stage,
        meta: formatBRL(item.value || 0),
      }),
      // A RPC get_client_connections só devolve colunas parciais (id/company/
      // stage/value/owner/created_at) — resolve o lead COMPLETO em
      // dealsByClient (já carregado pelo componente pai a partir de `leads`)
      // antes de abrir, senão LeadDetailDrawer quebra por falta de
      // companyId/clientId/customFields/etc.
      onOpenItem: (item) => {
        const fullLead = dealsByClient?.get(editing?.id)?.find(l => l.id === item.id);
        onOpenLead?.(fullLead || item);
        onClose();
      },
      emptyLabel: "Nenhum negócio vinculado a este cliente ainda.",
    },
    {
      key: "viagens",
      label: "Viagens & Reembolsos",
      color: "#0891B2",
      items: data?.viagens || [],
      renderItem: (item) => {
        const badge = VIAGEM_STATUS_BADGE[item.status] || VIAGEM_STATUS_BADGE.planejado;
        return {
          title: item.destino_planejado || "Viagem sem destino",
          badgeLabel: STATUS_VISITA[item.status]?.label || item.status,
          badgeBg: badge.bg,
          badgeColor: badge.color,
          meta: formatDateBR(item.data_planejada),
        };
      },
      onOpenItem: (item) => { onOpenViagem?.(item.id); onClose(); },
      emptyLabel: "Nenhuma viagem vinculada a este cliente ainda.",
    },
  ];

  return (
    <EntityProfileModal
      open={open}
      onClose={onClose}
      avatarLabel={(form.name || "?").trim().charAt(0).toUpperCase() || "?"}
      avatarColor="var(--color-industria)"
      title={form.name || (editing ? editing.name : "Novo cliente")}
      subtitle={[form.city, form.state].filter(Boolean).join(" / ") || (editing ? undefined : "Preencha os dados abaixo")}
      statusBadge={form.category ? <CategoryTag value={form.category} /> : undefined}
      tabs={tabs}
      activeTab={tab}
      onTabChange={onTabChange}
      width={560}
    >
      {tab === "dados" && (
        <div className="space-y-3.5">
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
                className="w-full rounded-lg border px-3 py-2 text-sm" style={{ ...inputStyle, borderColor: duplicateMatch ? "var(--danger)" : inputStyle.borderColor }} onFocus={onFocusRed} onBlur={onBlurRed} />
            </div>
          </div>

          {duplicateMatch && (
            <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 10, padding: "10px 12px", fontSize: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ flexShrink: 0 }}>⚠</span>
              <div>
                Já existe um cliente com esse CNPJ: <b>{duplicateMatch.name}</b>.
                <button
                  type="button"
                  onClick={() => onUseDuplicate(duplicateMatch)}
                  style={{ display: "block", marginTop: 6, background: "none", border: "none", padding: 0, color: "var(--accent)", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                >
                  Abrir "{duplicateMatch.name}" em vez de criar outro
                </button>
              </div>
            </div>
          )}

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
                    style={{ borderColor: sel ? co.primary : "var(--border)", background: sel ? co.primary + "1A" : "var(--surface)", color: sel ? co.primary : "var(--text-dim)", cursor: "pointer" }}>
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

          {editing && (
            stats ? (
              <div>
                <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Resumo comercial</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Ticket médio", value: formatBRL(stats.avgTicket) },
                    { label: "Produtos distintos", value: stats.products.length },
                    { label: "Empresas atendidas", value: `${stats.companies.size}/${COMPANY_IDS.length}` },
                    { label: "Último pedido", value: formatDateBR(stats.lastOrder) },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }}>
                      <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</div>
                      <div className="font-semibold mt-0.5" style={{ fontSize: 14, color: "var(--text)" }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Resumo comercial</label>
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>Nenhum negócio ganho ainda pra gerar estatísticas.</p>
              </div>
            )
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={onSave} disabled={!form.name.trim() || saving || !!duplicateMatch}
              className="px-4 py-2 text-sm rounded-lg font-semibold text-white"
              style={{ background: "var(--color-industria)", border: "none", opacity: (!form.name.trim() || saving || duplicateMatch) ? 0.5 : 1, cursor: (!form.name.trim() || saving || duplicateMatch) ? "not-allowed" : "pointer" }}>
              {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar cliente"}
            </button>
          </div>
        </div>
      )}

      {tab === "conexoes" && editing && (
        <ConnectionsPanel
          groups={groups}
          loading={loading}
          introText="Conexões deste cliente em outras telas da plataforma."
        />
      )}
    </EntityProfileModal>
  );
}
