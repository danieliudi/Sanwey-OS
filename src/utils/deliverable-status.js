import { daysSince, parseDateInput } from "./date";

// Critério único de "entrega atrasada" / "vence em breve" / "entregue no prazo".
//
// Extraído 01/09/2026 (regra 4 do CLAUDE.md — já eram 5 ocorrências) durante o
// checkup da plataforma. Existiam TRÊS critérios diferentes convivendo para a
// mesma pergunta: `EntregasView` já tinha `isOverdueDeliverable` correto (via
// `daysSince`, horário local) usado só no filtro "Atrasadas", enquanto a coluna
// Prazo da Tabela, o chip do card de Lista, o KPI "Atrasadas" da aba Análise, o
// `isDeliverableLate` do Painel de Marketing e o drawer de detalhe todos
// repetiam `new Date(d.deadline) < new Date()` na mão.
//
// `new Date("AAAA-MM-DD")` parseia como meia-noite UTC: em BRT (UTC-3) uma
// entrega que vence HOJE já aparecia vermelha/contava como atrasada a partir
// das 21h de ONTEM. O filtro dizia uma coisa e a tabela ao lado dizia outra,
// na mesma tela, para a mesma entrega.
export function isOverdueDeliverable(d) {
  return Boolean(d?.deadline) && daysSince(d.deadline) > 0;
}

export function isDueSoon(d) {
  if (!d?.deadline) return false;
  const days = daysSince(d.deadline);
  return days <= 0 && days >= -7;
}

// Entregue dentro do prazo: o prazo é um DIA inteiro, não um instante. A
// comparação anterior (`new Date(stageChangedAt) <= new Date(deadline)`)
// media um timestamp real contra meia-noite UTC do dia do prazo — qualquer
// entrega concluída durante o próprio dia do vencimento contava como fora do
// prazo, deflacionando o "SLA cumprido" do Painel de Marketing.
export function wasDeliveredOnTime(d) {
  if (!d?.deadline || !d?.stageChangedAt) return false;
  const fimDoDia = parseDateInput(d.deadline).getTime() + 86400000;
  return new Date(d.stageChangedAt).getTime() < fimDoDia;
}
