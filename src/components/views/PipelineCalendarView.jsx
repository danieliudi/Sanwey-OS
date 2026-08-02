import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarCheck, CalendarClock, AlertTriangle } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { formatK } from "../../utils/currency";

// Visão de calendário do pipeline. Cobre:
//   - Follow-ups agendados (lead.nextFollowUp)
//   - Previsão de fechamento (lead.closeDate) — atrasada/futura
//
// Cada dia mostra até 3 pílulas (com "+N" se sobrar mais). Click numa
// pílula abre o drawer do lead correspondente. Click num dia abre a
// lista completa lateral.

const STAGE_NAME = Object.fromEntries(DEFAULT_PIPELINE_STAGES.map(s => [s.id, s.name]));
const TERMINAL = new Set(["ganho", "perdido"]);
const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function PipelineCalendarView({ leads, onLeadClick, user, activeCompany }) {
  const isGroupView = activeCompany === "all";
  // roles[] cobre cargo adicional (ex: gerente como cargo secundário) —
  // user.role sozinho (cargo principal) fica só de fallback.
  const userRoleList = user.roles?.length ? user.roles : (user.role ? [user.role] : []);
  const isManager = userRoleList.includes("gerente") || userRoleList.includes("admin");

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null);

  // Aplica o mesmo escopo do kanban (empresa + responsável).
  const scopedLeads = useMemo(() => {
    let s = leads;
    if (!isGroupView) s = s.filter(l => l.companyId === activeCompany);
    if (!isManager) s = s.filter(l => l.owner === user.id);
    return s;
  }, [leads, activeCompany, user.id, isGroupView, isManager]);

  // Indexa eventos por dia (YYYY-MM-DD) → array de { lead, type, when }.
  const eventsByDay = useMemo(() => {
    const map = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const push = (date, ev) => {
      const k = dayKey(date);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(ev);
    };
    for (const lead of scopedLeads) {
      if (TERMINAL.has(lead.stage)) continue;
      if (lead.nextFollowUp) {
        const d = new Date(lead.nextFollowUp);
        if (!Number.isNaN(d.getTime())) push(d, { lead, type: "followup", when: d });
      }
      if (lead.closeDate) {
        const d = new Date(lead.closeDate);
        if (!Number.isNaN(d.getTime())) {
          const type = d < today ? "overdue" : "close";
          push(d, { lead, type, when: d });
        }
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.when - b.when);
    return map;
  }, [scopedLeads]);

  // Constrói grid 6x7 do mês começando na segunda-feira.
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    // getDay(): 0=dom 1=seg ... usamos seg=0 deslocando.
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursor]);

  const today = new Date();
  const month = cursor.getMonth();

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(dayKey(now));
  };

  const selectedEvents = selectedDay ? (eventsByDay.get(selectedDay) || []) : [];

  return (
    <div className="grid lg:grid-cols-[1fr,320px] gap-4">
      {/* Calendário */}
      <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        {/* Cabeçalho */}
        <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <button
              onClick={goPrev}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: "var(--text-dim)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              aria-label="Mês anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goNext}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: "var(--text-dim)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              aria-label="Próximo mês"
            >
              <ChevronRight size={16} />
            </button>
            <h2 className="font-semibold" style={{ fontSize: 16, color: "var(--text)" }}>
              {MONTHS[month]} <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>{cursor.getFullYear()}</span>
            </h2>
          </div>
          <button
            onClick={goToday}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
          >
            Hoje
          </button>
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border)" }}>
          {WEEKDAYS.map(w => (
            <div
              key={w}
              className="px-2 py-2 text-[10px] font-bold uppercase text-center"
              style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}
            >
              {w}
            </div>
          ))}
        </div>

        {/* Grid de dias */}
        <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(96px, auto)" }}>
          {grid.map((d, i) => {
            const inMonth = d.getMonth() === month;
            const isToday = sameDay(d, today);
            const k = dayKey(d);
            const events = eventsByDay.get(k) || [];
            const isSelected = selectedDay === k;
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(isSelected ? null : k)}
                className="text-left p-1.5 border-r border-b transition-colors cursor-pointer flex flex-col gap-1"
                style={{
                  borderColor: "var(--border)",
                  background: isSelected ? "color-mix(in srgb, #2563EB 12%, var(--surface))" : isToday ? "var(--warning-bg)" : "var(--surface)",
                  opacity: inMonth ? 1 : 0.4,
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.background = isToday ? "var(--warning-bg)" : "var(--surface)";
                }}
              >
                <span
                  className="text-xs font-semibold leading-none"
                  style={{
                    color: isToday ? "var(--warning)" : inMonth ? "var(--text)" : "var(--text-dim)",
                  }}
                >
                  {d.getDate()}
                </span>
                <div className="flex flex-col gap-0.5">
                  {events.slice(0, 3).map((ev, idx) => (
                    <EventPill key={idx} event={ev} onClick={onLeadClick} />
                  ))}
                  {events.length > 3 && (
                    <span className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>
                      +{events.length - 3}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="px-4 py-2.5 flex items-center gap-4 flex-wrap text-[11px] border-t" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
          <LegendDot color="color-mix(in srgb, #047857 60%, var(--text))" icon={CalendarCheck} label="Follow-up agendado" />
          <LegendDot color="color-mix(in srgb, #2563EB 60%, var(--text))" icon={CalendarClock} label="Previsão de fechamento" />
          <LegendDot color="var(--danger)" icon={AlertTriangle} label="Fechamento atrasado" />
        </div>
      </div>

      {/* Sidebar lateral com detalhes do dia selecionado */}
      <div className="rounded-xl border p-3" style={{ background: "var(--surface)", borderColor: "var(--border)", minHeight: 200 }}>
        {selectedDay ? (
          <DaySidebar
            day={selectedDay}
            events={selectedEvents}
            onLeadClick={onLeadClick}
            onClose={() => setSelectedDay(null)}
          />
        ) : (
          <div className="text-center py-8 px-4">
            <CalendarClock size={28} color="var(--text-dim)" className="mx-auto mb-2 opacity-50" />
            <div className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>
              Selecione um dia
            </div>
            <div className="text-xs" style={{ color: "var(--text-dim)" }}>
              Clique numa data do calendário para ver todos os compromissos daquele dia.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────

const EVENT_STYLE = {
  followup: { bg: "color-mix(in srgb, #047857 14%, var(--surface))", color: "color-mix(in srgb, #047857 60%, var(--text))", label: "Follow-up" },
  close:    { bg: "color-mix(in srgb, #2563EB 12%, var(--surface))", color: "color-mix(in srgb, #2563EB 60%, var(--text))", label: "Fechamento" },
  overdue:  { bg: "var(--danger-bg)", color: "var(--danger)", label: "Atrasado" },
};

function EventPill({ event, onClick }) {
  const style = EVENT_STYLE[event.type];
  return (
    <span
      onClick={(e) => { e.stopPropagation(); onClick?.(event.lead); }}
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer"
      style={{ background: style.bg, color: style.color }}
      title={`${style.label} · ${event.lead.company}`}
    >
      {event.lead.company}
    </span>
  );
}

function LegendDot({ color, icon: Icon, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon size={12} color={color} />
      <span>{label}</span>
    </span>
  );
}

function DaySidebar({ day, events, onLeadClick, onClose }) {
  const [y, m, d] = day.split("-");
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const headerStr = dateObj.toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>
            {events.length} compromisso{events.length !== 1 ? "s" : ""}
          </div>
          <div className="text-sm font-semibold capitalize" style={{ color: "var(--text)" }}>
            {headerStr}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[11px] font-semibold px-2 py-1 rounded cursor-pointer"
          style={{ color: "var(--text-dim)", background: "transparent" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          Fechar
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-xs italic py-6 text-center" style={{ color: "var(--text-dim)" }}>
          Nenhum compromisso neste dia.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev, i) => {
            const style = EVENT_STYLE[ev.type];
            const company = COMPANIES[ev.lead.companyId];
            return (
              <button
                key={i}
                onClick={() => onLeadClick?.(ev.lead)}
                className="w-full text-left rounded-lg border p-2.5 transition-colors cursor-pointer"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: style.bg, color: style.color }}
                  >
                    {style.label}
                  </span>
                  {company && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: company.light, color: company.primary }}
                    >
                      {company.short}
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                  {ev.lead.company}
                </div>
                <div className="text-[11px] mt-0.5 flex items-center gap-2" style={{ color: "var(--text-dim)" }}>
                  <span>{STAGE_NAME[ev.lead.stage] || ev.lead.stage}</span>
                  {Number.isFinite(ev.lead.value) && ev.lead.value > 0 && (
                    <>
                      <span>·</span>
                      <span>{formatK(ev.lead.value)}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PipelineCalendarView;
