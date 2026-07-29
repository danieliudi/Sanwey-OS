import React, { useMemo, useState } from "react";
import {
  Inbox, CheckCircle2, XCircle, Clock, Filter, Plus, ChevronDown,
  CalendarDays, Building2, Tag, AlertCircle, ExternalLink,
  RefreshCw, Wallet, UserCheck,
} from "lucide-react";
import { useMarketingRequests }     from "../../hooks/use-marketing-requests";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { marketingUnitLabel } from "../../constants/companies";
import { EditableProtocolNumber } from "../shared/EditableProtocolNumber";
import { DELIVERABLE_PRIORITIES } from "../../constants/marketing-pipelines";
import { formatDateBR } from "../../utils/date";
import { formatBRL } from "../../utils/currency";
import { EmptyState } from "../ui/EmptyState";
import { CopyPublicLinkButton } from "../shared/CopyPublicLinkButton";
import { PageHeader } from "../shared/PageHeader";

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
  const [saving, setSaving] = useState(false);
  useEscToClose(onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--overlay-scrim)" }}
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
            onClick={async () => { setSaving(true); await onConfirm(reason); }}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#DC2626", color: "#fff", opacity: saving ? 0.6 : 1, cursor: saving ? "default" : "pointer" }}
          >
            {saving ? "Rejeitando…" : "Confirmar rejeição"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Approve Modal ────────────────────────────────────────────────── */
// Destino escolhido pelo aprovador: Entrega (agência externa, fluxo
// original) ou Tarefa (equipe interna, sem passar por fornecedor) — pedido
// do Daniel, mockup aprovado. marketing_tasks não tem colunas próprias de
// requester_name/email/department, então esses dados entram formatados no
// topo da descrição da tarefa (approve_marketing_request_as_task) — mesma
// solução já usada hoje pras observações internas.
function ApproveModal({ request, onConfirm, onClose }) {
  const [destination, setDestination] = useState("entrega");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEscToClose(onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--overlay-scrim)" }}
    >
      <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)" }}>
        <h3 className="font-bold text-base mb-1" style={{ color: "var(--text)" }}>Aprovar solicitação</h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>"{request.title}"</p>

        <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>
          Criar como
        </div>
        <div className="flex flex-col gap-2 mb-4">
          {[
            { id: "entrega", title: "Entrega — para agência externa", desc: "Vai pro board de Entregas, visível pra agência/fornecedor cuidar da produção." },
            { id: "tarefa",  title: "Tarefa — equipe interna",         desc: "Vai pro board de Tarefas de Marketing, sem passar por fornecedor." },
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDestination(opt.id)}
              className="flex items-start gap-2.5 text-left p-3 rounded-lg border transition-colors"
              style={{
                borderColor: destination === opt.id ? "var(--accent)" : "var(--border)",
                background: destination === opt.id ? "color-mix(in srgb, var(--accent) 6%, var(--surface-alt))" : "var(--surface-alt)",
              }}
            >
              <span
                className="mt-0.5 rounded-full shrink-0"
                style={{
                  width: 16, height: 16, border: `1.5px solid ${destination === opt.id ? "var(--accent)" : "var(--border-strong)"}`,
                  background: "var(--surface)", position: "relative",
                }}
              >
                {destination === opt.id && (
                  <span className="absolute rounded-full" style={{ inset: 3, background: "var(--accent)" }} />
                )}
              </span>
              <span>
                <div className="text-[13.5px] font-bold" style={{ color: "var(--text)" }}>{opt.title}</div>
                <div className="text-[11.5px] leading-snug" style={{ color: "var(--text-dim)" }}>{opt.desc}</div>
              </span>
            </button>
          ))}
        </div>

        {destination === "entrega" ? (
          <p className="text-xs mb-4 rounded-lg px-3 py-2" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
            Uma entrega será criada automaticamente em <strong>Entregas</strong>, com os dados do solicitante preservados.
          </p>
        ) : (
          <p className="text-xs mb-4 rounded-lg px-3 py-2" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
            Uma tarefa será criada em <strong>Tarefas de Marketing</strong>. Nome/e-mail/departamento do solicitante entram na descrição da tarefa.
          </p>
        )}

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
            onClick={async () => { setSaving(true); await onConfirm(notes, destination); }}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: destination === "entrega" ? "var(--success)" : "var(--warning)", color: "#fff", opacity: saving ? 0.6 : 1, cursor: saving ? "default" : "pointer" }}
          >
            {saving ? "Aprovando…" : destination === "entrega" ? "Aprovar e criar entrega" : "Aprovar e criar tarefa"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Request Card ─────────────────────────────────────────────────── */
function RequestCard({ request, onApprove, onReject, canWrite, onUpdateRequestNumber, onResendEmail, sendingEmail }) {
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
            <span className="font-mono font-bold mr-1.5" style={{ color: "var(--accent)" }}>
              <EditableProtocolNumber
                value={request.requestNumber}
                canWrite={canWrite}
                onSave={(next) => onUpdateRequestNumber(request.id, next)}
                mono
              />
            </span>
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
                {request.companyIds.map(id => marketingUnitLabel(id)).join(", ")}
              </span>
            )}
            {request.budget != null && (
              <span className="flex items-center gap-1">
                <Wallet size={10} />
                {formatBRL(request.budget)}
              </span>
            )}
            {request.approverName && (
              <span className="flex items-center gap-1">
                <UserCheck size={10} />
                Aprovador: {request.approverName}
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

        {request.status === "aprovado" && request.taskId && (
          <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "#FEF3C7", color: "#B45309" }}>
            Tarefa criada
          </span>
        )}

        {canWrite && request.status !== "pendente" && request.emailError && (
          <button
            onClick={() => onResendEmail(request)}
            disabled={sendingEmail}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
            style={{ background: "#FEF3C7", color: "#D97706" }}
          >
            <RefreshCw size={13} /> {sendingEmail ? "Enviando…" : "Tentar enviar e-mail de novo"}
          </button>
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

      {request.status !== "pendente" && request.emailError && (
        <div className="mt-2 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5" style={{ background: "#FEF3C7", color: "#92400E" }}>
          <AlertCircle size={12} /> Falha ao avisar o solicitante por e-mail: {request.emailError}
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
    approveAndCreateDeliverable, approveAndCreateTask, rejectRequest, sendStatusEmail, updateRequest,
  } = useMarketingRequests({ userId: user?.id, role: user?.role, roles: user?.roles });

  const [statusFilter, setStatusFilter]   = useState("pendente");
  const [approvingReq, setApprovingReq]   = useState(null);
  const [rejectingReq, setRejectingReq]   = useState(null);
  const [actionError,  setActionError]    = useState(null);
  const [sendingEmailId, setSendingEmailId] = useState(null);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter(r => r.status === statusFilter);
  }, [requests, statusFilter]);

  const counts = useMemo(() => ({
    pendente:  requests.filter(r => r.status === "pendente").length,
    aprovado:  requests.filter(r => r.status === "aprovado").length,
    rejeitado: requests.filter(r => r.status === "rejeitado").length,
  }), [requests]);

  const handleApproveConfirm = async (notes, destination) => {
    if (!approvingReq) return;
    setActionError(null);
    try {
      // Cria a entrega (ou tarefa, escolha do aprovador) e marca a
      // solicitação como aprovada numa única transação no banco
      // (approve_marketing_request / approve_marketing_request_as_task) —
      // evita registro órfão se a 2ª escrita falhasse (achado da auditoria
      // completa). Em seguida avisa o solicitante por e-mail — falha no
      // envio não desfaz a aprovação, só fica visível no card com opção de
      // tentar de novo.
      const res = destination === "tarefa"
        ? await approveAndCreateTask(approvingReq.id, notes)
        : await approveAndCreateDeliverable(approvingReq.id, notes);
      if (res?.error) setActionError(`Solicitação aprovada, mas o e-mail não pôde ser enviado: ${res.error}`);
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
      const res = await rejectRequest(rejectingReq.id, reason);
      if (res?.error) setActionError(`Solicitação rejeitada, mas o e-mail não pôde ser enviado: ${res.error}`);
    } catch (e) {
      setActionError(e.message || "Erro ao rejeitar solicitação.");
    } finally {
      setRejectingReq(null);
    }
  };

  const handleResendEmail = async (request) => {
    setActionError(null);
    setSendingEmailId(request.id);
    try {
      const res = await sendStatusEmail(request.id);
      if (!res.ok) setActionError(`Falha ao enviar e-mail: ${res.error}`);
    } finally {
      setSendingEmailId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Inbox}
        title="Solicitações"
        subtitle="Pedidos de material recebidos de outros departamentos"
        actions={
          <>
            <CopyPublicLinkButton url={`${window.location.origin}/solicitar-marketing`} label="Copiar link público" title={`${window.location.origin}/solicitar-marketing`} variant="strong" />
            <div
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
            >
              <AlertCircle size={12} />
              {counts.pendente} pendente{counts.pendente !== 1 ? "s" : ""}
            </div>
          </>
        }
      />

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
              onUpdateRequestNumber={(id, next) => updateRequest(id, { requestNumber: next })}
              onResendEmail={handleResendEmail}
              sendingEmail={sendingEmailId === req.id}
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
