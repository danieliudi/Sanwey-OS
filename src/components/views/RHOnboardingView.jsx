import React, { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck, Plus, X, Check, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHOnboarding } from "../../hooks/use-rh-onboarding";

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function statusConfig(status) {
  switch (status) {
    case "concluida":     return { label: "Concluída",     color: "#16A34A", bg: "#DCFCE7" };
    case "em_andamento":  return { label: "Em andamento",  color: "#1E4D8C", bg: "#DBEAFE" };
    default:              return { label: "Pendente",      color: "#D97706", bg: "#FEF3C7" };
  }
}

function TaskRow({ tarefa, canWrite, canToggle, onStatusChange, onDelete }) {
  const s = statusConfig(tarefa.status);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
      <button
        onClick={() => canToggle && onStatusChange(tarefa.id, tarefa.status === "concluida" ? "pendente" : "concluida")}
        disabled={!canToggle}
        style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
          border: `1.5px solid ${tarefa.status === "concluida" ? "#16A34A" : "#D1D5DB"}`,
          background: tarefa.status === "concluida" ? "#16A34A" : "#FFF",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: canToggle ? "pointer" : "default",
        }}
      >
        {tarefa.status === "concluida" && <Check size={12} color="#FFF" />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: NEUTRAL.graphite, fontWeight: 500, textDecoration: tarefa.status === "concluida" ? "line-through" : "none", opacity: tarefa.status === "concluida" ? 0.6 : 1 }}>
          {tarefa.titulo}
        </div>
        <div style={{ fontSize: 11, color: NEUTRAL.slate, marginTop: 1 }}>Prazo: {fmt(tarefa.data_limite)}</div>
      </div>
      <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: "2px 9px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{s.label}</span>
      {canToggle && tarefa.status !== "concluida" && tarefa.status !== "em_andamento" && (
        <button onClick={() => onStatusChange(tarefa.id, "em_andamento")} style={{ fontSize: 10, color: "#1E4D8C", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>Iniciar</button>
      )}
      {canWrite && (
        <button onClick={() => onDelete(tarefa.id)} style={{ background: "none", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 2, display: "flex", flexShrink: 0 }}>
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

// ── Modal: novo checklist para um colaborador ────────────────────────────────

function NovoChecklistModal({ users, templates, onApply, onClose }) {
  const [colaboradorId, setColaboradorId] = useState("");
  const [templateId, setTemplateId]       = useState("");
  const [items, setItems]                 = useState([{ titulo: "", diasPrazo: 7 }]);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const applyTemplate = (id) => {
    setTemplateId(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl && Array.isArray(tpl.checklist_padrao) && tpl.checklist_padrao.length > 0) {
      setItems(tpl.checklist_padrao.map(i => ({ titulo: i.titulo, diasPrazo: i.dias_prazo ?? 7 })));
    }
  };

  const updateItem = (idx, patch) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const addItem = () => setItems(prev => [...prev, { titulo: "", diasPrazo: 7 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!colaboradorId) { setError("Selecione o colaborador."); return; }
    const validItems = items.filter(i => i.titulo.trim());
    if (validItems.length === 0) { setError("Adicione ao menos uma tarefa."); return; }
    setSaving(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await onApply(
        colaboradorId,
        validItems.map(i => ({ titulo: i.titulo.trim(), dataLimite: addDays(today, i.diasPrazo) })),
        templateId || null
      );
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar checklist.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite }}>Novo checklist de onboarding</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelSt}>Colaborador *</label>
              <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                <option value="">Selecionar colaborador</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            {templates.length > 0 && (
              <div>
                <label style={labelSt}>Template (opcional)</label>
                <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  <option value="">Começar do zero</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.cargo || t.frente || "Template"}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={labelSt}>Tarefas</label>
              <div className="flex flex-col gap-2">
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="text" value={item.titulo} onChange={(e) => updateItem(idx, { titulo: e.target.value })} placeholder="Ex: Acesso ao e-mail corporativo" className="text-sm rounded-lg border px-2 py-1.5 outline-none" style={{ ...inputSt, flex: 1 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: NEUTRAL.slate }}>D+</span>
                      <input type="number" min="0" value={item.diasPrazo} onChange={(e) => updateItem(idx, { diasPrazo: e.target.value })} className="text-sm rounded-lg border px-2 py-1.5 outline-none" style={{ ...inputSt, width: 56 }} />
                    </div>
                    <button type="button" onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: NEUTRAL.slate, flexShrink: 0 }}><X size={14} /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItem} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#1E4D8C", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Plus size={12} /> Adicionar tarefa
              </button>
            </div>
          </div>

          {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "#1E4D8C", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Criando…" : "Criar checklist"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: nova template ──────────────────────────────────────────────────────

function NovaTemplateModal({ onSave, onClose }) {
  const [cargo, setCargo]   = useState("");
  const [frente, setFrente] = useState("");
  const [items, setItems]   = useState([{ titulo: "", diasPrazo: 7 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const updateItem = (idx, patch) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const addItem = () => setItems(prev => [...prev, { titulo: "", diasPrazo: 7 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = items.filter(i => i.titulo.trim());
    if (!cargo.trim() && !frente.trim()) { setError("Informe o cargo ou a frente do template."); return; }
    if (validItems.length === 0) { setError("Adicione ao menos uma tarefa."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        cargo: cargo.trim() || null,
        frente: frente.trim() || null,
        checklist_padrao: validItems.map(i => ({ titulo: i.titulo.trim(), dias_prazo: Number(i.diasPrazo) || 0 })),
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar template.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite }}>Novo template de onboarding</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Cargo</label>
                <input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: Vendedor" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Frente</label>
                <input type="text" value={frente} onChange={(e) => setFrente(e.target.value)} placeholder="Ex: Indústria" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
              </div>
            </div>
            <div>
              <label style={labelSt}>Checklist padrão</label>
              <div className="flex flex-col gap-2">
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="text" value={item.titulo} onChange={(e) => updateItem(idx, { titulo: e.target.value })} placeholder="Ex: Treinamento de compliance" className="text-sm rounded-lg border px-2 py-1.5 outline-none" style={{ ...inputSt, flex: 1 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: NEUTRAL.slate }}>D+</span>
                      <input type="number" min="0" value={item.diasPrazo} onChange={(e) => updateItem(idx, { diasPrazo: e.target.value })} className="text-sm rounded-lg border px-2 py-1.5 outline-none" style={{ ...inputSt, width: 56 }} />
                    </div>
                    <button type="button" onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: NEUTRAL.slate, flexShrink: 0 }}><X size={14} /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItem} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#1E4D8C", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Plus size={12} /> Adicionar tarefa
              </button>
            </div>
          </div>

          {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "#1E4D8C", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Salvar template"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid #E5E7EB", background: "#FFF", color: NEUTRAL.slate, cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function RHOnboardingView({ currentUser, users, canWrite, isRHUser }) {
  const { templates, tarefas, loading, createTemplate, applyChecklist, updateTarefaStatus, deleteTarefa } = useRHOnboarding({ userId: currentUser?.id });
  const [novoChecklistOpen, setNovoChecklistOpen] = useState(false);
  const [novaTemplateOpen, setNovaTemplateOpen]   = useState(false);
  const [expanded, setExpanded]                   = useState(new Set());

  const usersById = useMemo(() => new Map((users || []).map(u => [u.id, u])), [users]);

  const grouped = useMemo(() => {
    const scoped = isRHUser ? tarefas : tarefas.filter(t => t.colaborador_id === currentUser?.id);
    const map = new Map();
    scoped.forEach(t => {
      if (!map.has(t.colaborador_id)) map.set(t.colaborador_id, []);
      map.get(t.colaborador_id).push(t);
    });
    return Array.from(map.entries()).map(([colaboradorId, items]) => ({
      colaboradorId,
      colaborador: usersById.get(colaboradorId),
      items,
      progresso: items.length > 0 ? Math.round(items.filter(i => i.status === "concluida").length / items.length * 100) : 0,
    }));
  }, [tarefas, isRHUser, currentUser?.id, usersById]);

  const toggleExpand = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (!isSupabaseConfigured) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <ClipboardCheck size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
        <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Supabase não configurado</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck size={22} style={{ color: NEUTRAL.graphite }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em", margin: 0 }}>Onboarding</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            {isRHUser ? "Checklists de integração por colaborador" : "Seu checklist de integração"}
          </p>
        </div>
        {canWrite && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setNovaTemplateOpen(true)} style={{ background: "#FFF", color: NEUTRAL.graphite, border: "1px solid #E5E7EB", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Template
            </button>
            <button onClick={() => setNovoChecklistOpen(true)} style={{ background: "#1E4D8C", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Novo checklist
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: NEUTRAL.slate, fontSize: 13 }}>Carregando…</div>
      ) : grouped.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <ClipboardCheck size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Nenhum checklist de onboarding</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {grouped.map(({ colaboradorId, colaborador, items, progresso }) => (
            <div key={colaboradorId} style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
              <button
                onClick={() => toggleExpand(colaboradorId)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#F9FAFB", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                {expanded.has(colaboradorId) ? <ChevronDown size={14} color={NEUTRAL.slate} /> : <ChevronRight size={14} color={NEUTRAL.slate} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: NEUTRAL.graphite }}>{colaborador?.name || "Colaborador"}</div>
                  <div style={{ fontSize: 11, color: NEUTRAL.slate }}>{items.filter(i => i.status === "concluida").length}/{items.length} tarefas concluídas</div>
                </div>
                <div style={{ width: 80, height: 6, borderRadius: 99, background: "#E5E7EB", overflow: "hidden", flexShrink: 0 }}>
                  <div style={{ width: `${progresso}%`, height: "100%", background: progresso === 100 ? "#16A34A" : "#1E4D8C" }} />
                </div>
                <span style={{ fontSize: 11, color: NEUTRAL.slate, fontWeight: 700, flexShrink: 0 }}>{progresso}%</span>
              </button>
              {expanded.has(colaboradorId) && (
                <div style={{ padding: "4px 16px 8px" }}>
                  {items.map(t => (
                    <TaskRow
                      key={t.id}
                      tarefa={t}
                      canWrite={canWrite}
                      canToggle={canWrite || t.colaborador_id === currentUser?.id}
                      onStatusChange={updateTarefaStatus}
                      onDelete={deleteTarefa}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {novoChecklistOpen && (
        <NovoChecklistModal users={users || []} templates={templates} onApply={applyChecklist} onClose={() => setNovoChecklistOpen(false)} />
      )}
      {novaTemplateOpen && (
        <NovaTemplateModal onSave={createTemplate} onClose={() => setNovaTemplateOpen(false)} />
      )}
    </div>
  );
}
