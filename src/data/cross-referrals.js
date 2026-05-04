// Synthetic seeds — same as v3. These are advisory suggestions (not derived
// from leads), kept so they can be approved/rejected individually.
export const SYNTHETIC_CROSS_SUGGESTIONS = [
  {
    id: "cross_suggest_2",
    companyName: "Yara Brasil Fertilizantes",
    sector: "Agroquímica",
    city: "Rio Grande/RS",
    presentIn: ["industria"],
    suggestedFor: "resibag",
    reason: "Cliente Sanwey Indústria que movimenta fertilizantes — potencial demanda de gestão de resíduo Classe II",
    confidence: 72,
    type: "suggestion",
    status: "pending",
    totalValue: 0,
  },
  {
    id: "cross_suggest_3",
    companyName: "Suzano S.A.",
    sector: "Papel e Celulose",
    city: "Imperatriz/MA",
    presentIn: ["industria"],
    suggestedFor: "resibag",
    reason: "Operação industrial com geração de resíduo filtrante — fit para linha Resibag Filtrante",
    confidence: 78,
    type: "suggestion",
    status: "pending",
    totalValue: 0,
  },
];

// Pure — derives overlaps from the current leads array.
// Fix B6: overlaps are now recomputed from live `leads` so stage/owner changes
// reflect immediately in the cross-sell view.
export function computeOverlaps(leads) {
  const companyToLeads = new Map();
  for (const l of leads) {
    const key = l.company.replace(/\s*\(.*\)\s*/g, "").trim().toLowerCase();
    if (!companyToLeads.has(key)) companyToLeads.set(key, []);
    companyToLeads.get(key).push(l);
  }
  const overlaps = [];
  for (const [key, ls] of companyToLeads) {
    const uniqueCompanies = Array.from(new Set(ls.map(l => l.companyId)));
    if (uniqueCompanies.length > 1) {
      overlaps.push({
        id: `cross_${key}`,
        companyName: ls[0].company,
        sector: ls[0].sector,
        city: ls[0].city,
        presentIn: uniqueCompanies,
        leads: ls.map(l => ({
          id: l.id, companyId: l.companyId, owner: l.owner, value: l.value,
          stage: l.stage, fitScore: l.fitScore,
        })),
        totalValue: ls.reduce((s, l) => s + l.value, 0),
        type: "overlap",
        status: "active",
      });
    }
  }
  return overlaps;
}

// Merge live overlaps + synthetic suggestions, applying user overrides
// (approved/rejected). Overrides are persisted separately so they survive
// lead edits.
export function buildCrossReferrals(leads, overrides = {}) {
  const overlaps = computeOverlaps(leads);
  const suggestions = SYNTHETIC_CROSS_SUGGESTIONS.map(s => ({
    ...s,
    ...(overrides[s.id] || {}),
  }));
  const decoratedOverlaps = overlaps.map(o => ({
    ...o,
    ...(overrides[o.id] || {}),
  }));
  return [...decoratedOverlaps, ...suggestions];
}
