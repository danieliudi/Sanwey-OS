import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a stable color for a company initial badge, based on companyId. */
function companyBadgeStyle(companyId) {
  const c = COMPANIES[companyId];
  if (c) return { background: c.primary, color: "#FFFFFF" };
  // fallback: graphite
  return { background: NEUTRAL.graphite, color: "#FFFFFF" };
}

/** First letter of the company name (upper-cased). */
function companyInitial(company = "") {
  return (company.trim()[0] || "?").toUpperCase();
}

// ---------------------------------------------------------------------------
// LeadResultRow
// ---------------------------------------------------------------------------

function LeadResultRow({ lead, users, pipelines, highlighted, onSelect }) {
  // Resolve owner
  const owner = useMemo(
    () => (users || []).find((u) => u.id === lead.owner),
    [users, lead.owner]
  );

  // Resolve stage name from the lead's companyId pipeline
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
      style={{
        background: highlighted ? "#F5F4F2" : "transparent",
        transition: "background 100ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#F5F4F2";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = highlighted ? "#F5F4F2" : "transparent";
      }}
    >
      {/* Company initial badge */}
      <div
        className="shrink-0 flex items-center justify-center rounded-lg font-bold select-none"
        style={{
          width: 36,
          height: 36,
          fontSize: 15,
          ...badgeStyle,
        }}
      >
        {companyInitial(lead.company)}
      </div>

      {/* Middle: company name + stage */}
      <div className="flex-1 min-w-0">
        <div
          className="font-semibold truncate"
          style={{ fontSize: 14, color: NEUTRAL.graphite }}
        >
          {lead.company}
        </div>
        <div
          className="text-xs truncate mt-0.5"
          style={{ color: "#8A8680" }}
        >
          {stageName}
          {lead.sector ? ` · ${lead.sector}` : ""}
        </div>
      </div>

      {/* Right: owner initials */}
      {owner && (
        <div
          className="shrink-0 flex items-center justify-center rounded-full text-white font-semibold select-none"
          style={{
            width: 28,
            height: 28,
            fontSize: 11,
            background: owner.avatarBg || NEUTRAL.graphite,
          }}
          title={owner.name}
        >
          {owner.initials || (owner.name || "?")[0].toUpperCase()}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------

/**
 * Global search command palette.
 *
 * Props:
 *   open           – boolean, whether the palette is visible
 *   onClose        – () => void
 *   leads          – Lead[]
 *   users          – User[]
 *   pipelines      – { [companyId]: Stage[] }
 *   onSelectLead   – (lead) => void
 */
export function CommandPalette({ open, onClose, leads, users, pipelines, onSelectLead }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Reset state whenever the palette opens/closes
  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      // Focus input after paint
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Close on Escape; arrow navigation; enter to select
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, (results.length || 1) - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        if (results[cursor]) {
          handleSelect(results[cursor]);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cursor]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (leads || [])
      .filter((lead) => {
        const ownerUser = (users || []).find((u) => u.id === lead.owner);
        const ownerName = ownerUser?.name || "";
        return (
          lead.company?.toLowerCase().includes(q) ||
          lead.sector?.toLowerCase().includes(q) ||
          ownerName.toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [query, leads, users]);

  // Keep cursor in bounds when results change
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(results.length - 1, 0)));
  }, [results]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const highlighted = listRef.current.querySelector("[aria-selected='true']");
    highlighted?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const handleSelect = useCallback(
    (lead) => {
      onSelectLead?.(lead);
      onClose?.();
    },
    [onSelectLead, onClose]
  );

  if (!open) return null;

  const trimmedQuery = query.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{
        paddingTop: 80,
        background: "rgba(44,44,43,0.5)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Busca global"
    >
      {/* Card */}
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: 560,
          borderRadius: 16,
          background: "#FFFFFF",
          border: "1px solid #E5E0DA",
          boxShadow: "0 24px 64px rgba(44,44,43,0.20)",
          overflow: "hidden",
          maxHeight: "calc(100vh - 120px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4"
          style={{
            height: 56,
            borderBottom: "1px solid #E5E0DA",
          }}
        >
          <Search size={18} style={{ color: "#8A8680", shrink: 0, flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="Buscar lead, empresa, setor..."
            className="flex-1 outline-none bg-transparent"
            style={{
              fontSize: 16,
              color: NEUTRAL.graphite,
              border: "none",
            }}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls="cmd-results"
          />
        </div>

        {/* Results list */}
        <div
          id="cmd-results"
          ref={listRef}
          role="listbox"
          style={{ overflowY: "auto", maxHeight: 400 }}
        >
          {trimmedQuery === "" && (
            <div
              className="flex items-center justify-center py-10"
              style={{ color: "#8A8680", fontSize: 14 }}
            >
              Digite para buscar...
            </div>
          )}

          {trimmedQuery !== "" && results.length === 0 && (
            <div
              className="flex items-center justify-center py-10"
              style={{ color: "#8A8680", fontSize: 14 }}
            >
              Nenhum resultado
            </div>
          )}

          {results.map((lead, idx) => (
            <LeadResultRow
              key={lead.id}
              lead={lead}
              users={users}
              pipelines={pipelines}
              highlighted={idx === cursor}
              onSelect={() => handleSelect(lead)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
