import React, { useEffect, useMemo, useState } from "react";
import {
  X, MapPin, AlertTriangle, Network, Package, Users, Sparkles, Copy, Send,
  Calendar, ExternalLink, Linkedin, Newspaper, MessageSquareWarning, Search,
  Building2, RefreshCw,
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
import { isSupabaseConfigured } from "../../lib/supabase";

const STAGE_OPTIONS = DEFAULT_PIPELINE_STAGES.map(s => ({ value: s.id, label: s.name }));

// FIX B1 — Rules of Hooks: hooks run unconditionally on every render.
// The early-return guard is rendered AFTER all hook calls so React's
// hook ordering is stable when `lead` toggles between object and null.
export function LeadDetailDrawer({ lead, onClose, onUpdate, allLeads, users, isManager, currentUser }) {
  const [stage, setStage] = useState(lead?.stage ?? null);
  const [classification, setClassification] = useState(lead?.clientClassification ?? "");
  const [orderCount, setOrderCount] = useState(lead?.orderCount ?? 0);
  const { loading: enriching, error: enrichError, data: enrichData, lookup, reset: resetEnrich } = useCnpjLookup();

  useEffect(() => { resetEnrich(); }, [lead?.id, resetEnrich]);

  useEffect(() => {
    if (lead) {
      setStage(lead.stage);
      setClassification(lead.clientClassification ?? "");
      setOrderCount(lead.orderCount ?? 0);
    }
  }, [lead?.id, lead?.stage, lead?.clientClassification, lead?.orderCount]);

  const overlaps = useMemo(() => {
    if (!isManager || !lead) return [];
    const key = lead.company.replace(/\s*\(.*\)\s*/g, "").trim().toLowerCase();
    return allLeads.filter(l => (
      l.id !== lead.id &&
      l.company.replace(/\s*\(.*\)\s*/g, "").trim().toLowerCase() === key &&
      l.companyId !== lead.companyId
    ));
  }, [lead, allLeads, isManager]);

  const sellerOptions = useMemo(() => {
    if (!lead) return [];
    return users
      .filter(u => u.role === "vendedor" && u.companies.includes(lead.companyId))
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

  const emailDraft = useMemo(() => {
    if (!lead || !company) return "";
    const senderName = currentUser?.name || "[Seu nome]";
    const senderEmail = currentUser?.email ? `\n${currentUser.email}` : "";
    return `Olá ${firstName},

Identifiquei que a ${lead.company} teve ${(lead.evidence || "").toLowerCase()}.

Sou da ${company.name} e gostaria de entender melhor como podemos apoiar nesse momento.

Podemos agendar 20 minutos esta semana?

Abraço,
${senderName}${senderEmail}
${company.name}`;
  }, [lead, company, firstName, currentUser]);

  if (!lead || !company) return null;

  const handleCopyDraft = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(emailDraft);
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

  const handleScheduleFollowUp = () => {
    const current = lead.nextFollowUp ? lead.nextFollowUp.slice(0, 10) : "";
    const answer = window.prompt("Data do follow-up (AAAA-MM-DD):", current);
    if (!answer) return;
    const d = new Date(answer);
    if (Number.isNaN(d.getTime())) {
      window.alert("Data inválida. Use o formato AAAA-MM-DD.");
      return;
    }
    onUpdate(lead.id, { nextFollowUp: d.toISOString() });
  };

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

  return (
    <div
      className="fixed inset-0 z-40 flex"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex-1" onClick={onClose} />
      <div
        className="w-full max-w-2xl h-full overflow-y-auto shadow-2xl"
        style={{ background: NEUTRAL.warmWhite }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="sticky top-0 z-10 px-6 py-4 border-b flex items-center justify-between backdrop-blur"
          style={{ background: "rgba(250,250,248,0.95)", borderColor: "#EFEFEF" }}
        >
          <div className="flex items-center gap-2">
            <CompanyTag companyId={lead.companyId} />
            <UrgencyTag urgency={lead.urgency} />
          </div>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-gray-100" aria-label="Fechar">
            <X size={20} color={NEUTRAL.slate} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="font-bold mb-1" style={{ fontSize: 22, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
                {lead.company}
              </h2>
              <div className="flex items-center gap-2 text-sm flex-wrap" style={{ color: NEUTRAL.slate }}>
                <span className="font-mono text-xs">{lead.cnpj}</span>
                <span>·</span>
                <span>{lead.sector}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><MapPin size={12} />{lead.city}</span>
              </div>
            </div>
            <FitScoreCircle score={lead.fitScore} size={64} />
          </div>

          {isSupabaseConfigured && (
            <div
              className="p-3 rounded-sm border flex items-start justify-between gap-3 flex-wrap"
              style={{ background: "#FFFFFF", borderColor: "#EFEFEF" }}
            >
              <div className="flex-1 min-w-0">
                <div
                  className="text-[10px] uppercase font-bold tracking-widest mb-1 flex items-center gap-1"
                  style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
                >
                  <Building2 size={11} />
                  Enriquecimento Receita Federal
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
                    {enrichData.cached && (
                      <div className="text-[10px] mt-0.5" style={{ color: NEUTRAL.slate }}>cache</div>
                    )}
                  </div>
                ) : enrichError ? (
                  <div className="text-xs" style={{ color: "#B91C1C" }}>
                    {enrichError.message || String(enrichError)}
                  </div>
                ) : (
                  <div className="text-xs" style={{ color: NEUTRAL.slate }}>
                    Busca dados oficiais (CNAE, porte, capital social, contatos) na Receita Federal e atualiza o lead.
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={enriching ? RefreshCw : Building2}
                onClick={handleEnrich}
                disabled={enriching || !lead.cnpj}
              >
                {enriching ? "Buscando…" : enrichData ? "Re-buscar" : "Enriquecer"}
              </Button>
            </div>
          )}

          {isManager && overlaps.length > 0 && (
            <div
              className="p-4 rounded-sm border-l-4"
              style={{ background: NEUTRAL.amber + "15", borderLeftColor: NEUTRAL.amber }}
            >
              <div
                className="text-xs uppercase font-bold tracking-widest mb-2"
                style={{ color: NEUTRAL.amber, letterSpacing: "0.15em" }}
              >
                <Network size={11} className="inline mr-1" />
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
                    className="text-xs p-2 rounded-sm mb-1 flex items-center justify-between"
                    style={{ background: "#FFFFFF" }}
                  >
                    <div className="flex items-center gap-2">
                      <CompanyTag companyId={o.companyId} />
                      <span style={{ color: NEUTRAL.graphite }}>{u?.name || "—"}</span>
                    </div>
                    <span className="font-mono" style={{ color: NEUTRAL.graphite }}>
                      {formatK(o.value)} · {o.stage}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div
            className="p-4 rounded-sm border-l-4"
            style={{ background: company.light, borderLeftColor: company.primary }}
          >
            <div
              className="text-xs uppercase font-bold tracking-widest mb-1"
              style={{ color: company.dark, letterSpacing: "0.15em" }}
            >
              <AlertTriangle size={11} className="inline mr-1" />
              Gatilho · {lead.triggerLabel}
            </div>
            <div className="text-sm" style={{ color: NEUTRAL.graphite }}>{lead.evidence}</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoTile label="Porte" value={lead.size} />
            <InfoTile label="Quantidade" value={`${lead.quantity} un`} />
            <InfoTile label="Probabilidade" value={`${Math.round(lead.probability * 100)}%`} />
            <InfoTile label="Fechamento" value={formatDateBR(lead.closeDate)} />
          </div>

          <div className="p-4 rounded-sm border" style={{ background: "#FFFFFF", borderColor: "#EFEFEF" }}>
            <div
              className="text-[10px] uppercase font-bold tracking-widest mb-3"
              style={{ color: company.primary, letterSpacing: "0.15em" }}
            >
              <Package size={11} className="inline mr-1" />Produto vinculado
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold" style={{ color: NEUTRAL.graphite }}>{lead.skuName}</div>
                <div className="text-xs" style={{ color: NEUTRAL.slate }}>
                  {lead.quantity} un × {formatBRL(lead.unitPrice)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg" style={{ color: NEUTRAL.graphite }}>
                  {formatK(lead.value, 1)}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-sm border" style={{ background: "#FFFFFF", borderColor: "#EFEFEF" }}>
            <div
              className="text-[10px] uppercase font-bold tracking-widest mb-3"
              style={{ color: company.primary, letterSpacing: "0.15em" }}
            >
              <Users size={11} className="inline mr-1" />Decisor
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                style={{ background: company.primary }}
              >
                {decisionMakerInitials}
              </div>
              <div>
                <div className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>
                  {decisionMakerName}
                </div>
                <div className="text-xs" style={{ color: NEUTRAL.slate }}>{decisionMakerRole}</div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label
                className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
                style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
              >
                Etapa do funil
              </label>
              <Select value={stage || ""} onChange={handleStageChange} options={STAGE_OPTIONS} />
            </div>
            <div>
              <label
                className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
                style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
              >
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

          {/* ── Classificação ABCD ──────────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label
                className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
                style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
              >
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
                  <ClassificationBadge
                    classification={classification}
                    orderCount={orderCount}
                    size="md"
                  />
                )}
              </div>
            </div>
            {classification === "A" && (
              <div>
                <label
                  className="text-[10px] uppercase font-bold tracking-widest mb-1.5 block"
                  style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
                >
                  Qtd. pedidos (A-#)
                </label>
                <input
                  type="number"
                  min="0"
                  value={orderCount}
                  onChange={handleOrderCountChange}
                  className="w-full text-sm rounded-sm border px-3 py-2 outline-none focus:ring-1"
                  style={{
                    borderColor: "#DCDCDC",
                    color: NEUTRAL.graphite,
                    background: "#FFFFFF",
                  }}
                />
              </div>
            )}
          </div>

          <div className="p-5 rounded-sm" style={{ background: company.dark, color: "#FFFFFF" }}>
            <div className="flex items-center justify-between mb-3">
              <div
                className="text-[10px] uppercase font-bold tracking-widest flex items-center gap-1"
                style={{ color: "#FFE9A8", letterSpacing: "0.15em" }}
              >
                <Sparkles size={11} />Rascunho de abordagem
              </div>
              <button
                onClick={handleCopyDraft}
                className="text-xs flex items-center gap-1 text-white/80 hover:text-white"
              >
                <Copy size={11} />Copiar
              </button>
            </div>
            <div
              className="text-sm leading-relaxed whitespace-pre-line text-white/95 p-3 rounded-sm"
              style={{ background: "rgba(0,0,0,0.2)" }}
            >
              {emailDraft}
            </div>
          </div>

          {lead.nextFollowUp && (
            <div
              className="text-xs px-3 py-2 rounded-sm border flex items-center gap-2"
              style={{ borderColor: "#EFEFEF", background: "#FFFFFF", color: NEUTRAL.slate }}
            >
              <Calendar size={12} />
              Follow-up agendado para <strong style={{ color: NEUTRAL.graphite }}>{formatDateBR(lead.nextFollowUp)}</strong>
            </div>
          )}

          <div className="pt-3 border-t space-y-3" style={{ borderColor: "#EFEFEF" }}>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="primary" icon={Send} accent={company.primary} onClick={handleStartOutreach}>
                Iniciar abordagem
              </Button>
              <Button variant="secondary" icon={Calendar} onClick={handleScheduleFollowUp}>
                Agendar follow-up
              </Button>
            </div>
            <div>
              <div
                className="text-[10px] uppercase font-bold tracking-widest mb-2"
                style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
              >
                Pesquisar a empresa em
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-semibold transition-all hover:shadow-sm"
                      style={{ borderColor: "#EFEFEF", background: "#FFFFFF", color: NEUTRAL.graphite }}
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

function InfoTile({ label, value }) {
  return (
    <div className="p-3 rounded-sm" style={{ background: "#F5F5F3" }}>
      <div
        className="text-[10px] uppercase font-bold tracking-widest mb-1"
        style={{ color: NEUTRAL.slate, letterSpacing: "0.1em" }}
      >
        {label}
      </div>
      <div className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>{value}</div>
    </div>
  );
}

export default LeadDetailDrawer;
