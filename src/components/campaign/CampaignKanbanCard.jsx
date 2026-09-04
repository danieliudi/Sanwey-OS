import React, { memo, useMemo, useRef, useState } from "react";
import { Star, AlertTriangle, TrendingUp, Check, X as XIcon } from "lucide-react";
import { NEUTRAL, COMPANIES } from "../../constants/companies";
import { CHANNEL_COLORS, MARKETING_STAGES } from "../../constants/marketing-pipelines";
import { formatK } from "../../utils/currency";
import { AvatarStack } from "../shared/AvatarStack";
import { MoveStageMenu } from "../shared/MoveStageMenu";
import { KanbanCardStatusChips } from "../shared/KanbanCardStatusChips";
import { terminalCardBackground, terminalTextColor, terminalAccentOpacity } from "../shared/terminal-card-style";

function daysFromDate(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntilDate(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function CampaignKanbanCardImpl({ campaign, users, onClick, onDragStart, onDragEnd, stages, onMoveToStage, onDeleteCard, onDuplicateCard, completeness, unread, showMoveOptions = true }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const cardRef = useRef(null);

  // FASE 5: mais de um responsável por campanha — resolve owner_ids (com
  // fallback pro owner escalar em campanhas legadas) contra a lista de
  // usuários pra alimentar o AvatarStack do rodapé.
  const resolvedOwners = useMemo(() => {
    const ids = campaign.ownerIds?.length ? campaign.ownerIds : (campaign.owner ? [campaign.owner] : []);
    return ids.map(id => (users || []).find(u => u.id === id)).filter(Boolean);
  }, [campaign.ownerIds, campaign.owner, users]);

  // Usa as etapas vivas (DB, editáveis) quando disponíveis — MARKETING_STAGES
  // é só o fallback estático de antes da customização por etapa existir.
  const stage = (stages || MARKETING_STAGES).find(s => s.id === campaign.stage);
  const daysInStage = daysFromDate(campaign.stageChangedAt);
  const daysToLaunch = daysUntilDate(campaign.launchDate);
  const isTerminal = Boolean(stage?.terminal);

  const isUrgent = daysToLaunch !== null && daysToLaunch <= 7 &&
    !["ao_vivo", "encerrado", "analise"].includes(campaign.stage);

  const channelStyle = campaign.channel
    ? (CHANNEL_COLORS[campaign.channel] || { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" })
    : null;

  const companyLabels = (campaign.companyIds || [])
    .map(id => COMPANIES[id]?.short || id)
    .join(", ");

  // showMoveOptions=false no board desktop (drag-and-drop já cobre mover) —
  // o "..." vira lixeira direta (ver MoveStageMenu). O bloco mobile (acordeão,
  // sem drag) continua passando showMoveOptions=true, único jeito de mover lá.
  const moveTargets = showMoveOptions
    ? (stages || MARKETING_STAGES).filter(s => s.id !== campaign.stage && !s.terminal)
    : [];

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={() => { setDragging(true); onDragStart?.(campaign); }}
      onDragEnd={() => { setDragging(false); onDragEnd?.(); }}
      onClick={() => { if (!menuOpen) onClick?.(campaign); }}
      className={`p-3.5 rounded-lg cursor-pointer polish-kanban-card${dragging ? " is-dragging" : ""}`}
      style={{
        background: terminalCardBackground(isTerminal),
        border: "1px solid var(--border)",
        position: "relative",
      }}
    >
      {/* Header: name + badges + menu */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="font-semibold text-[13px] leading-snug flex-1" style={{ color: terminalTextColor(isTerminal) }}>
          {campaign.name}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <KanbanCardStatusChips
            unread={unread}
            agingDays={isUrgent ? null : daysInStage}
            slaDays={stage?.sla}
            agingTitle={`${daysInStage}d nesta etapa (SLA: ${stage?.sla}d)`}
            dangerColor="var(--danger)"
            completeness={completeness}
            completenessSize={26}
            muted={isTerminal}
          >
            {isUrgent && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold"
                style={{ fontSize: 10, background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)", opacity: terminalAccentOpacity(isTerminal) }}
                title={`Lançamento em ${daysToLaunch}d`}
              >
                <AlertTriangle size={8} strokeWidth={2.5} />
                URGENTE
              </span>
            )}
          </KanbanCardStatusChips>
          {campaign.starred && (
            <Star size={13} style={{ color: "var(--amber)", fill: "var(--amber)", opacity: terminalAccentOpacity(isTerminal) }} />
          )}
          {((moveTargets.length > 0 && onMoveToStage) || onDeleteCard || onDuplicateCard) && (
            <MoveStageMenu
              targets={moveTargets.map(s => {
                const list = stages || MARKETING_STAGES;
                const dir = list.findIndex(x => x.id === s.id) < list.findIndex(x => x.id === campaign.stage) ? "before" : "after";
                return { key: s.id, name: s.name, color: s.color, direction: dir };
              })}
              onMove={onMoveToStage ? (key) => onMoveToStage(campaign.id, key) : undefined}
              onDelete={onDeleteCard ? () => onDeleteCard(campaign.id) : undefined}
              onDuplicate={onDuplicateCard ? () => onDuplicateCard(campaign.id) : undefined}
              onOpenChange={setMenuOpen}
            />
          )}
        </div>
      </div>

      {/* Company tag */}
      {companyLabels && (
        <div className="text-[10px] mb-1.5" style={{ color: "var(--text-dim)" }}>
          {companyLabels}
        </div>
      )}

      {/* Channel + KPI badges — só ocupa espaço quando existe pelo menos um;
          antes era um div sempre presente (com margem), deixando uma sobra
          vazia em cards sem canal/KPI e quebrando o ritmo vertical do board. */}
      {(campaign.channel || campaign.kpi) && (
      <div className="flex flex-wrap gap-1 mb-2">
        {campaign.channel && channelStyle && (
          <span
            className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
            style={{ background: channelStyle.bg, color: channelStyle.text, border: `1px solid ${channelStyle.border}`, opacity: terminalAccentOpacity(isTerminal) }}
          >
            {campaign.channel}
          </span>
        )}
        {campaign.kpi && (
          <span
            className="px-1.5 py-0.5 rounded-md text-[10px] font-medium"
            style={{ background: "var(--surface-alt)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
          >
            {campaign.kpi}
          </span>
        )}
      </div>
      )}

      {/* Footer: budget + launch + owner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {campaign.budget > 0 && (
            <span className="text-[11px] font-semibold" style={{ color: terminalTextColor(isTerminal) }}>
              {formatK(campaign.budget)}
            </span>
          )}
          {campaign.launchDate && (
            <span
              className="text-[10px]"
              style={{
                color: daysToLaunch !== null && daysToLaunch <= 3 ? "var(--danger)" : "var(--text-dim)",
                opacity: terminalAccentOpacity(isTerminal),
              }}
            >
              {daysToLaunch !== null
                ? daysToLaunch < 0
                  ? `lançado há ${Math.abs(daysToLaunch)}d`
                  : daysToLaunch === 0
                    ? "lança hoje"
                    : `lança em ${daysToLaunch}d`
                : null
              }
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {campaign.performanceScore > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold"
              style={{ color: "var(--text-dim)" }}
            >
              <TrendingUp size={9} strokeWidth={2} />
              {campaign.performanceScore}
            </span>
          )}
          {resolvedOwners.length > 0 && (
            <span className="inline-flex" style={{ opacity: terminalAccentOpacity(isTerminal) }}>
              <AvatarStack users={resolvedOwners} size={20} max={3} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export const CampaignKanbanCard = memo(CampaignKanbanCardImpl);
