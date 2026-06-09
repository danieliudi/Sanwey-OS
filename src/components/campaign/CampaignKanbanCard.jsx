import React, { memo } from "react";
import { Clock, Star, AlertTriangle, TrendingUp } from "lucide-react";
import { NEUTRAL, COMPANIES } from "../../constants/companies";
import { CHANNEL_COLORS, MARKETING_STAGES } from "../../constants/marketing-pipelines";
import { formatK } from "../../utils/currency";

function daysFromDate(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntilDate(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function slaStyle(daysInStage, sla) {
  if (!sla) return null;
  const ratio = daysInStage / sla;
  if (ratio >= 1)   return { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" };
  if (ratio >= 0.7) return { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" };
  return null;
}

function CampaignKanbanCardImpl({ campaign, ownerName, onClick, onDragStart, stages }) {
  const stage = MARKETING_STAGES.find(s => s.id === campaign.stage);
  const daysInStage = daysFromDate(campaign.stageChangedAt);
  const daysToLaunch = daysUntilDate(campaign.launchDate);
  const ageStyle = daysInStage !== null ? slaStyle(daysInStage, stage?.sla) : null;

  const isUrgent = daysToLaunch !== null && daysToLaunch <= 7 &&
    !["ao_vivo", "encerrado", "analise"].includes(campaign.stage);

  const channelStyle = campaign.channel
    ? (CHANNEL_COLORS[campaign.channel] || { bg: "#F3F4F6", text: NEUTRAL.slate, border: "#E5E7EB" })
    : null;

  const accentColor = stage?.color || NEUTRAL.slate;
  const shadowBase  = `inset 3px 0 0 ${accentColor}, 0 1px 4px rgba(32,26,26,0.06)`;
  const shadowHover = `inset 3px 0 0 ${accentColor}, 0 4px 16px rgba(32,26,26,0.10)`;

  const companyLabels = (campaign.companyIds || [])
    .map(id => COMPANIES[id]?.short || id)
    .join(", ");

  return (
    <div
      draggable
      onDragStart={() => onDragStart?.(campaign)}
      onClick={() => onClick?.(campaign)}
      className="p-3.5 rounded-xl cursor-pointer transition-all duration-150"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        boxShadow: shadowBase,
        position: "relative",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = shadowHover;
        e.currentTarget.style.borderColor = "#e9bcb6";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = shadowBase;
        e.currentTarget.style.borderColor = "#E5E7EB";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Header: name + badges */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="font-semibold text-[13px] leading-snug flex-1" style={{ color: NEUTRAL.graphite }}>
          {campaign.name}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isUrgent && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold"
              style={{ fontSize: 10, background: "#FEE2E2", color: "#DC2626", border: "1px solid #FECACA" }}
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
          {campaign.starred && (
            <Star size={13} style={{ color: "#F59E0B", fill: "#F59E0B" }} />
          )}
        </div>
      </div>

      {/* Company tag */}
      {companyLabels && (
        <div className="text-[10px] mb-1.5" style={{ color: NEUTRAL.slate }}>
          {companyLabels}
        </div>
      )}

      {/* Channel + KPI badges */}
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
            style={{ background: "#F3F4F6", color: NEUTRAL.slate, border: "1px solid #E5E7EB" }}
          >
            {campaign.kpi}
          </span>
        )}
      </div>

      {/* Footer: budget + launch + owner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {campaign.budget > 0 && (
            <span className="text-[11px] font-semibold" style={{ color: NEUTRAL.graphite }}>
              {formatK(campaign.budget)}
            </span>
          )}
          {campaign.launchDate && (
            <span
              className="text-[10px]"
              style={{ color: daysToLaunch !== null && daysToLaunch <= 3 ? "#DC2626" : NEUTRAL.slate }}
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
              style={{ color: NEUTRAL.slate }}
            >
              <TrendingUp size={9} strokeWidth={2} />
              {campaign.performanceScore}
            </span>
          )}
          {ownerName && (
            <span
              className="flex items-center justify-center rounded-full text-[9px] font-bold"
              style={{
                width: 20, height: 20,
                background: accentColor,
                color: "#FFFFFF",
                letterSpacing: "-0.01em",
              }}
              title={ownerName}
            >
              {ownerName.split(" ").map(p => p[0]).slice(0, 2).join("")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export const CampaignKanbanCard = memo(CampaignKanbanCardImpl);
