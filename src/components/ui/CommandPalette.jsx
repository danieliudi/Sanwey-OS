import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Handshake, Megaphone, Users } from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { MARKETING_STAGES } from "../../constants/marketing-pipelines";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function companyBadgeStyle(companyId) {
  const c = COMPANIES[companyId];
  if (c) return { background: c.primary, color: "#FFFFFF" };
  return { background: "var(--text)", color: "#FFFFFF" };
}

function companyInitial(company = "") {
  return (company.trim()[0] || "?").toUpperCase();
}

// ---------------------------------------------------------------------------
// Row components
// ---------------------------------------------------------------------------

function LeadResultRow({ item, users, pipelines, highlighted, onSelect }) {
  const lead = item.data;
  const owner = useMemo(() => (users || []).find((u) => u.id === lead.owner), [users, lead.owner]);
  const stageName = useMemo(() => {
    const companyStages = pipelines?.[lead.companyId];
    if (!companyStages) return lead.stage || "";
    const found = companyStages.find((s) => s.id === lead.stage);
    return found?.name || lead.stage || "";
  }, [pipelines, lead.companyId, lead.stage]);
  const badgeStyle = companyBadgeStyle(lead.companyId);

  return (
    <div
      role="option"
      aria-selected={highlighted}
      onClick={onSelect}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
      style={{ background: highlighted ? "var(--surface-alt)" : "transparent", transition: "background 100ms" }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = highlighted ? "var(--surface-alt)" : "transparent"; }}
    >
      <div className="shrink-0 flex items-center justify-center rounded-lg font-bold select-none"
        style={{ width: 36, height: 36, fontSize: 15, ...badgeStyle }}>
        {companyInitial(lead.company)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Handshake size={10} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
          <div className="font-semibold truncate" style={{ fontSize: 14, color: "var(--text)" }}>{lead.company}</div>
        </div>
        <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-dim)" }}>
          {stageName}{lead.sector ? ` · ${lead.sector}` : ""}
        </div>
      </div>
      {owner && (
        <div className="shrink-0 flex items-center justify-center rounded-full text-white font-semibold select-none"
          style={{ width: 28, height: 28, fontSize: 11, background: owner.avatarBg || "var(--text)" }}
          title={owner.name}>
          {owner.initials || (owner.name || "?")[0].toUpperCase()}
        </div>
      )}
    </div>
  );
}

function CampaignResultRow({ item, highlighted, onSelect }) {
  const campaign = item.data;
  const stage = MARKETING_STAGES.find(s => s.id === campaign.stage);
  const companyLabel = (campaign.companyIds || [])
    .map(id => COMPANIES[id]?.short || id)
    .join(", ");

  return (
    <div
      role="option"
      aria-selected={highlighted}
      onClick={onSelect}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
      style={{ background: highlighted ? "var(--surface-alt)" : "transparent", transition: "background 100ms" }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = highlighted ? "var(--surface-alt)" : "transparent"; }}
    >
      <div className="shrink-0 flex items-center justify-center rounded-lg select-none"
        style={{ width: 36, height: 36, background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
        <Megaphone size={16} style={{ color: "var(--accent)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Megaphone size={10} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
          <div className="font-semibold truncate" style={{ fontSize: 14, color: "var(--text)" }}>{campaign.name}</div>
        </div>
        <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-dim)" }}>
          {stage ? (
            <span style={{ color: stage.color, fontWeight: 600 }}>{stage.name}</span>
          ) : campaign.stage}
          {campaign.channel ? ` · ${campaign.channel}` : ""}
          {companyLabel ? ` · ${companyLabel}` : ""}
        </div>
      </div>
    </div>
  );
}

function EmployeeResultRow({ item, highlighted, onSelect }) {
  const user = item.data;
  return (
    <div
      role="option"
      aria-selected={highlighted}
      onClick={onSelect}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
      style={{ background: highlighted ? "var(--surface-alt)" : "transparent", transition: "background 100ms" }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = highlighted ? "var(--surface-alt)" : "transparent"; }}
    >
      <div className="shrink-0 flex items-center justify-center rounded-full font-bold text-white select-none"
        style={{ width: 36, height: 36, fontSize: 15, background: user.avatarBg || "var(--text)" }}>
        {user.initials || user.name?.[0]?.toUpperCase() || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Users size={10} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
          <div className="font-semibold truncate" style={{ fontSize: 14, color: "var(--text)" }}>{user.name}</div>
        </div>
        <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-dim)" }}>
          {user.department || user.role || "Funcionário"}
          {user.position ? ` · ${user.position}` : ""}
        </div>
      </div>
    </div>
  );
}

const SECTION_LABELS = {
  lead:     "Leads / Negócios",
  campaign: "Campanhas",
  employee: "Funcionários",
};

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------

/**
 * Global search command palette.
 * Props:
 *   open            – boolean
 *   onClose         – () => void
 *   leads           – Lead[]
 *   campaigns       – Campaign[] (optional)
 *   employees       – User[] (optional, RH users/employees)
 *   users           – User[]
 *   pipelines       – { [companyId]: Stage[] }
 *   onSelectLead    – (lead) => void
 *   onSelectCampaign – (campaign) => void
 *   onSelectEmployee – (user) => void
 */
export function CommandPalette({
  open, onClose,
  leads, campaigns, employees,
  users, pipelines,
  onSelectLead, onSelectCampaign, onSelectEmployee,
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => { inputRef.current?.focus(); });
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out = [];

    // Leads
    const leadHits = (leads || []).filter(lead => {
      const ownerUser = (users || []).find(u => u.id === lead.owner);
      return (
        lead.company?.toLowerCase().includes(q) ||
        lead.sector?.toLowerCase().includes(q) ||
        ownerUser?.name?.toLowerCase().includes(q)
      );
    }).slice(0, 6);
    leadHits.forEach(l => out.push({ type: "lead", id: "lead:" + l.id, data: l }));

    // Campaigns
    const campaignHits = (campaigns || []).filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.channel?.toLowerCase().includes(q) ||
      (c.companyIds || []).some(id => COMPANIES[id]?.name?.toLowerCase().includes(q))
    ).slice(0, 4);
    campaignHits.forEach(c => out.push({ type: "campaign", id: "campaign:" + c.id, data: c }));

    // Employees
    const employeeHits = (employees || []).filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q) ||
      u.position?.toLowerCase().includes(q)
    ).slice(0, 4);
    employeeHits.forEach(u => out.push({ type: "employee", id: "employee:" + u.id, data: u }));

    return out;
  }, [query, leads, campaigns, employees, users]);

  useEffect(() => {
    setCursor(c => Math.min(c, Math.max(results.length - 1, 0)));
  }, [results]);

  useEffect(() => {
    if (!listRef.current) return;
    const highlighted = listRef.current.querySelector("[aria-selected='true']");
    highlighted?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const handleSelect = useCallback((item) => {
    if (item.type === "lead") onSelectLead?.(item.data);
    else if (item.type === "campaign") onSelectCampaign?.(item.data);
    else if (item.type === "employee") onSelectEmployee?.(item.data);
    onClose?.();
  }, [onSelectLead, onSelectCampaign, onSelectEmployee, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor(c => Math.min(c + 1, (results.length || 1) - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor(c => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        if (results[cursor]) handleSelect(results[cursor]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cursor, results]);

  // Group results by type for section headers — precisa vir antes do early
  // return abaixo: um hook chamado só quando `open` é true muda a contagem de
  // hooks entre renders fechado/aberto (React lança "Rendered fewer hooks
  // than expected" e, sem ErrorBoundary em volta deste componente, isso
  // derruba a árvore inteira — era a causa da tela branca ao abrir a busca).
  const groupedResults = useMemo(() => {
    const groups = {};
    results.forEach((item, idx) => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push({ ...item, globalIdx: idx });
    });
    return groups;
  }, [results]);

  if (!open) return null;

  const trimmedQuery = query.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ paddingTop: 80, background: "rgba(44,44,43,0.5)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Busca global"
    >
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: 560,
          borderRadius: 16,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(44,44,43,0.20)",
          overflow: "hidden",
          maxHeight: "calc(100vh - 120px)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4" style={{ height: 56, borderBottom: "1px solid var(--border)" }}>
          <Search size={18} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0); }}
            placeholder="Buscar lead, campanha, funcionário..."
            className="flex-1 outline-none bg-transparent"
            style={{ fontSize: 16, color: "var(--text)", border: "none" }}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls="cmd-results"
          />
          <kbd style={{ fontSize: 10, color: "var(--text-faint)", background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 5px" }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div id="cmd-results" ref={listRef} role="listbox" style={{ overflowY: "auto", maxHeight: 440 }}>
          {trimmedQuery === "" && (
            <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: "var(--text-dim)" }}>
              <Search size={24} strokeWidth={1} />
              <span style={{ fontSize: 14 }}>Digite para buscar leads, campanhas ou funcionários</span>
              <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Use ↑↓ para navegar · Enter para abrir · Esc para fechar</span>
            </div>
          )}

          {trimmedQuery !== "" && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: "var(--text-dim)" }}>
              <span style={{ fontSize: 14 }}>Nenhum resultado para <strong>"{trimmedQuery}"</strong></span>
            </div>
          )}

          {Object.entries(groupedResults).map(([type, items]) => (
            <div key={type}>
              <div style={{
                padding: "8px 16px 4px",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-faint)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}>
                {SECTION_LABELS[type] || type}
              </div>
              {items.map(item => {
                const highlighted = item.globalIdx === cursor;
                if (item.type === "lead") return (
                  <LeadResultRow key={item.id} item={item} users={users} pipelines={pipelines}
                    highlighted={highlighted} onSelect={() => handleSelect(item)} />
                );
                if (item.type === "campaign") return (
                  <CampaignResultRow key={item.id} item={item}
                    highlighted={highlighted} onSelect={() => handleSelect(item)} />
                );
                if (item.type === "employee") return (
                  <EmployeeResultRow key={item.id} item={item}
                    highlighted={highlighted} onSelect={() => handleSelect(item)} />
                );
                return null;
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div style={{ borderTop: "1px solid var(--surface-alt)", padding: "8px 16px", display: "flex", gap: 16, fontSize: 11, color: "#9CA3AF" }}>
            <span>↑↓ navegar</span>
            <span>↵ abrir</span>
            <span>Esc fechar</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommandPalette;
