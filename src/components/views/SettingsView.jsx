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
      className="p-5 rounded-sm border"
      style={{ background: "#FFFFFF", borderColor: "#EFEFEF" }}
    >
      <div className="mb-4">
        <h2 className="font-bold" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
          {title}
        </h2>
        {description && (
          <p className="text-xs mt-1" style={{ color: NEUTRAL.slate }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ checked, onChange, label, sublabel, disabled }) {
  return (
    <label
      className="flex items-center justify-between gap-3 py-2 cursor-pointer"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <div>
        <div className="text-sm font-semibold" style={{ color: NEUTRAL.graphite }}>{label}</div>
        {sublabel && (
          <div className="text-xs" style={{ color: NEUTRAL.slate }}>{sublabel}</div>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-4 h-4"
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
    if (next.length === 0) return; // always keep at least one
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 28, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            Configurações
          </h1>
          <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
            Preferências pessoais de exibição, empresas ativas e notificações
          </p>
        </div>
        <Button variant="ghost" icon={RotateCcw} onClick={onReset}>
          Restaurar padrão
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
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
                  className="p-3 rounded-sm border flex items-center gap-2 transition-all text-left"
                  style={{
                    background: enabled ? c.light : "#FFFFFF",
                    borderColor: enabled ? c.primary : "#EFEFEF",
                  }}
                >
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: c.primary }} />
                  <span
                    className="font-semibold text-sm flex-1"
                    style={{ color: enabled ? c.dark : NEUTRAL.graphite }}
                  >
                    {c.name}
                  </span>
                  {enabled && <Check size={14} color={c.primary} />}
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          title="Widgets do Dashboard"
          description="Quais StatCards aparecem no topo do Dashboard."
        >
          <div className="divide-y" style={{ borderColor: "#EFEFEF" }}>
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

        <Section
          title="Etapas visíveis no Kanban"
          description="Esconda etapas que você não usa no dia a dia."
        >
          <div className="divide-y" style={{ borderColor: "#EFEFEF" }}>
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

        <Section
          title="Notificações"
          description="Alertas visuais dentro do app."
        >
          <div className="divide-y" style={{ borderColor: "#EFEFEF" }}>
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
                  className="px-3 py-2 text-sm font-semibold rounded-sm border transition-all"
                  style={{
                    background: active ? NEUTRAL.graphite : "#FFFFFF",
                    color: active ? "#FFFFFF" : NEUTRAL.slate,
                    borderColor: active ? NEUTRAL.graphite : "#EFEFEF",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          title="Conta"
          description={currentUser ? `Logado como ${currentUser.name} · ${currentUser.email}` : ""}
        >
          <p className="text-xs mb-3" style={{ color: NEUTRAL.slate }}>
            Login/senha e privacidade de dados estão disponíveis via Supabase (ver README).
            Ainda não há tela de troca de senha no front — use o painel do Supabase ou recovery por e-mail.
          </p>
        </Section>

        <Section
          title="Dados de demonstração"
          description={`${leadsCount} lead${leadsCount === 1 ? "" : "s"} no momento. Use para explorar a UI sem cadastrar dados reais.`}
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Sparkles} onClick={handleLoadDemo}>
              Carregar dados de demonstração
            </Button>
            <Button variant="ghost" icon={Database} onClick={handleClearLeads} disabled={leadsCount === 0}>
              Limpar todos os leads
            </Button>
          </div>
          <p className="text-xs mt-3" style={{ color: NEUTRAL.slate }}>
            Gera ~68 empresas fictícias distribuídas nas 4 unidades, com setor, estado, porte e
            funil. Preenche os dropdowns do Explorador, Kanban e Executivo para testes.
          </p>
        </Section>

        <Section
          title="Dados locais"
          description="Apagar leads, configurações e sessão armazenados neste navegador."
        >
          <div
            className="p-3 rounded-sm mb-3 flex items-start gap-2 text-xs"
            style={{ background: NEUTRAL.amber + "15", color: NEUTRAL.amber }}
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
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
