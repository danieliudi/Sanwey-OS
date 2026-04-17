import React from "react";
import { Badge } from "./Badge";

const CONFIG = {
  critico: { label: "Crítico", variant: "critical" },
  alto: { label: "Alto", variant: "urgent" },
  medio: { label: "Médio", variant: "gold" },
  informativo: { label: "Info", variant: "neutral" },
  imediato: { label: "Imediato", variant: "critical" },
  "30d": { label: "30d", variant: "urgent" },
  "90d": { label: "90d", variant: "gold" },
  indefinido: { label: "Indefinido", variant: "neutral" },
};

export function UrgencyTag({ urgency }) {
  const c = CONFIG[urgency] || CONFIG.informativo;
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export default UrgencyTag;
