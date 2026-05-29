import React, { useCallback } from "react";
import { RotateCcw, Check, AlertTriangle, Trash2, Database, Sparkles } from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import {
  DASHBOARD_WIDGETS, NOTIFICATION_PREFS, DENSITY_OPTIONS,
} from "../../constants/user-settings";
import { Button } from "../ui/Button";

function Section({ title, description, children }) {
  return (
    <div
      className="p-5 rounded-xl border"
      style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="mb-4">
        <h2 className="font-semibold" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
          {title}
        </h2>
        {description && (
          <p className="text-xs mt-1 leading-relaxed" style={{ color: NEUTRAL.slate }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ checked, onChange, label, sublabel, disabled }) {
  return (
    <label
      className="flex items-center justify-between gap-3 py-2.5 cursor-pointer"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <div>
        <div className="text-sm font-medium" style={{ color: NEUTRAL.graphite }}>{label}</div>
        {sublabel && (
          <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>{sublabel}</div>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-4 h-4 cursor-pointer"
        style={{ accentColor: NEUTRAL.graphite }}
      />
    </label>
  );
}

export function SettingsView({
  settings, onUpdate, onReset, onClearLocalData, currentUser,
  leadsCount = 0, onLoadDemoLeads, onClearAllLeads,
}) {
  const toggleCompany = useCallback((id) => {
    const has = settings.enabledCompanies.includes(id);
    const next = has
      ? settings.enabledCompanies.filter(c => c !== id)
      : [...settings.enabledCompanies, id];
    if (next.length === 0) return;
    onUpdate({ enabledCompanies: next });
  }, [settings.enabledCompanies, onUpdate]);

  const toggleWidget = useCallback((id) => {
    const has = settings.visibleDashboardWidgets.includes(id);
    onUpdate({
      visibleDashboardWidgets: has
        ? settings.visibleDashboardWidgets.filter(w => w !== id)
        : [...settings.visibleDashboardWidgets, id],
    });
  }, [settings.visibleDashboardWidgets, onUpdate]);

  const toggleStage = useCallback((id) => {
    const has = settings.visibleKanbanStages.includes(id);
    const next = has
      ? settings.visibleKanbanStages.filter(s => s !== id)
      : [...settings.visibleKanbanStages, id];
    if (next.length === 0) return;
    onUpdate({ visibleKanbanStages: next });
  }, [settings.visibleKanbanStages, onUpdate]);

  const toggleNotification = useCallback((id) => {
    onUpdate({
      notifications: {
        ...settings.notifications,
        [id]: !settings.notifications[id],
      },
    });
  }, [settings.notifications, onUpdate]);

  const handleClearLocal = useCallback(() => {
    if (window.confirm("Isso vai apagar leads, configurações e sessão local. Continuar?")) {
      onClearLocalData();
    }
  }, [onClearLocalData]);

  const handleLoadDemo = useCallback(() => {
    const proceed = leadsCount === 0
      ? true
      : window.confirm("Isso vai substituir os leads atuais pelo conjunto de demonstração. Continuar?");
    if (proceed) onLoadDemoLeads?.();
  }, [leadsCount, onLoadDemoLeads]);

  const handleClearLeads = useCallback(() => {
    if (leadsCount === 0) return;
    if (window.confirm(`Remover todos os ${leadsCount} leads? Esta ação não pode ser desfeita.`)) {
      onClearAllLeads?.();
    }
  }, [leadsCount, onClearAllLeads]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            Configurações
          </h1>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            Preferências pessoais de exibição, empresas ativas e notificações
          </p>
        </div>
        <Button variant="ghost" icon={RotateCcw} onClick={onReset}>
          Restaurar padrão
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Empresas ativas */}
        <Section
          title="Empresas ativas"
          description="Quais empresas aparecem no seletor do topo e nos filtros do app."
        >
          <div className="grid grid-cols-2 gap-2">
            {COMPANY_IDS.map(id => {
              const c = COMPANIES[id];
              const enabled = settings.enabledCompanies.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleCompany(id)}
                  className="p-3 rounded-lg border flex items-center gap-2.5 transition-all duration-150 text-left"
                  style={{
                    background: enabled ? c.light : "#FAFAFA",
                    borderColor: enabled ? c.primary + "80" : "#E5E7EB",
                    boxShadow: enabled ? `0 0 0 1px ${c.primary}40` : "none",
                  }}
                  onMouseEnter={e => {
                    if (!enabled) {
                      e.currentTarget.style.borderColor = "#D0D0D0";
                      e.currentTarget.style.background = "#F5F5F3";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!enabled) {
                      e.currentTarget.style.borderColor = "#E5E7EB";
                      e.currentTarget.style.background = "#FAFAFA";
                    }
                  }}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.primary }} />
                  <span
                    className="font-medium text-sm flex-1 leading-tight"
                    style={{ color: enabled ? c.dark : NEUTRAL.graphite }}
                  >
                    {c.name}
                  </span>
                  {enabled && <Check size={13} color={c.primary} />}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Widgets */}
        <Section
          title="Widgets do Dashboard"
          description="Quais StatCards aparecem no topo do Dashboard."
        >
          <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
            {DASHBOARD_WIDGETS.map(w => (
              <ToggleRow
                key={w.id}
                label={w.label}
                checked={settings.visibleDashboardWidgets.includes(w.id)}
                onChange={() => toggleWidget(w.id)}
              />
            ))}
          </div>
        </Section>

        {/* Kanban stages */}
        <Section
          title="Etapas visíveis no Kanban"
          description="Esconda etapas que você não usa no dia a dia."
        >
          <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
            {DEFAULT_PIPELINE_STAGES.map(s => (
              <ToggleRow
                key={s.id}
                label={s.name}
                checked={settings.visibleKanbanStages.includes(s.id)}
                onChange={() => toggleStage(s.id)}
              />
            ))}
          </div>
        </Section>

        {/* Notifications */}
        <Section
          title="Notificações"
          description="Alertas visuais dentro do app."
        >
          <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
            {NOTIFICATION_PREFS.map(n => (
              <ToggleRow
                key={n.id}
                label={n.label}
                checked={Boolean(settings.notifications[n.id])}
                onChange={() => toggleNotification(n.id)}
              />
            ))}
          </div>
        </Section>

        {/* Density */}
        <Section
          title="Densidade"
          description="Ajusta o espaçamento geral da interface."
        >
          <div className="flex gap-2">
            {DENSITY_OPTIONS.map(opt => {
              const active = settings.density === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdate({ density: opt.value })}
                  className="px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-150"
                  style={{
                    background: active ? NEUTRAL.graphite : "#FFFFFF",
                    color: active ? "#FFFFFF" : NEUTRAL.slate,
                    borderColor: active ? NEUTRAL.graphite : "#E5E7EB",
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.borderColor = "#B0B0B0";
                      e.currentTarget.style.background = "#F5F5F5";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.borderColor = "#E5E7EB";
                      e.currentTarget.style.background = "#FFFFFF";
                    }
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Conta */}
        <Section
          title="Conta"
          description={currentUser ? `Logado como ${currentUser.name} · ${currentUser.email}` : ""}
        >
          <p className="text-xs leading-relaxed" style={{ color: NEUTRAL.slate }}>
            Login/senha e privacidade de dados estão disponíveis via Supabase (ver README).
            Ainda não há tela de troca de senha no front — use o painel do Supabase ou recovery por e-mail.
          </p>
        </Section>

        {/* Dados de demonstração */}
        <Section
          title="Dados de demonstração"
          description={`${leadsCount} lead${leadsCount === 1 ? "" : "s"} no momento. Use para explorar a UI sem cadastrar dados reais.`}
        >
          <div className="flex flex-wrap gap-2 mb-3">
            <Button variant="secondary" icon={Sparkles} onClick={handleLoadDemo}>
              Carregar dados de demonstração
            </Button>
            <Button variant="ghost" icon={Database} onClick={handleClearLeads} disabled={leadsCount === 0}>
              Limpar todos os leads
            </Button>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: NEUTRAL.slate }}>
            Gera ~68 empresas fictícias distribuídas nas 4 unidades, com setor, estado, porte e
            funil. Preenche os dropdowns do Explorador, Kanban e Executivo para testes.
          </p>
        </Section>

        {/* Dados locais */}
        <Section
          title="Dados locais"
          description="Apagar leads, configurações e sessão armazenados neste navegador."
        >
          <div
            className="p-3.5 rounded-lg mb-4 flex items-start gap-2.5 text-xs"
            style={{ background: NEUTRAL.amber + "15" || "#FFF7ED", borderLeft: `3px solid ${NEUTRAL.amber || "#F59E0B"}`, color: NEUTRAL.amber || "#B45309" }}
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Isso não afeta dados sincronizados com o Supabase. Afeta só este navegador.
            </span>
          </div>
          <Button variant="secondary" icon={Trash2} onClick={handleClearLocal}>
            Limpar dados locais
          </Button>
        </Section>
      </div>
    </div>
  );
}

export default SettingsView;
