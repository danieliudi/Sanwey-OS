import React, { memo } from "react";

// Indicador de completude dos campos obrigatórios da etapa atual, visível
// direto no card do Kanban sem precisar abrir o drawer (auditoria 10.3).
// Mesmo estilo visual do FitScoreCircle (anel + texto no centro), mas
// mostrando "preenchidos/total" em vez de um score percentual.
function CompletenessBadgeImpl({ filled, total, size = 30 }) {
  if (!total) return null;
  const complete = filled >= total;
  const color = complete ? "var(--color-resibag)" : "var(--amber)";
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (filled / total) * circumference;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      title={complete ? "Campos obrigatórios completos" : `${filled}/${total} campos obrigatórios preenchidos`}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E5E5E5" strokeWidth="3" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <span className="font-bold" style={{ color, fontSize: size < 40 ? 9 : 12, letterSpacing: "-0.02em" }}>
        {filled}/{total}
      </span>
    </div>
  );
}

export const CompletenessBadge = memo(CompletenessBadgeImpl);
export default CompletenessBadge;
