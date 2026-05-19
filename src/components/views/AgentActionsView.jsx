import React, { useCallback, useEffect, useState } from "react";
import {
  Bot, RefreshCw, CheckCircle2, XCircle, EyeOff, ChevronDown, ChevronUp,
  Clock, AlertTriangle, TrendingUp, Mail, Zap, Target, Telescope, Repeat2,
  Shield, GitMerge,
} from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

// ── Agent metadata ─────────────────────────────────────────────────────────
const AGENTS = {
  sdr_q:    { label: "SDR-Q",     sub: "Qualificador",         Icon: Target,    color: "#1E4D8C", bg: "#EBF0F9" },
  scout:    { label: "SCOUT",     sub: "Inteligência de Conta", Icon: Telescope, color: "#6B21A8", bg: "#F5F0FB" },
  cadencia: { label: "CADÊNCIA",  sub: "Follow-up Engine",      Icon: Repeat2,   color: "#C2410C", bg: "#FEF3EC" },
  sentinela:{ label: "SENTINELA", sub: "Monitor de Funil",      Icon: Shield,    color: "#B91C1C", bg: "#FEF2F2" },
  cross:    { label: "CROSS",     sub: "Cross-sell",            Icon: GitMerge,  color: "#0F766E", bg: "#F0FDFA" },
};

// ── Priority config ────────────────────────────────────────────────────────
const PRIORITY = {
  urgent: { label: "Urgente",  color: "#B91C1C", bg: "#FEF2F2" },
  high:   { label: "Alta",     color: "#C2410C", bg: "#FEF3EC" },
  normal: { label: "Normal",   color: "#1E4D8C", bg: "#EBF0F9" },
  low:    { label: "Baixa",    color: "#6B7280", bg: "#F3F4F6" },
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ── Helpers ────────────────────────────────────────────────────────────────
function relativeTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

// ── Action card ────────────────────────────────────────────────────────────
function ActionCard({ action, agent, onResolve, resolving }) {
  const [expanded, setExpanded] = useState(false);
  const prio = PRIORITY[action.priority] || PRIORITY.normal;
  const payload = action.payload || {};

  return (
    <div
      className="rounded-xl border"
      style={{ borderColor: "#EFEFEF", background: "#FAFAFA" }}
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
              <span className="text-xs font-semibold" style={{ color: NEUTRAL.graphite }}>
                {action.leads.company}
              </span>
            )}
            {action.leads?.stage && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: "#EFEFEF", color: NEUTRAL.slate }}>
                {action.leads.stage}
              </span>
            )}
            {payload.days_stale && (
              <span className="flex items-center gap-1 text-[10px]" style={{ color: NEUTRAL.slate }}>
                <Clock size={10} />
                {payload.days_stale}d parado
              </span>
            )}
          </div>
          <p className="text-sm font-semibold leading-snug" style={{ color: NEUTRAL.graphite }}>
            {action.title}
          </p>
          {action.summary && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: NEUTRAL.slate }}>
              {action.summary}
            </p>
          )}
          <p className="text-[10px] mt-1.5" style={{ color: "#C0C4CC" }}>
            {relativeTime(action.created_at)}
          </p>
        </div>

        {/* Expand toggle */}
        {(payload.draft_email || payload.recommended_action) && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="shrink-0 p-1 rounded-xl"
            style={{ color: NEUTRAL.slate }}
            title={expanded ? "Recolher" : "Ver draft"}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Expanded payload */}
      {expanded && (payload.draft_email || payload.recommended_action) && (
        <div className="mx-4 mb-3 rounded-xl border" style={{ borderColor: "#E5E7EB", background: "#F8F9FA" }}>
          {payload.subject && (
            <div className="px-3 pt-3 pb-1 flex items-center gap-2">
              <Mail size={11} style={{ color: agent.color }} />
              <span className="text-[10px] font-bold" style={{ color: agent.color }}>
                Assunto
              </span>
              <span className="text-xs" style={{ color: NEUTRAL.graphite }}>{payload.subject}</span>
            </div>
          )}
          {payload.draft_email && (
            <div className="px-3 py-2">
              <p className="text-[10px] font-bold mb-1" style={{ color: NEUTRAL.slate }}>
                Draft de Reativação
              </p>
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: NEUTRAL.graphite }}>
                {payload.draft_email}
              </p>
            </div>
          )}
          {payload.recommended_action && (
            <div className="px-3 pb-3 pt-1 flex items-start gap-2">
              <Zap size={11} className="mt-0.5 shrink-0" style={{ color: "#C2410C" }} />
              <p className="text-xs" style={{ color: NEUTRAL.graphite }}>
                <span className="font-semibold">Próximo passo: </span>
                {payload.recommended_action}
              </p>
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
            style={{ background: "#1A6E35", color: "#FFFFFF", opacity: resolving === action.id ? 0.6 : 1 }}
            onMouseEnter={e => { if (resolving !== action.id) e.currentTarget.style.background = "#155d2b"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#1A6E35"; }}
          >
            <CheckCircle2 size={12} />
            Aprovar
          </button>
          <button
            onClick={() => onResolve(action.id, "rejected")}
            disabled={resolving === action.id}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-opacity"
            style={{ borderColor: "#B91C1C", color: "#B91C1C", background: "#FFFFFF", opacity: resolving === action.id ? 0.6 : 1 }}
            onMouseEnter={e => { if (resolving !== action.id) e.currentTarget.style.background = "#FEF2F2"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; }}
          >
            <XCircle size={12} />
            Rejeitar
          </button>
          <button
            onClick={() => onResolve(action.id, "ignored")}
            disabled={resolving === action.id}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-opacity"
            style={{ borderColor: "#D1D5DB", color: NEUTRAL.slate, background: "#FFFFFF", opacity: resolving === action.id ? 0.6 : 1 }}
            onMouseEnter={e => { if (resolving !== action.id) e.currentTarget.style.background = "#F9FAFB"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; }}
          >
            <EyeOff size={12} />
            Ignorar
          </button>
        </div>
      )}

      {/* Resolved state label */}
      {action.status !== "pending" && (
        <div className="px-4 pb-3">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: action.status === "approved" ? "#E8F2EC" : action.status === "rejected" ? "#FEF2F2" : "#F3F4F6",
              color: action.status === "approved" ? "#1A6E35" : action.status === "rejected" ? "#B91C1C" : NEUTRAL.slate,
            }}
          >
            {action.status === "approved" ? "Aprovado" : action.status === "rejected" ? "Rejeitado" : "Ignorado"}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Agent section ──────────────────────────────────────────────────────────
function AgentSection({ agentId, actions, onResolve, resolving }) {
  const [open, setOpen] = useState(true);
  const meta = AGENTS[agentId] || { label: agentId, sub: "", Icon: Bot, color: NEUTRAL.slate, bg: "#F3F4F6" };
  const { Icon } = meta;
  const pendingCount = actions.filter(a => a.status === "pending").length;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
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
          <Icon size={15} color="#FFFFFF" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: meta.color }}>
              {meta.label}
            </span>
            <span className="text-xs" style={{ color: NEUTRAL.slate }}>
              {meta.sub}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <span
              className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: meta.color, color: "#FFFFFF" }}
            >
              {pendingCount}
            </span>
          )}
          <span style={{ color: NEUTRAL.slate }}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </button>

      {/* Cards */}
      {open && (
        <div className="divide-y" style={{ borderColor: "#EFEFEF" }}>
          {actions.map(action => (
            <ActionCard
              key={action.id}
              action={action}
              agent={meta}
              onResolve={onResolve}
              resolving={resolving}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────
export function AgentActionsView({ currentUser, activeCompany }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [resolving, setResolving] = useState(null); // action id being resolved
  const [resolveError, setResolveError] = useState(null);

  const isManager = currentUser?.role === "gerente" || currentUser?.role === "admin";

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

  // ── Group by agent ────────────────────────────────────────────────────────
  const agentOrder = ["cadencia", "sentinela", "sdr_q", "scout", "cross"];
  const grouped = agentOrder.reduce((acc, agentId) => {
    const list = actions.filter(a => a.agent_id === agentId);
    if (list.length > 0) acc[agentId] = list;
    return acc;
  }, {});
  // catch unknown agent_ids
  actions.forEach(a => {
    if (!agentOrder.includes(a.agent_id) && !grouped[a.agent_id]) {
      grouped[a.agent_id] = [];
    }
    if (!agentOrder.includes(a.agent_id)) {
      grouped[a.agent_id] = [...(grouped[a.agent_id] || []), a];
    }
  });

  const totalPending = actions.filter(a => a.status === "pending").length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot size={22} style={{ color: NEUTRAL.graphite }} />
            <h1
              className="font-bold leading-tight"
              style={{ fontSize: 28, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}
            >
              Time de Agentes
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
            {loading
              ? "Carregando sugestões…"
              : totalPending > 0
              ? `${totalPending} sugestão${totalPending !== 1 ? "ões" : ""} pendente${totalPending !== 1 ? "s" : ""} aguardando decisão`
              : "Nenhuma sugestão pendente — pipeline em dia"}
          </p>
        </div>
        <button
          onClick={fetchActions}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border transition-opacity"
          style={{
            borderColor: "#D1D5DB",
            color: NEUTRAL.slate,
            background: "#FFFFFF",
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "#EFEFEF" }}>
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
                color: active ? NEUTRAL.graphite : NEUTRAL.slate,
                borderBottomColor: active ? NEUTRAL.graphite : "transparent",
                letterSpacing: "0.08em",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Resolve error */}
      {resolveError && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}
        >
          <AlertTriangle size={12} />
          {resolveError}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-16 text-center text-xs" style={{ color: NEUTRAL.slate }}>
          Carregando sugestões dos agentes…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}
        >
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && Object.keys(grouped).length === 0 && (
        <div className="py-20 text-center space-y-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "#F3F4F6" }}
          >
            <TrendingUp size={24} style={{ color: "#9CA3AF" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: NEUTRAL.graphite }}>
              {statusFilter === "pending" ? "Nenhuma sugestão pendente" : "Nenhuma ação encontrada"}
            </p>
            <p className="text-xs mt-1" style={{ color: NEUTRAL.slate }}>
              {statusFilter === "pending"
                ? "O pipeline está em dia. Os agentes monitoram continuamente."
                : "Tente ajustar o filtro de status."}
            </p>
          </div>
        </div>
      )}

      {/* Agent sections */}
      {!loading && !error && Object.keys(grouped).length > 0 && (
        <div className="space-y-4">
          {Object.entries(grouped).map(([agentId, agentActions]) => (
            <AgentSection
              key={agentId}
              agentId={agentId}
              actions={agentActions}
              onResolve={handleResolve}
              resolving={resolving}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default AgentActionsView;
