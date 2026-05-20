import React, { useCallback, useMemo, useState } from "react";
import { X, Filter, Search, Download, Sparkles } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { CANONICAL_SECTORS, CANONICAL_STATES } from "../../constants/taxonomy";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { CnpjLookupCard } from "./CnpjLookupCard";
import { ProspectSuggestions } from "./ProspectSuggestions";
import { isSupabaseConfigured } from "../../lib/supabase";
import { exportLeadsToCSV } from "../../utils/export-csv";
import { useUsersById } from "../../hooks/use-users-by-id";

const INITIAL_FILTERS = {
  search: "",
  sector: "",
  state: "",
  size: "",
  fitMin: 0,
};

const SIZE_OPTIONS = ["PME", "Mid-Market", "Enterprise"];

export function ExplorerView({
  leads, users = [], onAddLead, accessibleCompanies, onLoadDemoLeads, onGoToSettings,
}) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const usersById = useUsersById(users);

  const reset = useCallback(() => setFilters(INITIAL_FILTERS), []);

  const activeCount = useMemo(() => (
    Object.entries(filters).reduce((acc, [k, v]) => {
      if (k === "fitMin") return v !== 0 ? acc + 1 : acc;
      return v !== "" ? acc + 1 : acc;
    }, 0)
  ), [filters]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            Explorador de Mercado
          </h1>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            Descubra novos prospects · cruze sinais públicos · adicione ao CRM com um clique
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" icon={X} onClick={reset}>
              Limpar ({activeCount})
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={Download}
            onClick={() => exportLeadsToCSV(leads, { usersById, filename: `sanwey-leads-explorer-${new Date().toISOString().slice(0, 10)}.csv` })}
          >
            Exportar
          </Button>
        </div>
      </div>

      {isSupabaseConfigured && (
        <CnpjLookupCard
          onAddLead={onAddLead}
          accessibleCompanies={accessibleCompanies}
        />
      )}

      {/* Filter card */}
      <div className="p-5 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E8E8E8", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} color={NEUTRAL.graphite} />
          <span className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>
            Filtros da curadoria
          </span>
        </div>
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          <Input
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            placeholder="Empresa ou CNPJ..."
            icon={Search}
            className="md:col-span-2"
          />
          <Select
            value={filters.sector}
            onChange={e => setFilters(prev => ({ ...prev, sector: e.target.value }))}
            placeholder="Todos setores"
            options={CANONICAL_SECTORS}
          />
          <Select
            value={filters.state}
            onChange={e => setFilters(prev => ({ ...prev, state: e.target.value }))}
            placeholder="Todos estados"
            options={CANONICAL_STATES}
          />
          <Select
            value={filters.size}
            onChange={e => setFilters(prev => ({ ...prev, size: e.target.value }))}
            placeholder="Qualquer porte"
            options={SIZE_OPTIONS}
          />
        </div>
        <div className="flex items-center gap-4 flex-wrap pt-3 border-t" style={{ borderColor: "#F0F0F0" }}>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium" style={{ color: NEUTRAL.slate }}>
                Fit mínimo
              </span>
              <span className="font-bold text-sm" style={{ color: NEUTRAL.graphite }}>{filters.fitMin}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={filters.fitMin}
              onChange={e => setFilters(prev => ({ ...prev, fitMin: parseInt(e.target.value, 10) }))}
              className="w-full"
              style={{ accentColor: NEUTRAL.graphite }}
            />
          </div>
        </div>
      </div>

      <ProspectSuggestions
        filters={filters}
        leads={leads}
        accessibleCompanies={accessibleCompanies}
        onAddLead={onAddLead}
      />

      {/* Empty CRM banner */}
      {leads.length === 0 && onLoadDemoLeads && (
        <div
          className="p-4 rounded-xl border flex items-center justify-between gap-3 flex-wrap"
          style={{ background: NEUTRAL.warmWhite || "#FAFAF8", borderColor: "#E8E8E8", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="text-sm" style={{ color: NEUTRAL.slate }}>
            CRM ainda vazio. Carregue dados de demonstração para ver o pipeline completo.
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" icon={Sparkles} onClick={onLoadDemoLeads}>
              Carregar demonstração
            </Button>
            {onGoToSettings && (
              <Button variant="ghost" size="sm" onClick={onGoToSettings}>
                Configurações
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ExplorerView;
