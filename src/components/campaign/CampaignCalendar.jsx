import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Download, Link2, CalendarDays } from "lucide-react";
import { MARKETING_STAGES } from "../../constants/marketing-pipelines";
import { generateICS, downloadICS } from "../../utils/ics-export";

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfDay(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysBetween(a, b) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

function toDateInput(d) {
  // Convert Date or "YYYY-MM-DD" string to "YYYY-MM-DD"
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const DAY_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const EVENT_H  = 22;
const EVENT_GAP = 2;
const MAX_TRACKS = 3;

const PERSONAL_COLORS = [
  "#6366F1","#EC4899","#14B8A6","#F97316","#8B5CF6","#0EA5E9","#10B981",
];

// ── Personal event modal ──────────────────────────────────────────────────────

function PersonalEventModal({ event, defaultDate, onSave, onDelete, onClose }) {
  const isEdit = Boolean(event?.id);
  const [title, setTitle]       = useState(event?.title || "");
  const [date, setDate]         = useState(event?.date ? toDateInput(event.date) : (defaultDate || ""));
  const [endDate, setEndDate]   = useState(event?.endDate ? toDateInput(event.endDate) : "");
  const [desc, setDesc]         = useState(event?.description || "");
  const [color, setColor]       = useState(event?.color || PERSONAL_COLORS[0]);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true);
    try {
      await onSave({
        id:          event?.id,
        title:       title.trim(),
        date,
        endDate:     endDate || null,
        description: desc.trim() || null,
        color,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    setSaving(true);
    try { await onDelete(event.id); onClose(); } finally { setSaving(false); }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface-alt)", borderRadius: 8, border: "1px solid var(--border-strong)", padding: "6px 10px", fontSize: 13, width: "100%", outline: "none" };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "var(--overlay-scrim)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "var(--shadow-pop)", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
            {isEdit ? "Editar evento" : "Novo evento pessoal"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "18px 20px 20px" }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Título *</label>
            <input autoFocus type="text" placeholder="Nome do evento" value={title} onChange={e => setTitle(e.target.value)} style={inputSt} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelSt}>Data *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Até (opcional)</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={date} style={inputSt} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Descrição</label>
            <textarea rows={2} placeholder="Detalhes do evento…" value={desc} onChange={e => setDesc(e.target.value)}
              style={{ ...inputSt, resize: "none", lineHeight: 1.5 }} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelSt}>Cor</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PERSONAL_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: color === c ? `3px solid ${"var(--text)"}` : "2px solid transparent", cursor: "pointer", flexShrink: 0 }} />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: isEdit ? "space-between" : "flex-end" }}>
            {isEdit && (
              <button type="button" onClick={handleDelete} disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--danger-bg)", color: "var(--danger)", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Trash2 size={13} /> Excluir
              </button>
            )}
            <button type="submit" disabled={saving || !title.trim() || !date}
              style={{ background: color, color: "var(--surface)", border: "none", borderRadius: 8, padding: "7px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving || !title.trim() || !date ? 0.5 : 1 }}>
              {saving ? "Salvando…" : isEdit ? "Salvar" : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sync modal ────────────────────────────────────────────────────────────────

function SyncModal({ onClose, onExport, calendarToken, supabaseUrl }) {
  const [copied, setCopied] = useState(null);

  const personalUrl  = calendarToken && supabaseUrl
    ? `${supabaseUrl}/functions/v1/calendar-ics?token=${calendarToken}&type=personal`
    : null;
  const marketingUrl = calendarToken && supabaseUrl
    ? `${supabaseUrl}/functions/v1/calendar-ics?token=${calendarToken}&type=marketing`
    : null;

  const copyUrl = async (url, key) => {
    try { await navigator.clipboard.writeText(url); } catch { }
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "var(--overlay-scrim)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-pop)", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Sincronizar calendário</span>
            <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Exporte ou assine o calendário no Google Calendar / Apple Calendar / Outlook</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "18px 20px 20px" }}>
          {/* Export section */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Exportar (importação única)
            </div>
            <button
              onClick={onExport}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-alt)", color: "var(--accent)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}
            >
              <Download size={15} />
              Baixar .ics (campanhas + eventos pessoais)
            </button>
          </div>

          {/* Subscription section */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              URL de assinatura (sincronização automática)
            </div>

            {!personalUrl ? (
              <div style={{ background: "var(--warning-bg)", border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "var(--warning)" }}>
                <strong>Edge Function não configurada.</strong> Para habilitar sync automático, faça deploy da Edge Function <code>calendar-ics</code> no Supabase.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <UrlRow
                  label="Seus eventos pessoais"
                  desc="Somente você vê — privado"
                  url={personalUrl}
                  copied={copied === "personal"}
                  onCopy={() => copyUrl(personalUrl, "personal")}
                  color="#6366F1"
                />
                <UrlRow
                  label="Campanhas de marketing"
                  desc="Compartilhado com toda a equipe"
                  url={marketingUrl}
                  copied={copied === "marketing"}
                  onCopy={() => copyUrl(marketingUrl, "marketing")}
                  color="var(--accent)"
                />
              </div>
            )}

            <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--surface-alt)", borderRadius: 8, fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
              <strong>Como usar:</strong> No Google Calendar → "+" → "De URL" → cole a URL acima. O calendário se atualiza automaticamente a cada 24h.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UrlRow({ label, desc, url, copied, onCopy, color }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{label}</span>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>· {desc}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input readOnly value={url} onClick={e => e.target.select()}
          style={{ flex: 1, fontSize: 10, color: "var(--text-dim)", background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", outline: "none", overflow: "hidden", textOverflow: "ellipsis" }} />
        <button onClick={onCopy}
          style={{ display: "flex", alignItems: "center", gap: 5, background: copied ? "var(--success-bg)" : "var(--surface-alt)", color: copied ? "var(--success)" : "var(--text)", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          <Link2 size={11} />
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

// ── Main calendar component ───────────────────────────────────────────────────

export function CampaignCalendar({
  campaigns = [],
  personalEvents = [],
  usersById,
  onSelectCampaign,
  onCreatePersonalEvent,
  onUpdatePersonalEvent,
  onDeletePersonalEvent,
  canWrite = false,
  calendarToken = null,
  supabaseUrl = null,
  stages = null,
}) {
  const effectiveStages = stages?.length ? stages : MARKETING_STAGES;
  const [currentMonth, setCurrentMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [personalModal, setPersonalModal] = useState(null); // null | { event?, date? }
  const [showSync, setShowSync]           = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);

  const prevMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goToday   = () => {
    const n = new Date();
    setCurrentMonth(new Date(n.getFullYear(), n.getMonth(), 1));
  };

  // Generate weeks array
  const weeks = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);

    const gridStart = new Date(firstDay);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay()); // back to Sunday

    const weeksArr = [];
    let curr = new Date(gridStart);
    while (curr <= lastDay || weeksArr.length < 4) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(curr));
        curr = addDays(curr, 1);
      }
      weeksArr.push(week);
      if (weeksArr.length >= 6) break;
    }
    return weeksArr;
  }, [currentMonth]);

  // Build unified event list for layout
  const allEvents = useMemo(() => {
    const evts = [];

    campaigns.forEach(c => {
      if (!c.launchDate) return;
      const start = startOfDay(new Date(c.launchDate));
      const end   = c.endDate ? startOfDay(new Date(c.endDate)) : start;
      const stage = effectiveStages.find(s => s.id === c.stage);
      evts.push({ id: c.id, type: "campaign", start, end, color: stage?.color || "#888", label: c.name, data: c });
    });

    personalEvents.forEach(e => {
      if (!e.date) return;
      const start = startOfDay(new Date(e.date + "T00:00:00"));
      const end   = e.endDate ? startOfDay(new Date(e.endDate + "T00:00:00")) : start;
      evts.push({ id: e.id, type: "personal", start, end, color: e.color || "#6366F1", label: e.title, data: e });
    });

    return evts;
  }, [campaigns, personalEvents, effectiveStages]);

  // Per-week layout data
  const weekData = useMemo(() => {
    return weeks.map(week => {
      const weekStart = startOfDay(week[0]);
      const weekEnd   = startOfDay(week[6]);

      const evts = allEvents
        .filter(evt => evt.end >= weekStart && evt.start <= weekEnd)
        .map(evt => {
          const colStart = Math.max(0, daysBetween(weekStart, evt.start));
          const colEnd   = Math.min(6, daysBetween(weekStart, evt.end));
          return {
            ...evt,
            colStart,
            span:    colEnd - colStart + 1,
            isStart: evt.start >= weekStart,
            isEnd:   evt.end   <= weekEnd,
          };
        });

      // Sort: earlier start, longer duration first
      evts.sort((a, b) => a.colStart - b.colStart || b.span - a.span || (a.type === "campaign" ? -1 : 1));

      // Assign tracks
      const trackEnds = [];
      evts.forEach(evt => {
        let t = 0;
        while (t < trackEnds.length && trackEnds[t] >= evt.colStart) t++;
        evt.track = t;
        trackEnds[t] = evt.colStart + evt.span - 1;
      });

      // Count overflows per column
      const overflow = Array(7).fill(0);
      evts.forEach(evt => {
        if (evt.track >= MAX_TRACKS) {
          for (let col = evt.colStart; col < evt.colStart + evt.span; col++) {
            overflow[col]++;
          }
        }
      });

      const maxTrack = evts.filter(e => e.track < MAX_TRACKS).reduce((m, e) => Math.max(m, e.track), -1);

      return {
        week,
        visible: evts.filter(e => e.track < MAX_TRACKS),
        overflow,
        rowHeight: 38 + (maxTrack + 1) * (EVENT_H + EVENT_GAP) + (overflow.some(v => v > 0) ? 18 : 0) + 8,
      };
    });
  }, [weeks, allEvents]);

  const currentMonthNum = currentMonth.getMonth();

  const handleDayClick = useCallback((day, e) => {
    // Only create personal event if clicking directly on the day number area (not on an event bar)
    if (!canWrite) return;
    if (e.target.closest("[data-event]")) return;
    const dateStr = toDateInput(day);
    setPersonalModal({ date: dateStr });
  }, [canWrite]);

  const handlePersonalSave = useCallback(async (data) => {
    if (data.id) {
      await onUpdatePersonalEvent(data.id, data);
    } else {
      await onCreatePersonalEvent(data);
    }
  }, [onCreatePersonalEvent, onUpdatePersonalEvent]);

  const handleExportICS = useCallback(() => {
    const content = generateICS({
      campaigns,
      personalEvents,
      calendarName: "Sanwey CRM",
    });
    downloadICS(content, "sanwey-calendario.ics");
  }, [campaigns, personalEvents]);

  return (
    <>
    <div>
      {/* Calendar header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-bold" style={{ fontSize: 20, color: "var(--text)", letterSpacing: "-0.01em" }}>
            {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h2>
          <button
            onClick={goToday}
            className="text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
          >
            Hoje
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSync(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
            title="Sincronizar com Google Calendar / Apple Calendar"
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
          >
            <CalendarDays size={13} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>

          <div className="flex items-center gap-1">
            <button onClick={prevMonth}
              className="flex items-center justify-center rounded-lg border transition-colors"
              style={{ width: 32, height: 32, background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
            >
              <ChevronLeft size={16} />
            </button>
            <button onClick={nextMonth}
              className="flex items-center justify-center rounded-lg border transition-colors"
              style={{ width: 32, height: 32, background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        {/* Day-name header */}
        <div className="grid grid-cols-7" style={{ borderBottom: "1px solid var(--border)" }}>
          {DAY_SHORT.map((d, i) => (
            <div key={d} className="text-center py-2 text-xs font-semibold" style={{ color: "var(--text-dim)", borderRight: i < 6 ? "1px solid #E5E7EB" : "none" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weekData.map(({ week, visible, overflow, rowHeight }, wi) => (
          <div
            key={wi}
            className="relative"
            style={{ borderBottom: wi < weekData.length - 1 ? "1px solid #E5E7EB" : "none", minHeight: rowHeight }}
          >
            {/* Day cells */}
            <div className="grid grid-cols-7" style={{ height: "100%" }}>
              {week.map((day, di) => {
                const isCurrentMonth = day.getMonth() === currentMonthNum;
                const isToday = day.getTime() === today.getTime();
                const isWeekend = di === 0 || di === 6;
                return (
                  <div
                    key={di}
                    className="cursor-pointer"
                    style={{
                      borderRight: di < 6 ? "1px solid #E5E7EB" : "none",
                      minHeight: rowHeight,
                      background: isWeekend ? "var(--surface-alt)" : "transparent",
                    }}
                    onClick={e => handleDayClick(day, e)}
                  >
                    <div className="flex justify-center pt-2 pb-1">
                      <span
                        className="flex items-center justify-center text-xs font-semibold select-none"
                        style={{
                          width: 26, height: 26, borderRadius: "50%",
                          background: isToday ? "var(--color-industria)" : "transparent",
                          color: isToday ? "#FFF" : isCurrentMonth ? "var(--text)" : "#C5C9D0",
                          fontWeight: isToday ? 700 : 600,
                        }}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Event bars overlay */}
            <div className="absolute left-0 right-0 pointer-events-none" style={{ top: 38 }}>
              {visible.map((evt, ei) => {
                const left  = `calc(${(evt.colStart / 7) * 100}% + 3px)`;
                const width = `calc(${(evt.span / 7) * 100}% - 6px)`;
                const top   = evt.track * (EVENT_H + EVENT_GAP);
                const isPersonal = evt.type === "personal";

                return (
                  <button
                    key={`${evt.id}-${wi}-${ei}`}
                    data-event="1"
                    onClick={() => {
                      if (isPersonal) {
                        setPersonalModal({ event: evt.data });
                      } else {
                        onSelectCampaign(evt.data);
                      }
                    }}
                    title={evt.label}
                    className="absolute flex items-center text-xs font-semibold pointer-events-auto transition-opacity"
                    style={{
                      left, width, top,
                      height: EVENT_H,
                      background:   isPersonal ? evt.color + "22" : evt.color,
                      color:        isPersonal ? evt.color         : "var(--surface)",
                      border:       isPersonal ? `1.5px solid ${evt.color}` : "none",
                      borderRadius: evt.isStart && evt.isEnd ? 5
                                  : evt.isStart              ? "5px 0 0 5px"
                                  : evt.isEnd                ? "0 5px 5px 0"
                                  : 0,
                      paddingLeft:  evt.isStart ? 6 : 4,
                      paddingRight: evt.isEnd   ? 6 : 4,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      zIndex: 2,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "0.8"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                  >
                    {evt.isStart ? evt.label : ""}
                  </button>
                );
              })}

              {/* Overflow "+N" chips */}
              {overflow.map((count, di) => count > 0 ? (
                <div
                  key={`ov-${di}`}
                  style={{
                    position: "absolute",
                    left:   `calc(${(di / 7) * 100}% + 5px)`,
                    width:  `calc(${(1 / 7) * 100}% - 10px)`,
                    top:    MAX_TRACKS * (EVENT_H + EVENT_GAP),
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--text-dim)",
                  }}
                >
                  +{count} mais
                </div>
              ) : null)}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4">
        <span className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>Etapas:</span>
        {effectiveStages.map(s => (
          <div key={s.id} className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>{s.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <div style={{ width: 10, height: 10, borderRadius: 3, border: "1.5px solid #6366F1", background: "#6366F122" }} />
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>Evento pessoal</span>
        </div>
      </div>

      {canWrite && (
        <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
          Clique em um dia para adicionar um evento pessoal · Clique em uma campanha para ver detalhes
        </p>
      )}
    </div>

    {/* Personal event modal */}
    {personalModal && (
      <PersonalEventModal
        event={personalModal.event}
        defaultDate={personalModal.date}
        onSave={handlePersonalSave}
        onDelete={onDeletePersonalEvent}
        onClose={() => setPersonalModal(null)}
      />
    )}

    {/* Sync modal */}
    {showSync && (
      <SyncModal
        onClose={() => setShowSync(false)}
        onExport={() => { handleExportICS(); setShowSync(false); }}
        calendarToken={calendarToken}
        supabaseUrl={supabaseUrl}
      />
    )}
    </>
  );
}
