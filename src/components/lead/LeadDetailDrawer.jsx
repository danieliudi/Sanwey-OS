import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, MapPin, AlertTriangle, Network, Package, Users, Sparkles, Copy, Send,
  Calendar, ExternalLink, Linkedin, Newspaper, MessageSquareWarning, Search,
  Building2, RefreshCw, Check, Trash2, Mail, ChevronDown, ChevronUp,
  Clock, MessageSquare, GitBranch, CalendarClock, ArrowLeft, ArrowRight, History,
} from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { CompanyTag } from "../ui/CompanyTag";
import { UrgencyTag } from "../ui/UrgencyTag";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { formatK, formatBRL } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";
import { useCnpjLookup } from "../../hooks/use-cnpj-lookup";
import { useStageFields } from "../../hooks/use-stage-fields";
import { useSingleLeadHistory } from "../../hooks/use-single-lead-history";
import { isSupabaseConfigured } from "../../lib/supabase";
import { LeadAIPanel } from "../ai/LeadAIPanel";
import { StageFieldInput } from "./StageFieldInput";

const STAGE_OPTIONS = DEFAULT_PIPELINE_STAGES.map(s => ({ value: s.id, label: s.name }));

export function LeadDetailDrawer({ lead, onClose, onUpdate, onDelete, onAddActivity, allLeads, users, isManager, currentUser }) {
  const [stage, setStage] = useState(lead?.stage ?? null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [showFollowUpInput, setShowFollowUpInput] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingContactEmail, setEditingContactEmail] = useState(false);
  const [contactEmailDraft, setContactEmailDraft] = useState("");
  const [emailsOpen, setEmailsOpen] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const { loading: enriching, error: enrichError, data: enrichData, lookup, reset: resetEnrich } = useCnpjLookup();
  const stageFields = useStageFields();
  const customDefs = lead ? stageFields.getFields(lead.companyId, lead.stage) : [];
  const customValues = lead?.customFields || {};
  const { entries: stageHistory } = useSingleLeadHistory(lead?.id);

  // Edição inline dos campos customizados da etapa.
  // Mantém o digitado localmente e salva com debounce (600ms) para não bater
  // no Supabase a cada tecla.
  const [customDraft, setCustomDraft] = useState({});
  const customDebounceRef = useRef(null);

  useEffect(() => {
    setCustomDraft({});
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
  }, [lead?.id]);

  const handleCustomChange = useCallback((fieldKey, value) => {
    setCustomDraft(prev => ({ ...prev, [fieldKey]: value }));
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    customDebounceRef.current = setTimeout(() => {
      if (!lead) return;
      const merged = { ...(lead.customFields || {}), [fieldKey]: value };
      onUpdate(lead.id, { customFields: merged });
    }, 600);
  }, [lead, onUpdate]);

  const getCustomValue = useCallback((fieldKey) => {
    return fieldKey in customDraft ? customDraft[fieldKey] : (customValues[fieldKey] ?? "");
  }, [customDraft, customValues]);

  // Resolve prev/next non-terminal stages based on the default pipeline order.
  const stageNav = useMemo(() => {
    if (!lead?.stage) return { prev: null, next: null };
    const idx = DEFAULT_PIPELINE_STAGES.findIndex(s => s.id === lead.stage);
    if (idx < 0) return { prev: null, next: null };
    const prev = idx > 0 ? DEFAULT_PIPELINE_STAGES[idx - 1] : null;
    // Next: skip terminal stages
    const next = idx < DEFAULT_PIPELINE_STAGES.length - 1
      ? DEFAULT_PIPELINE_STAGES[idx + 1]
      : null;
    return { prev, next };
  }, [lead?.stage]);

  const moveToStage = useCallback((toStage) => {
    if (!lead || !toStage) return;
    setStage(toStage);
    onUpdate(lead.id, { stage: toStage, status: toStage, stageChangedAt: new Date().toISOString() });
  }, [lead, onUpdate]);

  useEffect(() => { resetEnrich(); }, [lead?.id, resetEnrich]);

  useEffect(() => {
    if (!lead) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lead, onClose]);

  useEffect(() => {
    if (lead) {
      setStage(lead.stage);
      setFollowUpDate(lead.nextFollowUp ? lead.nextFollowUp.slice(0, 10) : "");
      setShowFollowUpInput(false);
      setConfirmDelete(false);
      setEditingContactEmail(false);
      setContactEmailDraft(lead.contactEmail || "");
      setNoteText("");
    }
  }, [lead?.id, lead?.stage]);

  const handleAddNote = useCallback(async () => {
    const text = noteText.trim();
    if (!text || !onAddActivity) return;
    setNoteSaving(true);
    try {
      await onAddActivity(lead.id, {
        type: 'note',
        userId: currentUser?.id || null,
        userName: currentUser?.name || null,
        body: text,
      });
      setNoteText("");
    } finally {
      setNoteSaving(false);
    }
  }, [noteText, onAddActivity, lead?.id, currentUser]);

  const overlaps = useMemo(() => {
    if (!isManager || !lead || !lead.company) return [];
    const norm = (s) => (s || "").replace(/\s*\(.*\)\s*/g, "").trim().toLowerCase();
    const key = norm(lead.company);
    return allLeads.filter(l => (
      l.id !== lead.id &&
      norm(l.company) === key &&
      l.companyId !== lead.companyId
    ));
  }, [lead, allLeads, isManager]);

  const sellerOptions = useMemo(() => {
    if (!lead) return [];
    return (users || [])
      .filter(u => (u.role === "vendedor" || u.role === "consultor") && Array.isArray(u.companies) && u.companies.includes(lead.companyId))
      .map(u => ({ value: u.id, label: u.name }));
  }, [lead, users]);

  const company = lead ? COMPANIES[lead.companyId] : null;
  const decisionMakerName = lead?.decisionMaker?.name || "—";
  const decisionMakerRole = lead?.decisionMaker?.role || "—";
  const decisionMakerInitials = useMemo(() => {
    if (!decisionMakerName || decisionMakerName === "—") return "—";
    return decisionMakerName.split(" ").map(n => n[0]).filter(Boolean).join("").slice(0, 2);
  }, [decisionMakerName]);
  const firstName = decisionMakerName?.split(" ")[0] || "time";

  // Normalize probability for display (handle both 0–1 and 0–100 formats)
  const probDisplay = lead
    ? (lead.probability > 1 ? Math.round(lead.probability) : Math.round(lead.probability * 100))
    : 0;

  const emailDraft = useMemo(() => {
    if (!lead || !company) return "";
    const senderName = currentUser?.name || "[Seu nome]";
    const senderEmail = currentUser?.email ? `\n${currentUser.email}` : "";
    return `Olá ${firstName},\n\nIdentifiquei que a ${lead.company} teve ${(lead.evidence || "").toLowerCase()}.\n\nSou da ${company.name} e gostaria de entender melhor como podemos apoiar nesse momento.\n\nPodemos agendar 20 minutos esta semana?\n\nAbraço,\n${senderName}${senderEmail}\n${company.name}`;
  }, [lead, company, firstName, currentUser]);

  // IMPORTANT: todos os hooks precisam rodar antes de qualquer return.
  // researchLinks vinha sendo declarado depois do early-return abaixo, o
  // que disparava React error #310 ("Rendered more hooks than during the
  // previous render") ao abrir o drawer pela primeira vez.
  const researchLinks = useMemo(() => {
    if (!lead) return [];
    const name = lead.company;
    const nameEnc = encodeURIComponent(name);
    const queryEnc = encodeURIComponent(`${name} ${lead.cnpj || ""}`.trim());
    return [
      { id: "google", label: "Google", icon: Search, href: `https://www.google.com/search?q=${queryEnc}` },
      { id: "linkedin", label: "LinkedIn", icon: Linkedin, href: `https://www.linkedin.com/search/results/people/?keywords=${nameEnc}` },
      { id: "news", label: "Google News", icon: Newspaper, href: `https://news.google.com/search?q=${nameEnc}&hl=pt-BR` },
      { id: "reclameaqui", label: "Reclame Aqui", icon: MessageSquareWarning, href: `https://www.reclameaqui.com.br/busca/?q=${nameEnc}` },
    ];
  }, [lead]);

  if (!lead || !company) return null;

  const handleCopyDraft = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(emailDraft).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleStageChange = (e) => {
    const newStage = e.target.value;
    setStage(newStage);
    onUpdate(lead.id, { stage: newStage, stageChangedAt: new Date().toISOString() });
  };

  const handleOwnerChange = (e) => {
    onUpdate(lead.id, { owner: e.target.value || null });
  };

  const handleStartOutreach = () => {
    const subject = `${company.name} · ${lead.triggerLabel}`;
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailDraft)}`;
    window.location.href = href;
    onUpdate(lead.id, { lastActivity: new Date().toISOString() });
  };

  const handleEnrich = async () => {
    if (!lead?.cnpj) return;
    const res = await lookup(lead.cnpj);
    if (!res) return;
    const patch = {};
    if (res.razaoSocial && !lead.razaoSocial) patch.razaoSocial = res.razaoSocial;
    if (res.cnaeDesc) patch.sector = res.cnaeDesc;
    if (res.cnae) patch.cnae = res.cnae;
    if (res.size) patch.size = res.size;
    if (res.city && res.city !== "—") patch.city = res.city;
    if (res.state && res.state !== "—") patch.state = res.state;
    if (res.telefone) patch.phone = res.telefone;
    if (res.email) patch.contactEmail = res.email;
    if (res.capitalSocial) patch.capitalSocial = res.capitalSocial;
    if (res.address) patch.address = res.address;
    if (res.situacao) patch.situacao = res.situacao;
    if (Object.keys(patch).length > 0) onUpdate(lead.id, patch);
  };

  const handleSaveFollowUp = () => {
    if (!followUpDate) return;
    const d = new Date(followUpDate);
    if (Number.isNaN(d.getTime())) return;
    onUpdate(lead.id, { nextFollowUp: d.toISOString() });
    if (onAddActivity) {
      onAddActivity(lead.id, {
        type: 'follow_up_set',
        userId: currentUser?.id || null,
        userName: currentUser?.name || null,
        body: `Follow-up agendado para ${d.toLocaleDateString('pt-BR')}`,
        meta: { date: d.toISOString() },
      });
    }
    setShowFollowUpInput(false);
  };

  const handleCancelFollowUp = () => {
    setFollowUpDate(lead.nextFollowUp ? lead.nextFollowUp.slice(0, 10) : "");
    setShowFollowUpInput(false);
  };

  const handleStartEditContactEmail = () => {
    setContactEmailDraft(lead.contactEmail || "");
    setEditingContactEmail(true);
  };

  const handleSaveContactEmail = () => {
    onUpdate(lead.id, { contactEmail: contactEmailDraft.trim() || null });
    setEditingContactEmail(false);
  };

  const handleCancelContactEmail = () => {
    setContactEmailDraft(lead.contactEmail || "");
    setEditingContactEmail(false);
  };

  const canDelete = onDelete && (
    isManager ||
    (currentUser && (lead.owner === currentUser.id || lead.createdBy === currentUser.id))
  );

  const handleDeleteConfirmed = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(lead.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 md:p-6"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-6xl rounded-2xl flex flex-col"
        style={{
          background: "#FFFFFF",
          boxShadow: "0 24px 64px rgba(32,26,26,0.18)",
          maxHeight: "92vh",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer header */}
        <div
          className="sticky top-0 z-10 px-5 py-3.5 border-b flex items-center justify-between"
          style={{ background: "rgba(255,248,247,0.97)", borderColor: "#E5E7EB", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-2">
            <CompanyTag companyId={lead.companyId} />
            <UrgencyTag urgency={lead.urgency} />
          </div>
          <div className="flex items-center gap-1">
            {canDelete && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-lg transition-colors duration-150 cursor-pointer"
                style={{ color: NEUTRAL.slate }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#B91C1C"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = NEUTRAL.slate; }}
                aria-label="Excluir card"
                title="Excluir card"
              >
                <Trash2 size={16} />
              </button>
            )}
            {canDelete && confirmDelete && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDeleteConfirmed}
                  disabled={deleting}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  style={{ background: "#B91C1C", color: "#FFFFFF", border: "none", opacity: deleting ? 0.6 : 1 }}
                  onMouseEnter={e => { if (!deleting) e.currentTarget.style.background = "#7F1D1D"; }}
                  onMouseLeave={e => { if (!deleting) e.currentTarget.style.background = "#B91C1C"; }}
                >
                  {deleting ? "Excluindo…" : "Confirmar exclusão"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="p-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                  style={{ color: NEUTRAL.slate, background: "transparent", border: "none" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F1F3F5"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  Cancelar
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors duration-150 cursor-pointer"
              style={{ color: NEUTRAL.slate }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F1F3F5"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── BODY: 3 colunas (esquerda info / centro form da etapa / direita movimentação) ── */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

          {/* ───── LEFT SIDEBAR ───────────────────────────────────────── */}
          <aside
            className="w-full lg:w-[320px] shrink-0 overflow-y-auto border-b lg:border-b-0 lg:border-r p-5 space-y-4"
            style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
          >
            {/* Título do lead */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="font-bold mb-1" style={{ fontSize: 18, color: NEUTRAL.graphite, letterSpacing: "-0.02em", wordBreak: "break-word" }}>
                  {lead.company}
                </h2>
                <div className="flex items-center gap-1.5 text-xs flex-wrap" style={{ color: NEUTRAL.slate }}>
                  {lead.cnpj && <span className="font-mono">{lead.cnpj}</span>}
                  {lead.cnpj && (lead.sector || lead.city) && <span>·</span>}
                  {lead.sector && <span>{lead.sector}</span>}
                  {lead.sector && lead.city && <span>·</span>}
                  {lead.city && <span className="flex items-center gap-1"><MapPin size={11} />{lead.city}</span>}
                  {!lead.cnpj && !lead.sector && !lead.city && <span className="italic">Sem dados</span>}
                </div>
              </div>
              <FitScoreCircle score={lead.fitScore} size={48} />
            </div>

            {/* Formulário Inicial (vindo de captura pública) */}
            {customValues.capture_customer_name && (
              <div className="p-4 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: company.primary }}>
                    Formulário Inicial
                  </div>
                  {customValues.capture_source && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: "#FAFAFA", color: NEUTRAL.slate, letterSpacing: "0.08em" }}>
                      via {customValues.capture_source}
                    </span>
                  )}
                </div>
                <dl className="space-y-2.5 text-sm">
                  <CaptureRow label="Nome do Cliente" value={customValues.capture_customer_name} />
                  <CaptureRow label="Contato" value={customValues.capture_contact_phone} mono />
                  <CaptureRow label="E-mail" value={customValues.capture_contact_email} link={customValues.capture_contact_email ? `mailto:${customValues.capture_contact_email}` : null} />
                  <CaptureRow label="Produto de Interesse" value={customValues.capture_product_interest} />
                  <CaptureRow label="Prioridade" value={customValues.capture_priority} badge />
                  <CaptureRow label="Data de Prospecção" value={customValues.capture_prospect_date ? formatDateBR(customValues.capture_prospect_date) : null} />
                </dl>
                {customValues.capture_notes && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: "#F0F0F0" }}>
                    <div className="text-[11px] font-semibold mb-1" style={{ color: NEUTRAL.slate }}>Mensagem</div>
                    <div className="text-sm whitespace-pre-line" style={{ color: NEUTRAL.graphite }}>{customValues.capture_notes}</div>
                  </div>
                )}
              </div>
            )}

            {/* Histórico de etapas */}
            {stageHistory.length > 0 && (
              <div className="p-4 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}>
                <div className="flex items-center gap-1.5 mb-3" style={{ color: NEUTRAL.slate }}>
                  <History size={13} />
                  <span className="text-xs font-semibold">Histórico</span>
                </div>
                <ol className="space-y-2.5 relative" style={{ paddingLeft: 18 }}>
                  <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 1, background: "#E5E7EB" }} />
                  {stageHistory.slice(0, 8).map((h, i) => {
                    const toStage = DEFAULT_PIPELINE_STAGES.find(s => s.id === h.toStage);
                    const fromStage = h.fromStage ? DEFAULT_PIPELINE_STAGES.find(s => s.id === h.fromStage) : null;
                    return (
                      <li key={i} className="relative">
                        <div style={{
                          position: "absolute", left: -16, top: 3,
                          width: 9, height: 9, borderRadius: "50%",
                          background: toStage?.color || NEUTRAL.slate,
                          border: "2px solid #FFFFFF", boxShadow: "0 0 0 1px #E5E7EB",
                        }} />
                        <div className="text-xs" style={{ color: NEUTRAL.graphite }}>
                          {fromStage ? (
                            <>{fromStage.name} <span style={{ color: NEUTRAL.slate }}>→</span> <strong>{toStage?.name || h.toStage}</strong></>
                          ) : (
                            <strong>{toStage?.name || h.toStage}</strong>
                          )}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: NEUTRAL.slate }}>
                          {new Date(h.changedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </div>
                      </li>
                    );
                  })}
                  {stageHistory.length > 8 && (
                    <li className="text-[11px]" style={{ color: NEUTRAL.slate }}>
                      +{stageHistory.length - 8} eventos anteriores
                    </li>
                  )}
                </ol>
              </div>
            )}
          </aside>

          {/* ───── CENTER ─────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0 overflow-y-auto p-5 space-y-4">

          {/* ── Pipeline stage progress bar ───────────────────────────────── */}
          <PipelineStageBar currentStage={stage || lead.stage} companyColor={company.primary} />

          {/* ── Hero metrics ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2">
            <HeroMetric label="VALOR" value={formatK(lead.value, 1)} />
            <HeroMetric label="PROB." value={`${probDisplay}%`} color={company.primary} />
            <HeroMetric label="FECHAMENTO" value={formatDateBR(lead.closeDate) || "—"} />
          </div>

          {/* Enriquecimento RF */}
          {isSupabaseConfigured && (
            <div
              className="p-3.5 rounded-xl border flex items-start justify-between gap-3 flex-wrap"
              style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: NEUTRAL.slate }}>
                  <Building2 size={12} />
                  Receita Federal
                </div>
                {enrichData ? (
                  <div className="text-xs" style={{ color: NEUTRAL.graphite }}>
                    <div className="font-semibold">{enrichData.razaoSocial || enrichData.company}</div>
                    <div style={{ color: NEUTRAL.slate }}>
                      CNAE {enrichData.cnae} · {enrichData.porte || "—"} · {enrichData.situacao || "—"}
                      {enrichData.capitalSocial > 0 && ` · Capital ${formatBRL(enrichData.capitalSocial)}`}
                    </div>
                    {(enrichData.telefone || enrichData.email) && (
                      <div className="mt-0.5" style={{ color: NEUTRAL.slate }}>
                        {enrichData.telefone && <>📞 {enrichData.telefone}</>}
                        {enrichData.telefone && enrichData.email && " · "}
                        {enrichData.email && <>✉ {enrichData.email}</>}
                      </div>
                    )}
                  </div>
                ) : enrichError ? (
                  <div className="text-xs" style={{ color: "#B91C1C" }}>
                    {enrichError.message || String(enrichError)}
                  </div>
                ) : (
                  <div className="text-xs" style={{ color: NEUTRAL.slate }}>
                    Busca CNAE, porte, capital social e contatos.
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" icon={enriching ? RefreshCw : Building2}
                onClick={handleEnrich} disabled={enriching || !lead.cnpj}>
                {enriching ? "Buscando…" : enrichData ? "Re-buscar" : "Enriquecer"}
              </Button>
            </div>
          )}

          {/* Overlap (gerente) */}
          {isManager && overlaps.length > 0 && (
            <div
              className="p-3.5 rounded-xl border-l-4"
              style={{ background: "#FFFBE6", borderLeftColor: NEUTRAL.amber, borderTop: "1px solid #FFE680", borderRight: "1px solid #FFE680", borderBottom: "1px solid #FFE680" }}
            >
              <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#9A7A00" }}>
                <Network size={12} />
                Overlap detectado · visível só para gerente
              </div>
              <div className="text-sm mb-2" style={{ color: NEUTRAL.graphite }}>
                Este cliente também está ativo em:
              </div>
              {overlaps.map(o => {
                const u = users.find(x => x.id === o.owner);
                return (
                  <div
                    key={o.id}
                    className="text-xs p-2 rounded-lg mb-1 flex items-center justify-between"
                    style={{ background: "#FFFFFF" }}
                  >
                    <div className="flex items-center gap-2">
                      <CompanyTag companyId={o.companyId} />
                      <span style={{ color: NEUTRAL.graphite }}>{u?.name || "—"}</span>
                    </div>
                    <span className="font-mono" style={{ color: NEUTRAL.slate }}>
                      {formatK(o.value)} · {o.stage}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Trigger — only render if there's an actual trigger */}
          {(lead.triggerLabel || lead.evidence) && (
            <div
              className="p-3.5 rounded-xl border-l-4"
              style={{
                background: company.light,
                borderLeftColor: company.primary,
                border: `1px solid ${company.primary}20`,
                borderLeft: `4px solid ${company.primary}`,
              }}
            >
              <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: company.dark }}>
                <AlertTriangle size={12} />
                Gatilho{lead.triggerLabel ? ` · ${lead.triggerLabel}` : ""}
              </div>
              {lead.evidence && (
                <div className="text-sm" style={{ color: NEUTRAL.graphite }}>{lead.evidence}</div>
              )}
            </div>
          )}

          {/* Info tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <InfoTile label="Porte" value={lead.size || "—"} />
            <InfoTile label="Quantidade" value={lead.quantity ? `${lead.quantity} un` : "—"} />
            <InfoTile label="Probabilidade" value={`${probDisplay}%`} />
            <InfoTile label="Fechamento" value={formatDateBR(lead.closeDate)} />
          </div>

          {/* Campos customizados da etapa — editáveis inline (save debounced) */}
          {customDefs.length > 0 && (
            <div className="p-4 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: company.primary }}>
                  Fase atual · {DEFAULT_PIPELINE_STAGES.find(s => s.id === lead.stage)?.name || lead.stage}
                </div>
              </div>
              <div className="space-y-4">
                {customDefs.map(f => (
                  <div key={f.id}>
                    <label className="block" style={{ fontSize: 13, fontWeight: 700, color: NEUTRAL.graphite, marginBottom: 2 }}>
                      {f.required && <span style={{ color: "#b5000b", marginRight: 4 }}>*</span>}
                      {f.label}
                    </label>
                    {f.helpText && (
                      <div style={{ fontSize: 11, color: NEUTRAL.slate, marginBottom: 6 }}>{f.helpText}</div>
                    )}
                    <StageFieldInput
                      field={f}
                      value={getCustomValue(f.fieldKey)}
                      onChange={(val) => handleCustomChange(f.fieldKey, val)}
                      users={users}
                      companyId={lead.companyId}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Produto — só mostra se tiver SKU */}
          {(lead.skuName || lead.quantity > 0) && (
            <div className="p-4 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}>
              <div className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: company.primary }}>
                <Package size={12} />Produto vinculado
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>{lead.skuName || "—"}</div>
                  <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>
                    {lead.quantity || 0} un × {formatBRL(lead.unitPrice)}
                  </div>
                </div>
                <div className="font-bold text-lg" style={{ color: NEUTRAL.graphite }}>
                  {formatK(lead.value, 1)}
                </div>
              </div>
            </div>
          )}

          {/* Decisor */}
          <div className="p-4 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}>
            <div className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: company.primary }}>
              <Users size={12} />Decisor
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 text-sm"
                style={{ background: company.primary }}
              >
                {decisionMakerInitials}
              </div>
              <div>
                <div className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>{decisionMakerName}</div>
                <div className="text-xs" style={{ color: NEUTRAL.slate }}>{decisionMakerRole}</div>
              </div>
            </div>
          </div>

          {/* Etapa + Responsável */}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: NEUTRAL.slate }}>
                Etapa do funil
              </label>
              <Select value={stage || ""} onChange={handleStageChange} options={STAGE_OPTIONS} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: NEUTRAL.slate }}>
                Responsável
              </label>
              <Select
                value={lead.owner || ""}
                onChange={handleOwnerChange}
                placeholder="Sem responsável"
                options={sellerOptions}
              />
            </div>
          </div>

          {/* E-mail do contato */}
          <div className="p-4 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: NEUTRAL.slate }}>
                <Mail size={13} />
                E-mail do contato
              </div>
              {!editingContactEmail && (
                <button
                  onClick={handleStartEditContactEmail}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer"
                  style={{ color: company.primary, background: company.light }}
                  onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.95)"; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
                >
                  {lead.contactEmail ? "Alterar" : "Adicionar"}
                </button>
              )}
            </div>

            {lead.contactEmail && !editingContactEmail && (
              <div className="text-sm mt-1" style={{ color: NEUTRAL.graphite }}>
                {lead.contactEmail}
              </div>
            )}

            {!lead.contactEmail && !editingContactEmail && (
              <div className="text-xs mt-1 italic" style={{ color: NEUTRAL.slate }}>
                Nenhum e-mail cadastrado
              </div>
            )}

            {editingContactEmail && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="email"
                  value={contactEmailDraft}
                  onChange={e => setContactEmailDraft(e.target.value)}
                  placeholder="contato@empresa.com.br"
                  className="flex-1 text-sm rounded-lg border px-3 py-2 outline-none transition-colors"
                  style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
                  onFocus={e => { e.currentTarget.style.borderColor = company.primary; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; }}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveContactEmail(); if (e.key === "Escape") handleCancelContactEmail(); }}
                  autoFocus
                />
                <Button variant="primary" size="sm" accent={company.primary} icon={Check} onClick={handleSaveContactEmail}>
                  Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancelContactEmail}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          {/* E-mails vinculados */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
            <button
              onClick={() => setEmailsOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 transition-colors cursor-pointer"
              style={{ background: "#fef1f0", border: "none" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F1EDE8"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fef1f0"; }}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#201a1a" }}>
                <Mail size={13} style={{ color: "#6B7280" }} />
                E-mails vinculados
                {(lead.linkedEmails || []).length > 0 && (
                  <span
                    className="inline-flex items-center justify-center rounded-full text-xs font-bold px-1.5 py-0.5 ml-1"
                    style={{ background: company.primary + "22", color: company.primary, fontSize: 10, minWidth: 18 }}
                  >
                    {lead.linkedEmails.length}
                  </span>
                )}
              </div>
              {emailsOpen ? <ChevronUp size={14} style={{ color: "#6B7280" }} /> : <ChevronDown size={14} style={{ color: "#6B7280" }} />}
            </button>

            {emailsOpen && (
              <div style={{ background: "#fef1f0" }}>
                {(!lead.linkedEmails || lead.linkedEmails.length === 0) ? (
                  <div className="px-4 pb-4 pt-1 text-xs" style={{ color: "#6B7280" }}>
                    Nenhum e-mail vinculado ainda. Quando e-mails do Outlook forem detectados para{" "}
                    <span style={{ color: "#201a1a", fontWeight: 600 }}>
                      {lead.contactEmail || "o e-mail do contato"}
                    </span>
                    , aparecerão aqui.
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "#E5E7EB" }}>
                    {lead.linkedEmails.map((email, idx) => (
                      <div key={email.id || idx} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                            <span
                              className="text-xs font-bold"
                              style={{ color: email.direction === "sent" ? company.primary : "#201a1a" }}
                              title={email.direction === "sent" ? "Enviado" : "Recebido"}
                            >
                              {email.direction === "sent" ? "→" : "←"}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate" style={{ color: "#201a1a" }}>
                              {email.subject || "(sem assunto)"}
                            </div>
                            <div className="text-xs mt-0.5 truncate" style={{ color: "#6B7280" }}>
                              {email.direction === "sent" ? `Para: ${email.to}` : `De: ${email.from}`}
                            </div>
                          </div>
                          <div className="text-xs shrink-0" style={{ color: "#6B7280" }}>
                            {email.date ? formatDateBR(email.date) : "—"}
                          </div>
                        </div>
                        {idx < lead.linkedEmails.length - 1 && (
                          <div className="mt-3" style={{ borderTop: "1px solid #E5E7EB" }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Histórico de atividades */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#fef1f0", borderBottom: "1px solid #E5E7EB" }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: NEUTRAL.graphite }}>
                <Clock size={13} style={{ color: NEUTRAL.slate }} />
                Histórico de atividades
                {(lead.activities || []).length > 0 && (
                  <span
                    className="inline-flex items-center justify-center rounded-full text-xs font-bold px-1.5 py-0.5 ml-1"
                    style={{ background: company.primary + "22", color: company.primary, fontSize: 10, minWidth: 18 }}
                  >
                    {lead.activities.length}
                  </span>
                )}
              </div>
            </div>

            {/* Add note input */}
            {onAddActivity && (
              <div className="px-4 py-3 border-b" style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}>
                <div className="flex items-start gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                    style={{ background: company.primary, fontSize: 9 }}
                  >
                    {(currentUser?.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddNote(); }}
                      placeholder="Adicionar nota ou anotação..."
                      rows={noteText ? 3 : 1}
                      className="w-full text-sm rounded-lg border px-3 py-2 outline-none transition-colors resize-none"
                      style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#fef1f0", fontFamily: "inherit" }}
                      onFocus={e => { e.currentTarget.style.borderColor = company.primary; e.currentTarget.style.background = "#FFFFFF"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#fef1f0"; }}
                    />
                    {noteText.trim() && (
                      <div className="flex justify-end mt-1.5">
                        <button
                          onClick={handleAddNote}
                          disabled={noteSaving}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                          style={{ background: noteSaving ? "#E5E7EB" : company.primary, color: "#FFFFFF", border: "none", cursor: noteSaving ? "not-allowed" : "pointer" }}
                        >
                          <Send size={11} />
                          {noteSaving ? "Salvando..." : "Salvar nota"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div style={{ background: "#FFFFFF" }}>
              {(!lead.activities || lead.activities.length === 0) ? (
                <div className="px-4 py-5 text-xs text-center" style={{ color: NEUTRAL.slate }}>
                  Nenhuma atividade registrada ainda.
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "#F0EDE8" }}>
                  {[...(lead.activities)].reverse().map((act) => {
                    const isNote = act.type === 'note';
                    const isStage = act.type === 'stage_changed';
                    const isFollowUp = act.type === 'follow_up_set';
                    const isEmail = act.type === 'email_received' || act.type === 'email_sent';
                    const iconColor = isNote ? company.primary
                      : isStage ? NEUTRAL.slate
                      : isFollowUp ? NEUTRAL.amber
                      : isEmail ? "#2563EB"
                      : NEUTRAL.slate;
                    const Icon = isNote ? MessageSquare
                      : isStage ? GitBranch
                      : isFollowUp ? CalendarClock
                      : isEmail ? Mail
                      : Clock;
                    return (
                      <div key={act.id} className="px-4 py-3 flex items-start gap-3">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: iconColor + "18" }}
                        >
                          <Icon size={12} style={{ color: iconColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs leading-relaxed" style={{ color: NEUTRAL.graphite }}>
                            {act.body}
                          </div>
                          <div className="text-xs mt-1 flex items-center gap-2" style={{ color: NEUTRAL.slate }}>
                            {act.userName && (
                              <span className="font-medium">{act.userName}</span>
                            )}
                            <span>{act.timestamp ? new Date(act.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : "—"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* IA panel */}
          <LeadAIPanel
            lead={lead}
            currentUser={currentUser}
            activities={lead.activities || []}
            linkedEmails={lead.linkedEmails || []}
          />

          {/* Email draft */}
          <div className="p-4 rounded-xl" style={{ background: company.dark, color: "#FFFFFF" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#FFE9A8" }}>
                <Sparkles size={12} />Rascunho de abordagem
              </div>
              <button
                onClick={handleCopyDraft}
                className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-150"
                style={{ background: "rgba(255,255,255,0.12)", color: copied ? "#A3E6B4" : "rgba(255,255,255,0.8)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
            <div
              className="text-sm leading-relaxed whitespace-pre-line p-3 rounded-lg"
              style={{ background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)" }}
            >
              {emailDraft}
            </div>
          </div>

          {/* Follow-up inline */}
          <div className="p-4 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: NEUTRAL.slate }}>
                <Calendar size={13} />
                Follow-up agendado
              </div>
              {!showFollowUpInput && (
                <button
                  onClick={() => setShowFollowUpInput(true)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer"
                  style={{ color: company.primary, background: company.light }}
                  onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.95)"; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
                >
                  {lead.nextFollowUp ? "Alterar" : "Agendar"}
                </button>
              )}
            </div>

            {lead.nextFollowUp && !showFollowUpInput && (
              <div className="text-sm font-semibold mt-1" style={{ color: NEUTRAL.graphite }}>
                {formatDateBR(lead.nextFollowUp)}
              </div>
            )}

            {showFollowUpInput && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="flex-1 text-sm rounded-lg border px-3 py-2 outline-none transition-colors cursor-pointer"
                  style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
                  onFocus={e => { e.currentTarget.style.borderColor = company.primary; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; }}
                />
                <Button variant="primary" size="sm" accent={company.primary} icon={Check} onClick={handleSaveFollowUp}>
                  Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancelFollowUp}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-1 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="primary" icon={Send} accent={company.primary} onClick={handleStartOutreach}>
                Iniciar abordagem
              </Button>
            </div>
            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: NEUTRAL.slate }}>
                Pesquisar empresa em
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {researchLinks.map(l => {
                  const Icon = l.icon;
                  return (
                    <a
                      key={l.id}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 cursor-pointer"
                      style={{ borderColor: "#E5E7EB", background: "#FFFFFF", color: NEUTRAL.graphite }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#D0D0D0"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
                    >
                      <Icon size={12} strokeWidth={2} />
                      {l.label}
                      <ExternalLink size={10} style={{ color: NEUTRAL.slate }} />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
          </main>

          {/* ───── RIGHT SIDEBAR ─────────────────────────────────────── */}
          <aside
            className="w-full lg:w-[240px] shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l p-5"
            style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
          >
            <div className="text-xs font-semibold mb-3" style={{ color: NEUTRAL.graphite, letterSpacing: "0.02em" }}>
              Mover card para fase
            </div>
            <div className="space-y-2">
              {stageNav.next && (
                <button
                  onClick={() => moveToStage(stageNav.next.id)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                  style={{ background: company.primary + "14", color: company.primary, border: `1px solid ${company.primary}30` }}
                  onMouseEnter={e => { e.currentTarget.style.background = company.primary + "22"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = company.primary + "14"; }}
                >
                  <span>{stageNav.next.name}</span>
                  <ArrowRight size={14} />
                </button>
              )}
              {stageNav.prev && (
                <button
                  onClick={() => moveToStage(stageNav.prev.id)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  style={{ background: "#FFFFFF", color: NEUTRAL.graphite, border: "1px solid #E5E7EB" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; }}
                >
                  <ArrowLeft size={13} />
                  <span>{stageNav.prev.name}</span>
                </button>
              )}
            </div>

            <div className="mt-5 pt-4 border-t space-y-2" style={{ borderColor: "#E5E7EB" }}>
              <a
                href="#"
                onClick={e => { e.preventDefault(); /* future: open pipeline builder for this stage */ }}
                className="flex items-center gap-2 text-xs"
                style={{ color: NEUTRAL.slate, textDecoration: "none" }}
                onMouseEnter={e => { e.currentTarget.style.color = NEUTRAL.graphite; }}
                onMouseLeave={e => { e.currentTarget.style.color = NEUTRAL.slate; }}
              >
                <GitBranch size={12} />
                Configurar mover cards
              </a>
              <a
                href="#"
                onClick={e => { e.preventDefault(); /* future: AI-assisted move */ }}
                className="flex items-center gap-2 text-xs"
                style={{ color: NEUTRAL.slate, textDecoration: "none" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#7C3AED"; }}
                onMouseLeave={e => { e.currentTarget.style.color = NEUTRAL.slate; }}
              >
                <Sparkles size={12} />
                Mover cards com IA
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ── Pipeline stage bar ────────────────────────────────────────────────────────

function PipelineStageBar({ currentStage, companyColor }) {
  const nonTerminal = DEFAULT_PIPELINE_STAGES.filter(s => !s.terminal);
  const currentIdx = nonTerminal.findIndex(s => s.id === currentStage);
  const stageData = DEFAULT_PIPELINE_STAGES.find(s => s.id === currentStage);
  const isWon  = Boolean(stageData?.won);
  const isLost = Boolean(stageData?.lost);
  const isTerminal = isWon || isLost;

  return (
    <div
      className="p-4 rounded-xl border"
      style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}
    >
      <div
        className="text-[10px] font-semibold mb-3 tracking-widest uppercase"
        style={{ color: NEUTRAL.slate }}
      >
        Etapa atual
      </div>
      <div className="flex items-start">
        {nonTerminal.map((s, idx) => {
          const done   = isTerminal || idx < currentIdx;
          const active = !isTerminal && idx === currentIdx;
          const lineColor = done ? companyColor : "#E5E7EB";

          return (
            <React.Fragment key={s.id}>
              {idx > 0 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    marginTop: 9,
                    background: lineColor,
                    transition: "background 0.2s",
                  }}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 44 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: done ? companyColor : active ? companyColor : "#F1F3F5",
                    border: `2px solid ${done || active ? companyColor : "#D4D4D8"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.2s",
                  }}
                >
                  {done && (
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <polyline
                        points="1.5,5 4,7.5 8.5,2"
                        stroke="white"
                        strokeWidth="1.8"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {active && (
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} />
                  )}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    marginTop: 4,
                    textAlign: "center",
                    color: active ? companyColor : done ? NEUTRAL.slate : "#C4C4C8",
                    fontWeight: active ? 700 : 400,
                    maxWidth: 42,
                    lineHeight: 1.2,
                    transition: "color 0.2s",
                  }}
                >
                  {s.name}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Terminal node */}
        <div
          style={{
            flex: 1,
            height: 2,
            marginTop: 9,
            background: isWon ? "#16A34A" : isLost ? "#B91C1C" : "#E5E7EB",
            transition: "background 0.2s",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 44 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: isWon ? "#16A34A" : isLost ? "#B91C1C" : "#F1F3F5",
              border: `2px solid ${isWon ? "#16A34A" : isLost ? "#B91C1C" : "#D4D4D8"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
          >
            {isTerminal && (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <polyline
                  points="1.5,5 4,7.5 8.5,2"
                  stroke="white"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <div
            style={{
              fontSize: 9,
              marginTop: 4,
              textAlign: "center",
              color: isWon ? "#16A34A" : isLost ? "#B91C1C" : "#C4C4C8",
              fontWeight: isTerminal ? 700 : 400,
              maxWidth: 42,
              lineHeight: 1.2,
            }}
          >
            {isWon ? "Ganho" : isLost ? "Perdido" : "Fechado"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hero metric card ──────────────────────────────────────────────────────────

function HeroMetric({ label, value, color }) {
  return (
    <div
      style={{
        background: color ? color + "0D" : "#FFFFFF",
        borderRadius: 12,
        border: `1px solid ${color ? color + "22" : "#E5E7EB"}`,
        padding: "10px 14px",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: NEUTRAL.slate,
          letterSpacing: "0.10em",
          marginBottom: 3,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: color || NEUTRAL.graphite,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Info tile ─────────────────────────────────────────────────────────────────

function InfoTile({ label, value }) {
  return (
    <div className="p-3 rounded-xl" style={{ background: "#F1F3F5" }}>
      <div className="text-[11px] font-semibold mb-1" style={{ color: NEUTRAL.slate }}>
        {label}
      </div>
      <div className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>{value}</div>
    </div>
  );
}

function CaptureRow({ label, value, mono, link, badge }) {
  const dim = value === null || value === undefined || value === "";
  const priorityColor = badge && value === "Alta" ? "#DC2626"
    : badge && value === "Média" ? "#E8920A"
    : badge && value === "Baixa" ? "#16A34A"
    : null;
  return (
    <div>
      <dt className="text-[11px] font-semibold" style={{ color: NEUTRAL.slate }}>{label}</dt>
      <dd className={`text-sm ${mono ? "font-mono" : ""}`} style={{ color: dim ? NEUTRAL.slate : NEUTRAL.graphite, fontStyle: dim ? "italic" : "normal", marginTop: 2 }}>
        {dim ? "—" : link ? (
          <a href={link} style={{ color: "#1E4D8C", textDecoration: "none" }}>{value}</a>
        ) : badge ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: (priorityColor || NEUTRAL.slate) + "14", color: priorityColor || NEUTRAL.slate }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: priorityColor || NEUTRAL.slate }} />
            {value}
          </span>
        ) : value}
      </dd>
    </div>
  );
}

export default LeadDetailDrawer;
