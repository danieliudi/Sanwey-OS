import { COMPANIES } from "../constants/companies";

export function exportLeadsCSV(leads, users, pipelines) {
  // Flatten all stages from all pipelines into a stageId -> name map
  const stageMap = new Map();
  for (const stages of Object.values(pipelines || {})) {
    for (const stage of stages) {
      if (!stageMap.has(stage.id)) {
        stageMap.set(stage.id, stage.name);
      }
    }
  }

  const header = [
    "Empresa",
    "Setor",
    "Etapa",
    "Responsável",
    "Unidade",
    "Valor estimado",
    "Fit score",
    "Criado em",
    "Dias no pipeline",
  ];

  const rows = leads.map(lead => {
    const owner = (users || []).find(u => u.id === lead.owner);
    const ownerName = owner?.name || lead.owner || "—";

    const stageName = stageMap.get(lead.stage) || lead.stage || "—";

    const company = COMPANIES[lead.companyId];
    const unitLabel = company?.short || company?.name || lead.companyId || "—";

    const value =
      lead.value != null && lead.value !== 0
        ? `R$ ${Number(lead.value).toLocaleString("pt-BR")}`
        : "—";

    const fit = lead.fitScore != null ? `${lead.fitScore}%` : "—";

    const createdAt = lead.createdAt
      ? new Date(lead.createdAt).toLocaleDateString("pt-BR")
      : "—";

    const days = lead.createdAt
      ? Math.floor((Date.now() - new Date(lead.createdAt)) / 86400000)
      : "—";

    return [
      lead.company || "—",
      lead.sector || "—",
      stageName,
      ownerName,
      unitLabel,
      value,
      fit,
      createdAt,
      days,
    ];
  });

  const csv = [header, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  // BOM (U+FEFF) so Excel opens the file with UTF-8 encoding correctly
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
