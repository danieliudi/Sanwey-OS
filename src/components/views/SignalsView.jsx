import React, { useCallback, useMemo, useRef, useState } from "react";
import { Bell, Plus, CheckCircle2 } from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { Badge } from "../ui/Badge";
import { CompanyTag } from "../ui/CompanyTag";
import { UrgencyTag } from "../ui/UrgencyTag";
import { EmptyState } from "../ui/EmptyState";

const URGENCY_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "critico", label: "Crítico" },
  { key: "alto", label: "Alto" },
  { key: "medio", label: "Médio" },
  { key: "informativo", label: "Info" },
];

export function SignalsView({ activeCompany, signals, onSignalClick, onAddLead, accessibleCompanies }) {
  const isGroupView = activeCompany === "all";
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [expandedCreate, setExpandedCreate] = useState(null);
  const [createCompany, setCreateCompany] = useState("");
  const [justAdded, setJustAdded] = useState(new Set());
  const createInputRef = useRef(null);

  const handleOpenCreate = useCallback((signalId, e) => {
    e.stopPropagation();
    setCreateCompany("");
    setExpandedCreate(signalId);
    setTimeout(() => createInputRef.current?.focus(), 50);
  }, []);

  const handleCreateLead = useCallback((signal) => {
    if (!createCompany.trim() || !onAddLead) return;
    const validCompanies = (accessibleCompanies || []).filter(id => id !== "all");
    const targetCompany = validCompanies.find(id => id === signal.company)
      || validCompanies[0]
      || signal.company
      || "industria";
    const now = new Date().toISOString();
    onAddLead({
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      companyId: targetCompany,
      company: createCompany.trim(),
      razaoSocial: createCompany.trim(),
      sector: "",
      cnpj: "",
      size: "Mid-Market",
      city: "—",
      state: "—",
      address: "",
      capitalSocial: 0,
      contactEmail: "",
      phone: "",
      situacao: "ATIVA",
      trigger: "Sinal regulatório",
      triggerLabel: signal.source,
      evidence: `${signal.title} — ${signal.excerpt}`,
      fitScore: 60,
      quantity: 0,
      value: 0,
      probability: 0.1,
      closeDate: new Date(Date.now() + 60 * 86400000).toISOString(),
      dateDetected: now,
      daysAgo: 0,
      stage: "prospeccao",
      status: "prospeccao",
      owner: null,
      urgency: signal.urgency === "critico" ? "urgente" : "medio",
      decisionMaker: { name: "—", role: "—" },
      starred: false,
      notes: [],
      createdAt: now,
      lastActivity: now,
      stageChangedAt: now,
    });
    setJustAdded(prev => new Set([...prev, signal.id]));
    setExpandedCreate(null);
    setCreateCompany("");
  }, [createCompany, onAddLead, accessibleCompanies]);

  const scopedSignals = useMemo(() => {
    let s = isGroupView ? signals : signals.filter(x => x.company === activeCompany);
    if (urgencyFilter !== "all") s = s.filter(x => x.urgency === urgencyFilter);
    return s;
  }, [signals, activeCompany, isGroupView, urgencyFilter]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Sinais de Mercado
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            {scopedSignals.length} sinais monitorados · adaptado ao contexto de cada empresa
          </p>
        </div>

        {/* Urgency filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {URGENCY_FILTERS.map(f => {
            const active = urgencyFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setUrgencyFilter(f.key)}
                className="px-3.5 py-1.5 text-sm font-medium rounded-full border transition-all duration-150"
                style={{
                  background: active ? "var(--text)" : "var(--surface)",
                  color: active ? "var(--surface)" : "var(--text-dim)",
                  borderColor: active ? "var(--text)" : "var(--border)",
                  boxShadow: active ? "var(--shadow-pop)" : "none",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.borderColor = "var(--border-strong)";
                    e.currentTarget.style.background = "var(--surface-alt)";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "var(--surface)";
                  }
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Signal cards grid */}
      <div className="grid md:grid-cols-2 gap-3">
        {scopedSignals.map(s => (
          <div
            key={s.id}
            className="p-5 rounded-xl border transition-all duration-150 cursor-pointer"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              borderLeftWidth: 4,
              borderLeftColor: COMPANIES[s.company]?.primary || "var(--text-dim)",
              boxShadow: "var(--shadow-card)",
            }}
            onClick={() => onSignalClick?.(s)}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = "var(--shadow-pop)";
              e.currentTarget.style.borderColor = "var(--border-strong)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = "var(--shadow-card)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" size="sm">{s.source}</Badge>
                {isGroupView && <CompanyTag companyId={s.company} />}
              </div>
              <UrgencyTag urgency={s.urgency} />
            </div>
            <h3 className="font-semibold mb-2 leading-snug" style={{ fontSize: 14, color: "var(--text)" }}>
              {s.title}
            </h3>
            <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-dim)" }}>
              {s.excerpt}
            </p>
            <div
              className="flex items-center justify-between text-xs pt-3 border-t"
              style={{ borderColor: "var(--surface-alt)", color: "var(--text-dim)" }}
            >
              <span>{s.affectedCount} afetad{s.affectedCount === 1 ? "a" : "as"}</span>
              <span>{s.date}</span>
            </div>

            {/* Create lead CTA */}
            {onAddLead && (
              <div className="pt-3 border-t" style={{ borderColor: "var(--surface-alt)" }}>
                {justAdded.has(s.id) ? (
                  <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--success)" }}>
                    <CheckCircle2 size={12} />
                    Lead adicionado ao pipeline
                  </div>
                ) : expandedCreate === s.id ? (
                  <div className="flex gap-2 items-center" onClick={e => e.stopPropagation()}>
                    <input
                      ref={createInputRef}
                      placeholder="Nome da empresa..."
                      value={createCompany}
                      onChange={e => setCreateCompany(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleCreateLead(s);
                        if (e.key === "Escape") setExpandedCreate(null);
                      }}
                      className="flex-1 text-xs rounded-lg border px-2.5 py-1.5 outline-none"
                      style={{ borderColor: "var(--border)", color: "var(--text)" }}
                      onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                    />
                    <button
                      onClick={() => handleCreateLead(s)}
                      disabled={!createCompany.trim()}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-white"
                      style={{ background: "var(--accent)", border: "none", cursor: createCompany.trim() ? "pointer" : "not-allowed", opacity: createCompany.trim() ? 1 : 0.5 }}
                    >
                      Criar
                    </button>
                    <button
                      onClick={() => setExpandedCreate(null)}
                      className="text-xs"
                      style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={e => handleOpenCreate(s.id, e)}
                    className="text-xs font-semibold flex items-center gap-1 transition-colors"
                    style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "0.75"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                  >
                    <Plus size={12} />
                    Criar lead a partir deste sinal
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {scopedSignals.length === 0 && (
        <EmptyState
          icon={Bell}
          title="Nenhum sinal no filtro atual"
          description="Ajuste os filtros para ver mais sinais."
        />
      )}
    </div>
  );
}

export default SignalsView;
