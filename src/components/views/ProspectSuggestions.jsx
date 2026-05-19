import React, { useCallback, useMemo, useState } from "react";
import {
  Sparkles, MapPin, Building2, Plus, CheckCircle2, AlertTriangle, Loader2, Target, Flame, Database,
} from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { Button } from "../ui/Button";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { useProspectSuggestions } from "../../hooks/use-prospect-suggestions";

function formatCnpj(digits) {
  const d = (digits || "").replace(/\D/g, "");
  if (d.length !== 14) return digits || "";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function seedToLead(seed, companyId) {
  const now = new Date().toISOString();
  return {
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    companyId,
    cnpj: formatCnpj(seed.cnpj),
    company: seed.company,
    razaoSocial: seed.razao_social || seed.company,
    sector: seed.sector,
    cnae: "",
    size: seed.size || "Mid-Market",
    city: seed.city || "—",
    state: seed.state || "—",
    address: "",
    capitalSocial: 0,
    contactEmail: "",
    phone: "",
    situacao: "ATIVA",
    trigger: "Sugestão de mercado",
    triggerLabel: "Curadoria Inteligência Sanwey",
    evidence: seed.evidence || "Prospect identificado pela curadoria interna",
    fitScore: seed.fit_score || 65,
    quantity: 0,
    value: 0,
    probability: 0.1,
    closeDate: new Date(Date.now() + 60 * 86400000).toISOString(),
    dateDetected: now,
    daysAgo: 0,
    stage: "prospeccao",
    status: "prospeccao",
    owner: null,
    urgency: "indefinido",
    decisionMaker: { name: "—", role: "—" },
    starred: false,
    notes: [],
    createdAt: now,
    lastActivity: now,
    stageChangedAt: now,
  };
}

function ProspectCard({ seed, accessibleCompanies, existingCnpjByCompany, onAdd }) {
  const [target, setTarget] = useState(() => {
    const preferred = seed.relevant_for?.find(id => accessibleCompanies.includes(id));
    return preferred || accessibleCompanies[0] || null;
  });
  const [added, setAdded] = useState(false);
  // Set é populado com cnpj só-dígitos (linha 216); aqui também precisamos
  // normalizar, senão a chave nunca casa quando o seed traz cnpj formatado.
  const seedDigits = (seed.cnpj || "").replace(/\D/g, "");
  const alreadyInTarget = target && seedDigits && existingCnpjByCompany.has(`${seedDigits}::${target}`);

  const handleAdd = useCallback(() => {
    if (!target || alreadyInTarget) return;
    onAdd(seedToLead(seed, target));
    setAdded(true);
  }, [target, alreadyInTarget, seed, onAdd]);

  return (
    <div
      className="p-4 rounded-xl border flex flex-col gap-3 transition-all duration-150"
      style={{ background: "#FFFFFF", borderColor: "#E8E8E8", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="px-2 py-0.5 text-[10px] font-semibold rounded-full"
              style={{ background: NEUTRAL.graphite, color: "#FFFFFF" }}
            >
              {seed.source === "curadoria" ? "Curadoria" : seed.source}
            </span>
            <span className="text-[10px] font-medium" style={{ color: NEUTRAL.slate }}>
              {seed.sector}
            </span>
          </div>
          <div className="font-bold text-base leading-tight truncate" style={{ color: NEUTRAL.graphite }}>
            {seed.company}
          </div>
          {seed.razao_social && seed.razao_social !== seed.company && (
            <div className="text-xs truncate" style={{ color: NEUTRAL.slate }}>{seed.razao_social}</div>
          )}
          <div className="text-[11px] font-mono mt-0.5" style={{ color: NEUTRAL.slate }}>
            {formatCnpj(seed.cnpj)}
          </div>
        </div>
        <FitScoreCircle score={seed.fit_score || 65} size={44} />
      </div>

      <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: NEUTRAL.slate }}>
        <div className="flex items-center gap-1">
          <MapPin size={11} />
          <span>{seed.city || seed.state}</span>
        </div>
        <div className="flex items-center gap-1">
          <Building2 size={11} />
          <span>{seed.size}</span>
        </div>
        {seed.relevant_for?.length > 0 && (
          <div className="flex items-center gap-1">
            <Target size={11} />
            <span>
              {seed.relevant_for.map(id => COMPANIES[id]?.short || id).join(" · ")}
            </span>
          </div>
        )}
      </div>

      {seed.evidence && (
        <div
          className="text-xs p-2.5 rounded-lg flex gap-2"
          style={{ background: NEUTRAL.warmWhite, color: NEUTRAL.graphite }}
        >
          <Flame size={12} className="shrink-0 mt-0.5" color={NEUTRAL.amber} />
          <span>{seed.evidence}</span>
        </div>
      )}

      {Array.isArray(seed.public_signals) && seed.public_signals.length > 0 && (
        <div className="space-y-1">
          <div
            className="text-[10px] font-semibold flex items-center gap-1"
            style={{ color: NEUTRAL.slate }}
          >
            <Database size={10} />
            Sinais de bases públicas
          </div>
          <div className="flex flex-wrap gap-1">
            {seed.public_signals.map((sig, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-lg border text-[10px] flex items-center gap-1"
                style={{ borderColor: "#E8E8E8", background: "#FAFAF8", color: NEUTRAL.graphite }}
                title={sig.detail || ""}
              >
                <strong style={{ color: NEUTRAL.graphite }}>{sig.source}</strong>
                <span style={{ color: NEUTRAL.slate }}>·</span>
                <span style={{ color: NEUTRAL.slate }}>{sig.label}</span>
                {sig.year && <span style={{ color: NEUTRAL.slate }}>· {sig.year}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {added ? (
        <div
          className="p-2.5 rounded-lg flex items-center gap-2 text-xs"
          style={{ background: "#E8F2EC", color: NEUTRAL.success }}
        >
          <CheckCircle2 size={14} />
          Adicionado como lead em {COMPANIES[target]?.short}. Ver na aba Kanban.
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t" style={{ borderColor: "#EFEFEF" }}>
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {accessibleCompanies.map(id => {
              const c = COMPANIES[id];
              if (!c) return null;
              const active = target === id;
              const suggested = seed.relevant_for?.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTarget(id)}
                  className="px-2.5 py-1 text-[11px] rounded-full border transition-all flex items-center gap-1"
                  style={{
                    background: active ? c.light : "#FFFFFF",
                    borderColor: active ? c.primary : "#EFEFEF",
                    color: active ? c.dark : NEUTRAL.graphite,
                    fontWeight: active ? 700 : 500,
                  }}
                  title={suggested ? "Sugestão de fit" : ""}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.primary }} />
                  <span>{c.short}</span>
                  {suggested && <Sparkles size={9} color={NEUTRAL.gold} />}
                </button>
              );
            })}
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={alreadyInTarget ? AlertTriangle : Plus}
            onClick={handleAdd}
            disabled={!target || alreadyInTarget}
          >
            {alreadyInTarget ? "Já existe" : "Adicionar"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ProspectSuggestions({ filters, leads, accessibleCompanies, onAddLead }) {
  const { loading, error, seeds, reload } = useProspectSuggestions();

  const existingCnpjByCompany = useMemo(() => {
    const set = new Set();
    leads.forEach(l => {
      const digits = (l.cnpj || "").replace(/\D/g, "");
      if (digits) set.add(`${digits}::${l.companyId}`);
    });
    return set;
  }, [leads]);

  const availableCompanies = useMemo(
    () => (accessibleCompanies || COMPANY_IDS).filter(id => id !== "all"),
    [accessibleCompanies],
  );

  const filtered = useMemo(() => {
    const searchLower = (filters?.search || "").trim().toLowerCase();
    return seeds.filter(s => {
      if (searchLower) {
        const hay = `${s.company} ${s.razao_social || ""} ${s.cnpj}`.toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }
      if (filters?.sector && s.sector !== filters.sector) return false;
      if (filters?.state && s.state !== filters.state) return false;
      if (filters?.size && s.size !== filters.size) return false;
      if (filters?.fitMin && (s.fit_score || 0) < filters.fitMin) return false;
      return true;
    });
  }, [seeds, filters]);

  const visible = useMemo(() => filtered.slice(0, 30), [filtered]);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "#FFFFFF", borderColor: "#E8E8E8", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div
        className="px-4 py-3.5 border-b flex items-center justify-between gap-3 flex-wrap"
        style={{ background: "#F7F7F5", borderColor: "#F0F0F0" }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} color={NEUTRAL.graphite} />
          <span className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>
            Sugestões de prospecção
          </span>
          <span className="text-xs" style={{ color: NEUTRAL.slate }}>
            · {filtered.length} candidatas
          </span>
        </div>
        <div className="text-[11px]" style={{ color: NEUTRAL.slate }}>
          CNAE/UF · ComexStat · BNDES · IBGE · IBAMA · ANP · ANDA · SNIC
        </div>
      </div>

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-sm" style={{ color: NEUTRAL.slate }}>
          <Loader2 size={14} className="animate-spin" />
          Carregando sugestões…
        </div>
      ) : error ? (
        <div className="p-6 flex items-start gap-2 text-xs" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold mb-1">Não foi possível carregar sugestões</div>
            <div>{error.message || String(error)}</div>
            <button className="underline mt-1" onClick={reload}>Tentar de novo</button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 px-6 text-center text-sm" style={{ color: NEUTRAL.slate }}>
          Nenhuma sugestão bate com os filtros atuais. Relaxe o filtro ou limpe para ver todas.
        </div>
      ) : (
        <>
          <div className="p-4 grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visible.map(seed => (
              <ProspectCard
                key={seed.id}
                seed={seed}
                accessibleCompanies={availableCompanies}
                existingCnpjByCompany={existingCnpjByCompany}
                onAdd={onAddLead}
              />
            ))}
          </div>
          {filtered.length > 30 && (
            <div
              className="px-4 py-3 text-center text-xs border-t"
              style={{ color: NEUTRAL.slate, background: "#F7F7F5", borderColor: "#F0F0F0" }}
            >
              Mostrando 30 de {filtered.length} sugestões · refine os filtros
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ProspectSuggestions;
