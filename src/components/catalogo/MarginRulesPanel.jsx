import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { COMPANIES } from "../../constants/companies";
import { AppToast } from "../shared/AppToast";
import { Modal } from "../ui/Modal";

// Catálogo → Regras de margem. Só gerência edita (RLS em margin_rules).
//
// UM EIXO SÓ, COM SINAL — a variação percentual sobre o preço de tabela:
//   preco_cliente = preco_tabela × (1 + pct/100)
//   +20 = vende 20% acima da tabela · -10 = concede 10% de desconto
// Foi decisão explícita: "margem em cima" e "até tanto de desconto" são a
// mesma reta vista de lados opostos, e dois campos com a mesma grandeza em
// unidades diferentes é como esse tipo de regra vira bug.

function pct(v) {
  if (v == null) return "—";
  const n = Number(v);
  return `${n > 0 ? "+" : ""}${n.toFixed(2).replace(".", ",")}%`;
}

function inputStyle() {
  return {
    width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "var(--text)",
  };
}

function Label({ children }) {
  return (
    <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
    </label>
  );
}

function RuleModal({ open, onClose, onSave, products, companies, editing }) {
  const [form, setForm] = useState({ company_id: companies[0], product_id: "", aviso: "", minimo: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [seeded, setSeeded] = useState(null);

  const key = editing?.id ?? "novo";
  if (open && seeded !== key) {
    setSeeded(key);
    setForm(editing
      ? {
          company_id: editing.company_id,
          product_id: editing.product_id || "",
          aviso: editing.margem_aviso_pct ?? "",
          minimo: editing.margem_minima_pct ?? "",
        }
      : { company_id: companies[0], product_id: "", aviso: "", minimo: "" });
    setErr(null);
  }
  if (!open && seeded !== null) setSeeded(null);

  const handleSave = async () => {
    if (form.aviso === "" && form.minimo === "") {
      setErr("Preencha ao menos um dos dois: o patamar de aviso ou o mínimo.");
      return;
    }
    if (form.aviso !== "" && form.minimo !== "" && Number(form.aviso) < Number(form.minimo)) {
      setErr("O aviso não pode ficar abaixo do mínimo — nunca dispararia, porque abaixo do mínimo o sistema já recusa.");
      return;
    }
    setSaving(true); setErr(null);
    try {
      await onSave({
        company_id: form.company_id,
        product_id: form.product_id || null,
        margem_aviso_pct: form.aviso === "" ? null : Number(form.aviso),
        margem_minima_pct: form.minimo === "" ? null : Number(form.minimo),
      });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const doProduto = products.filter(p => p.company_id === form.company_id && p.active);

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Editar regra" : "Nova regra de margem"} width={480}>
      <div className="space-y-3.5">
        <div>
          <Label>Empresa</Label>
          <select style={inputStyle()} value={form.company_id} disabled={Boolean(editing)}
                  onChange={e => setForm(f => ({ ...f, company_id: e.target.value, product_id: "" }))}>
            {companies.map(c => <option key={c} value={c}>{COMPANIES[c]?.name || c}</option>)}
          </select>
        </div>

        <div>
          <Label>Aplica a</Label>
          <select style={inputStyle()} value={form.product_id} disabled={Boolean(editing)}
                  onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
            <option value="">Todos os produtos da empresa (regra padrão)</option>
            {doProduto.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
          <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--text-dim)" }}>
            Regra de um produto específico ganha da regra padrão da empresa.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Avisar abaixo de</Label>
            <input style={inputStyle()} type="number" step="0.01" value={form.aviso} placeholder="ex.: 15"
                   onChange={e => setForm(f => ({ ...f, aviso: e.target.value }))} />
          </div>
          <div>
            <Label>Nunca abaixo de</Label>
            <input style={inputStyle()} type="number" step="0.01" value={form.minimo} placeholder="ex.: -10"
                   onChange={e => setForm(f => ({ ...f, minimo: e.target.value }))} />
          </div>
        </div>

        <div className="rounded-lg px-3 py-2.5 text-[11.5px] leading-relaxed"
             style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
          O número é a variação sobre o preço de tabela. <strong style={{ color: "var(--text)" }}>+20</strong> vende 20% acima
          da tabela; <strong style={{ color: "var(--text)" }}>−10</strong> concede 10% de desconto. Deixe um dos dois em branco
          para usar só o outro.
        </div>

        {err && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="px-3.5 py-2 rounded-lg text-xs font-bold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function MarginRulesPanel({ products = [], accessibleCompanies = [] }) {
  const [rules, setRules]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast]   = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("margin_rules")
      .select("id, company_id, product_id, margem_aviso_pct, margem_minima_pct, active")
      .eq("active", true);
    if (!error) setRules(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const productsById = useMemo(
    () => Object.fromEntries(products.map(p => [p.id, p])), [products]);

  const handleSave = async (payload) => {
    const userId = (await supabase.auth.getUser()).data?.user?.id ?? null;
    if (editing) {
      const { error } = await supabase.from("margin_rules")
        .update({ margem_aviso_pct: payload.margem_aviso_pct, margem_minima_pct: payload.margem_minima_pct, updated_by: userId })
        .eq("id", editing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("margin_rules").insert({ ...payload, updated_by: userId });
      if (error) throw new Error(error.message);
    }
    await fetchAll();
    setToast(editing ? "Regra atualizada." : "Regra criada.");
  };

  const handleDelete = async (rule) => {
    const { error } = await supabase.from("margin_rules").delete().eq("id", rule.id);
    if (error) { setToast(error.message); return; }
    await fetchAll();
    setToast("Regra removida.");
  };

  const padroes  = rules.filter(r => !r.product_id);
  const excecoes = rules.filter(r => r.product_id);

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)", maxWidth: "64ch" }}>
        O vendedor calcula o preço do cliente somando margem em cima do preço de tabela.
        Aqui a gerência define até onde ele pode ir sozinho — e a partir de onde o sistema recusa.
        Sem regra cadastrada, não há aviso nem trava.
      </p>

      <div>
        <p className="text-[10px] font-bold uppercase mb-2" style={{ color: "var(--text-dim)", letterSpacing: "0.13em" }}>
          Regra padrão por empresa
        </p>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {accessibleCompanies.map((c, i) => {
            const rule = padroes.find(r => r.company_id === c);
            return (
              <div key={c} className="flex items-center gap-3 px-3.5 py-3"
                   style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)", background: "var(--surface)" }}>
                <span className="flex-1 text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                  {COMPANIES[c]?.name || c}
                </span>
                {rule ? (
                  <>
                    <span className="text-xs" style={{ color: "var(--warning)" }}>avisa abaixo de {pct(rule.margem_aviso_pct)}</span>
                    <span className="text-xs" style={{ color: "var(--danger)" }}>recusa abaixo de {pct(rule.margem_minima_pct)}</span>
                    <button onClick={() => { setEditing(rule); setModalOpen(true); }}
                            className="text-[11px] font-bold px-2 py-1 rounded" style={{ color: "var(--accent)" }}>
                      Editar
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setEditing(null); setModalOpen(true); }}
                          className="text-[11px] font-bold px-2 py-1 rounded" style={{ color: "var(--accent)" }}>
                    Definir
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text-dim)", letterSpacing: "0.13em" }}>
            Exceções por produto
          </p>
          <button onClick={() => { setEditing(null); setModalOpen(true); }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded"
                  style={{ color: "var(--accent)" }}>
            <Plus size={12} /> Adicionar exceção
          </button>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {loading ? (
            <p className="px-3.5 py-4 text-xs" style={{ color: "var(--text-dim)" }}>Carregando…</p>
          ) : excecoes.length === 0 ? (
            <p className="px-3.5 py-4 text-xs" style={{ color: "var(--text-dim)" }}>
              Nenhuma exceção. Todos os produtos seguem a regra padrão da empresa.
            </p>
          ) : excecoes.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 px-3.5 py-3"
                 style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)", background: "var(--surface)" }}>
              <span className="flex-1 text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                {productsById[r.product_id]?.name || "Produto removido"}
              </span>
              <span className="text-xs" style={{ color: "var(--warning)" }}>avisa {pct(r.margem_aviso_pct)}</span>
              <span className="text-xs" style={{ color: "var(--danger)" }}>recusa {pct(r.margem_minima_pct)}</span>
              <button onClick={() => { setEditing(r); setModalOpen(true); }}
                      className="text-[11px] font-bold px-2 py-1 rounded" style={{ color: "var(--accent)" }}>
                Editar
              </button>
              <button onClick={() => handleDelete(r)} title="Remover exceção"
                      className="p-1 rounded" style={{ color: "var(--danger)" }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <RuleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        products={products}
        companies={accessibleCompanies}
        editing={editing}
      />

      {toast && <AppToast title={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

export default MarginRulesPanel;
