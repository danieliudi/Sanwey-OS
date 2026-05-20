import React, { useEffect, useMemo, useState } from "react";
import {
  X, MapPin, AlertTriangle, Network, Package, Users, Sparkles, Copy, Send,
  Calendar, ExternalLink, Linkedin, Newspaper, MessageSquareWarning, Search,
  Building2, RefreshCw, Check,
} from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { CompanyTag } from "../ui/CompanyTag";
import { UrgencyTag } from "../ui/UrgencyTag";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { ClassificationBadge, CLASSIFICATION_OPTIONS } from "../ui/ClassificationBadge";
import { formatK, formatBRL } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";
import { useCnpjLookup } from "../../hooks/use-cnpj-lookup";
import { useStageFields } from "../../hooks/use-stage-fields";
import { isSupabaseConfigured } from "../../lib/supabase";

const STAGE_OPTIONS = DEFAULT_PIPELINE_STAGES.map(s => ({ value: s.id, label: s.name }));

export function LeadDetailDrawer({ lead, onClose, onUpdate, allLeads, users, isManager, currentUser }) {
  const [stage, setStage] = useState(lead?.stage ?? null);
  const [classification, setClassification] = useState(lead?.clientClassification ?? "");
  const [orderCount, setOrderCount] = useState(lead?.orderCount ?? 0);
  const [followUpDate, setFollowUpDate] = useState("");
  const [showFollowUpInput, setShowFollowUpInput] = useState(false);
  const [copied, setCopied] = useState(false);

  const { loading: enriching, error: enrichError, data: enrichData, lookup, reset: resetEnrich } = useCnpjLookup();
  const stageFields = useStageFields();
  const customDefs = lead ? stageFields.getFields(lead.companyId, lead.stage) : [];
  const customValues = lead?.customFields || {};

  useEffect(() => { resetEnrich(); }, [lead?.id, resetEnrich]);

  useEffect(() => {
    if (lead) {
      setStage(lead.stage);
      setClassification(lead.clientClassification ?? "");
      setOrderCount(lead.orderCount ?? 0);
      setFollowUpDate(lead.nextFollowUp ? lead.nextFollowUp.slice(0, 10) : "");
      setShowFollowUpInput(false);
    }
  }, [lead?.id, lead?.stage, lead?.clientClassification, lead?.orderCount]);

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
      .filter(u => u.role === "vendedor" && Array.isArray(u.companies) && u.companies.includes(lead.companyId))
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

  const handleClassificationChange = (e) => {
    const newClass = e.target.value || null;
    setClassification(newClass ?? "");
    onUpdate(lead.id, { clientClassification: newClass, orderCount: newClass === "A" ? orderCount : 0 });
  };

  const handleOrderCountChange = (e) => {
    const count = parseInt(e.target.value, 10) || 0;
    setOrderCount(count);
    onUpdate(lead.id, { orderCount: count });
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
    setShowFollowUpInput(false);
  };

  const handleCancelFollowUp = () => {
    setFollowUpDate(lead.nextFollowUp ? lead.nextFollowUp.slice(0, 10) : "");
    setShowFollowUpInput(false);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex-1" onClick={onClose} />
      <div
        className="w-full max-w-xl h-full overflow-y-auto"
        style={{
          background: "#FAFAF8",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer header */}
        <div
          className="sticky top-0 z-10 px-5 py-3.5 border-b flex items-center justify-between"
          style={{ background: "rgba(250,250,248,0.97)", borderColor: "#E8E8E8", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-2">
            <CompanyTag companyId={lead.companyId} />
            <UrgencyTag urgency={lead.urgency} />
          </div>
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

        <div className="p-5 space-y-4">
          {/* Lead title */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="font-bold mb-1" style={{ fontSize: 20, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
                {lead.company}
              </h2>
              <div className="flex items-center gap-2 text-sm flex-wrap" style={{ color: NEUTRAL.slate }}>
                {lead.cnpj && <span className="font-mono text-xs">{lead.cnpj}</span>}
                {lead.cnpj && (lead.sector || lead.city) && <span>·</span>}
                {lead.sector && <span>{lead.sector}</span>}
                {lead.sector && lead.city && <span>·</span>}
                {lead.city && <span className="flex items-center gap-1"><MapPin size={12} />{lead.city}</span>}
                {!lead.cnpj && !lead.sector && !lead.city && <span className="text-xs italic">Sem dados de cadastro</span>}
              </div>
            </div>
            <FitScoreCircle score={lead.fitScore} size={60} />
          </div>

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
              style={{ background: "#FFFFFF", borderColor: "#E8E8E8" }}
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

          {/* Campos customizados da etapa */}
          {customDefs.length > 0 && (
            <div className="p-4 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E8E8E8" }}>
              <div className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: company.primary }}>
                Detalhes da etapa
              </div>
              <div className="grid grid-cols-2 gap-3">
                {customDefs.map(f => {
                  const v = customValues[f.fieldKey];
                  const display = v === undefined || v === null || v === ""
                    ? "—"
                    : f.fieldType === "checkbox" ? (v ? "Sim" : "Não")
                    : f.fieldType === "currency" && Number.isFinite(Number(v)) ? formatBRL(Number(v))
                    : f.fieldType === "date" ? formatDateBR(v)
                    : f.fieldType === "user" ? (users.find(u => u.id === v)?.name || v)
                    : String(v);
                  return (
                    <div key={f.id}>
                      <div className="text-[11px] font-semibold mb-0.5" style={{ color: NEUTRAL.slate }}>{f.label}</div>
                      <div className="text-sm" style={{ color: NEUTRAL.graphite, wordBreak: "break-word" }}>{display}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Produto — só mostra se tiver SKU */}
          {(lead.skuName || lead.quantity > 0) && (
            <div className="p-4 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E8E8E8" }}>
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
          <div className="p-4 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E8E8E8" }}>
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

          {/* Classificação ABCD */}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: NEUTRAL.slate }}>
                Classificação de cliente
              </label>
              <div className="flex items-center gap-2">
                <Select
                  value={classification}
                  onChange={handleClassificationChange}
                  options={CLASSIFICATION_OPTIONS}
                  placeholder="Sem classificação"
                />
                {classification && (
                  <ClassificationBadge classification={classification} orderCount={orderCount} size="md" />
                )}
              </div>
            </div>
            {classification === "A" && (
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: NEUTRAL.slate }}>
                  Qtd. pedidos (A-#)
                </label>
                <input
                  type="number"
                  min="0"
                  value={orderCount}
                  onChange={handleOrderCountChange}
                  className="w-full text-sm rounded-lg border px-3 py-2 outline-none transition-colors"
                  style={{ borderColor: "#D4D4D4", color: NEUTRAL.graphite, background: "#FFFFFF" }}
                  onFocus={e => { e.currentTarget.style.borderColor = NEUTRAL.graphite + "70"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#D4D4D4"; }}
                />
              </div>
            )}
          </div>

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
          <div className="p-4 rounded-xl border" style={{ background: "#FFFFFF", borderColor: "#E8E8E8" }}>
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
                  style={{ borderColor: "#D4D4D4", color: NEUTRAL.graphite, background: "#FAFAF8" }}
                  onFocus={e => { e.currentTarget.style.borderColor = company.primary; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#D4D4D4"; }}
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
                      style={{ borderColor: "#E8E8E8", background: "#FFFFFF", color: NEUTRAL.graphite }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#D0D0D0"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#E8E8E8"; }}
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
      style={{ background: "#FFFFFF", borderColor: "#E8E8E8" }}
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
          const lineColor = done ? companyColor : "#E8E8E8";

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
            background: isWon ? "#16A34A" : isLost ? "#B91C1C" : "#E8E8E8",
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
        border: `1px solid ${color ? color + "22" : "#E8E8E8"}`,
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

export default LeadDetailDrawer;
