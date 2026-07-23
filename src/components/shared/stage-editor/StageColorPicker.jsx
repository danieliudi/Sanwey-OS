import React, { useState } from "react";

// Paleta única de cores de etapa — antes duplicada em StageEditorModal.jsx
// (CRM) e RHStageEditorModal.jsx (RH).
export const STAGE_PALETTE = [
  "#B45309", "#DC2626", "#EAB308", "#16A34A", "#10B981",
  "#3B82F6", "#1E3A8A", "#7C3AED", "#9333EA", "#0EA5E9",
  "#64748B", "#475569",
];

export function StageColorPicker({ value, onChange, size = 28 }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-md border-2 cursor-pointer"
        style={{ width: size, height: size, background: value, borderColor: "var(--surface)", boxShadow: "0 0 0 1px var(--border)", flexShrink: 0 }}
        title="Mudar cor"
        type="button"
      />
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-20 rounded-lg shadow-lg border p-2 grid grid-cols-6 gap-1"
          style={{ background: "var(--surface)", borderColor: "var(--border)", width: 168 }}
          onMouseLeave={() => setOpen(false)}
        >
          {STAGE_PALETTE.map(c => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              className="w-6 h-6 rounded-full cursor-pointer"
              style={{ background: c, outline: value === c ? "2px solid #1E40AF" : "none", outlineOffset: 1 }}
              type="button"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default StageColorPicker;
