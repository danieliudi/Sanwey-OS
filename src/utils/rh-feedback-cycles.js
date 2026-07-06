// Sequência fixa de ciclos de feedback: 3 check-ins de onboarding (30/60/90
// dias, só depois que o colaborador chega em "Acompanhamento") e, depois
// disso, um ciclo semestral recorrente pra sempre. Usado tanto no gatilho
// de mudança de etapa do onboarding quanto na reconciliação ao abrir a
// tela de Feedback — por isso vive num util compartilhado, não duplicado.

const CHECKIN_SEQUENCE = [
  { tipo: "30_dias", days: 30 },
  { tipo: "60_dias", days: 60 },
  { tipo: "90_dias", days: 90 },
];
const RECURRING_TIPO = "semestral";
const RECURRING_DAYS = 182;
const ADMISSAO_RECENTE_DIAS = 120;
const ONBOARDING_ORDER = ["documentacao", "integracao", "acompanhamento", "avaliacao", "concluido"];

export function addDaysISO(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function reachedAcompanhamento(stage) {
  const idx = ONBOARDING_ORDER.indexOf(stage);
  return idx >= ONBOARDING_ORDER.indexOf("acompanhamento");
}

// Retorna { tipo, periodStart, periodEnd } pro próximo ciclo pendente desse
// colaborador, ou null se ainda não é hora de criar um (já tem um em
// aberto, ainda não venceu o próximo, ou não há data de referência).
export function nextPendingCycle(colaborador, feedbacksDoColaborador) {
  const hasOpen = feedbacksDoColaborador.some((f) => f.status !== "concluido");
  if (hasOpen) return null;

  const concluidos = feedbacksDoColaborador.filter((f) => f.status === "concluido");
  const tiposConcluidos = new Set(concluidos.map((f) => f.tipo));

  const admissionRecente = colaborador.admissionDate
    && (Date.now() - new Date(colaborador.admissionDate).getTime()) < ADMISSAO_RECENTE_DIAS * 86400000;
  // Uma vez iniciada a sequência de check-in (pelo menos um 30/60/90 já
  // concluído), continua até o fim mesmo que a admissão "envelheça" além
  // da janela de recência — só a admissão recente decide se a sequência
  // deve COMEÇAR, não se ela pode continuar.
  const sequenciaJaComecou = concluidos.some((f) => CHECKIN_SEQUENCE.some((c) => c.tipo === f.tipo));
  const algumCheckinPendente = CHECKIN_SEQUENCE.some((c) => !tiposConcluidos.has(c.tipo));

  if (algumCheckinPendente && (admissionRecente || sequenciaJaComecou) && reachedAcompanhamento(colaborador.onboardingStage)) {
    const proximoCheckin = CHECKIN_SEQUENCE.find((c) => !tiposConcluidos.has(c.tipo));
    if (proximoCheckin) {
      return {
        tipo: proximoCheckin.tipo,
        periodStart: colaborador.admissionDate,
        periodEnd: addDaysISO(colaborador.admissionDate, proximoCheckin.days),
      };
    }
  }

  const ultimoConcluido = concluidos
    .slice()
    .sort((a, b) => new Date(b.period_end) - new Date(a.period_end))[0];
  const base = ultimoConcluido
    ? ultimoConcluido.period_end
    : (colaborador.admissionDate ? addDaysISO(colaborador.admissionDate, 90) : null);
  if (!base) return null;

  const periodEnd = addDaysISO(base, RECURRING_DAYS);
  if (new Date(periodEnd) > new Date()) return null;
  return { tipo: RECURRING_TIPO, periodStart: base, periodEnd };
}
