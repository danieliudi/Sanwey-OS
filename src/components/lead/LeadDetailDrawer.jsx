import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, MapPin, Network, Package, Users, Sparkles, Copy, Send,
  Calendar, Linkedin, Newspaper, MessageSquareWarning, Search, ChevronDown,
  Check, Trash2, Mail, Mic,
  Clock, GitBranch, CalendarClock, History,
  FileText, Activity, Paperclip, ListChecks, FileDown, Plus, Upload, Download,
  File, FileImage, FileSpreadsheet, AlertCircle, Pencil, Handshake, BookOpen,
  MessageCircle,
} from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { mergeGanhoDefaults } from "../../utils/won-stage-defaults";
import { CompanyTag } from "../ui/CompanyTag";
import { UrgencyTag } from "../ui/UrgencyTag";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { Button } from "../ui/Button";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { formatK, formatBRL } from "../../utils/currency";
import { getLeadOwnerIds } from "../../utils/pipeline-metrics";
import { formatDateBR, closeDateUrgencyStyle, toLocalISODate, localDateInputToISOString } from "../../utils/date";
import { useStageFields } from "../../hooks/use-stage-fields";
import { useSingleLeadHistory } from "../../hooks/use-single-lead-history";
import { useLeadAttachments } from "../../hooks/use-lead-attachments";
import { useDocumentLibrary, useLeadDocumentRefs } from "../../hooks/use-document-library";
import { CATEGORY_LABELS } from "../views/DocumentLibraryView";
import { useWhatsappConversation } from "../../hooks/use-whatsapp-conversations";
import { FilterBar } from "../shared/FilterBar";
import { Card, CardGrid } from "../shared/Card";
import { useLeadChecklists } from "../../hooks/use-lead-checklists";
import { useLeadSamples } from "../../hooks/use-lead-samples";
import { CurrencyInput } from "../ui/CurrencyInput";
import { Modal } from "../ui/Modal";
import { LeadAIPanel } from "../ai/LeadAIPanel";
import { ProposalPanel } from "./ProposalPanel";
import { AtaVozPanel } from "./AtaVozPanel";
import { StageFieldInput } from "./StageFieldInput";
import { ClientSelector } from "../client/ClientSelector";
import { ClientQuickCreateModal } from "../client/ClientQuickCreateModal";
import { useClientContacts } from "../../hooks/use-client-contacts";
import { recentCompetitorMention } from "../../utils/competitor-alert";
import { computeFitScore } from "../../utils/pipeline-metrics";
import { evaluateConditionGroups } from "../../utils/condition-operators";
import { resolveVisibleFields, getMissingRequiredFields } from "../../utils/field-conditions";
import { getInvalidFields, EMAIL_PATTERN } from "../../utils/field-validation";
import { CommentsPanel } from "../shared/CommentsPanel";
import { getMentionableUsers } from "../../utils/mentionable-users";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { StageNavigator } from "../shared/StageNavigator";
import { createPosvendaCaseFromLead } from "../../hooks/use-posvenda";
import { activityTypeMeta } from "../../utils/activity-types";
import { useEmailTemplates } from "../../hooks/use-email-templates";
import { useLeadEmails } from "../../hooks/use-lead-emails";
import { usePersonalTasks } from "../../hooks/use-personal-tasks";
import { EmailTemplateBuilderModal } from "./EmailTemplateBuilderModal";
import { escapeHtml } from "../../utils/html";

export function LeadDetailDrawer({ lead, campaigns = [], onClose, onStageMoved, onUpdate, onDelete, onAddActivity, allLeads, users, clients = [], onCreateClient, isManager, currentUser, onNavigateToPipelineBuilder, onEditFields, pipelines, notifyMentions, pipelineTransitions, offlineStatusById, onRetryOfflineActivity }) {
  const [stage, setStage] = useState(lead?.stage ?? null);
  const [sideTab, setSideTab] = useState("form");
  const [emailPrefill, setEmailPrefill] = useState(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [showFollowUpInput, setShowFollowUpInput] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingContactEmail, setEditingContactEmail] = useState(false);
  const [contactEmailDraft, setContactEmailDraft] = useState("");
  const [contactEmailError, setContactEmailError] = useState(null);
  const [quickCreateName, setQuickCreateName] = useState(null); // string | null — abre o mini-cadastro (com checagem de duplicata) quando != null
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [moveError, setMoveError] = useState(null);
  const [sendingToPosvenda, setSendingToPosvenda] = useState(false);
  const [posvendaError, setPosvendaError] = useState(null);
  const [posvendaSent, setPosvendaSent] = useState(false);
  // Gravar ata como painel flutuante (Opção B do mockup, aprovada pelo Daniel
  // 18/08/2026) — antes vivia só dentro da aba Atividades, agora um botão no
  // header do drawer abre por cima, de qualquer aba, sem trocar de contexto.
  // A ata continua aparecendo na lista de Atividades depois de salva.
  const [ataFloatingOpen, setAtaFloatingOpen] = useState(false);

  const stageFields = useStageFields();
  const customDefs = lead ? stageFields.getFields(lead.companyId, lead.stage) : [];
  const customValues = lead?.customFields || {};
  const { entries: stageHistory } = useSingleLeadHistory(lead?.id);

  // Edição inline dos campos customizados da etapa.
  // Mantém o digitado localmente e salva com debounce (600ms) para não bater
  // no Supabase a cada tecla.
  const [customDraft, setCustomDraft] = useState({});
  const [customSaveState, setCustomSaveState] = useState(null); // null | "saving" | "saved"
  const customDebounceRef = useRef(null);
  // Ref espelha o rascunho ACUMULADO: o corpo do timer precisa mesclar todos
  // os campos tocados, não só o último. Sem isso, editar A e depois B em <600ms
  // gravava só B (o timer de A era cancelado) — perda silenciosa de dados.
  const customDraftRef = useRef({});
  const savedTimerRef = useRef(null);
  // Espelha `lead` pra leitura dentro do corpo do setTimeout do autosave —
  // sem isso o closure capturava o `lead` de quando a tecla foi digitada, não
  // o mais recente, e um customFields atualizado em paralelo (ex.: realtime)
  // entre a tecla e os 600ms do debounce era sobrescrito com dado velho.
  const leadRef = useRef(lead);
  useEffect(() => { leadRef.current = lead; }, [lead]);

  useEffect(() => {
    setCustomDraft({});
    customDraftRef.current = {};
    setCustomSaveState(null);
    setMoveError(null);
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    return () => {
      // Flush do rascunho pendente antes de trocar de lead/fechar/desmontar —
      // senão editar um campo e fechar em <600ms perdia a edição (o timer só
      // era cancelado). `lead` aqui é o lead anterior (deps = [lead?.id]).
      if (customDebounceRef.current) { clearTimeout(customDebounceRef.current); customDebounceRef.current = null; }
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (lead && Object.keys(customDraftRef.current).length > 0) {
        onUpdate(lead.id, { customFields: { ...(lead.customFields || {}), ...customDraftRef.current } });
      }
    };
  }, [lead?.id]);

  const handleCustomChange = useCallback((fieldKey, value) => {
    const next = { ...customDraftRef.current, [fieldKey]: value };
    customDraftRef.current = next;
    setCustomDraft(next);
    setCustomSaveState("saving");
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    customDebounceRef.current = setTimeout(() => {
      const current = leadRef.current;
      if (!current) return;
      const merged = { ...(current.customFields || {}), ...customDraftRef.current };
      onUpdate(current.id, { customFields: merged });
      customDebounceRef.current = null;
      setCustomSaveState("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setCustomSaveState(null), 2000);
    }, 600);
  }, [onUpdate]);

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

  const moveToStage = useCallback(async (toStage) => {
    if (!lead || !toStage) return;
    // Gate de etapa por valor (19/08/2026, achado do QA multi-lente): o
    // painel "Mover para" já pré-filtra moveTargets escondendo destinos com
    // condição não atendida (linha ~486), mas isso sozinho é só affordance —
    // sem essa 2ª checagem aqui, um moveTargets desatualizado (stale closure,
    // customFields mudou entre renders) deixaria a transição passar sem o
    // gate ser avaliado de novo. Mesma defesa dupla que attemptStageChange já
    // tem em CRMView.jsx.
    const gate = pipelineTransitions?.getTransitionCondition?.(lead.companyId, lead.stage, toStage);
    if (gate && !evaluateConditionGroups(gate, lead.customFields || {})) {
      setMoveError("Não dá pra mover: esta transição exige uma condição específica de campo, ainda não atendida.");
      return;
    }
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
    try {
      await onUpdate(lead.id, patch);
    } catch (err) {
      setStage(lead.stage);
      setMoveError(err?.message || "Não foi possível mover o card. Tente de novo.");
      return;
    }
    // Fecha o drawer agora (sinal visual de que moveu) e reabre já na etapa
    // nova — em vez de só trocar o conteúdo por baixo do drawer aberto. Só
    // depois do onUpdate confirmar sucesso — antes disso fechava mesmo se a
    // gravação tivesse falhado, escondendo o erro.
    if (onStageMoved) {
      onClose();
      onStageMoved(lead.id);
    }
  }, [lead, onUpdate, onStageMoved, onClose, customDefs, customValuesByKey, pipelineTransitions]);

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

  // Escopo de quem pode ser responsável do card: vendedor só da
  // mesma empresa do lead (gerente/admin não aparecem aqui — mesmo escopo
  // que já existia pro picker de reatribuição de dono). Usado como `options`
  // do AssigneeMultiSelect (FASE 5) — objetos de usuário crus (id/name/
  // avatarBg/initials), não {value,label}.
  const sellerOptions = useMemo(() => {
    if (!lead) return [];
    const inScope = (users || [])
      .filter(u => u.role === "vendedor" && Array.isArray(u.companies) && u.companies.includes(lead.companyId));
    // Item 4a: um responsável já atribuído (ex. gerente/admin colocado como
    // dono manualmente) precisa continuar aparecendo como chip mesmo fora do
    // escopo padrão do vendedor — senão o AssigneeMultiSelect descarta
    // silenciosamente o id (options.find não acha) e o card parece "sem
    // responsável" pra quem só olha o card fechado.
    const assignedIds = getLeadOwnerIds(lead);
    const extra = (users || []).filter(u => assignedIds.includes(u.id) && !inScope.some(x => x.id === u.id));
    return [...inScope, ...extra];
  }, [lead, users]);

  // Quem pode ser @mencionado nos comentários deste lead — mesmo escopo do
  // picker de reatribuição de dono acima (vendedor só da mesma
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
    // Offline fase 1: status vem da fila local (pendingActivities) quando
    // disponível — senão cai no metadado `pending:true` gravado direto no
    // objeto em memória (ver use-leads.js addLeadActivity), que cobre o
    // instante entre "acabou de criar offline" e a fila ainda não ter sido
    // relida por use-offline-sync.
    const resolveOfflineStatus = (id, pendingFlag) => {
      const entry = offlineStatusById?.[id];
      if (entry) return entry.status;
      return pendingFlag ? "pending" : undefined;
    };
    const merged = [
      ...notes.filter(n => !n.deletedAt).map((n, i) => {
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
          editedAt: n.editedAt || null,
          status: resolveOfflineStatus(n.id, n.pending),
        };
      }),
      ...activityComments.filter(c => !c.deletedAt).map((c, i) => {
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
          editedAt: c.editedAt || null,
          status: resolveOfflineStatus(c.id, c.pending),
        };
      }),
    ];
    return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [lead, users, offlineStatusById]);

  const onUpdateComment = useCallback(async (id, patch) => {
    if (!lead || !onUpdate) return;
    const notes = Array.isArray(lead.notes) ? lead.notes : [];
    const activities = Array.isArray(lead.activities) ? lead.activities : [];
    const noteIdx = notes.findIndex(n => n.id === id);
    if (noteIdx !== -1) {
      const entry = notes[noteIdx];
      const bodyKey = entry.text !== undefined ? "text" : "body";
      const nextEntry = { ...entry };
      if ("text" in patch) nextEntry[bodyKey] = patch.text;
      if ("editedAt" in patch) nextEntry.editedAt = patch.editedAt;
      if ("deletedAt" in patch) nextEntry.deletedAt = patch.deletedAt;
      const updatedNotes = [...notes];
      updatedNotes[noteIdx] = nextEntry;
      await onUpdate(lead.id, { notes: updatedNotes });
      return;
    }
    const actIdx = activities.findIndex(a => a.id === id);
    if (actIdx !== -1) {
      const entry = activities[actIdx];
      const nextEntry = { ...entry };
      if ("text" in patch) nextEntry.body = patch.text;
      if ("editedAt" in patch) nextEntry.editedAt = patch.editedAt;
      if ("deletedAt" in patch) nextEntry.deletedAt = patch.deletedAt;
      const updatedActivities = [...activities];
      updatedActivities[actIdx] = nextEntry;
      await onUpdate(lead.id, { activities: updatedActivities });
    }
  }, [lead, onUpdate]);

  const handleAddComment = useCallback(async (text, mentionedIds) => {
    if (!lead || !onAddActivity) return;
    await onAddActivity(lead.id, {
      id: crypto.randomUUID(),
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
  const firstName = (decisionMakerName && decisionMakerName !== "—") ? decisionMakerName.split(" ")[0] : "time";
  const competitorMention = useMemo(() => recentCompetitorMention(lead?.activities), [lead?.activities]);

  // Normalize probability for display (handle both 0–1 and 0–100 formats)
  const probDisplay = lead
    ? (lead.probability > 1 ? Math.round(lead.probability) : Math.round(lead.probability * 100))
    : 0;

  const emailDraft = useMemo(() => {
    if (!lead || !company) return "";
    const senderName = currentUser?.name || "[Seu nome]";
    const senderEmail = currentUser?.email ? `\n${currentUser.email}` : "";
    const hasEvidence = Boolean(lead.evidence && lead.evidence.trim());
    const openingLine = hasEvidence
      ? `Identifiquei que a ${lead.company} teve ${lead.evidence.toLowerCase()}.`
      : `Estou acompanhando o momento da ${lead.company} e acredito que possamos ajudar em algo relevante agora.`;
    return `Olá ${firstName},\n\n${openingLine}\n\nSou da ${company.name} e gostaria de entender melhor como podemos apoiar nesse momento.\n\nPodemos agendar 20 minutos esta semana?\n\nAbraço,\n${senderName}${senderEmail}\n${company.name}`;
  }, [lead, company, firstName, currentUser]);

  // IMPORTANT: todos os hooks precisam rodar antes de qualquer return.
  // researchLinks vinha sendo declarado depois do early-return abaixo, o
  // que disparava React error #310 ("Rendered more hooks than during the
  // previous render") ao abrir o drawer pela primeira vez.
  const researchLinks = useMemo(() => {
    if (!lead) return [];
    // Achado do Daniel (19/08/2026): "Pesquisar empresa" buscava por
    // lead.company (o "título" do card, texto livre, pode ser algo como
    // "teste" — ver regra 1 do CLAUDE.md: Funil de Vendas não usa
    // EditableTitle justamente porque o título aqui é o Cliente vinculado,
    // não texto solto) em vez do nome do Cliente de fato ligado ao negócio
    // (exibido no painel esquerdo). Prioriza o cliente vinculado; cai pro
    // texto do card só como fallback pra negócio ainda sem cliente ligado.
    const linkedClient = lead.clientId ? clients.find(c => c.id === lead.clientId) : null;
    const name = linkedClient?.name || lead.company;
    const nameEnc = encodeURIComponent(name);
    const queryEnc = encodeURIComponent(`${name} ${lead.cnpj || ""}`.trim());
    return [
      { id: "google", label: "Google", icon: Search, href: `https://www.google.com/search?q=${queryEnc}` },
      { id: "linkedin", label: "LinkedIn", icon: Linkedin, href: `https://www.linkedin.com/search/results/people/?keywords=${nameEnc}` },
      { id: "news", label: "Google News", icon: Newspaper, href: `https://news.google.com/search?q=${nameEnc}&hl=pt-BR` },
      { id: "reclameaqui", label: "Reclame Aqui", icon: MessageSquareWarning, href: `https://www.reclameaqui.com.br/busca/?q=${nameEnc}` },
    ];
  }, [lead, clients]);

  if (!lead || !company) return null;

  // Mesma exclusão de cor em etapa terminal que o Kanban já aplica — um
  // negócio ganho/perdido não deveria mostrar "vencido" pra uma data de
  // fechamento passada.
  const currentStageInfo = companyStages.find(s => s.id === lead.stage);
  const isTerminalStage = Boolean(currentStageInfo?.terminal);
  const closeStyle = (lead.closeDate && !isTerminalStage) ? closeDateUrgencyStyle(lead.closeDate) : null;

  // Negócio Ganho -> Pós-venda: mesmo padrão de Recrutamento -> Onboarding
  // (ação explícita, só disponível numa etapa flag específica, ver
  // rh_pipeline_stages.won). O negócio de origem continua existindo aqui,
  // só marcado (sentToPosvendaAt) — nunca duas vezes sem querer.
  const isWonStage = Boolean(currentStageInfo?.won);
  const alreadySentToPosvenda = Boolean(lead.sentToPosvendaAt) || posvendaSent;

  // Restringe "Mover para" às transições configuradas em Comercial
  // > Editar etapas (mesma regra que já bloqueia o drag-and-drop no Kanban,
  // ver CRMView.jsx) — sem regra configurada pra empresa/etapa, permanece
  // aberto (todas as etapas), preservando o comportamento anterior. Gate de
  // etapa por valor (18/08/2026) segue o mesmo espírito: destino com
  // condição não atendida simplesmente não aparece como opção, em vez de um
  // botão que erra ao clicar — mesmo padrão já usado aqui pra transição
  // desabilitada pela matriz.
  const moveTargets = companyStages.filter(s => {
    if (s.id === lead.stage) return false;
    if (pipelineTransitions && !pipelineTransitions.isTransitionAllowed(lead.companyId, lead.stage, s.id)) return false;
    const gate = pipelineTransitions?.getTransitionCondition?.(lead.companyId, lead.stage, s.id);
    return !gate || evaluateConditionGroups(gate, lead.customFields || {});
  });

  const handleCopyDraft = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(emailDraft).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // FASE 5: mais de um responsável por card. `owner` (escalar) continua
  // sendo mantido pelo trigger do banco como membro de `owner_ids` — só
  // `ownerIds` é editado aqui.
  const handleOwnerIdsChange = (newIds) => {
    onUpdate(lead.id, { ownerIds: newIds });
  };

  // Achado da revisão de QA (11/08/2026): isto abria mailto: (só sabia dizer
  // "iniciado", nunca confirmava envio de verdade) bem em cima da nova aba
  // "Email" que manda de verdade via Resend — duas ações de "enviar e-mail"
  // competindo, uma delas fingindo. Agora só leva pra aba Email com o
  // rascunho da IA pré-preenchido; o envio real (e o registro de atividade
  // real) acontece de lá, um caminho só.
  const handleStartOutreach = () => {
    setEmailPrefill({ subject: `${company.name} · ${lead.triggerLabel}`, body: emailDraft });
    setSideTab("email");
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

  // "Já está negociando com esse cliente?" (Formulário Inicial) — campo comum,
  // editável direto (sem toggle "Alterar", diferente do follow-up acima) —
  // spec aprovada com o Daniel. Vazio grava NULL (volta a usar createdAt).
  const handleNegotiationStartedAtChange = (val) => {
    onUpdate(lead.id, { negotiationStartedAt: val ? localDateInputToISOString(val) : null });
  };

  // Origem do negócio. A importação de feira já grava isso sozinha; aqui é o
  // caminho manual — cobre o lead que o vendedor conheceu no estande e
  // cadastrou à mão depois, que costuma ser o melhor da feira e que ficaria
  // fora do relatório se o vínculo existisse só na importação.
  const handleCampaignChange = (val) => {
    const campaign = (campaigns || []).find(c => c.id === val) || null;
    onUpdate(lead.id, {
      campaignId: val || null,
      // triggerLabel segue espelhando o nome pra não quebrar export CSV e
      // telas antigas que leem esse campo. Ao limpar a campanha, limpa junto:
      // senão o CSV exportaria uma feira que o negócio não tem mais.
      triggerLabel: campaign ? campaign.name : null,
    });
  };

  const handleStartEditContactEmail = () => {
    setContactEmailDraft(lead.contactEmail || "");
    setContactEmailError(null);
    setEditingContactEmail(true);
  };

  const handleSaveContactEmail = () => {
    const trimmed = contactEmailDraft.trim();
    if (trimmed && !new RegExp(EMAIL_PATTERN).test(trimmed)) {
      setContactEmailError("E-mail inválido.");
      return;
    }
    setContactEmailError(null);
    onUpdate(lead.id, { contactEmail: trimmed || null });
    setEditingContactEmail(false);
  };

  const handleCancelContactEmail = () => {
    setContactEmailDraft(lead.contactEmail || "");
    setContactEmailError(null);
    setEditingContactEmail(false);
  };

  const handleSendToPosvenda = async () => {
    if (!isWonStage || alreadySentToPosvenda || sendingToPosvenda) return;
    setSendingToPosvenda(true);
    setPosvendaError(null);
    try {
      await createPosvendaCaseFromLead(lead, currentUser?.id);
      await onUpdate(lead.id, { sentToPosvendaAt: new Date().toISOString() });
      setPosvendaSent(true);
    } catch (e) {
      setPosvendaError(e.message || "Não foi possível enviar para o Funil de Pós-venda.");
    } finally {
      setSendingToPosvenda(false);
    }
  };

  const canDelete = onDelete && (
    isManager ||
    (currentUser && (
      (lead.ownerIds || []).includes(currentUser.id) ||
      lead.owner === currentUser.id ||
      lead.createdBy === currentUser.id
    ))
  );

  return (
    <>
    <SplitPanelDrawer
      onClose={onClose}
      onDelete={canDelete ? () => onDelete(lead.id) : undefined}
      deleteLabel="Excluir card"
      header={(
        <div className="flex items-center gap-2">
          <CompanyTag companyId={lead.companyId} />
          <UrgencyTag urgency={lead.urgency} />
          {/* Alerta de concorrente (18/08/2026) — Fase 1: só destaca o que a
              Ata de voz já captura em meta.concorrente, sem scan de texto
              livre ainda (ver src/utils/competitor-alert.js). */}
          {competitorMention && (
            <span
              title={`Concorrente citado: ${competitorMention.name} — ${formatDateBR(competitorMention.at)}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold"
              style={{ background: "var(--amber-bg)", color: "var(--amber)" }}
            >
              <MessageSquareWarning size={11} strokeWidth={2.5} />
              {competitorMention.name}
            </span>
          )}
          {onAddActivity && (
            <button
              onClick={() => setAtaFloatingOpen(true)}
              data-tour="ata-voz-gravar-header"
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shrink-0"
              style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none" }}
            >
              <Mic size={13} /> Gravar ata
            </button>
          )}
        </div>
      )}
      left={(
        <>
            {/* Cliente vinculado — substitui o bloco de empresa */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)", letterSpacing: "0.06em" }}>
                  Cliente
                </div>
                <div className="hidden lg:block"><FitScoreCircle score={computeFitScore(lead)} size={40} /></div>
              </div>
              <ClientSelector
                value={lead.clientId}
                clients={clients}
                onChange={(id) => onUpdate(lead.id, { clientId: id })}
                onCreate={onCreateClient ? (query) => setQuickCreateName(query || "") : undefined}
              />
              {quickCreateName !== null && (
                <ClientQuickCreateModal
                  initialName={quickCreateName || lead.company || ""}
                  initialCnpj={lead.cnpj || ""}
                  extra={{ city: lead.city || null, state: lead.state || null }}
                  clients={clients}
                  onCreate={onCreateClient}
                  onDone={(created) => {
                    if (created?.id) onUpdate(lead.id, { clientId: created.id });
                    setQuickCreateName(null);
                  }}
                  onClose={() => setQuickCreateName(null)}
                />
              )}
              {!lead.clientId && (
                <div className="flex items-center gap-1.5 text-xs flex-wrap mt-2" style={{ color: "var(--text-dim)" }}>
                  <span>Lead:</span>
                  <b style={{ color: "var(--text)", fontWeight: 600 }}>{lead.company || "—"}</b>
                  {lead.cnpj && <span className="font-mono">· {lead.cnpj}</span>}
                  {lead.city && <span className="flex items-center gap-1">· <MapPin size={11} />{lead.city}</span>}
                </div>
              )}

              {/* E-mail do contato — linha compacta (era card com label +
                  botão "Adicionar"/"Alterar"). Bloco "E-mails vinculados"
                  removido (feature nunca implementada — nada grava
                  lead.linkedEmails, ver CLAUDE.md). */}
              <div className="mt-3">
                {!editingContactEmail && (
                  <button
                    onClick={handleStartEditContactEmail}
                    className="w-full flex items-center gap-1.5 text-sm py-1.5 rounded-lg transition-colors cursor-pointer"
                    style={{ color: lead.contactEmail ? "var(--text)" : "var(--text-dim)", background: "transparent", border: "none" }}
                  >
                    <Mail size={13} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
                    <span className={`flex-1 min-w-0 truncate ${lead.contactEmail ? "" : "italic"}`}>
                      {lead.contactEmail || "Adicionar e-mail"}
                    </span>
                  </button>
                )}

                {editingContactEmail && (
                  <div className="mt-1">
                    <input
                      type="email"
                      value={contactEmailDraft}
                      onChange={e => { setContactEmailDraft(e.target.value); setContactEmailError(null); }}
                      placeholder="contato@empresa.com.br"
                      className="w-full text-sm rounded-lg border px-3 py-2 outline-none transition-colors"
                      style={{ borderColor: contactEmailError ? "var(--danger)" : "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                      onFocus={e => { if (!contactEmailError) e.currentTarget.style.borderColor = company.primary; }}
                      onBlur={e => { if (!contactEmailError) e.currentTarget.style.borderColor = "var(--border)"; }}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveContactEmail(); if (e.key === "Escape") handleCancelContactEmail(); }}
                      autoFocus
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Button variant="primary" size="sm" accent={company.primary} icon={Check} onClick={handleSaveContactEmail}>
                        Salvar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleCancelContactEmail}>
                        Cancelar
                      </Button>
                    </div>
                    {contactEmailError && (
                      <div className="text-xs mt-1" style={{ color: "var(--danger)" }}>{contactEmailError}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Pesquisar empresa — junto do bloco Cliente, não mais no
                  painel central da etapa. Item 4 aprovado no mockup de
                  27/08/2026 (Opção A): 4 ícones soltos viravam poluição visual
                  reportada pelo Daniel — colapsados num único botão "Pesquisar". */}
              <div className="mt-2">
                <ResearchDropdown links={researchLinks} />
              </div>
            </div>

            {/* Responsáveis — FASE 5: mais de um responsável por card */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)", letterSpacing: "0.06em" }}>
                Responsáveis
              </div>
              <AssigneeMultiSelect
                value={lead.ownerIds?.length ? lead.ownerIds : (lead.owner ? [lead.owner] : [])}
                onChange={handleOwnerIdsChange}
                options={sellerOptions}
                placeholder="Selecionar responsáveis…"
              />
            </div>

            {/* Métricas compactas — Prob. / Fechamento / Follow-up.
                "Unidades" removida (duplicava "Produto vinculado" abaixo).
                "Prob." perdeu o fundo tingido de company.primary (passava
                impressão de alerta sem motivo — CLAUDE.md); fundo neutro
                igual ao de "Fechamento". Follow-up vira o 3º mini-card no
                lugar de "Unidades", clicável, abrindo o mesmo fluxo de
                edição de antes (input de data + salvar/cancelar) fora do
                grid, logo abaixo. */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg p-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>Prob.</div>
                <div className="text-sm font-bold mt-0.5" style={{ color: company.primary }}>
                  {probDisplay}%
                </div>
              </div>
              <div
                className="rounded-lg p-2"
                style={{
                  background: closeStyle ? closeStyle.bg : "var(--surface)",
                  border: `1px solid ${closeStyle ? closeStyle.border : "var(--border)"}`,
                }}
              >
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>Fechamento</div>
                <div className="text-xs font-bold mt-0.5 truncate" style={{ color: closeStyle ? closeStyle.text : "var(--text)" }}>
                  {lead.closeDate ? formatDateBR(lead.closeDate).replace(/(\d{2}\/\d{2}\/)\d{2}(\d{2})$/, "$1$2") : "—"}
                </div>
              </div>
              <button
                onClick={() => setShowFollowUpInput(true)}
                className="rounded-lg p-2 text-left cursor-pointer transition-all duration-150"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <div className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>
                  <Calendar size={9} />Follow-up
                </div>
                <div className="text-xs font-bold mt-0.5 truncate" style={{ color: "var(--text)" }}>
                  {lead.nextFollowUp ? formatDateBR(lead.nextFollowUp) : "Agendar"}
                </div>
              </button>
            </div>

            {showFollowUpInput && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="flex-1 text-sm rounded-lg border px-3 py-2 outline-none transition-colors cursor-pointer"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                  onFocus={e => { e.currentTarget.style.borderColor = company.primary; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                  autoFocus
                />
                <Button variant="primary" size="sm" accent={company.primary} icon={Check} onClick={handleSaveFollowUp}>
                  Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancelFollowUp}>
                  Cancelar
                </Button>
              </div>
            )}

            {/* Contato inicial (histórico) — era rotulado "Decisor", mas
                virou snapshot congelado do que foi digitado na captação
                desse negócio (comitê de compra 18/08/2026): não tem como
                virar client_contacts sem migração de dado, e um negócio
                fechado antigo pode não bater com o comitê atual do cliente.
                Só ocupa espaço quando há dado real (achado do Daniel). */}
            {decisionMakerName !== "—" && (
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-dim)" }}>
                  Contato inicial (histórico)
                </div>
                <div className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>{decisionMakerName}</div>
                {decisionMakerRole !== "—" && (
                  <div className="text-xs truncate" style={{ color: "var(--text-dim)" }}>{decisionMakerRole}</div>
                )}
              </div>
            )}

            {/* Comitê de compra — lê direto de client_contacts (cadastro do
                cliente, aba "Contatos"), read-only aqui: edição vive só no
                cadastro do cliente, pra não duplicar UI de CRUD. */}
            <ClientCommitteeSection clientId={lead.clientId} />
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
                      {customValues.capture_utm_campaign && ` · ${customValues.capture_utm_campaign}`}
                      {customValues.capture_content_id && ` · ${String(customValues.capture_content_id).toUpperCase()}`}
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
                      color: customValues.capture_priority === "Alta" ? "var(--danger)"
                        : customValues.capture_priority === "Média" ? "var(--amber)"
                        : "var(--success)"
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

            {/* Overlap (gerente) — sobe da antiga aba "Fase atual" pro bloco
                de identidade: fica sempre visível, não é campo da etapa. */}
            {isManager && overlaps.length > 0 && (
              <div
                className="p-3.5 rounded-xl border-l-4"
                style={{ background: "var(--amber-bg)", borderLeftColor: "var(--amber)" }}
              >
                <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--amber)" }}>
                  <Network size={12} />
                  Overlap detectado · visível só para gerente
                </div>
                <div className="text-sm mb-2" style={{ color: "var(--text)" }}>
                  Este cliente também está ativo em:
                </div>
                {overlaps.map(o => {
                  // FASE 5: overlap precisa considerar todo responsável do
                  // outro negócio, não só o `owner` escalar (que pode estar
                  // desatualizado se o negócio ganhou co-responsáveis depois).
                  const names = getLeadOwnerIds(o).map(id => users.find(x => x.id === id)?.name).filter(Boolean);
                  return (
                    <div
                      key={o.id}
                      className="text-xs p-2 rounded-lg mb-1 flex items-center justify-between"
                      style={{ background: "var(--surface)" }}
                    >
                      <div className="flex items-center gap-2">
                        <CompanyTag companyId={o.companyId} />
                        <span style={{ color: "var(--text)" }}>{names.length ? names.join(", ") : "—"}</span>
                      </div>
                      <span className="font-mono" style={{ color: "var(--text-dim)" }}>
                        {formatK(o.value)} · {o.stage}
                      </span>
                    </div>
                  );
                })}
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

            {/* Amostras enviadas — registro de amostra física dada ao
                cliente durante a negociação, com custo, pra depois cruzar
                com conversão (lead ganhou ou não). Mesmo padrão visual de
                bloco de lista relacionada ao lead usado em "Produto
                vinculado" acima / AttachmentsPanel (linha com borda,
                lixeira inline por item). */}
            <SamplesPanel key={lead.id} leadId={lead.id} companyColor={company.primary} currentUser={currentUser} />

            <div className="pt-1">
              <Button variant="primary" size="sm" icon={Send} accent={company.primary} onClick={handleStartOutreach}>
                Preparar e-mail de abordagem
              </Button>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", margin: "2px 0" }} />

            <SideTabs activeTab={sideTab} onChange={setSideTab} />

            {/* ── Tab: Form (só o Formulário Inicial — snapshot da criação) ── */}
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
                  {lead.value > 0 && <CaptureRow label="Valor" value={formatBRL(lead.value)} />}
                  {lead.owner && (
                    <CaptureRow
                      label="Responsável na criação"
                      value={(users || []).find(u => u.id === lead.owner)?.name || "—"}
                      hint="Somente leitura — quem edita é “Responsáveis”, ao lado."
                    />
                  )}
                  <NegotiationStartRow
                    value={lead.negotiationStartedAt ? lead.negotiationStartedAt.slice(0, 10) : ""}
                    onChange={handleNegotiationStartedAtChange}
                  />
                  <OriginCampaignRow
                    value={lead.campaignId}
                    campaigns={campaigns}
                    lead={lead}
                    onChange={handleCampaignChange}
                  />
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
                  <CaptureRow label="utm_source" value={customValues.capture_utm_source} mono />
                  <CaptureRow label="utm_medium" value={customValues.capture_utm_medium} mono />
                  <CaptureRow label="utm_campaign" value={customValues.capture_utm_campaign} mono />
                  <CaptureRow
                    label="Peça (content_id)"
                    value={customValues.capture_content_id || customValues.capture_utm_content
                      ? String(customValues.capture_content_id || customValues.capture_utm_content).toUpperCase()
                      : null}
                    mono
                  />
                  <NegotiationStartRow
                    value={lead.negotiationStartedAt ? lead.negotiationStartedAt.slice(0, 10) : ""}
                    onChange={handleNegotiationStartedAtChange}
                  />
                  <OriginCampaignRow
                    value={lead.campaignId}
                    campaigns={campaigns}
                    lead={lead}
                    onChange={handleCampaignChange}
                  />
                </dl>
                {customValues.capture_notes && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--surface-alt)" }}>
                    <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>Mensagem</div>
                    <div className="text-sm whitespace-pre-line" style={{ color: "var(--text)" }}>{customValues.capture_notes}</div>
                  </div>
                )}
              </div>
            )}
            </>
            )}

            {/* ── Tab: Email ── */}
            {sideTab === "email" && (
              <EmailPanel lead={lead} currentUser={currentUser} onAddActivity={onAddActivity} initialDraft={emailPrefill} />
            )}

            {/* ── Tab: WhatsApp (Fase 1, dormente — ver docs/design-spec-whatsapp-fase1.md) ── */}
            {sideTab === "whatsapp" && (
              <WhatsAppPanel leadId={lead.id} />
            )}

            {/* ── Tab: Atividades ── */}
            {sideTab === "atividades" && (
              <ActivitiesPanel
                stageHistory={stageHistory}
                activities={lead.activities || []}
                users={users}
                canRecordAta={Boolean(onAddActivity)}
              />
            )}

            {/* ── Tab: Histórico ── */}
            {sideTab === "historico" && (
              stageHistory.length === 0 ? (
                <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>Nenhuma transição registrada.</div>
              ) : (
                <ol className="space-y-2.5 relative" style={{ paddingLeft: 18 }}>
                  <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 1, background: "var(--border)" }} />
                  {stageHistory.map((h, i) => {
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
                </ol>
              )
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
                  stageName={currentStageInfo?.name}
                  slaDays={currentStageInfo?.slaDays}
                  stageFieldValues={visibleCustomDefs
                    .map(f => ({ label: f.label, value: customValuesByKey[f.fieldKey] }))
                    .filter(f => f.value !== undefined && f.value !== null && f.value !== "")}
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

            {/* ── Tab: PDF ── */}
            {/* Mantido montado (display:none) quando a aba não está ativa pra
                não perder o rascunho da proposta ao trocar de aba; key={lead.id}
                reseta ao navegar pra outro lead. Achado da 2ª auditoria. */}
            <div style={{ display: sideTab === "pdf" ? undefined : "none" }}>
              <ProposalPanel key={lead.id} lead={lead} currentUser={currentUser} allLeads={allLeads} onAddActivity={onAddActivity} />
            </div>
        </>
      )}
      center={(
        <>
          {/* Campos customizados da etapa — editáveis inline (save debounced).
              Único conteúdo do centro (padrão platform-wide, CLAUDE.md regra
              3/item 2) — Overlap/Produto/Follow-up/e-mail de abordagem
              subiram pro bloco de identidade na esquerda; "Etapa do funil"
              (select) foi removido por duplicar o "Mover para" da direita. */}
          {visibleCustomDefs.length === 0 ? (
            <button
              onClick={() => onEditFields?.({ stage: lead.stage, companyId: lead.companyId })}
              className="text-xs text-center cursor-pointer"
              style={{ background: "none", border: "none", color: "var(--text-dim)", lineHeight: 1.6, padding: "16px 0", textAlign: "center", width: "100%" }}
            >
              Nenhum campo nessa fase. <span style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}>Clique aqui para editar essa etapa.</span>
            </button>
          ) : (
            <div className="p-4 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: company.primary }}>
                  Fase atual · {DEFAULT_PIPELINE_STAGES.find(s => s.id === lead.stage)?.name || lead.stage}
                </div>
                {customSaveState && (
                  <span style={{ fontSize: 11, color: "var(--text-dim)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {customSaveState === "saving" ? "Salvando…" : "Salvo ✓"}
                  </span>
                )}
              </div>
              <div className="space-y-4">
                {visibleCustomDefs.map(f => (
                  <div key={f.id}>
                    <label className="block" style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
                      {f.effectiveRequired && <span style={{ color: "var(--danger)", marginRight: 4 }}>*</span>}
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
                      touched={Boolean(moveError)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {moveError && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>{moveError}</span>
            </div>
          )}
        </>
      )}
      right={(
        <MoveAndCommentsPanel
          moveError={moveError}
          stageTargets={moveTargets}
          onMove={moveToStage}
          currentStageKey={lead.stage}
          allStages={companyStages}
          commentsFeed={commentsFeed}
          currentUser={currentUser}
          mentionableUsers={mentionableUsers}
          onAddComment={handleAddComment}
          onUpdateComment={onUpdateComment}
          onRetryOfflineActivity={onRetryOfflineActivity}
          isManager={isManager}
          onNavigateToPipelineBuilder={onNavigateToPipelineBuilder}
          onGoToIA={() => setSideTab("ia")}
          isWonStage={isWonStage}
          alreadySentToPosvenda={alreadySentToPosvenda}
          sendingToPosvenda={sendingToPosvenda}
          posvendaError={posvendaError}
          onSendToPosvenda={handleSendToPosvenda}
        />
      )}
    />
    {onAddActivity && (
      <Modal open={ataFloatingOpen} onClose={() => setAtaFloatingOpen(false)} title="Gravar ata" width={640}>
        <div className="p-4">
          <AtaVozPanel
            lead={lead}
            currentUser={currentUser}
            onAddActivity={onAddActivity}
            onUpdate={onUpdate}
            onSaved={() => setAtaFloatingOpen(false)}
          />
        </div>
      </Modal>
    )}
    </>
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

// Comitê de compra (18/08/2026) — lista read-only dos contatos ativos do
// cliente vinculado (client_contacts, cadastro em Clientes → Contatos).
// Read-only aqui de propósito: editar vive só no cadastro do cliente, pra
// não duplicar UI de CRUD num painel de lead que já é denso.
function ClientCommitteeSection({ clientId }) {
  const { rows, loading } = useClientContacts(clientId);
  const ativos = rows.filter(c => c.active);
  if (!clientId || loading || ativos.length === 0) return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-dim)" }}>
        Comitê de compra
      </div>
      <div className="space-y-1.5">
        {ativos.map(c => (
          <div key={c.id} className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-xs truncate" style={{ color: "var(--text)" }}>{c.name}</span>
            {c.job_title && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                    style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
                {c.job_title}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Side-tab system ─────────────────────────────────────────────────────────

const SIDE_TAB_HINTS = {
  ia: "Assistente de IA sob demanda para este lead — briefing, rascunho de e-mail, próximo passo, análise de objeção. Use quando precisa de apoio antes de uma ação específica. Para sugestões automáticas em toda a carteira, veja Time de Agentes.",
};

const SIDE_TABS = [
  { id: "form",         label: "Form",        icon: FileText },
  { id: "email",        label: "Email",       icon: Mail },
  { id: "whatsapp",     label: "WhatsApp",    icon: MessageCircle },
  { id: "atividades",   label: "Atividades",  icon: Activity },
  { id: "historico",    label: "Histórico",   icon: History },
  { id: "ia",           label: "IA",          icon: Sparkles },
  { id: "anexos",       label: "Anexos",      icon: Paperclip },
  { id: "checklists",   label: "Checklists",  icon: ListChecks },
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
            data-tour={`lead-tab-${t.id}`}
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

// ── Mover etapa + comentários — compartilhado entre a aside desktop e a
// aba "Ações" do mobile (achado da auditoria de fricção de 18/07: no
// mobile só dava pra avançar pra próxima etapa via CTA fixo, sem pular
// etapa livremente e sem acesso a comentários/@menção). ──────────────
function MoveAndCommentsPanel({
  moveError, stageTargets, onMove, currentStageKey, allStages,
  commentsFeed, currentUser, mentionableUsers, onAddComment, onUpdateComment, onRetryOfflineActivity,
  isManager, onNavigateToPipelineBuilder, onGoToIA,
  isWonStage, alreadySentToPosvenda, sendingToPosvenda, posvendaError, onSendToPosvenda,
}) {
  return (
    <>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" }}>
        Mover para
      </div>
      {moveError && (
        <div className="flex items-start gap-2 p-2.5 mb-2 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          {moveError}
        </div>
      )}
      <StageNavigator
        targets={stageTargets}
        onMove={onMove}
        getKey={(s) => s.id}
        currentStageKey={currentStageKey}
        allStages={allStages}
      />

      {/* Enviar para Pós-venda — só aparece na etapa Ganho (rh_pipeline_stages
          .won), mesmo padrão do "Contratar" em Recrutamento->Onboarding: ação
          explícita, cria um card novo no Kanban de Pós-venda, o negócio aqui
          continua existindo (só marcado como já enviado). */}
      {isWonStage && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          {alreadySentToPosvenda ? (
            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-dim)" }}>
              <Handshake size={13} />
              Já enviado para o Funil de Pós-venda
            </div>
          ) : (
            <>
              <button
                onClick={onSendToPosvenda}
                disabled={sendingToPosvenda}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs cursor-pointer"
                style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", opacity: sendingToPosvenda ? 0.6 : 1 }}
              >
                <Handshake size={14} />
                {sendingToPosvenda ? "Enviando…" : "Enviar para o Funil de Pós-venda"}
              </button>
              {posvendaError && (
                <div className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{posvendaError}</div>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <CommentsPanel
          comments={commentsFeed}
          currentUser={currentUser}
          mentionableUsers={mentionableUsers}
          onAddComment={onAddComment}
          onUpdateComment={onUpdateComment}
          onRetryOfflineActivity={onRetryOfflineActivity}
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
            Editar etapas do pipeline
          </a>
        )}
        <a
          href="#"
          onClick={e => { e.preventDefault(); onGoToIA(); }}
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--text-dim)", textDecoration: "none" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#7C3AED"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
        >
          <Sparkles size={12} />
          Mover cards com IA
        </a>
      </div>
    </>
  );
}

function ActivitiesPanel({ stageHistory, activities, users, canRecordAta }) {
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
      <div className="space-y-3">
        <PlaceholderPanel
          icon={Activity}
          title="Atividades"
          hint={canRecordAta ? "Movimentações entre etapas e edições aparecem aqui — grave uma ata pelo botão no topo do card." : "Movimentações entre etapas e edições aparecem aqui."}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
          // Ícone por tipo vem da taxonomia compartilhada (utils/activity-types.js)
          // — tipo novo ganha ícone/rótulo sem precisar tocar neste switch, que
          // era exatamente como 'email_sent'/'proposal_generated' cairiam aqui
          // como item genérico.
          const { icon: TypeIcon } = activityTypeMeta(a.type);
          return (
            <li key={i} className="text-xs flex items-start gap-2" style={{ color: "var(--text)" }}>
              <TypeIcon size={12} style={{ flexShrink: 0, marginTop: 2, color: "var(--text-dim)" }} />
              <div className="min-w-0 flex-1">
                {a.type === "stage" ? (
                  <div>
                    <span style={{ color: "var(--text-dim)" }}>{userName} </span>
                    moveu para <strong>{toStage?.name || a.to}</strong>
                    {fromStage && <span style={{ color: "var(--text-dim)" }}> (de {fromStage.name})</span>}
                  </div>
                ) : a.type === "ata_voz" ? (
                  // Ata rende mais que uma linha: o resumo é o que se lê, mas
                  // o próximo passo e o concorrente são o que fazem alguém
                  // agir. Ficam à vista, não escondidos no meta.
                  <div>
                    <span style={{ color: "var(--text-dim)" }}>{userName} </span>
                    registrou uma <strong>ata de visita</strong>
                    <div className="mt-1.5 px-2.5 py-2 rounded-lg text-[11.5px]"
                         style={{ background: "var(--surface-alt)", borderLeft: "2px solid var(--accent)", color: "var(--text)", lineHeight: 1.55 }}>
                      {a.body}
                    </div>
                    {(a.meta?.proximoPasso || a.meta?.concorrente) && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px]" style={{ color: "var(--text-dim)" }}>
                        {a.meta?.proximoPasso && (
                          <span>
                            Próximo passo: <strong style={{ color: "var(--text)" }}>{a.meta.proximoPasso}</strong>
                            {a.meta.proximoPassoData && ` · ${formatDateBR(a.meta.proximoPassoData)}`}
                          </span>
                        )}
                        {a.meta?.concorrente && <span>Concorrente: {a.meta.concorrente}</span>}
                      </div>
                    )}
                    {/* Check-in de visita (17/08/2026): localização sempre
                        anexada + vínculo com a visita planejada em Viagens,
                        mesmo padrão "Label: valor" das linhas acima. */}
                    {(a.meta?.location || a.meta?.viagemLabel) && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px]" style={{ color: "var(--text-dim)" }}>
                        {a.meta?.location && (
                          <span>
                            Local:{" "}
                            <a href={`https://www.google.com/maps/search/?api=1&query=${a.meta.location.lat},${a.meta.location.lng}`}
                               target="_blank" rel="noreferrer" style={{ color: "var(--text)", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 2 }}>
                              {a.meta.location.address || `${Number(a.meta.location.lat).toFixed(4)}, ${Number(a.meta.location.lng).toFixed(4)}`}
                            </a>
                          </span>
                        )}
                        {a.meta?.viagemLabel && <span>Visita planejada: {a.meta.viagemLabel}</span>}
                      </div>
                    )}
                    {a.meta?.origem === "audio" && (
                      <div className="text-[9.5px] mt-1" style={{ color: "var(--text-dim)" }}>
                        Transcrito de áudio — o arquivo original está em Anexos.
                      </div>
                    )}
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
    </div>
  );
}

// ── Email panel ────────────────────────────────────────────────────────────
//
// Aba "Email" (SIDE_TABS) — aprovada 11/08/2026, inspirada nos prints do
// Pipefy que o Daniel mandou, adaptada ao que já existia: substitui o
// mailto: de handleStartOutreach (que só sabia dizer "iniciado") por envio
// real via Resend (edge function send-crm-email), com histórico de verdade
// (useLeadEmails) e biblioteca de templates reaproveitável entre leads
// (useEmailTemplates). Variáveis são substituídas aqui no client, antes de
// enviar — o vendedor vê exatamente o texto final enquanto edita, a edge
// function não reprocessa nada.
const EMAIL_INPUT_BASE = {
  width: "100%", fontSize: 13, borderRadius: 6,
  border: "1px solid var(--border-strong)", padding: "8px 10px",
  background: "var(--surface)", color: "var(--text)", outline: "none", fontFamily: "inherit",
};

function applyEmailVars(text, vars) {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{{${k}}}`).join(v ?? ""), text || "");
}

function EmailPanel({ lead, currentUser, onAddActivity, initialDraft }) {
  const templatesHook = useEmailTemplates(currentUser?.id);
  const emailsHook = useLeadEmails(lead.id);
  const { createTask } = usePersonalTasks({ userId: currentUser?.id, enabled: true });

  const [templateId, setTemplateId] = useState("");
  const [toEmail, setToEmail] = useState(lead.contactEmail || "");
  // initialDraft vem de "Preparar e-mail de abordagem" (handleStartOutreach)
  // — só lido no mount (o componente é desmontado/remontado a cada troca de
  // aba, ver `{sideTab === "email" && (...)}`, então isto já funciona como
  // "aplica só quando chega vindo de lá").
  const [subject, setSubject] = useState(initialDraft?.subject || "");
  const [bodyText, setBodyText] = useState(initialDraft?.body || "");
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatDays, setRepeatDays] = useState(15);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  const vars = useMemo(() => ({
    contato: lead.company || "",
    empresa: lead.company || "",
    vendedor: currentUser?.name || "",
  }), [lead.company, currentUser?.name]);

  const applyTemplate = (id) => {
    setTemplateId(id);
    const tpl = templatesHook.templates.find(t => t.id === id);
    if (tpl) {
      setSubject(applyEmailVars(tpl.subject, vars));
      setBodyText(applyEmailVars(tpl.bodyHtml, vars));
    }
  };

  const handleSend = async () => {
    setNotice(null);
    // Achado da revisão de QA (11/08/2026): bodyText pode conter {{empresa}}/
    // {{contato}} já substituídos por lead.company — que vem de um formulário
    // PÚBLICO sem login (submit_lead_capture), sem nenhuma restrição de
    // caractere. Escapar aqui, não na hora de preencher o textarea (ali o
    // vendedor precisa ver o texto literal enquanto edita) — só no que
    // realmente vai virar HTML de verdade no e-mail.
    const bodyHtml = escapeHtml(bodyText).split("\n").map(line => line || "&nbsp;").join("<br/>");
    const cleanSubject = subject.replace(/[\r\n]+/g, " ").trim();
    const res = await emailsHook.sendEmail({ toEmail, subject: cleanSubject, bodyHtml, templateId: templateId || null });
    if (!res.success) return;

    onAddActivity?.(lead.id, {
      type: "email_sent",
      userId: currentUser?.id || null,
      userName: currentUser?.name || null,
      body: `E-mail enviado: "${subject}" para ${toEmail}`,
      meta: { to: toEmail, subject, channel: "resend" },
    });

    if (repeatEnabled && Number.isInteger(repeatDays) && repeatDays > 0) {
      const due = new Date();
      due.setDate(due.getDate() + repeatDays);
      // Achado da revisão de QA: createTask lança em erro (use-personal-tasks.js)
      // — sem try/catch aqui, uma falha na criação do lembrete (o e-mail já
      // tinha sido enviado com sucesso!) deixava a função sem nunca chegar no
      // setNotice/limpeza do formulário, como se nada tivesse acontecido.
      try {
        await createTask({
          title: `Enviar email pra ${lead.company || "cliente"}`,
          description: `Lembrete criado a partir do lead — repete a cada ${repeatDays} dias. Abra o lead e use a aba Email pra reenviar (ou ajustar antes de enviar de novo).`,
          priority: "media",
          status: "a_fazer",
          recurrence: "custom",
          recurrenceConfig: { intervalDays: repeatDays },
          dueDate: toLocalISODate(due),
          relatedLeadId: lead.id,
        });
        setNotice(`E-mail enviado — lembrete criado no seu Meu To-do pra daqui ${repeatDays} dias.`);
      } catch {
        setNotice("E-mail enviado — mas não deu pra criar o lembrete recorrente. Tente criar manualmente no Meu To-do.");
      }
    } else {
      setNotice("E-mail enviado.");
    }
    setSubject("");
    setBodyText("");
    setTemplateId("");
  };

  const canSend = toEmail.trim() && subject.trim() && bodyText.trim() && !emailsHook.sending;

  return (
    <div className="space-y-4">
      {notice && (
        <div className="p-2.5 rounded-lg text-xs" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
          {notice}
        </div>
      )}
      {emailsHook.sendError && (
        <div className="p-2.5 rounded-lg text-xs flex items-start gap-2" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          <AlertCircle size={13} className="shrink-0 mt-0.5" />{emailsHook.sendError}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>Template</div>
          <select value={templateId} onChange={e => applyTemplate(e.target.value)} style={EMAIL_INPUT_BASE}>
            <option value="">Em branco</option>
            {templatesHook.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <button
          onClick={() => setBuilderOpen(true)}
          className="text-xs font-semibold px-3 py-2 rounded-lg shrink-0"
          style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" }}
        >
          + Criar template
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>Para</div>
          <input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="contato@cliente.com.br" style={EMAIL_INPUT_BASE} />
        </div>
        <div>
          <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>Assunto</div>
          <input value={subject} onChange={e => setSubject(e.target.value)} style={EMAIL_INPUT_BASE} />
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>Mensagem</div>
        <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} rows={6} style={{ ...EMAIL_INPUT_BASE, resize: "vertical" }} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-dim)" }}>
          <input type="checkbox" checked={repeatEnabled} onChange={e => setRepeatEnabled(e.target.checked)} />
          Repetir a cada
          <input
            type="number" min={1} max={365} value={repeatDays}
            onChange={e => setRepeatDays(Math.min(365, Math.max(1, Number(e.target.value) || 1)))}
            disabled={!repeatEnabled}
            style={{ ...EMAIL_INPUT_BASE, width: 52, padding: "4px 6px", opacity: repeatEnabled ? 1 : 0.5 }}
          />
          dias (cria lembrete no Meu To-do)
        </label>
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="px-4 py-2 rounded-lg text-xs font-bold shrink-0"
          style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: canSend ? "pointer" : "default", opacity: canSend ? 1 : 0.5 }}
        >
          {emailsHook.sending ? "Enviando…" : "Enviar email"}
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div className="text-[11px] font-semibold mb-2" style={{ color: "var(--text-dim)" }}>Já enviados</div>
        {emailsHook.loading ? (
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>Carregando…</div>
        ) : emailsHook.emails.length === 0 ? (
          <div className="text-xs italic" style={{ color: "var(--text-dim)" }}>Nenhum e-mail enviado ainda.</div>
        ) : (
          <div className="space-y-1.5">
            {emailsHook.emails.map(e => (
              <div key={e.id} className="p-2.5 rounded-lg border flex items-start gap-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                  style={{
                    background: e.status === "sent" ? "var(--success-bg)" : "var(--danger-bg)",
                    color: e.status === "sent" ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {e.status === "sent" ? "✓" : "!"}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>{e.subject}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                    {e.status === "sent" ? "Enviado" : `Falhou: ${e.errorMessage || "erro desconhecido"}`} · {new Date(e.sentAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · pra {e.toEmail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EmailTemplateBuilderModal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSave={templatesHook.addTemplate}
      />
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

// ── Pesquisar empresa ────────────────────────────────────────────────────────
// Item 4 aprovado no mockup de 27/08/2026 (Opção A): os 4 ícones soltos
// (Google/LinkedIn/Google News/Reclame Aqui) viraram um único botão
// "Pesquisar" com dropdown — mesma lista de links, sem o custo visual de 4
// alvos de clique permanentes na coluna esquerda.
function ResearchDropdown({ links }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  if (!links?.length) return null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 cursor-pointer"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-dim)", padding: "6px 10px" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
      >
        <Search size={13} strokeWidth={2} />
        Pesquisar
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
            boxShadow: "var(--shadow-pop)", minWidth: 170, overflow: "hidden",
          }}
        >
          {links.map(l => {
            const Icon = l.icon;
            return (
              <a
                key={l.id}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 text-xs"
                style={{ padding: "8px 12px", color: "var(--text)", textDecoration: "none" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <Icon size={13} strokeWidth={2} style={{ flexShrink: 0, color: "var(--text-dim)" }} />
                {l.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Amostras enviadas ────────────────────────────────────────────────────────
// Aprovado via mockup com o Daniel — bloco de lista relacionada ao lead,
// mesmo padrão visual de AttachmentsPanel logo abaixo (linha com borda,
// lixeira inline por item, sem modal de confirmação chamativo — registro
// pequeno, não entidade grande tipo Fornecedor, regra do CLAUDE.md).
function SamplesPanel({ leadId, companyColor, currentUser }) {
  const { samples, loading, error, createSample, deleteSample, totalCost } = useLeadSamples(leadId);
  const [modalOpen, setModalOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [sentAt, setSentAt] = useState(() => toLocalISODate(new Date()));
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);
  // Item 5 aprovado no mockup de 27/08/2026 (Opção A): bloco fixo aberto era
  // uma das duas fontes de poluição na coluna esquerda que o Daniel apontou —
  // colapsado por padrão quando vazio, abre sozinho na 1ª vez que carregar com
  // dado (não reabre depois se o usuário recolher de propósito).
  const [expanded, setExpanded] = useState(false);
  const autoExpandedRef = useRef(false);
  useEffect(() => {
    if (!loading && samples.length > 0 && !autoExpandedRef.current) {
      autoExpandedRef.current = true;
      setExpanded(true);
    }
  }, [loading, samples.length]);

  const openModal = () => {
    setNotes("");
    setSentAt(toLocalISODate(new Date()));
    setCost("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!notes.trim() || saving) return;
    setSaving(true);
    try {
      // `created_by` vem do `DEFAULT auth.uid()` no banco, não do cliente
      // (policy de INSERT exige que bata com o usuário autenticado).
      await createSample({ notes: notes.trim(), sentAt, cost });
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: expanded ? 12 : 0 }}>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          style={{ color: companyColor, background: "transparent", border: "none", padding: 0 }}
        >
          <ChevronDown size={13} style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
          🧪 Amostras enviadas{samples.length > 0 ? ` (${samples.length})` : ""}
        </button>
        <button
          onClick={e => { e.stopPropagation(); openModal(); }}
          className="text-xs font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer"
          style={{ color: companyColor, background: companyColor + "18", border: "none" }}
          onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.95)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
        >
          <Plus size={11} />Registrar amostra
        </button>
      </div>

      {expanded && loading && (
        <div className="text-xs text-center py-2" style={{ color: "var(--text-dim)" }}>Carregando…</div>
      )}

      {expanded && !loading && samples.length === 0 && (
        <div className="text-xs text-center py-2 italic" style={{ color: "var(--text-dim)" }}>
          Nenhuma amostra registrada ainda.
        </div>
      )}

      {expanded && samples.length > 0 && (
        <div className="space-y-1.5">
          {samples.map(s => (
            <div
              key={s.id}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border"
              style={{ background: "var(--surface-alt)", borderColor: "var(--border)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
                  {s.notes || "Amostra"}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                  {formatDateBR(s.sent_at)}
                </div>
              </div>
              <div className="text-xs font-semibold shrink-0" style={{ color: "var(--text)" }}>
                {formatBRL(s.cost)}
              </div>
              <button
                onClick={() => deleteSample(s.id)}
                className="p-1.5 rounded-lg transition-colors shrink-0"
                style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-bg)"; e.currentTarget.style.color = "var(--danger)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                title="Excluir amostra"
                aria-label="Excluir amostra"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {expanded && samples.length > 0 && (
        <div className="flex items-center justify-between mt-3 pt-3 text-xs" style={{ borderTop: "1px solid var(--surface-alt)" }}>
          <span className="font-semibold" style={{ color: "var(--text-dim)" }}>Total gasto</span>
          <span className="font-bold" style={{ color: "var(--text)" }}>{formatBRL(totalCost)}</span>
        </div>
      )}

      {expanded && error && (
        <div className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{error}</div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar amostra" width={420}>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-dim)" }}>Descrição</label>
            <input
              autoFocus
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex.: Kit Sanbag 15L"
              className="w-full text-sm rounded-lg border px-3 py-2 outline-none transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onFocus={e => { e.currentTarget.style.borderColor = companyColor; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-dim)" }}>Data de envio</label>
            <input
              type="date"
              value={sentAt}
              onChange={e => setSentAt(e.target.value)}
              className="w-full text-sm rounded-lg border px-3 py-2 outline-none transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onFocus={e => { e.currentTarget.style.borderColor = companyColor; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold mb-1 block" style={{ color: "var(--text-dim)" }}>Custo</label>
            <CurrencyInput value={cost} onChange={setCost} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" accent={companyColor} disabled={saving || !notes.trim()} onClick={handleSave}>
              {saving ? "Registrando…" : "Registrar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AttachmentsPanel({ leadId, companyId, currentUser, companyColor }) {
  const { attachments, loading, uploading, error, upload, remove, getSignedUrl } = useLeadAttachments(leadId);
  const { documents: libraryDocs, getSignedUrl: getLibrarySignedUrl } = useDocumentLibrary();
  const { refs: libraryRefs, loading: refsLoading, attach: attachLibraryDoc, detach: detachLibraryDoc } = useLeadDocumentRefs(leadId);
  const [dragOver, setDragOver] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
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

  // Mescla anexo próprio (lead_attachments) + referência da biblioteca
  // (lead_document_refs, nunca copia o arquivo — ver use-document-library.js)
  // numa lista só, mais recente primeiro. Badge "Biblioteca" distingue os dois.
  const mergedItems = useMemo(() => {
    const own = attachments.map(a => ({
      kind: "own", id: a.id, label: a.file_name, file_size: a.file_size,
      mime_type: a.mime_type, created_at: a.created_at, file_path: a.file_path, raw: a,
    }));
    const lib = libraryRefs
      .filter(r => r.document_library)
      .map(r => ({
        kind: "library", id: r.id, label: r.document_library.title, file_size: null,
        mime_type: r.document_library.mime_type, created_at: r.created_at,
        file_path: r.document_library.file_path, expiresAt: r.document_library.expires_at, raw: r,
      }));
    return [...own, ...lib].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [attachments, libraryRefs]);

  const alreadyAttachedIds = useMemo(
    () => new Set(libraryRefs.map(r => r.document_library_id)),
    [libraryRefs]
  );

  const handleDownload = useCallback(async (item) => {
    setDownloadingId(item.id);
    try {
      const url = item.kind === "library"
        ? await getLibrarySignedUrl(item.file_path)
        : await getSignedUrl(item.file_path);
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = item.label;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloadingId(null);
    }
  }, [getSignedUrl, getLibrarySignedUrl]);

  const handleAttachFromLibrary = useCallback(async (documentLibraryId) => {
    await attachLibraryDoc(documentLibraryId, currentUser?.id || null);
  }, [attachLibraryDoc, currentUser]);

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

      <button
        type="button"
        data-tour="lead-anexar-biblioteca"
        onClick={() => setPickerOpen(true)}
        className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold rounded-lg border py-2 transition-colors"
        style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
      >
        <BookOpen size={13} /> Anexar da biblioteca
      </button>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {(loading || refsLoading) && (
        <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>Carregando…</div>
      )}

      {!loading && !refsLoading && mergedItems.length === 0 && (
        <div className="text-xs text-center py-2 italic" style={{ color: "var(--text-dim)" }}>
          Nenhum arquivo anexado ainda.
        </div>
      )}

      {mergedItems.length > 0 && (
        <div className="space-y-1.5">
          {mergedItems.map(item => {
            const expired = item.expiresAt && new Date(item.expiresAt) < new Date();
            return (
              <div
                key={`${item.kind}-${item.id}`}
                className="flex items-center gap-2.5 p-2.5 rounded-lg border"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}
                >
                  <FileIcon mimeType={item.mime_type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
                      {item.label}
                    </div>
                    {item.kind === "library" && (
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: "var(--surface-alt)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
                      >
                        Biblioteca
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: expired ? "var(--danger)" : "var(--text-dim)" }}>
                    {item.kind === "own" ? formatBytes(item.file_size) : (expired ? `Vencido em ${formatDateBR(item.expiresAt)}` : "Da biblioteca")}
                    {item.created_at && (
                      <> · {new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(item)}
                  disabled={downloadingId === item.id}
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
                  onClick={() => item.kind === "library" ? detachLibraryDoc(item.id) : remove(item.raw)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-bg)"; e.currentTarget.style.color = "var(--danger)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                  title={item.kind === "library" ? "Remover referência (o documento continua na biblioteca)" : "Remover arquivo"}
                  aria-label={item.kind === "library" ? "Remover referência" : "Remover arquivo"}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {pickerOpen && (
        <LibraryPickerModal
          companyId={companyId}
          documents={libraryDocs}
          alreadyAttachedIds={alreadyAttachedIds}
          onAttach={handleAttachFromLibrary}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

const DOCUMENT_LIBRARY_CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ value: id, label }));

function LibraryPickerModal({ companyId, documents, alreadyAttachedIds, onAttach, onClose }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const available = useMemo(
    () => documents.filter(d => (d.company_ids || []).includes(companyId) && !alreadyAttachedIds.has(d.id)),
    [documents, companyId, alreadyAttachedIds]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return available.filter(d => {
      if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
      if (q && !(d.title || "").toLowerCase().includes(q) && !(d.tags || []).some(t => t.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [available, search, categoryFilter]);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleConfirm = async () => {
    if (selected.size === 0) { onClose(); return; }
    setSaving(true);
    setError(null);
    try {
      await Promise.all(Array.from(selected).map(id => onAttach(id)));
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao anexar documento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Anexar da biblioteca" width={520}>
      <div className="p-5 space-y-3">
        <FilterBar
          search={{ value: search, onChange: e => setSearch(e.target.value), placeholder: "Buscar por título ou tag…" }}
          filters={[{
            id: "category",
            value: categoryFilter,
            onChange: e => setCategoryFilter(e.target.value),
            label: "Categoria",
            options: [{ value: "all", label: "Todas as categorias" }, ...DOCUMENT_LIBRARY_CATEGORY_OPTIONS],
          }]}
        />
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div className="text-xs text-center py-6 italic" style={{ color: "var(--text-dim)" }}>
              {available.length === 0 ? "Nenhum documento da biblioteca disponível pra esta empresa." : "Nenhum resultado pra estes filtros."}
            </div>
          ) : (
            <CardGrid density="list">
              {filtered.map(d => (
                <label key={d.id} style={{ display: "block", cursor: "pointer" }}>
                  <Card
                    density="list"
                    interactive={false}
                    icon={<FileText size={14} />}
                    title={d.title}
                    meta={CATEGORY_LABELS[d.category] || d.category}
                    headerAction={
                      <input
                        type="checkbox"
                        checked={selected.has(d.id)}
                        onChange={() => toggle(d.id)}
                        style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer" }}
                      />
                    }
                  />
                </label>
              ))}
            </CardGrid>
          )}
        </div>
        {error && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{error}</div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancelar</button>
          <button type="button" onClick={handleConfirm} disabled={saving || selected.size === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: saving || selected.size === 0 ? 0.6 : 1 }}>
            {saving ? "Anexando…" : `Anexar${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── WhatsApp panel (Fase 1, dormente) ─────────────────────────────────────────
// Só leitura — sem número dedicado aprovado no Meta Business Manager nem
// template homologado, não há como enviar nada de verdade ainda (ver
// docs/design-spec-whatsapp-fase1.md). A aba existe pronta pra popular
// quando o webhook real (Fase 2) chegar; até lá, mostra o estado vazio.
function WhatsAppPanel({ leadId }) {
  const { conversation, messages, loading } = useWhatsappConversation(leadId);

  if (loading) {
    return <div className="text-xs text-center py-4" style={{ color: "var(--text-dim)" }}>Carregando…</div>;
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <MessageCircle size={22} style={{ color: "var(--text-dim)" }} />
        <div className="text-xs" style={{ color: "var(--text-dim)" }}>Nenhuma conversa ainda.</div>
        <div className="text-[11px] max-w-[220px]" style={{ color: "var(--text-dim)" }}>
          A integração com WhatsApp ainda está em teste — esta aba fica pronta pra mostrar a conversa assim que estiver ativa.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs px-1">
        <span style={{ color: "var(--text-dim)" }}>{conversation.phone_number}</span>
        <span style={{ color: conversation.opt_in ? "var(--text)" : "var(--warning)" }}>
          {conversation.opt_in ? "Opt-in confirmado" : "Sem opt-in"}
        </span>
      </div>
      {messages.length === 0 ? (
        <div className="text-xs text-center py-4 italic" style={{ color: "var(--text-dim)" }}>Nenhuma mensagem ainda.</div>
      ) : (
        <div className="space-y-1.5">
          {messages.map(m => (
            <div
              key={m.id}
              className="text-xs p-2.5 rounded-lg"
              style={{
                background: m.direction === "outbound" ? "var(--surface-alt)" : "var(--surface)",
                border: "1px solid var(--border)",
                marginLeft: m.direction === "outbound" ? 24 : 0,
                marginRight: m.direction === "outbound" ? 0 : 24,
              }}
            >
              <div style={{ color: "var(--text)" }}>{m.body}</div>
              <div className="text-[10px] mt-1" style={{ color: "var(--text-dim)" }}>
                {new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </div>
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
        <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
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
                  style={{ color: "var(--text)", background: "none", border: "none", cursor: "pointer" }}
                  onClick={() => { setEditingTitleId(cl.id); setEditingTitleText(cl.title); }}
                  title="Renomear checklist"
                >
                  {cl.title}
                </button>
              )}
              {editingTitleId !== cl.id && (
                <button
                  onClick={() => { setEditingTitleId(cl.id); setEditingTitleText(cl.title); }}
                  className="p-1 rounded transition-colors shrink-0"
                  style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
                  title="Renomear checklist"
                  aria-label="Renomear checklist"
                >
                  <Pencil size={11} />
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
                onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; }}
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
                    style={{ width: `${progress}%`, background: progress === 100 ? "var(--success)" : companyColor }}
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
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; }}
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

function CaptureRow({ label, value, mono, link, badge, hint }) {
  const dim = value === null || value === undefined || value === "";
  const priorityColor = badge && value === "Alta" ? "var(--danger)"
    : badge && value === "Média" ? "var(--amber)"
    : badge && value === "Baixa" ? "var(--success)"
    : null;
  return (
    <div>
      <dt className="text-[11px] font-semibold" style={{ color: "var(--text-dim)" }}>{label}</dt>
      <dd className={`text-sm ${mono ? "font-mono" : ""}`} style={{ color: dim ? "var(--text-dim)" : "var(--text)", fontStyle: dim ? "italic" : "normal", marginTop: 2 }}>
        {dim ? "—" : link ? (
          <a href={link} style={{ color: "var(--accent)", textDecoration: "none" }}>{value}</a>
        ) : badge ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: `color-mix(in srgb, ${priorityColor || "var(--text-dim)"} 8%, transparent)`, color: priorityColor || "var(--text-dim)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: priorityColor || "var(--text-dim)" }} />
            {value}
          </span>
        ) : value}
      </dd>
      {hint && <div className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>{hint}</div>}
    </div>
  );
}

// "Já está negociando com esse cliente?" — mesmo padrão dt/dd de CaptureRow,
// mas editável (campo comum do Formulário Inicial, não um bloco novo/
// chamativo — spec aprovada com o Daniel). Mesmo <input type="date"> já
// usado no drawer (follow-up).
function OriginCampaignRow({ value, campaigns, lead, onChange }) {
  // Só campanhas de origem rastreável (feira ou conteúdo). Sem esse filtro
  // dava pra escolher "Newsletter de Julho" como origem: o negócio saía do
  // aviso de "sem feira indicada" e ao mesmo tempo não entrava em feira
  // nenhuma no relatório — sumia dos dois lados, calado. Conteúdo entra no
  // mesmo circuito (PRD rastreio Fase 1/3).
  const ORIGIN_CHANNELS = new Set(["Evento", "Conteúdo", "Digital"]);
  const list = (campaigns || []).filter(c =>
    ORIGIN_CHANNELS.has(c.channel)
    && (!lead?.companyId || !c.companyIds?.length || c.companyIds.includes(lead.companyId))
  );
  return (
    <div>
      <dt className="text-[11px] font-semibold" style={{ color: "var(--text-dim)" }}>
        Veio de qual campanha?
      </dt>
      <dd className="text-sm" style={{ marginTop: 2 }}>
        <select
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          className="text-sm rounded-lg border px-2.5 py-1.5 outline-none w-full"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        >
          <option value="">Não informado</option>
          {list.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.channel ? ` · ${c.channel}` : ""}
            </option>
          ))}
        </select>
      </dd>
      <div className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>
        Liga custo e resultado no relatório (feira ou conteúdo). Sem campanha, cai em &quot;origem não registrada&quot;.
      </div>
    </div>
  );
}

function NegotiationStartRow({ value, onChange }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold" style={{ color: "var(--text-dim)" }}>
        Já está negociando com esse cliente?
      </dt>
      <dd className="text-sm" style={{ marginTop: 2 }}>
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          /* Campo retroativo por definição — data futura quebra
             "novo em 48h" (DashboardView), "Tempo no funil" (negativo) e
             a ordenação por mais recente. */
          max={toLocalISODate(new Date())}
          className="text-sm rounded-lg border px-2.5 py-1.5 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        />
      </dd>
      <div className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>
        Deixe em branco pra usar a data de hoje (padrão atual).
      </div>
    </div>
  );
}
