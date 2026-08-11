import React, { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Users, X, Database, History, List, MessageCircle, Receipt } from "lucide-react";
import { Modal } from "../ui/Modal";
import { EntityProfileModal } from "../shared/EntityProfileModal";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { EmptyState } from "../ui/EmptyState";
import { useClientTimeline } from "../../hooks/use-client-timeline";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { CLIENT_CATEGORIES, clientCategoryLabel, clientCategoryColor } from "../../constants/client-categories";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { formatDateBR, parseDateInput } from "../../utils/date";
import { formatBRL } from "../../utils/currency";
import { activityTypeMeta } from "../../utils/activity-types";
import { findClientByCnpj, DuplicateClientError } from "../../utils/client-dedup";

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
  const [saveError, setSaveError] = useState(null);
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

  const openNew = () => { setEditing(null); setForm(EMPTY); setSaveError(null); setActiveTab("dados"); setModalOpen(true); };
  const openDetail = (c, tab = "dados") => {
    setEditing(c);
    setSaveError(null);
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
    // `clients_insert`/`clients_update` exigem `company_ids && current_user_companies()`
    // — com o array vazio o overlap é FALSE e o usuário só via o erro cru da RLS.
    if (form.companyIds.length === 0) { setSaveError("Selecione ao menos uma empresa relacionada."); return; }
    setSaveError(null);
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
                      <button onClick={() => openDetail(c, dealCount > 0 ? "historico" : "dados")}
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
                      <button onClick={() => openDetail(c, dealCount > 0 ? "historico" : "dados")}
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
        saveError={saveError}
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
              className="px-4 py-2 text-sm rounded-lg font-semibold"
              style={{ background: "var(--danger)", color: "var(--on-danger)", border: "none", cursor: "pointer" }}>
              Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ClientDetailModal({
  open, onClose, editing, form, setForm, saving, onSave, saveError,
  duplicateMatch, onUseDuplicate,
  activeTab, onTabChange, toggleCompany, inputStyle, onFocusRed, onBlurRed,
  stats, dealsByClient, onOpenLead, onOpenViagem,
}) {
  const tabs = editing
    ? [{ id: "dados", label: "Dados" }, { id: "historico", label: "Histórico" }]
    : [{ id: "dados", label: "Dados" }];
  const tab = editing ? activeTab : "dados";

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
            <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Empresas relacionadas *</label>
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
            {saveError && (
              <div className="mt-2" style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 10, padding: "8px 12px", fontSize: 12 }}>
                {saveError}
              </div>
            )}
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

      {tab === "historico" && editing && (
        <ClientTimelinePanel
          clientId={editing.id}
          deals={dealsByClient?.get(editing.id) || []}
          onOpenLead={onOpenLead}
          onOpenViagem={onOpenViagem}
          onClose={onClose}
        />
      )}
    </EntityProfileModal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Linha do tempo do cliente (FASE 3, nível B)
//
// A aba antes chamada "Conexões" era DUAS listas de links (Negócios,
// Viagens) — "onde este cliente aparece", não "o que já aconteceu com ele".
// Agora é uma linha do tempo cronológica única, atravessando todos os
// negócios dele, alimentada por `get_client_timeline` (hook
// use-client-timeline.js). A navegação que as duas listas davam continua:
// a etiqueta do negócio abre o negócio, e o item de visita abre a viagem.
//
// Mantido LOCAL a este arquivo de propósito — regra 4 do CLAUDE.md: extrai
// pra shared/ só na 3ª ocorrência real de uma linha do tempo, e esta é a 1ª.
// ─────────────────────────────────────────────────────────────────────────

// `kind` da RPC → tipo de activity, pra reaproveitar rótulo/ícone de
// utils/activity-types.js (mesma fonte que o feed do negócio usa) em vez de
// repetir o switch aqui. `email`/`proposta` já mapeados de propósito: os dois
// tipos existem no lado da escrita (email_sent/proposal_generated) e passam a
// aparecer sozinhos quando a RPC começar a devolvê-los, sem tocar nesta tela.
const TIMELINE_KIND_ACTIVITY = {
  comentario: "comment",
  nota:       "note",
  etapa:      "stage",
  follow_up:  "follow_up_set",
  visita:     "visit",
  amostra:    "sample_sent",
  anexo:      "attachment",
  posvenda:   "posvenda_case",
  email:      "email_sent",
  proposta:   "proposal_generated",
};
// Faturamento é marco anual de client_billing_history, não um tipo de
// activity — por isso é o único que não vem de activity-types.js.
const FATURAMENTO_META = { label: "Faturamento", icon: Receipt };

function timelineKindMeta(kind) {
  if (kind === "faturamento") return FATURAMENTO_META;
  return activityTypeMeta(TIMELINE_KIND_ACTIVITY[kind]);
}

function normalizeText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}
function shortText(s, max = 150) {
  const t = normalizeText(s);
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// Texto COMPLETO do item (a truncagem acontece no render, em TimelineItem, que
// precisa saber se cortou pra pendurar o `title` nativo). Casos que precisam de
// tratamento além do `detail` que a RPC já monta:
//  - etapa: a RPC resolve o nome de exibição a partir de rh_pipeline_stages
//    (configurável por empresa) e manda em meta.from_label/to_label; o
//    catálogo padrão do bundle vira só fallback, e a chave crua o último.
//  - visita cancelada/não realizada: o título já diz o status; o que falta na
//    tela é o MOTIVO, que a RPC manda em meta.motivo_divergencia.
//  - valores (amostra/posvenda/faturamento): vêm crus em `meta` de propósito
//    — formatBRL já inclui "R$ ", nunca concatenar.
//  - follow_up: `meta.date` é "AAAA-MM-DD"; formatDateBR passa por
//    parseDateInput e não erra o fuso.
function timelineDetail(item) {
  const meta = item.meta || {};
  const money = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) || Number(v) === 0 ? null : formatBRL(v));

  if (item.kind === "etapa" && meta.to) {
    const stageName = (key, label) => label || STAGE_LABELS[key] || key;
    const from = meta.from ? stageName(meta.from, meta.from_label) : null;
    const to = stageName(meta.to, meta.to_label);
    const base = from ? `De "${from}" para "${to}"` : `Entrou em "${to}"`;
    return meta.note ? `${base} — ${meta.note}` : base;
  }
  if (item.kind === "visita") {
    const naoAconteceu = meta.status === "cancelado" || meta.status === "nao_realizado";
    const motivo = naoAconteceu && meta.motivo_divergencia ? `Motivo: ${meta.motivo_divergencia}` : null;
    return [motivo, item.detail].filter(Boolean).join(" · ");
  }
  if (item.kind === "follow_up" && meta.date) {
    return [`Agendado para ${formatDateBR(meta.date)}`, item.detail].filter(Boolean).join(" · ");
  }
  if (item.kind === "amostra") {
    const custo = money(meta.cost);
    return [item.detail, custo && `Custo ${custo}`].filter(Boolean).join(" · ");
  }
  if (item.kind === "posvenda") {
    return [item.detail, money(meta.value)].filter(Boolean).join(" · ");
  }
  if (item.kind === "faturamento") {
    return [money(meta.total_value), item.detail].filter(Boolean).join(" · ");
  }
  return item.detail;
}

const LEAD_BADGE_STYLE = {
  fontSize: 10, fontWeight: 700, lineHeight: 1.6, padding: "1px 7px", borderRadius: 999,
  background: "var(--surface-alt)", color: "var(--text-dim)",
  maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

function TimelineItem({ item, isLast, isFuture = false, deals, onOpenLead, onOpenViagem, onClose }) {
  const { icon: Icon } = timelineKindMeta(item.kind);
  // Interação x evento interno: quem manda é `category` da RPC (fonte única
  // da taxonomia aprovada), não o `kind` do activity-types. O que ainda VAI
  // acontecer (visita agendada, follow-up futuro) nunca conta como interação
  // já realizada — a tela responde "o que já tentamos", não "o que vamos".
  const isInteraction = item.category === "interacao" && !isFuture;
  const fullDetail = normalizeText(timelineDetail(item));
  const detail = shortText(fullDetail);
  const truncated = detail !== fullDetail;
  // Nota legada de leads.notes não tem autor — nunca inventar um. Marco de
  // faturamento não tem ator nenhum, então nem mostra o slot.
  const actor = item.kind === "faturamento" ? null : (item.actor_name || "autor não registrado");
  // Mesmo cuidado que a aba antiga tinha: a linha do tempo devolve só o id do
  // negócio; o LeadDetailDrawer precisa do lead COMPLETO (companyId,
  // customFields...). Sem o lead resolvido, a etiqueta fica só informativa.
  const fullLead = item.lead_id ? deals.find(l => l.id === item.lead_id) : null;
  const viagemId = item.kind === "visita" ? item.meta?.viagemId : null;
  const openViagem = viagemId && onOpenViagem
    ? () => { onOpenViagem(viagemId); onClose?.(); }
    : null;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
      {/* Trilho: bolinha + linha vertical de conexão */}
      <div style={{ position: "relative", width: 11, flexShrink: 0 }}>
        {!isLast && (
          <span aria-hidden style={{ position: "absolute", left: 5, top: 18, bottom: 0, width: 1, background: "var(--border)" }} />
        )}
        <span
          aria-hidden
          title={isFuture ? "Ainda não aconteceu" : (isInteraction ? "Interação com o cliente" : "Evento interno")}
          style={{
            position: "absolute", top: 4, left: 0, width: 11, height: 11, borderRadius: "50%",
            boxSizing: "border-box",
            background: isInteraction ? "var(--accent)" : "var(--surface)",
            border: isInteraction ? "none" : "1.5px solid var(--border)",
          }}
        />
      </div>

      <div style={{ minWidth: 0, flex: 1, paddingBottom: 14 }}>
        <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
          <Icon size={12} style={{ color: "var(--text-dim)", flexShrink: 0 }} aria-hidden />
          {openViagem ? (
            <button type="button" onClick={openViagem} title="Abrir a viagem"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
                       fontSize: 12.5, fontWeight: 600, color: "var(--accent)", overflowWrap: "anywhere" }}>
              {item.title}
            </button>
          ) : (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: isInteraction ? "var(--text)" : "var(--text-dim)", overflowWrap: "anywhere" }}>
              {item.title}
            </span>
          )}
          {/* A bolinha é a ÚNICA marca da taxonomia interação x evento interno,
              e ela é aria-hidden + só tem `title` (que não abre no toque). Este
              slot carrega essa informação — repetir o rótulo do tipo aqui seria
              redundante com item.title, que já diz "Comentário"/"Etapa"/etc. */}
          <span className="sr-only">
            {isFuture ? "Agendado, ainda não aconteceu" : (isInteraction ? "Interação com o cliente" : "Evento interno")}
          </span>
          {item.lead_name && (
            fullLead ? (
              <button type="button" onClick={() => { onOpenLead?.(fullLead); onClose?.(); }}
                title={`Abrir negócio "${item.lead_name}"`}
                style={{ ...LEAD_BADGE_STYLE, border: "none", cursor: "pointer" }}>
                {item.lead_name}
              </button>
            ) : (
              <span title={item.lead_name} style={LEAD_BADGE_STYLE}>{item.lead_name}</span>
            )
          )}
        </div>
        {/* `title` só quando o texto foi de fato cortado: comentário e resumo de
            visita são as fontes mais ricas de "o que já tentamos" e o conteúdo é
            o item, não o rótulo — sem isso o resto some sem afordância nenhuma.
            `title` nativo é o padrão da plataforma pra hint em elemento que já
            existe (regra 1 do CLAUDE.md). */}
        <div
          title={truncated ? fullDetail : undefined}
          style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.55, marginTop: 2, overflowWrap: "anywhere" }}
        >
          {formatDateBR(item.ts)}
          {actor && <> · <span style={{ color: item.actor_name ? "var(--text-dim)" : "var(--text-faint)" }}>{actor}</span></>}
          {detail && <> · {detail}</>}
        </div>
      </div>
    </div>
  );
}

export function ClientTimelinePanel({ clientId, deals = [], onOpenLead, onOpenViagem, onClose }) {
  const { items, loading, error } = useClientTimeline(clientId);
  const [onlyInteractions, setOnlyInteractions] = useState(false);

  // Histórico x agendado: visita ainda não realizada entra com ts =
  // data_planejada (data FUTURA). Como a lista é ts DESC, ela aparecia no TOPO
  // de uma aba chamada "Histórico", sob um cabeçalho de ano no futuro e com o
  // mesmo peso de uma visita que já aconteceu — e contava em "Só interações",
  // ou seja, virava "tentativa" que ainda não existiu. Separado aqui.
  const { passados, futuros } = useMemo(() => {
    const now = Date.now();
    const pass = [], fut = [];
    for (const it of items) {
      const d = parseDateInput(it.ts);
      (!Number.isNaN(d.getTime()) && d.getTime() > now ? fut : pass).push(it);
    }
    // fut vem em ts DESC (mais distante primeiro); o mais próximo é o que
    // interessa primeiro numa lista de "o que vem por aí".
    return { passados: pass, futuros: fut.slice().reverse() };
  }, [items]);

  const interacoesPassadas = useMemo(
    () => passados.filter(i => i.category === "interacao"), [passados]);

  const visible = onlyInteractions ? interacoesPassadas : passados;
  const visibleFuturos = onlyInteractions ? futuros.filter(i => i.category === "interacao") : futuros;

  // Agrupamento por ano — a RPC já entrega ordenado por ts DESC, então basta
  // quebrar quando o ano muda. parseDateInput (nunca `new Date(string)` cru,
  // regra do CLAUDE.md) resolve tanto timestamptz quanto data pura.
  const years = useMemo(() => {
    const out = [];
    for (const it of visible) {
      const d = parseDateInput(it.ts);
      const year = Number.isNaN(d.getTime()) ? "—" : d.getFullYear();
      if (!out.length || out[out.length - 1].year !== year) out.push({ year, items: [] });
      out[out.length - 1].items.push(it);
    }
    return out;
  }, [visible]);

  if (loading) {
    return <div className="text-xs text-center py-8" style={{ color: "var(--text-dim)" }}>Carregando histórico…</div>;
  }
  if (error) {
    // Bloqueio de acesso não é erro do sistema — a causa mais provável de cair
    // aqui é o gate da RPC (usuário sem empresa vinculada no perfil), que se
    // resolve no cadastro, não na tela. `--danger` fica reservado pra falha
    // real de rede/servidor.
    const isPermission = /sem permiss/i.test(error);
    return isPermission ? (
      <div className="text-xs rounded-lg" style={{ background: "var(--surface-alt)", color: "var(--text-dim)", padding: "10px 12px", lineHeight: 1.5 }}>
        Você não tem acesso ao histórico deste cliente. Se ele deveria aparecer, o mais
        provável é que seu usuário ainda não esteja vinculado a nenhuma frente comercial —
        peça pro admin vincular em Usuários.
      </div>
    ) : (
      <div className="text-xs rounded-lg" style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: "10px 12px", lineHeight: 1.5 }}>
        Não foi possível carregar o histórico deste cliente: {error}
      </div>
    );
  }

  // Estado vazio honesto: a base está praticamente vazia hoje, então quem
  // abre isto pela primeira vez PRECISA entender que a tela não está
  // quebrada — ela ainda não tem o que mostrar, e o que passa a alimentá-la.
  if (items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="O histórico deste cliente começa agora"
        description={
          <>
            <p>
              Nenhum registro deste cliente nas frentes comerciais que você acompanha. Esta
              linha do tempo se constrói sozinha, conforme o time trabalha — é ela que
              responde “o que já tentamos com esse cliente?” daqui a um ou dois anos.
            </p>
            <p className="mt-2.5">Passam a aparecer aqui, sem ninguém precisar preencher nada:</p>
            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
              {["visita", "comentario", "amostra", "follow_up", "email", "proposta", "posvenda"].map(kind => {
                const { label, icon: Icon } = timelineKindMeta(kind);
                return (
                  <span key={kind} className="inline-flex items-center gap-1"
                    style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                             background: "var(--surface-alt)", color: "var(--text-dim)" }}>
                    <Icon size={11} /> {label}
                  </span>
                );
              })}
            </div>
            <p className="mt-2.5" style={{ fontSize: 12, color: "var(--text-faint)" }}>
              Mudança de etapa e anexo também entram, como pano de fundo — no filtro “Tudo”.
            </p>
            {deals.length > 0 && (
              <p className="mt-2.5" style={{ fontSize: 12 }}>
                {deals.length === 1 ? "Há 1 negócio vinculado" : `Há ${deals.length} negócios vinculados`} a
                este cliente, ainda sem nenhum registro de interação.
              </p>
            )}
          </>
        }
      />
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      {/* Não prometer completude que o painel não pode entregar: o recorte da
          RPC é por frente comercial (current_user_companies), então um cliente
          pode ter negócio numa frente que este usuário não acompanha. */}
      <div className="text-xs" style={{ color: "var(--text-dim)", lineHeight: 1.5 }}>
        Registros deste cliente nas frentes comerciais que você acompanha, atravessando
        todos os negócios dele.
      </div>

      {/* Filtro: os eventos internos são pano de fundo — misturados com o
          mesmo peso, a linha vira ruído. Bolinha cheia = interação,
          bolinha vazada = evento interno (ou ainda não aconteceu). */}
      {/* maxWidth 100%: em 360px o par de botões cabe, mas o clipping é a
          degradação aceitável — nunca empurrar a largura do modal. */}
      <div className="inline-flex rounded-lg border overflow-hidden self-start"
        style={{ borderColor: "var(--border)", background: "var(--surface)", maxWidth: "100%" }} role="tablist">
        <ViewToggleButton active={!onlyInteractions} onClick={() => setOnlyInteractions(false)}
          icon={List} label={`Tudo (${passados.length})`} />
        <ViewToggleButton active={onlyInteractions} onClick={() => setOnlyInteractions(true)}
          icon={MessageCircle} label={`Só interações (${interacoesPassadas.length})`} />
      </div>

      {/* Agendado — fora do agrupamento por ano e fora da contagem acima: é o
          que AINDA VAI acontecer, não histórico. */}
      {visibleFuturos.length > 0 && (
        <div className="flex flex-col">
          <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "var(--text-dim)" }}>
              AGENDADO
            </span>
            <span aria-hidden style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)" }}>
              {visibleFuturos.length}
            </span>
          </div>
          {visibleFuturos.map((item, i) => (
            <TimelineItem
              key={`fut-${item.kind}-${item.ts}-${item.lead_id || ""}-${i}`}
              item={item}
              isLast={i === visibleFuturos.length - 1}
              isFuture
              deals={deals}
              onOpenLead={onOpenLead}
              onOpenViagem={onOpenViagem}
              onClose={onClose}
            />
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="text-xs rounded-lg" style={{ background: "var(--surface-alt)", color: "var(--text-dim)", padding: "12px", lineHeight: 1.5 }}>
          {passados.length === 0 ? (
            <>Nada aconteceu com este cliente ainda — só o que está agendado acima.</>
          ) : (
            <>
              Nenhuma interação com o cliente registrada ainda — só eventos internos.{" "}
              <button type="button" onClick={() => setOnlyInteractions(false)}
                className="font-semibold underline cursor-pointer"
                style={{ background: "none", border: "none", padding: 0, color: "var(--accent)" }}>
                Ver tudo
              </button>
            </>
          )}
        </div>
      ) : (
        years.map((group, gi) => (
          <div key={group.year} className="flex flex-col">
            {/* Marco de ano */}
            <div className="flex items-center" style={{ gap: 8, marginBottom: 10, marginTop: gi === 0 ? 0 : 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "var(--text-dim)" }}>
                {group.year}
              </span>
              <span aria-hidden style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)" }}>
                {group.items.length}
              </span>
            </div>
            {group.items.map((item, i) => (
              <TimelineItem
                key={`${item.kind}-${item.ts}-${item.lead_id || ""}-${i}`}
                item={item}
                isLast={i === group.items.length - 1}
                deals={deals}
                onOpenLead={onOpenLead}
                onOpenViagem={onOpenViagem}
                onClose={onClose}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
