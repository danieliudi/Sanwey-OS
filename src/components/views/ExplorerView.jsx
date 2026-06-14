import React, { useCallback, useMemo, useState } from "react";
import { X, Filter, Search, Download, Sparkles, Upload } from "lucide-react";
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
import { ImportModal } from "../lead/ImportModal";

const INITIAL_FILTERS = {
  search: "",
  sector: "",
  state: "",
  size: "",
  fitMin: 0,
};

const SIZE_OPTIONS = ["PME", "Mid-Market", "Enterprise"];

export function ExplorerView({
  leads, users = [], currentUser, onAddLead, accessibleCompanies, onLoadDemoLeads, onGoToSettings,
  fairImportPanel,
}) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState("explorador");
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
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Explorador de Mercado
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            Descubra novos prospects · cruze sinais públicos · adicione ao CRM com um clique
          </p>
        </div>
        {(!fairImportPanel || activeTab === "explorador") && (
          <div className="flex items-center gap-2 flex-wrap">
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" icon={X} onClick={reset}>
                Limpar ({activeCount})
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={() => setShowImport(true)}
            >
              Importar planilha
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Upload}
              onClick={() => exportLeadsToCSV(leads, { usersById, filename: `sanwey-leads-explorer-${new Date().toISOString().slice(0, 10)}.csv` })}
            >
              Exportar
            </Button>
          </div>
        )}
      </div>

      {/* Tab bar — only when fair import panel is available */}
      {fairImportPanel && (
        <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border)" }}>
          {[
            { id: "explorador", label: "Explorador" },
            { id: "feira",      label: "Importar feira" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 transition-all cursor-pointer"
              style={{
                color: activeTab === t.id ? "var(--text)" : "var(--text-dim)",
                borderBottomColor: activeTab === t.id ? "var(--accent)" : "transparent",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${activeTab === t.id ? "var(--accent)" : "transparent"}`,
                letterSpacing: "0.08em",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Fair import tab content */}
      {fairImportPanel && activeTab === "feira" && fairImportPanel}

      {/* Explorador content */}
      {(!fairImportPanel || activeTab === "explorador") && (
      <>
      {/* CNPJ lookup + Filters side by side */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        {isSupabaseConfigured && (
          <CnpjLookupCard
            onAddLead={onAddLead}
            accessibleCompanies={accessibleCompanies}
          />
        )}

        {/* Filter card */}
        <div className={`p-4 rounded-xl border${!isSupabaseConfigured ? " lg:col-span-2" : ""}`} style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Filter size={13} color="var(--text)" />
            <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
              Filtros da curadoria
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Input
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Empresa ou CNPJ..."
              icon={Search}
              className="col-span-2"
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
              className="col-span-2"
            />
          </div>
          <div className="pt-3 border-t" style={{ borderColor: "#F0F0F0" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium" style={{ color: "var(--text-dim)" }}>
                Fit mínimo
              </span>
              <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{filters.fitMin}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={filters.fitMin}
              onChange={e => setFilters(prev => ({ ...prev, fitMin: parseInt(e.target.value, 10) }))}
              className="w-full"
              style={{ accentColor: "var(--text)" }}
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

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        users={users}
        currentUser={currentUser}
        onAddLead={onAddLead}
        companies={accessibleCompanies || []}
      />

      {/* Empty CRM banner */}
      {leads.length === 0 && onLoadDemoLeads && (
        <div
          className="p-4 rounded-xl border flex items-center justify-between gap-3 flex-wrap"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="text-sm" style={{ color: "var(--text-dim)" }}>
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
      </>
      )}
    </div>
  );
}

export default ExplorerView;
