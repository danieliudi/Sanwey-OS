import React from "react";
import { Plus, X } from "lucide-react";
import { RH_WEEKDAYS } from "../../constants/rh-config";

// Jornada como dado estruturado — lista de blocos { days: string[], start, end }
// — em vez de texto livre ("44h semanais", "seg-sex"). Cobre o caso comum de
// jornada diferente por dia (ex.: sexta encurtada por compensação de sábado)
// como dois blocos: "Seg a Qui" + "Sex". Achado do usuário 20/07 — texto livre
// dava margem de erro na hora de preencher e prejudicava a coleta de dado.

function emptyBlock() {
  return { days: [], start: "", end: "" };
}

function toggleDay(block, dayId) {
  const has = block.days.includes(dayId);
  return { ...block, days: has ? block.days.filter(d => d !== dayId) : [...block.days, dayId] };
}

function blockHours(block) {
  if (!block.start || !block.end || block.days.length === 0) return 0;
  const [sh, sm] = block.start.split(":").map(Number);
  const [eh, em] = block.end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) return 0;
  return (mins / 60) * block.days.length;
}

// Formata blocos de jornada pra exibição (VagaDrawer, Cargos & Salários) —
// "Seg a Qui 07:30–17:20 · Sex 07:30–17:00" quando os dias de um bloco são
// uma sequência contígua na semana, senão lista as abreviações com "/".
export function formatScheduleBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  const order = RH_WEEKDAYS.map((d) => d.id);
  return blocks
    .filter((b) => b.days?.length > 0 && b.start && b.end)
    .map((b) => {
      const sorted = [...b.days].sort((a, c) => order.indexOf(a) - order.indexOf(c));
      const indices = sorted.map((d) => order.indexOf(d));
      const isContiguous = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
      const dayLabel = (id) => RH_WEEKDAYS.find((d) => d.id === id)?.label || id;
      const daysText = isContiguous && sorted.length > 1
        ? `${dayLabel(sorted[0])} a ${dayLabel(sorted[sorted.length - 1])}`
        : sorted.map(dayLabel).join("/");
      return `${daysText} ${b.start}–${b.end}`;
    })
    .join(" · ") || null;
}

export function RHJornadaEditor({ value, onChange }) {
  const blocks = Array.isArray(value) && value.length > 0 ? value : [emptyBlock()];

  const updateBlock = (idx, patch) => {
    onChange(blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };
  const removeBlock = (idx) => {
    const next = blocks.filter((_, i) => i !== idx);
    onChange(next.length > 0 ? next : [emptyBlock()]);
  };
  const addBlock = () => onChange([...blocks, emptyBlock()]);

  // Dia que aparece em mais de um bloco — provável erro de preenchimento.
  const dayCounts = {};
  blocks.forEach(b => b.days.forEach(d => { dayCounts[d] = (dayCounts[d] || 0) + 1; }));
  const duplicatedDays = Object.keys(dayCounts).filter(d => dayCounts[d] > 1);

  const totalHours = blocks.reduce((sum, b) => sum + blockHours(b), 0);

  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, idx) => (
        <div key={idx} className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
          <div className="flex items-center gap-1 flex-wrap mb-2">
            {RH_WEEKDAYS.map(d => {
              const active = block.days.includes(d.id);
              const duplicated = active && duplicatedDays.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => updateBlock(idx, toggleDay(block, d.id))}
                  title={duplicated ? `${d.label} já está em outro período — confira` : undefined}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 999,
                    border: `1px solid ${duplicated ? "var(--danger)" : active ? "var(--accent)" : "var(--border-strong)"}`,
                    background: active ? "var(--accent)" : "var(--surface)",
                    color: active ? "#FFFFFF" : "var(--text-dim)",
                    cursor: "pointer",
                  }}
                >
                  {d.label}
                </button>
              );
            })}
            {blocks.length > 1 && (
              <button
                type="button"
                onClick={() => removeBlock(idx)}
                title="Remover este período"
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 2 }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="time" value={block.start} onChange={(e) => updateBlock(idx, { start: e.target.value })}
              className="text-sm rounded-lg border px-2 py-1.5 outline-none" style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)" }}
            />
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>às</span>
            <input
              type="time" value={block.end} onChange={(e) => updateBlock(idx, { end: e.target.value })}
              className="text-sm rounded-lg border px-2 py-1.5 outline-none" style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)" }}
            />
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addBlock}
          className="inline-flex items-center gap-1.5"
          style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <Plus size={13} /> Adicionar período com horário diferente
        </button>
        {totalHours > 0 && (
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>≈ {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}h/semana</span>
        )}
      </div>
      {duplicatedDays.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--danger)" }}>
          Alguns dias estão marcados em mais de um período — confira antes de salvar.
        </div>
      )}
    </div>
  );
}

export default RHJornadaEditor;
