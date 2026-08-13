import React, { useMemo, useState } from "react";
import { Download, Plus, Package, AlertTriangle, Pencil } from "lucide-react";
import { FilterBar } from "../shared/FilterBar";
import { Tabs } from "../shared/Tabs";
import { Modal } from "../ui/Modal";
import { AppToast } from "../shared/AppToast";
import { TableDensityToggle } from "../shared/TableDensityToggle";
import { useTableDensity } from "../../hooks/use-table-density";
import { useProducts } from "../../hooks/use-products";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { formatBRL } from "../../utils/currency";
import { csvRow, triggerDownload } from "../../utils/export-csv";
import { MarginRulesPanel } from "../catalogo/MarginRulesPanel";
import { VitrineFields } from "../catalogo/VitrineFields";

// Comercial → Catálogo. Padrão "Tabela com filtro" (regra 6 do CLAUDE.md,
// referência RHFuncionariosView): FilterBar + TableDensityToggle + Exportar
// CSV, e o <thead> renderiza SEMPRE — quando não há produto, a mensagem vai
// dentro do <tbody>, pra página vazia mostrar a estrutura em vez de parecer
// quebrada.
//
// O preço aqui é o PREÇO DE TABELA, do suporte comercial. O preço que o
// cliente paga nasce em outro lugar (Clientes → Produtos & Preços) e é do
// vendedor dono da conta.

// Certificação não é campo livre: a regra da Resibag é que INMETRO e ANTT
// 5998 valem só pras linhas homologadas. Marcar uma delas num produto que não
// tem a homologação vira erro de compliance numa vitrine que o cliente lê.
// Aqui o formulário oferece o vocabulário fechado; a trava por linha de
// produto entra junto com a aba Vitrine.
const CERTIFICACOES = [
  "INMETRO", "ANTT 5998", "NORMAM-05", "ANP", "ISO 9001", "FSSC 22000",
];

// As três da tripla homologação. Só aparecem no formulário se o produto for
// marcado como homologado — e o banco recusa de qualquer jeito (constraint
// products_certificacao_restrita), então esconder aqui é só cortesia.
const RESTRITAS = ["INMETRO", "ANTT 5998", "NORMAM-05"];

const UNIDADES = ["un", "kg", "m", "m²", "pç", "cx"];

function emptyForm(companyId) {
  return {
    company_id: companyId || COMPANY_IDS[0],
    sku: "", name: "", description: "",
    unit: "un", moq: "", preco_tabela: "",
    certifications: [], homologado: false, active: true,
    tagline: "", features: [], specs: [], applications: [],
    category: "", icon: "", proposed: false,
  };
}

function inputStyle() {
  return {
    width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "var(--text)",
  };
}

function Label({ children, hint }) {
  return (
    <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
      {hint && <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, marginLeft: 6, color: "var(--text-dim)" }}>{hint}</span>}
    </label>
  );
}

function ProductModal({ open, onClose, editing, onSave, companies, canEditComercial, canEditVitrine }) {
  const [aba, setAba] = useState("comercial");
  const [form, setForm]   = useState(emptyForm(companies[0]));
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState(null);
  const [seeded, setSeeded] = useState(null);

  // Semeia o formulário quando abre — depende do ID, não do objeto, pra um
  // refetch do Realtime no meio da digitação não apagar o que a pessoa
  // escreveu (mesma classe de bug já corrigida no modal de Chat).
  const key = editing?.id ?? "novo";
  if (open && seeded !== key) {
    setSeeded(key);
    setForm(editing
      ? {
          company_id: editing.company_id, sku: editing.sku, name: editing.name,
          description: editing.description || "", unit: editing.unit,
          moq: editing.moq ?? "", preco_tabela: editing.preco_tabela ?? "",
          certifications: editing.certifications || [], homologado: editing.homologado,
          active: editing.active,
          tagline: editing.tagline || "", features: editing.features || [],
          specs: Array.isArray(editing.specs) ? editing.specs : [],
          applications: editing.applications || [], category: editing.category || "",
          icon: editing.icon || "", proposed: editing.proposed,
        }
      : emptyForm(companies[0]));
    setAba(canEditComercial ? "comercial" : "vitrine");
    setErr(null);
  }
  if (!open && seeded !== null) setSeeded(null);

  const toggleCert = (c) => setForm(f => ({
    ...f,
    certifications: f.certifications.includes(c)
      ? f.certifications.filter(x => x !== c)
      : [...f.certifications, c],
  }));

  const handleSave = async () => {
    if (!form.sku.trim() || !form.name.trim()) { setErr("Código e nome são obrigatórios."); return; }
    setSaving(true); setErr(null);
    try {
      await onSave({
        company_id: form.company_id,
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        unit: form.unit,
        moq: form.moq === "" ? null : Number(form.moq),
        preco_tabela: form.preco_tabela === "" ? null : Number(form.preco_tabela),
        certifications: form.certifications,
        homologado: form.homologado,
        active: form.active,
        tagline: form.tagline.trim() || null,
        features: form.features,
        specs: form.specs,
        applications: form.applications,
        category: form.category || null,
        icon: form.icon || null,
        proposed: form.proposed,
      });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Editar produto" : "Novo produto"} width={520}>
      <div className="space-y-3.5">
        {/* Duas metades, dois donos: o comercial é do suporte, a vitrine é do
            Marketing. Quem garante isso é o trigger no banco — aqui só
            escondemos a caneta de quem não tem. */}
        <Tabs
          tabs={[{ id: "comercial", label: "Comercial" }, { id: "vitrine", label: "Vitrine" }]}
          active={aba}
          onChange={setAba}
        />

        {aba === "comercial" && (<>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Empresa *</Label>
            <select style={inputStyle()} value={form.company_id}
                    onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}>
              {companies.map(c => <option key={c} value={c}>{COMPANIES[c]?.name || c}</option>)}
            </select>
          </div>
          <div>
            <Label>Código *</Label>
            <input style={inputStyle()} value={form.sku} placeholder="SAN-BB-1000"
                   onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
          </div>
        </div>

        <div>
          <Label>Nome *</Label>
          <input style={inputStyle()} value={form.name} placeholder="Sanbag Standard 1000 kg"
                 onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Unidade</Label>
            <select style={inputStyle()} value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
              {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <Label>Pedido mínimo</Label>
            <input style={inputStyle()} type="number" min="1" value={form.moq} placeholder="—"
                   onChange={e => setForm(f => ({ ...f, moq: e.target.value }))} />
          </div>
          <div>
            <Label>Preço de tabela</Label>
            <input style={inputStyle()} type="number" min="0" step="0.01" value={form.preco_tabela} placeholder="—"
                   onChange={e => setForm(f => ({ ...f, preco_tabela: e.target.value }))} />
          </div>
        </div>

        {form.preco_tabela === "" && (
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--warning)" }}>
            Sem preço de tabela o produto entra como incompleto: o vendedor não
            consegue calcular margem e o guarda-corpo da gerência não se aplica.
          </p>
        )}

        <div>
          <Label>Certificações</Label>
          <div className="flex flex-wrap gap-1.5">
            {CERTIFICACOES.filter(c => form.homologado || !RESTRITAS.includes(c)).map(c => {
              const on = form.certifications.includes(c);
              return (
                <button key={c} type="button" onClick={() => toggleCert(c)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors"
                        style={{
                          background: on ? "var(--accent-tint)" : "var(--surface)",
                          borderColor: on ? "var(--accent)" : "var(--border)",
                          color: on ? "var(--accent)" : "var(--text-dim)",
                        }}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-start gap-2 text-[13px]" style={{ color: "var(--text)" }}>
          <input type="checkbox" checked={form.homologado} className="mt-0.5"
                 onChange={() => setForm(f => ({
                   ...f,
                   homologado: !f.homologado,
                   // Desmarcar homologação tem que limpar as três restritas
                   // junto, senão o banco recusa o save e a pessoa não entende
                   // por quê — a certificação some da tela mas continua no
                   // formulário.
                   certifications: f.homologado
                     ? f.certifications.filter(c => !RESTRITAS.includes(c))
                     : f.certifications,
                 }))} />
          <span>
            Homologado
            <span className="block text-[11px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
              Tripla homologação INMETRO + ANTT 5998 + NORMAM-05. Sem isso
              marcado, essas três certificações não podem ser atribuídas.
            </span>
          </span>
        </label>

        <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text)" }}>
          <input type="checkbox" checked={form.active}
                 onChange={() => setForm(f => ({ ...f, active: !f.active }))} />
          Ativo no catálogo
        </label>
        </>)}

        {aba === "vitrine" && (
          <VitrineFields form={form} setForm={setForm} disabled={!canEditVitrine} />
        )}

        {err && (
          <div className="rounded-lg px-3 py-2 text-xs"
               style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function CatalogoView({ activeCompany, accessibleCompanies = COMPANY_IDS, canEdit = false, canEditRules = false, canEditVitrine = false }) {
  const { products, loading, stats, createProduct, updateProduct } = useProducts();
  const [tab, setTab]           = useState("produtos");
  const [search, setSearch]     = useState("");
  const [empresa, setEmpresa]   = useState("all");
  const [status, setStatus]     = useState("ativos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [toast, setToast]       = useState(null);
  const { density, setDensity } = useTableDensity("catalogo-table-density");

  const rowPad = density === "compact" ? "6px 12px 6px 0" : "11px 12px 11px 0";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (empresa !== "all" && p.company_id !== empresa) return false;
      if (status === "ativos" && !p.active) return false;
      if (status === "inativos" && p.active) return false;
      if (status === "sem-tabela" && p.preco_tabela != null) return false;
      if (!q) return true;
      return p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    });
  }, [products, search, empresa, status]);

  // Exporta o array JÁ FILTRADO que a tela mostra, nunca o cru (regra 11).
  const handleExport = () => {
    const header = ["Código", "Produto", "Empresa", "Unidade", "Pedido mínimo", "Preço de tabela", "Certificações", "Status"];
    const rows = filtered.map(p => csvRow([
      p.sku, p.name, COMPANIES[p.company_id]?.name || p.company_id, p.unit,
      p.moq ?? "", p.preco_tabela ?? "", (p.certifications || []).join(" | "),
      p.active ? "Ativo" : "Inativo",
    ]));
    triggerDownload("catalogo.csv", [csvRow(header), ...rows].join("\n"));
  };

  const handleSave = async (payload) => {
    if (editing) await updateProduct(editing.id, payload);
    else await createProduct(payload);
    setToast(editing ? "Produto atualizado." : "Produto cadastrado.");
  };

  const openNew  = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p) => { setEditing(p); setModalOpen(true); };

  const tabs = [
    { id: "produtos", label: "Produtos" },
    ...(canEditRules ? [{ id: "margem", label: "Regras de margem" }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Header fora de qualquer condicional de aba — regra 11. */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text)", letterSpacing: "-0.015em" }}>
            Catálogo
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
            {stats.ativos} produto{stats.ativos === 1 ? "" : "s"} ativo{stats.ativos === 1 ? "" : "s"}
            {" · preço de tabela mantido pelo suporte comercial"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
            <Download size={13} /> Exportar CSV
          </button>
          {canEdit && (
            <button onClick={openNew} data-tour="catalogo-novo-produto"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
                    style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              <Plus size={13} /> Novo produto
            </button>
          )}
        </div>
      </div>

      {tabs.length > 1 && <Tabs tabs={tabs} active={tab} onChange={setTab} />}

      {tab === "margem" && canEditRules ? (
        <MarginRulesPanel products={products} accessibleCompanies={accessibleCompanies} />
      ) : (
        <>
          {stats.semTabela > 0 && (
            <div className="rounded-lg px-3.5 py-2.5 text-xs flex items-center gap-2"
                 style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
              <AlertTriangle size={14} style={{ flex: "none" }} />
              {stats.semTabela} produto{stats.semTabela === 1 ? "" : "s"} ativo{stats.semTabela === 1 ? "" : "s"} sem preço de tabela — o guarda-corpo de margem não se aplica a {stats.semTabela === 1 ? "ele" : "eles"}.
            </div>
          )}

          <FilterBar
            search={{ value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Buscar por código ou nome…" }}
            filters={[
              {
                id: "empresa", value: empresa, onChange: (e) => setEmpresa(e.target.value), label: "Empresa",
                options: [{ value: "all", label: "Todas as empresas" },
                          ...accessibleCompanies.map(c => ({ value: c, label: COMPANIES[c]?.name || c }))],
              },
              {
                id: "status", value: status, onChange: (e) => setStatus(e.target.value), label: "Status",
                options: [
                  { value: "ativos", label: "Ativos" },
                  { value: "inativos", label: "Inativos" },
                  { value: "sem-tabela", label: "Sem preço de tabela" },
                  { value: "all", label: "Todos" },
                ],
              },
            ]}
            trailing={<TableDensityToggle density={density} onChange={setDensity} />}
          />

          <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
            <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 720 }}>
              {/* thead SEMPRE renderiza — página sem dado mostra a estrutura. */}
              <thead>
                <tr>
                  {["Código", "Produto", "Empresa", "Un", "Mín.", "Preço de tabela", "Certificações", ""].map((h, i) => (
                    <th key={h + i}
                        className="text-left px-0 pb-2 pt-3"
                        style={{
                          fontSize: 10, fontWeight: 650, letterSpacing: "0.11em", textTransform: "uppercase",
                          color: "var(--text-dim)", borderBottom: "1px solid var(--border)",
                          paddingLeft: i === 0 ? 14 : 0, paddingRight: 12, whiteSpace: "nowrap",
                          textAlign: ["Mín.", "Preço de tabela"].includes(h) ? "right" : "left",
                        }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-xs" style={{ color: "var(--text-dim)" }}>Carregando…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <Package size={22} style={{ color: "var(--text-dim)", margin: "0 auto 8px" }} />
                      <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                        {products.length === 0 ? "Nenhum produto cadastrado ainda" : "Nenhum produto com esses filtros"}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
                        {products.length === 0
                          ? "O catálogo é a base de tudo: sem produto cadastrado, não há o que liberar para cliente nem o que pedir no portal."
                          : "Ajuste a busca ou os filtros acima."}
                      </p>
                      {products.length === 0 && canEdit && (
                        <button onClick={openNew} className="mt-3 px-3 py-1.5 rounded-lg text-xs font-bold"
                                style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                          Cadastrar o primeiro produto
                        </button>
                      )}
                    </td>
                  </tr>
                ) : filtered.map(p => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border-subtle, var(--border))", opacity: p.active ? 1 : 0.55 }}>
                    <td style={{ padding: rowPad, paddingLeft: 14, fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>{p.sku}</td>
                    <td style={{ padding: rowPad, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{p.name}</td>
                    <td style={{ padding: rowPad, fontSize: 12 }}>
                      <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold"
                            style={{ background: "var(--surface-alt)", color: COMPANIES[p.company_id]?.primary || "var(--text-dim)" }}>
                        {COMPANIES[p.company_id]?.name || p.company_id}
                      </span>
                    </td>
                    <td style={{ padding: rowPad, fontSize: 12, color: "var(--text-dim)" }}>{p.unit}</td>
                    <td style={{ padding: rowPad, fontSize: 12, color: "var(--text-dim)", textAlign: "right" }}>{p.moq ?? "—"}</td>
                    <td style={{ padding: rowPad, fontSize: 13, textAlign: "right", whiteSpace: "nowrap",
                                 color: p.preco_tabela == null ? "var(--warning)" : "var(--text)",
                                 fontWeight: p.preco_tabela == null ? 650 : 600 }}>
                      {p.preco_tabela == null ? "sem tabela" : formatBRL(p.preco_tabela)}
                    </td>
                    <td style={{ padding: rowPad, fontSize: 11 }}>
                      {(p.certifications || []).length === 0
                        ? <span style={{ color: "var(--text-dim)" }}>—</span>
                        : p.certifications.map(c => (
                            <span key={c} className="inline-block px-1.5 py-0.5 rounded mr-1 mb-0.5 text-[10px] font-bold"
                                  style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>{c}</span>
                          ))}
                    </td>
                    <td style={{ padding: rowPad, paddingRight: 14, textAlign: "right" }}>
                      {canEdit && (
                        <button onClick={() => openEdit(p)} title="Editar produto"
                                className="p-1.5 rounded-lg" style={{ color: "var(--text-dim)" }}>
                          <Pencil size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSave={handleSave}
        companies={accessibleCompanies}
        canEditComercial={canEdit}
        canEditVitrine={canEditVitrine}
      />

      {toast && <AppToast title={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

export default CatalogoView;
