import React, { useMemo, useState } from "react";
import {
  Building2, Plus, X, FileText, Calendar, DollarSign, Clock, ChevronDown, ChevronUp,
} from "lucide-react";
import { useRHSuppliers } from "../../hooks/use-rh-suppliers";
import { formatK } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";
import { CurrencyInput } from "../ui/CurrencyInput";

const TIPO_LABELS = {
  convenio_medico: "Convênio médico",
  seguradora: "Seguradora",
  terceirizada_rh: "Terceirizada de RH",
  outro: "Outro",
};

const STATUS_COLORS = {
  ativo: { bg: "#DCFCE7", text: "#16A34A" },
  vencido: { bg: "#FEE2E2", text: "#DC2626" },
  renovacao_pendente: { bg: "#FEF3C7", text: "#D97706" },
  cancelado: { bg: "var(--surface-alt)", text: "var(--text-dim)" },
};

const STATUS_LABELS = {
  ativo: "Ativo",
  vencido: "Vencido",
  renovacao_pendente: "Renovação pendente",
  cancelado: "Cancelado",
};

const EVENTO_TIPO_LABELS = {
  reajuste: "Reajuste de valor",
  renovacao: "Renovação",
  fatura: "Fatura",
  nota: "Nota fiscal",
  orcamento: "Orçamento",
  compra: "Compra",
  outro: "Outro",
};

function labelSt() {
  return { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
}

function NovoFornecedorModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name: "", tipo: "convenio_medico", contactName: "", email: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Nome é obrigatório."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full text-sm rounded-xl border px-3 py-2 outline-none";
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "var(--shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Novo fornecedor</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)" }}><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: "20px 24px 24px" }} className="flex flex-col gap-3">
          <div>
            <label style={labelSt()}>Nome *</label>
            <input autoFocus className={inputCls} style={inputSt} value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={labelSt()}>Tipo</label>
            <select className={inputCls} style={inputSt} value={form.tipo} onChange={(e) => setForm(f => ({ ...f, tipo: e.target.value }))}>
              {Object.entries(TIPO_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelSt()}>Contato</label>
              <input className={inputCls} style={inputSt} value={form.contactName} onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))} />
            </div>
            <div>
              <label style={labelSt()}>Telefone</label>
              <input className={inputCls} style={inputSt} value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={labelSt()}>E-mail</label>
            <input type="email" className={inputCls} style={inputSt} value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label style={labelSt()}>Notas</label>
            <textarea rows={2} className={inputCls} style={inputSt} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          {error && <div style={{ fontSize: 12, color: "var(--danger)" }}>{error}</div>}
          <div className="flex gap-2 mt-2">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
              {saving ? "Salvando…" : "Cadastrar"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NovoContratoModal({ fornecedorId, onSave, onClose }) {
  const [form, setForm] = useState({ titulo: "", vigenciaInicio: "", vigenciaFim: "", valor: "", status: "ativo" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) { setError("Título é obrigatório."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...form, fornecedorId, valor: form.valor ? Number(form.valor) : null });
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full text-sm rounded-xl border px-3 py-2 outline-none";
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "var(--shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Novo contrato</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)" }}><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: "20px 24px 24px" }} className="flex flex-col gap-3">
          <div>
            <label style={labelSt()}>Título *</label>
            <input autoFocus className={inputCls} style={inputSt} placeholder="Ex: Plano Sanwey 2026" value={form.titulo} onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelSt()}>Início da vigência</label>
              <input type="date" className={inputCls} style={inputSt} value={form.vigenciaInicio} onChange={(e) => setForm(f => ({ ...f, vigenciaInicio: e.target.value }))} />
            </div>
            <div>
              <label style={labelSt()}>Fim da vigência</label>
              <input type="date" className={inputCls} style={inputSt} value={form.vigenciaFim} onChange={(e) => setForm(f => ({ ...f, vigenciaFim: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelSt()}>Valor (R$)</label>
              <CurrencyInput className={inputCls} style={inputSt} value={form.valor} onChange={(v) => setForm(f => ({ ...f, valor: v }))} />
            </div>
            <div>
              <label style={labelSt()}>Status</label>
              <select className={inputCls} style={inputSt} value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: "var(--danger)" }}>{error}</div>}
          <div className="flex gap-2 mt-2">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
              {saving ? "Salvando…" : "Criar contrato"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NovoEventoForm({ contratoId, onSave, onDone }) {
  const [form, setForm] = useState({ tipo: "fatura", valorAnterior: "", valorNovo: "", descricao: "", dataEvento: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        contratoId, tipo: form.tipo, descricao: form.descricao || null, dataEvento: form.dataEvento,
        valorAnterior: form.valorAnterior ? Number(form.valorAnterior) : null,
        valorNovo: form.valorNovo ? Number(form.valorNovo) : null,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full text-xs rounded-lg border px-2 py-1.5 outline-none";
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)" };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: "var(--surface-alt)" }}>
      <div className="grid grid-cols-2 gap-2">
        <select className={inputCls} style={inputSt} value={form.tipo} onChange={(e) => setForm(f => ({ ...f, tipo: e.target.value }))}>
          {Object.entries(EVENTO_TIPO_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <input type="date" className={inputCls} style={inputSt} value={form.dataEvento} onChange={(e) => setForm(f => ({ ...f, dataEvento: e.target.value }))} />
      </div>
      {form.tipo === "reajuste" && (
        <div className="grid grid-cols-2 gap-2">
          <CurrencyInput placeholder="Valor anterior" className={inputCls} style={inputSt} value={form.valorAnterior} onChange={(v) => setForm(f => ({ ...f, valorAnterior: v }))} />
          <CurrencyInput placeholder="Valor novo" className={inputCls} style={inputSt} value={form.valorNovo} onChange={(v) => setForm(f => ({ ...f, valorNovo: v }))} />
        </div>
      )}
      <input placeholder="Descrição (opcional)" className={inputCls} style={inputSt} value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} />
      <div className="flex gap-2">
        <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>
          {saving ? "Salvando…" : "Registrar evento"}
        </button>
        <button type="button" onClick={onDone} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ContratoRow({ contrato, eventos, onAddEvento }) {
  const [expanded, setExpanded] = useState(false);
  const [addingEvento, setAddingEvento] = useState(false);
  const statusColor = STATUS_COLORS[contrato.status] || STATUS_COLORS.ativo;
  const contratoEventos = eventos.filter(e => e.contratoId === contrato.id);

  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-3"
        style={{ background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{contrato.titulo}</div>
          <div className="flex items-center gap-3 mt-1" style={{ fontSize: 11, color: "var(--text-dim)" }}>
            {contrato.vigenciaInicio && (
              <span className="flex items-center gap-1"><Calendar size={10} /> {formatDateBR(contrato.vigenciaInicio)}{contrato.vigenciaFim ? ` – ${formatDateBR(contrato.vigenciaFim)}` : ""}</span>
            )}
            {contrato.valor != null && <span className="flex items-center gap-1"><DollarSign size={10} /> {formatK(contrato.valor)}</span>}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: statusColor.text, background: statusColor.bg, borderRadius: 99, padding: "2px 10px" }}>
          {STATUS_LABELS[contrato.status] || contrato.status}
        </span>
        {expanded ? <ChevronUp size={14} style={{ color: "var(--text-dim)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-dim)" }} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          {contratoEventos.length === 0 && !addingEvento && (
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Nenhum evento registrado ainda.</div>
          )}
          {contratoEventos.map(ev => (
            <div key={ev.id} className="flex items-start gap-2" style={{ fontSize: 12 }}>
              <Clock size={12} style={{ color: "var(--text-dim)", marginTop: 2, flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{EVENTO_TIPO_LABELS[ev.tipo] || ev.tipo}</span>
                {" "}<span style={{ color: "var(--text-dim)" }}>{formatDateBR(ev.dataEvento)}</span>
                {ev.tipo === "reajuste" && ev.valorNovo != null && (
                  <span style={{ color: "var(--text-dim)" }}> · {ev.valorAnterior != null ? `${formatK(ev.valorAnterior)} → ` : ""}{formatK(ev.valorNovo)}</span>
                )}
                {ev.descricao && <div style={{ color: "var(--text-dim)" }}>{ev.descricao}</div>}
              </div>
            </div>
          ))}
          {addingEvento ? (
            <NovoEventoForm contratoId={contrato.id} onSave={onAddEvento} onDone={() => setAddingEvento(false)} />
          ) : (
            <button
              onClick={() => setAddingEvento(true)}
              className="flex items-center gap-1.5 self-start"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
            >
              <Plus size={12} /> Registrar evento (reajuste, renovação, fatura…)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FornecedorDrawer({ fornecedor, contratos, eventos, onClose, onCreateContrato, onAddEvento }) {
  const [novoContratoOpen, setNovoContratoOpen] = useState(false);
  const fornecedorContratos = contratos.filter(c => c.fornecedorId === fornecedor.id);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} onClick={onClose} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: "var(--surface)", zIndex: 1000, display: "flex", flexDirection: "column", boxShadow: "var(--shadow-pop)", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{fornecedor.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{TIPO_LABELS[fornecedor.tipo] || fornecedor.tipo}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)" }}><X size={18} /></button>
        </div>

        <div style={{ padding: "20px 24px", flex: 1 }}>
          {(fornecedor.contactName || fornecedor.email || fornecedor.phone) && (
            <div style={{ marginBottom: 20, fontSize: 12, color: "var(--text)" }}>
              {fornecedor.contactName && <div>{fornecedor.contactName}</div>}
              {fornecedor.email && <div style={{ color: "var(--text-dim)" }}>{fornecedor.email}</div>}
              {fornecedor.phone && <div style={{ color: "var(--text-dim)" }}>{fornecedor.phone}</div>}
            </div>
          )}
          {fornecedor.notes && (
            <div style={{ marginBottom: 20, fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>{fornecedor.notes}</div>
          )}

          <div className="flex items-center justify-between mb-3">
            <div style={labelSt()}>Contratos</div>
            <button
              onClick={() => setNovoContratoOpen(true)}
              className="flex items-center gap-1"
              style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
            >
              <Plus size={12} /> Novo contrato
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {fornecedorContratos.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Nenhum contrato cadastrado ainda.</div>
            )}
            {fornecedorContratos.map(c => (
              <ContratoRow key={c.id} contrato={c} eventos={eventos} onAddEvento={onAddEvento} />
            ))}
          </div>
        </div>
      </div>

      {novoContratoOpen && (
        <NovoContratoModal fornecedorId={fornecedor.id} onSave={onCreateContrato} onClose={() => setNovoContratoOpen(false)} />
      )}
    </>
  );
}

export function RHFornecedoresView({ currentUser }) {
  const { suppliers, contratos, eventos, loading, createSupplier, createContrato, addEvento } = useRHSuppliers({ userId: currentUser?.id });
  const [novoOpen, setNovoOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(() => suppliers.find(s => s.id === selectedId) || null, [suppliers, selectedId]);
  const contratoCountByFornecedor = useMemo(() => {
    const map = new Map();
    for (const c of contratos) {
      if (c.status !== "ativo") continue;
      map.set(c.fornecedorId, (map.get(c.fornecedorId) || 0) + 1);
    }
    return map;
  }, [contratos]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Building2 size={22} style={{ color: "var(--text)" }} />
          <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>Fornecedores</h1>
        </div>
        <button
          onClick={() => setNovoOpen(true)}
          className="flex items-center gap-1.5 font-semibold"
          style={{ background: "var(--accent)", color: "#FFF", border: "none", borderRadius: 10, padding: "6px 16px", fontSize: 13, cursor: "pointer" }}
        >
          <Plus size={14} /> Novo fornecedor
        </button>
      </div>
      <p className="text-sm" style={{ color: "var(--text-dim)", marginTop: -8 }}>
        Convênio médico, seguradora, terceirizada de RH — cadastro, contrato (vigência/valor) e histórico de reajustes, renovações, faturas e orçamentos.
      </p>

      {loading ? (
        <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>Carregando…</div>
      ) : suppliers.length === 0 ? (
        <div className="p-8 rounded-xl border text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <FileText size={24} style={{ color: "var(--text-dim)", margin: "0 auto 8px" }} />
          <div className="text-sm" style={{ color: "var(--text-dim)" }}>Nenhum fornecedor cadastrado ainda.</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {suppliers.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className="text-left rounded-xl border p-4"
              style={{ background: "var(--surface)", borderColor: "var(--border)", cursor: "pointer" }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{s.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{TIPO_LABELS[s.tipo] || s.tipo}</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>
                {contratoCountByFornecedor.get(s.id) || 0} contrato(s) ativo(s)
              </div>
            </button>
          ))}
        </div>
      )}

      {novoOpen && (
        <NovoFornecedorModal onSave={createSupplier} onClose={() => setNovoOpen(false)} />
      )}

      {selected && (
        <FornecedorDrawer
          fornecedor={selected}
          contratos={contratos}
          eventos={eventos}
          onClose={() => setSelectedId(null)}
          onCreateContrato={createContrato}
          onAddEvento={addEvento}
        />
      )}
    </div>
  );
}

export default RHFornecedoresView;
