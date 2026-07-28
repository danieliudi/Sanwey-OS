import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2, XCircle, Upload, FileText,
  TrendingUp, TrendingDown, AlertCircle, ExternalLink, Loader2,
  Activity, Paperclip, ListChecks, History,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { MARKETING_UNIT_LABELS, MARKETING_UNIT_COLORS } from "../../constants/companies";
import { PURCHASE_STAGES, PURCHASE_REJECTED_STAGE } from "../../hooks/use-marketing-purchase-requests";
import { formatDateBR } from "../../utils/date";
import { formatBRL } from "../../utils/currency";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { CommentsPanel } from "../shared/CommentsPanel";
import { getMentionableUsers } from "../../utils/mentionable-users";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { CurrencyInput } from "../ui/CurrencyInput";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { StageNavigator } from "../shared/StageNavigator";
import { DetailDrawerTabs } from "../shared/DetailDrawerTabs";
import { ActivityLog } from "./CampaignDetailDrawer";
import { RHAttachmentsPanel, RHChecklistsPanel, RHStageHistoryPanel } from "../rh-pipeline/RHDetailDrawerShell";

const BUCKET = "marketing-attachments";

const STAGE_COLORS = {
  solicitado:        "#D97706",
  cotacao:           "#CA8A04",
  aprovado:          "#2563EB",
  pedido_fornecedor: "#7C3AED",
  entrega_parcial:   "#0891B2",
  entregue:          "#16A34A",
  pago:              "#15803D",
  rejeitado:         "#DC2626",
};

// Ordem linear da esteira, pra saber quais blocos de campo por etapa já
// "foram alcançados" (e continuam visíveis/preenchíveis dali em diante,
// mesmo que a etapa atual seja mais adiante) — "rejeitado" fica de fora
// de propósito, tratado sempre como caso à parte.
const STAGE_ORDER = ["solicitado", "cotacao", "aprovado", "pedido_fornecedor", "entrega_parcial", "entregue", "pago"];

// Até 3 fornecedores candidatos na Cotação — sempre 3 linhas na edição
// (vazias viram "sem candidato" ao salvar), pedido do usuário.
function normalizeQuoteRows(options) {
  const rows = (Array.isArray(options) ? options : []).slice(0, 3).map(o => ({
    supplierId: o?.supplierId || "",
    value: o?.value != null ? String(o.value) : "",
  }));
  while (rows.length < 3) rows.push({ supplierId: "", value: "" });
  return rows;
}

const inputBase = {
  width: "100%", fontSize: 13, borderRadius: 8,
  border: "1px solid var(--border)", padding: "7px 10px",
  background: "var(--surface)", color: "var(--text)", outline: "none",
};

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ReadValue({ value, empty = "—" }) {
  return <div style={{ fontSize: 13, color: value ? "var(--text)" : "var(--text-dim)" }}>{value || empty}</div>;
}

export function PurchaseRequestDetailDrawer({
  purchase, onClose, onUpdate, onStageMoved,
  approvePurchase, rejectPurchase, getLastPurchasePrice,
  suppliers = [], users = [], currentUser, notifyMentions,
}) {
  useEscToClose(onClose);

  // Multi-cargo (FASE 1): checa `roles` (com fallback pro `role` escalar pra
  // qualquer leitura ainda não sincronizada) — mesmo critério do gate no
  // servidor (approve_purchase_request/reject_purchase_request + guard
  // trigger). Ampliado a pedido do usuário: qualquer pessoa de marketing em
  // geral pode aprovar/rejeitar agora, não só gerente_marketing/admin (ver
  // migration 20260764_marketing_purchase_requests_broaden_approval.sql).
  const currentUserRoles = currentUser?.roles?.length ? currentUser.roles : (currentUser?.role ? [currentUser.role] : []);
  const canApprove = currentUserRoles.includes("admin") || currentUserRoles.includes("marketing") || currentUserRoles.includes("gerente_marketing");
  const marketingUsers = useMemo(
    () => (users || []).filter(u => {
      const r = u.roles?.length ? u.roles : (u.role ? [u.role] : []);
      return r.includes("marketing") || r.includes("gerente_marketing") || r.includes("admin");
    }),
    [users]
  );

  // Comentários (FASE 4) — mesmo escopo de quem pode ser @mencionado que
  // marketingUsers acima (marketing/gerente_marketing/admin), via helper
  // compartilhado com os demais drawers.
  const mentionableUsers = useMemo(
    () => getMentionableUsers(users, { domain: "marketing" }),
    [users]
  );

  // `purchase.notes` é jsonb no banco — normaliza pro formato do CommentsPanel,
  // aceitando tanto o formato antigo ({text, createdAt}, sem autor) quanto o
  // novo ({authorId, authorName, text, mentionedIds, createdAt}).
  const comments = useMemo(
    () => (purchase.notes || []).filter(n => !n.deletedAt).map((n, idx) => {
      const author = users.find(u => u.id === n.authorId);
      return {
        id: n.id || `note-${idx}`,
        authorId: n.authorId || null,
        authorName: n.authorName || author?.name,
        avatarBg: n.avatarBg || author?.avatarBg,
        avatarUrl: n.avatarUrl || author?.avatarUrl,
        initials: n.initials || author?.initials,
        text: n.text,
        mentionedNames: Array.isArray(n.mentionedIds)
          ? n.mentionedIds.map(id => users.find(u => u.id === id)?.name).filter(Boolean)
          : [],
        createdAt: n.createdAt,
        editedAt: n.editedAt || null,
      };
    }),
    [purchase.notes, users]
  );

  const onUpdateComment = useCallback(async (id, patch) => {
    const updatedNotes = (purchase.notes || []).map(n => (n.id === id ? { ...n, ...patch } : n));
    await onUpdate(purchase.id, { notes: updatedNotes });
  }, [purchase, onUpdate]);

  const [supplierId,    setSupplierId]    = useState(purchase.supplierId || "");
  const [quantity,      setQuantity]      = useState(purchase.quantity ?? "");
  const [unitPrice,     setUnitPrice]     = useState(purchase.unitPrice ?? "");
  const [totalValue,    setTotalValue]    = useState(purchase.totalValue ?? "");
  const [responsibleIds, setResponsibleIds] = useState(purchase.responsibleIds?.length ? purchase.responsibleIds : (purchase.responsibleId ? [purchase.responsibleId] : []));
  const [invoiceDate,   setInvoiceDate]   = useState(purchase.invoiceDate ? purchase.invoiceDate.slice(0, 10) : "");
  const totalOverriddenRef = useRef(false);

  // Campos por etapa (pedido do usuário) — todos gravados junto com o resto
  // de "Execução da compra" no mesmo "Salvar alterações", pra persistir
  // sem precisar preencher de novo ao trocar de etapa.
  const [paymentTerms,         setPaymentTerms]         = useState(purchase.paymentTerms || "");
  const [supplierOrderCode,    setSupplierOrderCode]    = useState(purchase.supplierOrderCode || "");
  const [deliveryDeadline,     setDeliveryDeadline]     = useState(purchase.deliveryDeadline ? purchase.deliveryDeadline.slice(0, 10) : "");
  const [partialDeliveredQty,  setPartialDeliveredQty]  = useState(purchase.partialDeliveredQty ?? "");
  const [partialRemainingQty,  setPartialRemainingQty]  = useState(purchase.partialRemainingQty ?? "");
  const [partialNewDeadline,   setPartialNewDeadline]   = useState(purchase.partialNewDeadline ? purchase.partialNewDeadline.slice(0, 10) : "");
  const [partialNotes,         setPartialNotes]         = useState(purchase.partialNotes || "");
  const [invoiceNumber,        setInvoiceNumber]        = useState(purchase.invoiceNumber || "");
  const [paymentControlNumber, setPaymentControlNumber] = useState(purchase.paymentControlNumber || "");
  const [deliveredAt,          setDeliveredAt]          = useState(purchase.deliveredAt ? purchase.deliveredAt.slice(0, 10) : "");
  const [receivedBy,           setReceivedBy]           = useState(purchase.receivedBy || "");

  const [saving,      setSaving]      = useState(false);
  const [saveStatus,  setSaveStatus]  = useState(null); // "saved" | "error" | null
  const [saveError,   setSaveError]   = useState(null);

  const [uploading,    setUploading]    = useState(false);
  const [uploadError,  setUploadError]  = useState(null);
  const [invoiceUrl,   setInvoiceUrl]   = useState(purchase.invoiceUrl || null);
  const [viewingInvoice, setViewingInvoice] = useState(false);

  // Cotação de até 3 fornecedores (nova etapa "Cotação") — edição enquanto
  // a solicitação está nessa etapa; depois vira recapitulação read-only.
  const [quoteRows,    setQuoteRows]    = useState(() => normalizeQuoteRows(purchase.quoteOptions));
  const [savingQuotes, setSavingQuotes] = useState(false);
  const [quotesError,  setQuotesError]  = useState(null);
  const [winnerSupplierId, setWinnerSupplierId] = useState("");

  const [approveResponsible, setApproveResponsible] = useState(purchase.responsibleId || currentUser?.id || "");
  const [showReject,   setShowReject]   = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError,   setActionError]   = useState(null);

  const [lastPrice,     setLastPrice]     = useState(null);
  const [lastPriceError, setLastPriceError] = useState(null);

  const [centerTab, setCenterTab] = useState("form");

  useEffect(() => {
    setSupplierId(purchase.supplierId || "");
    setQuantity(purchase.quantity ?? "");
    setUnitPrice(purchase.unitPrice ?? "");
    setTotalValue(purchase.totalValue ?? "");
    setResponsibleIds(purchase.responsibleIds?.length ? purchase.responsibleIds : (purchase.responsibleId ? [purchase.responsibleId] : []));
    setInvoiceDate(purchase.invoiceDate ? purchase.invoiceDate.slice(0, 10) : "");
    setInvoiceUrl(purchase.invoiceUrl || null);
    setPaymentTerms(purchase.paymentTerms || "");
    setSupplierOrderCode(purchase.supplierOrderCode || "");
    setDeliveryDeadline(purchase.deliveryDeadline ? purchase.deliveryDeadline.slice(0, 10) : "");
    setPartialDeliveredQty(purchase.partialDeliveredQty ?? "");
    setPartialRemainingQty(purchase.partialRemainingQty ?? "");
    setPartialNewDeadline(purchase.partialNewDeadline ? purchase.partialNewDeadline.slice(0, 10) : "");
    setPartialNotes(purchase.partialNotes || "");
    setInvoiceNumber(purchase.invoiceNumber || "");
    setPaymentControlNumber(purchase.paymentControlNumber || "");
    setDeliveredAt(purchase.deliveredAt ? purchase.deliveredAt.slice(0, 10) : "");
    setReceivedBy(purchase.receivedBy || "");
    setQuoteRows(normalizeQuoteRows(purchase.quoteOptions));
    setWinnerSupplierId("");
    setApproveResponsible(purchase.responsibleId || currentUser?.id || "");
    totalOverriddenRef.current = false;
    setSaveStatus(null);
    setActionError(null);
    setUploadError(null);
    setQuotesError(null);
    setCenterTab("form");
  }, [purchase.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Comparação "valor pago no ano passado" — assim que fornecedor + item
  // estiverem definidos (mesmo fora de "solicitado", já que o fornecedor só
  // é escolhido depois da aprovação neste fluxo), busca a última compra paga.
  useEffect(() => {
    let alive = true;
    if (!supplierId || !purchase.itemName || !getLastPurchasePrice) {
      setLastPrice(null);
      return undefined;
    }
    getLastPurchasePrice(supplierId, purchase.itemName)
      .then(res => { if (alive) { setLastPrice(res); setLastPriceError(null); } })
      .catch(err => { if (alive) { setLastPrice(null); setLastPriceError(err.message || String(err)); } });
    return () => { alive = false; };
  }, [supplierId, purchase.itemName, getLastPurchasePrice]);

  const handleQuantityChange = (val) => {
    setQuantity(val);
    if (!totalOverriddenRef.current) {
      const q = parseFloat(val);
      const u = parseFloat(unitPrice);
      if (Number.isFinite(q) && Number.isFinite(u)) setTotalValue(String(q * u));
    }
  };
  const handleUnitPriceChange = (val) => {
    setUnitPrice(val);
    if (!totalOverriddenRef.current) {
      const q = parseFloat(quantity);
      const u = parseFloat(val);
      if (Number.isFinite(q) && Number.isFinite(u)) setTotalValue(String(q * u));
    }
  };
  const handleTotalValueChange = (val) => {
    totalOverriddenRef.current = true;
    setTotalValue(val);
  };

  const handleSaveFields = async () => {
    setSaving(true);
    setSaveStatus(null);
    setSaveError(null);
    try {
      await onUpdate(purchase.id, {
        supplierId:    supplierId || null,
        quantity:      quantity === "" ? null : Number(quantity),
        unitPrice:     unitPrice === "" ? null : Number(unitPrice),
        totalValue:    totalValue === "" ? null : Number(totalValue),
        responsibleId: responsibleIds[0] || null,
        responsibleIds,
        invoiceDate:   invoiceDate || null,
        paymentTerms:         paymentTerms || null,
        supplierOrderCode:    supplierOrderCode || null,
        deliveryDeadline:     deliveryDeadline || null,
        partialDeliveredQty:  partialDeliveredQty === "" ? null : Number(partialDeliveredQty),
        partialRemainingQty:  partialRemainingQty === "" ? null : Number(partialRemainingQty),
        partialNewDeadline:   partialNewDeadline || null,
        partialNotes:         partialNotes || null,
        invoiceNumber:        invoiceNumber || null,
        paymentControlNumber: paymentControlNumber || null,
        deliveredAt:          deliveredAt || null,
        receivedBy:           receivedBy || null,
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const updateQuoteRow = (idx, key, value) => {
    setQuoteRows(prev => prev.map((row, i) => i === idx ? { ...row, [key]: value } : row));
  };

  const handleSaveQuotes = async () => {
    setSavingQuotes(true);
    setQuotesError(null);
    try {
      const cleaned = quoteRows
        .filter(r => r.supplierId)
        .map(r => ({ supplierId: r.supplierId, value: r.value === "" ? null : Number(r.value) }));
      await onUpdate(purchase.id, { quoteOptions: cleaned });
    } catch (err) {
      setQuotesError(err.message || "Erro ao salvar cotações.");
    } finally {
      setSavingQuotes(false);
    }
  };

  const handleUploadInvoice = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `purchase-invoices/${purchase.id}/${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: true });
      if (uploadErr) throw uploadErr;
      await onUpdate(purchase.id, { invoiceUrl: path });
      setInvoiceUrl(path);
    } catch (err) {
      setUploadError(err.message || "Erro ao enviar nota fiscal.");
    } finally {
      setUploading(false);
    }
  };

  const handleViewInvoice = async () => {
    if (!invoiceUrl) return;
    setViewingInvoice(true);
    try {
      const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(invoiceUrl, 300);
      if (err) throw err;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setUploadError(err.message || "Erro ao abrir nota fiscal.");
    } finally {
      setViewingInvoice(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await approvePurchase(purchase.id, approveResponsible || null, purchase.stage === "cotacao" ? (winnerSupplierId || null) : null);
      onClose();
      onStageMoved?.(purchase.id);
    } catch (err) {
      setActionError(err.message || "Erro ao aprovar solicitação.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await rejectPurchase(purchase.id, rejectReason || null);
      onClose();
      onStageMoved?.(purchase.id);
    } catch (err) {
      setActionError(err.message || "Erro ao rejeitar solicitação.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveStage = async (stageId) => {
    if (stageId === "pago" && !invoiceUrl) {
      setActionError("Anexe a nota fiscal para poder marcar como pago.");
      return;
    }
    setActionError(null);
    try {
      // Append de `activities` (stage_change) já acontece dentro de
      // updatePurchase (hook), não aqui — mesmo update cobre também o
      // drag-and-drop do board (ComprasMarketingView.attemptStageChange),
      // que chama updatePurchase direto sem passar por este drawer.
      await onUpdate(purchase.id, { stage: stageId });
      onClose();
      onStageMoved?.(purchase.id);
    } catch (err) {
      setActionError(err.message || "Não foi possível mover a solicitação.");
    }
  };

  const handleAddComment = async (text, mentionedIds) => {
    const entry = {
      id: crypto.randomUUID(),
      authorId: currentUser?.id || null,
      authorName: currentUser?.name || null,
      avatarBg: currentUser?.avatarBg || null,
      text,
      mentionedIds,
      createdAt: new Date().toISOString(),
    };
    await onUpdate(purchase.id, { notes: [...(purchase.notes || []), entry] });
    if (mentionedIds?.length && notifyMentions) {
      notifyMentions(mentionedIds, {
        title: `${currentUser?.name} te mencionou`,
        body: `Em um comentário na compra "${purchase.itemName}" (${purchase.requestNumber})`,
        link: { module: "purchase_requests", id: purchase.id },
      });
    }
  };

  const supplier = suppliers.find(s => s.id === purchase.supplierId);
  const stageInfo = PURCHASE_STAGES.find(s => s.id === purchase.stage);
  const stageColor = STAGE_COLORS[purchase.stage] || "var(--text-dim)";
  const isRejected = purchase.stage === PURCHASE_REJECTED_STAGE;
  const isSolicitado = purchase.stage === "solicitado";
  const isCotacao = purchase.stage === "cotacao";
  // "Pendente de decisão" agora cobre Solicitado E Cotação — aprovar/rejeitar
  // (RPC) aceita as duas como etapa de origem (ver marketing_purchase_requests_
  // guard_approval / approve_purchase_request no banco).
  const isPending = isSolicitado || isCotacao;
  // Campos de execução só liberam depois da decisão (não faz sentido
  // preencher fornecedor/valor antes de ter cotação aprovada).
  const canEditFields = !isSolicitado && !isCotacao && !isRejected;
  const stageIdx = STAGE_ORDER.indexOf(purchase.stage);
  const reachedPedido        = stageIdx >= STAGE_ORDER.indexOf("pedido_fornecedor");
  const reachedEntregaParcial = stageIdx >= STAGE_ORDER.indexOf("entrega_parcial");
  const reachedEntregue      = stageIdx >= STAGE_ORDER.indexOf("entregue");
  // "Pago" só entra na lista de mover quando já tem nota fiscal — em vez de
  // mostrar desabilitado com tooltip, a seção "Nota fiscal" abaixo já deixa
  // claro o que falta; StageNavigator (compartilhado com o resto da
  // plataforma) não tem um estado "bloqueado" por item, só a lista toda.
  // Solicitado/Cotação ficam fora daqui — a transição pra elas/delas é
  // tratada à parte (mover pra Cotação, e Aprovar/Rejeitar com escolha de
  // fornecedor vencedor), não como um alvo livre do navegador de etapas.
  const movableStages = PURCHASE_STAGES
    .filter(s => s.id !== "solicitado" && s.id !== "cotacao" && s.id !== purchase.stage && (s.id !== "pago" || invoiceUrl))
    .map(s => ({ ...s, color: STAGE_COLORS[s.id] || "var(--text-dim)" }));
  const quoteOptions = Array.isArray(purchase.quoteOptions) ? purchase.quoteOptions : [];

  const currentTotal = totalValue === "" ? null : Number(totalValue);
  const priceDiff = lastPrice && currentTotal != null ? currentTotal - Number(lastPrice.total_value) : null;

  const header = (
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        {purchase.requestNumber && (
          <span className="font-mono font-bold text-sm" style={{ color: "var(--accent)" }}>
            {purchase.requestNumber}
          </span>
        )}
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: stageColor + "18", color: stageColor, border: `1px solid ${stageColor}40` }}>
          {stageInfo?.name || purchase.stage}
        </span>
      </div>
      <h2 className="font-bold" style={{ fontSize: 18, color: "var(--text)", letterSpacing: "-0.01em", wordBreak: "break-word" }}>
        {purchase.itemName}
      </h2>
    </div>
  );

  const left = (
    <>
      {isRejected && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-2" style={{ background: "#FEE2E2", color: "#B91C1C" }}>
          <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div className="font-semibold text-sm">Solicitação rejeitada</div>
            {purchase.rejectedReason && <div className="text-xs mt-0.5">{purchase.rejectedReason}</div>}
          </div>
        </div>
      )}

      <div>
        <SectionLabel>Solicitação</SectionLabel>
        <FieldRow label="Solicitante"><ReadValue value={purchase.requesterName} /></FieldRow>
        <FieldRow label="Prazo desejado"><ReadValue value={purchase.dueDate ? formatDateBR(purchase.dueDate) : null} /></FieldRow>
        {purchase.description && (
          <FieldRow label="Descrição">
            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{purchase.description}</div>
          </FieldRow>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(purchase.companyIds || []).map(id => {
            const color = MARKETING_UNIT_COLORS[id] || "#6B7280";
            return (
              <span key={id} className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: color + "18", color, border: `1px solid ${color}30` }}>
                {MARKETING_UNIT_LABELS[id] || id}
              </span>
            );
          })}
        </div>
        <div className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
          Criado em {purchase.createdAt ? new Date(purchase.createdAt).toLocaleDateString("pt-BR") : "—"}
        </div>
      </div>

      {supplierId && (
        <div className="rounded-xl border p-4" style={{ borderColor: "#BFDBFE", background: "#EFF6FF" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp size={13} style={{ color: "#1D4ED8" }} />
            <span className="text-xs font-bold" style={{ color: "#1D4ED8" }}>Comparar com ano passado</span>
          </div>
          {lastPrice ? (
            <div className="text-xs" style={{ color: "#1E3A8A", lineHeight: 1.6 }}>
              Última compra paga a este fornecedor: <strong>{formatBRL(Number(lastPrice.total_value))}</strong> em{" "}
              {formatDateBR(lastPrice.paid_at)} (protocolo {lastPrice.request_number})
              {priceDiff != null && (
                <div className="flex items-center gap-1 mt-1 font-semibold" style={{ color: priceDiff > 0 ? "#DC2626" : priceDiff < 0 ? "#16A34A" : "#1E3A8A" }}>
                  {priceDiff > 0 ? <TrendingUp size={12} /> : priceDiff < 0 ? <TrendingDown size={12} /> : null}
                  {priceDiff === 0
                    ? "Mesmo valor da última compra"
                    : `Valor atual está ${priceDiff > 0 ? "acima" : "abaixo"} em ${formatBRL(Math.abs(priceDiff))} em relação à última compra`}
                </div>
              )}
            </div>
          ) : lastPriceError ? (
            <div className="text-xs" style={{ color: "#1E3A8A" }}>{lastPriceError}</div>
          ) : (
            <div className="text-xs" style={{ color: "#1E3A8A" }}>Nenhuma compra paga anterior encontrada para este fornecedor e item.</div>
          )}
        </div>
      )}
    </>
  );

  const formTabContent = (
    <>
      {/* Cotação de fornecedores — editável na etapa "Cotação"; recapitulação
          read-only depois (mostra o vencedor destacado). Aposenta o fluxo
          antigo de marketing_supplier_quotes/e-mail formal. */}
      {!isRejected && !isSolicitado && (isCotacao || quoteOptions.length > 0) && (
        <div>
          <SectionLabel>Cotação de fornecedores</SectionLabel>
          {isCotacao ? (
            <>
              {quoteRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-3 mb-2">
                  <FieldRow label={`Fornecedor ${idx + 1}`}>
                    <select value={row.supplierId} onChange={e => updateQuoteRow(idx, "supplierId", e.target.value)} style={{ ...inputBase, cursor: "pointer" }}>
                      <option value="">Selecione…</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </FieldRow>
                  <FieldRow label="Valor">
                    <CurrencyInput value={row.value} onChange={v => updateQuoteRow(idx, "value", v)} style={inputBase} />
                  </FieldRow>
                </div>
              ))}
              {quotesError && (
                <div className="text-xs px-3 py-2 rounded-lg mb-2" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{quotesError}</div>
              )}
              <button onClick={handleSaveQuotes} disabled={savingQuotes}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "var(--accent)", color: "#FFF", border: "none", cursor: savingQuotes ? "default" : "pointer", opacity: savingQuotes ? 0.6 : 1 }}>
                {savingQuotes ? "Salvando…" : "Salvar cotações"}
              </button>
            </>
          ) : (
            <div className="space-y-1.5">
              {quoteOptions.map((q, idx) => {
                const s = suppliers.find(sup => sup.id === q.supplierId);
                const won = q.supplierId && q.supplierId === purchase.supplierId;
                return (
                  <div key={idx} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg"
                    style={won ? { background: "#DCFCE7", color: "#15803D", fontWeight: 700 } : { background: "var(--surface-alt)", color: "var(--text)" }}>
                    <span>{s?.name || "—"}{won ? " · vencedor" : ""}</span>
                    <span>{q.value != null ? formatBRL(Number(q.value)) : "—"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Execução da compra — habilita depois da aprovação; campos por etapa
          (Pedido ao Fornecedor / Entrega Parcial / Entregue) somam-se aqui
          conforme a solicitação avança, sem apagar o que já foi preenchido. */}
      {!isRejected && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <SectionLabel>Execução da compra</SectionLabel>
            {saveStatus && (
              <span style={{ fontSize: 10, marginTop: -10, color: saveStatus === "saved" ? "#16A34A" : "#DC2626", fontWeight: 700 }}>
                {saveStatus === "saved" ? "✓ Salvo" : "✗ Falha ao salvar"}
              </span>
            )}
          </div>
          {!canEditFields && (
            <div className="text-xs px-3 py-2 rounded-lg mb-3" style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
              Disponível após a aprovação da solicitação.
            </div>
          )}
          <fieldset disabled={!canEditFields} style={{ border: "none", padding: 0, margin: 0, opacity: canEditFields ? 1 : 0.55 }}>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Fornecedor">
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={{ ...inputBase, cursor: "pointer" }}>
                  <option value="">Selecione um fornecedor</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Responsável">
                <AssigneeMultiSelect
                  value={responsibleIds}
                  onChange={setResponsibleIds}
                  options={marketingUsers}
                  placeholder="Selecione responsáveis…"
                  disabled={!canEditFields}
                />
              </FieldRow>
              <FieldRow label="Quantidade">
                <input type="number" min="0" value={quantity} onChange={e => handleQuantityChange(e.target.value)} style={inputBase} />
              </FieldRow>
              <FieldRow label="Preço unitário">
                <CurrencyInput value={unitPrice} onChange={handleUnitPriceChange} style={inputBase} />
              </FieldRow>
              <FieldRow label="Valor total">
                <CurrencyInput value={totalValue} onChange={handleTotalValueChange} style={inputBase} />
              </FieldRow>
              <FieldRow label="Prazo de pagamento">
                <input type="text" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="Ex: 30 dias após entrega" style={inputBase} />
              </FieldRow>
            </div>

            {reachedPedido && (
              <>
                <div className="mt-3 mb-2"><SectionLabel>Pedido ao fornecedor</SectionLabel></div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Código de pedido do fornecedor">
                    <input type="text" value={supplierOrderCode} onChange={e => setSupplierOrderCode(e.target.value)} style={inputBase} />
                  </FieldRow>
                  <FieldRow label="Prazo de entrega">
                    <input type="date" value={deliveryDeadline} onChange={e => setDeliveryDeadline(e.target.value)} style={inputBase} />
                  </FieldRow>
                </div>
              </>
            )}

            {reachedEntregaParcial && (
              <>
                <div className="mt-3 mb-2"><SectionLabel>Entrega parcial</SectionLabel></div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Quantidade entregue">
                    <input type="number" min="0" value={partialDeliveredQty} onChange={e => setPartialDeliveredQty(e.target.value)} style={inputBase} />
                  </FieldRow>
                  <FieldRow label="Quanto falta entregar">
                    <input type="number" min="0" value={partialRemainingQty} onChange={e => setPartialRemainingQty(e.target.value)} style={inputBase} />
                  </FieldRow>
                  <FieldRow label="Novo prazo de entrega (restante)">
                    <input type="date" value={partialNewDeadline} onChange={e => setPartialNewDeadline(e.target.value)} style={inputBase} />
                  </FieldRow>
                </div>
                <FieldRow label="Detalhes extras">
                  <textarea value={partialNotes} onChange={e => setPartialNotes(e.target.value)} rows={2} style={{ ...inputBase, resize: "vertical" }} />
                </FieldRow>
              </>
            )}

            {reachedEntregue && (
              <>
                <div className="mt-3 mb-2"><SectionLabel>Entrega</SectionLabel></div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Número da nota fiscal">
                    <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} style={inputBase} />
                  </FieldRow>
                  <FieldRow label="Data da nota fiscal">
                    <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={inputBase} />
                  </FieldRow>
                  <FieldRow label="Número da CP (controle de pagamento)">
                    <input type="text" value={paymentControlNumber} onChange={e => setPaymentControlNumber(e.target.value)} style={inputBase} />
                  </FieldRow>
                  <FieldRow label="Data da entrega">
                    <input type="date" value={deliveredAt} onChange={e => setDeliveredAt(e.target.value)} style={inputBase} />
                  </FieldRow>
                  <FieldRow label="Quem recebeu">
                    <input type="text" value={receivedBy} onChange={e => setReceivedBy(e.target.value)} style={inputBase} />
                  </FieldRow>
                </div>
              </>
            )}

            {saveError && (
              <div className="text-xs px-3 py-2 rounded-lg mb-2 mt-2" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{saveError}</div>
            )}
            <button onClick={handleSaveFields} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold mt-2"
              style={{ background: "var(--accent)", color: "#FFF", border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </fieldset>
        </div>
      )}

      {/* Nota fiscal — só a partir de "Entregue" (antes disso ainda não há
          o que anexar; os campos de identificação da NF ficam no bloco
          "Entrega" acima). */}
      {!isRejected && reachedEntregue && (
        <div>
          <SectionLabel>Nota fiscal</SectionLabel>
          {invoiceUrl ? (
            <div className="flex items-center gap-2 mb-2">
              <button onClick={handleViewInvoice} disabled={viewingInvoice}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", cursor: "pointer" }}>
                <FileText size={12} />
                Ver nota fiscal
                <ExternalLink size={11} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg mb-2" style={{ background: "#FEF3C7", color: "#92400E" }}>
              <AlertCircle size={12} />
              Anexe a nota fiscal para poder marcar como pago.
            </div>
          )}
          <label
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer w-fit"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? "Enviando…" : invoiceUrl ? "Substituir nota fiscal" : "Anexar nota fiscal"}
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadInvoice(f); e.target.value = ""; }} />
          </label>
          {uploadError && (
            <div className="text-xs px-3 py-2 rounded-lg mt-2" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{uploadError}</div>
          )}
        </div>
      )}
    </>
  );

  const center = (
    <>
      <DetailDrawerTabs
        tabs={[
          { id: "form",       label: "Form",       icon: FileText },
          { id: "atividades", label: "Atividades", icon: Activity },
          { id: "historico",  label: "Histórico",  icon: History },
          { id: "anexos",     label: "Anexos",     icon: Paperclip },
          { id: "checklist",  label: "Checklist",  icon: ListChecks },
        ]}
        activeId={centerTab}
        onChange={setCenterTab}
      />
      {centerTab === "form" && formTabContent}
      {centerTab === "atividades" && <ActivityLog activities={purchase.activities || []} />}
      {centerTab === "historico" && (
        <RHStageHistoryPanel domain="marketing_purchase_requests" recordId={purchase.id} stages={PURCHASE_STAGES} currentUser={currentUser} users={users} />
      )}
      {centerTab === "anexos" && (
        <RHAttachmentsPanel domain="marketing_purchase_requests" recordId={purchase.id} currentUser={currentUser} />
      )}
      {centerTab === "checklist" && (
        <RHChecklistsPanel domain="marketing_purchase_requests" recordId={purchase.id} currentUser={currentUser} />
      )}
    </>
  );

  const canApproveNow = isCotacao ? (quoteOptions.length === 0 || Boolean(winnerSupplierId)) : true;

  const right = (
    <>
      {/* Mover pra Cotação — livre pra qualquer marketing, não exige
          gerente_marketing/admin (só aprovar/rejeitar exige). */}
      {isSolicitado && (
        <div>
          <SectionLabel>Mover para</SectionLabel>
          <StageNavigator
            targets={[{ id: "cotacao", name: "Cotação", color: STAGE_COLORS.cotacao }]}
            onMove={handleMoveStage}
            getKey={s => s.id}
          />
        </div>
      )}

      {/* Aprovar/Rejeitar — em "solicitado" ou "cotacao", só
          gerente_marketing/admin. Na Cotação, escolhe-se o fornecedor
          vencedor (se houver cotações salvas) antes de aprovar. */}
      {isPending && canApprove && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
          <SectionLabel>{isCotacao ? "Aprovar solicitação" : "Decisão"}</SectionLabel>

          {isCotacao && quoteOptions.length > 0 && (
            <FieldRow label="Fornecedor vencedor">
              <select value={winnerSupplierId} onChange={e => setWinnerSupplierId(e.target.value)} style={{ ...inputBase, cursor: "pointer" }}>
                <option value="">Selecione…</option>
                {quoteOptions.filter(q => q.supplierId).map(q => {
                  const s = suppliers.find(sup => sup.id === q.supplierId);
                  return (
                    <option key={q.supplierId} value={q.supplierId}>
                      {s?.name || q.supplierId}{q.value != null ? ` — ${formatBRL(Number(q.value))}` : ""}
                    </option>
                  );
                })}
              </select>
            </FieldRow>
          )}

          <FieldRow label="Responsável pela execução">
            <select value={approveResponsible} onChange={e => setApproveResponsible(e.target.value)} style={{ ...inputBase, cursor: "pointer" }}>
              <option value="">Selecione um responsável (opcional)</option>
              {marketingUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </FieldRow>

          {actionError && (
            <div className="text-xs px-3 py-2 rounded-lg mb-3" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{actionError}</div>
          )}

          {!showReject ? (
            <div className="flex items-center gap-2">
              {isCotacao && (
                <button onClick={handleApprove} disabled={actionLoading || !canApproveNow}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "#DCFCE7", color: "#15803D", border: "none", cursor: (actionLoading || !canApproveNow) ? "default" : "pointer", opacity: (actionLoading || !canApproveNow) ? 0.6 : 1 }}>
                  <CheckCircle2 size={13} />
                  {actionLoading ? "Aprovando…" : "Aprovar"}
                </button>
              )}
              <button onClick={() => setShowReject(true)} disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "#FEE2E2", color: "#DC2626", border: "none", cursor: actionLoading ? "default" : "pointer" }}>
                <XCircle size={13} />
                Rejeitar
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={2}
                placeholder="Motivo da rejeição (opcional)…"
                style={{ ...inputBase, resize: "none" }}
              />
              <div className="flex items-center gap-2">
                <button onClick={handleReject} disabled={actionLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "#DC2626", color: "#FFF", border: "none", cursor: actionLoading ? "default" : "pointer", opacity: actionLoading ? 0.6 : 1 }}>
                  {actionLoading ? "Rejeitando…" : "Confirmar rejeição"}
                </button>
                <button onClick={() => { setShowReject(false); setRejectReason(""); }} disabled={actionLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fallback de erro pra quem está em "solicitado"/"cotacao" mas SEM
          canApprove — o botão "Mover pra Cotação" acima é livre pra
          qualquer marketing (não exige canApprove), mas o único outro
          display de actionError fica dentro do bloco "isPending &&
          canApprove" logo acima. Sem este fallback, um erro de
          handleMoveStage nessa combinação (isPending && !canApprove) não
          aparecia em lugar nenhum — achado ao ampliar quem pode agir aqui. */}
      {!(isPending && canApprove) && actionError && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{actionError}</div>
      )}

      {!isRejected && !isPending && movableStages.length > 0 && (
        <div>
          <SectionLabel>Mover para</SectionLabel>
          <StageNavigator targets={movableStages} onMove={handleMoveStage} getKey={s => s.id} />
        </div>
      )}

      <CommentsPanel
        comments={comments}
        currentUser={currentUser}
        mentionableUsers={mentionableUsers}
        onAddComment={handleAddComment}
        onUpdateComment={onUpdateComment}
      />
    </>
  );

  return (
    <SplitPanelDrawer
      onClose={onClose}
      header={header}
      left={left}
      center={center}
      right={right}
    />
  );
}

export default PurchaseRequestDetailDrawer;
