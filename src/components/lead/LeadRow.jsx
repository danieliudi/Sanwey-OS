import React, { memo } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { CompanyTag } from "../ui/CompanyTag";
import { formatK } from "../../utils/currency";

function LeadRowImpl({ lead, striped, onClick, onStarToggle }) {
  const base = striped ? "var(--surface-alt)" : "#FFFFFF";
  return (
    <div
      className="grid md:grid-cols-12 gap-4 px-4 py-3 border-b cursor-pointer items-center"
      style={{ borderColor: "#EFEFEF", background: base, transition: "background 120ms" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#F0F4FF"; }}
      onMouseLeave={e => { e.currentTarget.style.background = base; }}
      onClick={() => onClick?.(lead)}
    >
      <div className="col-span-4 flex items-center gap-2">
        <button
          onClick={e => { e.stopPropagation(); onStarToggle?.(lead.id); }}
          aria-label={lead.starred ? "Desfavoritar" : "Favoritar"}
        >
          {lead.starred
            ? <BookmarkCheck size={16} color={NEUTRAL.gold} />
            : <Bookmark size={16} color="var(--text-dim)" />}
        </button>
        <div className="min-w-0">
          <div className="font-semibold truncate" style={{ color: "var(--text)", fontSize: 14 }}>
            {lead.company}
          </div>
          <div className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>{lead.cnpj}</div>
        </div>
      </div>
      <div className="col-span-2">
        <CompanyTag companyId={lead.companyId} />
        <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>{lead.sector}</div>
      </div>
      <div className="col-span-2 text-xs" style={{ color: "var(--text)" }}>
        <div>{lead.city}</div>
        <div style={{ color: "var(--text-dim)" }}>{lead.size}</div>
      </div>
      <div className="col-span-1 text-right text-xs font-semibold" style={{ color: "var(--text)" }}>
        {formatK(lead.value)}
      </div>
      <div className="col-span-1 flex justify-center">
        <FitScoreCircle score={lead.fitScore} size={36} />
      </div>
      <div className="col-span-2 text-right text-xs" style={{ color: "var(--text-dim)" }}>
        {lead.daysAgo === 0 ? "Hoje" : `${lead.daysAgo}d atrás`}
      </div>
    </div>
  );
}

export const LeadRow = memo(LeadRowImpl);
export default LeadRow;
