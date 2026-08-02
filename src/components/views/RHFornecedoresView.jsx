import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Plus, X, FileText, Calendar, DollarSign, Clock, ChevronDown, ChevronUp, List, LayoutGrid, Search, Bot, Trash2,
} from "lucide-react";
import { AgentBuilderWizard } from "../agents/AgentBuilderWizard";
import { useRHSuppliers } from "../../hooks/use-rh-suppliers";
import { useProfiles } from "../../hooks/use-profiles";
import { formatK } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";
import { contratoFornecedorDiasParaVencer } from "../../utils/rh-compliance-dates";
import { ROUTES } from "../../constants/routes";
import { CurrencyInput } from "../ui/CurrencyInput";
import { Tabs } from "../shared/Tabs";
import { FilterBar } from "../shared/FilterBar";
import { Card, CardGrid, CardSkeleton, GridListToggle } from "../shared/Card";
import { Badge } from "../ui/Badge";
import { StatCard } from "../ui/StatCard";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";
import { AppToast } from "../shared/AppToast";

const TIPO_LABELS = {
  convenio_medico: "Convênio médico",
  seguradora: "Seguradora",
  terceirizada_rh: "Terceirizada de RH",
  grafica: "Gráfica",
  uniformes: "Uniformes",
  agencia_marketing: "Agência de Marketing",
  fotografo_videomaker: "Fotógrafo/Vídeomaker",
  outro: "Outro",
};

const STATUS_COLORS = {
  ativo: { bg: "var(--success-bg)", text: "var(--success)" },
  vencido: { bg: "var(--danger-bg)", text: "var(--danger)" },
  renovacao_pendente: { bg: "var(--warning-bg)", text: "var(--warning)" },
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

const EMPTY_FORNECEDOR_FORM = { name: "", tipo: "convenio_medico", contactName: "", email: "", phone: "", notes: "" };

function NovoFornecedorModal({ onSave, onClose }) {
  const [form, setForm] = useState(EMPTY_FORNECEDOR_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Clicar fora não deve zerar o que já foi digitado — pede confirmação se
  // o formulário estiver sujo, mesmo padrão do cadastro de Funcionários.
  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY_FORNECEDOR_FORM);
  const guardedClose = () => {
    if (dirty && !window.confirm("Descartar os dados preenchidos? As informações não salvas serão perdidas.")) return;
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Nome é obrigatório."); return; }
    if (!form.tipo) { setError("Tipo é obrigatório."); return; }
    if (!form.contactName.trim()) { setError("Contato é obrigatório."); return; }
    if (!form.phone.trim()) { setError("Telefone é obrigatório."); return; }
    if (!form.email.trim()) { setError("E-mail é obrigatório."); return; }
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
    <Modal open onClose={guardedClose} title="Novo fornecedor" width={460}>
      <form onSubmit={submit} style={{ padding: "20px 24px 24px" }} className="flex flex-col gap-3">
          <div>
            <label style={labelSt()}>Nome *</label>
            <input required autoFocus className={inputCls} style={inputSt} value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={labelSt()}>Tipo *</label>
            <select required className={inputCls} style={inputSt} value={form.tipo} onChange={(e) => setForm(f => ({ ...f, tipo: e.target.value }))}>
              {Object.entries(TIPO_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelSt()}>Contato *</label>
              <input required className={inputCls} style={inputSt} value={form.contactName} onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))} />
            </div>
            <div>
              <label style={labelSt()}>Telefone *</label>
              <input required className={inputCls} style={inputSt} value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={labelSt()}>E-mail *</label>
            <input required type="email" className={inputCls} style={inputSt} value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label style={labelSt()}>Notas</label>
            <textarea rows={2} className={inputCls} style={inputSt} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          {error && <div style={{ fontSize: 12, color: "var(--danger)" }}>{error}</div>}
          <div className="flex gap-2 mt-2">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
              {saving ? "Salvando…" : "Cadastrar"}
            </button>
            <button type="button" onClick={guardedClose} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </form>
    </Modal>
  );
}

const EMPTY_CONTRATO_FORM = { titulo: "", vigenciaInicio: "", vigenciaFim: "", valor: "", status: "ativo", responsavelId: "" };

function NovoContratoModal({ fornecedorId, users, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY_CONTRATO_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY_CONTRATO_FORM);
  const guardedClose = () => {
    if (dirty && !window.confirm("Descartar os dados preenchidos? As informações não salvas serão perdidas.")) return;
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) { setError("Título é obrigatório."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...form, fornecedorId, valor: form.valor ? Number(form.valor) : null, responsavelId: form.responsavelId || null });
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
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "var(--shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Novo contrato</div>
          <button onClick={guardedClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)" }}><X size={18} /></button>
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
          <div>
            <label style={labelSt()}>Responsável</label>
            <select className={inputCls} style={inputSt} value={form.responsavelId} onChange={(e) => setForm(f => ({ ...f, responsavelId: e.target.value }))}>
              <option value="">Sem responsável definido</option>
              {(users || []).map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          </div>
          {error && <div style={{ fontSize: 12, color: "var(--danger)" }}>{error}</div>}
          <div className="flex gap-2 mt-2">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
              {saving ? "Salvando…" : "Criar contrato"}
            </button>
            <button type="button" onClick={guardedClose} style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
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
        <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>
          {saving ? "Salvando…" : "Registrar evento"}
        </button>
        <button type="button" onClick={onDone} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ContratoRow({ contrato, eventos, users, onAddEvento, onUpdateResponsavel }) {
  const [expanded, setExpanded] = useState(false);
  const [addingEvento, setAddingEvento] = useState(false);
  const statusColor = STATUS_COLORS[contrato.status] || STATUS_COLORS.ativo;
  const contratoEventos = eventos.filter(e => e.contratoId === contrato.id);
  const diasParaVencer = contrato.status === "ativo" ? contratoFornecedorDiasParaVencer(contrato) : null;
  const vencendo = diasParaVencer != null && diasParaVencer <= 30;

  return (
    <div className="rounded-xl border" style={{ borderColor: vencendo ? "var(--danger)" : "var(--border)", background: "var(--surface)" }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-3"
        style={{ background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{contrato.titulo}</div>
          <div className="flex items-center gap-3 mt-1 flex-wrap" style={{ fontSize: 11, color: "var(--text-dim)" }}>
            {contrato.vigenciaInicio && (
              <span className="flex items-center gap-1"><Calendar size={10} /> {formatDateBR(contrato.vigenciaInicio)}{contrato.vigenciaFim ? ` – ${formatDateBR(contrato.vigenciaFim)}` : ""}</span>
            )}
            {contrato.valor != null && <span className="flex items-center gap-1"><DollarSign size={10} /> {formatK(contrato.valor)}</span>}
            {vencendo && (
              <span style={{ fontWeight: 700, color: "var(--danger)" }}>
                {diasParaVencer < 0 ? `Venceu há ${Math.abs(diasParaVencer)}d` : diasParaVencer === 0 ? "Vence hoje" : `Vence em ${diasParaVencer}d`}
              </span>
            )}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: statusColor.text, background: statusColor.bg, borderRadius: 99, padding: "2px 10px" }}>
          {STATUS_LABELS[contrato.status] || contrato.status}
        </span>
        {expanded ? <ChevronUp size={14} style={{ color: "var(--text-dim)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-dim)" }} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div className="flex items-center gap-2" style={{ fontSize: 12 }} onClick={(e) => e.stopPropagation()}>
            <span style={{ color: "var(--text-dim)" }}>Responsável:</span>
            <select
              value={contrato.responsavelId || ""}
              onChange={(e) => onUpdateResponsavel(contrato.id, e.target.value || null)}
              className="text-xs rounded-lg border px-2 py-1 outline-none"
              style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)" }}
            >
              <option value="">Sem responsável definido</option>
              {(users || []).map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          </div>
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

function FornecedorDrawer({ fornecedor, contratos, eventos, users, onClose, onCreateContrato, onAddEvento, onUpdateResponsavel }) {
  const [novoContratoOpen, setNovoContratoOpen] = useState(false);
  const fornecedorContratos = contratos.filter(c => c.fornecedorId === fornecedor.id);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 999 }} />
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
              <ContratoRow key={c.id} contrato={c} eventos={eventos} users={users} onAddEvento={onAddEvento} onUpdateResponsavel={onUpdateResponsavel} />
            ))}
          </div>
        </div>
      </div>

      {novoContratoOpen && (
        <NovoContratoModal fornecedorId={fornecedor.id} users={users} onSave={onCreateContrato} onClose={() => setNovoContratoOpen(false)} />
      )}
    </>
  );
}

// ── Contratos (visão agregada cross-fornecedor) ─────────────────────────────
// Reunião com o RH (20/07): "precisa melhorar a view" — antes só dava pra ver
// contratos abrindo o drawer de cada fornecedor um por um.

function ContratosTableView({ contratos, suppliers, users, onRowClick }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const suppliersById = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);
  const usersById = useMemo(() => new Map((users || []).map(u => [u.id, u])), [users]);

  const rows = useMemo(() => {
    return contratos
      // "Vencido" nunca é atualizado automaticamente no campo `status` (fica
      // manual) — filtrar só por status==="vencido" escondia contratos que
      // já passaram da vigência mas continuam marcados "ativo" (achado #8 do
      // roteiro de treinamento de RH, 31/07/2026). Calcula por data real.
      .filter(c => {
        if (statusFilter === "all") return true;
        if (statusFilter === "vencido") return c.status === "ativo" && contratoFornecedorDiasParaVencer(c) < 0;
        return c.status === statusFilter;
      })
      .map(c => ({ contrato: c, diasParaVencer: c.status === "ativo" ? contratoFornecedorDiasParaVencer(c) : null }))
      .sort((a, b) => {
        const fa = a.contrato.vigenciaFim ? new Date(a.contrato.vigenciaFim).getTime() : Infinity;
        const fb = b.contrato.vigenciaFim ? new Date(b.contrato.vigenciaFim).getTime() : Infinity;
        return fa - fb;
      });
  }, [contratos, statusFilter]);

  const selectSt = { borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={selectSt}
        >
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
              {["Contrato", "Fornecedor", "Vigência", "Valor", "Responsável", "Status"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>Nenhum contrato encontrado.</td></tr>
            )}
            {rows.map(({ contrato: c, diasParaVencer }) => {
              const fornecedor = suppliersById.get(c.fornecedorId);
              const responsavel = c.responsavelId ? usersById.get(c.responsavelId) : null;
              const statusColor = STATUS_COLORS[c.status] || STATUS_COLORS.ativo;
              const vencendo = diasParaVencer != null && diasParaVencer <= 30;
              return (
                <tr key={c.id} onClick={() => onRowClick(fornecedor)} style={{ borderBottom: "1px solid var(--border)", cursor: fornecedor ? "pointer" : "default" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text)" }}>{c.titulo}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{fornecedor?.name || "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: vencendo ? "var(--danger)" : "var(--text-dim)", fontWeight: vencendo ? 700 : 400 }}>
                    {c.vigenciaFim ? formatDateBR(c.vigenciaFim) : "—"}
                    {vencendo && (
                      <div>{diasParaVencer < 0 ? `Venceu há ${Math.abs(diasParaVencer)}d` : diasParaVencer === 0 ? "Vence hoje" : `Vence em ${diasParaVencer}d`}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{c.valor != null ? formatK(c.valor) : "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{responsavel?.name || responsavel?.email || "—"}</td>
                  <td className="px-4 py-3">
                    <span style={{ fontSize: 11, fontWeight: 600, color: statusColor.text, background: statusColor.bg, borderRadius: 99, padding: "2px 10px" }}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Mesmo padrão de exclusão de fornecedor de FornecedoresView.jsx (Marketing)
// — regra "toda página de Fornecedores" do CLAUDE.md. Só o texto do corpo
// muda (aqui contratos/histórico são removidos junto, lá cotações continuam).
function ConfirmDeleteModal({ fornecedor, contratoCount, onConfirm, onClose }) {
  return (
    <Modal open onClose={onClose} title="Excluir fornecedor?" width={400}>
      <div className="p-6">
        <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
          "{fornecedor.name}" será removido{contratoCount > 0 ? ` — junto com ${contratoCount} contrato(s) e o histórico de eventos vinculado` : ""}.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancelar</button>
          <button onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--danger)", color: "var(--on-danger)" }}>Excluir</button>
        </div>
      </div>
    </Modal>
  );
}

export function RHFornecedoresView({ currentUser }) {
  const navigate = useNavigate();
  const { suppliers, contratos, eventos, loading, createSupplier, deleteSupplier, createContrato, updateContrato, addEvento } = useRHSuppliers({ userId: currentUser?.id });
  const { users } = useProfiles();
  const [novoOpen, setNovoOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // "Ver fornecedor" (AgentActionsView, aviso interno do Agent Builder)
  // navega pra cá e abre o FornecedorDrawer já focado — mesmo padrão de
  // handoff via sessionStorage já usado por filterAutomationId.
  useEffect(() => {
    try {
      const id = sessionStorage.getItem("rhFornecedoresOpenId");
      if (id) {
        sessionStorage.removeItem("rhFornecedoresOpenId");
        setSelectedId(id);
      }
    } catch { /* sessionStorage indisponível — segue sem handoff */ }
  }, []);
  const [viewMode, setViewMode] = useState("fornecedores"); // "fornecedores" | "contratos"
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState("grid");
  const [agentWizardOpen, setAgentWizardOpen] = useState(false);
  // Depois de criar um agente aqui, o único lugar pra gerenciá-lo
  // (editar/pausar/excluir/ver sugestões) é Automações → aba "Agentes de
  // IA" — sem esse aviso com atalho, ninguém acha o caminho de volta.
  const [agentCreatedToast, setAgentCreatedToast] = useState(false);

  // roles[] cobre cargo adicional — currentUser.role sozinho fica só de
  // fallback (mesmo formato de checagem já usado em AgentActionsView/App.jsx).
  const userRoleList = currentUser?.roles?.length ? currentUser.roles : (currentUser?.role ? [currentUser.role] : []);
  const canCreateAgent = userRoleList.includes("gerente_rh") || userRoleList.includes("admin");

  const selected = useMemo(() => suppliers.find(s => s.id === selectedId) || null, [suppliers, selectedId]);
  const contratoCountByFornecedor = useMemo(() => {
    const map = new Map();
    for (const c of contratos) {
      if (c.status !== "ativo") continue;
      map.set(c.fornecedorId, (map.get(c.fornecedorId) || 0) + 1);
    }
    return map;
  }, [contratos]);
  const contratosAtivos = useMemo(() => contratos.filter(c => c.status === "ativo").length, [contratos]);
  const vencendo = useMemo(() => {
    // "Vencendo" = ainda dentro da janela de 30 dias (0-30, inclusive hoje).
    // "Vencido" = vigência já passou (dias negativo) — outro estado, não o
    // mesmo rótulo. Antes, `dias <= 30` sem piso incluía contrato já vencido
    // há dias no mesmo balde de "vencendo em 30 dias".
    const fornecedorIds = new Set();
    const vencidoFornecedorIds = new Set();
    let total = 0;
    for (const c of contratos) {
      if (c.status !== "ativo") continue;
      const dias = contratoFornecedorDiasParaVencer(c);
      if (dias == null) continue;
      if (dias < 0) {
        vencidoFornecedorIds.add(c.fornecedorId);
      } else if (dias <= 30) {
        fornecedorIds.add(c.fornecedorId);
        total += 1;
      }
    }
    return { fornecedorIds, vencidoFornecedorIds, total };
  }, [contratos]);
  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(s => (s.name || "").toLowerCase().includes(q));
  }, [suppliers, search]);

  const handleUpdateResponsavel = (contratoId, responsavelId) => {
    updateContrato(contratoId, { responsavelId }).catch((err) => console.error("Falha ao atualizar responsável do contrato:", err));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Building2 size={22} style={{ color: "var(--text)" }} />
          <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>Fornecedores</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs
            tabs={[
              { id: "fornecedores", label: "Fornecedores", icon: LayoutGrid },
              { id: "contratos", label: "Contratos", icon: List },
            ]}
            active={viewMode}
            onChange={setViewMode}
          />
          {canCreateAgent && (
            <button
              onClick={() => setAgentWizardOpen(true)}
              className="flex items-center gap-1.5 font-semibold"
              style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "6px 16px", fontSize: 13, cursor: "pointer" }}
            >
              <Bot size={14} /> Criar agente de IA
            </button>
          )}
          <button
            onClick={() => setNovoOpen(true)}
            className="flex items-center gap-1.5 font-semibold"
            style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "6px 16px", fontSize: 13, cursor: "pointer" }}
          >
            <Plus size={14} /> Novo fornecedor
          </button>
        </div>
      </div>
      <p className="text-sm" style={{ color: "var(--text-dim)" }}>
        Convênio médico, seguradora, terceirizada de RH — cadastro, contrato (vigência/valor) e histórico de reajustes, renovações, faturas e orçamentos.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={Building2} value={suppliers.length} label="Fornecedores" />
        <StatCard icon={FileText} value={contratosAtivos} label="Contratos ativos" />
        <StatCard
          icon={Clock}
          value={vencendo.total}
          label="Vencendo em 30 dias"
          sublabel="Contratos ativos"
          accent={vencendo.total > 0 ? "var(--warning)" : undefined}
        />
      </div>

      {viewMode === "fornecedores" && (
        <FilterBar
          search={{ value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Buscar fornecedor…" }}
          trailing={<GridListToggle value={density} onChange={setDensity} />}
        />
      )}

      {loading ? (
        <CardGrid density={density}>
          {Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} density={density} />)}
        </CardGrid>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhum fornecedor cadastrado ainda"
          description="Cadastre o primeiro fornecedor pra acompanhar contratos, vigências, reajustes e renovações num lugar só."
          action={
            <button
              onClick={() => setNovoOpen(true)}
              className="flex items-center gap-1.5 font-semibold"
              style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}
            >
              <Plus size={14} /> Novo fornecedor
            </button>
          }
        />
      ) : viewMode === "contratos" ? (
        <ContratosTableView contratos={contratos} suppliers={suppliers} users={users} onRowClick={(f) => f && setSelectedId(f.id)} />
      ) : filteredSuppliers.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum resultado pra esta busca"
          description="Nenhum fornecedor com esse nome. Tente outro termo ou limpe a busca."
          action={
            <button
              onClick={() => setSearch("")}
              style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Limpar busca
            </button>
          }
        />
      ) : (
        <CardGrid density={density}>
          {filteredSuppliers.map(s => {
            const isVencido = vencendo.vencidoFornecedorIds.has(s.id);
            const isVencendo = !isVencido && vencendo.fornecedorIds.has(s.id);
            return (
              <Card
                key={s.id}
                density={density}
                onClick={() => setSelectedId(s.id)}
                icon={<span style={{ fontSize: density === "list" ? 12 : 15, fontWeight: 700 }}>{(s.name || "").trim().charAt(0).toUpperCase() || "?"}</span>}
                title={s.name}
                meta={TIPO_LABELS[s.tipo] || s.tipo}
                badges={
                  isVencido ? <Badge variant="critical">Contrato vencido</Badge>
                  : isVencendo ? <Badge variant="urgent">Contrato vencendo</Badge>
                  : null
                }
                status={
                  isVencido ? { color: "var(--danger)", label: "Vencido" }
                  : isVencendo ? { color: "var(--amber)", label: "Vencendo" }
                  : null
                }
                footer={`${contratoCountByFornecedor.get(s.id) || 0} contrato(s) ativo(s)`}
                menu={
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(s); }}
                    aria-label="Excluir fornecedor"
                    style={{ color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                  >
                    <Trash2 size={14} />
                  </button>
                }
              />
            );
          })}
        </CardGrid>
      )}

      {novoOpen && (
        <NovoFornecedorModal onSave={createSupplier} onClose={() => setNovoOpen(false)} />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          fornecedor={confirmDelete}
          contratoCount={contratos.filter(c => c.fornecedorId === confirmDelete.id).length}
          onConfirm={async () => { await deleteSupplier(confirmDelete.id); setConfirmDelete(null); }}
          onClose={() => setConfirmDelete(null)}
        />
      )}

      {agentWizardOpen && (
        <AgentBuilderWizard
          currentUser={currentUser}
          onClose={() => setAgentWizardOpen(false)}
          onSaved={() => setAgentCreatedToast(true)}
        />
      )}

      {agentCreatedToast && (
        <AppToast
          icon={Bot}
          title="Agente de IA criado"
          onDismiss={() => setAgentCreatedToast(false)}
          action={{
            label: "Ver em Automações →",
            onClick: () => navigate(ROUTES.automations, { state: { initialTab: "agents" } }),
          }}
        >
          Editar, pausar ou ver as sugestões geradas fica na aba "Agentes de IA" de Automações.
        </AppToast>
      )}

      {selected && (
        <FornecedorDrawer
          fornecedor={selected}
          contratos={contratos}
          eventos={eventos}
          users={users}
          onClose={() => setSelectedId(null)}
          onCreateContrato={createContrato}
          onAddEvento={addEvento}
          onUpdateResponsavel={handleUpdateResponsavel}
        />
      )}
    </div>
  );
}

export default RHFornecedoresView;
