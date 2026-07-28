import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar, Check, Plus, X, Clock, CalendarCheck, AlertTriangle, AlertCircle, Settings2,
  LayoutGrid, List, CalendarDays as CalendarIcon, ChevronLeft, ChevronRight, TrendingUp,
} from "lucide-react";
import { RH_LEAVE_TYPES } from "../../constants/rh-config";
import { parseDateInput } from "../../utils/date";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useRHFeriasRequests } from "../../hooks/use-rh-ferias-requests";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { RHStageFieldsPanel } from "../shared/stage-editor/RHStageFieldsPanel";
import { StageColorPicker } from "../shared/stage-editor/StageColorPicker";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { RHKanbanCard } from "../rh-pipeline/RHKanbanCard";
import { RHMobileKanbanAccordion } from "../rh-pipeline/RHMobileKanbanAccordion";
import { RHDetailDrawerShell, RHDetailComments } from "../rh-pipeline/RHDetailDrawerShell";
import { StageNavigator } from "../shared/StageNavigator";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { useRecordViews } from "../../hooks/use-record-views";
import { hasUnreadRHComment } from "../../lib/comment-badge";
import { resolveVisibleFields, getMissingRequiredFields, getFieldCompleteness } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { KanbanFab } from "../shared/KanbanFab";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { KanbanBoardHeader } from "../shared/KanbanBoardHeader";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { AppToast } from "../shared/AppToast";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { KanbanAnalyticsPanel } from "../shared/KanbanAnalyticsPanel";

// ── Documento obrigatório por tipo de licença ────────────────────────────────
// Pesquisa de mercado (Convenia/Gusto/Personio) + prática CLT: alguns tipos
// de afastamento exigem comprovante. Como não existe campo de anexo no
// sistema genérico de campos por etapa, a exigência é checada contra
// rh_attachments (domain="ferias") no momento de aprovar — não bloqueia a
// solicitação em si, só a aprovação.
const DOCUMENTO_OBRIGATORIO_POR_TIPO = {
  licenca_medica:      "Atestado médico",
  luto:                "Certidão de óbito ou comprovante de parentesco",
  licenca_maternidade: "Certidão de nascimento ou declaração médica",
  licenca_paternidade: "Certidão de nascimento ou declaração médica",
};

// CLT Art. 135: férias devem ser comunicadas com pelo menos 30 dias de
// antecedência. Aviso não-bloqueante — só sinaliza, não impede o envio nem
// a aprovação, já que exceções acontecem.
const AVISO_MINIMO_DIAS_FERIAS = 30;

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function calcDias(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.max(0, Math.round(diff / 86400000) + 1);
}

function leaveTypeLabel(typeId) {
  return RH_LEAVE_TYPES.find((t) => t.id === typeId)?.label || typeId || "—";
}

function avisoAntecedenciaCurto(req) {
  if (req.type !== "ferias" || !req.created_at || !req.start_date) return false;
  const diasAntecedencia = Math.floor((new Date(req.start_date).getTime() - new Date(req.created_at).getTime()) / 86400000);
  return diasAntecedencia < AVISO_MINIMO_DIAS_FERIAS;
}

function isActiveNow(req) {
  if (req.status !== "aprovado") return false;
  const now = Date.now();
  const start = new Date(req.start_date).getTime();
  const end   = new Date(req.end_date).getTime();
  return now >= start && now <= end;
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function daysInStage(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function findStage(stages, stageKey) {
  return stages.find((s) => s.stageKey === stageKey) || stages[0] || { name: "—", color: "#8A8680", stageKey };
}

// ── Nova etapa (local ao arquivo — mesmo molde de RHOnboardingView.jsx/
// RHFeedbackView.jsx: "Editar etapas" saiu do header, criar etapa agora é
// isso aqui, e renomear/recolorir/excluir uma já existente vive dentro de
// "Editar campos desta etapa") ─────────────────────────────────────────────

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
      onClick={onClose}
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
            <input autoFocus type="text" placeholder="Ex.: Em análise"
              value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "#D1D5DB", color: "var(--text)", background: "var(--surface)" }} />
          </div>
          {error && (
            <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>{error}</div>
          )}
          <button type="submit" disabled={saving || !name.trim()}
            className="w-full font-semibold py-2.5 rounded-xl text-sm"
            style={{ background: "var(--accent)", color: "#FFF", opacity: (saving || !name.trim()) ? 0.5 : 1, border: "none", cursor: (saving || !name.trim()) ? "default" : "pointer" }}>
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
const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}


async function contarAnexos(recordId) {
  if (!isSupabaseConfigured) return 0;
  const { count } = await supabase
    .from("rh_attachments")
    .select("id", { count: "exact", head: true })
    .eq("domain", "ferias")
    .eq("record_id", recordId);
  return count || 0;
}

// ── Email helper ──────────────────────────────────────────────────────────────

// Devolve true/false (em vez de engolir tudo em console.warn) — a decisão
// (changeStatus) já está persistida quando isso roda, então uma falha aqui
// não deve travar o fluxo, só avisar quem aprovou/recusou que o e-mail não
// saiu.
async function sendRhEmail(type, req, colaborador, extraVars = {}) {
  try {
    let toEmail = colaborador?.email || null;
    if (!toEmail && colaborador?.profileId) {
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", colaborador.profileId).single();
      toEmail = profile?.email || null;
    }
    if (!toEmail) return false;
    const { error } = await supabase.functions.invoke("rh-send-email", {
      body: {
        type,
        to: toEmail,
        variables: {
          EMPLOYEE_NAME: colaborador?.fullName || "",
          LEAVE_TYPE:    leaveTypeLabel(req.type),
          START_DATE:    fmt(req.start_date),
          END_DATE:      fmt(req.end_date),
          DAYS_COUNT:    String(calcDias(req.start_date, req.end_date)),
          APP_URL:       window.location.origin,
          ...extraVars,
        },
      },
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("[RHFeriasView] sendRhEmail error:", err);
    return false;
  }
}

// ── Avatar circle ─────────────────────────────────────────────────────────────

function UserAvatar({ user, size = 30 }) {
  const initials =
    (user?.initials) ||
    (user?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--color-industria)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, flexShrink: 0, letterSpacing: "0.02em" }}>
      {initials}
    </div>
  );
}

// ── Solicitar Férias Modal ────────────────────────────────────────────────────

// Motivo da recusa em modal estilizado (idioma do RejectModal de
// MarketingRequestsView, casca ui/Modal) — substitui o window.prompt()
// nativo. Motivo continua obrigatório: o botão só habilita com texto.
function RecusarFeriasModal({ req, colaborador, busy, onConfirm, onClose }) {
  const [motivo, setMotivo] = useState("");
  const motivoLimpo = motivo.trim();
  return (
    <Modal open onClose={onClose} title="Recusar solicitação" width={440}>
      <div style={{ padding: "16px 24px 24px" }}>
        <p style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 12 }}>
          {leaveTypeLabel(req.type)} de <b style={{ color: "var(--text)" }}>{colaborador?.fullName || "colaborador"}</b> · {fmt(req.start_date)} – {fmt(req.end_date)}. O motivo será enviado ao colaborador por e-mail e registrado no histórico do card.
        </p>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Motivo da recusa *
        </label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Informe o motivo da recusa para o colaborador…"
          className="w-full text-sm rounded-lg border px-3 py-2 outline-none resize-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface-alt)", fontSize: 13 }}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(motivoLimpo)}
            disabled={busy || !motivoLimpo}
            style={{ background: "var(--danger)", color: "#FFF", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: busy || !motivoLimpo ? "default" : "pointer", opacity: busy || !motivoLimpo ? 0.6 : 1 }}
          >
            {busy ? "Recusando…" : "Confirmar recusa"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SolicitarFeriasModal({ currentUser, onSave, onClose }) {
  const [type, setType]           = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [notes, setNotes]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const dias = calcDias(startDate, endDate);
  const docExigido = DOCUMENTO_OBRIGATORIO_POR_TIPO[type];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!type)        { setError("Selecione o tipo de licença."); return; }
    if (!startDate)   { setError("Informe a data de início."); return; }
    if (!endDate)     { setError("Informe a data de término."); return; }
    if (new Date(endDate) < new Date(startDate)) { setError("A data de término deve ser após o início."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        user_id:    currentUser.id,
        type,
        start_date: startDate,
        end_date:   endDate,
        notes:      notes.trim() || null,
        status:     "pendente",
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao enviar solicitação.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };
  const focusBlue = (e) => { e.target.style.borderColor = "var(--accent)"; };
  const blurGray  = (e) => { e.target.style.borderColor = "var(--border-strong)"; };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>Solicitar Afastamento</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{currentUser?.name || currentUser?.email}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelSt}>Tipo *</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt} autoFocus>
                <option value="">Selecionar tipo</option>
                {RH_LEAVE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {docExigido && (
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--warning)", display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={11} /> Vai precisar anexar: {docExigido} (depois do envio).
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelSt}>Início *</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
              <div>
                <label style={labelSt}>Término *</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
              </div>
            </div>

            {type === "ferias" && startDate && (() => {
              const diasAntecedencia = Math.floor((new Date(startDate).getTime() - Date.now()) / 86400000);
              return diasAntecedencia < AVISO_MINIMO_DIAS_FERIAS ? (
                <div style={{ background: "var(--warning-bg)", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 14px", fontSize: 11, color: "var(--warning)", display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={12} /> Menos de {AVISO_MINIMO_DIAS_FERIAS} dias de antecedência (CLT recomenda aviso prévio de 30 dias).
                </div>
              ) : null;
            })()}

            {dias > 0 && (
              <div style={{ background: "var(--surface-alt)", border: "1px solid #BFDBFE", borderRadius: 10, padding: "8px 14px", fontSize: 12, color: "var(--accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={13} /> {dias} dia{dias !== 1 ? "s" : ""} de afastamento
              </div>
            )}

            <div>
              <label style={labelSt}>Observações</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais, motivo, CID (se licença médica)…" rows={3} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
            </div>
          </div>

          {error && <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Enviando…" : "Enviar solicitação"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Card do Kanban ────────────────────────────────────────────────────────────

function FeriasCardBody({ req, colaborador, canWrite, onAprovar, onRecusar, busy }) {
  const dias = calcDias(req.start_date, req.end_date);
  const docExigido = DOCUMENTO_OBRIGATORIO_POR_TIPO[req.type];
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <UserAvatar user={{ name: colaborador?.fullName }} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {colaborador?.fullName || "Desconhecido"}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{leaveTypeLabel(req.type)} · {dias}d</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{fmt(req.start_date)} – {fmt(req.end_date)}</div>
      {avisoAntecedenciaCurto(req) && (
        <div style={{ marginTop: 4, fontSize: 10, color: "var(--warning)", display: "flex", alignItems: "center", gap: 3 }}>
          <AlertTriangle size={10} /> Aviso curto (&lt;30d)
        </div>
      )}
      {docExigido && (
        <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 3 }}>
          Exige anexo: {docExigido}
        </div>
      )}
      {canWrite && req.status === "pendente" && (
        <div style={{ display: "flex", gap: 10, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onAprovar(req)} disabled={busy} style={{ flex: 1, background: "#DCFCE7", color: "var(--success)", border: "1px solid #BBF7D0", borderRadius: 7, padding: "9px 4px", fontSize: 11, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            <Check size={11} style={{ verticalAlign: -1 }} /> Aprovar
          </button>
          <button onClick={() => onRecusar(req)} disabled={busy} style={{ flex: 1, background: "#FEE2E2", color: "var(--danger)", border: "1px solid #FECACA", borderRadius: 7, padding: "9px 4px", fontSize: 11, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            <X size={11} style={{ verticalAlign: -1 }} /> Recusar
          </button>
        </div>
      )}
    </>
  );
}

function FeriasKanbanColumn({
  stage, stages, reqList, colaboradoresById, onCardClick, onDragStart, onDragEnd, onMoveToStage, onDeleteRequest, onDuplicateRequest,
  isDragOver, onColumnDragOver, onColumnDragLeave, onColumnDrop,
  canWrite, onEditFields, getCompleteness, getUnread, onAprovar, onRecusar, busyId,
  draggedColumnKey, onColumnHeaderDragStart, onColumnHeaderDragEnd, onColumnHeaderDrop,
}) {
  return (
    <div
      onDragOver={(e) => onColumnDragOver(e, stage.stageKey)}
      onDragLeave={onColumnDragLeave}
      onDrop={() => onColumnDrop(stage.stageKey)}
      className="flex flex-col rounded-lg transition-all duration-150"
      style={{ width: 272, minWidth: 272, height: "100%", overflow: "hidden", border: "1px solid var(--border)", background: isDragOver ? stage.color + "14" : "var(--surface-alt)", boxShadow: isDragOver ? `0 0 0 2px ${stage.color}40` : "none" }}
    >
      {/* Arrastável pra reordenar etapas — canal de drag separado do drop de
          card acima (onColumnDrop/onColumnDragOver/onColumnDragLeave, props
          já existentes desta coluna, servem exclusivamente o card).
          draggedColumnKey/onColumnHeaderDragStart/onColumnHeaderDragEnd/
          onColumnHeaderDrop vêm de RHFeriasView, que usa
          handleStageReorderDrop/handleStageReorderDragEnd — nomes diferentes
          de handleColumnDrop/onColumnDragOver/onColumnDragLeave porque essas
          já existem no arquivo e servem o drop de card (mesmo achado de
          colisão de nomes já resolvido em RHOnboardingView/RHFeedbackView).
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
          count={reqList.length}
          bandHeight={4}
          letterSpacing="normal"
          nameColor={stage.color}
          nameFontSize={14}
          nameFontWeight={700}
          uppercase={false}
          countFontSize={12}
          actions={canWrite && (
            <button onClick={() => onEditFields(stage)} title="Editar campos desta etapa" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "flex", flexShrink: 0 }}>
              <Settings2 size={13} />
            </button>
          )}
        />
      </div>
      <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {reqList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-dim)", fontSize: 11, opacity: 0.5 }}>Nada aqui</div>
        ) : (
          reqList.map((req) => (
            <RHKanbanCard
              key={req.id}
              id={req.id}
              stage={req.status}
              stages={stages}
              onClick={() => onCardClick(req)}
              onDragStart={canWrite ? onDragStart : undefined}
              onDragEnd={canWrite ? onDragEnd : undefined}
              onMoveToStage={canWrite ? onMoveToStage : undefined}
              onDeleteCard={canWrite ? onDeleteRequest : undefined}
              onDuplicateCard={canWrite ? onDuplicateRequest : undefined}
              showMoveOptions={false}
              agingDays={daysInStage(req.status_changed_at)}
              completeness={getCompleteness?.(req)}
              unread={getUnread?.(req)}
            >
              <FeriasCardBody req={req} colaborador={colaboradoresById.get(req.user_id)} canWrite={canWrite} onAprovar={onAprovar} onRecusar={onRecusar} busy={busyId === req.id} />
            </RHKanbanCard>
          ))
        )}
      </div>
    </div>
  );
}

// ── Drawer de detalhe ──────────────────────────────────────────────────────────

function FeriasDrawer({
  req, colaborador, canWrite, stages, users, currentUser,
  onAprovar, onRecusar, onMoveToStage, onUpdateCustomFields, onAddActivity, onUpdateActivity, onClose, onMoved, busy, notifyMentions, onDelete, onEditFields,
}) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const stageFieldsHook = useRHStageFields("ferias");
  const customDefs = stageFieldsHook.getFields(req.status);
  const [customDraft, setCustomDraft] = useState({});
  const [moveError, setMoveError] = useState(null);

  useEffect(() => { setCustomDraft({}); setMoveError(null); }, [req.id]);

  const handleCustomChange = (fieldKey, value) => {
    setCustomDraft((prev) => ({ ...prev, [fieldKey]: value }));
    const merged = { ...(req.custom_fields || {}), [fieldKey]: value };
    onUpdateCustomFields(merged);
  };

  const getCustomValue = (fieldKey) =>
    fieldKey in customDraft ? customDraft[fieldKey] : (req.custom_fields?.[fieldKey] ?? "");

  const customValuesByKey = { ...(req.custom_fields || {}), ...customDraft };
  const visibleCustomDefs = resolveVisibleFields(customDefs, customValuesByKey);

  const st = findStage(stages, req.status);
  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const dias = calcDias(req.start_date, req.end_date);
  const docExigido = DOCUMENTO_OBRIGATORIO_POR_TIPO[req.type];
  const moveTargets = stages.filter((s) => s.stageKey !== req.status);

  // Ambas as entradas (atalhos Aprovar/Recusar e o mover genérico) passam
  // pelo mesmo gate de campo obrigatório da etapa atual (onBlocked seta o
  // banner inline em vez de deixar a chamada cair no alert() padrão) — e só
  // fecham+reabrem o drawer (reopenAfterMove) se a transição realmente
  // aconteceu.
  const handleAprovarClick = async () => {
    const ok = await onAprovar(req, { onBlocked: setMoveError });
    if (ok) { setMoveError(null); onMoved(req.id); }
  };
  const handleRecusarClick = async () => {
    const ok = await onRecusar(req, { onBlocked: setMoveError });
    if (ok) { setMoveError(null); onMoved(req.id); }
  };
  const handleMoveClick = async (stageKey) => {
    const ok = await onMoveToStage(req, stageKey, { onBlocked: setMoveError });
    if (ok) { setMoveError(null); onMoved(req.id); }
  };

  const header = (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
      <UserAvatar user={{ name: colaborador?.fullName }} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{colaborador?.fullName || "Desconhecido"}</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{leaveTypeLabel(req.type)} · {fmt(req.start_date)} – {fmt(req.end_date)} · {dias}d</div>
        <div style={{ marginTop: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${st.color}18`, color: st.color, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, display: "inline-block" }} /> {st.name}
          </span>
        </div>
      </div>
    </div>
  );

  const left = (
    <>
      {req.notes && (
        <div>
          <div style={labelSt}>Observações do colaborador</div>
          <div style={{ fontSize: 13, color: "var(--text)" }}>{req.notes}</div>
        </div>
      )}

      {avisoAntecedenciaCurto(req) && (
        <div style={{ background: "var(--warning-bg)", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 12px", fontSize: 11, color: "var(--warning)", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={12} /> Solicitado com menos de {AVISO_MINIMO_DIAS_FERIAS} dias de antecedência (CLT Art. 135).
        </div>
      )}

      {docExigido && (
        <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 11, color: "var(--text-dim)" }}>
          Documento exigido pra aprovar: <b style={{ color: "var(--text)" }}>{docExigido}</b> (anexar na aba Anexos).
        </div>
      )}
    </>
  );

  const formContent = visibleCustomDefs.length > 0 ? (
    <div>
      <div style={labelSt}>Campos desta etapa</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visibleCustomDefs.map((f) => (
          <div key={f.id}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
              {f.effectiveRequired && <span style={{ color: "var(--accent)", marginRight: 4 }}>*</span>}
              {f.label}
            </label>
            {f.helpText && <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{f.helpText}</div>}
            <RHStageFieldInput field={f} value={getCustomValue(f.fieldKey)} onChange={(val) => handleCustomChange(f.fieldKey, val)} users={users} />
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const center = (
    <RHDetailDrawerShell
      domain="ferias"
      recordId={req.id}
      activities={req.activities || []}
      onAddActivity={onAddActivity}
      currentUser={currentUser}
      users={users}
      stages={stages}
      formContent={formContent}
    />
  );

  const right = (
    <>
      {canWrite && moveError && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#FEF2F2", color: "var(--danger)", borderRadius: 10, padding: "8px 12px", fontSize: 12 }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          {moveError}
        </div>
      )}

      {canWrite && req.status === "pendente" && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleAprovarClick} disabled={busy} style={{ flex: 1, background: "var(--success)", color: "#FFF", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            Aprovar
          </button>
          <button onClick={handleRecusarClick} disabled={busy} style={{ flex: 1, background: "var(--danger)", color: "#FFF", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            Recusar
          </button>
        </div>
      )}

      {canWrite && moveTargets.length > 0 && (
        <div>
          <div style={labelSt}>Mover para</div>
          <StageNavigator
            targets={moveTargets}
            onMove={handleMoveClick}
            getKey={(s) => s.stageKey}
            disabled={busy}
          />
        </div>
      )}

      <RHDetailComments
        activities={req.activities || []}
        onAddActivity={onAddActivity}
        onUpdateActivity={onUpdateActivity ? (activityId, patch) => onUpdateActivity(req.id, activityId, patch) : undefined}
        currentUser={currentUser}
        users={users}
        notifyMentions={notifyMentions}
        mentionLink={{ module: "rh_ferias", id: req.id }}
        mentionContextLabel={colaborador?.fullName}
      />

      {canWrite && onEditFields && (
        <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onEditFields(st); }}
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--text-dim)", textDecoration: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            <Settings2 size={12} />
            Editar campos desta etapa
          </a>
        </div>
      )}
    </>
  );

  return (
    <SplitPanelDrawer
      onClose={onClose}
      header={header}
      left={left}
      center={center}
      right={right}
      onDelete={canWrite && onDelete ? () => onDelete(req.id) : undefined}
      deleteLabel="Excluir solicitação"
    />
  );
}

// ── Tabela ────────────────────────────────────────────────────────────────────
// Início/fim + dias (calcDias já existente acima) — os campos mais claros
// deste domínio.

function FeriasTableView({ requests, stages, colaboradoresById, onRowClick }) {
  return (
    <div className="rounded-2xl border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {["Colaborador", "Tipo", "Início", "Fim", "Dias", "Etapa"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 && (
            <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>Nenhuma solicitação encontrada.</td></tr>
          )}
          {requests.map((req) => {
            const st = findStage(stages, req.status);
            const dias = calcDias(req.start_date, req.end_date);
            const colaborador = colaboradoresById.get(req.user_id);
            return (
              <tr key={req.id} onClick={() => onRowClick(req)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <UserAvatar user={{ name: colaborador?.fullName }} size={26} />
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{colaborador?.fullName || "Desconhecido"}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{leaveTypeLabel(req.type)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{fmt(req.start_date)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{fmt(req.end_date)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{dias}d</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: st.color + "18", color: st.color, border: `1px solid ${st.color}40` }}>
                    {st.name}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Calendário ───────────────────────────────────────────────────────────────
// Agrupa por start_date — data de início do afastamento.

function FeriasCalendarView({ requests, stages, colaboradoresById, onPillClick }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map();
    for (const req of requests) {
      if (!req.start_date) continue;
      // start_date é coluna `date` — parseDateInput constrói meia-noite LOCAL
      // (não UTC), pra a pill cair na célula certa do calendário. Antes new Date()
      // jogava pro dia anterior em fuso negativo. Achado da 2ª auditoria.
      const d = parseDateInput(req.start_date);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(req);
    }
    return map;
  }, [requests]);

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
                {items.slice(0, 3).map((req) => {
                  const st = findStage(stages, req.status);
                  const colaborador = colaboradoresById.get(req.user_id);
                  return (
                    <span key={req.id} onClick={() => onPillClick(req)}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer"
                      style={{ background: st.color + "18", color: st.color }}
                      title={`${colaborador?.fullName || "Desconhecido"} · ${leaveTypeLabel(req.type)}`}>
                      {colaborador?.fullName || leaveTypeLabel(req.type)}
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

// ── Main View ─────────────────────────────────────────────────────────────────

export function RHFeriasView({ currentUser, users = [], canWrite, notifyMentions, initialSelectedFeriasId, onInitialFeriasConsumed }) {
  const { requests, loading: loadingRequests, createRequest, changeStatus, updateCustomFields, duplicateRequest, deleteRequest, addActivity, updateActivity } = useRHFeriasRequests({});
  const { colaboradores, loading: loadingColaboradores } = useRHColaboradores({ userId: currentUser?.id });
  const { stages, loading: loadingStages, addStage, reorderStages } = useRHPipelineStages("ferias");
  const feriasStageFields = useRHStageFields("ferias");

  const [viewMode, setViewMode]           = useState("kanban"); // "kanban" | "table" | "calendar" | "analytics"
  const [filterStatus, setFilterStatus]   = useState("todas");
  const [onlyMine, setOnlyMine]           = useState(false);
  const [showSolicitar, setShowSolicitar] = useState(false);
  const [busyId, setBusyId]               = useState(null);
  const [boardError, setBoardError]       = useState(null);
  const [recusaModal, setRecusaModal]     = useState(null); // { req, resolve }
  const [drawerReqId, setDrawerReqId]     = useState(null);
  const [fieldEditorStage, setFieldEditorStage] = useState(null);
  const [addingStage, setAddingStage]     = useState(false);
  const [draggedColumnKey, setDraggedColumnKey] = useState(null);
  const [draggedId, setDraggedId]         = useState(null);
  const [dragOverStageKey, setDragOverStageKey] = useState(null);
  // deps precisa incluir os `loading` — o board (e o ref medido) só monta
  // depois que requests/stages carregam (ver "{loading ? ... : ...}" abaixo).
  // Sem isso, o efeito do hook roda uma única vez com boardRef.current ainda
  // nulo (retorna cedo, sem nunca anexar o ResizeObserver/resize) e
  // boardHeight fica travado no fallback (480px) pro resto da sessão, bem
  // abaixo do espaço real disponível — só um toggle manual de viewMode
  // forçava o recálculo. Mesmo padrão de correção já usado em
  // RHFeedbackView.jsx/RHRecrutamentoView.jsx.
  const [boardRef, boardHeight] = useAvailableHeight(16, [viewMode, loadingRequests, loadingColaboradores, loadingStages]);

  const { viewedAt, markViewed } = useRecordViews("rh_ferias", currentUser?.id);
  useEffect(() => { if (drawerReqId) markViewed(drawerReqId); }, [drawerReqId]);

  // Vem do painel de Conexões do Colaborador (Cmd-K/App.jsx). Se o registro
  // não estiver na lista carregada (filtro ativo esconde), simplesmente não
  // abre — sem tratamento especial.
  useEffect(() => {
    if (!initialSelectedFeriasId) return;
    setDrawerReqId(initialSelectedFeriasId);
    onInitialFeriasConsumed?.();
  }, [initialSelectedFeriasId, onInitialFeriasConsumed]);

  const loading = loadingRequests || loadingColaboradores || loadingStages;

  const colaboradoresById = useMemo(() => new Map(colaboradores.map(c => [c.id, c])), [colaboradores]);

  // Enforcement real: bloqueia sair da etapa atual com campo obrigatório
  // (estático ou condicional) vazio/inválido antes de qualquer transição —
  // mesmo padrão de Onboarding/Feedback/Treinamentos. `onBlocked`, quando
  // informado (drawer aberto), recebe a mensagem pra virar banner inline em
  // vez de alert() nativo (achado da auditoria de 14/07: alert() trava
  // sessões automatizadas/headless sem handler de diálogo); sem `onBlocked`
  // (atalho no card do Kanban ou drag-and-drop, sem um slot de banner
  // visível), cai de volta pro alert(), igual RHFeedbackView/RHTreinamentosView.
  const getStageBlockMessage = useCallback((req) => {
    const fields = feriasStageFields.getFields(req.status);
    const missing = getMissingRequiredFields(fields, req.custom_fields || {});
    if (missing.length > 0) {
      return `Não dá pra mover: preencha antes — ${missing.map(f => f.label).join(", ")}.`;
    }
    const invalid = getInvalidFields(fields, req.custom_fields || {});
    if (invalid.length > 0) {
      return `Não dá pra mover: corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`;
    }
    return null;
  }, [feriasStageFields]);

  const handleAprovar = useCallback(async (req, { onBlocked } = {}) => {
    const blockMsg = getStageBlockMessage(req);
    if (blockMsg) { (onBlocked || alert)(blockMsg); return false; }
    const docExigido = DOCUMENTO_OBRIGATORIO_POR_TIPO[req.type];
    const colaborador = colaboradoresById.get(req.user_id);
    setBusyId(req.id);
    try {
      if (docExigido) {
        const totalAnexos = await contarAnexos(req.id);
        if (totalAnexos === 0) {
          (onBlocked || alert)(`Não dá pra aprovar "${colaborador?.fullName || "essa solicitação"}": anexe o(a) ${docExigido} antes (abra o card → aba Anexos).`);
          return false;
        }
      }
      await changeStatus(req.id, "aprovado", { approved_by: currentUser?.id, approved_at: new Date().toISOString() });
      const sent = await sendRhEmail("ferias_aprovadas", req, colaborador, { APPROVED_BY: currentUser?.name || currentUser?.email || "" });
      if (!sent) alert(`Aprovação registrada, mas o e-mail de notificação não pôde ser enviado a ${colaborador?.fullName || "o colaborador"}.`);
      return true;
    } finally {
      setBusyId(null);
    }
  }, [changeStatus, currentUser, getStageBlockMessage, colaboradoresById]);

  // Captura o MOTIVO da recusa antes de confirmar — antes recusava no
  // primeiro clique e o e-mail mandava req.notes (as observações do PRÓPRIO
  // colaborador) como se fosse o motivo do gestor. Achado da 2ª auditoria.
  // O window.prompt() nativo virou modal estilizado (mesma classe de
  // problema do alert(): trava sessões headless e foge do idioma visual) —
  // a promise só resolve quando o modal confirma/cancela, preservando o
  // contrato `await onRecusar → true/false` dos chamadores.
  const handleRecusar = useCallback(async (req, { onBlocked } = {}) => {
    const blockMsg = getStageBlockMessage(req);
    if (blockMsg) { (onBlocked || setBoardError)(blockMsg); return false; }
    return new Promise((resolve) => setRecusaModal({ req, resolve }));
  }, [getStageBlockMessage]);

  const confirmarRecusa = useCallback(async (motivo) => {
    if (!recusaModal) return;
    const { req, resolve } = recusaModal;
    const colaborador = colaboradoresById.get(req.user_id);
    setBusyId(req.id);
    try {
      await changeStatus(req.id, "recusado");
      // Grava no histórico do card pra ficar durável (não só no e-mail).
      await addActivity(req.id, {
        type: "recusa",
        text: `Recusado: ${motivo}`,
        by: currentUser?.name || currentUser?.email || "",
        at: new Date().toISOString(),
      }).catch(() => {});
      const sent = await sendRhEmail("ferias_rejeitadas", req, colaborador, { REASON: motivo, MANAGER_NAME: currentUser?.name || currentUser?.email || "" });
      if (!sent) setBoardError(`Recusa registrada, mas o e-mail de notificação não pôde ser enviado a ${colaborador?.fullName || "o colaborador"}.`);
      resolve(true);
    } catch (e) {
      setBoardError(`Erro ao recusar: ${e?.message || "tente novamente."}`);
      resolve(false);
    } finally {
      setBusyId(null);
      setRecusaModal(null);
    }
  }, [recusaModal, changeStatus, addActivity, currentUser, colaboradoresById]);

  // Mover genérico pra qualquer etapa do pipeline dinâmico de férias (além
  // dos atalhos Aprovar/Recusar) — cobre pipelines com mais de
  // pendente/aprovado/recusado (ex.: uma etapa "em análise" intermediária).
  const handleMoveToStageGeneric = useCallback(async (req, stageKey, { onBlocked } = {}) => {
    const blockMsg = getStageBlockMessage(req);
    if (blockMsg) { (onBlocked || alert)(blockMsg); return false; }
    setBusyId(req.id);
    try {
      await changeStatus(req.id, stageKey);
      return true;
    } finally {
      setBusyId(null);
    }
  }, [changeStatus, getStageBlockMessage]);

  const handleDuplicateRequest = useCallback(async (id) => {
    const source = requests.find((r) => r.id === id);
    if (!source) return;
    const firstStage = stages.find((s) => !s.terminal) || stages[0];
    await duplicateRequest(source, firstStage?.stageKey);
  }, [requests, stages, duplicateRequest]);

  const handleColumnDrop = useCallback((stageKey) => {
    if (draggedId) {
      const req = requests.find(r => r.id === draggedId);
      if (req && req.status !== stageKey) {
        if (stageKey === "aprovado") handleAprovar(req);
        else if (stageKey === "recusado") handleRecusar(req);
        else handleMoveToStageGeneric(req, stageKey);
      }
    }
    setDraggedId(null);
    setDragOverStageKey(null);
  }, [draggedId, requests, handleAprovar, handleRecusar, handleMoveToStageGeneric]);

  // Canal de drag separado do drop de card acima (draggedColumnKey vs
  // draggedId) — reordena etapas arrastando o cabeçalho da coluna. Nomeado
  // handleStageReorder* (não handleColumnDragEnd/handleColumnDrop, o molde
  // do rollout) porque handleColumnDrop/onColumnDragOver/onColumnDragLeave
  // já existem acima e servem exclusivamente o drop de card (colisão de
  // nomes já resolvida do mesmo jeito em RHOnboardingView/RHFeedbackView).
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

  const handleMoveToStage = useCallback((id, stageKey) => {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    if (stageKey === "aprovado") handleAprovar(req);
    else if (stageKey === "recusado") handleRecusar(req);
    else handleMoveToStageGeneric(req, stageKey);
  }, [requests, handleAprovar, handleRecusar, handleMoveToStageGeneric]);

  const getReqCompleteness = (req) => getFieldCompleteness(feriasStageFields.getFields(req.status), req.custom_fields || {});

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pendentes  = requests.filter((r) => r.status === "pendente").length;
    const aprovadosMes = requests.filter((r) => r.status === "aprovado" && isThisMonth(r.approved_at || r.start_date)).length;
    const diasAtivos = requests.filter((r) => isActiveNow(r)).reduce((sum, r) => sum + calcDias(r.start_date, r.end_date), 0);
    return { pendentes, aprovadosMes, diasAtivos };
  }, [requests]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (filterStatus !== "todas" && r.status !== filterStatus) return false;
      if (onlyMine && r.user_id !== currentUser?.id) return false;
      return true;
    });
  }, [requests, filterStatus, onlyMine, currentUser]);

  const reqByStage = useMemo(() => {
    const map = {};
    const defaultStageKey = stages[0]?.stageKey || "pendente";
    stages.forEach((s) => { map[s.stageKey] = filtered.filter((r) => (r.status || defaultStageKey) === s.stageKey); });
    return map;
  }, [filtered, stages]);

  const PILL_TABS = [
    { id: "todas",    label: "Todas" },
    { id: "pendente", label: "Pendentes" },
    { id: "aprovado", label: "Aprovadas" },
    { id: "recusado", label: "Recusadas" },
  ];

  const drawerReq = drawerReqId ? requests.find(r => r.id === drawerReqId) : null;

  const analyticsStages = useMemo(
    () => stages.filter((s) => !s.terminal).map((s) => ({ key: s.stageKey, name: s.name, color: s.color, slaDays: s.slaDays })),
    [stages]
  );

  const feriasSpecificStats = useMemo(() => {
    const byType = {};
    for (const r of filtered) {
      const label = leaveTypeLabel(r.type);
      byType[label] = (byType[label] || 0) + 1;
    }
    const totalDias = filtered.reduce((sum, r) => sum + calcDias(r.start_date, r.end_date), 0);
    const stats = Object.entries(byType).map(([label, count]) => ({ label, value: String(count) }));
    stats.push({ label: "Total de dias afastados", value: `${totalDias}d` });
    return stats;
  }, [filtered]);

  return (
    <div>
      {boardError && (
        <AppToast variant="danger" position="top-right" icon={AlertCircle} onDismiss={() => setBoardError(null)}>
          {boardError}
        </AppToast>
      )}
      <KanbanBoardHeader className="mb-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarCheck size={22} style={{ color: "var(--text)" }} />
              <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Férias & Licenças</h1>
            </div>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Gestão de solicitações de afastamento</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
              <ViewToggleButton active={viewMode === "kanban"}   onClick={() => setViewMode("kanban")}   icon={LayoutGrid}   label="Kanban" />
              <ViewToggleButton active={viewMode === "table"}    onClick={() => setViewMode("table")}    icon={List}         label="Tabela" />
              <ViewToggleButton active={viewMode === "calendar"} onClick={() => setViewMode("calendar")} icon={CalendarIcon} label="Calendário" />
              <ViewToggleButton active={viewMode === "analytics"} onClick={() => setViewMode("analytics")} icon={TrendingUp} label="Análise" />
            </div>
            <Button size="sm" icon={Plus} onClick={() => setShowSolicitar(true)}>Solicitar</Button>
          </div>
        </div>
      </KanbanBoardHeader>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {[
          { label: "Pendentes",            value: stats.pendentes,   icon: <Clock size={14} style={{ color: "var(--amber)" }} /> },
          { label: "Aprovadas este mês",   value: stats.aprovadosMes, icon: <Check size={14} style={{ color: "var(--success)" }} /> },
          { label: "Dias em férias agora", value: stats.diasAtivos,  icon: <Calendar size={14} style={{ color: "var(--text)" }} /> },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border transition-shadow duration-150"
            style={{ background: "var(--surface)", borderColor: "var(--border)", padding: "12px 16px", boxShadow: "var(--shadow-card)" }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-pop)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-card)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              {s.icon}
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 3 }}>
          {PILL_TABS.map((tab) => (
            <button key={tab.id} onClick={() => setFilterStatus(tab.id)} style={{ background: filterStatus === tab.id ? "var(--surface)" : "transparent", color: filterStatus === tab.id ? "var(--text)" : "var(--text-dim)", border: "none", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: filterStatus === tab.id ? 700 : 500, cursor: "pointer", boxShadow: filterStatus === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
              {tab.label}
            </button>
          ))}
        </div>
        {canWrite && (
          <button onClick={() => setOnlyMine((v) => !v)} style={{ background: onlyMine ? "var(--color-industria)" : "var(--surface)", color: onlyMine ? "#FFF" : "var(--text-dim)", border: `1px solid ${onlyMine ? "var(--color-industria)" : "var(--border)"}`, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {onlyMine ? "Minhas solicitações" : "Todos os funcionários"}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : !isSupabaseConfigured ? (
        <EmptyState icon={Calendar} title="Supabase não configurado" description="Configure as variáveis de ambiente para usar este módulo." />
      ) : viewMode === "table" ? (
        <FeriasTableView requests={filtered} stages={stages} colaboradoresById={colaboradoresById} onRowClick={(r) => setDrawerReqId(r.id)} />
      ) : viewMode === "calendar" ? (
        <FeriasCalendarView requests={filtered} stages={stages} colaboradoresById={colaboradoresById} onPillClick={(r) => setDrawerReqId(r.id)} />
      ) : viewMode === "analytics" ? (
        <KanbanAnalyticsPanel
          stages={analyticsStages}
          records={filtered}
          getStageKey={(r) => r.status}
          getStageEnteredAt={(r) => r.status_changed_at}
          specificStats={feriasSpecificStats}
        />
      ) : (
        <>
          <RHMobileKanbanAccordion
            stages={stages}
            itemsByStage={reqByStage}
            renderCard={(req) => (
              <RHKanbanCard
                key={req.id}
                id={req.id}
                stage={req.status}
                stages={stages}
                onClick={() => setDrawerReqId(req.id)}
                onDragStart={canWrite ? setDraggedId : undefined}
                onDragEnd={canWrite ? () => { setDraggedId(null); setDragOverStageKey(null); } : undefined}
                onMoveToStage={canWrite ? handleMoveToStage : undefined}
                onDeleteCard={canWrite ? deleteRequest : undefined}
                onDuplicateCard={canWrite ? handleDuplicateRequest : undefined}
                agingDays={daysInStage(req.status_changed_at)}
                completeness={getReqCompleteness?.(req)}
                unread={hasUnreadRHComment(req, viewedAt, currentUser?.id)}
              >
                <FeriasCardBody req={req} colaborador={colaboradoresById.get(req.user_id)} canWrite={canWrite} onAprovar={handleAprovar} onRecusar={handleRecusar} busy={busyId === req.id} />
              </RHKanbanCard>
            )}
            emptyLabel="Nada aqui"
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
              <div className="flex gap-2 h-full" style={{ minWidth: `${stages.length * 280}px` }}>
                {stages.map((stage) => (
                  <FeriasKanbanColumn
                    key={stage.id}
                    stage={stage}
                    stages={stages}
                    reqList={reqByStage[stage.stageKey] || []}
                    colaboradoresById={colaboradoresById}
                    onCardClick={(r) => setDrawerReqId(r.id)}
                    onDragStart={setDraggedId}
                    onDragEnd={() => { setDraggedId(null); setDragOverStageKey(null); }}
                    onMoveToStage={handleMoveToStage}
                    onDeleteRequest={canWrite ? deleteRequest : undefined}
                    onDuplicateRequest={canWrite ? handleDuplicateRequest : undefined}
                    isDragOver={dragOverStageKey === stage.stageKey}
                    onColumnDragOver={(e, key) => { e.preventDefault(); setDragOverStageKey(key); }}
                    onColumnDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStageKey(null); }}
                    onColumnDrop={handleColumnDrop}
                    canWrite={canWrite}
                    onEditFields={setFieldEditorStage}
                    getCompleteness={getReqCompleteness}
                    getUnread={(r) => hasUnreadRHComment(r, viewedAt, currentUser?.id)}
                    onAprovar={handleAprovar}
                    onRecusar={handleRecusar}
                    busyId={busyId}
                    draggedColumnKey={draggedColumnKey}
                    onColumnHeaderDragStart={setDraggedColumnKey}
                    onColumnHeaderDragEnd={handleStageReorderDragEnd}
                    onColumnHeaderDrop={handleStageReorderDrop}
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
          <KanbanFab label="Solicitar" onClick={() => setShowSolicitar(true)} />
        </>
      )}

      {showSolicitar && <SolicitarFeriasModal currentUser={currentUser} onSave={createRequest} onClose={() => setShowSolicitar(false)} />}

      {recusaModal && (
        <RecusarFeriasModal
          req={recusaModal.req}
          colaborador={colaboradoresById.get(recusaModal.req.user_id)}
          busy={busyId === recusaModal.req.id}
          onConfirm={confirmarRecusa}
          onClose={() => { recusaModal.resolve(false); setRecusaModal(null); }}
        />
      )}

      {drawerReq && (
        <FeriasDrawer
          req={drawerReq}
          colaborador={colaboradoresById.get(drawerReq.user_id)}
          canWrite={canWrite}
          stages={stages}
          users={users}
          currentUser={currentUser}
          onAprovar={handleAprovar}
          onRecusar={handleRecusar}
          onMoveToStage={handleMoveToStageGeneric}
          onUpdateCustomFields={(merged) => updateCustomFields(drawerReq.id, merged)}
          onAddActivity={(entry) => addActivity(drawerReq.id, entry)}
          onUpdateActivity={(activityId, patch) => updateActivity(drawerReq.id, activityId, patch)}
          onClose={() => setDrawerReqId(null)}
          onMoved={(id) => { setDrawerReqId(null); reopenAfterMove(setDrawerReqId, id); }}
          busy={busyId === drawerReq.id}
          notifyMentions={notifyMentions}
          onDelete={deleteRequest}
          onEditFields={setFieldEditorStage}
        />
      )}

      {canWrite && (
        <RHStageFieldsPanel
          open={!!fieldEditorStage}
          onClose={() => setFieldEditorStage(null)}
          domain="ferias"
          stageKey={fieldEditorStage?.stageKey}
          stageName={fieldEditorStage?.name}
          records={requests}
          stageField="status"
          protectedStageKeys={["aprovado", "recusado"]}
          protectedLabel="Férias"
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

export default RHFeriasView;
