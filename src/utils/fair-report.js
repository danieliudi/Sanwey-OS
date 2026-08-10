// Relatório de feiras — fase 2, aprovada com o Daniel no mockup de Feiras e
// Budget (10/08/2026).
//
// Feira = campanha de canal "Evento" (o modelo que a plataforma já usava — é o
// mesmo canal que dispara o checklist de evento e a que a despesa já se liga
// por `marketing_expenses.campaign_id`). O que faltava era o outro lado do
// circuito: `leads.campaign_id`, aplicado nesta mesma entrega.
//
// Antes disso a origem era `trigger_label`, o nome digitado à mão a cada
// importação — "Intermodal 2026", "intermodal 26" e "Feira Intermodal" viravam
// três feiras distintas ao agregar. Nenhum número histórico era confiável.
//
// >>> A ARMADILHA QUE ESTE ARQUIVO EXISTE PRA EVITAR <<<
// Feira tem ciclo longo: um lead de feira pode fechar 8 meses depois. Comparar
// o retorno ACUMULADO da feira deste ano com o da feira do ano passado faz a
// nova parecer sempre pior, porque ela simplesmente teve menos tempo. A
// conclusão sai invertida — e "vale a pena continuar indo?" é exatamente a
// pergunta que o Daniel quer responder. Por isso toda comparação entre edições
// passa por `compareAtSameAge`, que corta as duas na MESMA idade em dias.

import { parseDateInput } from "./date";

// Etapas terminais do funil. `WON_STAGES` vive em constants/pipelines.js, mas
// aqui recebemos por parâmetro pra não acoplar o util a uma constante de
// domínio (e pra permitir que o chamador passe o conjunto do pipeline dele).
const DEFAULT_WON = ["ganho"];
const DEFAULT_LOST = ["perdido"];

function toTime(v) {
  if (!v) return null;
  const d = parseDateInput(v);
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
}

function num(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Data de referência de uma feira: quando ela aconteceu.
 * Usa a data de lançamento da campanha; sem ela, a de criação. É o marco zero
 * da "idade" da feira — todo o resto é medido a partir daqui.
 */
export function fairStartTime(campaign) {
  return toTime(campaign?.launchDate || campaign?.launch_date)
      ?? toTime(campaign?.createdAt || campaign?.created_at);
}

/** Idade da feira em dias corridos, do início até `now`. */
export function fairAgeDays(campaign, now = Date.now()) {
  const start = fairStartTime(campaign);
  if (start == null) return null;
  return Math.max(0, Math.floor((now - start) / 86400000));
}

/**
 * Métricas de uma feira.
 *
 * `maxAgeDays` é o coração da comparação justa: quando informado, só conta
 * leads captados e negócios ganhos DENTRO dos primeiros N dias após a feira.
 * Sem ele, conta tudo (retrato atual).
 */
export function computeFairMetrics({
  campaign,
  leads = [],
  expenses = [],
  wonStages = DEFAULT_WON,
  lostStages = DEFAULT_LOST,
  maxAgeDays = null,
  now = Date.now(),
}) {
  const start = fairStartTime(campaign);
  const cutoff = maxAgeDays != null && start != null
    ? start + maxAgeDays * 86400000
    : null;

  // Custo: despesas ligadas à campanha. É o vínculo que já existia antes desta
  // entrega — não depende de campaign_id no lead.
  const fairExpenses = expenses.filter(e => (e.campaignId || e.campaign_id) === campaign.id);
  const cost = fairExpenses.reduce((s, e) => s + num(e.amount), 0);

  // Leads: agora por chave estável, não por texto livre.
  let fairLeads = leads.filter(l => (l.campaignId || l.campaign_id) === campaign.id);

  // Recorte por idade — o lead precisa ter sido captado dentro da janela.
  if (cutoff != null) {
    fairLeads = fairLeads.filter(l => {
      const t = toTime(l.negotiationStartedAt || l.createdAt || l.created_at);
      return t == null ? true : t <= cutoff;
    });
  }

  const wonSet = new Set(wonStages);
  const lostSet = new Set(lostStages);

  const won = fairLeads.filter(l => {
    if (!wonSet.has(l.stage)) return false;
    if (cutoff == null) return true;
    // Ganho precisa ter acontecido dentro da janela, senão a feira nova é
    // comparada com o acumulado de anos da antiga.
    const t = toTime(l.stageChangedAt || l.updatedAt || l.updated_at);
    return t == null ? true : t <= cutoff;
  });
  const lost = fairLeads.filter(l => lostSet.has(l.stage));
  const open = fairLeads.filter(l => !wonSet.has(l.stage) && !lostSet.has(l.stage));

  const revenue = won.reduce((s, l) => s + num(l.value), 0);
  const decided = won.length + lost.length;

  return {
    campaign,
    ageDays: fairAgeDays(campaign, now),
    windowDays: maxAgeDays,
    cost,
    expenseCount: fairExpenses.length,
    leadCount: fairLeads.length,
    wonCount: won.length,
    lostCount: lost.length,
    openCount: open.length,
    revenue,
    // Custo por lead captado. null quando não houve lead — evita "R$ Infinity".
    costPerLead: fairLeads.length > 0 ? cost / fairLeads.length : null,
    // CAC da feira: custo dividido por clientes efetivamente conquistados.
    cac: won.length > 0 ? cost / won.length : null,
    // Conversão sobre o que já foi DECIDIDO (ganho+perdido), não sobre o total
    // — negócio ainda aberto não é fracasso, e incluí-lo puniria a feira nova.
    conversion: decided > 0 ? won.length / decided : null,
    // Retorno sobre o investido. null quando não houve custo registrado, pra
    // não exibir retorno infinito de uma feira sem despesa lançada.
    roi: cost > 0 ? revenue / cost : null,
  };
}

/** Métricas de várias feiras, ordenadas da mais recente pra mais antiga. */
export function computeAllFairMetrics({ campaigns = [], leads = [], expenses = [], ...rest }) {
  return campaigns
    .map(c => computeFairMetrics({ campaign: c, leads, expenses, ...rest }))
    .sort((a, b) => (fairStartTime(b.campaign) ?? 0) - (fairStartTime(a.campaign) ?? 0));
}

/**
 * Compara duas edições de feira de forma justa: corta as duas na idade da mais
 * NOVA. Sem isso, a edição recente sempre perde — ela teve menos tempo pra
 * maturar, não necessariamente menos resultado.
 *
 * Devolve `{ current, previous, windowDays, fair }`, onde `fair` diz se a
 * comparação é confiável (a antiga precisa ter pelo menos a idade da nova).
 */
export function compareAtSameAge({ current, previous, leads = [], expenses = [], now = Date.now(), ...rest }) {
  const curAge = fairAgeDays(current, now);
  const prevAge = fairAgeDays(previous, now);
  if (curAge == null || prevAge == null) return null;

  const windowDays = Math.min(curAge, prevAge);

  return {
    windowDays,
    // Se a "anterior" for na verdade mais nova que a atual, a comparação não
    // tem sentido — quem chama deve esconder em vez de mostrar número torto.
    fair: prevAge >= curAge,
    current: computeFairMetrics({ campaign: current, leads, expenses, maxAgeDays: windowDays, now, ...rest }),
    previous: computeFairMetrics({ campaign: previous, leads, expenses, maxAgeDays: windowDays, now, ...rest }),
  };
}

/** Variação percentual entre dois números, tolerando zero/null. */
export function deltaPct(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return (current - previous) / previous;
}

export default {
  fairStartTime,
  fairAgeDays,
  computeFairMetrics,
  computeAllFairMetrics,
  compareAtSameAge,
  deltaPct,
};
