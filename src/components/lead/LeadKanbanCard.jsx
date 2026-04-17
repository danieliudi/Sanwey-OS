import React, { memo } from "react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { CompanyTag } from "../ui/CompanyTag";
import { formatK } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";

function LeadKanbanCardImpl({ lead, ownerName, showOwnerFooter, isGroupView, onClick, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart?.(lead)}
      onClick={() => onClick?.(lead)}
      className="p-3 rounded-sm border cursor-pointer transition-all hover:shadow-md"
      style={{
        background: "#FFFFFF",
        borderColor: "#EFEFEF",
        borderLeft: `3px solid ${COMPANIES[lead.companyId]?.primary || NEUTRAL.slate}`,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-xs leading-snug flex-1" style={{ color: NEUTRAL.graphite }}>
          {lead.company}
        </div>
        <FitScoreCircle score={lead.fitScore} size={30} />
      </div>
      <div className="text-xs mb-2 line-clamp-1" style={{ color: NEUTRAL.slate }}>
        {lead.skuName}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono font-semibold" style={{ color: NEUTRAL.graphite }}>
          {formatK(lead.value)}
        </span>
        <span style={{ color: NEUTRAL.slate }}>
          {Math.round(lead.probability * 100)}% · {formatDateBR(lead.closeDate)}
        </span>
      </div>
      {showOwnerFooter && lead.owner && (
        <div
          className="mt-2 pt-2 border-t text-[10px] flex items-center justify-between"
          style={{ borderColor: "#EFEFEF", color: NEUTRAL.slate }}
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
