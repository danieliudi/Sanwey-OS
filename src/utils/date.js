const dateBR = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Colunas `date` do Postgres chegam como "AAAA-MM-DD" puro; `new Date(...)`
// interpretaria isso como meia-noite UTC, o que "volta" um dia em fusos
// negativos (Brasil). Datas com hora (timestamptz) seguem o parsing normal.
export function parseDateInput(input) {
  if (input instanceof Date) return input;
  const s = String(input);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

export function formatDateBR(input) {
  if (!input) return "—";
  const d = parseDateInput(input);
  if (Number.isNaN(d.getTime())) return "—";
  return dateBR.format(d);
}

export function daysSince(input) {
  if (!input) return 0;
  const d = parseDateInput(input);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// Mesmo vocabulário {bg,text,border} do agingStyle (LeadKanbanCard), mas com
// tokens CSS custom theme-aware em vez de hex fixos — compartilhado entre
// LeadKanbanCard e LeadDetailDrawer pra não divergir o limiar entre os dois.
export function closeDateUrgencyStyle(closeDate) {
  if (!closeDate) return null;
  const days = daysSince(closeDate);
  if (days > 0) {
    return {
      bg: "var(--danger-bg)",
      text: "var(--danger)",
      border: "color-mix(in srgb, var(--danger) 20%, transparent)",
    };
  }
  if (days >= -7) {
    return {
      bg: "var(--amber-bg)",
      text: "var(--amber)",
      border: "color-mix(in srgb, var(--amber) 20%, transparent)",
    };
  }
  return null;
}

// Grava um "AAAA-MM-DD" de <input type=date> numa coluna timestamptz sem
// "voltar" um dia quando reexibido em fuso negativo (BRT). new Date(str)
// interpretaria a string pura como meia-noite UTC — constrói meia-noite
// LOCAL a partir dos componentes antes de converter pra ISO.
export function localDateInputToISOString(dateStr) {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  if (!m) return new Date(dateStr).toISOString();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toISOString();
}
