// Taxonomia de tipos de activity do negócio (leads.activities[].type).
//
// Fonte única de verdade pro rótulo/ícone de cada tipo e — mais importante —
// pra separação aprovada com o Daniel (FASE 3) entre:
//   kind: "interaction" → INTERAÇÃO COM O CLIENTE (visita, comentário,
//         amostra, follow-up, pós-venda, e-mail, proposta).
//   kind: "internal"    → EVENTO INTERNO (mudança de etapa, anexo, checklist).
// Os dois NUNCA compartilham a mesma hierarquia visual: o interno é pano de
// fundo, recolhível, nunca com o mesmo peso do que aconteceu com o cliente.
//
// Quem renderiza (feed do negócio, linha do tempo por cliente) importa daqui
// em vez de repetir o switch de tipos — evita o caso "tipo novo aparece como
// item genérico sem rótulo", que foi exatamente o que aconteceu com
// 'email_sent'/'proposal_generated' antes de existirem.

import {
  GitBranch, StickyNote, MessageCircle, CalendarClock, Mail, FileText,
  Paperclip, ListChecks, Package, MapPin, Headphones, Activity,
} from "lucide-react";

export const ACTIVITY_TYPES = {
  // ── Interação com o cliente ────────────────────────────────────────────
  note:               { label: "Nota",              icon: StickyNote,   kind: "interaction" },
  comment:            { label: "Comentário",        icon: MessageCircle, kind: "interaction" },
  follow_up_set:      { label: "Follow-up",         icon: CalendarClock, kind: "interaction" },
  // "iniciado", não "enviado": o mailto: abre no cliente de e-mail do
  // usuário e a plataforma não tem como saber se ele apertou enviar.
  email_sent:         { label: "E-mail",            icon: Mail,          kind: "interaction" },
  // "gerada", não "enviada": a proposta é montada na tela; o envio é manual.
  proposal_generated: { label: "Proposta",          icon: FileText,      kind: "interaction" },
  sample_sent:        { label: "Amostra",           icon: Package,       kind: "interaction" },
  visit:              { label: "Visita",            icon: MapPin,        kind: "interaction" },
  posvenda_case:      { label: "Pós-venda",         icon: Headphones,    kind: "interaction" },

  // ── Evento interno ─────────────────────────────────────────────────────
  stage_changed:      { label: "Etapa",             icon: GitBranch,     kind: "internal" },
  stage:              { label: "Etapa",             icon: GitBranch,     kind: "internal" },
  attachment:         { label: "Anexo",             icon: Paperclip,     kind: "internal" },
  checklist:          { label: "Checklist",         icon: ListChecks,    kind: "internal" },
};

const FALLBACK = { label: "Atividade", icon: Activity, kind: "internal" };

export function activityTypeMeta(type) {
  return ACTIVITY_TYPES[type] || FALLBACK;
}

export function isClientInteraction(type) {
  return activityTypeMeta(type).kind === "interaction";
}
