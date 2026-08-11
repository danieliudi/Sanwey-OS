import React from "react";
import { RECURRENCE_OPTIONS, WEEKDAY_SHORT_LABELS, WEEKDAY_FULL_LABELS } from "../../constants/personal-tasks";

const inputBase = {
  width: "100%", fontSize: 13, borderRadius: 6,
  border: "1px solid var(--border-strong)", padding: "7px 10px",
  background: "var(--surface)", color: "var(--text)", outline: "none",
};

// Nível 2 revisado (rodada 2, 07/08/2026): "Toda semana" ganha escolha de
// QUAIS dias (chips Dom–Sáb, múltipla escolha) e "Todo mês" ganha o DIA
// exato (em vez de só "mesmo número de dia do prazo original"). Extraído
// direto na 2ª ocorrência (Create/Detail compartilham) — a UI de dias da
// semana não é trivial o bastante pra valer duplicar.
export function RecurrencePicker({ recurrence, recurrenceConfig, onRecurrenceChange, onConfigChange }) {
  const cfg = recurrenceConfig || {};
  const daysOfWeek = Array.isArray(cfg.daysOfWeek) ? cfg.daysOfWeek : [];

  const toggleDay = (dow) => {
    const next = daysOfWeek.includes(dow) ? daysOfWeek.filter(d => d !== dow) : [...daysOfWeek, dow].sort();
    onConfigChange({ ...cfg, daysOfWeek: next });
  };

  return (
    <div>
      <select
        value={recurrence || "none"}
        onChange={e => onRecurrenceChange(e.target.value)}
        style={inputBase}
      >
        {RECURRENCE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>

      {recurrence === "weekly" && (
        <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
          {WEEKDAY_SHORT_LABELS.map((label, dow) => {
            const active = daysOfWeek.includes(dow);
            return (
              <button
                key={dow}
                type="button"
                title={WEEKDAY_FULL_LABELS[dow]}
                onClick={() => toggleDay(dow)}
                style={{
                  width: 30, height: 30, borderRadius: "50%", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent)" : "var(--surface)",
                  color: active ? "var(--on-accent)" : "var(--text-dim)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {recurrence === "monthly" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Todo dia</span>
          <input
            type="number"
            min={1}
            max={31}
            value={cfg.dayOfMonth ?? ""}
            placeholder="5"
            onChange={e => {
              const v = e.target.value === "" ? undefined : Math.min(31, Math.max(1, Number(e.target.value)));
              onConfigChange({ ...cfg, dayOfMonth: v });
            }}
            style={{ ...inputBase, width: 64 }}
          />
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>do mês</span>
        </div>
      )}

      {recurrence === "custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>A cada</span>
          <input
            type="number"
            min={1}
            max={365}
            value={cfg.intervalDays ?? ""}
            placeholder="15"
            onChange={e => {
              const v = e.target.value === "" ? undefined : Math.min(365, Math.max(1, Number(e.target.value)));
              onConfigChange({ ...cfg, intervalDays: v });
            }}
            style={{ ...inputBase, width: 64 }}
          />
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>dias</span>
        </div>
      )}
    </div>
  );
}

export default RecurrencePicker;
