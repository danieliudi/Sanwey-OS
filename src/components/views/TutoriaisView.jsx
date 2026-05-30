import React, { useState } from "react";
import { Play, ChevronDown, ChevronUp, BookOpen, LifeBuoy } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { VIDEO_TUTORIALS, FAQ_ITEMS } from "../../data/tutorials";

const ROLE_LABEL = { admin: "Administrador", gerente: "Gerente", vendedor: "Vendedor", consultor: "Consultor" };

function VideoCard({ video }) {
  const hasUrl = Boolean(video.url);
  return (
    <div
      className="flex flex-col rounded-xl border overflow-hidden"
      style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* Thumbnail */}
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
              style={{ width: 48, height: 48, background: "#E5E0DA" }}
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

      {/* Info */}
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

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border-b last:border-b-0"
      style={{ borderColor: "#E5E7EB" }}
    >
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

export function TutoriaisView({ currentUser }) {
  const role = currentUser?.role || "vendedor";
  const videos = VIDEO_TUTORIALS[role] || VIDEO_TUTORIALS.vendedor;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={18} style={{ color: NEUTRAL.red }} />
          <h1 className="font-bold" style={{ fontSize: 22, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            Ajuda & Tutoriais
          </h1>
        </div>
        <p className="text-sm" style={{ color: NEUTRAL.slate }}>
          Conteúdo personalizado para <strong style={{ color: NEUTRAL.graphite }}>{ROLE_LABEL[role] || role}</strong> — aprenda a usar o CRM no seu dia a dia.
        </p>
      </div>

      {/* Videos */}
      <div>
        <h2 className="font-semibold mb-4" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
          Vídeos tutoriais
        </h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {videos.map(v => <VideoCard key={v.id} video={v} />)}
        </div>
        <p className="text-xs mt-3" style={{ color: NEUTRAL.slate }}>
          Os vídeos serão publicados em breve. Quando disponíveis, aparecerão automaticamente nesta tela.
        </p>
      </div>

      {/* FAQ */}
      <div
        className="rounded-xl border p-5"
        style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <LifeBuoy size={15} style={{ color: NEUTRAL.red }} />
          <h2 className="font-semibold" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
            Perguntas frequentes
          </h2>
        </div>
        <p className="text-xs mb-4" style={{ color: NEUTRAL.slate }}>
          Dúvidas comuns sobre uso da plataforma.
        </p>
        <div>
          {FAQ_ITEMS.map((item, i) => <FAQItem key={i} item={item} />)}
        </div>
      </div>
    </div>
  );
}

export default TutoriaisView;
