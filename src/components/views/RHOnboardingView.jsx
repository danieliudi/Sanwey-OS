import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardCheck, Plus, X, Check, Trash2,
  Briefcase, Settings2, AlertCircle, Users,
  LayoutGrid, List, CalendarDays as CalendarIcon, ChevronLeft, ChevronRight, TrendingUp, Download,
} from "lucide-react";
import { RH_CONTRACT_TYPES } from "../../constants/rh-config";
import { exportOnboardingToCSV } from "../../utils/export-csv";
import { RH_FRENTES, RH_FRENTE_LABELS } from "../../constants/rh-frentes";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHOnboarding } from "../../hooks/use-rh-onboarding";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useMyColaborador } from "../../hooks/use-my-colaborador";
import { useRHRecrutamento } from "../../hooks/use-rh-recrutamento";
import { useRHTreinamentos } from "../../hooks/use-rh-treinamentos";
import { useRHFeedback } from "../../hooks/use-rh-feedback";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { useProfiles } from "../../hooks/use-profiles";
import { useRecordViews } from "../../hooks/use-record-views";
import { hasUnreadRHComment } from "../../lib/comment-badge";
import { nextPendingCycle } from "../../utils/rh-feedback-cycles";
import { parseDateInput, formatDateBR, daysSince, toLocalISODate } from "../../utils/date";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { RHStageFieldsPanel } from "../shared/stage-editor/RHStageFieldsPanel";
import { StageColorPicker } from "../shared/stage-editor/StageColorPicker";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { RHKanbanCard } from "../rh-pipeline/RHKanbanCard";
import { RHMobileKanbanAccordion } from "../rh-pipeline/RHMobileKanbanAccordion";
import { StageNavigator } from "../shared/StageNavigator";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { MobileTableCards } from "../shared/MobileTableCards";
import { RHDetailDrawerShell, RHDetailComments } from "../rh-pipeline/RHDetailDrawerShell";
import { AppToast } from "../shared/AppToast";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { AvatarStack } from "../shared/AvatarStack";
import { resolveVisibleFields, getMissingRequiredFields, getFieldCompleteness, isStageRegression } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { NovoColaboradorModal } from "./NovoColaboradorModal";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { KanbanFab } from "../shared/KanbanFab";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { KanbanColumnSortMenu } from "../shared/KanbanColumnSortMenu";
import { useKanbanColumnSort } from "../../hooks/use-kanban-sort";
import { sortKanbanItems } from "../../utils/kanban-sort";
import { stageTextColor } from "../../utils/stage-colors";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { KanbanBoardHeader } from "../shared/KanbanBoardHeader";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { FilterBar } from "../shared/FilterBar";
import { PageTitle } from "../shared/PageTitle";
import { semAcento } from "../../utils/text-search";
import { KanbanAnalyticsPanel } from "../shared/KanbanAnalyticsPanel";

// ── Etapas do onboarding ──────────────────────────────────────────────────────
// As etapas vêm de rh_pipeline_stages (domain="onboarding") — reordenar é
// drag no cabeçalho da coluna, criar é o "+ Nova etapa" ao fim do board, e
// renomear/recolorir/excluir vive em "Editar campos desta etapa" (ver
// NewStageModal e useRHPipelineStages("onboarding") mais abaixo).
// Os stageKeys (documentacao/integracao/acompanhamento/avaliacao/concluido) já
// batem com os valores existentes em rh_colaboradores.onboarding_stage.

function findStage(stages, stageKey) {
  return stages.find((s) => s.stageKey === stageKey) || stages[0] || { name: "—", color: "#8A8680", stageKey };
}


function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

// Soma de dias fuso-seguro (Onda 2, item 7): parseia data-só no fuso local e
// devolve yyyy-mm-dd sem passar por UTC — usado nos marcos ancorados na
// admissão (D+10/45/60), onde o -1 dia do addDays() distorceria o marco.
const TIPO_TRILHA_LABELS = { administrativa: "Administrativa", operacional: "Operacional", iso: "ISO (10/45/60)" };

// "Excluir" no menu de três pontos do card de Onboarding — achado de
// auditoria: deleteColaborador (use-rh-colaboradores.js) é um DELETE físico
// em rh_colaboradores, cujo CASCADE apaga sem chance de recuperação as
// avaliações, atribuições de treinamento, benefícios, movimentações e
// solicitações de atualização de dados desse colaborador. O módulo de RH já
// tem o padrão certo pra "tirar do fluxo sem apagar o cadastro" nessa mesma
// tabela — RHFuncionariosView usa employee_status="desligado" no
// offboarding. Por isso "Excluir" aqui não faz hard delete: move pra uma
// etapa terminal dedicada (handleRemoveFromOnboarding, mais abaixo),
// mantendo o colaborador intacto em Funcionários e reversível a qualquer
// momento.
//
// Não reusa a etapa terminal "concluido" pra isso — ela é terminal&&!lost,
// o mesmo critério que use-insights-metrics.js usa pra contar "tempo médio
// de onboarding concluído com sucesso" (revisão adversarial da migration
// 20260758). Um colaborador removido por engano/duplicidade contaria como
// onboarding bem-sucedido. A migration 20260758_rh_onboarding_removido_stage
// cria uma etapa terminal separada (terminal&&lost=true), mesmo padrão já
// usado no domain 'candidatos' pra "reprovado" — sai do cálculo de sucesso
// de graça (o filtro já é terminal && !lost) e ganha o selo visual de X
// vermelho que RHKanbanCard.jsx já renderiza pra qualquer stage com lost=true.
const REMOVE_FROM_ONBOARDING_CONFIRM_MESSAGE =
  "Remover do onboarding? Nada é apagado — o cadastro e o histórico continuam " +
  "intactos em Funcionários. O card só sai do board, indo pra etapa \"Removido\", e dá pra reverter a qualquer momento.";

function addDaysLocalISO(baseISO, days) {
  const d = parseDateInput(baseISO);
  if (Number.isNaN(d.getTime())) return null;
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + Number(days || 0));
  return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, "0")}-${String(r.getDate()).padStart(2, "0")}`;
}

// ── Nova etapa (local ao arquivo — mesmo molde de EntregasView.jsx/
// PosVendaView.jsx/RHFeedbackView.jsx: "Editar etapas" saiu do header, criar
// etapa agora é isso aqui, e renomear/recolorir/excluir uma já existente vive
// dentro de "Editar campos desta etapa") ─────────────────────────────────────

const NEW_STAGE_DEFAULTS_COLOR = "#64748B";

function slugifyStageKeyLocal(label) {
  return (label || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || `etapa_${Date.now().toString(36)}`;
}

function NewStageModal({ existingKeys, nextOrderIdx, onAdd, onClose }) {
  const [name, setName]   = useState("");
  const [color, setColor] = useState(NEW_STAGE_DEFAULTS_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let key = slugifyStageKeyLocal(name);
      let suffix = 1;
      while (existingKeys.includes(key)) key = `${slugifyStageKeyLocal(name)}_${suffix++}`;
      await onAdd({ stageKey: key, name: name.trim(), color, orderIdx: nextOrderIdx, terminal: false, won: false, lost: false });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar etapa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 380, boxShadow: "var(--shadow-pop)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova etapa</div>
          <button type="button" onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 6, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" }}>
            Nome da etapa
          </label>
          <div className="flex items-center gap-2.5" style={{ marginBottom: 18 }}>
            <StageColorPicker value={color} onChange={setColor} size={38} />
            <input autoFocus type="text" placeholder="Ex.: Acompanhamento 30 dias"
              value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)" }} />
          </div>
          {error && (
            <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>{error}</div>
          )}
          <button type="submit" disabled={saving || !name.trim()}
            className="w-full font-semibold py-2.5 rounded-xl text-sm"
            style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: (saving || !name.trim()) ? 0.5 : 1, border: "none", cursor: (saving || !name.trim()) ? "default" : "pointer" }}>
            {saving ? "Criando…" : "Criar etapa"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Kanban/Tabela/Calendário — mesmo padrão de ComprasMarketingView/CRMView ──

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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
    case "concluida":     return { label: "Concluída",     color: "var(--success)", bg: "var(--success-bg)" };
    case "em_andamento":  return { label: "Em andamento",  color: "color-mix(in srgb, #2563EB 60%, var(--text))", bg: "color-mix(in srgb, #2563EB 12%, var(--surface))" };
    default:              return { label: "Pendente",      color: "var(--warning)", bg: "var(--warning-bg)" };
  }
}

function TaskRow({ tarefa, users, canWrite, canToggle, onStatusChange, onDelete }) {
  const s = statusConfig(tarefa.status);
  const responsaveis = (tarefa.responsavel_ids || []).map(id => users?.find(u => u.id === id)).filter(Boolean);
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
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>Prazo: {formatDateBR(tarefa.data_limite)}</div>
      </div>
      {responsaveis.length > 0 && <AvatarStack users={responsaveis} size={22} max={3} />}
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
  onCardClick, onDragStart, onDragEnd, onMoveToStage, onDeleteCard, deleteLabel, deleteConfirmMessage,
  isDragOver, onColumnDragOver, onColumnDragLeave, onColumnDrop,
  canWrite, onEditFields, getCompleteness, getUnread, onAddColaborador, boardHeight,
  draggedColumnKey, onColumnHeaderDragStart, onColumnHeaderDragEnd, onColumnHeaderDrop,
  getSortCriteria, setSortCriteria,
}) {
  return (
    <div
      onDragOver={(e) => onColumnDragOver(e, stage.stageKey)}
      onDragLeave={onColumnDragLeave}
      onDrop={() => onColumnDrop(stage.stageKey)}
      className="flex flex-col rounded-lg transition-all duration-150"
      style={{
        width: 272, minWidth: 272,
        overflow: "hidden",
        borderRight: stage.stageKey !== stages[stages.length - 1]?.stageKey ? "1px solid var(--border)" : "none",
        background: isDragOver ? stage.color + "14" : "var(--surface-alt)",
        boxShadow: isDragOver ? `0 0 0 2px ${stage.color}40` : "none",
        height: boardHeight,
      }}
    >
      {/* Arrastável pra reordenar etapas — canal de drag separado do drop de
          card acima (onColumnDrop/onColumnDragOver/onColumnDragLeave, props
          já existentes desta coluna, servem exclusivamente o card).
          draggedColumnKey/onColumnHeaderDragStart/onColumnHeaderDragEnd/
          onColumnHeaderDrop vêm de RHOnboardingView, que usa
          handleStageReorderDrop/handleStageReorderDragEnd — nomes diferentes
          de handleColumnDrop/handleColumnDragOver/handleColumnDragLeave
          porque essas três já existem no arquivo e servem o drop de card
          (mesmo achado de colisão de nomes já resolvido em RHFeedbackView).
          stopPropagation nos handlers evita que o drag de reorder vaze pro
          <div> pai que escuta o drop de card. */}
      <div
        draggable={canWrite}
        onDragStart={() => canWrite && onColumnHeaderDragStart(stage.stageKey)}
        onDragEnd={onColumnHeaderDragEnd}
        onDragOver={e => { if (draggedColumnKey) { e.preventDefault(); e.stopPropagation(); } }}
        onDrop={e => { if (draggedColumnKey && draggedColumnKey !== stage.stageKey) { e.stopPropagation(); onColumnHeaderDrop(stage.stageKey); } }}
        style={{ cursor: canWrite ? "grab" : "default" }}
      >
        <KanbanColumnHeader
          color={stage.color}
          name={stage.name}
          description={stage.description}
          count={colaboradoresList.length}
          bandHeight={4}
          letterSpacing="normal"
          nameFontSize={14}
          nameFontWeight={700}
          uppercase={false}
          countFontSize={12}
          actions={
            <div className="flex items-center gap-1 shrink-0">
              <KanbanColumnSortMenu
                criteria={getSortCriteria(stage.stageKey)}
                onChange={(v) => setSortCriteria(stage.stageKey, v)}
                options={["recent", "alpha"]}
                accentColor={stage.color}
              />
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
          }
        />
      </div>
      <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {colaboradoresList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-dim)", fontSize: 11, opacity: 0.5, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ opacity: 0.5 }}>Nenhum colaborador nesta etapa</span>
            {!stage.terminal && <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card aqui ou crie um novo</span>}
          </div>
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
              onDeleteCard={canWrite ? onDeleteCard : undefined}
              showMoveOptions={false}
              deleteLabel={deleteLabel}
              deleteConfirmMessage={deleteConfirmMessage}
              agingDays={daysSince(c.onboardingStageChangedAt)}
              completeness={getCompleteness?.(c)}
              unread={getUnread?.(c)}
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
  onUpdateCustomFields, onAddActivity, onUpdateActivity, notifyMentions, onEditFields,
}) {
  const [templateId, setTemplateId] = useState("");
  const [novaTarefa, setNovaTarefa] = useState("");
  const [novoPrazo, setNovoPrazo] = useState(7);
  const [novoResponsavelIds, setNovoResponsavelIds] = useState([]);

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
  // Ref espelha o rascunho ACUMULADO — o timer precisa mesclar todos os campos
  // tocados, não só o último (senão editar A e B em <600ms grava só B). Flush
  // no cleanup pra não perder a edição ao fechar em <600ms. Achado da auditoria.
  const customDraftRef = useRef({});

  useEffect(() => {
    setCustomDraft({});
    customDraftRef.current = {};
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    return () => {
      if (customDebounceRef.current) { clearTimeout(customDebounceRef.current); customDebounceRef.current = null; }
      if (Object.keys(customDraftRef.current).length > 0) {
        onUpdateCustomFields({ ...(colaborador.customFields || {}), ...customDraftRef.current });
      }
    };
  }, [colaborador.id]);

  const handleCustomChange = (fieldKey, value) => {
    const next = { ...customDraftRef.current, [fieldKey]: value };
    customDraftRef.current = next;
    setCustomDraft(next);
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    customDebounceRef.current = setTimeout(() => {
      const merged = { ...(colaborador.customFields || {}), ...customDraftRef.current };
      onUpdateCustomFields(merged);
      customDebounceRef.current = null;
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
    onAddTask(colaborador.id, [{ titulo: novaTarefa.trim(), dataLimite: addDays(toLocalISODate(new Date()), novoPrazo), responsavelIds: novoResponsavelIds }]);
    setNovaTarefa("");
    setNovoPrazo(7);
    setNovoResponsavelIds([]);
  };

  const handleApplyTemplate = () => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl || !Array.isArray(tpl.checklist_padrao) || tpl.checklist_padrao.length === 0) return;
    // Marcos ancorados na data de admissão (trilha ISO 10/45/60): "D+N" passa a
    // significar N dias APÓS a admissão, não após a data de aplicação. Sem
    // admissão cadastrada, cai no fallback de hoje.
    const anchor = colaborador.admissionDate ? String(colaborador.admissionDate).slice(0, 10) : toLocalISODate(new Date());
    onApplyTemplate(colaborador.id, tpl.checklist_padrao.map((i) => ({ titulo: i.titulo, dataLimite: addDaysLocalISO(anchor, i.dias_prazo) })), tpl.id);
    setTemplateId("");
  };

  const header = (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
      <InitialsAvatar name={colaborador.fullName} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{colaborador.fullName}</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{colaborador.jobTitle || "—"} · {colaborador.department || "—"}</div>
        <div style={{ marginTop: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${st.color}18`, color: stageTextColor(st.color), borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, display: "inline-block" }} /> {st.name}
          </span>
        </div>
      </div>
    </div>
  );

  // "Campos desta etapa" vira o centro fixo do drawer (padrão platform-wide,
  // CLAUDE.md regra 3/item 2, rodada de 07/08/2026) — não faz mais parte da
  // aba "Form" junto do checklist de integração (que é conteúdo próprio do
  // Onboarding, não campo configurável).
  const center = visibleCustomDefs.length === 0 ? (
    <button
      onClick={() => onEditFields?.(st)}
      className="text-xs text-center cursor-pointer"
      style={{ background: "none", border: "none", color: "var(--text-dim)", lineHeight: 1.6, padding: "16px 0", textAlign: "center", width: "100%" }}
    >
      Nenhum campo nessa fase. <span style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}>Clique aqui para editar essa etapa.</span>
    </button>
  ) : (
    <div>
      <div style={labelSt}>Campos desta etapa</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visibleCustomDefs.map((f) => (
          <div key={f.id}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
              {f.effectiveRequired && <span style={{ color: "var(--danger)", marginRight: 4 }}>*</span>}
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
              touched={Boolean(moveError)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const formContent = (
    <>
      <div>
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
                users={users}
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
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="text-xs rounded-lg border px-2 py-1.5 outline-none" style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface-alt)", flex: "1 1 0", minWidth: 0 }}>
                  {/* `flex: 1 1 0` + `minWidth: 0`, não `flex: 1` seco: um <select>
                      tem largura mínima intrínseca igual à da opção mais longa e não
                      encolhe abaixo dela como item flex. O rótulo do template é
                      cargo + trilha, digitado pelo RH — num drawer estreito, o botão
                      "Aplicar" saía do card. Achado no checkup de 01/09/2026. */}
                  <option value="">Aplicar template…</option>
                  {templates.map((t) => {
                    const base = t.cargo || RH_FRENTE_LABELS[t.frente] || t.frente || "Template";
                    const trilha = t.tipo_trilha ? ` · ${TIPO_TRILHA_LABELS[t.tipo_trilha] || t.tipo_trilha}` : "";
                    return <option key={t.id} value={t.id}>{base}{trilha}</option>;
                  })}
                </select>
                <button onClick={handleApplyTemplate} disabled={!templateId} style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 11, fontWeight: 700, cursor: templateId ? "pointer" : "default", opacity: templateId ? 1 : 0.5 }}>
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
            <div style={{ marginTop: 6 }}>
              <AssigneeMultiSelect
                value={novoResponsavelIds}
                onChange={setNovoResponsavelIds}
                options={users}
                placeholder="Responsável (opcional)…"
              />
            </div>
          </>
        )}
      </div>
    </>
  );

  const left = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Telefone", value: colaborador.phone || "—" },
          { label: "E-mail", value: colaborador.email || "—" },
          { label: "Tipo de contrato", value: RH_CONTRACT_TYPES.find((c) => c.id === colaborador.contractType)?.label || "—" },
          { label: "Data de admissão", value: formatDateBR(colaborador.admissionDate) },
          { label: "Vaga de origem", value: vagaTitle || "—" },
          { label: "Checklist", value: total > 0 ? `${done}/${total} concluídas` : "Sem tarefas" },
        ].map((f) => (
          <div key={f.label}>
            <div style={labelSt}>{f.label}</div>
            <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{f.value}</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", margin: "12px 0" }} />

      <RHDetailDrawerShell
        domain="onboarding"
        recordId={colaborador.id}
        activities={colaborador.activities || []}
        onAddActivity={onAddActivity}
        currentUser={currentUser}
        users={users}
        stages={stages}
        formContent={formContent}
        record={{ ...colaborador, stage: colaborador.onboardingStage, stageChangedAt: colaborador.onboardingStageChangedAt }}
        recordTitle={colaborador.fullName}
        domainLabel="Onboarding"
      />
    </>
  );

  const right = (
    <>
      {canWrite && (
        <div>
          <div style={labelSt}>Mover para</div>
          {moveError && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 11 }}>
              <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              {moveError}
            </div>
          )}
          <StageNavigator
            targets={stages.filter((s) => s.stageKey !== colaborador.onboardingStage)}
            onMove={(stageKey) => onStageChange(colaborador.id, stageKey)}
            getKey={(s) => s.stageKey}
            currentStageKey={colaborador.onboardingStage}
            allStages={stages}
          />
        </div>
      )}

      {/* Comentários — sempre visíveis na lateral direita, abaixo da
          movimentação de card (não mais escondidos atrás de uma aba). */}
      <RHDetailComments
        activities={colaborador.activities || []}
        onAddActivity={onAddActivity}
        onUpdateActivity={onUpdateActivity ? (activityId, patch) => onUpdateActivity(colaborador.id, activityId, patch) : undefined}
        currentUser={currentUser}
        users={users}
        notifyMentions={notifyMentions}
        mentionLink={{ module: "rh_onboarding", id: colaborador.id }}
        mentionContextLabel={colaborador.fullName}
      />
    </>
  );

  return (
    <SplitPanelDrawer onClose={onClose} header={header} left={left} center={center} right={right} />
  );
}

// ── Modal: nova template ──────────────────────────────────────────────────────

function NovaTemplateModal({ onSave, onClose }) {
  const [cargo, setCargo]   = useState("");
  const [frente, setFrente] = useState("");
  const [tipoTrilha, setTipoTrilha] = useState("");
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
        tipo_trilha: tipoTrilha || null,
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
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
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
              <label style={labelSt}>Trilha</label>
              <select value={tipoTrilha} onChange={(e) => setTipoTrilha(e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt}>
                <option value="">Geral</option>
                <option value="administrativa">Administrativa</option>
                <option value="operacional">Operacional</option>
                <option value="iso">ISO (marcos 10/45/60)</option>
              </select>
              <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>
                Diferencia trilhas por tipo de cargo. Na trilha ISO, os "D+N" contam a partir da admissão do colaborador.
              </p>
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

          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Salvar template"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: tarefa em lote ─────────────────────────────────────────────────────
// Envia UMA tarefa (aviso de segurança, entrega de uniforme, etc.) pra um grupo
// de colaboradores em onboarding de uma vez. Filtra por frente e deixa marcar/
// desmarcar quem recebe. Prazo é D+N a partir de hoje (não é um marco de
// admissão — é um aviso pontual).
function BulkTarefaModal({ colaboradores, onApply, onClose }) {
  const [titulo, setTitulo] = useState("");
  const [prazoDias, setPrazoDias] = useState(3);
  const [frenteFiltro, setFrenteFiltro] = useState("todas");
  const [selected, setSelected] = useState(() => new Set(colaboradores.map((c) => c.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(0);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const visiveis = useMemo(
    () => colaboradores.filter((c) => frenteFiltro === "todas" || c.frente === frenteFiltro),
    [colaboradores, frenteFiltro]
  );
  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const selVisiveis = visiveis.filter((c) => selected.has(c.id)).length;
  const allVisiveisSel = visiveis.length > 0 && selVisiveis === visiveis.length;
  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allVisiveisSel) visiveis.forEach((c) => next.delete(c.id));
    else visiveis.forEach((c) => next.add(c.id));
    return next;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Só quem está VISÍVEL no filtro de frente. `selected` nasce com todo
    // mundo marcado e o filtro nunca o podava, então a tela mostrava
    // "Destinatários (5/5)" e o botão dizia "Enviar a 40" — e enviava aos 40.
    // Achado da varredura de 01/09/2026, mesma classe do bug de Recrutamento
    // (ação em massa alcançando quem o filtro escondeu).
    const ids = visiveis.filter((c) => selected.has(c.id)).map((c) => c.id);
    if (!titulo.trim()) { setError("Descreva a tarefa."); return; }
    if (ids.length === 0) { setError("Selecione ao menos um colaborador."); return; }
    setSaving(true);
    setError(null);
    try {
      // `toLocalISODate`, não `toISOString().slice(0,10)`: o segundo grava o
      // dia UTC, então depois das 21h em BRT o prazo do checklist nascia um
      // dia à frente do que a pessoa escolheu.
      const dataLimite = addDays(toLocalISODate(new Date()), prazoDias);
      await onApply(ids, [{ titulo: titulo.trim(), dataLimite }]);
      setDone(ids.length);
    } catch (err) {
      setError(err?.message || "Erro ao enviar a tarefa em lote.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface-alt)", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "var(--shadow-pop)", maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Tarefa em lote</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>

        {done > 0 ? (
          <div style={{ padding: "28px 24px", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Check size={24} color="var(--success)" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Tarefa enviada a {done} colaborador{done !== 1 ? "es" : ""}</div>
            <button onClick={onClose} style={{ marginTop: 16, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 20px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>Fechar</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
            <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
              <div>
                <label style={labelSt}>Tarefa</label>
                <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Aviso de segurança NR / Entrega de uniforme" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} autoFocus />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelSt}>Prazo (D+ dias)</label>
                  <input type="number" min="0" value={prazoDias} onChange={(e) => setPrazoDias(Number(e.target.value) || 0)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Frente</label>
                  <select value={frenteFiltro} onChange={(e) => setFrenteFiltro(e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt}>
                    <option value="todas">Todas</option>
                    {RH_FRENTES.map((id) => <option key={id} value={id}>{RH_FRENTE_LABELS[id]}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <label style={{ ...labelSt, marginBottom: 0 }}>Destinatários ({selVisiveis}/{visiveis.length})</label>
                  {visiveis.length > 0 && (
                    <button type="button" onClick={toggleAll} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                      {allVisiveisSel ? "Desmarcar todos" : "Marcar todos"}
                    </button>
                  )}
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, maxHeight: 180, overflowY: "auto" }}>
                  {visiveis.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "12px" }}>Nenhum colaborador nesta frente.</div>
                  ) : visiveis.map((c) => (
                    <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                      <span style={{ fontSize: 13, color: "var(--text)" }}>{c.fullName}</span>
                      {c.jobTitle && <span style={{ fontSize: 11, color: "var(--text-dim)" }}>· {c.jobTitle}</span>}
                    </label>
                  ))}
                </div>
              </div>

              {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
            </div>

            <div style={{ padding: "12px 24px 20px", display: "flex", gap: 8, borderTop: "1px solid var(--border)" }}>
              <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
                {/* `selVisiveis`, não `selected.size` — o botão tem que dizer
                    o mesmo número que o rótulo "Destinatários" logo acima. */}
                {saving ? "Enviando…" : `Enviar a ${selVisiveis}`}
              </button>
              <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Visão individual (colaborador logado, não-RH) ────────────────────────────

function MeuChecklist({ colaborador, tarefas, users, onStatusChange }) {
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
        {total > 0 && (
          <>
            <div style={{ width: 80, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden", flexShrink: 0 }}>
              <div style={{ width: `${progresso}%`, height: "100%", background: progresso === 100 ? "var(--success)" : "var(--accent)" }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, flexShrink: 0 }}>{progresso}%</span>
          </>
        )}
      </div>
      {total === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nenhuma tarefa no seu checklist ainda" description="O RH ainda não montou seu checklist de integração — volte aqui em breve." />
      ) : (
        <div style={{ padding: "4px 16px 8px" }}>
          {tarefas.map((t) => (
            <TaskRow key={t.id} tarefa={t} users={users} canWrite={false} canToggle onStatusChange={onStatusChange} onDelete={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tabela ────────────────────────────────────────────────────────────────────
// Data prevista/relevante: data de admissão — é o campo de data central do
// onboarding (aparece no drawer, não existe outro prazo genérico por
// colaborador). Checklist reaproveita o mesmo done/total do card.

function OnboardingTableView({ colaboradores, stages, tarefasByColaborador, onRowClick }) {
  return (
    <>
    <MobileTableCards
      rows={colaboradores}
      onRowClick={onRowClick}
      emptyMessage="Nenhum colaborador encontrado."
      title={(c) => c.fullName}
      chips={(c) => {
        const st = findStage(stages, c.onboardingStage);
        return [{ label: st.name, color: st.color }];
      }}
      right={(c) => {
        const tarefas = tarefasByColaborador[c.id] || [];
        const done = tarefas.filter((t) => t.status === "concluida").length;
        return (
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {tarefas.length > 0 ? `${done}/${tarefas.length}` : "—"}
          </span>
        );
      }}
      meta={(c) => [c.jobTitle, c.department].filter(Boolean).join(" · ") || "—"}
      metaRight={(c) => <span>{formatDateBR(c.admissionDate)}</span>}
    />
    <div className="hidden md:block rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
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
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: st.color + "18", color: stageTextColor(st.color), border: `1px solid ${st.color}40` }}>
                    {st.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{formatDateBR(c.admissionDate)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{tarefas.length > 0 ? `${done}/${tarefas.length}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
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
    const offset = first.getDay();
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
          <div key={w} className="px-2 py-2 text-[10px] font-bold text-center" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>{w}</div>
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
              style={{ borderColor: "var(--border)", background: "var(--surface)", opacity: inMonth ? 1 : 0.4 }}>
              <span className="text-xs font-semibold leading-none" style={isToday
                ? { width: 20, height: 20, borderRadius: "50%", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--accent)", color: "var(--on-accent)" }
                : { color: inMonth ? "var(--text)" : "var(--text-dim)" }}>
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map((c) => {
                  const st = findStage(stages, c.onboardingStage);
                  return (
                    <span key={c.id} onClick={() => onPillClick(c)}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer"
                      style={{ background: st.color + "18", color: stageTextColor(st.color) }}
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
  const { templates, tarefas, loading: loadingTarefas, createTemplate, applyChecklist, applyTaskToMany, updateTarefaStatus, deleteTarefa } = useRHOnboarding({ userId: currentUser?.id });
  // deleteColaborador (hard delete + CASCADE) foi removido do hook — nenhuma
  // tela do app oferecia um caminho seguro e intencional pra ele (era um
  // import morto em RHFuncionariosView, e o único uso real, aqui no
  // Onboarding, foi substituído por handleRemoveFromOnboarding — ver
  // REMOVE_FROM_ONBOARDING_CONFIRM_MESSAGE acima).
  const { colaboradores, loading: loadingColaboradores, changeOnboardingStage, updateColaborador, createColaborador } = useRHColaboradores({ userId: currentUser?.id });
  const { meuColaborador, loading: loadingMeuColaborador } = useMyColaborador(currentUser);
  const { vagas } = useRHRecrutamento({ userId: currentUser?.id });
  const vagasById = useMemo(() => new Map(vagas.map((v) => [v.id, v])), [vagas]);
  const { treinamentos, atribuicoes: treinamentoAtribuicoes, assignToUsers: assignTreinamento } = useRHTreinamentos({ userId: currentUser?.id });
  const { feedbacks, createPendingCycle } = useRHFeedback({ userId: currentUser?.id });
  const { stages, loading: loadingStages, addStage, reorderStages } = useRHPipelineStages("onboarding");
  // Etapa terminal "de saída" (ex.: "Removido") — alvo de
  // handleRemoveFromOnboarding. Especificamente terminal && lost, não
  // qualquer terminal: "concluido" também é terminal, mas é terminal &&
  // !lost, o critério que use-insights-metrics.js usa pra contar "onboarding
  // concluído com sucesso" — usar "concluido" aqui poluiria essa métrica pra
  // quem foi só removido/cadastrado por engano (ver migration
  // 20260758_rh_onboarding_removido_stage.sql). Calculada a partir de
  // rh_pipeline_stages (admin pode renomear/reordenar via "Editar etapas"),
  // nunca hardcoded — se não houver etapa terminal+lost configurada, a
  // opção "Excluir" fica indisponível (ver onDeleteCard abaixo).
  const onboardingRemovedStageKey = useMemo(() => stages.find((s) => s.terminal && s.lost)?.stageKey || null, [stages]);
  const [search, setSearch] = useState("");
  // Único array que Kanban, Tabela, Calendário e Análise consomem (CLAUDE.md,
  // regra 11 — nenhuma view reimplementa o próprio escopo). Campos: os que o
  // card mostra — nome, cargo/departamento e a vaga de origem.
  const filtered = useMemo(() => {
    const termo = semAcento(search).trim();
    if (!termo) return colaboradores;
    return colaboradores.filter((c) =>
      semAcento(c.fullName).includes(termo) ||
      semAcento(c.jobTitle).includes(termo) ||
      semAcento(c.department).includes(termo) ||
      semAcento(vagasById.get(c.vagaId)?.title).includes(termo)
    );
  }, [colaboradores, search, vagasById]);
  // Contador do cabeçalho não deve incluir quem já foi "Removido" (etapa só
  // visível na Tabela) — achado #13 do roteiro de treinamento de RH
  // (31/07/2026), mesmo critério terminal&&lost já usado acima. Roda sobre o
  // array já buscado pra não mostrar um número diferente do que está na tela;
  // o critério terminal&&lost em si não mudou.
  const colaboradoresEmOnboarding = useMemo(
    () => onboardingRemovedStageKey ? filtered.filter((c) => c.onboardingStage !== onboardingRemovedStageKey) : filtered,
    [filtered, onboardingRemovedStageKey]
  );
  const onboardingStageFields = useRHStageFields("onboarding");
  const { users } = useProfiles();
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "table" | "calendar" | "analytics"
  const [novaTemplateOpen, setNovaTemplateOpen] = useState(false);
  const [bulkTarefaOpen, setBulkTarefaOpen] = useState(false);
  const [addColaboradorStage, setAddColaboradorStage] = useState(null);
  const [drawerColaboradorId, setDrawerColaboradorId] = useState(null);
  const [fieldEditorStage, setFieldEditorStage] = useState(null);
  const [addingStage, setAddingStage] = useState(false);
  const [draggedColumnKey, setDraggedColumnKey] = useState(null);
  const [draggedColaboradorId, setDraggedColaboradorId] = useState(null);
  const [dragOverStageKey, setDragOverStageKey] = useState(null);
  const [moveError, setMoveError] = useState(null);
  // O board (boardRef) fica escondido atrás do "Carregando…" enquanto
  // loadingTarefas/loadingColaboradores/loadingStages/loadingMeuColaborador
  // são true (ver render mais abaixo, `loading ? <Carregando/> : ...`) —
  // nesse primeiro efeito, `el` é null e o hook sai cedo (não arma
  // ResizeObserver nem listener de resize nenhum). viewMode não muda quando o
  // carregamento termina, então sem essas 4 flags aqui o efeito nunca
  // re-executava depois que o board finalmente montava, e `boardHeight`
  // ficava travado no fallback (480) pelo resto da sessão — board sempre
  // mais baixo que o espaço disponível. Mesmo achado/fix já aplicado em
  // RHRecrutamentoView.jsx (ver comentário lá) — mesma lógica documentada no
  // próprio hook ("loading terminando" como exemplo de dep).
  const [boardRef, boardHeight] = useAvailableHeight(16, [viewMode, loadingTarefas, loadingColaboradores, loadingStages, loadingMeuColaborador]);

  const { viewedAt, markViewed } = useRecordViews("rh_onboarding", currentUser?.id);

  useEffect(() => {
    setMoveError(null);
    if (drawerColaboradorId) markViewed(drawerColaboradorId);
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
    // Campo obrigatório trava AVANÇAR, não VOLTAR (ver isStageRegression).
    const goingBack = isStageRegression(stages, colaborador.onboardingStage, stage);
    const fields = onboardingStageFields.getFields(colaborador.onboardingStage);
    const missing = goingBack ? [] : getMissingRequiredFields(fields, colaborador.customFields || {});
    if (missing.length > 0) {
      setMoveError(`Não dá pra mover "${colaborador.fullName}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = goingBack ? [] : getInvalidFields(fields, colaborador.customFields || {});
    if (invalid.length > 0) {
      setMoveError(`Não dá pra mover "${colaborador.fullName}": corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
    setMoveError(null);
    try {
      await changeOnboardingStage(id, stage);
    } catch (e) {
      setMoveError(e?.message || `Não foi possível mover "${colaborador.fullName}" — tente novamente.`);
      return;
    }
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

  // "Excluir" no menu "…" do Kanban de Onboarding — NÃO é hard delete (ver
  // REMOVE_FROM_ONBOARDING_CONFIRM_MESSAGE acima pro porquê). Move o
  // colaborador pra etapa terminal via changeOnboardingStage direto — sem
  // passar por handleStageChange — porque "sair do board" não deveria ficar
  // travado pela validação de campos obrigatórios da etapa atual (a mesma
  // razão pela qual um delete de verdade também não seria bloqueado por ela).
  // Fecha o drawer se estava aberto nesse colaborador, mesmo padrão de antes.
  const handleRemoveFromOnboarding = async (id) => {
    if (!onboardingRemovedStageKey) return;
    await changeOnboardingStage(id, onboardingRemovedStageKey);
    if (drawerColaboradorId === id) setDrawerColaboradorId(null);
  };

  // Badge "X/Y campos obrigatórios" no card (auditoria 10.3).
  const getColaboradorCompleteness = (colaborador) =>
    getFieldCompleteness(onboardingStageFields.getFields(colaborador.onboardingStage), colaborador.customFields || {});

  // Criação direta numa etapa do onboarding (via "+" da coluna) — além do
  // caminho indireto já existente (contratar candidato no Recrutamento).
  const handleCreateColaborador = async (data) => createColaborador(data);

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

  // Canal de drag separado do drop de card acima (draggedColumnKey vs
  // draggedColaboradorId) — reordena etapas arrastando o cabeçalho da
  // coluna. Nomeado handleStageReorder* (não handleColumnDragEnd/
  // handleColumnDrop, o molde do rollout) porque handleColumnDrop/
  // handleColumnDragOver/handleColumnDragLeave já existem acima e servem
  // exclusivamente o drop de card (colisão de nomes já resolvida do mesmo
  // jeito em RHFeedbackView).
  const handleStageReorderDragEnd = useCallback(() => setDraggedColumnKey(null), []);
  const handleStageReorderDrop = useCallback((targetStageKey) => {
    const draggedKey = draggedColumnKey;
    setDraggedColumnKey(null);
    if (!draggedKey || draggedKey === targetStageKey) return;
    const order = stages.map(s => s.stageKey);
    const fromIdx = order.indexOf(draggedKey);
    const toIdx   = order.indexOf(targetStageKey);
    if (fromIdx === -1 || toIdx === -1) return;
    const nextOrder = [...order];
    nextOrder.splice(fromIdx, 1);
    nextOrder.splice(toIdx, 0, draggedKey);
    const dbIdByKey = new Map(stages.map(s => [s.stageKey, s.id]));
    const orderedIds = nextOrder.map(k => dbIdByKey.get(k)).filter(Boolean);
    if (orderedIds.length === nextOrder.length) reorderStages(orderedIds);
  }, [draggedColumnKey, stages, reorderStages]);

  // Atividades do drawer (aba "Atividades"/"Comentários" do RHDetailDrawerShell)
  // — persiste em rh_colaboradores.activities (jsonb) via updateColaborador.
  const handleAddActivity = useCallback(async (colaboradorId, entry) => {
    const colaborador = colaboradores.find((c) => c.id === colaboradorId);
    if (!colaborador) return;
    const nextActivities = [...(colaborador.activities || []), entry];
    await updateColaborador(colaboradorId, { activities: nextActivities });
  }, [colaboradores, updateColaborador]);

  const handleUpdateActivity = useCallback(async (colaboradorId, activityId, patch) => {
    const colaborador = colaboradores.find((c) => c.id === colaboradorId);
    if (!colaborador) return;
    const nextActivities = (colaborador.activities || []).map((a) => (a.id === activityId ? { ...a, ...patch } : a));
    await updateColaborador(colaboradorId, { activities: nextActivities });
  }, [colaboradores, updateColaborador]);

  const loading = loadingTarefas || loadingColaboradores || loadingStages || loadingMeuColaborador;

  const tarefasByColaborador = useMemo(() => {
    const map = {};
    tarefas.forEach((t) => {
      if (!map[t.colaborador_id]) map[t.colaborador_id] = [];
      map[t.colaborador_id].push(t);
    });
    return map;
  }, [tarefas]);

  const { getCriteria: getSortCriteria, setCriteria: setSortCriteria } = useKanbanColumnSort("rh-onboarding");
  const colaboradoresByStage = useMemo(() => {
    const map = {};
    const defaultStageKey = stages[0]?.stageKey || "documentacao";
    stages.forEach((s) => {
      const list = filtered.filter((c) => (c.onboardingStage || defaultStageKey) === s.stageKey);
      map[s.stageKey] = sortKanbanItems(list, getSortCriteria(s.stageKey), {
        name: c => c.fullName,
        createdAt: c => c.createdAt,
      });
    });
    return map;
  }, [filtered, stages, getSortCriteria]);

  // R22: visão consolidada de % de conclusão — antes só existia por card
  // individual, sem nenhum rollup entre colaboradores nem por frente.
  const dashboardStats = useMemo(() => {
    const comTarefas = filtered.filter((c) => (tarefasByColaborador[c.id] || []).length > 0);
    const pct = (c) => {
      const t = tarefasByColaborador[c.id] || [];
      return t.length > 0 ? (t.filter((x) => x.status === "concluida").length / t.length) * 100 : null;
    };
    const overall = comTarefas.length > 0
      ? Math.round(comTarefas.reduce((sum, c) => sum + pct(c), 0) / comTarefas.length)
      : null;
    const porFrente = RH_FRENTES.map((id) => {
      const grupo = filtered.filter((c) => c.frente === id);
      const grupoComTarefas = grupo.filter((c) => (tarefasByColaborador[c.id] || []).length > 0);
      const media = grupoComTarefas.length > 0
        ? Math.round(grupoComTarefas.reduce((sum, c) => sum + pct(c), 0) / grupoComTarefas.length)
        : null;
      return { id, total: grupo.length, media };
    }).filter((f) => f.total > 0);
    return { total: filtered.length, overall, semTarefas: filtered.length - comTarefas.length, porFrente };
  }, [filtered, tarefasByColaborador]);

  const drawerColaborador = useMemo(
    () => colaboradores.find((c) => c.id === drawerColaboradorId) || null,
    [colaboradores, drawerColaboradorId]
  );

  const analyticsStages = useMemo(
    () => stages.filter((s) => !s.terminal).map((s) => ({ key: s.stageKey, name: s.name, color: s.color, slaDays: s.slaDays })),
    [stages]
  );

  // "Tempo médio até Removido": só quando a etapa terminal+lost existe e tem
  // colaboradores nela — onboardingStageChangedAt (não "stageChangedAt", ver
  // rowToColaborador em use-rh-colaboradores.js) marca quando entraram nela.
  const onboardingSpecificStats = useMemo(() => {
    const stats = [
      { label: "% médio de checklist concluído", value: dashboardStats.overall != null ? `${dashboardStats.overall}%` : "—" },
      // Antes vivia numa faixa fixa acima do board (visível em toda view, não
      // só na Análise) — achado do vídeo, movido pra cá por decisão do Daniel.
      ...dashboardStats.porFrente.map((f) => ({
        label: `Progresso — ${RH_FRENTE_LABELS[f.id]}`,
        value: f.media != null ? `${f.media}%` : "—",
      })),
    ];
    if (onboardingRemovedStageKey) {
      const removidos = filtered.filter(
        (c) => c.onboardingStage === onboardingRemovedStageKey && c.createdAt && c.onboardingStageChangedAt
      );
      const avgDays = removidos.length > 0
        ? Math.round(removidos.reduce((sum, c) => sum + (new Date(c.onboardingStageChangedAt).getTime() - new Date(c.createdAt).getTime()) / 86400000, 0) / removidos.length)
        : null;
      stats.push({ label: "Tempo médio até Removido", value: avgDays !== null ? `${avgDays}d` : "—" });
    }
    return stats;
  }, [dashboardStats.overall, dashboardStats.porFrente, filtered, onboardingRemovedStageKey]);

  if (!isSupabaseConfigured) {
    return (
      <EmptyState icon={ClipboardCheck} title="Supabase não configurado" description="Configure as variáveis de ambiente para usar este módulo." />
    );
  }

  // ── Colaborador comum (sem acesso de RH): só o próprio checklist ──────────
  if (!isRHUser) {
    return (
      <div>
        <div className="mb-4">
          <PageTitle icon={ClipboardCheck} title="Onboarding" />
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
        ) : !meuColaborador ? (
          <EmptyState icon={ClipboardCheck} title="Nenhum checklist de onboarding pra você" description="Quando você entrar em um processo de onboarding, seu checklist aparecerá aqui." />
        ) : (
          <MeuChecklist
            colaborador={meuColaborador}
            tarefas={tarefasByColaborador[meuColaborador.id] || []}
            users={users}
            onStatusChange={updateTarefaStatus}
          />
        )}
      </div>
    );
  }

  // ── RH: Kanban completo ────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <KanbanBoardHeader className="mb-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Contagem é resumo AO VIVO (muda com busca/etapas), não descrição
            estática — por isso vai em `summary`, não em `description`
            (ver cabeçalho de PageTitle.jsx). */}
        <PageTitle
          icon={ClipboardCheck}
          title="Onboarding"
          summary={`${colaboradoresEmOnboarding.length} colaborador${colaboradoresEmOnboarding.length !== 1 ? "es" : ""} no onboarding`}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {/* Busca sempre visível, fora do bloco condicional de `viewMode`
              (CLAUDE.md, regra 11) — vale igual em Kanban, Tabela,
              Calendário e Análise. */}
          <FilterBar
            search={{
              value: search,
              onChange: e => setSearch(e.target.value),
              placeholder: "Buscar colaborador…",
              dataTour: "rh-onboarding-busca-card",
            }}
          />
          <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
            <ViewToggleButton active={viewMode === "kanban"}   onClick={() => setViewMode("kanban")}   icon={LayoutGrid}   label="Kanban" iconOnlyMobile />
            <ViewToggleButton active={viewMode === "table"}    onClick={() => setViewMode("table")}    icon={List}         label="Tabela" iconOnlyMobile />
            <ViewToggleButton active={viewMode === "calendar"} onClick={() => setViewMode("calendar")} icon={CalendarIcon} label="Calendário" iconOnlyMobile />
            <ViewToggleButton active={viewMode === "analytics"} onClick={() => setViewMode("analytics")} icon={TrendingUp} label="Análise" iconOnlyMobile />
          </div>
          <Button variant="secondary" size="sm" icon={Download} onClick={() => exportOnboardingToCSV(colaboradoresEmOnboarding, { stages })}>Exportar CSV</Button>
          {canWrite && (
            <>
              {/* Ponto de entrada direto pro Onboarding — cadastra alguém que já
                  está em processo sem precisar ter vindo do Recrutamento.
                  Reaproveita o mesmo NovoColaboradorModal e o mesmo estado
                  (addColaboradorStage) já usados pelo "+" de cada coluna,
                  só que abrindo direto na primeira etapa do board. */}
              <Button variant="primary" size="sm" icon={Plus} onClick={() => setAddColaboradorStage(stages[0]?.stageKey || null)}>
                Novo colaborador
              </Button>
              <Button variant="secondary" size="sm" icon={Users} onClick={() => setBulkTarefaOpen(true)}>Tarefa em lote</Button>
              <Button variant="secondary" size="sm" icon={Plus} onClick={() => setNovaTemplateOpen(true)}>Template</Button>
            </>
          )}
        </div>
      </div>
      </KanbanBoardHeader>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : viewMode === "table" ? (
        <OnboardingTableView
          colaboradores={filtered}
          stages={stages}
          tarefasByColaborador={tarefasByColaborador}
          onRowClick={(c) => setDrawerColaboradorId(c.id)}
        />
      ) : viewMode === "calendar" ? (
        <OnboardingCalendarView
          colaboradores={filtered}
          stages={stages}
          onPillClick={(c) => setDrawerColaboradorId(c.id)}
        />
      ) : viewMode === "analytics" ? (
        <KanbanAnalyticsPanel
          stages={analyticsStages}
          records={filtered}
          getStageKey={(c) => c.onboardingStage}
          getStageEnteredAt={(c) => c.onboardingStageChangedAt}
          specificStats={onboardingSpecificStats}
        />
      ) : (
        <>
          <RHMobileKanbanAccordion
            stages={stages}
            itemsByStage={colaboradoresByStage}
            getSortCriteria={getSortCriteria}
            setSortCriteria={setSortCriteria}
            sortOptions={["recent", "alpha"]}
            renderCard={(c) => (
              <RHKanbanCard
                key={c.id}
                id={c.id}
                stage={c.onboardingStage}
                stages={stages}
                onClick={() => setDrawerColaboradorId(c.id)}
                onDragStart={canWrite ? handleCardDragStart : undefined}
                onDragEnd={canWrite ? handleCardDragEnd : undefined}
                onMoveToStage={canWrite ? handleStageChange : undefined}
                onDeleteCard={canWrite && onboardingRemovedStageKey ? handleRemoveFromOnboarding : undefined}
                deleteLabel="Remover do onboarding"
                deleteConfirmMessage={REMOVE_FROM_ONBOARDING_CONFIRM_MESSAGE}
                agingDays={daysSince(c.onboardingStageChangedAt)}
                completeness={getColaboradorCompleteness?.(c)}
                unread={hasUnreadRHComment(c, viewedAt, currentUser?.id)}
              >
                <OnboardingCardBody
                  colaborador={c}
                  tarefas={tarefasByColaborador[c.id] || []}
                  vagaTitle={vagasById.get(c.vagaId)?.title}
                />
              </RHKanbanCard>
            )}
            onAdd={canWrite ? (stageKey) => setAddColaboradorStage(stageKey) : undefined}
            addLabel="Adicionar colaborador"
            emptyLabel="Ninguém aqui"
          />
          {canWrite && (
            <button
              onClick={() => setAddingStage(true)}
              className="lg:hidden w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed text-xs font-semibold"
              style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
            >
              <Plus size={13} />
              Nova etapa
            </button>
          )}
          <div className="hidden lg:block">
            <KanbanBoardScrollArea scrollRef={boardRef} height={boardHeight}>
              <div className="flex gap-2" style={{ minWidth: `${stages.length * 280}px` }}>
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
                    onDeleteCard={onboardingRemovedStageKey ? handleRemoveFromOnboarding : undefined}
                    deleteLabel="Remover do onboarding"
                    deleteConfirmMessage={REMOVE_FROM_ONBOARDING_CONFIRM_MESSAGE}
                    isDragOver={dragOverStageKey === stage.stageKey}
                    onColumnDragOver={handleColumnDragOver}
                    onColumnDragLeave={handleColumnDragLeave}
                    onColumnDrop={handleColumnDrop}
                    canWrite={canWrite}
                    onEditFields={setFieldEditorStage}
                    getCompleteness={getColaboradorCompleteness}
                    getUnread={(c) => hasUnreadRHComment(c, viewedAt, currentUser?.id)}
                    onAddColaborador={() => setAddColaboradorStage(stage.stageKey)}
                    boardHeight={boardHeight}
                    draggedColumnKey={draggedColumnKey}
                    onColumnHeaderDragStart={setDraggedColumnKey}
                    onColumnHeaderDragEnd={handleStageReorderDragEnd}
                    onColumnHeaderDrop={handleStageReorderDrop}
                    getSortCriteria={getSortCriteria}
                    setSortCriteria={setSortCriteria}
                  />
                ))}
                {canWrite && (
                  <button
                    onClick={() => setAddingStage(true)}
                    title="Nova etapa"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-xs font-semibold shrink-0"
                    style={{ width: 140, height: 64, borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-dim)"; }}
                  >
                    <Plus size={16} />
                    Nova etapa
                  </button>
                )}
              </div>
            </KanbanBoardScrollArea>
          </div>
        </>
      )}

      {!loading && canWrite && (
        <KanbanFab label="Novo colaborador" onClick={() => setAddColaboradorStage(stages[0]?.stageKey || null)} />
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
          onUpdateActivity={handleUpdateActivity}
          onEditFields={setFieldEditorStage}
        />
      )}

      {/* moveError já aparece como banner dentro do drawer — mas mover pelo
          menu do card (drawer fechado) bloqueava em silêncio, indistinguível
          de "desabilitado" (achado #10 do roteiro de treinamento de RH,
          31/07/2026). Mesmo padrão de toast já usado em outros Kanbans
          (AppToast variant="danger", ver RHFeriasView.jsx). */}
      {moveError && !drawerColaborador && (
        <AppToast variant="danger" position="top-right" icon={AlertCircle} onDismiss={() => setMoveError(null)}>
          {moveError}
        </AppToast>
      )}

      {novaTemplateOpen && (
        <NovaTemplateModal onSave={createTemplate} onClose={() => setNovaTemplateOpen(false)} />
      )}
      {bulkTarefaOpen && (
        <BulkTarefaModal
          colaboradores={colaboradores}
          onApply={applyTaskToMany}
          onClose={() => setBulkTarefaOpen(false)}
        />
      )}

      {addColaboradorStage && (
        <NovoColaboradorModal
          currentUser={currentUser}
          stageId={addColaboradorStage}
          users={users}
          contextNote={`Adicionando à etapa · ${findStage(stages, addColaboradorStage)?.name || ""}`}
          onSave={handleCreateColaborador}
          onClose={() => setAddColaboradorStage(null)}
        />
      )}

      {canWrite && (
        <RHStageFieldsPanel
          open={!!fieldEditorStage}
          onClose={() => setFieldEditorStage(null)}
          domain="onboarding"
          stageKey={fieldEditorStage?.stageKey}
          stageName={fieldEditorStage?.name}
          records={colaboradores}
          stageField="onboardingStage"
          protectedStageKeys={onboardingRemovedStageKey ? [onboardingRemovedStageKey] : []}
          protectedLabel="Onboarding"
        />
      )}

      {addingStage && (
        <NewStageModal
          existingKeys={stages.map(s => s.stageKey)}
          nextOrderIdx={stages.length}
          onAdd={addStage}
          onClose={() => setAddingStage(false)}
        />
      )}
    </div>
  );
}

export default RHOnboardingView;
