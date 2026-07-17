import { parseDateInput } from "./date";

// Saldo de férias — aproximação prática da regra CLT (30 dias por período
// aquisitivo de 12 meses trabalhados), sem o detalhe de período concessivo/
// dobra por vencimento (isso exigiria um motor de compliance à parte). É
// "quantos dias a pessoa já tem direito, descontado o que já usou em
// solicitações aprovadas do tipo 'ferias'" — dá uma ideia real de saldo sem
// fingir precisão jurídica total.

function daysInclusive(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = parseDateInput(startDate).getTime();
  const end = parseDateInput(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86400000) + 1);
}

// requests: linhas de rh_ferias (type/status/start_date/end_date) da PESSOA.
export function computeFeriasSaldo(admissionDate, requests) {
  if (!admissionDate) return null;
  const admission = parseDateInput(admissionDate);
  if (Number.isNaN(admission.getTime())) return null;

  const now = new Date();
  const monthsWorked = (now.getFullYear() - admission.getFullYear()) * 12 + (now.getMonth() - admission.getMonth())
    - (now.getDate() < admission.getDate() ? 1 : 0);
  const completedPeriods = Math.max(0, Math.floor(monthsWorked / 12));
  const diasDireito = completedPeriods * 30;

  const diasGozados = (requests || [])
    .filter((r) => r.type === "ferias" && r.status === "aprovado")
    .reduce((sum, r) => sum + daysInclusive(r.start_date, r.end_date), 0);

  return {
    diasDireito,
    diasGozados,
    saldo: Math.max(0, diasDireito - diasGozados),
    completedPeriods,
  };
}
