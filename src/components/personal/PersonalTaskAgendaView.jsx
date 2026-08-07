import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarOff } from "lucide-react";
import { toLocalISODate } from "../../utils/date";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const PRIORITY_DOT = { alta: "#DC2626", media: "#D97706", baixa: "#16A34A" };

// Grid mês-a-mês (Dom–Sáb) — 3º modo de visualização da Lista Pessoal (Nível
// 2 do redesenho, ago/2026), pensado pra "o que vence quando" em vez de "em
// que etapa está" (isso o Kanban já cobre). Tarefas sem prazo não têm onde
// entrar na grade — ficam numa faixa própria abaixo, não escondidas.
export function PersonalTaskAgendaView({ tasks, onOpen }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const todayISO = toLocalISODate(new Date());

  const tasksByDate = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      if (!map.has(t.dueDate)) map.set(t.dueDate, []);
      map.get(t.dueDate).push(t);
    }
    return map;
  }, [tasks]);

  const withoutDate = useMemo(() => tasks.filter(t => !t.dueDate), [tasks]);

  const weeks = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cursor]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-bold" style={{ color: "var(--text)" }}>
          {MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="p-1.5 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)", cursor: "pointer" }}
            aria-label="Mês anterior">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setCursor(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)", cursor: "pointer" }}>
            Hoje
          </button>
          <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="p-1.5 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)", cursor: "pointer" }}
            aria-label="Próximo mês">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="grid grid-cols-7" style={{ background: "var(--surface-alt)" }}>
          {WEEKDAY_LABELS.map(w => (
            <div key={w} className="text-center text-[10px] font-bold uppercase tracking-wide py-2" style={{ color: "var(--text-dim)" }}>
              {w}
            </div>
          ))}
        </div>
        <div>
          {weeks.map((row, ri) => (
            <div key={ri} className="grid grid-cols-7" style={{ borderTop: ri > 0 ? "1px solid var(--border)" : "none" }}>
              {row.map((date, ci) => {
                if (!date) {
                  return <div key={ci} style={{ minHeight: 92, background: "var(--surface-alt)", opacity: 0.35, borderLeft: ci > 0 ? "1px solid var(--border)" : "none" }} />;
                }
                const iso = toLocalISODate(date);
                const items = tasksByDate.get(iso) || [];
                const isToday = iso === todayISO;
                return (
                  <div key={ci} className="p-1.5 flex flex-col gap-1"
                    style={{ minHeight: 92, background: "var(--surface)", borderLeft: ci > 0 ? "1px solid var(--border)" : "none" }}>
                    <div
                      className="text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full"
                      style={{ color: isToday ? "var(--on-accent)" : "var(--text-dim)", background: isToday ? "var(--accent)" : "transparent" }}
                    >
                      {date.getDate()}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {items.slice(0, 3).map(t => (
                        <button
                          key={t.id}
                          onClick={() => onOpen(t)}
                          className="flex items-center gap-1 px-1 py-0.5 rounded text-left"
                          style={{ background: "var(--surface-alt)", border: "none", cursor: "pointer" }}
                          title={t.title}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: PRIORITY_DOT[t.priority] || PRIORITY_DOT.media, flexShrink: 0 }} />
                          <span className="text-[10px] truncate" style={{ color: t.status === "feito" ? "var(--text-dim)" : "var(--text)", textDecoration: t.status === "feito" ? "line-through" : "none" }}>
                            {t.title}
                          </span>
                        </button>
                      ))}
                      {items.length > 3 && (
                        <div className="text-[9.5px] px-1" style={{ color: "var(--text-dim)" }}>+{items.length - 3} mais</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {withoutDate.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            <CalendarOff size={12} />
            Sem prazo ({withoutDate.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {withoutDate.map(t => (
              <button key={t.id} onClick={() => onOpen(t)}
                className="px-2.5 py-1 rounded-lg text-xs"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: t.status === "feito" ? "var(--text-dim)" : "var(--text)", textDecoration: t.status === "feito" ? "line-through" : "none", cursor: "pointer" }}>
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonalTaskAgendaView;
