import React, { useMemo, useState } from "react";
import { Bot, ExternalLink, Check, X as XIcon } from "lucide-react";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { StageNavigator } from "../shared/StageNavigator";
import { CommentsPanel } from "../shared/CommentsPanel";
import { bugPriorityMeta } from "../../constants/bug-reports";
import { relativeTime, formatDateBR } from "../../utils/date";

function stageKeyOf(s) { return s?.stageKey ?? s?.id; }

// Caixa de diagnóstico da análise automática diária — só existe quando a
// rotina já rodou (diagnosis preenchido). Aprovar grava a decisão e abre o
// PR pra você mesclar no próprio GitHub (o merge em si não roda de dentro
// do card — precisaria de um token do GitHub exposto no navegador, o que a
// plataforma não faz por segurança; ver nota no card de "rotina diária").
function DiagnosisBox({ report, isAdmin, onApprove, onReject }) {
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!report.diagnosis) return null;

  const handleApprove = async () => {
    setBusy(true);
    try {
      await onApprove();
      if (report.pr_url) window.open(report.pr_url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await onReject(rejectReason.trim());
      setShowReject(false);
      setRejectReason("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl p-4 mt-2"
      style={{ background: "var(--accent-tint)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" }}
    >
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--accent)" }}>
        <Bot size={13} />
        Diagnóstico automático{report.diagnosed_at ? ` · ${formatDateBR(report.diagnosed_at)}` : ""}
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{report.diagnosis}</p>
      {report.needs_security_review && (
        <div className="mt-2 text-[11px] font-semibold rounded-md px-2.5 py-1.5 inline-block" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          Precisa de revisão de Segurança antes de aprovar
        </div>
      )}
      {report.pr_url && (
        <a
          href={report.pr_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2.5 text-[11.5px] font-semibold"
          style={{ color: "var(--accent)" }}
        >
          <ExternalLink size={11} /> Ver PR
        </a>
      )}
      {isAdmin && report.stage === "correcao_proposta" && (
        <>
          {!showReject ? (
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleApprove}
                disabled={busy}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: "var(--success)", color: "var(--on-success)", border: "none", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
              >
                <Check size={13} /> Aprovar e mesclar
              </button>
              <button
                onClick={() => setShowReject(true)}
                disabled={busy}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "var(--surface)", color: "var(--text-dim)", border: "1px solid var(--border-strong)", cursor: "pointer" }}
              >
                Devolver com motivo
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                autoFocus
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Por que está devolvendo?"
                rows={2}
                className="text-xs rounded-lg border px-2.5 py-2 outline-none resize-none"
                style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={busy || !rejectReason.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold"
                  style={{ background: "var(--danger)", color: "var(--on-danger)", border: "none", cursor: "pointer", opacity: rejectReason.trim() ? 1 : 0.5 }}
                >
                  <XIcon size={11} /> Confirmar devolução
                </button>
                <button
                  onClick={() => { setShowReject(false); setRejectReason(""); }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium"
                  style={{ background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border)", cursor: "pointer" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function BugReportDrawer({ report, stages, isAdmin, currentUser, onClose, onChangeStage, onApprove, onReject, onAddNote, onUpdateNote, onDelete }) {
  const priority = bugPriorityMeta(report.priority);

  const targets = useMemo(
    () => (stages || []).filter(s => stageKeyOf(s) !== report.stage && !s.terminal),
    [stages, report.stage]
  );

  const comments = useMemo(() => {
    const notes = Array.isArray(report.notes) ? report.notes : [];
    return notes.filter(n => !n.deletedAt).map((n, i) => ({
      id: n.id || `note-${i}`,
      authorId: n.authorId || null,
      authorName: n.authorName || null,
      text: n.text,
      createdAt: n.createdAt,
      editedAt: n.editedAt || null,
    }));
  }, [report.notes]);

  const addComment = async (text) => {
    await onAddNote(report.id, {
      id: crypto.randomUUID(),
      authorId: currentUser?.id || null,
      authorName: currentUser?.name || null,
      text,
      createdAt: new Date().toISOString(),
    });
  };

  const updateComment = async (id, patch) => {
    await onUpdateNote(report.id, id, patch);
  };

  return (
    <SplitPanelDrawer
      onClose={onClose}
      onDelete={isAdmin ? () => onDelete(report.id) : undefined}
      deleteLabel="Excluir report"
      header={
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>{report.title}</h3>
          <p className="text-[11.5px] mt-0.5" style={{ color: "var(--text-faint)" }}>
            Reportado por {report.reporter?.name || "alguém"} · {report.module || "—"} · {relativeTime(report.created_at)}
          </p>
        </div>
      }
      left={
        <>
          <dl className="grid gap-2 text-xs" style={{ gridTemplateColumns: "100px 1fr" }}>
            <dt style={{ color: "var(--text-faint)" }}>Prioridade</dt>
            <dd style={{ margin: 0, color: "var(--text)" }}>{priority.label}</dd>
            <dt style={{ color: "var(--text-faint)" }}>Módulo</dt>
            <dd style={{ margin: 0, color: "var(--text)" }}>{report.module || "—"}</dd>
          </dl>
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>Descrição</div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text)", whiteSpace: "pre-wrap" }}>{report.description}</p>
          </div>
          {report.resolution_note && (
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-faint)" }}>
                {report.stage === "corrigido" ? "Nota de aprovação" : "Motivo da devolução"}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{report.resolution_note}</p>
            </div>
          )}
          <DiagnosisBox
            report={report}
            isAdmin={isAdmin}
            onApprove={() => onApprove(report.id)}
            onReject={(reason) => onReject(report.id, reason)}
          />
        </>
      }
      center={
        isAdmin ? (
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-faint)" }}>Mover para</div>
            <StageNavigator
              targets={targets}
              onMove={(stageKey) => onChangeStage(report.id, stageKey)}
              currentStageKey={report.stage}
              allStages={stages}
            />
          </div>
        ) : (
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>
            Etapa atual: <strong style={{ color: "var(--text)" }}>{(stages || []).find(s => stageKeyOf(s) === report.stage)?.name || report.stage}</strong>
          </div>
        )
      }
      right={
        <CommentsPanel
          comments={comments}
          currentUser={currentUser}
          mentionableUsers={[]}
          onAddComment={addComment}
          onUpdateComment={updateComment}
          disabled={!isAdmin}
        />
      }
    />
  );
}

export default BugReportDrawer;
