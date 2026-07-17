// Sequência fixa de ciclos de feedback: 3 check-ins de onboarding (30/60/90
// dias, só depois que o colaborador chega em "Acompanhamento") e, depois
// disso, um ciclo recorrente pra sempre — semestral por padrão, anual pra
// cargos de liderança / quem já tem tempo de casa (regras abaixo). Usado tanto
// no gatilho de mudança de etapa do onboarding quanto na reconciliação ao
// abrir a tela de Feedback — por isso vive num util compartilhado, não
// duplicado.
import { parseDateInput } from "./date";

const CHECKIN_SEQUENCE = [
  { tipo: "30_dias", days: 30 },
  { tipo: "60_dias", days: 60 },
  { tipo: "90_dias", days: 90 },
];
const ADMISSAO_RECENTE_DIAS = 120;
const ONBOARDING_ORDER = ["documentacao", "integracao", "acompanhamento", "avaliacao", "concluido"];

// Cadências recorrentes possíveis. 'anual' é ancorada no aniversário de
// admissão (período fecha no aniversário, não em base+365 corrido).
const CADENCIAS = {
  semestral: { tipo: "semestral", days: 182, ancorarAniversario: false },
  anual:     { tipo: "anual",     days: 365, ancorarAniversario: true },
};

// Regras de cadência por cargo (Onda 2, item 5 — Áudio 5). Match por INCLUSÃO
// no cargo em minúsculas. Liderança avalia anualmente; o resto cai no default
// semestral (ou anual por tempo de casa, abaixo). RH ajusta esta lista aqui —
// se um dia precisar de edição por tela, vira uma tabela rh_avaliacao_regras.
const AVALIACAO_REGRAS_CARGO = [
  { match: "diretor",     cadencia: "anual" },
  { match: "gerente",     cadencia: "anual" },
  { match: "coordenador", cadencia: "anual" },
  { match: "supervisor",  cadencia: "anual" },
];
// A partir de 2 anos de casa, avaliação passa a ser anual mesmo sem cargo de
// liderança — reduz a carga de ciclos pra quadro já consolidado.
const TENURE_ANUAL_DIAS = 730;

export function addDaysISO(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

// Primeiro aniversário de admissão ESTRITAMENTE depois de afterISO (data-só,
// fuso local via parseDateInput). Base do ciclo anual ancorado no aniversário.
function proximoAniversarioISO(admissionDate, afterISO) {
  const adm = parseDateInput(admissionDate);
  const after = parseDateInput(afterISO);
  if (Number.isNaN(adm.getTime()) || Number.isNaN(after.getTime())) return null;
  let year = after.getFullYear();
  let cand = new Date(year, adm.getMonth(), adm.getDate());
  while (cand.getTime() <= after.getTime()) {
    year += 1;
    cand = new Date(year, adm.getMonth(), adm.getDate());
  }
  return `${cand.getFullYear()}-${String(cand.getMonth() + 1).padStart(2, "0")}-${String(cand.getDate()).padStart(2, "0")}`;
}

// Resolve a cadência recorrente de um colaborador a partir do cargo e do tempo
// de casa. Exportada pra a tela poder exibir "avaliado anualmente/semestralmente".
export function resolveCadenciaRecorrente(colaborador) {
  const cargo = (colaborador?.jobTitle || "").toLowerCase();
  const regra = AVALIACAO_REGRAS_CARGO.find((r) => cargo.includes(r.match));
  if (regra) return CADENCIAS[regra.cadencia];
  const admISO = colaborador?.admissionDate;
  const tenureDias = admISO ? (Date.now() - parseDateInput(admISO).getTime()) / 86400000 : 0;
  if (tenureDias >= TENURE_ANUAL_DIAS) return CADENCIAS.anual;
  return CADENCIAS.semestral;
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

  const cadencia = resolveCadenciaRecorrente(colaborador);
  // Anual ancora no aniversário de admissão; senão, base + dias corridos.
  const periodEnd = (cadencia.ancorarAniversario && colaborador.admissionDate)
    ? (proximoAniversarioISO(colaborador.admissionDate, base) || addDaysISO(base, cadencia.days))
    : addDaysISO(base, cadencia.days);
  if (new Date(periodEnd) > new Date()) return null;
  return { tipo: cadencia.tipo, periodStart: base, periodEnd };
}
