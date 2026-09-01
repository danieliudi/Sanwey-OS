import { ClientSelector } from "../client/ClientSelector";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Bell, Plus, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { CompanyTag } from "../ui/CompanyTag";
import { UrgencyTag } from "../ui/UrgencyTag";
import { StatCard } from "../ui/StatCard";
import { EmptyState } from "../ui/EmptyState";
import { Card, CardGrid, GridListToggle } from "../shared/Card";
import { FilterBar } from "../shared/FilterBar";

const URGENCY_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "critico", label: "Crítico" },
  { key: "alto", label: "Alto" },
  { key: "medio", label: "Médio" },
  { key: "informativo", label: "Info" },
];

// Cores do ponto de status na densidade lista — mesma paridade semântica das
// variantes de Badge usadas por UrgencyTag (critical/urgent/gold/neutral),
// só expostas como cor sólida porque a densidade lista não renderiza badge
// cheio (Card.jsx, ver `status`).
const URGENCY_STATUS_COLOR = {
  critico: "var(--danger)",
  alto: "var(--warning)",
  medio: "var(--amber)",
  informativo: "var(--text-faint)",
};

const URGENCY_STATUS_LABEL = {
  critico: "Crítico",
  alto: "Alto",
  medio: "Médio",
  informativo: "Info",
};

export function SignalsView({ activeCompany, signals, clients = [], onAddLead, accessibleCompanies }) {
  const isGroupView = activeCompany === "all";
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [density, setDensity] = useState("grid");
  const [expandedCreate, setExpandedCreate] = useState(null);
  const [createCompany, setCreateCompany] = useState("");
  const [createClientId, setCreateClientId] = useState(null);
  // true = a empresa não está na base e a pessoa vai digitar o nome na mão
  const [creatingNew,   setCreatingNew]   = useState(false);
  const [justAdded, setJustAdded] = useState(new Set());
  const createInputRef = useRef(null);

  const handleOpenCreate = useCallback((signalId, e) => {
    e.stopPropagation();
    setCreateCompany("");
    setCreateClientId(null);
    setCreatingNew(false);
    setExpandedCreate(signalId);
    setTimeout(() => createInputRef.current?.focus(), 50);
  }, []);

  // Cliente já cadastrado escolhido no seletor (ver ClientSelector). O campo
  // de texto livre continua existindo como saída — sinal regulatório costuma
  // apontar pra empresa que AINDA não está na base, e obrigar cadastro antes
  // seria trocar um problema por outro.
  const selectedClient = clients.find(c => c.id === createClientId) || null;

  const handleCreateLead = useCallback((signal) => {
    const nome = (selectedClient?.name || createCompany).trim();
    if (!nome || !onAddLead) return;
    const validCompanies = (accessibleCompanies || []).filter(id => id !== "all");
    const targetCompany = validCompanies.find(id => id === signal.company)
      || validCompanies[0]
      || signal.company
      || "industria";
    const now = new Date().toISOString();
    onAddLead({
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      companyId: targetCompany,
      // Com cliente escolhido, o lead nasce com CNPJ/setor/cidade da base em
      // vez de campos vazios — e vinculado, então não vira um 2º cadastro da
      // mesma empresa (o mesmo dedup por CNPJ que o Funil já faz).
      clientId: selectedClient?.id || null,
      company: nome,
      razaoSocial: selectedClient?.razaoSocial || nome,
      sector: selectedClient?.sector || "",
      cnpj: selectedClient?.cnpj || "",
      size: "Mid-Market",
      city: selectedClient?.city || "—",
      state: selectedClient?.state || "—",
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
  }, [createCompany, selectedClient, onAddLead, accessibleCompanies]);

  const scopedSignals = useMemo(() => {
    let s = isGroupView ? signals : signals.filter(x => x.company === activeCompany);
    if (urgencyFilter !== "all") s = s.filter(x => x.urgency === urgencyFilter);
    return s;
  }, [signals, activeCompany, isGroupView, urgencyFilter]);

  const criticalCount = useMemo(() => scopedSignals.filter(s => s.urgency === "critico").length, [scopedSignals]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Sinais de Mercado
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            Sinais regulatórios e de mercado, adaptados ao contexto de cada empresa.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard icon={Bell} value={scopedSignals.length} label="Sinais monitorados" />
        <StatCard
          icon={AlertTriangle}
          value={criticalCount}
          label="Sinais críticos"
          accent={criticalCount > 0 ? "var(--warning)" : undefined}
        />
      </div>

      <FilterBar
        trailing={<GridListToggle value={density} onChange={setDensity} />}
      >
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
      </FilterBar>

      {scopedSignals.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nenhum sinal no filtro atual"
          description="Ajuste os filtros para ver mais sinais."
        />
      ) : (
        <CardGrid density={density}>
          {scopedSignals.map(s => (
            <Card
              key={s.id}
              density={density}
              icon={<Bell size={16} color="#FFFFFF" />}
              iconBg={COMPANIES[s.company]?.primary || "var(--text-dim)"}
              title={s.title}
              meta={s.source}
              badges={
                <>
                  {isGroupView && <CompanyTag companyId={s.company} />}
                  <UrgencyTag urgency={s.urgency} />
                </>
              }
              status={{ color: URGENCY_STATUS_COLOR[s.urgency], label: URGENCY_STATUS_LABEL[s.urgency] }}
              footer={s.date}
            >
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
                {s.excerpt}
              </p>

              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-xs font-semibold w-fit"
                  style={{ color: "var(--accent)" }}
                >
                  <ExternalLink size={11} />
                  Ver fonte
                </a>
              )}

              {onAddLead && (
                <div className="pt-3 border-t" style={{ borderColor: "var(--surface-alt)" }}>
                  {justAdded.has(s.id) ? (
                    <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--success)" }}>
                      <CheckCircle2 size={12} />
                      Lead adicionado ao pipeline
                    </div>
                  ) : expandedCreate === s.id ? (
                    <div className="flex gap-2 items-center" onClick={e => e.stopPropagation()}>
                      {creatingNew ? (
                        <input
                          ref={createInputRef}
                          placeholder="Nome da empresa nova…"
                          value={createCompany}
                          onChange={e => setCreateCompany(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleCreateLead(s);
                            if (e.key === "Escape") setExpandedCreate(null);
                          }}
                          // `min-w-0`: item flex tem `min-width: auto` por
                          // padrão, e a largura intrínseca de um <input> é a do
                          // atributo `size` (20 caracteres). Sem isto ele não
                          // encolhe, e o botão "Cancelar" era empurrado pra fora
                          // da borda do card (bug reportado pelo Daniel).
                          className="flex-1 min-w-0 text-xs rounded-lg border px-2.5 py-1.5 outline-none"
                          style={{ borderColor: "var(--border)", color: "var(--text)" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                        />
                      ) : (
                        <div className="flex-1 min-w-0">
                          <ClientSelector
                            value={createClientId}
                            clients={clients}
                            onChange={setCreateClientId}
                            onCreate={() => { setCreatingNew(true); setTimeout(() => createInputRef.current?.focus(), 50); }}
                          />
                        </div>
                      )}
                      <button
                        onClick={() => handleCreateLead(s)}
                        disabled={!(selectedClient || createCompany.trim())}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-white shrink-0"
                        style={{ background: "var(--accent)", border: "none", cursor: (selectedClient || createCompany.trim()) ? "pointer" : "not-allowed", opacity: (selectedClient || createCompany.trim()) ? 1 : 0.5 }}
                      >
                        Criar
                      </button>
                      <button
                        onClick={() => setExpandedCreate(null)}
                        className="text-xs shrink-0"
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
            </Card>
          ))}
        </CardGrid>
      )}
    </div>
  );
}

export default SignalsView;
