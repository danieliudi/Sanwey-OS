import React, { memo } from "react";
import { ChevronRight, Factory, MapPin } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { CompanyTag } from "../ui/CompanyTag";
import { UrgencyTag } from "../ui/UrgencyTag";
import { formatK } from "../../utils/currency";

function LeadCardImpl({ lead, isGroupView, onClick }) {
  return (
    <div
      onClick={() => onClick?.(lead)}
      className="px-4 py-3.5 rounded-xl border transition-all duration-150 cursor-pointer group"
      style={{ background: "#FFFFFF", borderColor: "#E8E8E8", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
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
      <div className="flex items-center gap-3">
        <FitScoreCircle score={lead.fitScore} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold truncate" style={{ color: NEUTRAL.graphite, fontSize: 14 }}>
              {lead.company}
            </span>
            {isGroupView && <CompanyTag companyId={lead.companyId} />}
          </div>
          <div className="flex items-center gap-2.5 text-xs flex-wrap" style={{ color: NEUTRAL.slate }}>
            <span className="flex items-center gap-1"><Factory size={10} /> {lead.sector}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><MapPin size={10} /> {lead.city}</span>
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end gap-1.5">
          <span className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>
            {formatK(lead.value)}
          </span>
          <UrgencyTag urgency={lead.urgency} />
        </div>
        <ChevronRight
          size={16}
          strokeWidth={2}
          style={{ color: NEUTRAL.slate, opacity: 0.5, flexShrink: 0, transition: "opacity 0.15s" }}
        />
      </div>
    </div>
  );
}

export const LeadCard = memo(LeadCardImpl);
export default LeadCard;
