import React, { useEffect, useState } from "react";
import { X, Loader2, Building2 } from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { Badge } from "../ui/Badge";
import { CompanyTag } from "../ui/CompanyTag";
import { UrgencyTag } from "../ui/UrgencyTag";

export function SignalDetailDrawer({ signal, onClose, onAddLead, currentUser }) {
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!signal) return;
    setSelected(new Set());
    setError(null);
  }, [signal?.id]);

  useEffect(() => {
    if (!signal) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [signal, onClose]);

  if (!signal) return null;

  const companies = signal.affectedCompanies || [];
  const isSample = signal.affectedCount > companies.length;
  const countLabel = isSample
    ? `Mostrando ${companies.length} de ${signal.affectedCount}`
    : `${companies.length} empresa${companies.length !== 1 ? "s" : ""}`;

  const allSelected = companies.length > 0 && selected.size === companies.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(companies.map((_, i) => i)));
    }
  };

  const toggleOne = (idx) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      const closeDate = new Date(Date.now() + 30 * 86400000).toISOString();
      for (const idx of selected) {
        const c = companies[idx];
        await onAddLead({
          id: crypto.randomUUID(),
          company: c.name,
          cnpj: c.cnpj,
          sector: c.sector,
          city: c.city,
          state: c.state,
          companyId: signal.company,
          stage: "prospeccao",
          status: "prospeccao",
          owner: currentUser?.id || null,
          trigger: signal.source,
          triggerLabel: signal.title,
          evidence: signal.excerpt,
          value: 0,
          probability: 10,
          fitScore: 0,
          starred: false,
          notes: [],
          daysAgo: 0,
          dateDetected: now.toISOString(),
          createdAt: now.toISOString(),
          lastActivity: now.toISOString(),
          stageChangedAt: now.toISOString(),
          closeDate,
          decisionMaker: { name: "—", role: "—" },
          customFields: {},
        });
      }
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar leads.");
      setSaving(false);
    }
  };

  const selCount = selected.size;
  const company = COMPANIES[signal.company];
  const accentColor = company?.primary || "var(--text)";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 md:p-6"
      style={{ background: "var(--overlay-scrim)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl max-h-full flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "#FFFFFF", boxShadow: "var(--shadow-pop)", maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-5 py-3.5 border-b flex items-center justify-between shrink-0"
          style={{ background: "rgba(250,250,248,0.97)", borderColor: "#E5E7EB", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default" size="sm">{signal.source}</Badge>
            <CompanyTag companyId={signal.company} />
            <UrgencyTag urgency={signal.urgency} />
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>{signal.date}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors duration-150 cursor-pointer shrink-0"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F1F3F5"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Signal info */}
          <div className="border rounded-xl p-4 bg-white" style={{ borderColor: "#E5E7EB" }}>
            <h2 className="font-bold mb-2 leading-snug" style={{ fontSize: 18, color: "var(--text)" }}>
              {signal.title}
            </h2>
            <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-dim)" }}>
              {signal.excerpt}
            </p>
            {company && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-dim)" }}>
                <Building2 size={11} />
                <span>Contexto:</span>
                <CompanyTag companyId={signal.company} />
              </div>
            )}
          </div>

          {/* Affected companies header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="font-semibold uppercase"
                style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.08em" }}
              >
                Empresas afetadas
              </span>
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                · {countLabel}
              </span>
            </div>
            {companies.length > 0 && (
              <button
                onClick={toggleAll}
                className="text-xs font-semibold cursor-pointer transition-colors"
                style={{ color: accentColor, background: "transparent", border: "none" }}
              >
                {allSelected ? "Limpar seleção" : "Selecionar todas"}
              </button>
            )}
          </div>

          {/* Company list */}
          <div className="space-y-2">
            {companies.map((c, idx) => {
              const isChosen = selected.has(idx);
              return (
                <div
                  key={idx}
                  onClick={() => toggleOne(idx)}
                  className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-100"
                  style={{
                    background: isChosen ? "#F0FDF4" : "#FFFFFF",
                    borderColor: isChosen ? "#86EFAC" : "#E5E7EB",
                    borderLeftWidth: 3,
                    borderLeftColor: isChosen ? "var(--color-resibag)" : "#E5E7EB",
                  }}
                >
                  {/* Checkbox */}
                  <div
                    className="shrink-0 flex items-center justify-center rounded"
                    style={{
                      width: 18,
                      height: 18,
                      background: isChosen ? "var(--color-resibag)" : "#F1F3F5",
                      border: `2px solid ${isChosen ? "var(--color-resibag)" : "#D1D5DB"}`,
                    }}
                  >
                    {isChosen && (
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <polyline
                          points="1.5,5 4,7.5 8.5,2"
                          stroke="white"
                          strokeWidth="1.8"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate" style={{ fontSize: 13, color: "var(--text)" }}>
                      {c.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>{c.cnpj}</span>
                      <span className="text-xs" style={{ color: "var(--text-dim)" }}>·</span>
                      <span className="text-xs" style={{ color: "var(--text-dim)" }}>{c.city}, {c.state}</span>
                    </div>
                  </div>

                  {/* Sector badge */}
                  <span
                    className="text-xs px-2 py-0.5 rounded shrink-0"
                    style={{ background: "#F1F3F5", color: "var(--text-dim)", fontSize: 11 }}
                  >
                    {c.sector}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div
              className="p-3 rounded-xl text-sm"
              style={{ background: "#FBE9EB", color: "#B91C1C", border: "1px solid #F5C6CB" }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 px-5 py-3.5 border-t flex items-center justify-between gap-3 shrink-0"
          style={{ background: "rgba(250,250,248,0.97)", borderColor: "#E5E7EB", backdropFilter: "blur(8px)" }}
        >
          <span className="text-sm" style={{ color: "var(--text-dim)" }}>
            {selCount === 0
              ? "Nenhuma empresa selecionada"
              : `${selCount} empresa${selCount !== 1 ? "s" : ""} selecionada${selCount !== 1 ? "s" : ""}`}
          </span>
          <button
            onClick={handleCreate}
            disabled={selCount === 0 || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150"
            style={{
              background: selCount === 0 || saving ? "#E5E7EB" : "var(--color-industria)",
              color: selCount === 0 || saving ? "var(--text-dim)" : "#FFFFFF",
              border: "none",
              cursor: selCount === 0 || saving ? "not-allowed" : "pointer",
            }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Criar {selCount > 0 ? selCount : ""} lead{selCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SignalDetailDrawer;
