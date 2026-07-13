import React, { useMemo, useState } from "react";
import {
  Inbox, CheckCircle2, XCircle, Clock, Filter, Plus, ChevronDown,
  CalendarDays, Building2, Tag, AlertCircle, ExternalLink,
} from "lucide-react";
import { useMarketingRequests }     from "../../hooks/use-marketing-requests";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { DELIVERABLE_PRIORITIES } from "../../constants/marketing-pipelines";
import { formatDateBR } from "../../utils/date";
import { EmptyState } from "../ui/EmptyState";

const STATUS_CONFIG = {
  pendente:   { label: "Pendente",   color: "#D97706", bg: "#FEF3C7", icon: Clock },
  aprovado:   { label: "Aprovado",   color: "#16A34A", bg: "#DCFCE7", icon: CheckCircle2 },
  rejeitado:  { label: "Rejeitado",  color: "#DC2626", bg: "#FEE2E2", icon: XCircle },
};

const PRIORITY_COLORS = {
  baixa: { color: "#16A34A", bg: "#DCFCE7" },
  media: { color: "#D97706", bg: "#FEF3C7" },
  alta:  { color: "#DC2626", bg: "#FEE2E2" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_COLORS[priority] || PRIORITY_COLORS.media;
  const label = DELIVERABLE_PRIORITIES.find(p => p.id === priority)?.label || priority;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {label}
    </span>
  );
}

/* ── Reject Modal ─────────────────────────────────────────────────── */
function RejectModal({ request, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)" }}>
        <h3 className="font-bold text-base mb-1" style={{ color: "var(--text)" }}>Rejeitar solicitação</h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>"{request.title}"</p>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Motivo (opcional)
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Informe o motivo da rejeição para o solicitante…"
          className="w-full text-sm rounded-lg px-3 py-2 resize-none border"
          style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#DC2626", color: "#fff" }}
          >
            Confirmar rejeição
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Approve Modal ────────────────────────────────────────────────── */
function ApproveModal({ request, onConfirm, onClose }) {
  const [notes, setNotes] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)" }}>
        <h3 className="font-bold text-base mb-1" style={{ color: "var(--text)" }}>Aprovar solicitação</h3>
        <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>"{request.title}"</p>
        <p className="text-xs mb-4 rounded-lg px-3 py-2" style={{ background: "#DCFCE7", color: "#15803D" }}>
          Uma entrega será criada automaticamente em <strong>Entregas</strong> para a agência externa.
        </p>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Observações internas (opcional)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Instruções ou informações adicionais para a equipe…"
          className="w-full text-sm rounded-lg px-3 py-2 resize-none border"
          style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text)" }}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(notes)}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#16A34A", color: "#fff" }}
          >
            Aprovar e criar entrega
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Request Card ─────────────────────────────────────────────────── */
function RequestCard({ request, onApprove, onReject, canWrite }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl border p-4 transition-shadow"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <StatusBadge status={request.status} />
            <PriorityBadge priority={request.priority} />
            {request.requestType && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}
              >
                <Tag size={9} />
                {request.requestType}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-sm leading-snug mb-1" style={{ color: "var(--text)" }}>
            {request.title}
          </h3>
          <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: "var(--text-dim)" }}>
            {request.requesterName && (
              <span className="flex items-center gap-1">
                <span className="font-medium" style={{ color: "var(--text)" }}>{request.requesterName}</span>
                {request.department && <span>· {request.department}</span>}
              </span>
            )}
            {request.deadline && (
              <span className="flex items-center gap-1">
                <CalendarDays size={10} />
                Prazo: {formatDateBR(request.deadline)}
              </span>
            )}
            {request.companyIds?.length > 0 && (
              <span className="flex items-center gap-1">
                <Building2 size={10} />
                {request.companyIds.map(id => COMPANIES[id]?.short || id).join(", ")}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {canWrite && request.status === "pendente" && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onApprove(request)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: "#DCFCE7", color: "#15803D" }}
            >
              <CheckCircle2 size={13} />
              Aprovar
            </button>
            <button
              onClick={() => onReject(request)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: "#FEE2E2", color: "#DC2626" }}
            >
              <XCircle size={13} />
              Rejeitar
            </button>
          </div>
        )}

        {request.status === "aprovado" && request.deliverableId && (
          <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "#DCFCE7", color: "#15803D" }}>
            Entrega criada
          </span>
        )}
      </div>

      {/* Expandable description */}
      {request.description && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs flex items-center gap-1 font-medium"
            style={{ color: "var(--text-dim)" }}
          >
            <ChevronDown
              size={13}
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}
            />
            {expanded ? "Ocultar detalhes" : "Ver descrição"}
          </button>
          {expanded && (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text)", whiteSpace: "pre-wrap" }}>
              {request.description}
            </p>
          )}
        </div>
      )}

      {request.status === "rejeitado" && request.rejectionReason && (
        <div className="mt-2 text-xs px-3 py-2 rounded-lg" style={{ background: "#FEE2E2", color: "#B91C1C" }}>
          <strong>Motivo:</strong> {request.rejectionReason}
        </div>
      )}

      <div className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
        Recebido em {request.createdAt ? new Date(request.createdAt).toLocaleDateString("pt-BR") : "—"}
      </div>
    </div>
  );
}

/* ── Main View ────────────────────────────────────────────────────── */
export function MarketingRequestsView({ user, users }) {
  const {
    requests, loading, error, canWrite,
    approveAndCreateDeliverable, rejectRequest,
  } = useMarketingRequests({ userId: user?.id, role: user?.role });

  const [statusFilter, setStatusFilter]   = useState("pendente");
  const [approvingReq, setApprovingReq]   = useState(null);
  const [rejectingReq, setRejectingReq]   = useState(null);
  const [actionError,  setActionError]    = useState(null);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter(r => r.status === statusFilter);
  }, [requests, statusFilter]);

  const counts = useMemo(() => ({
    pendente:  requests.filter(r => r.status === "pendente").length,
    aprovado:  requests.filter(r => r.status === "aprovado").length,
    rejeitado: requests.filter(r => r.status === "rejeitado").length,
  }), [requests]);

  const handleApproveConfirm = async (notes) => {
    if (!approvingReq) return;
    setActionError(null);
    try {
      // Cria a entrega em Entregas e marca a solicitação como aprovada numa
      // única transação no banco (approve_marketing_request) — antes eram 2
      // escritas separadas do cliente, com risco de deliverable órfão se a
      // 2ª falhasse (achado da auditoria completa).
      await approveAndCreateDeliverable(approvingReq.id, notes);
    } catch (e) {
      setActionError(e.message || "Erro ao aprovar solicitação.");
    } finally {
      setApprovingReq(null);
    }
  };

  const handleRejectConfirm = async (reason) => {
    if (!rejectingReq) return;
    setActionError(null);
    try {
      await rejectRequest(rejectingReq.id, reason);
    } catch (e) {
      setActionError(e.message || "Erro ao rejeitar solicitação.");
    } finally {
      setRejectingReq(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-xl" style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>
            Solicitações
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            Pedidos de material recebidos de outros departamentos
          </p>
        </div>
        <div
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
        >
          <AlertCircle size={12} />
          {counts.pendente} pendente{counts.pendente !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {[
          { id: "pendente",  label: "Pendentes",  count: counts.pendente },
          { id: "aprovado",  label: "Aprovadas",  count: counts.aprovado },
          { id: "rejeitado", label: "Rejeitadas", count: counts.rejeitado },
          { id: "all",       label: "Todas",      count: requests.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={
              statusFilter === tab.id
                ? { background: "var(--accent)", color: "#fff" }
                : { background: "var(--surface)", color: "var(--text-dim)", border: "1px solid var(--border)" }
            }
          >
            {tab.label}
            <span
              className="text-xs px-1.5 rounded-full font-bold"
              style={
                statusFilter === tab.id
                  ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                  : { background: "var(--surface-alt)", color: "var(--text-dim)" }
              }
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Error */}
      {(error || actionError) && (
        <div className="text-sm px-4 py-3 rounded-xl" style={{ background: "#FEE2E2", color: "#B91C1C" }}>
          {error || actionError}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: "var(--text-dim)" }}>
          Carregando solicitações…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            statusFilter === "pendente"
              ? "Nenhuma solicitação pendente"
              : "Nenhuma solicitação encontrada"
          }
          description="As solicitações enviadas pelo formulário aparecerão aqui"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <RequestCard
              key={req.id}
              request={req}
              canWrite={canWrite}
              onApprove={(r) => { setActionError(null); setApprovingReq(r); }}
              onReject={(r)  => { setActionError(null); setRejectingReq(r); }}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {approvingReq && (
        <ApproveModal
          request={approvingReq}
          onConfirm={handleApproveConfirm}
          onClose={() => setApprovingReq(null)}
        />
      )}
      {rejectingReq && (
        <RejectModal
          request={rejectingReq}
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectingReq(null)}
        />
      )}
    </div>
  );
}
