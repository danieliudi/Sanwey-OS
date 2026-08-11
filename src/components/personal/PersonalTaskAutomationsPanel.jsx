import React, { useState } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import { Modal } from "../ui/Modal";
import { PERSONAL_TASK_PRIORITIES } from "../../constants/personal-tasks";

const selectSt = {
  fontSize: 12, fontWeight: 600, padding: "6px 9px", borderRadius: 6,
  border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text)",
};
const inputSt = { ...selectSt, fontWeight: 500 };

// Descrição gerada, mesma ideia de "resumo legível da regra" que
// AutomationsView.jsx já usa — evita o usuário ter que decifrar JSON pra
// saber o que uma automação faz.
function describeRule(rule, columns) {
  const stageName = (key) => columns.find(c => c.id === key)?.name || key;
  const t = rule.trigger || {};
  let when = "—";
  if (t.type === "stage_change") when = `mover uma tarefa${t.fromStage ? ` de "${stageName(t.fromStage)}"` : ""} para "${stageName(t.toStage)}"`;
  if (t.type === "field_value")  when = `prioridade for "${PERSONAL_TASK_PRIORITIES.find(p => p.id === t.value)?.label || t.value}"`;

  const a = rule.thenActions?.[0] || {};
  let then = "—";
  if (a.type === "move_stage") then = `mover pra "${stageName(a.targetStage)}"`;
  if (a.type === "set_field")  then = `definir prioridade "${PERSONAL_TASK_PRIORITIES.find(p => p.id === a.fieldValue)?.label || a.fieldValue}"`;
  if (a.type === "notify")     then = `avisar: "${a.message}"`;
  if (a.type === "create_task") then = `criar tarefa "${a.title}"${Number.isInteger(a.dueInDays) ? ` (prazo em ${a.dueInDays}d)` : ""}`;

  return `Quando ${when} → ${then}`;
}

function RuleBuilderModal({ open, onClose, onSave, columns }) {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("stage_change");
  const [fromStage, setFromStage] = useState("");
  const [toStage, setToStage] = useState(columns[0]?.id || "");
  const [fieldValue, setFieldValue] = useState(PERSONAL_TASK_PRIORITIES[0]?.id || "");
  const [actionType, setActionType] = useState("notify");
  const [actionTargetStage, setActionTargetStage] = useState(columns[0]?.id || "");
  const [actionPriority, setActionPriority] = useState(PERSONAL_TASK_PRIORITIES[0]?.id || "");
  const [actionMessage, setActionMessage] = useState("");
  const [actionTitle, setActionTitle] = useState("Follow-up: {título}");
  const [actionDueInDays, setActionDueInDays] = useState(3);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setTriggerType("stage_change"); setFromStage(""); setToStage(columns[0]?.id || "");
    setFieldValue(PERSONAL_TASK_PRIORITIES[0]?.id || ""); setActionType("notify");
    setActionMessage(""); setActionTitle("Follow-up: {título}"); setActionDueInDays(3);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const trigger = triggerType === "stage_change"
        ? { type: "stage_change", fromStage: fromStage || undefined, toStage }
        : { type: "field_value", field: "priority", operator: "eq", value: fieldValue };

      let action = { type: actionType };
      if (actionType === "move_stage") action.targetStage = actionTargetStage;
      if (actionType === "set_field")  { action.field = "priority"; action.fieldValue = actionPriority; }
      if (actionType === "notify")     action.message = actionMessage.trim() || `Automação "${name}" disparada.`;
      if (actionType === "create_task") { action.title = actionTitle.trim() || "Nova tarefa"; action.dueInDays = Number(actionDueInDays) || null; }

      await onSave({ name: name.trim(), enabled: true, trigger, conditionGroups: [], thenActions: [action], elseActions: [] });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova automação" width={480}>
      <div className="p-5 space-y-4" style={{ overflowY: "auto" }}>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>Nome</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Follow-up automático"
            style={{ ...inputSt, width: "100%" }} />
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>Quando</div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={triggerType} onChange={e => setTriggerType(e.target.value)} style={selectSt}>
              <option value="stage_change">eu mover uma tarefa de etapa</option>
              <option value="field_value">a prioridade for definida como</option>
            </select>
            {triggerType === "stage_change" ? (
              <>
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>para</span>
                <select value={toStage} onChange={e => setToStage(e.target.value)} style={selectSt}>
                  {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </>
            ) : (
              <select value={fieldValue} onChange={e => setFieldValue(e.target.value)} style={selectSt}>
                {PERSONAL_TASK_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            )}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>Então</div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <select value={actionType} onChange={e => setActionType(e.target.value)} style={selectSt}>
              <option value="notify">avisar</option>
              <option value="move_stage">mover a tarefa pra outra etapa</option>
              <option value="set_field">definir prioridade</option>
              <option value="create_task">criar uma nova tarefa</option>
            </select>
          </div>
          {actionType === "notify" && (
            <input value={actionMessage} onChange={e => setActionMessage(e.target.value)} placeholder="Mensagem do aviso" style={{ ...inputSt, width: "100%" }} />
          )}
          {actionType === "move_stage" && (
            <select value={actionTargetStage} onChange={e => setActionTargetStage(e.target.value)} style={selectSt}>
              {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {actionType === "set_field" && (
            <select value={actionPriority} onChange={e => setActionPriority(e.target.value)} style={selectSt}>
              {PERSONAL_TASK_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          )}
          {actionType === "create_task" && (
            <div className="flex flex-col gap-2">
              <input value={actionTitle} onChange={e => setActionTitle(e.target.value)} placeholder='Título — use {título} pra citar a tarefa original' style={{ ...inputSt, width: "100%" }} />
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
                Prazo em
                <input type="number" min={0} value={actionDueInDays} onChange={e => setActionDueInDays(e.target.value)} style={{ ...inputSt, width: 60 }} />
                dias
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: "pointer", opacity: saving || !name.trim() ? 0.6 : 1 }}>
            Salvar automação
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function PersonalTaskAutomationsPanel({ automationsHook, columns }) {
  const { automations, loading, addAutomation, deleteAutomation, toggleAutomation } = automationsHook;
  const [builderOpen, setBuilderOpen] = useState(false);

  return (
    <div className="max-w-2xl mx-auto py-2">
      <div className="mb-4">
        <div className="text-sm font-bold" style={{ color: "var(--text)" }}>Automações</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
          Regras que rodam sozinhas no seu Meu To-do — só você vê e edita.
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-center py-8" style={{ color: "var(--text-dim)" }}>Carregando…</div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {automations.length === 0 && (
            <div className="text-xs text-center py-8 italic" style={{ color: "var(--text-dim)" }}>Nenhuma automação criada ainda.</div>
          )}
          {automations.map(rule => (
            <div key={rule.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="min-w-0">
                <div className="text-[13px] font-bold" style={{ color: "var(--text)" }}>{rule.name}</div>
                <div className="text-xs mt-0.5" style={{ color: rule.enabled ? "var(--text-dim)" : "var(--text-faint)" }}>{describeRule(rule, columns)}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => toggleAutomation(rule.id)} aria-label={rule.enabled ? "Desativar" : "Ativar"}
                  className="rounded-full transition-colors" style={{ width: 34, height: 20, background: rule.enabled ? "var(--accent)" : "var(--border-strong)", border: "none", cursor: "pointer", position: "relative" }}>
                  <span style={{ position: "absolute", top: 2, [rule.enabled ? "right" : "left"]: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff" }} />
                </button>
                <button onClick={() => deleteAutomation(rule.id)} className="p-1.5 rounded-lg" style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; }} onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
                  aria-label="Excluir automação">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setBuilderOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
        style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: "pointer" }}>
        <Plus size={13} /> Nova automação
      </button>

      <RuleBuilderModal open={builderOpen} onClose={() => setBuilderOpen(false)} onSave={addAutomation} columns={columns} />
    </div>
  );
}

export default PersonalTaskAutomationsPanel;
