import React, { useCallback, useMemo, useState } from "react";
import { Bug as BugIcon, Plus, AlertCircle, ExternalLink } from "lucide-react";
import { useBugReports } from "../../hooks/use-bug-reports";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { daysSince, relativeTime } from "../../utils/date";
import { bugPriorityMeta } from "../../constants/bug-reports";
import { KanbanBoardHeader } from "../shared/KanbanBoardHeader";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { KanbanFab } from "../shared/KanbanFab";
import { RHKanbanCard } from "../rh-pipeline/RHKanbanCard";
import { RHMobileKanbanAccordion } from "../rh-pipeline/RHMobileKanbanAccordion";
import { AppToast } from "../shared/AppToast";
import { EmptyState } from "../ui/EmptyState";
import { ReportBugModal } from "../bugs/ReportBugModal";
import { BugReportDrawer } from "../bugs/BugReportDrawer";

function stageKeyOf(s) { return s?.stageKey ?? s?.id; }

function BugCardBody({ report }) {
  const priority = bugPriorityMeta(report.priority);
  return (
    <>
      <div className="text-xs font-semibold leading-snug mb-1.5" style={{ color: "var(--text)" }}>{report.title}</div>
      <div className="text-[10.5px] mb-1.5" style={{ color: "var(--text-faint)" }}>
        👤 {report.reporter?.name || "alguém"} · {report.module || "—"} · {relativeTime(report.created_at)}
      </div>
      {report.stage === "em_analise" ? (
        <span className="inline-flex text-[9.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
          🤖 Em análise
        </span>
      ) : report.stage === "correcao_proposta" && report.pr_url ? (
        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-tint)", color: "var(--accent)" }}>
          <ExternalLink size={9} /> PR pronto
        </span>
      ) : (
        <span className="inline-flex text-[9.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: priority.color + "18", color: priority.color }}>
          {priority.pill}
        </span>
      )}
    </>
  );
}

function BugsKanbanColumn({ stage, stages, reports, onCardClick, onDragStart, onDragEnd, onMoveToStage, onDeleteCard, isDragOver, onColumnDragOver, onColumnDragLeave, onColumnDrop }) {
  return (
    <div
      onDragOver={(e) => onColumnDragOver(e, stage.stageKey)}
      onDragLeave={onColumnDragLeave}
      onDrop={() => onColumnDrop(stage.stageKey)}
      className="flex flex-col rounded-lg transition-all duration-150"
      style={{ width: 272, minWidth: 272, height: "100%", overflow: "hidden", borderRight: stage.stageKey !== stages[stages.length - 1]?.stageKey ? "1px solid var(--border)" : "none", background: isDragOver ? stage.color + "14" : "var(--surface-alt)", boxShadow: isDragOver ? `0 0 0 2px ${stage.color}40` : "none" }}
    >
      <KanbanColumnHeader color={stage.color} name={stage.name} count={reports.length} bandHeight={4} letterSpacing="normal" nameFontSize={14} nameFontWeight={700} uppercase={false} countFontSize={12} />
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {reports.length === 0 ? (
          <div className="text-[11px] text-center py-6" style={{ color: "var(--text-faint)" }}>Nada aqui</div>
        ) : (
          reports.map((r) => (
            <RHKanbanCard
              key={r.id}
              id={r.id}
              stage={r.stage}
              stages={stages}
              onClick={onCardClick}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onMoveToStage={onMoveToStage}
              onDeleteCard={onDeleteCard}
              agingDays={daysSince(r.updated_at || r.created_at)}
            >
              <BugCardBody report={r} />
            </RHKanbanCard>
          ))
        )}
      </div>
    </div>
  );
}

export function BugsView({ currentUser, isAdmin }) {
  const { reports, loading, createReport, changeStage, approveDiagnosis, rejectDiagnosis, addNote, updateNote, deleteReport } =
    useBugReports({ userId: currentUser?.id, isAdmin });
  const { stages, loading: loadingStages } = useRHPipelineStages("bugs");

  const [showReportModal, setShowReportModal] = useState(false);
  const [drawerId, setDrawerId] = useState(null);
  const [boardError, setBoardError] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverStageKey, setDragOverStageKey] = useState(null);

  const [boardRef, boardHeight] = useAvailableHeight(16, [loading, loadingStages]);

  const orderedStages = useMemo(() => [...stages].sort((a, b) => a.order_idx - b.order_idx), [stages]);
  const reportsByStage = useMemo(() => {
    const map = {};
    for (const r of reports) (map[r.stage] ||= []).push(r);
    return map;
  }, [reports]);

  const handleCreateReport = useCallback(async (data) => {
    await createReport(data);
  }, [createReport]);

  const handleMoveToStage = useCallback(async (id, stageKey) => {
    try {
      await changeStage(id, stageKey);
    } catch (e) {
      setBoardError(e?.message || "Não foi possível mover — tente novamente.");
    }
  }, [changeStage]);

  const handleColumnDrop = useCallback((stageKey) => {
    setDragOverStageKey(null);
    if (draggedId) handleMoveToStage(draggedId, stageKey);
    setDraggedId(null);
  }, [draggedId, handleMoveToStage]);

  const drawerReport = drawerId ? reports.find(r => r.id === drawerId) : null;
  const loadingAll = loading || loadingStages;

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
              <BugIcon size={22} style={{ color: "var(--text)" }} />
              <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Central de Bugs</h1>
            </div>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
              {isAdmin ? "Reporta, a IA investiga, você aprova." : "Acompanhe o status dos bugs que você reportou."}
            </p>
          </div>
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: "pointer" }}
          >
            <Plus size={15} /> Reportar bug
          </button>
        </div>
      </KanbanBoardHeader>

      <ReportBugModal open={showReportModal} onClose={() => setShowReportModal(false)} onSubmit={handleCreateReport} />

      {loadingAll ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : !isAdmin ? (
        // Quem reportou só acompanha os próprios (RLS já restringe a isso) —
        // lista simples, board completo é só pra quem faz a triagem.
        reports.length === 0 ? (
          <EmptyState icon={BugIcon} title="Nenhum bug reportado ainda" description="Encontrou algo que não devia acontecer? Reporte pelo botão acima." />
        ) : (
          <div className="flex flex-col gap-2">
            {reports.map((r) => {
              const priority = bugPriorityMeta(r.priority);
              const stage = orderedStages.find(s => stageKeyOf(s) === r.stage);
              return (
                <button
                  key={r.id}
                  onClick={() => setDrawerId(r.id)}
                  className="flex items-center justify-between gap-3 text-left rounded-xl border px-4 py-3"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", cursor: "pointer" }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{r.title}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>{r.module || "—"} · {relativeTime(r.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: priority.color + "18", color: priority.color }}>{priority.pill}</span>
                    <span className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full" style={{ background: (stage?.color || "#64748B") + "18", color: stage?.color || "#64748B" }}>
                      {stage?.name || r.stage}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : (
        <>
          <RHMobileKanbanAccordion
            stages={orderedStages}
            itemsByStage={reportsByStage}
            renderCard={(r) => (
              <RHKanbanCard
                key={r.id}
                id={r.id}
                stage={r.stage}
                stages={orderedStages}
                onClick={() => setDrawerId(r.id)}
                onDragStart={setDraggedId}
                onDragEnd={() => { setDraggedId(null); setDragOverStageKey(null); }}
                onMoveToStage={handleMoveToStage}
                onDeleteCard={deleteReport}
                agingDays={daysSince(r.updated_at || r.created_at)}
              >
                <BugCardBody report={r} />
              </RHKanbanCard>
            )}
            emptyLabel="Nada aqui"
          />
          <div className="hidden lg:block">
            <KanbanBoardScrollArea scrollRef={boardRef} height={boardHeight}>
              <div className="flex gap-2 h-full" style={{ minWidth: `${orderedStages.length * 280}px` }}>
                {orderedStages.map((stage) => (
                  <BugsKanbanColumn
                    key={stage.id}
                    stage={stage}
                    stages={orderedStages}
                    reports={reportsByStage[stage.stageKey] || []}
                    onCardClick={(id) => setDrawerId(id)}
                    onDragStart={setDraggedId}
                    onDragEnd={() => { setDraggedId(null); setDragOverStageKey(null); }}
                    onMoveToStage={handleMoveToStage}
                    onDeleteCard={deleteReport}
                    isDragOver={dragOverStageKey === stage.stageKey}
                    onColumnDragOver={(e, key) => { e.preventDefault(); setDragOverStageKey(key); }}
                    onColumnDragLeave={() => setDragOverStageKey(null)}
                    onColumnDrop={handleColumnDrop}
                  />
                ))}
              </div>
            </KanbanBoardScrollArea>
          </div>
          <KanbanFab label="Reportar" onClick={() => setShowReportModal(true)} />
        </>
      )}

      {drawerReport && (
        <BugReportDrawer
          report={drawerReport}
          stages={orderedStages}
          isAdmin={isAdmin}
          currentUser={currentUser}
          onClose={() => setDrawerId(null)}
          onChangeStage={handleMoveToStage}
          onApprove={approveDiagnosis}
          onReject={rejectDiagnosis}
          onAddNote={addNote}
          onUpdateNote={updateNote}
          onDelete={async (id) => { await deleteReport(id); setDrawerId(null); }}
        />
      )}
    </div>
  );
}

export default BugsView;
