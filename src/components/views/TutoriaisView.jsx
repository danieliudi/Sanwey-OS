import React, { useMemo, useState } from "react";
import { Play, ChevronDown, ChevronUp, BookOpen, LifeBuoy, Zap, Bot, Copy, Check, ChevronRight, ArrowRight, Search } from "lucide-react";
import { VIDEO_TUTORIALS, FAQ_ITEMS, AUTOMATION_GUIDE, AI_PROMPTS } from "../../data/tutorials";
import { ROUTES } from "../../constants/routes";
import { Tabs } from "../shared/Tabs";
import { Card, CardGrid } from "../shared/Card";
import { Badge } from "../ui/Badge";
import { StatCard } from "../ui/StatCard";
import { EmptyState } from "../ui/EmptyState";

const ROLE_LABEL = {
  admin: "Administrador", gerente: "Gerente", vendedor: "Vendedor", consultor: "Consultor",
  marketing: "Marketing", gerente_marketing: "Gerente de Marketing",
  agencia: "Agência", rh: "RH", gerente_rh: "Gerente de RH",
  comex: "Comex", diretoria: "Diretoria", portal: "Colaborador",
};

const TABS = [
  { id: "tutoriais", label: "Tutoriais", icon: BookOpen },
  { id: "automacoes", label: "Automações", icon: Zap },
  { id: "ia", label: "Perguntar à IA", icon: Bot },
  { id: "faq", label: "FAQ", icon: LifeBuoy },
];

// ── Video card ────────────────────────────────────────────────────────────────

function VideoCard({ video, onNavigate }) {
  const hasUrl = Boolean(video.url);

  // Card (Padrão C) tem um slot de ícone 38×38, não um slot de mídia
  // bleed-to-edge — hoje 100% dos tutoriais são guias rápidos (quickStart),
  // não vídeos reais (nenhum `url` preenchido em src/data/tutorials.js), e
  // esse formato cabe bem no ícone+corpo do Card. O branch com thumbnail/
  // iframe abaixo é mantido funcionalmente idêntico, mas a miniatura vira
  // `children` (encaixada dentro do padding do card, cantos próprios) em vez
  // de ocupar a borda do card como no design anterior — ver observação no
  // relatório da migração sobre esse trade-off.
  if (!hasUrl && video.quickStart) {
    return (
      <Card
        icon={<span style={{ fontSize: 18 }}>{video.quickStart.icon}</span>}
        title={video.title}
        footer={video.description && video.routeId && ROUTES[video.routeId] && onNavigate ? (
          <button
            onClick={() => onNavigate(video.routeId)}
            className="inline-flex items-center gap-1 font-semibold"
            style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Ir para {video.description} <ArrowRight size={11} />
          </button>
        ) : null}
      >
        <div className="space-y-1.5">
          {video.quickStart.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text)" }}>
              <span
                className="shrink-0 flex items-center justify-center rounded-full font-bold"
                style={{ width: 18, height: 18, minWidth: 18, background: "color-mix(in srgb, var(--accent) 7%, transparent)", color: "var(--accent)", fontSize: 10 }}
              >
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={video.title}
      meta={video.duration || null}
      badges={!hasUrl ? <Badge variant="neutral">Em breve</Badge> : null}
      footer={hasUrl ? (
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold"
          style={{ fontSize: 12, color: "var(--color-industria)" }}
        >
          <Play size={12} /> Assistir
        </a>
      ) : null}
    >
      <div
        className="relative flex items-center justify-center rounded-lg overflow-hidden"
        style={{ height: 148, background: hasUrl ? "#1a1a1a" : "#F0EDEA" }}
      >
        {hasUrl ? (
          <iframe
            src={video.url}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            style={{ border: "none" }}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 48, height: 48, background: "#E5E7EB" }}
          >
            <Play size={20} style={{ color: "var(--text-dim)", marginLeft: 2 }} />
          </div>
        )}
      </div>
      <div className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
        {video.description}
      </div>
    </Card>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <button
        className="w-full flex items-center justify-between gap-3 py-4 text-left"
        onClick={() => setOpen(o => !o)}
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{item.question}</span>
        {open
          ? <ChevronUp size={15} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
          : <ChevronDown size={15} style={{ color: "var(--text-dim)", flexShrink: 0 }} />}
      </button>
      {open && (
        <div className="pb-4 text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
          {item.answer}
        </div>
      )}
    </div>
  );
}

// ── Automation recipe card ────────────────────────────────────────────────────

function RecipeCard({ recipe }) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 20 }}>{recipe.emoji}</span>
          <span className="font-semibold text-sm leading-snug" style={{ color: "var(--text)" }}>
            {recipe.title}
          </span>
        </div>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: recipe.difficultyColor + "18", color: recipe.difficultyColor }}
        >
          {recipe.difficulty}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2 items-start">
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
            style={{ background: "#FEF3C7", color: "#B45309" }}
          >
            Gatilho
          </span>
          <span className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>{recipe.trigger}</span>
        </div>
        {recipe.condition && (
          <div className="flex gap-2 items-start">
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
              style={{ background: "#EEF2FF", color: "#6366F1" }}
            >
              Condição
            </span>
            <span className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>{recipe.condition}</span>
          </div>
        )}
        <div className="flex gap-2 items-start">
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
            style={{ background: "#ECFDF5", color: "#059669" }}
          >
            Ação
          </span>
          <span className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>{recipe.action}</span>
        </div>
      </div>
    </div>
  );
}

// ── AI prompt card ────────────────────────────────────────────────────────────

function PromptCard({ prompt }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="group flex items-start justify-between gap-3 rounded-lg border px-3.5 py-3 transition-colors duration-100 cursor-pointer"
      style={{ background: "var(--surface-alt)", borderColor: "var(--border)" }}
      onClick={handleCopy}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <span className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{prompt}</span>
      <span className="shrink-0 mt-0.5">
        {copied
          ? <Check size={14} style={{ color: "var(--success)" }} />
          : <Copy size={14} style={{ color: "var(--text-dim)" }} />}
      </span>
    </div>
  );
}

function PromptCategorySection({ category }) {
  const [open, setOpen] = useState(true);
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <button
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
        onClick={() => setOpen(o => !o)}
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg text-base"
            style={{ width: 32, height: 32, background: category.bgColor }}
          >
            {category.icon}
          </div>
          <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
            {category.category}
          </span>
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{ background: category.bgColor, color: category.color }}
          >
            {category.prompts.length}
          </span>
        </div>
        <ChevronDown
          size={15}
          style={{ color: "var(--text-dim)", flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2 border-t" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs pt-3 mb-3" style={{ color: "var(--text-dim)" }}>
            Clique em qualquer pergunta para copiar e colar no assistente de IA.
          </p>
          {category.prompts.map((p, i) => (
            <PromptCard key={i} prompt={p} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function TutoriaisView({ currentUser, onNavigate }) {
  // Mesmo padrão de outras telas multi-cargo (AgentActionsView.jsx,
  // CRMViagensView.jsx, RHFornecedoresView.jsx): `roles` é a fonte real desde
  // a fundação de múltiplos cargos por usuário, `role` fica só de fallback.
  const userRoleList = currentUser?.roles?.length ? currentUser.roles : (currentUser?.role ? [currentUser.role] : []);
  // Une os guias de TODOS os cargos do usuário, deduplicando por id — antes
  // só o primeiro cargo era considerado. Sem fallback pra "vendedor": um
  // papel sem bucket próprio (ex.: diretoria, portal) fica com a lista vazia
  // de propósito — melhor mostrar "nenhum guia ainda" do que instrução pra
  // uma tela que esse papel nem acessa (era o caso antes, ex. comex recebendo
  // conteúdo de vendedor).
  const videos = useMemo(() => {
    const seen = new Set();
    const merged = [];
    for (const r of userRoleList) {
      for (const v of (VIDEO_TUTORIALS[r] || [])) {
        if (seen.has(v.id)) continue;
        seen.add(v.id);
        merged.push(v);
      }
    }
    return merged;
  }, [userRoleList]);
  const roleLabel = userRoleList.length
    ? userRoleList.map((r) => ROLE_LABEL[r] || r).join(" + ")
    : "seu perfil";
  const [activeTab, setActiveTab] = useState("tutoriais");
  const [faqSearch, setFaqSearch] = useState("");

  const filteredFaq = useMemo(() => {
    if (!faqSearch.trim()) return FAQ_ITEMS;
    const q = faqSearch.toLowerCase();
    return FAQ_ITEMS.filter(f =>
      f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    );
  }, [faqSearch]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={18} style={{ color: "var(--color-industria)" }} />
          <h1 className="font-bold" style={{ fontSize: 22, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Ajuda & Tutoriais
          </h1>
        </div>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          Conteúdo para <strong style={{ color: "var(--text)" }}>{roleLabel}</strong> — aprenda a usar o CRM e a IA no seu dia a dia.
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} iconOnlyMobile />

      {/* Tab: Tutoriais */}
      {activeTab === "tutoriais" && (
        <div className="space-y-6">
          <div
            className="rounded-xl border p-5"
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
          >
            <h2 className="font-semibold mb-3 flex items-center gap-2" style={{ fontSize: 15, color: "var(--text)" }}>
              <Search size={15} style={{ color: "var(--text-dim)" }} />
              Atalhos de teclado
            </h2>
            <div className="flex items-center gap-3">
              <span
                className="select-none rounded-sm flex items-center justify-center"
                style={{ padding: "2px 8px", background: "var(--surface-alt)", color: "var(--text-dim)", border: "1px solid var(--border-strong)", fontSize: 12, fontWeight: 600 }}
              >
                ⌘K / Ctrl K
              </span>
              <span className="text-sm" style={{ color: "var(--text-dim)" }}>
                Abre a busca global (leads, campanhas, funcionários) de qualquer tela.
              </span>
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-4" style={{ fontSize: 15, color: "var(--text)" }}>
              Vídeos tutoriais
            </h2>
            <div className="grid grid-cols-1 gap-3 mb-4" style={{ maxWidth: 280 }}>
              <StatCard icon={BookOpen} value={videos.length} label="Guias disponíveis para seu perfil" />
            </div>
            {videos.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Nenhum guia disponível ainda"
                description="Ainda não há tutoriais cadastrados para o seu perfil."
              />
            ) : (
              <CardGrid>
                {videos.map(v => <VideoCard key={v.id} video={v} onNavigate={onNavigate} />)}
              </CardGrid>
            )}
            <p className="text-xs mt-3" style={{ color: "var(--text-dim)" }}>
              Os vídeos serão publicados em breve. Quando disponíveis, aparecerão automaticamente nesta tela.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Automações */}
      {activeTab === "automacoes" && (
        <div className="space-y-6">
          {/* Intro */}
          <div
            className="rounded-xl border p-5"
            style={{ background: "#FFFBF0", borderColor: "#FDE68A" }}
          >
            <div className="flex items-start gap-3">
              <Zap size={18} style={{ color: "#B45309", flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "#92400E" }}>O que são automações?</p>
                <p className="text-sm leading-relaxed" style={{ color: "#78350F" }}>
                  {AUTOMATION_GUIDE.intro}
                </p>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div
            className="rounded-xl border p-5"
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
          >
            <h2 className="font-semibold mb-5" style={{ fontSize: 15, color: "var(--text)" }}>
              Como criar uma automação — passo a passo
            </h2>
            <div className="space-y-0">
              {AUTOMATION_GUIDE.steps.map((step, i) => (
                <div key={step.number} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className="flex items-center justify-center rounded-full font-bold text-sm shrink-0"
                      style={{ width: 32, height: 32, background: "var(--accent)", color: "#FFFFFF", fontSize: 13 }}
                    >
                      {step.number}
                    </div>
                    {i < AUTOMATION_GUIDE.steps.length - 1 && (
                      <div className="w-px flex-1 my-1" style={{ background: "var(--border)", minHeight: 24 }} />
                    )}
                  </div>
                  <div className="pb-5">
                    <p className="font-semibold text-sm mb-0.5" style={{ color: "var(--text)" }}>
                      {step.title}
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recipes */}
          <div>
            <h2 className="font-semibold mb-1" style={{ fontSize: 15, color: "var(--text)" }}>
              Receitas prontas
            </h2>
            <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
              Exemplos de automações que você pode replicar diretamente no seu pipeline.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {AUTOMATION_GUIDE.recipes.map(r => (
                <RecipeCard key={r.id} recipe={r} />
              ))}
            </div>
          </div>

          {/* CTA */}
          <div
            className="rounded-xl border p-5 flex items-center justify-between gap-4"
            style={{ background: "var(--surface-alt)", borderColor: "var(--border)" }}
          >
            <div>
              <p className="font-semibold text-sm mb-0.5" style={{ color: "var(--text)" }}>
                Pronto para criar sua primeira automação?
              </p>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                Acesse o menu Automações para começar. Disponível para Gerentes, Admins e Gerentes de RH (no módulo de RH).
              </p>
            </div>
            <ChevronRight size={18} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
          </div>
        </div>
      )}

      {/* Tab: Perguntar à IA */}
      {activeTab === "ia" && (
        <div className="space-y-5">
          <div
            className="rounded-xl border p-5"
            style={{ background: "var(--surface-alt)", borderColor: "var(--border)" }}
          >
            <div className="flex items-start gap-3">
              <Bot size={18} style={{ color: "var(--color-industria)", flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>
                  Como usar o assistente de IA
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
                  Na tela do Funil de Vendas, clique em <strong style={{ color: "var(--text)" }}>"Perguntar à IA"</strong> para abrir o chat.
                  O assistente lê seu pipeline em tempo real e responde em linguagem natural.
                  Copie qualquer pergunta abaixo e cole no chat para começar.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {AI_PROMPTS.map((cat, i) => (
              <PromptCategorySection key={i} category={cat} />
            ))}
          </div>
        </div>
      )}

      {/* Tab: FAQ */}
      {activeTab === "faq" && (
        <div
          className="rounded-xl border"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
        >
          <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-0.5">
              <LifeBuoy size={15} style={{ color: "var(--color-industria)" }} />
              <h2 className="font-semibold" style={{ fontSize: 15, color: "var(--text)" }}>
                Perguntas frequentes
              </h2>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>
              Dúvidas comuns sobre uso da plataforma.
            </p>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-dim)" }} />
              <input
                type="text"
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                placeholder="Buscar pergunta..."
                className="w-full text-xs rounded-lg border pl-8 pr-3 py-2 outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface-alt)" }}
                onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
              />
            </div>
          </div>
          <div className="px-5">
            {filteredFaq.length > 0
              ? filteredFaq.map((item, i) => <FAQItem key={i} item={item} />)
              : <p className="py-6 text-xs text-center" style={{ color: "var(--text-dim)" }}>Nenhuma pergunta encontrada para "{faqSearch}".</p>
            }
          </div>
        </div>
      )}
    </div>
  );
}

export default TutoriaisView;
