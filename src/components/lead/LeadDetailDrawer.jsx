import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, MapPin, Network, Package, Users, Sparkles, Copy, Send,
  Calendar, ExternalLink, Linkedin, Newspaper, MessageSquareWarning, Search,
  Check, Trash2, Mail, ChevronDown, ChevronUp,
  Clock, GitBranch, CalendarClock, ArrowLeft, ArrowRight, History,
  FileText, Activity, Paperclip, ListChecks, FileDown, Plus, Upload, Download,
  File, FileImage, FileSpreadsheet, AlertCircle,
} from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { mergeGanhoDefaults } from "../../utils/won-stage-defaults";
import { CompanyTag } from "../ui/CompanyTag";
import { UrgencyTag } from "../ui/UrgencyTag";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { formatK, formatBRL } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";
import { useStageFields } from "../../hooks/use-stage-fields";
import { useSingleLeadHistory } from "../../hooks/use-single-lead-history";
import { useLeadAttachments } from "../../hooks/use-lead-attachments";
import { useLeadChecklists } from "../../hooks/use-lead-checklists";
import { LeadAIPanel } from "../ai/LeadAIPanel";
import { ProposalPanel } from "./ProposalPanel";
import { StageFieldInput } from "./StageFieldInput";
import { ClientSelector } from "../client/ClientSelector";
import { resolveVisibleFields, getMissingRequiredFields } from "../../utils/field-conditions";
import { getInvalidFields, EMAIL_PATTERN } from "../../utils/field-validation";
import { CommentsPanel } from "../shared/CommentsPanel";
import { getMentionableUsers } from "../../utils/mentionable-users";

const STAGE_OPTIONS = DEFAULT_PIPELINE_STAGES.map(s => ({ value: s.id, label: s.name }));

export function LeadDetailDrawer({ lead, onClose, onStageMoved, onUpdate, onDelete, onAddActivity, allLeads, users, clients = [], onCreateClient, isManager, currentUser, onNavigateToPipelineBuilder, pipelines, notifyMentions }) {
  const [stage, setStage] = useState(lead?.stage ?? null);
  const [sideTab, setSideTab] = useState("form");
  const [mobileTab, setMobileTab] = useState("info");
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
  const [moveError, setMoveError] = useState(null);

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
    setMobileTab("info");
    setMoveError(null);
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    return () => { if (customDebounceRef.current) clearTimeout(customDebounceRef.current); };
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

  // Mapa fieldKey -> valor atual (draft tem prioridade) pra avaliar campos
  // condicionais (visibleIf/requiredIf) em tempo real, a cada tecla. Não
  // memoiza — a lista de campos é pequena e precisa refletir customDraft
  // sempre, sem risco de dependência esquecida deixar isso desatualizado.
  const customValuesByKey = {};
  for (const f of customDefs) customValuesByKey[f.fieldKey] = getCustomValue(f.fieldKey);
  const visibleCustomDefs = resolveVisibleFields(customDefs, customValuesByKey);

  // Resolve prev/next non-terminal stages based on the default pipeline order.
  // Usa as etapas REAIS da empresa (do pipeline do banco, com as cores
  // configuradas), não a lista estática — assim o botão de mover reflete a
  // cor/ordem de etapa que aparece no board.
  const companyStages = (lead?.companyId && pipelines?.[lead.companyId]) || DEFAULT_PIPELINE_STAGES;
  const stageNav = useMemo(() => {
    if (!lead?.stage) return { prev: null, next: null };
    const idx = companyStages.findIndex(s => s.id === lead.stage);
    if (idx < 0) return { prev: null, next: null };
    const prev = idx > 0 ? companyStages[idx - 1] : null;
    const next = idx < companyStages.length - 1 ? companyStages[idx + 1] : null;
    return { prev, next };
  }, [lead?.stage, companyStages]);

  const moveToStage = useCallback((toStage) => {
    if (!lead || !toStage) return;
    // Enforcement real: bloqueia sair da etapa atual com campo obrigatório
    // (estático ou condicional) vazio — antes disso "required" era só o
    // asterisco visual, confirmado ao vivo que não travava nada. Antes usava
    // alert() nativo — bloqueante, e trava sessões automatizadas/headless
    // que não têm handler de diálogo (achado da auditoria de 14/07). Banner
    // inline não bloqueia nada.
    const missing = getMissingRequiredFields(customDefs, customValuesByKey);
    if (missing.length > 0) {
      setMoveError(`Não dá pra avançar: preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = getInvalidFields(customDefs, customValuesByKey);
    if (invalid.length > 0) {
      setMoveError(`Não dá pra mover: corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
    setMoveError(null);
    setStage(toStage);
    const nowISO = new Date().toISOString();
    const patch = { stage: toStage, status: toStage, stageChangedAt: nowISO };
    // Auto-preenchimento ao entrar em "ganho" (valor_final ← proposta,
    // data_fechamento ← hoje) — mesmo helper usado no drag/menu do board.
    if (toStage === "ganho" && lead.stage !== "ganho") {
      const mergedCF = mergeGanhoDefaults(lead.customFields, lead, nowISO);
      if (mergedCF) patch.customFields = mergedCF;
    }
    onUpdate(lead.id, patch);
    // Fecha o drawer agora (sinal visual de que moveu) e reabre já na etapa
    // nova — em vez de só trocar o conteúdo por baixo do drawer aberto.
    if (onStageMoved) {
      onClose();
      onStageMoved(lead.id);
    }
  }, [lead, onUpdate, onStageMoved, onClose, customDefs, customValuesByKey]);

  useEffect(() => {
    if (!lead) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lead, onClose]);

  // Auto-link cliente em leads legados que ainda não têm clientId.
  // Busca por CNPJ (exato) ou nome (case-insensitive). Se nada bater, cria.
  const autoLinkedRef = useRef(new Set());
  useEffect(() => {
    if (!lead?.id || lead.clientId || autoLinkedRef.current.has(lead.id)) return;
    if (!onCreateClient) return;
    const cnpjDigits = (lead.cnpj || "").replace(/\D/g, "");
    const nameLower = (lead.company || "").trim().toLowerCase();
    if (cnpjDigits.length < 8 && nameLower.length < 2) return;
    autoLinkedRef.current.add(lead.id);
    (async () => {
      let found = null;
      if (cnpjDigits.length >= 8) {
        found = (clients || []).find(c => (c.cnpj || "").replace(/\D/g, "") === cnpjDigits);
      }
      if (!found && nameLower.length >= 2) {
        found = (clients || []).find(c => (c.name || "").trim().toLowerCase() === nameLower);
      }
      try {
        if (found) {
          onUpdate(lead.id, { clientId: found.id });
        } else {
          const created = await onCreateClient({
            name: (lead.company || "Novo cliente").trim(),
            cnpj: lead.cnpj || null,
            city: lead.city || null,
            state: lead.state || null,
            companyIds: lead.companyId ? [lead.companyId] : [],
          });
          if (created?.id) onUpdate(lead.id, { clientId: created.id });
        }
      } catch { /* silencioso — drawer continua funcional sem vínculo */ }
    })();
  }, [lead?.id, lead?.clientId, lead?.cnpj, lead?.company, lead?.city, lead?.state, lead?.companyId, clients, onCreateClient, onUpdate]);

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

  // Quem pode ser @mencionado nos comentários deste lead — mesmo escopo do
  // picker de reatribuição de dono acima (vendedor/consultor só da mesma
  // empresa do card; gerente/admin sempre veem tudo).
  const mentionableUsers = useMemo(() => (
    getMentionableUsers(users, { domain: "crm", companyId: lead?.companyId })
  ), [users, lead?.companyId]);

  // Feed unificado de comentários (FASE 4) — mescla lead.notes (legado,
  // {text, createdAt}, sem autor) com lead.activities do tipo note/comment
  // (mais recentes, já têm userId/userName), normalizado pro formato que
  // CommentsPanel espera. Autor é sempre resolvido via users quando possível
  // — nunca inventamos um autor pra entradas antigas sem ele.
  const commentsFeed = useMemo(() => {
    if (!lead) return [];
    const notes = Array.isArray(lead.notes) ? lead.notes : [];
    const activityComments = (lead.activities || []).filter(a => a.type === "note" || a.type === "comment");
    const resolveMentionNames = (ids) => (ids || [])
      .map(id => (users || []).find(u => u.id === id)?.name)
      .filter(Boolean);
    const merged = [
      ...notes.map((n, i) => {
        const author = n.userId ? (users || []).find(u => u.id === n.userId) : null;
        return {
          id: n.id || `note-${i}-${n.createdAt || ""}`,
          authorId: n.userId || null,
          authorName: n.userName || author?.name || null,
          avatarBg: author?.avatarBg,
          avatarUrl: author?.avatarUrl,
          initials: author?.initials,
          text: n.text || n.body,
          mentionedNames: resolveMentionNames(n.mentionedIds),
          createdAt: n.createdAt,
        };
      }),
      ...activityComments.map((c, i) => {
        const author = c.userId ? (users || []).find(u => u.id === c.userId) : null;
        return {
          id: c.id || `act-${i}-${c.timestamp || c.createdAt || ""}`,
          authorId: c.userId || null,
          authorName: c.userName || author?.name || null,
          avatarBg: author?.avatarBg,
          avatarUrl: author?.avatarUrl,
          initials: author?.initials,
          text: c.body,
          mentionedNames: resolveMentionNames(c.mentionedIds),
          createdAt: c.timestamp || c.createdAt,
        };
      }),
    ];
    return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [lead, users]);

  const handleAddComment = useCallback(async (text, mentionedIds) => {
    if (!lead || !onAddActivity) return;
    await onAddActivity(lead.id, {
      type: "comment",
      userId: currentUser?.id || null,
      userName: currentUser?.name || null,
      body: text,
      mentionedIds,
    });
    if (mentionedIds?.length > 0 && notifyMentions) {
      notifyMentions(mentionedIds, {
        title: `${currentUser?.name || "Alguém"} te mencionou`,
        body: `Em um comentário no lead "${lead.company}"`,
        link: { module: "leads", id: lead.id },
      });
    }
  }, [lead, onAddActivity, currentUser, notifyMentions]);

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
    const missing = getMissingRequiredFields(customDefs, customValuesByKey);
    if (missing.length > 0) {
      alert(`Não dá pra avançar: preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = getInvalidFields(customDefs, customValuesByKey);
    if (invalid.length > 0) {
      alert(`Não dá pra mover "${lead.company}": corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
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

  const handleSaveFollowUp = () => {
    if (!followUpDate) return;
    const [yyyy, mm, dd] = followUpDate.split("-");
    const d = new Date(+yyyy, +mm - 1, +dd);
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
    const trimmed = contactEmailDraft.trim();
    if (trimmed && !new RegExp(EMAIL_PATTERN).test(trimmed)) {
      alert("E-mail inválido.");
      return;
    }
    onUpdate(lead.id, { contactEmail: trimmed || null });
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
      className="fixed inset-0 z-40 flex lg:items-center lg:justify-center lg:p-6"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full flex-1 flex flex-col lg:flex-none lg:max-w-6xl lg:rounded-2xl lg:max-h-[92vh]"
        style={{
          background: "var(--surface)",
          boxShadow: "var(--shadow-pop)",
          overflow: "hidden",
          height: "100%",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-10 flex flex-col shrink-0" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer" style={{ background: "none", border: "none", color: "var(--text-dim)" }}>
              <X size={20} />
            </button>
            <div className="flex-1 mx-3 text-center min-w-0">
              <div className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>{lead.company}</div>
              <div className="text-xs" style={{ color: "var(--text-dim)" }}><CompanyTag companyId={lead.companyId} /></div>
            </div>
            <div className="flex items-center gap-1">
              {canDelete && !confirmDelete && (
                <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg cursor-pointer" style={{ background: "none", border: "none", color: "var(--text-dim)" }}>
                  <Trash2 size={16} />
                </button>
              )}
              {canDelete && confirmDelete && (
                <button onClick={handleDeleteConfirmed} disabled={deleting} className="px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: "#B91C1C", color: "#FFFFFF", border: "none" }}>
                  {deleting ? "…" : "Excluir"}
                </button>
              )}
            </div>
          </div>
          {/* Mobile tab bar */}
          <div className="flex border-t" style={{ borderColor: "var(--border)" }}>
            {[{ id: "info", label: "INFORMAÇÕES" }, { id: "stage", label: "FASE ATUAL" }].map(t => (
              <button
                key={t.id}
                onClick={() => setMobileTab(t.id)}
                className="flex-1 py-2.5 text-xs font-bold tracking-wider cursor-pointer"
                style={{ background: "none", border: "none", borderBottom: `2px solid ${mobileTab === t.id ? "var(--accent)" : "transparent"}`, color: mobileTab === t.id ? "var(--accent)" : "var(--text-dim)" }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop header */}
        <div
          className="hidden lg:flex sticky top-0 z-10 px-5 py-3.5 border-b items-center justify-between"
          style={{ background: "var(--surface)", borderColor: "var(--border)", backdropFilter: "blur(8px)" }}
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
                style={{ color: "var(--text-dim)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#B91C1C"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
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
                  style={{ color: "var(--text-dim)", background: "transparent", border: "none" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  Cancelar
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors duration-150 cursor-pointer"
              style={{ color: "var(--text-dim)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
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
            className={`w-full lg:w-[320px] flex-1 min-h-0 lg:flex-none lg:shrink-0 overflow-y-auto border-b lg:border-b-0 lg:border-r p-5 space-y-4 pb-4 lg:pb-5${mobileTab !== "info" ? " hidden lg:block" : ""}`}
            style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
          >
            {/* Cliente vinculado — substitui o bloco de empresa */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)", letterSpacing: "0.06em" }}>
                  Cliente
                </div>
                <div className="hidden lg:block"><FitScoreCircle score={lead.fitScore} size={40} /></div>
              </div>
              <ClientSelector
                value={lead.clientId}
                clients={clients}
                onChange={(id) => onUpdate(lead.id, { clientId: id })}
                onCreate={onCreateClient ? async (name) => {
                  const created = await onCreateClient({
                    name: name || lead.company || "Novo cliente",
                    cnpj: lead.cnpj || null,
                    city: lead.city || null,
                    state: lead.state || null,
                  });
                  if (created?.id) onUpdate(lead.id, { clientId: created.id });
                } : undefined}
              />
              {!lead.clientId && (
                <div className="flex items-center gap-1.5 text-xs flex-wrap mt-2" style={{ color: "var(--text-dim)" }}>
                  <span>Lead:</span>
                  <b style={{ color: "var(--text)", fontWeight: 600 }}>{lead.company || "—"}</b>
                  {lead.cnpj && <span className="font-mono">· {lead.cnpj}</span>}
                  {lead.city && <span className="flex items-center gap-1">· <MapPin size={11} />{lead.city}</span>}
                </div>
              )}
            </div>

            {/* Métricas compactas — Unidades / Prob. / Fechamento */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>Unidades</div>
                <div className="text-sm font-bold mt-0.5" style={{ color: "var(--text)" }}>
                  {lead.quantity ? `${lead.quantity} un` : "—"}
                </div>
              </div>
              <div className="rounded-lg p-2" style={{ background: company.primary + "0D", border: `1px solid ${company.primary}22` }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>Prob.</div>
                <div className="text-sm font-bold mt-0.5" style={{ color: company.primary }}>
                  {probDisplay}%
                </div>
              </div>
              <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>Fechamento</div>
                <div className="text-xs font-bold mt-0.5 truncate" style={{ color: "var(--text)" }}>
                  {lead.closeDate ? formatDateBR(lead.closeDate).replace(/(\d{2}\/\d{2}\/)\d{2}(\d{2})$/, "$1$2") : "—"}
                </div>
              </div>
            </div>

            {/* Decisor + infos do cliente */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white shrink-0 text-sm"
                style={{ background: company.primary }}
              >
                {decisionMakerInitials}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>{decisionMakerName}</div>
                <div className="text-xs truncate" style={{ color: "var(--text-dim)" }}>{decisionMakerRole}</div>
              </div>
              <FitScoreCircle score={lead.fitScore} size={48} />
            </div>
            {(lead.size || lead.phone) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-dim)" }}>
                {lead.size && <span>Porte: <span style={{ color: "var(--text)", fontWeight: 600 }}>{lead.size}</span></span>}
                {lead.phone && <span>{lead.phone}</span>}
              </div>
            )}

            {/* Resumo compacto dos dados do formulário inicial */}
            {(customValues.capture_customer_name || customValues.capture_product_interest || customValues.capture_contact_phone) && (
              <div className="rounded-xl border p-3 space-y-1.5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: company.primary }}>
                  Prospecção
                  {customValues.capture_source && (
                    <span className="ml-1.5 normal-case tracking-normal font-normal" style={{ color: "var(--text-dim)" }}>
                      via {customValues.capture_source}
                    </span>
                  )}
                </div>
                {customValues.capture_customer_name && (
                  <div className="flex items-center gap-2 text-xs">
                    <span style={{ color: "var(--text-dim)", minWidth: 16 }}>A</span>
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>{customValues.capture_customer_name}</span>
                  </div>
                )}
                {customValues.capture_product_interest && (
                  <div className="flex items-center gap-2 text-xs">
                    <Package size={12} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
                    <span style={{ color: "var(--text)" }}>{customValues.capture_product_interest}</span>
                  </div>
                )}
                {customValues.capture_contact_phone && (
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span style={{ color: "var(--text-dim)", minWidth: 12, fontSize: 10 }}>☎</span>
                    <span style={{ color: "var(--text)" }}>{customValues.capture_contact_phone}</span>
                  </div>
                )}
                {customValues.capture_priority && (
                  <div className="flex items-center gap-2 text-xs">
                    <span style={{ color: "var(--text-dim)", minWidth: 12 }}>!</span>
                    <span style={{
                      fontWeight: 600,
                      color: customValues.capture_priority === "Alta" ? "#DC2626"
                        : customValues.capture_priority === "Média" ? "#E8920A"
                        : "#16A34A"
                    }}>
                      {customValues.capture_priority}
                    </span>
                  </div>
                )}
                {customValues.capture_prospect_date && (
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar size={12} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
                    <span style={{ color: "var(--text)" }}>{formatDateBR(customValues.capture_prospect_date)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            <SideTabs activeTab={sideTab} onChange={setSideTab} />

            {/* ── Tab: Form ── */}
            {sideTab === "form" && (
            <>
            {/* Formulário Inicial — dados preenchidos na criação do card */}
            {!customValues.capture_customer_name && (
              <div className="p-4 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="text-xs font-semibold mb-3" style={{ color: company.primary }}>
                  Formulário Inicial
                </div>
                <dl className="space-y-2.5 text-sm">
                  <CaptureRow label="Empresa" value={lead.company} />
                  {lead.cnpj && <CaptureRow label="CNPJ" value={lead.cnpj} mono />}
                  {lead.razaoSocial && <CaptureRow label="Razão Social" value={lead.razaoSocial} />}
                  {lead.contactEmail && (
                    <CaptureRow label="E-mail do Contato" value={lead.contactEmail}
                      link={`mailto:${lead.contactEmail}`} />
                  )}
                  {lead.phone && <CaptureRow label="Telefone" value={lead.phone} mono />}
                  {lead.state && <CaptureRow label="Estado (UF)" value={lead.state} />}
                  {lead.city && <CaptureRow label="Cidade" value={lead.city} />}
                  {lead.sector && <CaptureRow label="Setor" value={lead.sector} />}
                  {lead.size && <CaptureRow label="Porte" value={lead.size} />}
                  {lead.value > 0 && <CaptureRow label="Valor (R$)" value={formatBRL(lead.value)} />}
                  {lead.owner && (
                    <CaptureRow
                      label="Responsável"
                      value={(users || []).find(u => u.id === lead.owner)?.name || "—"}
                    />
                  )}
                </dl>
                {lead.notes && !Array.isArray(lead.notes) && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--surface-alt)" }}>
                    <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>Observações</div>
                    <div className="text-sm whitespace-pre-line" style={{ color: "var(--text)" }}>{lead.notes}</div>
                  </div>
                )}
              </div>
            )}

            {/* Formulário Inicial (vindo de captura pública) */}
            {customValues.capture_customer_name && (
              <div className="p-4 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: company.primary }}>
                    Formulário Inicial
                  </div>
                  {customValues.capture_source && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: "var(--surface-alt)", color: "var(--text-dim)", letterSpacing: "0.08em" }}>
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
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--surface-alt)" }}>
                    <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>Mensagem</div>
                    <div className="text-sm whitespace-pre-line" style={{ color: "var(--text)" }}>{customValues.capture_notes}</div>
                  </div>
                )}
              </div>
            )}

            {/* Histórico de etapas */}
            {stageHistory.length > 0 && (
              <div className="p-4 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-1.5 mb-3" style={{ color: "var(--text-dim)" }}>
                  <History size={13} />
                  <span className="text-xs font-semibold">Histórico</span>
                </div>
                <ol className="space-y-2.5 relative" style={{ paddingLeft: 18 }}>
                  <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 1, background: "var(--border)" }} />
                  {stageHistory.slice(0, 8).map((h, i) => {
                    const toStage = DEFAULT_PIPELINE_STAGES.find(s => s.id === h.toStage);
                    const fromStage = h.fromStage ? DEFAULT_PIPELINE_STAGES.find(s => s.id === h.fromStage) : null;
                    return (
                      <li key={i} className="relative">
                        <div style={{
                          position: "absolute", left: -16, top: 3,
                          width: 9, height: 9, borderRadius: "50%",
                          background: toStage?.color || "var(--text-dim)",
                          border: "2px solid var(--surface)", boxShadow: "0 0 0 1px var(--border)",
                        }} />
                        <div className="text-xs" style={{ color: "var(--text)" }}>
                          {fromStage ? (
                            <>{fromStage.name} <span style={{ color: "var(--text-dim)" }}>→</span> <strong>{toStage?.name || h.toStage}</strong></>
                          ) : (
                            <strong>{toStage?.name || h.toStage}</strong>
                          )}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                          {new Date(h.changedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </div>
                      </li>
                    );
                  })}
                  {stageHistory.length > 8 && (
                    <li className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                      +{stageHistory.length - 8} eventos anteriores
                    </li>
                  )}
                </ol>
              </div>
            )}
            </>
            )}

            {/* ── Tab: Atividades ── */}
            {sideTab === "atividades" && (
              <ActivitiesPanel
                stageHistory={stageHistory}
                activities={lead.activities || []}
                users={users}
              />
            )}

            {/* ── Tab: IA ── */}
            {sideTab === "ia" && (
              <div className="space-y-4">
                <LeadAIPanel
                  lead={lead}
                  currentUser={currentUser}
                  activities={lead.activities || []}
                  linkedEmails={lead.linkedEmails || []}
                  onUpdate={onUpdate}
                  onAddActivity={onAddActivity}
                />

                {/* Rascunho de abordagem */}
                <div className="p-4 rounded-xl" style={{ background: company.dark, color: "#FFFFFF" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#FFE9A8" }}>
                      <Sparkles size={12} />Rascunho de abordagem
                    </div>
                    <button
                      onClick={handleCopyDraft}
                      className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-150"
                      style={{ background: "rgba(255,255,255,0.12)", color: copied ? "#A3E6B4" : "rgba(255,255,255,0.8)", border: "none", cursor: "pointer" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                    >
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                      {copied ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                  <div
                    className="text-xs leading-relaxed whitespace-pre-line p-3 rounded-lg"
                    style={{ background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)" }}
                  >
                    {emailDraft}
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Anexos ── */}
            {sideTab === "anexos" && (
              <AttachmentsPanel
                leadId={lead.id}
                companyId={lead.companyId}
                currentUser={currentUser}
                companyColor={company.primary}
              />
            )}

            {/* ── Tab: Checklists ── */}
            {sideTab === "checklists" && (
              <ChecklistsPanel
                leadId={lead.id}
                companyId={lead.companyId}
                currentUser={currentUser}
                companyColor={company.primary}
              />
            )}

            {/* ── Tab: Email ── */}
            {sideTab === "email" && (
              <PlaceholderPanel
                icon={Mail}
                title="Email"
                hint="Em breve — emails vinculados e rascunhos centralizados aqui."
              />
            )}

            {/* ── Tab: PDF ── */}
            {sideTab === "pdf" && (
              <ProposalPanel lead={lead} currentUser={currentUser} allLeads={allLeads} />
            )}
          </aside>

          {/* ───── CENTER ─────────────────────────────────────────────── */}
          <main className={`flex-1 min-w-0 overflow-y-auto p-5 space-y-4 pb-20 lg:pb-5${mobileTab !== "stage" ? " hidden lg:block" : ""}`}>



          {/* Overlap (gerente) */}
          {isManager && overlaps.length > 0 && (
            <div
              className="p-3.5 rounded-xl border-l-4"
              style={{ background: "#FFFBE6", borderLeftColor: "var(--amber)", borderTop: "1px solid #FFE680", borderRight: "1px solid #FFE680", borderBottom: "1px solid #FFE680" }}
            >
              <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#9A7A00" }}>
                <Network size={12} />
                Overlap detectado · visível só para gerente
              </div>
              <div className="text-sm mb-2" style={{ color: "var(--text)" }}>
                Este cliente também está ativo em:
              </div>
              {overlaps.map(o => {
                const u = users.find(x => x.id === o.owner);
                return (
                  <div
                    key={o.id}
                    className="text-xs p-2 rounded-lg mb-1 flex items-center justify-between"
                    style={{ background: "var(--surface)" }}
                  >
                    <div className="flex items-center gap-2">
                      <CompanyTag companyId={o.companyId} />
                      <span style={{ color: "var(--text)" }}>{u?.name || "—"}</span>
                    </div>
                    <span className="font-mono" style={{ color: "var(--text-dim)" }}>
                      {formatK(o.value)} · {o.stage}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Campos customizados da etapa — editáveis inline (save debounced) */}
          {visibleCustomDefs.length > 0 && (
            <div className="p-4 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: company.primary }}>
                  Fase atual · {DEFAULT_PIPELINE_STAGES.find(s => s.id === lead.stage)?.name || lead.stage}
                </div>
              </div>
              <div className="space-y-4">
                {visibleCustomDefs.map(f => (
                  <div key={f.id}>
                    <label className="block" style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
                      {f.effectiveRequired && <span style={{ color: "var(--accent)", marginRight: 4 }}>*</span>}
                      {f.label}
                    </label>
                    {f.helpText && (
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{f.helpText}</div>
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
            <div className="p-4 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: company.primary }}>
                <Package size={12} />Produto vinculado
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>{lead.skuName || "—"}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                    {lead.quantity || 0} un × {formatBRL(lead.unitPrice)}
                  </div>
                </div>
                <div className="font-bold text-lg" style={{ color: "var(--text)" }}>
                  {formatK(lead.value, 1)}
                </div>
              </div>
            </div>
          )}

          {/* Etapa do funil */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-dim)" }}>
              Etapa do funil
            </label>
            <Select value={stage || ""} onChange={handleStageChange} options={STAGE_OPTIONS} />
          </div>

          {/* E-mail do contato */}
          <div className="p-4 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
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
              <div className="text-sm mt-1" style={{ color: "var(--text)" }}>
                {lead.contactEmail}
              </div>
            )}

            {!lead.contactEmail && !editingContactEmail && (
              <div className="text-xs mt-1 italic" style={{ color: "var(--text-dim)" }}>
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
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                  onFocus={e => { e.currentTarget.style.borderColor = company.primary; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
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
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => setEmailsOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 transition-colors cursor-pointer"
              style={{ background: "var(--surface-alt)", border: "none" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text)" }}>
                <Mail size={13} style={{ color: "var(--text-dim)" }} />
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
              {emailsOpen ? <ChevronUp size={14} style={{ color: "var(--text-dim)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-dim)" }} />}
            </button>

            {emailsOpen && (
              <div style={{ background: "var(--surface-alt)" }}>
                {(!lead.linkedEmails || lead.linkedEmails.length === 0) ? (
                  <div className="px-4 pb-4 pt-1 text-xs" style={{ color: "var(--text-dim)" }}>
                    Nenhum e-mail vinculado ainda. Quando e-mails do Outlook forem detectados para{" "}
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>
                      {lead.contactEmail || "o e-mail do contato"}
                    </span>
                    , aparecerão aqui.
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {lead.linkedEmails.map((email, idx) => (
                      <div key={email.id || idx} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                            <span
                              className="text-xs font-bold"
                              style={{ color: email.direction === "sent" ? company.primary : "var(--text)" }}
                              title={email.direction === "sent" ? "Enviado" : "Recebido"}
                            >
                              {email.direction === "sent" ? "→" : "←"}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
                              {email.subject || "(sem assunto)"}
                            </div>
                            <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-dim)" }}>
                              {email.direction === "sent" ? `Para: ${email.to}` : `De: ${email.from}`}
                            </div>
                          </div>
                          <div className="text-xs shrink-0" style={{ color: "var(--text-dim)" }}>
                            {email.date ? formatDateBR(email.date) : "—"}
                          </div>
                        </div>
                        {idx < lead.linkedEmails.length - 1 && (
                          <div className="mt-3" style={{ borderTop: "1px solid var(--border)" }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>


          {/* Follow-up inline */}
          <div className="p-4 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
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
              <div className="text-sm font-semibold mt-1" style={{ color: "var(--text)" }}>
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
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                  onFocus={e => { e.currentTarget.style.borderColor = company.primary; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
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
              <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-dim)" }}>
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
                      style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-pop)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--border)"; }}
                    >
                      <Icon size={12} strokeWidth={2} />
                      {l.label}
                      <ExternalLink size={10} style={{ color: "var(--text-dim)" }} />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
          </main>

          {/* ───── RIGHT SIDEBAR ─────────────────────────────────────── */}
          <aside
            className="hidden lg:block w-full lg:w-[240px] shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l p-5 pb-5"
            style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
          >
            <div className="text-xs font-semibold mb-3" style={{ color: "var(--text)", letterSpacing: "0.02em" }}>
              Mover card para fase
            </div>
            {moveError && (
              <div className="flex items-start gap-2 p-2.5 mb-2 rounded-lg text-xs" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                {moveError}
              </div>
            )}
            <div className="space-y-2">
              {stageNav.next && (() => {
                const nextColor = stageNav.next.color || company.primary;
                return (
                  <button
                    onClick={() => moveToStage(stageNav.next.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                    style={{ background: nextColor + "14", color: nextColor, border: `1px solid ${nextColor}30` }}
                    onMouseEnter={e => { e.currentTarget.style.background = nextColor + "22"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = nextColor + "14"; }}
                  >
                    <span>{stageNav.next.name}</span>
                    <ArrowRight size={14} />
                  </button>
                );
              })()}
              {stageNav.prev && (() => {
                const prevColor = stageNav.prev.color || "var(--text-dim)";
                return (
                  <button
                    onClick={() => moveToStage(stageNav.prev.id)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    style={{ background: "var(--surface)", color: prevColor, border: `1px solid ${prevColor}40` }}
                    onMouseEnter={e => { e.currentTarget.style.background = prevColor + "10"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
                  >
                    <ArrowLeft size={13} />
                    <span>{stageNav.prev.name}</span>
                  </button>
                );
              })()}
            </div>

            {/* Comentários — sempre visíveis na lateral direita, abaixo da
                movimentação de card (não mais escondidos atrás de uma aba). */}
            <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
              <CommentsPanel
                comments={commentsFeed}
                currentUser={currentUser}
                mentionableUsers={mentionableUsers}
                onAddComment={handleAddComment}
              />
            </div>

            <div className="mt-5 pt-4 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
              {isManager && onNavigateToPipelineBuilder && (
                <a
                  href="#"
                  onClick={e => { e.preventDefault(); onNavigateToPipelineBuilder(); }}
                  className="flex items-center gap-2 text-xs"
                  style={{ color: "var(--text-dim)", textDecoration: "none" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
                >
                  <GitBranch size={12} />
                  Configurar mover cards
                </a>
              )}
              <a
                href="#"
                onClick={e => { e.preventDefault(); setSideTab("ia"); }}
                className="flex items-center gap-2 text-xs"
                style={{ color: "var(--text-dim)", textDecoration: "none" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#7C3AED"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
              >
                <Sparkles size={12} />
                Mover cards com IA
              </a>
            </div>
          </aside>
        </div>

        {/* Mobile sticky footer — Avançar CTA */}
        <div className="lg:hidden shrink-0 border-t px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {stageNav.next ? (
            <button
              onClick={() => moveToStage(stageNav.next.id)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm cursor-pointer"
              style={{ background: stageNav.next.color || company.primary, color: "#FFFFFF", border: "none" }}
            >
              Avançar para {stageNav.next.name}
              <ArrowRight size={16} />
            </button>
          ) : (
            <div className="text-xs text-center py-3" style={{ color: "var(--text-dim)" }}>
              {lead.stage === "ganho" ? "Negócio ganho 🎉" : lead.stage === "perdido" ? "Negócio encerrado" : "Etapa final"}
            </div>
          )}
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
        background: color ? color + "0D" : "var(--surface)",
        borderRadius: 12,
        border: `1px solid ${color ? color + "22" : "var(--border)"}`,
        padding: "10px 14px",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: "var(--text-dim)",
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
          color: color || "var(--text)",
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
    <div className="p-3 rounded-xl" style={{ background: "var(--surface-alt)" }}>
      <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>
        {label}
      </div>
      <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>{value}</div>
    </div>
  );
}

// ── Side-tab system ─────────────────────────────────────────────────────────

const SIDE_TAB_HINTS = {
  ia: "Assistente de IA sob demanda para este lead — briefing, rascunho de e-mail, próximo passo, análise de objeção. Use quando precisa de apoio antes de uma ação específica. Para sugestões automáticas em toda a carteira, veja Time de Agentes.",
};

const SIDE_TABS = [
  { id: "form",         label: "Form",        icon: FileText },
  { id: "atividades",   label: "Atividades",  icon: Activity },
  { id: "ia",           label: "IA",          icon: Sparkles },
  { id: "anexos",       label: "Anexos",      icon: Paperclip },
  { id: "checklists",   label: "Checklists",  icon: ListChecks },
  { id: "email",        label: "Email",       icon: Mail },
  { id: "pdf",          label: "PDF",         icon: FileDown },
];

function SideTabs({ activeTab, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {SIDE_TABS.map(t => {
        const active = activeTab === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            title={SIDE_TAB_HINTS[t.id] || undefined}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
            style={{
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-dim)",
              border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
              cursor: "pointer",
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface)"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
          >
            <Icon size={11} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function ActivitiesPanel({ stageHistory, activities, users }) {
  // Combina movimentações de etapa + atividades genéricas em uma única timeline.
  const combined = useMemo(() => {
    const items = [];
    for (const h of stageHistory || []) {
      items.push({
        type: "stage",
        timestamp: h.changedAt,
        from: h.fromStage,
        to: h.toStage,
        userId: h.changedBy,
      });
    }
    for (const a of activities || []) {
      items.push({
        type: a.type || "note",
        timestamp: a.timestamp || a.createdAt,
        body: a.body,
        userId: a.userId,
        userName: a.userName,
        meta: a.meta,
      });
    }
    return items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [stageHistory, activities]);

  if (combined.length === 0) {
    return (
      <PlaceholderPanel
        icon={Activity}
        title="Atividades"
        hint="Movimentações entre etapas e edições aparecem aqui."
      />
    );
  }

  return (
    <div className="p-4 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="text-xs font-semibold mb-3" style={{ color: "var(--text)" }}>
        Atividades
      </div>
      <ol className="space-y-3">
        {combined.slice(0, 20).map((a, i) => {
          const fromStage = a.from ? DEFAULT_PIPELINE_STAGES.find(s => s.id === a.from) : null;
          const toStage = a.to ? DEFAULT_PIPELINE_STAGES.find(s => s.id === a.to) : null;
          const user = a.userId ? (users || []).find(u => u.id === a.userId) : null;
          const userName = user?.name || a.userName || "Sistema";
          return (
            <li key={i} className="text-xs" style={{ color: "var(--text)" }}>
              {a.type === "stage" ? (
                <div>
                  <span style={{ color: "var(--text-dim)" }}>{userName} </span>
                  moveu para <strong>{toStage?.name || a.to}</strong>
                  {fromStage && <span style={{ color: "var(--text-dim)" }}> (de {fromStage.name})</span>}
                </div>
              ) : (
                <div>
                  <span style={{ color: "var(--text-dim)" }}>{userName} </span>
                  {a.body}
                </div>
              )}
              <div className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                {new Date(a.timestamp).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </div>
            </li>
          );
        })}
        {combined.length > 20 && (
          <li className="text-[10px]" style={{ color: "var(--text-dim)" }}>
            +{combined.length - 20} eventos anteriores
          </li>
        )}
      </ol>
    </div>
  );
}

// ── Attachments panel ─────────────────────────────────────────────────────────

const FILE_ICON_MAP = {
  "application/pdf": FileText,
  "image/jpeg": FileImage,
  "image/png": FileImage,
  "image/gif": FileImage,
  "image/webp": FileImage,
  "application/vnd.ms-excel": FileSpreadsheet,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
};

function FileIcon({ mimeType }) {
  const Icon = FILE_ICON_MAP[mimeType] || File;
  return <Icon size={16} />;
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentsPanel({ leadId, companyId, currentUser, companyColor }) {
  const { attachments, loading, uploading, error, upload, remove, getSignedUrl } = useLeadAttachments(leadId);
  const [dragOver, setDragOver] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const inputRef = useRef(null);

  const doUpload = useCallback(async (file) => {
    await upload(file, { leadId, companyId, uploadedBy: currentUser?.id || null });
  }, [upload, leadId, companyId, currentUser]);

  const handleFiles = useCallback((files) => {
    Array.from(files).forEach(doUpload);
  }, [doUpload]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDownload = useCallback(async (att) => {
    setDownloadingId(att.id);
    try {
      const url = await getSignedUrl(att.file_path);
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = att.file_name;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloadingId(null);
    }
  }, [getSignedUrl]);

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-5 cursor-pointer transition-colors"
        style={{
          borderColor: dragOver ? companyColor : "var(--border-strong)",
          background: dragOver ? (companyColor + "08") : "var(--surface-alt)",
        }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        aria-label="Clique ou arraste arquivos para anexar"
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: dragOver ? (companyColor + "18") : "var(--surface-alt)" }}
        >
          <Upload size={16} style={{ color: dragOver ? companyColor : "var(--text-dim)" }} />
        </div>
        <div className="text-xs text-center" style={{ color: "var(--text-dim)" }}>
          {uploading ? (
            <span style={{ color: companyColor }}>Enviando…</span>
          ) : (
            <>
              <span className="font-semibold" style={{ color: "var(--text)" }}>
                Clique ou arraste
              </span>
              {" "}para anexar
              <div className="mt-0.5">PDF, Word, Excel, imagens · máx 50 MB</div>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp"
          onChange={e => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ""; } }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {loading && (
        <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>Carregando…</div>
      )}

      {!loading && attachments.length === 0 && (
        <div className="text-xs text-center py-2 italic" style={{ color: "var(--text-dim)" }}>
          Nenhum arquivo anexado ainda.
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div
              key={att.id}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}
              >
                <FileIcon mimeType={att.mime_type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
                  {att.file_name}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                  {formatBytes(att.file_size)}
                  {att.created_at && (
                    <> · {new Date(att.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDownload(att)}
                disabled={downloadingId === att.id}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                title="Baixar arquivo"
                aria-label="Baixar arquivo"
              >
                <Download size={13} />
              </button>
              <button
                onClick={() => remove(att)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#B91C1C"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                title="Remover arquivo"
                aria-label="Remover arquivo"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Checklists panel ──────────────────────────────────────────────────────────

function ChecklistsPanel({ leadId, companyId, currentUser, companyColor }) {
  const { checklists, loading, error, createChecklist, deleteChecklist, addItem, toggleItem, removeItem, renameChecklist } = useLeadChecklists(leadId);
  const [newTitle, setNewTitle] = useState("");
  const [creatingTitle, setCreatingTitle] = useState(false);
  const [addingTo, setAddingTo] = useState(null);
  const [addingText, setAddingText] = useState("");
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitleText, setEditingTitleText] = useState("");

  const handleCreate = async () => {
    const t = newTitle.trim() || "Checklist";
    setCreatingTitle(false);
    setNewTitle("");
    await createChecklist({ title: t, companyId, createdBy: currentUser?.id });
  };

  const handleAddItemEnter = async (checklistId) => {
    const t = addingText.trim();
    if (!t) return;
    setAddingText("");
    await addItem(checklistId, t);
    // keep input open for next item
  };

  const handleAddItemBlur = async (checklistId) => {
    const t = addingText.trim();
    setAddingText("");
    setAddingTo(null);
    if (t) await addItem(checklistId, t);
  };

  const handleRename = async (id) => {
    const t = editingTitleText.trim();
    setEditingTitleId(null);
    setEditingTitleText("");
    if (t) await renameChecklist(id, t);
  };

  if (loading) return <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>Carregando…</div>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {checklists.length === 0 && !creatingTitle && (
        <div className="text-xs text-center py-2 italic" style={{ color: "var(--text-dim)" }}>
          Nenhum checklist criado ainda.
        </div>
      )}

      {checklists.map(cl => {
        const items = Array.isArray(cl.items) ? cl.items : [];
        const doneCount = items.filter(it => it.done).length;
        const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

        return (
          <div key={cl.id} className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: "var(--surface-alt)" }}>
              <ListChecks size={13} style={{ color: companyColor, flexShrink: 0 }} />
              {editingTitleId === cl.id ? (
                <input
                  autoFocus
                  value={editingTitleText}
                  onChange={e => setEditingTitleText(e.target.value)}
                  onBlur={() => handleRename(cl.id)}
                  onKeyDown={e => { if (e.key === "Enter") handleRename(cl.id); if (e.key === "Escape") { setEditingTitleId(null); } }}
                  className="flex-1 text-xs font-semibold outline-none bg-transparent border-b"
                  style={{ color: "var(--text)", borderColor: companyColor }}
                />
              ) : (
                <button
                  className="flex-1 text-left text-xs font-semibold"
                  style={{ color: "var(--text)", background: "none", border: "none", cursor: "text" }}
                  onDoubleClick={() => { setEditingTitleId(cl.id); setEditingTitleText(cl.title); }}
                  title="Clique duplo para renomear"
                >
                  {cl.title}
                </button>
              )}
              {items.length > 0 && (
                <span className="text-[10px] font-semibold shrink-0" style={{ color: "var(--text-dim)" }}>
                  {doneCount}/{items.length}
                </span>
              )}
              <button
                onClick={() => deleteChecklist(cl.id)}
                className="p-1 rounded transition-colors shrink-0"
                style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#B91C1C"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
                title="Remover checklist"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Progress bar */}
            {items.length > 0 && (
              <div className="px-3 pt-2" style={{ paddingBottom: 0 }}>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%`, background: progress === 100 ? "#16A34A" : companyColor }}
                  />
                </div>
              </div>
            )}

            {/* Items */}
            <div className="p-3 space-y-1.5">
              {items.map(it => (
                <div key={it.id} className="flex items-start gap-2 group">
                  <button
                    onClick={() => toggleItem(cl.id, it.id)}
                    className="mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all"
                    style={{
                      background: it.done ? companyColor : "var(--surface)",
                      borderColor: it.done ? companyColor : "var(--border-strong)",
                      cursor: "pointer",
                    }}
                    aria-label={it.done ? "Desmarcar" : "Marcar como feito"}
                  >
                    {it.done && <Check size={10} style={{ color: "#FFFFFF" }} />}
                  </button>
                  <span
                    className="flex-1 text-xs leading-5"
                    style={{
                      color: it.done ? "var(--text-dim)" : "var(--text)",
                      textDecoration: it.done ? "line-through" : "none",
                    }}
                  >
                    {it.text}
                  </span>
                  <button
                    onClick={() => removeItem(cl.id, it.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
                    style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#B91C1C"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
                    title="Remover item"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}

              {/* Add item inline */}
              {addingTo === cl.id ? (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-4 h-4 rounded border shrink-0" style={{ borderColor: "var(--border-strong)" }} />
                  <input
                    autoFocus
                    value={addingText}
                    onChange={e => setAddingText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleAddItemEnter(cl.id); if (e.key === "Escape") { setAddingTo(null); setAddingText(""); } }}
                    onBlur={() => handleAddItemBlur(cl.id)}
                    placeholder="Nova tarefa..."
                    className="flex-1 text-xs outline-none border-b pb-0.5"
                    style={{ color: "var(--text)", borderColor: companyColor, background: "transparent" }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => { setAddingTo(cl.id); setAddingText(""); }}
                  className="flex items-center gap-1.5 text-xs mt-1 transition-colors"
                  style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.color = companyColor; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
                >
                  <Plus size={11} />
                  Adicionar item
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* New checklist */}
      {creatingTitle ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreatingTitle(false); setNewTitle(""); } }}
            onBlur={handleCreate}
            placeholder="Nome do checklist..."
            className="flex-1 text-xs rounded-lg border px-3 py-2 outline-none"
            style={{ borderColor: companyColor, color: "var(--text)" }}
          />
        </div>
      ) : (
        <button
          onClick={() => setCreatingTitle(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed text-xs font-semibold transition-colors"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "transparent" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = companyColor; e.currentTarget.style.color = companyColor; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-dim)"; }}
        >
          <Plus size={12} />
          Novo checklist
        </button>
      )}
    </div>
  );
}

function PlaceholderPanel({ icon: Icon, title, hint }) {
  return (
    <div className="p-6 rounded-xl border text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="inline-flex items-center justify-center mb-3" style={{
        width: 40, height: 40, borderRadius: "50%",
        background: "var(--surface-alt)",
      }}>
        <Icon size={18} color={"var(--text-dim)"} />
      </div>
      <div className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>{title}</div>
      <div className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>{hint}</div>
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
      <dt className="text-[11px] font-semibold" style={{ color: "var(--text-dim)" }}>{label}</dt>
      <dd className={`text-sm ${mono ? "font-mono" : ""}`} style={{ color: dim ? "var(--text-dim)" : "var(--text)", fontStyle: dim ? "italic" : "normal", marginTop: 2 }}>
        {dim ? "—" : link ? (
          <a href={link} style={{ color: "var(--accent)", textDecoration: "none" }}>{value}</a>
        ) : badge ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: (priorityColor || "var(--text-dim)") + "14", color: priorityColor || "var(--text-dim)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: priorityColor || "var(--text-dim)" }} />
            {value}
          </span>
        ) : value}
      </dd>
    </div>
  );
}
