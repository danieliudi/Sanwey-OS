import React, { useMemo, useState } from "react";
import { Play, ChevronDown, ChevronUp, BookOpen, LifeBuoy, Zap, Bot, Copy, Check, ChevronRight, ArrowRight, Search } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { VIDEO_TUTORIALS, FAQ_ITEMS, AUTOMATION_GUIDE, AI_PROMPTS } from "../../data/tutorials";

const ROLE_LABEL = {
  admin: "Administrador", gerente: "Gerente", vendedor: "Vendedor", consultor: "Consultor",
  marketing: "Marketing", gerente_marketing: "Gerente de Marketing",
  agencia: "Agência", rh: "RH", gerente_rh: "Gerente de RH",
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

  if (!hasUrl && video.quickStart) {
    return (
      <div
        className="flex flex-col rounded-xl border overflow-hidden"
        style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      >
        <div
          className="px-4 py-3 flex items-center gap-2 border-b"
          style={{ background: "#F7F7F5", borderColor: "#F0F0F0" }}
        >
          <span style={{ fontSize: 18 }}>{video.quickStart.icon}</span>
          <span className="font-bold text-sm leading-snug" style={{ color: NEUTRAL.graphite }}>
            {video.title}
          </span>
        </div>
        <div className="p-4 flex-1 flex flex-col gap-2">
          <div className="space-y-1.5">
            {video.quickStart.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-xs" style={{ color: NEUTRAL.graphite }}>
                <span
                  className="shrink-0 flex items-center justify-center rounded-full font-bold"
                  style={{ width: 18, height: 18, minWidth: 18, background: "#b5000b12", color: "#b5000b", fontSize: 10 }}
                >
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
          {video.description && onNavigate && (
            <button
              onClick={() => onNavigate(video.description.toLowerCase().replace(/\s+/g, "-"))}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: "#b5000b", background: "none", border: "none", cursor: "pointer" }}
            >
              Ir para {video.description} <ArrowRight size={11} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col rounded-xl border overflow-hidden"
      style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div
        className="relative flex items-center justify-center"
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
          <>
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 48, height: 48, background: "#E5E7EB" }}
            >
              <Play size={20} style={{ color: NEUTRAL.slate, marginLeft: 2 }} />
            </div>
            <span
              className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: NEUTRAL.amber + "22", color: NEUTRAL.amber, border: `1px solid ${NEUTRAL.amber}44` }}
            >
              Em breve
            </span>
          </>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="font-semibold text-sm mb-1 leading-snug" style={{ color: NEUTRAL.graphite }}>
          {video.title}
        </div>
        <div className="text-xs leading-relaxed flex-1" style={{ color: NEUTRAL.slate }}>
          {video.description}
        </div>
        {video.duration && (
          <div className="text-xs mt-2 font-medium" style={{ color: NEUTRAL.slate }}>
            {video.duration}
          </div>
        )}
        {hasUrl && (
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: NEUTRAL.red }}
          >
            <Play size={12} /> Assistir
          </a>
        )}
      </div>
    </div>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "#E5E7EB" }}>
      <button
        className="w-full flex items-center justify-between gap-3 py-4 text-left"
        onClick={() => setOpen(o => !o)}
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <span className="text-sm font-semibold" style={{ color: NEUTRAL.graphite }}>{item.question}</span>
        {open
          ? <ChevronUp size={15} style={{ color: NEUTRAL.slate, flexShrink: 0 }} />
          : <ChevronDown size={15} style={{ color: NEUTRAL.slate, flexShrink: 0 }} />}
      </button>
      {open && (
        <div className="pb-4 text-sm leading-relaxed" style={{ color: NEUTRAL.slate }}>
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
      style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 20 }}>{recipe.emoji}</span>
          <span className="font-semibold text-sm leading-snug" style={{ color: NEUTRAL.graphite }}>
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
          <span className="text-xs leading-relaxed" style={{ color: NEUTRAL.slate }}>{recipe.trigger}</span>
        </div>
        {recipe.condition && (
          <div className="flex gap-2 items-start">
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
              style={{ background: "#EEF2FF", color: "#6366F1" }}
            >
              Condição
            </span>
            <span className="text-xs leading-relaxed" style={{ color: NEUTRAL.slate }}>{recipe.condition}</span>
          </div>
        )}
        <div className="flex gap-2 items-start">
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
            style={{ background: "#ECFDF5", color: "#059669" }}
          >
            Ação
          </span>
          <span className="text-xs leading-relaxed" style={{ color: NEUTRAL.slate }}>{recipe.action}</span>
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
      style={{ background: "#FAFAFA", borderColor: "#E5E7EB" }}
      onClick={handleCopy}
      onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.borderColor = "#D1D5DB"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#FAFAFA"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
    >
      <span className="text-sm leading-relaxed" style={{ color: NEUTRAL.graphite }}>{prompt}</span>
      <span className="shrink-0 mt-0.5">
        {copied
          ? <Check size={14} style={{ color: "#16A34A" }} />
          : <Copy size={14} style={{ color: NEUTRAL.slate }} />}
      </span>
    </div>
  );
}

function PromptCategorySection({ category }) {
  const [open, setOpen] = useState(true);
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
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
          <span className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>
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
          style={{ color: NEUTRAL.slate, flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2 border-t" style={{ borderColor: "#F0F0F0" }}>
          <p className="text-xs pt-3 mb-3" style={{ color: NEUTRAL.slate }}>
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
  const role = currentUser?.role || "vendedor";
  const videos = VIDEO_TUTORIALS[role] || VIDEO_TUTORIALS.vendedor;
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
          <BookOpen size={18} style={{ color: NEUTRAL.red }} />
          <h1 className="font-bold" style={{ fontSize: 22, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            Ajuda & Tutoriais
          </h1>
        </div>
        <p className="text-sm" style={{ color: NEUTRAL.slate }}>
          Conteúdo para <strong style={{ color: NEUTRAL.graphite }}>{ROLE_LABEL[role] || role}</strong> — aprenda a usar o CRM e a IA no seu dia a dia.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border" style={{ background: "#F8F9FA", borderColor: "#E5E7EB" }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer"
              style={{
                background: active ? "#FFFFFF" : "transparent",
                color: active ? NEUTRAL.graphite : NEUTRAL.slate,
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
                border: "none",
              }}
            >
              <Icon size={13} style={{ flexShrink: 0 }} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: Tutoriais */}
      {activeTab === "tutoriais" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-semibold mb-4" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
              Vídeos tutoriais
            </h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {videos.map(v => <VideoCard key={v.id} video={v} onNavigate={onNavigate} />)}
            </div>
            <p className="text-xs mt-3" style={{ color: NEUTRAL.slate }}>
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
            style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <h2 className="font-semibold mb-5" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
              Como criar uma automação — passo a passo
            </h2>
            <div className="space-y-0">
              {AUTOMATION_GUIDE.steps.map((step, i) => (
                <div key={step.number} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className="flex items-center justify-center rounded-full font-bold text-sm shrink-0"
                      style={{ width: 32, height: 32, background: "#b5000b", color: "#FFFFFF", fontSize: 13 }}
                    >
                      {step.number}
                    </div>
                    {i < AUTOMATION_GUIDE.steps.length - 1 && (
                      <div className="w-px flex-1 my-1" style={{ background: "#E5E7EB", minHeight: 24 }} />
                    )}
                  </div>
                  <div className="pb-5">
                    <p className="font-semibold text-sm mb-0.5" style={{ color: NEUTRAL.graphite }}>
                      {step.title}
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: NEUTRAL.slate }}>
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recipes */}
          <div>
            <h2 className="font-semibold mb-1" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
              Receitas prontas
            </h2>
            <p className="text-xs mb-4" style={{ color: NEUTRAL.slate }}>
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
            style={{ background: "#fef1f0", borderColor: "#E5E7EB" }}
          >
            <div>
              <p className="font-semibold text-sm mb-0.5" style={{ color: NEUTRAL.graphite }}>
                Pronto para criar sua primeira automação?
              </p>
              <p className="text-xs" style={{ color: NEUTRAL.slate }}>
                Acesse o menu Automações para começar. Disponível para Gerentes e Admins.
              </p>
            </div>
            <ChevronRight size={18} style={{ color: NEUTRAL.slate, flexShrink: 0 }} />
          </div>
        </div>
      )}

      {/* Tab: Perguntar à IA */}
      {activeTab === "ia" && (
        <div className="space-y-5">
          <div
            className="rounded-xl border p-5"
            style={{ background: "#fef1f0", borderColor: "#E5E7EB" }}
          >
            <div className="flex items-start gap-3">
              <Bot size={18} style={{ color: NEUTRAL.red, flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: NEUTRAL.graphite }}>
                  Como usar o assistente de IA
                </p>
                <p className="text-sm leading-relaxed" style={{ color: NEUTRAL.slate }}>
                  Na tela de Negócios, clique em <strong style={{ color: NEUTRAL.graphite }}>"Perguntar à IA"</strong> para abrir o chat.
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
          style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: "#F0F0F0" }}>
            <div className="flex items-center gap-2 mb-0.5">
              <LifeBuoy size={15} style={{ color: NEUTRAL.red }} />
              <h2 className="font-semibold" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
                Perguntas frequentes
              </h2>
            </div>
            <p className="text-xs mb-3" style={{ color: NEUTRAL.slate }}>
              Dúvidas comuns sobre uso da plataforma.
            </p>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: NEUTRAL.slate }} />
              <input
                type="text"
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                placeholder="Buscar pergunta..."
                className="w-full text-xs rounded-lg border pl-8 pr-3 py-2 outline-none"
                style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FAFAFA" }}
                onFocus={e => { e.currentTarget.style.borderColor = "#b5000b"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; }}
              />
            </div>
          </div>
          <div className="px-5">
            {filteredFaq.length > 0
              ? filteredFaq.map((item, i) => <FAQItem key={i} item={item} />)
              : <p className="py-6 text-xs text-center" style={{ color: NEUTRAL.slate }}>Nenhuma pergunta encontrada para "{faqSearch}".</p>
            }
          </div>
        </div>
      )}
    </div>
  );
}

export default TutoriaisView;
