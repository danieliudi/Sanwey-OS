import React, { useCallback, useMemo, useState } from "react";
import { X, Filter, Search, Download, Sparkles, Upload } from "lucide-react";
import { CANONICAL_SECTORS, CANONICAL_STATES } from "../../constants/taxonomy";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { CnpjLookupCard } from "./CnpjLookupCard";
import { ProspectSuggestions } from "./ProspectSuggestions";
import { isSupabaseConfigured } from "../../lib/supabase";
import { exportLeadsToCSV } from "../../utils/export-csv";
import { logExport } from "../../utils/log-export";
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
              onClick={() => {
                exportLeadsToCSV(leads, { usersById, filename: `sanwey-leads-explorer-${new Date().toISOString().slice(0, 10)}.csv` });
                logExport(currentUser?.id, "leads_explorer", leads.length);
              }}
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
        <div className={`p-4 rounded-xl border${!isSupabaseConfigured ? " lg:col-span-2" : ""}`} style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Filter size={13} color="var(--text-dim)" />
            <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>Filtros da curadoria</span>
            {activeCount > 0 && (
              <button onClick={reset} className="ml-auto text-xs" style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Limpar ({activeCount})
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
            <input
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Empresa ou CNPJ..."
              className="w-full text-xs rounded-lg pl-7 pr-3 py-2 border outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border)"; }}
            />
          </div>

          {/* Pill filters row */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              { key: "sector", placeholder: "Setor", options: CANONICAL_SECTORS },
              { key: "state",  placeholder: "UF",    options: CANONICAL_STATES },
              { key: "size",   placeholder: "Porte", options: SIZE_OPTIONS },
            ].map(({ key, placeholder, options }) => {
              const active = filters[key] !== "";
              return (
                <select
                  key={key}
                  value={filters[key]}
                  onChange={e => setFilters(prev => ({ ...prev, [key]: e.target.value }))}
                  className="text-xs rounded-full border outline-none cursor-pointer"
                  style={{
                    padding: "3px 24px 3px 10px",
                    borderColor: active ? "var(--accent)" : "var(--border)",
                    background: active ? "color-mix(in srgb, var(--accent) 8%, var(--surface))" : "var(--surface)",
                    color: active ? "var(--accent)" : "var(--text-dim)",
                    fontWeight: active ? 600 : 400,
                    appearance: "none",
                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 6px center",
                    backgroundSize: "11px",
                  }}
                >
                  <option value="">{placeholder}</option>
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              );
            })}
          </div>

          {/* Fit mínimo compact */}
          <div className="flex items-center gap-2">
            <span className="text-xs shrink-0" style={{ color: "var(--text-dim)" }}>Fit min</span>
            <input
              type="range" min="0" max="100" step="5"
              value={filters.fitMin}
              onChange={e => setFilters(prev => ({ ...prev, fitMin: parseInt(e.target.value, 10) }))}
              className="flex-1"
              style={{ accentColor: "var(--accent)", height: 4 }}
            />
            <span className="text-xs font-bold w-6 text-right shrink-0" style={{ color: filters.fitMin > 0 ? "var(--accent)" : "var(--text-faint)" }}>
              {filters.fitMin}
            </span>
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
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
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
