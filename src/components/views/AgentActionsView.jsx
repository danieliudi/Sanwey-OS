import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot, RefreshCw, CheckCircle2, XCircle, EyeOff, ChevronDown, ChevronUp,
  Clock, AlertTriangle, TrendingUp, Mail, Zap, Target, Telescope, Repeat2,
  Shield, GitMerge, Settings, Info, ExternalLink,
} from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAgentConfig } from "../../hooks/use-agent-config";
import { AgentConfigModal } from "../agents/AgentConfigModal";
import { relativeTime } from "../../utils/date";
import { ROUTES } from "../../constants/routes";

// ── Agent metadata ─────────────────────────────────────────────────────────
const AGENTS = {
  sdr_q:    { label: "SDR-Q",     sub: "Qualificador",         Icon: Target,    color: "#1D4ED8", bg: "#EBF0F9" },
  scout:    { label: "SCOUT",     sub: "Inteligência de Conta", Icon: Telescope, color: "#6B21A8", bg: "#F5F0FB" },
  cadencia: { label: "CADÊNCIA",  sub: "Follow-up Engine",      Icon: Repeat2,   color: "#C2410C", bg: "#FEF3EC" },
  sentinela:{ label: "SENTINELA", sub: "Monitor de Funil",      Icon: Shield,    color: "var(--danger)", bg: "var(--danger-bg)" },
  cross:    { label: "CROSS",     sub: "Cross-sell",            Icon: GitMerge,  color: "#0F766E", bg: "#F0FDFA" },
};

// ── Priority config ────────────────────────────────────────────────────────
const PRIORITY = {
  urgent: { label: "Urgente",  color: "var(--danger)", bg: "var(--danger-bg)" },
  high:   { label: "Alta",     color: "#C2410C", bg: "#FEF3EC" },
  normal: { label: "Normal",   color: "#1D4ED8", bg: "#EBF0F9" },
  low:    { label: "Baixa",    color: "var(--text-dim)", bg: "var(--surface-alt)" },
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const STAGE_NAMES = Object.fromEntries(DEFAULT_PIPELINE_STAGES.map(s => [s.id, s.name]));

// ── Action card ────────────────────────────────────────────────────────────
function ActionCard({ action, agent, onResolve, resolving, onOpenFornecedor, onOpenCandidato }) {
  const [expanded, setExpanded] = useState(false);
  const prio = PRIORITY[action.priority] || PRIORITY.normal;
  const payload = action.payload || {};

  return (
    <div
      className="rounded-xl border"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {/* Header row */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {/* Priority badge */}
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: prio.bg, color: prio.color }}
            >
              {prio.label}
            </span>
            {/* Lead company */}
            {action.leads?.company && (
              <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                {action.leads.company}
              </span>
            )}
            {action.leads?.stage && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
                {STAGE_NAMES[action.leads.stage] || action.leads.stage}
              </span>
            )}
            {payload.days_stale && (
              <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-dim)" }}>
                <Clock size={10} />
                {payload.days_stale}d parado
              </span>
            )}
            {/* Fornecedor de RH (Agent Builder, ver agent-runner) — sem lead_id,
                fica sem contexto nenhum no card fechado se não vier aqui. */}
            {payload.fornecedor_nome && (
              <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                {payload.fornecedor_nome}
              </span>
            )}
            {payload.dias_para_vencer != null && (
              <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-dim)" }}>
                <Clock size={10} />
                {payload.dias_para_vencer}d p/ vencer
              </span>
            )}
            {/* Sugestão de Sourcing (Agent Builder) — sem lead_id, precisa do
                payload pra mostrar quem é o candidato e pra qual vaga. */}
            {payload.candidato_nome && (
              <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                {payload.candidato_nome}
              </span>
            )}
            {payload.vaga_titulo && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
                {payload.vaga_titulo}
              </span>
            )}
            {/* Sugestão de Sinal de Mercado (Rotina de pesquisa real) — sem
                lead_id, o payload é a única fonte de contexto no card fechado. */}
            {action.action_type === "sugestao_sinal_mercado" && payload.source && (
              <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                {payload.source}
              </span>
            )}
            {action.action_type === "sugestao_sinal_mercado" && payload.urgency && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
                {payload.urgency}
              </span>
            )}
            {/* Sugestão de Prospect (Explorador, mesma Rotina) */}
            {action.action_type === "sugestao_prospect" && payload.sector && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
                {payload.sector}
              </span>
            )}
            {action.action_type === "sugestao_prospect" && payload.fit_score != null && (
              <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                Fit {payload.fit_score}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>
            {action.title}
          </p>
          {action.summary && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-dim)" }}>
              {action.summary}
            </p>
          )}
          <p className="text-[10px] mt-1.5" style={{ color: "var(--text-faint)" }}>
            {relativeTime(action.created_at)}
          </p>
        </div>

        {/* Expand toggle */}
        {(payload.draft_email || payload.recommended_action || payload.justificativa || payload.excerpt || payload.evidence) && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="shrink-0 p-1 rounded-xl"
            style={{ color: "var(--text-dim)" }}
            title={expanded ? "Recolher" : "Ver draft"}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Expanded payload */}
      {expanded && (payload.draft_email || payload.recommended_action || payload.justificativa || payload.excerpt || payload.evidence) && (
        <div className="mx-4 mb-3 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
          {action.action_type === "email_fornecedor" &&
            (payload.fornecedor_contact_name || payload.fornecedor_email || payload.fornecedor_phone) && (
            <div className="px-3 pt-3 pb-1.5 flex items-start gap-2 border-b" style={{ borderColor: "var(--border)" }}>
              <Mail size={11} style={{ color: agent.color, marginTop: 2 }} className="shrink-0" />
              <div className="text-xs leading-relaxed">
                <span className="font-bold" style={{ color: "var(--text-dim)" }}>Destinatário: </span>
                {payload.fornecedor_contact_name && (
                  <span style={{ color: "var(--text)" }}>{payload.fornecedor_contact_name}</span>
                )}
                {payload.fornecedor_email && (
                  <span style={{ color: "var(--text-dim)" }}>
                    {payload.fornecedor_contact_name ? " · " : ""}{payload.fornecedor_email}
                  </span>
                )}
                {payload.fornecedor_phone && (
                  <span style={{ color: "var(--text-dim)" }}> · {payload.fornecedor_phone}</span>
                )}
              </div>
            </div>
          )}
          {payload.subject && (
            <div className="px-3 pt-3 pb-1 flex items-center gap-2">
              <Mail size={11} style={{ color: agent.color }} />
              <span className="text-[10px] font-bold" style={{ color: agent.color }}>
                Assunto
              </span>
              <span className="text-xs" style={{ color: "var(--text)" }}>{payload.subject}</span>
            </div>
          )}
          {payload.draft_email && (
            <div className="px-3 py-2">
              <p className="text-[10px] font-bold mb-1" style={{ color: "var(--text-dim)" }}>
                Draft de Reativação
              </p>
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                {payload.draft_email}
              </p>
            </div>
          )}
          {payload.recommended_action && (
            <div className="px-3 pb-3 pt-1 flex items-start gap-2">
              <Zap size={11} className="mt-0.5 shrink-0" style={{ color: "#C2410C" }} />
              <p className="text-xs" style={{ color: "var(--text)" }}>
                <span className="font-semibold">Próximo passo: </span>
                {payload.recommended_action}
              </p>
            </div>
          )}
          {action.action_type === "aviso_interno" && payload.fornecedor_id && (
            <div className="px-3 pb-3">
              <button
                onClick={() => onOpenFornecedor(payload.fornecedor_id)}
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                <ExternalLink size={11} />
                Ver fornecedor{payload.fornecedor_nome ? ` — ${payload.fornecedor_nome}` : ""}
              </button>
            </div>
          )}
          {payload.justificativa && (
            <div className="px-3 pb-3 pt-1 flex items-start gap-2">
              <Zap size={11} className="mt-0.5 shrink-0" style={{ color: "#C2410C" }} />
              <p className="text-xs" style={{ color: "var(--text)" }}>
                <span className="font-semibold">Por que é aderente: </span>
                {payload.justificativa}
              </p>
            </div>
          )}
          {action.action_type === "sugestao_candidato_vaga" && payload.candidato_id && (
            <div className="px-3 pb-3">
              <button
                onClick={() => onOpenCandidato(payload.candidato_id)}
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                <ExternalLink size={11} />
                Ver candidato{payload.candidato_nome ? ` — ${payload.candidato_nome}` : ""}
              </button>
            </div>
          )}
          {action.action_type === "sugestao_sinal_mercado" && payload.excerpt && (
            <div className="px-3 pb-3 pt-1">
              <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>
                {payload.excerpt}
              </p>
              {payload.url && (
                <a
                  href={payload.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold mt-2"
                  style={{ color: "var(--accent)" }}
                >
                  <ExternalLink size={11} />
                  Ver fonte
                </a>
              )}
            </div>
          )}
          {action.action_type === "sugestao_prospect" && payload.evidence && (
            <div className="px-3 pb-3 pt-1">
              <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>
                <span className="font-semibold">Por que é um bom prospect: </span>
                {payload.evidence}
              </p>
              {(payload.city || payload.state || payload.cnpj) && (
                <p className="text-[10px] mt-1.5" style={{ color: "var(--text-dim)" }}>
                  {[payload.cnpj, [payload.city, payload.state].filter(Boolean).join("/")].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons — only for pending */}
      {action.status === "pending" && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <button
            onClick={() => onResolve(action.id, "approved")}
            disabled={resolving === action.id}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-opacity"
            style={{ background: "var(--success)", color: "var(--on-success)", opacity: resolving === action.id ? 0.6 : 1 }}
            onMouseEnter={e => { if (resolving !== action.id) e.currentTarget.style.background = "color-mix(in srgb, var(--success) 85%, var(--text))"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--success)"; }}
          >
            <CheckCircle2 size={12} />
            Aprovar
          </button>
          <button
            onClick={() => onResolve(action.id, "rejected")}
            disabled={resolving === action.id}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-opacity"
            style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--surface)", opacity: resolving === action.id ? 0.6 : 1 }}
            onMouseEnter={e => { if (resolving !== action.id) e.currentTarget.style.background = "var(--danger-bg)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
          >
            <XCircle size={12} />
            Rejeitar
          </button>
          <button
            onClick={() => onResolve(action.id, "ignored")}
            disabled={resolving === action.id}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-opacity"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface)", opacity: resolving === action.id ? 0.6 : 1 }}
            onMouseEnter={e => { if (resolving !== action.id) e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
          >
            <EyeOff size={12} />
            Ignorar
          </button>
        </div>
      )}

      {/* Resolved state label */}
      {action.status !== "pending" && (
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: action.status === "approved" ? "var(--success-bg)" : action.status === "rejected" ? "var(--danger-bg)" : "var(--surface-alt)",
              color: action.status === "approved" ? "var(--success)" : action.status === "rejected" ? "var(--danger)" : "var(--text-dim)",
            }}
          >
            {action.status === "approved" ? "Aprovado" : action.status === "rejected" ? "Rejeitado" : "Ignorado"}
          </span>
          {/* Peça da esteira já aprovada: se a entrega foi apagada, dá pra
              republicar sem voltar o status pra pending. O gateway só cria
              de novo quando não acha deliverable com o mesmo agent_action_id. */}
          {action.status === "approved" && action.action_type === "sugestao_peca_conteudo" && (
            <button
              type="button"
              onClick={() => onResolve(action.id, "approved")}
              disabled={resolving === action.id}
              title="Cria de novo a entrega de marketing se ela não existir (ex.: foi apagada)."
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-xl border transition-opacity"
              style={{
                borderColor: "var(--border-strong)",
                color: "var(--text)",
                background: "var(--surface)",
                opacity: resolving === action.id ? 0.6 : 1,
              }}
            >
              <RefreshCw size={11} className={resolving === action.id ? "animate-spin" : undefined} />
              {resolving === action.id ? "Gerando…" : "Gerar entrega de novo"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Agent section ──────────────────────────────────────────────────────────
function AgentSection({ agentId, actions, onResolve, resolving, metaOverride, onOpenFornecedor, onOpenCandidato }) {
  const [open, setOpen] = useState(true);
  const meta = metaOverride || AGENTS[agentId] || { label: agentId, sub: "", Icon: Bot, color: "var(--text)", bg: "var(--surface-alt)", onColor: "var(--surface)" };
  const { Icon } = meta;
  const pendingCount = actions.filter(a => a.status === "pending").length;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      {/* Section header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: meta.bg }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: meta.color }}
        >
          <Icon size={15} color={meta.onColor || "#FFFFFF"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: meta.color }}>
              {meta.label}
            </span>
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>
              {meta.sub}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <span
              className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: meta.color, color: meta.onColor || "#FFFFFF" }}
            >
              {pendingCount}
            </span>
          )}
          <span style={{ color: "var(--text-dim)" }}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </button>

      {/* Cards */}
      {open && (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {actions.map(action => (
            <ActionCard
              key={action.id}
              action={action}
              agent={meta}
              onResolve={onResolve}
              resolving={resolving}
              onOpenFornecedor={onOpenFornecedor}
              onOpenCandidato={onOpenCandidato}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const FILTER_AUTOMATION_STORAGE_KEY = "agentActionsFilterAutomationId";

// ── Main view ──────────────────────────────────────────────────────────────
export function AgentActionsView({ currentUser, activeCompany, automations, filterAutomationId: filterAutomationIdProp }) {
  const navigate = useNavigate();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [resolving, setResolving] = useState(null); // action id being resolved
  const [resolveError, setResolveError] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);
  // "Ver sugestões geradas →" (AutomationsView, aba Agentes de IA) navega pra
  // cá via setSection/rota — sem forma de passar um prop de fato através da
  // troca de rota, então o automation_id viaja num sessionStorage de curta
  // duração; filterAutomationIdProp cobre quem já tiver o valor à mão.
  const [filterAutomationId, setFilterAutomationId] = useState(() => {
    if (filterAutomationIdProp) return filterAutomationIdProp;
    try {
      const stored = sessionStorage.getItem(FILTER_AUTOMATION_STORAGE_KEY);
      if (stored) sessionStorage.removeItem(FILTER_AUTOMATION_STORAGE_KEY);
      return stored || null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (filterAutomationIdProp) setFilterAutomationId(filterAutomationIdProp);
  }, [filterAutomationIdProp]);

  const automationNamesById = useMemo(() => {
    const map = new Map();
    for (const a of automations || []) map.set(a.id, a.name || "Agente removido");
    return map;
  }, [automations]);

  // roles[] cobre cargo adicional — currentUser.role sozinho fica só de fallback.
  // Achado da 2ª auditoria (esta view ficou de fora do fix a28bfb5).
  const userRoleList = currentUser?.roles?.length ? currentUser.roles : (currentUser?.role ? [currentUser.role] : []);
  const isManager = userRoleList.includes("gerente") || userRoleList.includes("admin");
  const { isAgentEnabled, toggleAgent } = useAgentConfig();

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchActions = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase não configurado.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("agent_actions")
        .select("*, leads(id, company, stage, company_id)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (activeCompany && activeCompany !== "all") q = q.eq("company_id", activeCompany);

      const { data, error: err } = await q;
      if (err) throw err;
      setActions(data || []);
    } catch (e) {
      setError(e.message || "Erro ao carregar ações.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, activeCompany]);

  useEffect(() => { fetchActions(); }, [fetchActions]);

  // ── Resolve ──────────────────────────────────────────────────────────────
  const handleResolve = useCallback(async (id, status) => {
    if (!SUPABASE_URL) return;
    setResolving(id);
    setResolveError(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-gateway?action=resolve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      // Optimistic update
      setActions(prev =>
        prev.map(a => (a.id === id ? { ...a, status, resolved_at: new Date().toISOString() } : a))
      );
    } catch (e) {
      setResolveError(`Erro ao resolver ação: ${e.message}`);
    } finally {
      setResolving(null);
    }
  }, []);

  // "Ver fornecedor" (ActionCard, aviso interno) navega pra RHFornecedoresView
  // e abre o FornecedorDrawer já focado — mesmo mecanismo de handoff via
  // sessionStorage já usado por filterAutomationId/AutomationsView acima.
  const onOpenFornecedor = useCallback((fornecedorId) => {
    try {
      sessionStorage.setItem("rhFornecedoresOpenId", fornecedorId);
    } catch { /* sessionStorage indisponível (modo privado etc.) — segue sem handoff */ }
    navigate(ROUTES["rh-fornecedores"]);
  }, [navigate]);

  // "Ver candidato" (ActionCard, sugestão de Sourcing) navega pra
  // RHRecrutamentoView e abre o candidato já focado — mesmo handoff.
  const onOpenCandidato = useCallback((candidatoId) => {
    try {
      sessionStorage.setItem("rhRecrutamentoOpenCandidatoId", candidatoId);
    } catch { /* sessionStorage indisponível (modo privado etc.) — segue sem handoff */ }
    navigate(ROUTES["rh-recrutamento"]);
  }, [navigate]);

  // ── Group by agent ────────────────────────────────────────────────────────
  const agentOrder = ["cadencia", "sentinela", "sdr_q", "scout", "cross"];

  // Filtra ações pelos agentes habilitados na configuração. Quando
  // activeCompany === "all", uma ação aparece se o agente estiver
  // ativo em PELO MENOS uma empresa (gerente vê tudo). Quando filtrado
  // por empresa, respeita só aquela empresa.
  const visibleActions = actions.filter(a => {
    const companyId = a.leads?.company_id || a.company_id;
    if (!companyId) return true;
    if (activeCompany && activeCompany !== "all") {
      return isAgentEnabled(activeCompany, a.agent_id);
    }
    return isAgentEnabled(companyId, a.agent_id);
  });

  // Ações do Agent Builder (Automações → aba "Agentes de IA") chegam todas com
  // agent_id="automation" — agrupar por esse valor cru juntaria agentes de IA
  // diferentes numa seção só; agrupa por automation_id em vez disso, com o
  // nome real da automação como rótulo (automationNamesById, populado via prop).
  //
  // Sem automation_id é outra coisa: rotina externa (n8n) via
  // agent-gateway?action=create, que não aceita esse campo — a sugestão nasce
  // legítima e sem automação por trás. Antes caía no mesmo balde e o
  // fallback rotulava a seção inteira como "Agente removido"; 19 sugestões
  // reais de pesquisa de mercado ficaram parecendo lixo de um agente apagado
  // (achado 13/08/2026). "Agente removido" agora só aparece no caso que
  // realmente é isso: automation_id preenchido apontando pra automação que
  // não existe mais.
  const groupKeyOf = (a) => a.agent_id !== "automation"
    ? a.agent_id
    : (a.automation_id ? `automation:${a.automation_id}` : "rotina_externa");

  const sectionMetaOverrides = {};
  visibleActions.forEach(a => {
    if (a.agent_id !== "automation") return;
    const key = groupKeyOf(a);
    if (sectionMetaOverrides[key]) return;
    const externa = !a.automation_id;
    sectionMetaOverrides[key] = {
      label: externa ? "Pesquisa de Mercado" : (automationNamesById.get(a.automation_id) || "Agente removido"),
      sub: externa ? "Rotina externa" : "Agente de IA",
      Icon: externa ? Telescope : Bot,
      color: "var(--accent)",
      bg: "var(--surface-alt)",
      onColor: "var(--on-accent)",
    };
  });

  const grouped = agentOrder.reduce((acc, agentId) => {
    const list = visibleActions.filter(a => groupKeyOf(a) === agentId);
    if (list.length > 0) acc[agentId] = list;
    return acc;
  }, {});
  // catch unknown agent_ids / agent_id="automation" (agrupado por automation_id acima)
  visibleActions.forEach(a => {
    const key = groupKeyOf(a);
    if (agentOrder.includes(key)) return;
    grouped[key] = [...(grouped[key] || []), a];
  });

  const totalPending = visibleActions.filter(a => a.status === "pending").length;

  // filterAutomationId (vindo de "Ver sugestões geradas →"): ignora todo o
  // agrupamento por agente, lista só as ações daquela automação.
  const automationFilteredActions = filterAutomationId
    ? visibleActions.filter(a => a.automation_id === filterAutomationId)
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot size={22} style={{ color: "var(--text)" }} />
            <h1
              className="font-bold leading-tight"
              style={{ fontSize: 28, color: "var(--text)", letterSpacing: "-0.02em" }}
            >
              Time de Agentes
            </h1>
            <span
              className="inline-flex items-center justify-center rounded-full cursor-help"
              style={{ width: 18, height: 18, background: "var(--surface-alt)", color: "var(--text-dim)" }}
              title={
                "Agentes de IA que monitoram a carteira e sugerem ações — você aprova, rejeita ou ignora.\n\n" +
                "Use para receber recomendações proativas:\n" +
                "• Leads frios precisando de cadência\n" +
                "• Oportunidades de cross-sell entre empresas\n" +
                "• Alertas de saúde do funil\n" +
                "• Qualificação de leads novos\n\n" +
                "Diferenças:\n" +
                "• Automações → executam sozinhas, sem IA, sem aprovação\n" +
                "• Aba IA do card → assistente sob demanda para um lead específico"
              }
            >
              <Info size={11} />
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>
            {loading
              ? "Carregando sugestões…"
              : totalPending > 0
              ? `${totalPending} sugest${totalPending !== 1 ? "ões" : "ão"} pendente${totalPending !== 1 ? "s" : ""} aguardando decisão`
              : "Nenhuma sugestão pendente — pipeline em dia"}
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {isManager && (
            <button
              onClick={() => setConfigOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border cursor-pointer"
              style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
            >
              <Settings size={12} />
              Configurar agentes
            </button>
          )}
          <button
            onClick={fetchActions}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border transition-opacity"
            style={{
              borderColor: "var(--border-strong)",
              color: "var(--text-dim)",
              background: "var(--surface)",
              opacity: loading ? 0.5 : 1,
            }}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Filtro por automação — "Ver sugestões geradas →" da aba Agentes de IA */}
      {filterAutomationId && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs flex-wrap"
          style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
        >
          <Bot size={12} style={{ color: "var(--accent)" }} />
          Mostrando só sugestões de{" "}
          <strong style={{ color: "var(--text)" }}>
            {automationNamesById.get(filterAutomationId) || "agente removido"}
          </strong>
          <button
            onClick={() => setFilterAutomationId(null)}
            className="ml-auto text-xs font-semibold cursor-pointer"
            style={{ background: "none", border: "none", color: "var(--accent)" }}
          >
            Ver todos os agentes
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border)", width: "max-content", minWidth: "100%" }}>
        {[
          { key: "pending",  label: "Pendentes" },
          { key: "approved", label: "Aprovados" },
          { key: "rejected", label: "Rejeitados" },
          { key: "ignored",  label: "Ignorados" },
          { key: "all",      label: "Todos" },
        ].map(f => {
          const active = statusFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 transition-all"
              style={{
                color: active ? "var(--text)" : "var(--text-dim)",
                borderBottomColor: active ? "var(--text)" : "transparent",
                letterSpacing: "0.08em",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      </div>

      {/* Resolve error */}
      {resolveError && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger)" }}
        >
          <AlertTriangle size={12} />
          {resolveError}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-16 text-center text-xs" style={{ color: "var(--text-dim)" }}>
          Carregando sugestões dos agentes…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger)" }}
        >
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && (filterAutomationId ? automationFilteredActions.length === 0 : Object.keys(grouped).length === 0) && (
        <div className="py-20 text-center space-y-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "var(--surface-alt)" }}
          >
            <TrendingUp size={24} style={{ color: "var(--text-faint)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              {statusFilter === "pending" ? "Nenhuma sugestão pendente" : "Nenhuma ação encontrada"}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
              {statusFilter === "pending"
                ? "O pipeline está em dia. Os agentes monitoram continuamente."
                : "Tente ajustar o filtro de status."}
            </p>
          </div>
        </div>
      )}

      {/* Lista simples (sem accordion por agente) quando filtrado por automação */}
      {!loading && !error && filterAutomationId && automationFilteredActions.length > 0 && (
        <div className="rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--border)" }}>
          {automationFilteredActions.map(action => (
            <ActionCard
              key={action.id}
              action={action}
              agent={sectionMetaOverrides[`automation:${action.automation_id}`] || { color: "var(--accent)" }}
              onResolve={handleResolve}
              resolving={resolving}
              onOpenFornecedor={onOpenFornecedor}
              onOpenCandidato={onOpenCandidato}
            />
          ))}
        </div>
      )}

      {/* Agent sections */}
      {!loading && !error && !filterAutomationId && Object.keys(grouped).length > 0 && (
        <div className="space-y-4">
          {Object.entries(grouped).map(([agentId, agentActions]) => (
            <AgentSection
              key={agentId}
              agentId={agentId}
              actions={agentActions}
              onResolve={handleResolve}
              resolving={resolving}
              metaOverride={sectionMetaOverrides[agentId]}
              onOpenFornecedor={onOpenFornecedor}
              onOpenCandidato={onOpenCandidato}
            />
          ))}
        </div>
      )}

      <AgentConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        agents={AGENTS}
        agentOrder={agentOrder}
        isAgentEnabled={isAgentEnabled}
        toggleAgent={toggleAgent}
      />
    </div>
  );
}

export default AgentActionsView;
