import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X, CheckCircle2, XCircle, ArrowRight, Upload, FileText,
  TrendingUp, TrendingDown, AlertCircle, ExternalLink, Loader2,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { COMPANIES } from "../../constants/companies";
import { PURCHASE_STAGES, PURCHASE_REJECTED_STAGE } from "../../hooks/use-marketing-purchase-requests";
import { formatDateBR } from "../../utils/date";
import { formatBRL } from "../../utils/currency";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { CommentsPanel } from "../shared/CommentsPanel";
import { getMentionableUsers } from "../../utils/mentionable-users";

const BUCKET = "marketing-attachments";

const STAGE_COLORS = {
  solicitado:        "#D97706",
  aprovado:          "#2563EB",
  pedido_fornecedor: "#7C3AED",
  entrega_parcial:   "#0891B2",
  entregue:          "#16A34A",
  pago:              "#15803D",
  rejeitado:         "#DC2626",
};

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
  // servidor (approve_purchase_request/reject_purchase_request), que já usa
  // current_user_has_role('gerente_marketing').
  const currentUserRoles = currentUser?.roles?.length ? currentUser.roles : (currentUser?.role ? [currentUser.role] : []);
  const canApprove = currentUserRoles.includes("admin") || currentUserRoles.includes("gerente_marketing");
  const canEditFields = purchase.stage !== "solicitado" && purchase.stage !== PURCHASE_REJECTED_STAGE;
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
    () => (purchase.notes || []).map((n, idx) => {
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
      };
    }),
    [purchase.notes, users]
  );

  const [supplierId,    setSupplierId]    = useState(purchase.supplierId || "");
  const [quantity,      setQuantity]      = useState(purchase.quantity ?? "");
  const [unitPrice,     setUnitPrice]     = useState(purchase.unitPrice ?? "");
  const [totalValue,    setTotalValue]    = useState(purchase.totalValue ?? "");
  const [responsibleId, setResponsibleId] = useState(purchase.responsibleId || "");
  const [dueDate,       setDueDate]       = useState(purchase.dueDate ? purchase.dueDate.slice(0, 10) : "");
  const [invoiceDate,   setInvoiceDate]   = useState(purchase.invoiceDate ? purchase.invoiceDate.slice(0, 10) : "");
  const totalOverriddenRef = useRef(false);

  const [saving,      setSaving]      = useState(false);
  const [saveStatus,  setSaveStatus]  = useState(null); // "saved" | "error" | null
  const [saveError,   setSaveError]   = useState(null);

  const [uploading,    setUploading]    = useState(false);
  const [uploadError,  setUploadError]  = useState(null);
  const [invoiceUrl,   setInvoiceUrl]   = useState(purchase.invoiceUrl || null);
  const [viewingInvoice, setViewingInvoice] = useState(false);

  const [approveResponsible, setApproveResponsible] = useState(purchase.responsibleId || currentUser?.id || "");
  const [showReject,   setShowReject]   = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError,   setActionError]   = useState(null);

  const [lastPrice,     setLastPrice]     = useState(null);
  const [lastPriceError, setLastPriceError] = useState(null);

  useEffect(() => {
    setSupplierId(purchase.supplierId || "");
    setQuantity(purchase.quantity ?? "");
    setUnitPrice(purchase.unitPrice ?? "");
    setTotalValue(purchase.totalValue ?? "");
    setResponsibleId(purchase.responsibleId || "");
    setDueDate(purchase.dueDate ? purchase.dueDate.slice(0, 10) : "");
    setInvoiceDate(purchase.invoiceDate ? purchase.invoiceDate.slice(0, 10) : "");
    setInvoiceUrl(purchase.invoiceUrl || null);
    setApproveResponsible(purchase.responsibleId || currentUser?.id || "");
    totalOverriddenRef.current = false;
    setSaveStatus(null);
    setActionError(null);
    setUploadError(null);
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
        responsibleId: responsibleId || null,
        dueDate:       dueDate || null,
        invoiceDate:   invoiceDate || null,
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
      await approvePurchase(purchase.id, approveResponsible || null);
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
  const responsibleUser = users.find(u => u.id === purchase.responsibleId);
  const stageInfo = PURCHASE_STAGES.find(s => s.id === purchase.stage);
  const stageColor = STAGE_COLORS[purchase.stage] || "var(--text-dim)";
  const movableStages = PURCHASE_STAGES.filter(s => s.id !== "solicitado" && s.id !== purchase.stage);
  const isRejected = purchase.stage === PURCHASE_REJECTED_STAGE;
  const isPending = purchase.stage === "solicitado";

  const currentTotal = totalValue === "" ? null : Number(totalValue);
  const priceDiff = lastPrice && currentTotal != null ? currentTotal - Number(lastPrice.total_value) : null;

  return (
    <div
      className="fixed inset-0 z-40 flex lg:items-center lg:justify-center lg:p-6"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full flex-1 flex flex-col lg:flex-none lg:max-w-2xl lg:rounded-2xl lg:max-h-[92vh]"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)", overflow: "hidden", height: "100%" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-5 py-4 border-b flex items-start justify-between gap-3"
          style={{ background: "rgba(255,255,255,0.97)", borderColor: "var(--border)", backdropFilter: "blur(8px)" }}
        >
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
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
            style={{ color: "var(--text-dim)", background: "none", border: "none" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          {isRejected && (
            <div className="rounded-xl px-4 py-3 flex items-start gap-2" style={{ background: "#FEE2E2", color: "#B91C1C" }}>
              <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div className="font-semibold text-sm">Solicitação rejeitada</div>
                {purchase.rejectedReason && <div className="text-xs mt-0.5">{purchase.rejectedReason}</div>}
              </div>
            </div>
          )}

          {/* Read-only info grid */}
          <div>
            <SectionLabel>Solicitação</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Solicitante"><ReadValue value={purchase.requesterName} /></FieldRow>
              <FieldRow label="Prazo desejado"><ReadValue value={purchase.dueDate ? formatDateBR(purchase.dueDate) : null} /></FieldRow>
              <FieldRow label="E-mail"><ReadValue value={purchase.requesterEmail} /></FieldRow>
              <FieldRow label="Telefone"><ReadValue value={purchase.requesterPhone} /></FieldRow>
            </div>
            {purchase.description && (
              <FieldRow label="Descrição">
                <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{purchase.description}</div>
              </FieldRow>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {(purchase.companyIds || []).map(id => {
                const co = COMPANIES[id];
                if (!co) return null;
                return (
                  <span key={id} className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: co.primary + "18", color: co.primary, border: `1px solid ${co.primary}30` }}>
                    {co.short}
                  </span>
                );
              })}
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                Criado em {purchase.createdAt ? new Date(purchase.createdAt).toLocaleDateString("pt-BR") : "—"}
              </span>
            </div>
          </div>

          {/* Approve / reject — só em "solicitado" e só gerente_marketing/admin */}
          {isPending && canApprove && (
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
              <SectionLabel>Aprovar solicitação</SectionLabel>
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
                  <button onClick={handleApprove} disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "#DCFCE7", color: "#15803D", border: "none", cursor: actionLoading ? "default" : "pointer", opacity: actionLoading ? 0.6 : 1 }}>
                    <CheckCircle2 size={13} />
                    {actionLoading ? "Aprovando…" : "Aprovar"}
                  </button>
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

          {/* Comparação com última compra paga */}
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

          {/* Editable fields — habilitados só após a aprovação */}
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
                    <select value={responsibleId} onChange={e => setResponsibleId(e.target.value)} style={{ ...inputBase, cursor: "pointer" }}>
                      <option value="">Selecione um responsável</option>
                      {marketingUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </FieldRow>
                  <FieldRow label="Quantidade">
                    <input type="number" min="0" value={quantity} onChange={e => handleQuantityChange(e.target.value)} style={inputBase} />
                  </FieldRow>
                  <FieldRow label="Preço unitário (R$)">
                    <input type="number" min="0" step="0.01" value={unitPrice} onChange={e => handleUnitPriceChange(e.target.value)} style={inputBase} />
                  </FieldRow>
                  <FieldRow label="Valor total (R$)">
                    <input type="number" min="0" step="0.01" value={totalValue} onChange={e => handleTotalValueChange(e.target.value)} style={inputBase} />
                  </FieldRow>
                  <FieldRow label="Prazo">
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputBase} />
                  </FieldRow>
                  <FieldRow label="Data da nota fiscal">
                    <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={inputBase} />
                  </FieldRow>
                </div>

                {saveError && (
                  <div className="text-xs px-3 py-2 rounded-lg mb-2" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{saveError}</div>
                )}
                <button onClick={handleSaveFields} disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: "var(--accent)", color: "#FFF", border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Salvando…" : "Salvar alterações"}
                </button>
              </fieldset>
            </div>
          )}

          {/* Nota fiscal */}
          {!isRejected && (
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

          {/* Stage mover */}
          {!isRejected && !isPending && movableStages.length > 0 && (
            <div>
              <SectionLabel>Mover para etapa</SectionLabel>
              {actionError && (
                <div className="text-xs px-3 py-2 rounded-lg mb-2" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{actionError}</div>
              )}
              <div className="flex flex-wrap gap-2">
                {movableStages.map(s => {
                  const color = STAGE_COLORS[s.id] || "var(--text-dim)";
                  const blocked = s.id === "pago" && !invoiceUrl;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleMoveStage(s.id)}
                      disabled={blocked}
                      title={blocked ? "Anexe a nota fiscal para poder marcar como pago." : undefined}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: color + "14", color, border: `1px solid ${color}30`, cursor: blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.5 : 1 }}
                    >
                      {s.name}
                      <ArrowRight size={11} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comentários — sempre visível, em qualquer etapa (inclusive rejeitado) */}
          <div>
            <CommentsPanel
              comments={comments}
              currentUser={currentUser}
              mentionableUsers={mentionableUsers}
              onAddComment={handleAddComment}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PurchaseRequestDetailDrawer;
