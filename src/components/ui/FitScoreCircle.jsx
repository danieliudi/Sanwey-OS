import React, { memo } from "react";
import { NEUTRAL } from "../../constants/companies";

function scoreColor(score) {
  if (score >= 80) return "var(--color-resibag)";
  if (score >= 65) return NEUTRAL.gold;
  if (score >= 50) return "var(--amber)";
  return "var(--text-dim)";
}

function FitScoreCircleImpl({ score, size = 44 }) {
  const color = scoreColor(score);
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      title={`Fit score: ${score}/100 — pontuação de potencial do lead com base no perfil e comportamento`}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E5E5E5" strokeWidth="3" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <span className="font-bold" style={{ color, fontSize: size < 40 ? 10 : 13, letterSpacing: "-0.02em" }}>
        {score}
      </span>
    </div>
  );
}

export const FitScoreCircle = memo(FitScoreCircleImpl);
export default FitScoreCircle;
