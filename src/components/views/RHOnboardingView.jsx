import React, { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck, Plus, X, Check, Trash2, ArrowRight,
  Briefcase, Clock,
} from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { RH_CONTRACT_TYPES } from "../../constants/rh-config";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHOnboarding } from "../../hooks/use-rh-onboarding";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useRHRecrutamento } from "../../hooks/use-rh-recrutamento";
import { useRHTreinamentos } from "../../hooks/use-rh-treinamentos";
import { useRHFeedback } from "../../hooks/use-rh-feedback";
import { nextPendingCycle } from "../../utils/rh-feedback-cycles";
import { FitScoreCircle } from "../ui/FitScoreCircle";

// ── Etapas do onboarding ──────────────────────────────────────────────────────

const ONBOARDING_STAGES = [
  { id: "documentacao",    name: "Documentação",     color: "#8A8680" },
  { id: "integracao",      name: "Integração",       color: "#0EA5E9" },
  { id: "acompanhamento",  name: "Acompanhamento",   color: "#7C3AED" },
  { id: "avaliacao",       name: "Avaliação",        color: "#D97706" },
  { id: "concluido",       name: "Concluído",        color: "#16A34A", terminal: true },
];

function stageInfo(id) {
  return ONBOARDING_STAGES.find((s) => s.id === id) || ONBOARDING_STAGES[0];
}

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function daysInStage(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function InitialsAvatar({ name, size = 32 }) {
  const initials = (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: NEUTRAL.red, color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, flexShrink: 0, letterSpacing: "0.02em" }}>
      {initials}
    </div>
  );
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

// ── Card do Kanban ────────────────────────────────────────────────────────────

function OnboardingCard({ colaborador, tarefas, vagaTitle, onClick }) {
  const total = tarefas.length;
  const done = tarefas.filter((t) => t.status === "concluida").length;
  const progresso = total > 0 ? Math.round((done / total) * 100) : 0;
  const days = daysInStage(colaborador.onboardingStageChangedAt);
  const st = stageInfo(colaborador.onboardingStage);

  return (
    <div
      onClick={onClick}
      className="cursor-pointer transition-all duration-150"
      style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderLeft: `3px solid ${st.color}`, borderRadius: 10, padding: "10px 12px" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#F9FAFB"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <InitialsAvatar name={colaborador.fullName} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: NEUTRAL.graphite, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {colaborador.fullName}
          </div>
          <div style={{ fontSize: 10, color: NEUTRAL.slate, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {colaborador.jobTitle || colaborador.department || "—"}
          </div>
        </div>
        {total > 0 && <FitScoreCircle score={progresso} size={28} />}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: NEUTRAL.slate }}>
        <span>{total > 0 ? `${done}/${total} tarefas` : "Sem tarefas"}</span>
        {days > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <Clock size={9} /> {days}d na etapa
          </span>
        )}
      </div>

      {vagaTitle && (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: NEUTRAL.slate }}>
          <Briefcase size={10} /> {vagaTitle}
        </div>
      )}
    </div>
  );
}

function OnboardingKanbanColumn({ stage, colaboradoresList, tarefasByColaborador, vagasById, onCardClick }) {
  return (
    <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, minWidth: 240, width: 240, flexShrink: 0, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 260px)" }}>
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, flexShrink: 0, display: "inline-block" }} />
        <span style={{ flex: 1, fontWeight: 700, fontSize: 12, color: NEUTRAL.graphite }}>{stage.name}</span>
        <span style={{ background: `${stage.color}22`, color: stage.color, borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{colaboradoresList.length}</span>
      </div>
      <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {colaboradoresList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 8px", color: NEUTRAL.slate, fontSize: 11, opacity: 0.5 }}>Ninguém aqui</div>
        ) : (
          colaboradoresList.map((c) => (
            <OnboardingCard
              key={c.id}
              colaborador={c}
              tarefas={tarefasByColaborador[c.id] || []}
              vagaTitle={vagasById.get(c.vagaId)?.title}
              onClick={() => onCardClick(c)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Drawer do colaborador ─────────────────────────────────────────────────────

function OnboardingDrawer({
  colaborador, tarefas, templates, vagaTitle, canWrite,
  onStageChange, onStatusChange, onDeleteTarefa, onApplyTemplate, onAddTask, onClose,
}) {
  const [templateId, setTemplateId] = useState("");
  const [novaTarefa, setNovaTarefa] = useState("");
  const [novoPrazo, setNovoPrazo] = useState(7);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const st = stageInfo(colaborador.onboardingStage);
  const labelSt = { fontSize: 10, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const total = tarefas.length;
  const done = tarefas.filter((t) => t.status === "concluida").length;

  const handleAddTask = () => {
    if (!novaTarefa.trim()) return;
    onAddTask(colaborador.id, [{ titulo: novaTarefa.trim(), dataLimite: addDays(new Date().toISOString().slice(0, 10), novoPrazo) }]);
    setNovaTarefa("");
    setNovoPrazo(7);
  };

  const handleApplyTemplate = () => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl || !Array.isArray(tpl.checklist_padrao) || tpl.checklist_padrao.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    onApplyTemplate(colaborador.id, tpl.checklist_padrao.map((i) => ({ titulo: i.titulo, dataLimite: addDays(today, i.dias_prazo) })), tpl.id);
    setTemplateId("");
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} onClick={onClose} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: "#FFFFFF", zIndex: 1000, display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <InitialsAvatar name={colaborador.fullName} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: NEUTRAL.graphite }}>{colaborador.fullName}</div>
            <div style={{ fontSize: 12, color: NEUTRAL.slate, marginTop: 2 }}>{colaborador.jobTitle || "—"} · {colaborador.department || "—"}</div>
            <div style={{ marginTop: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${st.color}18`, color: st.color, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, display: "inline-block" }} /> {st.name}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: NEUTRAL.slate, padding: 4, borderRadius: 8, display: "flex", flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Telefone", value: colaborador.phone || "—" },
              { label: "E-mail", value: colaborador.email || "—" },
              { label: "Tipo de contrato", value: RH_CONTRACT_TYPES.find((c) => c.id === colaborador.contractType)?.label || "—" },
              { label: "Data de admissão", value: fmt(colaborador.admissionDate) },
              { label: "Vaga de origem", value: vagaTitle || "—" },
              { label: "Checklist", value: total > 0 ? `${done}/${total} concluídas` : "Sem tarefas" },
            ].map((f) => (
              <div key={f.label}>
                <div style={labelSt}>{f.label}</div>
                <div style={{ fontSize: 13, color: NEUTRAL.graphite, fontWeight: 500 }}>{f.value}</div>
              </div>
            ))}
          </div>

          {canWrite && (
            <div style={{ marginBottom: 20 }}>
              <div style={labelSt}>Mover para</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ONBOARDING_STAGES.filter((s) => s.id !== colaborador.onboardingStage).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onStageChange(colaborador.id, s.id)}
                    style={{ background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}44`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <ArrowRight size={10} /> {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={labelSt}>Checklist de integração</div>
          </div>

          {tarefas.length === 0 ? (
            <div style={{ fontSize: 12, color: NEUTRAL.slate, marginBottom: 12 }}>Nenhuma tarefa ainda.</div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              {tarefas.map((t) => (
                <TaskRow
                  key={t.id}
                  tarefa={t}
                  canWrite={canWrite}
                  canToggle={canWrite}
                  onStatusChange={onStatusChange}
                  onDelete={onDeleteTarefa}
                />
              ))}
            </div>
          )}

          {canWrite && (
            <>
              {templates.length > 0 && tarefas.length === 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="text-xs rounded-lg border px-2 py-1.5 outline-none" style={{ borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA", flex: 1 }}>
                    <option value="">Aplicar template…</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.cargo || t.frente || "Template"}</option>)}
                  </select>
                  <button onClick={handleApplyTemplate} disabled={!templateId} style={{ background: "#1E4D8C", color: "#FFF", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 11, fontWeight: 700, cursor: templateId ? "pointer" : "default", opacity: templateId ? 1 : 0.5 }}>
                    Aplicar
                  </button>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="text"
                  value={novaTarefa}
                  onChange={(e) => setNovaTarefa(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTask(); } }}
                  placeholder="Nova tarefa…"
                  className="text-xs rounded-lg border px-2 py-1.5 outline-none"
                  style={{ borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA", flex: 1 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: NEUTRAL.slate }}>D+</span>
                  <input type="number" min="0" value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} className="text-xs rounded-lg border px-2 py-1.5 outline-none" style={{ borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FAFAFA", width: 48 }} />
                </div>
                <button onClick={handleAddTask} disabled={!novaTarefa.trim()} style={{ background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 8px", cursor: novaTarefa.trim() ? "pointer" : "default", display: "flex", opacity: novaTarefa.trim() ? 1 : 0.5, flexShrink: 0 }}>
                  <Plus size={13} color={NEUTRAL.graphite} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
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

// ── Visão individual (colaborador logado, não-RH) ────────────────────────────

function MeuChecklist({ colaborador, tarefas, onStatusChange }) {
  const total = tarefas.length;
  const done = tarefas.filter((t) => t.status === "concluida").length;
  const progresso = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: "#F9FAFB", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: NEUTRAL.graphite }}>{colaborador.fullName}</div>
          <div style={{ fontSize: 11, color: NEUTRAL.slate }}>{done}/{total} tarefas concluídas</div>
        </div>
        <div style={{ width: 80, height: 6, borderRadius: 99, background: "#E5E7EB", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ width: `${progresso}%`, height: "100%", background: progresso === 100 ? "#16A34A" : "#1E4D8C" }} />
        </div>
        <span style={{ fontSize: 11, color: NEUTRAL.slate, fontWeight: 700, flexShrink: 0 }}>{progresso}%</span>
      </div>
      <div style={{ padding: "4px 16px 8px" }}>
        {tarefas.map((t) => (
          <TaskRow key={t.id} tarefa={t} canWrite={false} canToggle onStatusChange={onStatusChange} onDelete={() => {}} />
        ))}
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function RHOnboardingView({ currentUser, canWrite, isRHUser }) {
  const { templates, tarefas, loading: loadingTarefas, createTemplate, applyChecklist, updateTarefaStatus, deleteTarefa } = useRHOnboarding({ userId: currentUser?.id });
  const { colaboradores, loading: loadingColaboradores, changeOnboardingStage } = useRHColaboradores({ userId: currentUser?.id });
  const { vagas } = useRHRecrutamento({ userId: currentUser?.id });
  const { treinamentos, atribuicoes: treinamentoAtribuicoes, assignToUsers: assignTreinamento } = useRHTreinamentos({ userId: currentUser?.id });
  const { feedbacks, createPendingCycle } = useRHFeedback({ userId: currentUser?.id });
  const [novaTemplateOpen, setNovaTemplateOpen] = useState(false);
  const [drawerColaboradorId, setDrawerColaboradorId] = useState(null);

  // Ao entrar em "Integração", atribui sozinho os treinamentos obrigatórios
  // cujo cargo ou departamento alvo bata com o do colaborador — mesma lógica
  // de match case-insensitive já usada pro template de onboarding por cargo.
  const autoAssignTreinamentos = async (colaborador) => {
    if (!colaborador) return;
    const jobTitle = (colaborador.jobTitle || "").toLowerCase().trim();
    const department = colaborador.department || "";
    const jaAtribuidoIds = new Set(
      treinamentoAtribuicoes.filter((a) => a.colaborador_id === colaborador.id).map((a) => a.treinamento_id)
    );
    const matches = treinamentos.filter((t) => {
      if (t.tipo !== "obrigatorio" || jaAtribuidoIds.has(t.id)) return false;
      const cargoMatch = t.cargo_alvo && jobTitle && t.cargo_alvo.toLowerCase().trim() === jobTitle;
      const deptoMatch = t.departamento_alvo && department && t.departamento_alvo === department;
      return cargoMatch || deptoMatch;
    });
    for (const t of matches) {
      await assignTreinamento(t.id, [colaborador.id]);
    }
  };

  const handleStageChange = async (id, stage) => {
    await changeOnboardingStage(id, stage);
    const colaborador = colaboradores.find((c) => c.id === id);
    if (stage === "integracao") {
      await autoAssignTreinamentos(colaborador);
    }
    if (stage === "acompanhamento" && colaborador) {
      const feedbacksDoColaborador = feedbacks.filter((f) => f.user_id === id);
      const proximo = nextPendingCycle({ ...colaborador, onboardingStage: stage }, feedbacksDoColaborador);
      if (proximo) await createPendingCycle(id, proximo.tipo, proximo.periodStart, proximo.periodEnd);
    }
  };

  const loading = loadingTarefas || loadingColaboradores;

  const vagasById = useMemo(() => new Map(vagas.map((v) => [v.id, v])), [vagas]);

  const tarefasByColaborador = useMemo(() => {
    const map = {};
    tarefas.forEach((t) => {
      if (!map[t.colaborador_id]) map[t.colaborador_id] = [];
      map[t.colaborador_id].push(t);
    });
    return map;
  }, [tarefas]);

  const colaboradoresByStage = useMemo(() => {
    const map = {};
    ONBOARDING_STAGES.forEach((s) => { map[s.id] = colaboradores.filter((c) => (c.onboardingStage || "documentacao") === s.id); });
    return map;
  }, [colaboradores]);

  const meuColaborador = useMemo(
    () => colaboradores.find((c) => c.profileId === currentUser?.id) || null,
    [colaboradores, currentUser?.id]
  );

  const drawerColaborador = useMemo(
    () => colaboradores.find((c) => c.id === drawerColaboradorId) || null,
    [colaboradores, drawerColaboradorId]
  );

  if (!isSupabaseConfigured) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <ClipboardCheck size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
        <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Supabase não configurado</div>
      </div>
    );
  }

  // ── Colaborador comum (sem acesso de RH): só o próprio checklist ──────────
  if (!isRHUser) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck size={22} style={{ color: NEUTRAL.graphite }} />
          <h1 style={{ fontWeight: 700, fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em", margin: 0 }}>Onboarding</h1>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: NEUTRAL.slate, fontSize: 13 }}>Carregando…</div>
        ) : !meuColaborador ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <ClipboardCheck size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
            <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Nenhum checklist de onboarding pra você</div>
          </div>
        ) : (
          <MeuChecklist
            colaborador={meuColaborador}
            tarefas={tarefasByColaborador[meuColaborador.id] || []}
            onStatusChange={updateTarefaStatus}
          />
        )}
      </div>
    );
  }

  // ── RH: Kanban completo ────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck size={22} style={{ color: NEUTRAL.graphite }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em", margin: 0 }}>Onboarding</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            {colaboradores.length} colaborador{colaboradores.length !== 1 ? "es" : ""} no onboarding
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setNovaTemplateOpen(true)} style={{ background: "#FFF", color: NEUTRAL.graphite, border: "1px solid #E5E7EB", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Template
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: NEUTRAL.slate, fontSize: 13 }}>Carregando…</div>
      ) : colaboradores.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <ClipboardCheck size={48} style={{ color: NEUTRAL.slate, opacity: 0.3, margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, color: NEUTRAL.slate, fontWeight: 500 }}>Nenhum colaborador cadastrado</div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16, flex: 1 }} className="flex-col md:flex-row">
          <div style={{ display: "flex", gap: 12, flexShrink: 0 }} className="hidden md:flex">
            {ONBOARDING_STAGES.map((stage) => (
              <OnboardingKanbanColumn
                key={stage.id}
                stage={stage}
                colaboradoresList={colaboradoresByStage[stage.id] || []}
                tarefasByColaborador={tarefasByColaborador}
                vagasById={vagasById}
                onCardClick={(c) => setDrawerColaboradorId(c.id)}
              />
            ))}
          </div>
          <div className="md:hidden flex flex-col gap-3">
            {ONBOARDING_STAGES.map((stage) => (
              <OnboardingKanbanColumn
                key={stage.id}
                stage={stage}
                colaboradoresList={colaboradoresByStage[stage.id] || []}
                tarefasByColaborador={tarefasByColaborador}
                vagasById={vagasById}
                onCardClick={(c) => setDrawerColaboradorId(c.id)}
              />
            ))}
          </div>
        </div>
      )}

      {drawerColaborador && (
        <OnboardingDrawer
          colaborador={drawerColaborador}
          tarefas={tarefasByColaborador[drawerColaborador.id] || []}
          templates={templates}
          vagaTitle={vagasById.get(drawerColaborador.vagaId)?.title}
          canWrite={canWrite}
          onStageChange={handleStageChange}
          onStatusChange={updateTarefaStatus}
          onDeleteTarefa={deleteTarefa}
          onApplyTemplate={applyChecklist}
          onAddTask={applyChecklist}
          onClose={() => setDrawerColaboradorId(null)}
        />
      )}

      {novaTemplateOpen && (
        <NovaTemplateModal onSave={createTemplate} onClose={() => setNovaTemplateOpen(false)} />
      )}
    </div>
  );
}

export default RHOnboardingView;
