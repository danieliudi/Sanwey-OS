import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardCheck, Plus, X, Check, Trash2, ArrowRight,
  Briefcase, Pencil, Settings2, AlertCircle,
  LayoutGrid, List, CalendarDays as CalendarIcon, ChevronLeft, ChevronRight,
} from "lucide-react";
import { RH_CONTRACT_TYPES, RH_DEPARTMENTS } from "../../constants/rh-config";
import { RH_FRENTES, RH_FRENTE_LABELS, RH_FRENTE_COLORS } from "../../constants/rh-frentes";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHOnboarding } from "../../hooks/use-rh-onboarding";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useRHRecrutamento } from "../../hooks/use-rh-recrutamento";
import { useRHTreinamentos } from "../../hooks/use-rh-treinamentos";
import { useRHFeedback } from "../../hooks/use-rh-feedback";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { useProfiles } from "../../hooks/use-profiles";
import { nextPendingCycle } from "../../utils/rh-feedback-cycles";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { RHStageEditorModal } from "../rh-pipeline/RHStageEditorModal";
import { RHStageFieldEditorModal } from "../rh-pipeline/RHStageFieldEditorModal";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { RHKanbanCard } from "../rh-pipeline/RHKanbanCard";
import { RHDetailDrawerShell } from "../rh-pipeline/RHDetailDrawerShell";
import { resolveVisibleFields, getMissingRequiredFields, getFieldCompleteness } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

// ── Etapas do onboarding ──────────────────────────────────────────────────────
// As etapas vêm de rh_pipeline_stages (domain="onboarding"), editáveis pelo RH
// via RHStageEditorModal — ver useRHPipelineStages("onboarding") mais abaixo.
// Os stageKeys (documentacao/integracao/acompanhamento/avaliacao/concluido) já
// batem com os valores existentes em rh_colaboradores.onboarding_stage.

function findStage(stages, stageKey) {
  return stages.find((s) => s.stageKey === stageKey) || stages[0] || { name: "—", color: "#8A8680", stageKey };
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

// ── Kanban/Tabela/Calendário — mesmo padrão de ComprasMarketingView/CRMView ──

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function ViewToggleButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
      style={{
        background: active ? "var(--accent)" : "var(--surface)",
        color: active ? "#FFFFFF" : "var(--text-dim)",
        border: "none",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "var(--surface)"; }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function InitialsAvatar({ name, size = 32 }) {
  const initials = (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--color-industria)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, flexShrink: 0, letterSpacing: "0.02em" }}>
      {initials}
    </div>
  );
}

function statusConfig(status) {
  switch (status) {
    case "concluida":     return { label: "Concluída",     color: "var(--success)", bg: "#DCFCE7" };
    case "em_andamento":  return { label: "Em andamento",  color: "var(--accent)", bg: "#DBEAFE" };
    default:              return { label: "Pendente",      color: "var(--warning)", bg: "#FEF3C7" };
  }
}

function TaskRow({ tarefa, canWrite, canToggle, onStatusChange, onDelete }) {
  const s = statusConfig(tarefa.status);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <button
        onClick={() => canToggle && onStatusChange(tarefa.id, tarefa.status === "concluida" ? "pendente" : "concluida")}
        disabled={!canToggle}
        style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
          border: `1.5px solid ${tarefa.status === "concluida" ? "var(--success)" : "var(--border-strong)"}`,
          background: tarefa.status === "concluida" ? "var(--success)" : "var(--surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: canToggle ? "pointer" : "default",
        }}
      >
        {tarefa.status === "concluida" && <Check size={12} color="#FFF" />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, textDecoration: tarefa.status === "concluida" ? "line-through" : "none", opacity: tarefa.status === "concluida" ? 0.6 : 1 }}>
          {tarefa.titulo}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>Prazo: {fmt(tarefa.data_limite)}</div>
      </div>
      <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: "2px 9px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{s.label}</span>
      {canToggle && tarefa.status !== "concluida" && tarefa.status !== "em_andamento" && (
        <button onClick={() => onStatusChange(tarefa.id, "em_andamento")} style={{ fontSize: 10, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>Iniciar</button>
      )}
      {canWrite && (
        <button onClick={() => onDelete(tarefa.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "flex", flexShrink: 0 }}>
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

// ── Card do Kanban ────────────────────────────────────────────────────────────
// O "chrome" do card (borda, sombra, badge de aging, menu "Mover para", drag)
// vem de RHKanbanCard — aqui só o conteúdo interno (children).

function OnboardingCardBody({ colaborador, tarefas, vagaTitle }) {
  const total = tarefas.length;
  const done = tarefas.filter((t) => t.status === "concluida").length;
  const progresso = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <InitialsAvatar name={colaborador.fullName} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {colaborador.fullName}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {colaborador.jobTitle || colaborador.department || "—"}
          </div>
        </div>
        {total > 0 && <FitScoreCircle score={progresso} size={28} />}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: "var(--text-dim)" }}>
        <span>{total > 0 ? `${done}/${total} tarefas` : "Sem tarefas"}</span>
      </div>

      {vagaTitle && (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-dim)" }}>
          <Briefcase size={10} /> {vagaTitle}
        </div>
      )}
    </>
  );
}

function OnboardingKanbanColumn({
  stage, stages, colaboradoresList, tarefasByColaborador, vagasById,
  onCardClick, onDragStart, onDragEnd, onMoveToStage,
  isDragOver, onColumnDragOver, onColumnDragLeave, onColumnDrop,
  canWrite, onEditFields, getCompleteness, onAddColaborador,
}) {
  return (
    <div
      onDragOver={(e) => onColumnDragOver(e, stage.stageKey)}
      onDragLeave={onColumnDragLeave}
      onDrop={() => onColumnDrop(stage.stageKey)}
      className="flex flex-col rounded-xl border transition-all duration-150 overflow-hidden"
      style={{
        width: 272, minWidth: 272,
        background: "var(--surface-alt)",
        borderColor: isDragOver ? stage.color + "70" : "var(--border)",
        boxShadow: isDragOver ? `0 0 0 2px ${stage.color}30` : "var(--shadow-card)",
        maxHeight: "calc(100vh - 260px)",
      }}
    >
      {/* Column header — mesmo padrão do Pipeline/Campanhas/Entregas: banda de
          cor + header branco em vez de bolinha + fundo tingido. */}
      <div style={{ height: 8, background: stage.color, flexShrink: 0 }} />
      <div
        className="px-3.5 pt-3 pb-2.5 flex items-center justify-between gap-2"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="min-w-0 flex-1">
          <div
            className="font-semibold flex items-center gap-1.5"
            style={{ color: "var(--text)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            <span title={stage.name} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "0 1 auto" }}>{stage.name}</span>
            <span style={{ color: "var(--text-dim)", fontWeight: 500, flexShrink: 0 }}>({colaboradoresList.length})</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canWrite && (
            <button
              onClick={onAddColaborador}
              title="Adicionar colaborador"
              style={{ background: "none", border: "none", cursor: "pointer", color: stage.color, padding: 2, display: "flex", flexShrink: 0 }}
            >
              <Plus size={14} />
            </button>
          )}
          {canWrite && (
            <button
              onClick={() => onEditFields(stage)}
              title="Editar campos desta etapa"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "flex", flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; }}
            >
              <Settings2 size={13} />
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {colaboradoresList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-dim)", fontSize: 11, opacity: 0.5 }}>Ninguém aqui</div>
        ) : (
          colaboradoresList.map((c) => (
            <RHKanbanCard
              key={c.id}
              id={c.id}
              stage={c.onboardingStage}
              stages={stages}
              onClick={() => onCardClick(c)}
              onDragStart={canWrite ? onDragStart : undefined}
              onDragEnd={canWrite ? onDragEnd : undefined}
              onMoveToStage={canWrite ? onMoveToStage : undefined}
              agingDays={daysInStage(c.onboardingStageChangedAt)}
              completeness={getCompleteness?.(c)}
            >
              <OnboardingCardBody
                colaborador={c}
                tarefas={tarefasByColaborador[c.id] || []}
                vagaTitle={vagasById.get(c.vagaId)?.title}
              />
            </RHKanbanCard>
          ))
        )}
      </div>
    </div>
  );
}

// ── Drawer do colaborador ─────────────────────────────────────────────────────

function OnboardingDrawer({
  colaborador, tarefas, templates, vagaTitle, canWrite, stages, users, currentUser,
  onStageChange, moveError, onStatusChange, onDeleteTarefa, onApplyTemplate, onAddTask, onClose,
  onUpdateCustomFields, onAddActivity, notifyMentions,
}) {
  const [templateId, setTemplateId] = useState("");
  const [novaTarefa, setNovaTarefa] = useState("");
  const [novoPrazo, setNovoPrazo] = useState(7);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // Campos customizados da etapa atual — editáveis inline (save debounced),
  // mesmo padrão de src/components/lead/LeadDetailDrawer.jsx.
  const stageFieldsHook = useRHStageFields("onboarding");
  const customDefs = stageFieldsHook.getFields(colaborador.onboardingStage);
  const [customDraft, setCustomDraft] = useState({});
  const customDebounceRef = useRef(null);

  useEffect(() => {
    setCustomDraft({});
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    return () => { if (customDebounceRef.current) clearTimeout(customDebounceRef.current); };
  }, [colaborador.id]);

  const handleCustomChange = (fieldKey, value) => {
    setCustomDraft((prev) => ({ ...prev, [fieldKey]: value }));
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    customDebounceRef.current = setTimeout(() => {
      const merged = { ...(colaborador.customFields || {}), [fieldKey]: value };
      onUpdateCustomFields(merged);
    }, 600);
  };

  const getCustomValue = (fieldKey) =>
    fieldKey in customDraft ? customDraft[fieldKey] : (colaborador.customFields?.[fieldKey] ?? "");

  // Campos condicionais: reavalia visibilidade/obrigatoriedade a cada
  // keystroke — mescla o rascunho local (customDraft, ainda não persistido
  // pelo debounce) com os valores já salvos, pra não ficar "atrasado".
  const customValuesByKey = { ...(colaborador.customFields || {}), ...customDraft };
  const visibleCustomDefs = resolveVisibleFields(customDefs, customValuesByKey);

  const st = findStage(stages, colaborador.onboardingStage);
  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
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
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: "var(--surface)", zIndex: 1000, display: "flex", flexDirection: "column", boxShadow: "var(--shadow-pop)", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <InitialsAvatar name={colaborador.fullName} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{colaborador.fullName}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{colaborador.jobTitle || "—"} · {colaborador.department || "—"}</div>
            <div style={{ marginTop: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${st.color}18`, color: st.color, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, display: "inline-block" }} /> {st.name}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex", flexShrink: 0 }}>
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
                <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{f.value}</div>
              </div>
            ))}
          </div>

          {canWrite && (
            <div style={{ marginBottom: 20 }}>
              <div style={labelSt}>Mover para</div>
              {moveError && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 11 }}>
                  <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                  {moveError}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {stages.filter((s) => s.stageKey !== colaborador.onboardingStage).map((s) => (
                  <button
                    key={s.stageKey}
                    onClick={() => onStageChange(colaborador.id, s.stageKey)}
                    style={{ background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}44`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <ArrowRight size={10} /> {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {visibleCustomDefs.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={labelSt}>Campos desta etapa</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {visibleCustomDefs.map((f) => (
                  <div key={f.id}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                      {f.effectiveRequired && <span style={{ color: "var(--accent)", marginRight: 4 }}>*</span>}
                      {f.label}
                    </label>
                    {f.helpText && (
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{f.helpText}</div>
                    )}
                    <RHStageFieldInput
                      field={f}
                      value={getCustomValue(f.fieldKey)}
                      onChange={(val) => handleCustomChange(f.fieldKey, val)}
                      users={users}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={labelSt}>Checklist de integração</div>
          </div>

          {tarefas.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>Nenhuma tarefa ainda.</div>
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
                  <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="text-xs rounded-lg border px-2 py-1.5 outline-none" style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface-alt)", flex: 1 }}>
                    <option value="">Aplicar template…</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.cargo || RH_FRENTE_LABELS[t.frente] || t.frente || "Template"}</option>)}
                  </select>
                  <button onClick={handleApplyTemplate} disabled={!templateId} style={{ background: "var(--accent)", color: "#FFF", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 11, fontWeight: 700, cursor: templateId ? "pointer" : "default", opacity: templateId ? 1 : 0.5 }}>
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
                  style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface-alt)", flex: 1 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: "var(--text-dim)" }}>D+</span>
                  <input type="number" min="0" value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} className="text-xs rounded-lg border px-2 py-1.5 outline-none" style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface-alt)", width: 48 }} />
                </div>
                <button onClick={handleAddTask} disabled={!novaTarefa.trim()} style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: novaTarefa.trim() ? "pointer" : "default", display: "flex", opacity: novaTarefa.trim() ? 1 : 0.5, flexShrink: 0 }}>
                  <Plus size={13} color="var(--text)" />
                </button>
              </div>
            </>
          )}

          {/* Atividades / Anexos / Comentários — adicional ao checklist de
              integração acima (rh_onboarding_tarefas), que continua intacto. */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            <RHDetailDrawerShell
              domain="onboarding"
              recordId={colaborador.id}
              activities={colaborador.activities || []}
              onAddActivity={onAddActivity}
              currentUser={currentUser}
              users={users}
              stages={stages}
              notifyMentions={notifyMentions}
              mentionLink={{ module: "rh_onboarding", id: colaborador.id }}
              mentionContextLabel={colaborador.fullName}
            />
          </div>
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

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface-alt)", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Novo template de onboarding</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
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
                <select value={frente} onChange={(e) => setFrente(e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt}>
                  <option value="">Sem frente específica</option>
                  {RH_FRENTES.map((id) => <option key={id} value={id}>{RH_FRENTE_LABELS[id]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelSt}>Checklist padrão</label>
              <div className="flex flex-col gap-2">
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="text" value={item.titulo} onChange={(e) => updateItem(idx, { titulo: e.target.value })} placeholder="Ex: Treinamento de compliance" className="text-sm rounded-lg border px-2 py-1.5 outline-none" style={{ ...inputSt, flex: 1 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>D+</span>
                      <input type="number" min="0" value={item.diasPrazo} onChange={(e) => updateItem(idx, { diasPrazo: e.target.value })} className="text-sm rounded-lg border px-2 py-1.5 outline-none" style={{ ...inputSt, width: 56 }} />
                    </div>
                    <button type="button" onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", flexShrink: 0 }}><X size={14} /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItem} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Plus size={12} /> Adicionar tarefa
              </button>
            </div>
          </div>

          {error && <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Salvar template"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Novo Colaborador Modal ────────────────────────────────────────────────────
// Cria um colaborador direto numa etapa específica do onboarding (via "+" da
// coluna) — antes só existia o caminho indireto (contratar um candidato no
// Recrutamento, que sempre cai na etapa default). Mesmo padrão de
// "campos desta etapa" do NovaVagaModal/NovoCandidatoModal/CampaignCreateModal.
function NovoColaboradorModal({ stageId, stages, users, onSave, onClose }) {
  const [fullName, setFullName]         = useState("");
  const [jobTitle, setJobTitle]         = useState("");
  const [frente, setFrente]             = useState("");
  const [department, setDepartment]     = useState("");
  const [contractType, setContractType] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState(null);

  const onboardingStageFields = useRHStageFields("onboarding");
  const [customValues, setCustomValues] = useState({});
  const visibleFields = resolveVisibleFields(onboardingStageFields.getFields(stageId), customValues);

  const stageInfo = findStage(stages, stageId);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) { setError("Nome completo é obrigatório."); return; }
    if (!frente) { setError("Frente é obrigatória."); return; }
    const missing = getMissingRequiredFields(visibleFields, customValues);
    if (missing.length > 0) { setError(`Preencha antes: ${missing.map(f => f.label).join(", ")}.`); return; }
    const invalid = getInvalidFields(visibleFields, customValues);
    if (invalid.length > 0) { setError(`Corrija antes: ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        fullName: fullName.trim(),
        jobTitle: jobTitle.trim() || null,
        frente: frente || null,
        department: department || null,
        contractType: contractType || null,
        admissionDate: admissionDate || null,
        onboardingStage: stageId,
        onboardingStageChangedAt: new Date().toISOString(),
        customFields: customValues,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar colaborador.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface-alt)", fontSize: 13 };
  const inputCls = "w-full text-sm rounded-xl border px-3 py-2 outline-none";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Novo colaborador</div>
            {stageInfo && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stageInfo.color, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>{stageInfo.name}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelSt}>Nome completo *</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" className={inputCls} style={inputSt} autoFocus />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Cargo</label>
                <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Ex: Vendedor Externo" className={inputCls} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Frente *</label>
                <select value={frente} onChange={(e) => setFrente(e.target.value)} className={inputCls} style={inputSt}>
                  <option value="">Selecionar</option>
                  {RH_FRENTES.map((id) => <option key={id} value={id}>{RH_FRENTE_LABELS[id]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Departamento</label>
                <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls} style={inputSt}>
                  <option value="">Selecionar</option>
                  {RH_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Tipo de contrato</label>
                <select value={contractType} onChange={(e) => setContractType(e.target.value)} className={inputCls} style={inputSt}>
                  <option value="">Selecionar</option>
                  {RH_CONTRACT_TYPES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Data de admissão</label>
                <input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className={inputCls} style={inputSt} />
              </div>
            </div>
          </div>

          {visibleFields.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Campos desta etapa {stageInfo?.name ? `· ${stageInfo.name}` : ""}
              </div>
              <div className="flex flex-col gap-3">
                {visibleFields.map((f) => (
                  <div key={f.id}>
                    <label style={labelSt}>
                      {f.effectiveRequired && <span style={{ color: "var(--danger)", marginRight: 2 }}>*</span>}
                      {f.label}
                    </label>
                    <RHStageFieldInput
                      field={f}
                      value={customValues[f.fieldKey]}
                      onChange={(val) => setCustomValues((prev) => ({ ...prev, [f.fieldKey]: val }))}
                      users={users}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Criando…" : "Adicionar colaborador"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
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
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: "var(--surface-alt)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{colaborador.fullName}</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{done}/{total} tarefas concluídas</div>
        </div>
        <div style={{ width: 80, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ width: `${progresso}%`, height: "100%", background: progresso === 100 ? "var(--success)" : "var(--accent)" }} />
        </div>
        <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, flexShrink: 0 }}>{progresso}%</span>
      </div>
      <div style={{ padding: "4px 16px 8px" }}>
        {tarefas.map((t) => (
          <TaskRow key={t.id} tarefa={t} canWrite={false} canToggle onStatusChange={onStatusChange} onDelete={() => {}} />
        ))}
      </div>
    </div>
  );
}

// ── Tabela ────────────────────────────────────────────────────────────────────
// Data prevista/relevante: data de admissão — é o campo de data central do
// onboarding (aparece no drawer, não existe outro prazo genérico por
// colaborador). Checklist reaproveita o mesmo done/total do card.

function OnboardingTableView({ colaboradores, stages, tarefasByColaborador, onRowClick }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {["Colaborador", "Cargo", "Departamento", "Etapa", "Admissão", "Checklist"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {colaboradores.length === 0 && (
            <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>Nenhum colaborador encontrado.</td></tr>
          )}
          {colaboradores.map((c) => {
            const st = findStage(stages, c.onboardingStage);
            const tarefas = tarefasByColaborador[c.id] || [];
            const done = tarefas.filter((t) => t.status === "concluida").length;
            return (
              <tr key={c.id} onClick={() => onRowClick(c)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <InitialsAvatar name={c.fullName} size={26} />
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{c.fullName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{c.jobTitle || "—"}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{c.department || "—"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: st.color + "18", color: st.color, border: `1px solid ${st.color}40` }}>
                    {st.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{fmt(c.admissionDate)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{tarefas.length > 0 ? `${done}/${tarefas.length}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Calendário ────────────────────────────────────────────────────────────────
// Agrupa por data de admissão — mesmo campo usado na tabela acima.

function OnboardingCalendarView({ colaboradores, stages, onPillClick }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map();
    for (const c of colaboradores) {
      if (!c.admissionDate) continue;
      const d = new Date(c.admissionDate.slice ? c.admissionDate.slice(0, 10) : c.admissionDate);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(c);
    }
    return map;
  }, [colaboradores]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursor]);

  const today = new Date();
  const month = cursor.getMonth();

  return (
    <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-dim)", background: "none", border: "none" }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-dim)", background: "none", border: "none" }}>
            <ChevronRight size={16} />
          </button>
          <h2 className="font-semibold" style={{ fontSize: 16, color: "var(--text)" }}>
            {MONTHS[month]} <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>{cursor.getFullYear()}</span>
          </h2>
        </div>
        <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
          Hoje
        </button>
      </div>
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border)" }}>
        {WEEKDAYS.map(w => (
          <div key={w} className="px-2 py-2 text-[10px] font-bold uppercase text-center" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(88px, auto)" }}>
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const isToday = sameDay(d, today);
          const k = dayKey(d);
          const items = byDay.get(k) || [];
          return (
            <div key={i} className="p-1.5 border-r border-b flex flex-col gap-1"
              style={{ borderColor: "#F0F0F0", background: isToday ? "#FFFBEB" : "var(--surface)", opacity: inMonth ? 1 : 0.4 }}>
              <span className="text-xs font-semibold leading-none" style={{ color: isToday ? "var(--warning)" : inMonth ? "var(--text)" : "var(--text-dim)" }}>
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map((c) => {
                  const st = findStage(stages, c.onboardingStage);
                  return (
                    <span key={c.id} onClick={() => onPillClick(c)}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer"
                      style={{ background: st.color + "18", color: st.color }}
                      title={`${c.fullName} · ${st.name}`}>
                      {c.fullName}
                    </span>
                  );
                })}
                {items.length > 3 && (
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>+{items.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function RHOnboardingView({ currentUser, canWrite, isRHUser, notifyMentions }) {
  const { templates, tarefas, loading: loadingTarefas, createTemplate, applyChecklist, updateTarefaStatus, deleteTarefa } = useRHOnboarding({ userId: currentUser?.id });
  const { colaboradores, loading: loadingColaboradores, changeOnboardingStage, updateColaborador, createColaborador } = useRHColaboradores({ userId: currentUser?.id });
  const { vagas } = useRHRecrutamento({ userId: currentUser?.id });
  const { treinamentos, atribuicoes: treinamentoAtribuicoes, assignToUsers: assignTreinamento } = useRHTreinamentos({ userId: currentUser?.id });
  const { feedbacks, createPendingCycle } = useRHFeedback({ userId: currentUser?.id });
  const { stages, loading: loadingStages } = useRHPipelineStages("onboarding");
  const onboardingStageFields = useRHStageFields("onboarding");
  const { users } = useProfiles();
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "table" | "calendar"
  const [novaTemplateOpen, setNovaTemplateOpen] = useState(false);
  const [addColaboradorStage, setAddColaboradorStage] = useState(null);
  const [drawerColaboradorId, setDrawerColaboradorId] = useState(null);
  const [stageEditorOpen, setStageEditorOpen] = useState(false);
  const [fieldEditorStage, setFieldEditorStage] = useState(null);
  const [draggedColaboradorId, setDraggedColaboradorId] = useState(null);
  const [dragOverStageKey, setDragOverStageKey] = useState(null);
  const [moveError, setMoveError] = useState(null);

  useEffect(() => {
    setMoveError(null);
  }, [drawerColaboradorId]);

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
      const frenteMatch = t.frente && colaborador.frente && t.frente === colaborador.frente;
      return cargoMatch || deptoMatch || frenteMatch;
    });
    for (const t of matches) {
      await assignTreinamento(t.id, [colaborador.id]);
    }
  };

  // Enforcement real: bloqueia sair da etapa atual com campo obrigatório
  // (estático ou condicional) vazio — antes disso "required" era só o
  // asterisco visual, confirmado ao vivo que não travava nada. Único checo
  // adicionado no topo da função — os side-effects abaixo (auto-atribuir
  // treinamento, criar ciclo de feedback) continuam intactos e só disparam
  // quando a validação passa. Antes usava alert() nativo — bloqueante, e
  // trava sessões automatizadas/headless sem handler de diálogo (achado da
  // auditoria de 14/07). Banner inline não bloqueia nada.
  const handleStageChange = async (id, stage) => {
    const colaborador = colaboradores.find((c) => c.id === id);
    if (!colaborador) return;
    const fields = onboardingStageFields.getFields(colaborador.onboardingStage);
    const missing = getMissingRequiredFields(fields, colaborador.customFields || {});
    if (missing.length > 0) {
      setMoveError(`Não dá pra mover "${colaborador.fullName}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = getInvalidFields(fields, colaborador.customFields || {});
    if (invalid.length > 0) {
      setMoveError(`Não dá pra mover "${colaborador.fullName}": corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
    setMoveError(null);
    await changeOnboardingStage(id, stage);
    if (stage === "integracao") {
      await autoAssignTreinamentos(colaborador);
    }
    if (stage === "acompanhamento" && colaborador) {
      const feedbacksDoColaborador = feedbacks.filter((f) => f.user_id === id);
      const proximo = nextPendingCycle({ ...colaborador, onboardingStage: stage }, feedbacksDoColaborador);
      if (proximo) await createPendingCycle(id, proximo.tipo, proximo.periodStart, proximo.periodEnd);
    }
    // Se veio do drawer aberto desse colaborador: fecha agora (sinal visual
    // de que moveu) e reabre já na etapa nova, em vez de só trocar o
    // conteúdo por baixo do drawer aberto.
    if (drawerColaboradorId === id) {
      setDrawerColaboradorId(null);
      reopenAfterMove(setDrawerColaboradorId, id);
    }
  };

  // Badge "X/Y campos obrigatórios" no card (auditoria 10.3).
  const getColaboradorCompleteness = (colaborador) =>
    getFieldCompleteness(onboardingStageFields.getFields(colaborador.onboardingStage), colaborador.customFields || {});

  // Criação direta numa etapa do onboarding (via "+" da coluna) — além do
  // caminho indireto já existente (contratar candidato no Recrutamento).
  const handleCreateColaborador = async (data) => { await createColaborador(data); };

  // Drag-and-drop nativo entre colunas — reusa o mesmo handleStageChange
  // (com os side-effects de treinamento/feedback) usado pelos botões
  // "Mover para", tanto no card (menu do RHKanbanCard) quanto no drawer.
  const handleCardDragStart = useCallback((id) => setDraggedColaboradorId(id), []);
  const handleCardDragEnd = useCallback(() => { setDraggedColaboradorId(null); setDragOverStageKey(null); }, []);
  const handleColumnDragOver = useCallback((e, stageKey) => { e.preventDefault(); setDragOverStageKey(stageKey); }, []);
  const handleColumnDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStageKey(null); }, []);
  const handleColumnDrop = useCallback((stageKey) => {
    if (draggedColaboradorId) {
      const colaborador = colaboradores.find((c) => c.id === draggedColaboradorId);
      if (colaborador && colaborador.onboardingStage !== stageKey) {
        handleStageChange(draggedColaboradorId, stageKey);
      }
    }
    setDraggedColaboradorId(null);
    setDragOverStageKey(null);
  }, [draggedColaboradorId, colaboradores, handleStageChange]);

  // Atividades do drawer (aba "Atividades"/"Comentários" do RHDetailDrawerShell)
  // — persiste em rh_colaboradores.activities (jsonb) via updateColaborador.
  const handleAddActivity = useCallback(async (colaboradorId, entry) => {
    const colaborador = colaboradores.find((c) => c.id === colaboradorId);
    if (!colaborador) return;
    const nextActivities = [...(colaborador.activities || []), entry];
    await updateColaborador(colaboradorId, { activities: nextActivities });
  }, [colaboradores, updateColaborador]);

  const loading = loadingTarefas || loadingColaboradores || loadingStages;

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
    const defaultStageKey = stages[0]?.stageKey || "documentacao";
    stages.forEach((s) => { map[s.stageKey] = colaboradores.filter((c) => (c.onboardingStage || defaultStageKey) === s.stageKey); });
    return map;
  }, [colaboradores, stages]);

  // R22: visão consolidada de % de conclusão — antes só existia por card
  // individual, sem nenhum rollup entre colaboradores nem por frente.
  const dashboardStats = useMemo(() => {
    const comTarefas = colaboradores.filter((c) => (tarefasByColaborador[c.id] || []).length > 0);
    const pct = (c) => {
      const t = tarefasByColaborador[c.id] || [];
      return t.length > 0 ? (t.filter((x) => x.status === "concluida").length / t.length) * 100 : null;
    };
    const overall = comTarefas.length > 0
      ? Math.round(comTarefas.reduce((sum, c) => sum + pct(c), 0) / comTarefas.length)
      : null;
    const porFrente = RH_FRENTES.map((id) => {
      const grupo = colaboradores.filter((c) => c.frente === id);
      const grupoComTarefas = grupo.filter((c) => (tarefasByColaborador[c.id] || []).length > 0);
      const media = grupoComTarefas.length > 0
        ? Math.round(grupoComTarefas.reduce((sum, c) => sum + pct(c), 0) / grupoComTarefas.length)
        : null;
      return { id, total: grupo.length, media };
    }).filter((f) => f.total > 0);
    return { total: colaboradores.length, overall, semTarefas: colaboradores.length - comTarefas.length, porFrente };
  }, [colaboradores, tarefasByColaborador]);

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
      <EmptyState icon={ClipboardCheck} title="Supabase não configurado" description="Configure as variáveis de ambiente para usar este módulo." />
    );
  }

  // ── Colaborador comum (sem acesso de RH): só o próprio checklist ──────────
  if (!isRHUser) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck size={22} style={{ color: "var(--text)" }} />
          <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Onboarding</h1>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
        ) : !meuColaborador ? (
          <EmptyState icon={ClipboardCheck} title="Nenhum checklist de onboarding pra você" description="Quando você entrar em um processo de onboarding, seu checklist aparecerá aqui." />
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
            <ClipboardCheck size={22} style={{ color: "var(--text)" }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Onboarding</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            {colaboradores.length} colaborador{colaboradores.length !== 1 ? "es" : ""} no onboarding
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
            <ViewToggleButton active={viewMode === "kanban"}   onClick={() => setViewMode("kanban")}   icon={LayoutGrid}   label="Kanban" />
            <ViewToggleButton active={viewMode === "table"}    onClick={() => setViewMode("table")}    icon={List}         label="Tabela" />
            <ViewToggleButton active={viewMode === "calendar"} onClick={() => setViewMode("calendar")} icon={CalendarIcon} label="Calendário" />
          </div>
          {canWrite && (
            <>
              <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setStageEditorOpen(true)}>Editar etapas</Button>
              <Button variant="secondary" size="sm" icon={Plus} onClick={() => setNovaTemplateOpen(true)}>Template</Button>
            </>
          )}
        </div>
      </div>

      {!loading && colaboradores.length > 0 && (
        <div className="flex items-stretch gap-3 flex-wrap mb-4">
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 16px", minWidth: 140 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Progresso geral</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>
              {dashboardStats.overall != null ? `${dashboardStats.overall}%` : "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {dashboardStats.total} colaborador{dashboardStats.total !== 1 ? "es" : ""}
              {dashboardStats.semTarefas > 0 && ` · ${dashboardStats.semTarefas} sem checklist`}
            </div>
          </div>
          {dashboardStats.porFrente.map((f) => (
            <div key={f.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 16px", minWidth: 140 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: RH_FRENTE_COLORS[f.id], textTransform: "uppercase", letterSpacing: "0.06em" }}>{RH_FRENTE_LABELS[f.id]}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>
                {f.media != null ? `${f.media}%` : "—"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{f.total} colaborador{f.total !== 1 ? "es" : ""}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : colaboradores.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nenhum colaborador cadastrado" description="Os colaboradores em onboarding aparecerão aqui." />
      ) : viewMode === "table" ? (
        <OnboardingTableView
          colaboradores={colaboradores}
          stages={stages}
          tarefasByColaborador={tarefasByColaborador}
          onRowClick={(c) => setDrawerColaboradorId(c.id)}
        />
      ) : viewMode === "calendar" ? (
        <OnboardingCalendarView
          colaboradores={colaboradores}
          stages={stages}
          onPillClick={(c) => setDrawerColaboradorId(c.id)}
        />
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16, flex: 1 }} className="flex-col md:flex-row">
          <div style={{ display: "flex", gap: 12, flexShrink: 0 }} className="hidden md:flex">
            {stages.map((stage) => (
              <OnboardingKanbanColumn
                key={stage.id}
                stage={stage}
                stages={stages}
                colaboradoresList={colaboradoresByStage[stage.stageKey] || []}
                tarefasByColaborador={tarefasByColaborador}
                vagasById={vagasById}
                onCardClick={(c) => setDrawerColaboradorId(c.id)}
                onDragStart={handleCardDragStart}
                onDragEnd={handleCardDragEnd}
                onMoveToStage={handleStageChange}
                isDragOver={dragOverStageKey === stage.stageKey}
                onColumnDragOver={handleColumnDragOver}
                onColumnDragLeave={handleColumnDragLeave}
                onColumnDrop={handleColumnDrop}
                canWrite={canWrite}
                onEditFields={setFieldEditorStage}
                getCompleteness={getColaboradorCompleteness}
                onAddColaborador={() => setAddColaboradorStage(stage.stageKey)}
              />
            ))}
          </div>
          <div className="md:hidden flex flex-col gap-3">
            {stages.map((stage) => (
              <OnboardingKanbanColumn
                key={stage.id}
                stage={stage}
                stages={stages}
                colaboradoresList={colaboradoresByStage[stage.stageKey] || []}
                tarefasByColaborador={tarefasByColaborador}
                vagasById={vagasById}
                onCardClick={(c) => setDrawerColaboradorId(c.id)}
                onDragStart={handleCardDragStart}
                onDragEnd={handleCardDragEnd}
                onMoveToStage={handleStageChange}
                isDragOver={dragOverStageKey === stage.stageKey}
                onColumnDragOver={handleColumnDragOver}
                onColumnDragLeave={handleColumnDragLeave}
                onColumnDrop={handleColumnDrop}
                canWrite={canWrite}
                onEditFields={setFieldEditorStage}
                getCompleteness={getColaboradorCompleteness}
                onAddColaborador={() => setAddColaboradorStage(stage.stageKey)}
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
          stages={stages}
          users={users}
          currentUser={currentUser}
          onStageChange={handleStageChange}
          moveError={moveError}
          onStatusChange={updateTarefaStatus}
          onDeleteTarefa={deleteTarefa}
          onApplyTemplate={applyChecklist}
          onAddTask={applyChecklist}
          notifyMentions={notifyMentions}
          onClose={() => setDrawerColaboradorId(null)}
          onUpdateCustomFields={(merged) => updateColaborador(drawerColaborador.id, { customFields: merged })}
          onAddActivity={(entry) => handleAddActivity(drawerColaborador.id, entry)}
        />
      )}

      {novaTemplateOpen && (
        <NovaTemplateModal onSave={createTemplate} onClose={() => setNovaTemplateOpen(false)} />
      )}

      {addColaboradorStage && (
        <NovoColaboradorModal
          stageId={addColaboradorStage}
          stages={stages}
          users={users}
          onSave={handleCreateColaborador}
          onClose={() => setAddColaboradorStage(null)}
        />
      )}

      {canWrite && (
        <RHStageEditorModal
          open={stageEditorOpen}
          onClose={() => setStageEditorOpen(false)}
          domain="onboarding"
          domainLabel="Onboarding"
          records={colaboradores}
          stageField="onboardingStage"
        />
      )}

      {canWrite && (
        <RHStageFieldEditorModal
          open={!!fieldEditorStage}
          onClose={() => setFieldEditorStage(null)}
          domain="onboarding"
          stageKey={fieldEditorStage?.stageKey}
          stageName={fieldEditorStage?.name}
        />
      )}
    </div>
  );
}

export default RHOnboardingView;
