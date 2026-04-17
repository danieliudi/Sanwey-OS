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
      className="p-4 rounded-sm border transition-all hover:shadow-sm cursor-pointer"
      style={{ background: "#FFFFFF", borderColor: "#EFEFEF" }}
    >
      <div className="flex items-center gap-4">
        <FitScoreCircle score={lead.fitScore} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold truncate" style={{ color: NEUTRAL.graphite, fontSize: 14 }}>
              {lead.company}
            </span>
            {isGroupView && <CompanyTag companyId={lead.companyId} />}
          </div>
          <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: NEUTRAL.slate }}>
            <span className="flex items-center gap-1"><Factory size={10} /> {lead.sector}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><MapPin size={10} /> {lead.city}</span>
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end gap-1">
          <span className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>
            {formatK(lead.value)}
          </span>
          <UrgencyTag urgency={lead.urgency} />
        </div>
        <ChevronRight size={18} color={NEUTRAL.slate} />
      </div>
    </div>
  );
}

export const LeadCard = memo(LeadCardImpl);
export default LeadCard;
