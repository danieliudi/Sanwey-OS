import React, { memo, useMemo, useRef, useState } from "react";
import { Clock, Star, AlertTriangle, TrendingUp, Check, X as XIcon, MessageCircle } from "lucide-react";
import { NEUTRAL, COMPANIES } from "../../constants/companies";
import { CHANNEL_COLORS, MARKETING_STAGES } from "../../constants/marketing-pipelines";
import { formatK } from "../../utils/currency";
import { CompletenessBadge } from "../ui/CompletenessBadge";
import { AvatarStack } from "../shared/AvatarStack";
import { MoveStageMenu } from "../shared/MoveStageMenu";

function daysFromDate(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntilDate(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// Tempo na etapa (neutro) vs. SLA estourado (vermelho) — só fica âmbar/
// vermelho de fato passando do SLA da etapa; sem SLA, ou dentro do prazo, é
// só um badge neutro (tempo decorrido).
function slaStyle(daysInStage, sla) {
  if (daysInStage <= 0) return null;
  if (sla) {
    const ratio = daysInStage / sla;
    if (ratio >= 1)   return { bg: "#FEE2E2", text: "var(--danger)", border: "#FECACA" };
    if (ratio >= 0.7) return { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" };
  }
  return { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" };
}

function CampaignKanbanCardImpl({ campaign, users, onClick, onDragStart, onDragEnd, stages, onMoveToStage, onDeleteCard, completeness, unread, showMoveOptions = true }) {
  const [menuOpen, setMenuOpen] = useState(false);
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
  const ageStyle = daysInStage !== null ? slaStyle(daysInStage, stage?.sla) : null;
  const isTerminal = Boolean(stage?.terminal);

  const isUrgent = daysToLaunch !== null && daysToLaunch <= 7 &&
    !["ao_vivo", "encerrado", "analise"].includes(campaign.stage);

  const channelStyle = campaign.channel
    ? (CHANNEL_COLORS[campaign.channel] || { bg: "var(--surface-alt)", text: "var(--text-dim)", border: "var(--border)" })
    : null;

  const shadowBase  = `var(--shadow-card)`;
  const shadowHover = `var(--shadow-pop)`;

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
      onDragStart={() => onDragStart?.(campaign)}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => { if (!menuOpen) onClick?.(campaign); }}
      className="p-3.5 rounded-lg cursor-pointer transition-all duration-150"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: shadowBase,
        position: "relative",
        opacity: isTerminal ? 0.6 : 1,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = shadowHover;
        e.currentTarget.style.borderColor = "var(--border-strong)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = shadowBase;
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Header: name + badges + menu */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="font-semibold text-[13px] leading-snug flex-1" style={{ color: "var(--text)" }}>
          {campaign.name}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {unread && (
            <span
              title="Comentário novo"
              className="inline-flex items-center justify-center rounded-full"
              style={{ width: 16, height: 16, background: "var(--accent)", color: "#FFF" }}
            >
              <MessageCircle size={9} strokeWidth={2.5} fill="currentColor" />
            </span>
          )}
          {isUrgent && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold"
              style={{ fontSize: 10, background: "#FEE2E2", color: "var(--danger)", border: "1px solid #FECACA" }}
              title={`Lançamento em ${daysToLaunch}d`}
            >
              <AlertTriangle size={8} strokeWidth={2.5} />
              URGENTE
            </span>
          )}
          {ageStyle && !isUrgent && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold"
              style={{ fontSize: 10, background: ageStyle.bg, color: ageStyle.text, border: `1px solid ${ageStyle.border}` }}
              title={`${daysInStage}d nesta etapa (SLA: ${stage?.sla}d)`}
            >
              <Clock size={8} strokeWidth={2.5} />
              {daysInStage}d
            </span>
          )}
          {completeness?.total > 0 && (
            <CompletenessBadge filled={completeness.filled} total={completeness.total} size={26} />
          )}
          {campaign.starred && (
            <Star size={13} style={{ color: "#F59E0B", fill: "#F59E0B" }} />
          )}
          {((moveTargets.length > 0 && onMoveToStage) || onDeleteCard) && (
            <MoveStageMenu
              targets={moveTargets.map(s => ({ key: s.id, name: s.name, color: s.color }))}
              onMove={onMoveToStage ? (key) => onMoveToStage(campaign.id, key) : undefined}
              onDelete={onDeleteCard ? () => onDeleteCard(campaign.id) : undefined}
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
            style={{ background: channelStyle.bg, color: channelStyle.text, border: `1px solid ${channelStyle.border}` }}
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
            <span className="text-[11px] font-semibold" style={{ color: "var(--text)" }}>
              {formatK(campaign.budget)}
            </span>
          )}
          {campaign.launchDate && (
            <span
              className="text-[10px]"
              style={{ color: daysToLaunch !== null && daysToLaunch <= 3 ? "var(--danger)" : "var(--text-dim)" }}
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
            <AvatarStack users={resolvedOwners} size={20} max={3} />
          )}
        </div>
      </div>
    </div>
  );
}

export const CampaignKanbanCard = memo(CampaignKanbanCardImpl);
