import React, { memo } from "react";
import { Clock } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { CompanyTag } from "../ui/CompanyTag";
import { formatK } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";

function daysFromDate(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function agingStyle(days) {
  if (days > 21) return { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" };
  if (days > 7)  return { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" };
  if (days > 0)  return { bg: "#DCFCE7", text: "#16A34A", border: "#BBF7D0" };
  return null; // "Hoje" — don't show badge for day 0
}

function LeadKanbanCardImpl({ lead, ownerName, showOwnerFooter, isGroupView, onClick, onDragStart }) {
  const daysInStage = daysFromDate(lead.stageChangedAt);
  // Normalize probability: demo data uses 0–1 scale, manual cards use 0–100
  const probDisplay = lead.probability > 1
    ? Math.round(lead.probability)
    : Math.round(lead.probability * 100);

  return (
    <div
      draggable
      onDragStart={() => onDragStart?.(lead)}
      onClick={() => onClick?.(lead)}
      className="p-3.5 rounded-xl border cursor-pointer transition-all duration-150"
      style={{
        background: "#FFFFFF",
        borderColor: "#E8E8E8",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        borderLeft: `3px solid ${COMPANIES[lead.companyId]?.primary || NEUTRAL.slate}`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        e.currentTarget.style.borderColor = "#D0D0D0";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
        e.currentTarget.style.borderColor = "#E8E8E8";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Company + aging badge + score */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-[13px] leading-snug flex-1" style={{ color: NEUTRAL.graphite }}>
          {lead.company}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {daysInStage !== null && agingStyle(daysInStage) && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold"
              style={{
                fontSize: 10,
                background: agingStyle(daysInStage).bg,
                color: agingStyle(daysInStage).text,
                border: `1px solid ${agingStyle(daysInStage).border}`,
                letterSpacing: "-0.01em",
              }}
              title={`${daysInStage} dias nesta etapa`}
            >
              <Clock size={8} strokeWidth={2.5} />
              {daysInStage}d
            </span>
          )}
          <FitScoreCircle score={lead.fitScore} size={30} />
        </div>
      </div>

      {/* SKU */}
      <div className="text-xs mb-2.5 line-clamp-1" style={{ color: NEUTRAL.slate }}>
        {lead.skuName}
      </div>

      {/* Value + probability + close date */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold" style={{ color: NEUTRAL.graphite }}>
          {formatK(lead.value)}
        </span>
        <span style={{ color: NEUTRAL.slate }}>
          {probDisplay}% · {formatDateBR(lead.closeDate)}
        </span>
      </div>

      {/* Owner footer */}
      {showOwnerFooter && lead.owner && (
        <div
          className="mt-2.5 pt-2 border-t text-[11px] flex items-center justify-between"
          style={{ borderColor: "#F0F0F0", color: NEUTRAL.slate }}
        >
          <span>{ownerName || "—"}</span>
          {isGroupView && <CompanyTag companyId={lead.companyId} />}
        </div>
      )}
    </div>
  );
}

export const LeadKanbanCard = memo(LeadKanbanCardImpl);
export default LeadKanbanCard;
