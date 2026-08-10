import { parseDateInput } from "./date";

// ── Categoria de sistema ─────────────────────────────────────────────────────
// Quando uma compra (marketing_purchase_requests) entra na etapa "pago", o
// trigger marketing_purchase_requests_sync_expense cria sozinho uma linha em
// marketing_expenses com EXATAMENTE esta categoria (verificado no corpo do
// trigger, não é palpite). É por isso que "Compra de Marketing" precisa existir
// em EXPENSE_CATEGORIES: sem ela, todo dinheiro de compra paga ficaria invisível
// pro teto por categoria.
export const PURCHASE_BUDGET_CATEGORY = "Compra de Marketing";

// ── As 3 faixas de dinheiro ──────────────────────────────────────────────────
// PAGO e A PAGAR saem de marketing_expenses (status 'pago' / 'pendente' — a
// CHECK da coluna só aceita esses dois). COMPROMETIDO sai das compras que já
// foram aprovadas mas ainda não viraram despesa.
//
// >>> A regra que torna as faixas disjuntas é `expense_id IS NULL`, NÃO a
//     exclusão da etapa 'pago'. <<<
// No instante em que a compra vira 'pago', o trigger citado acima cria a
// despesa correspondente (status='pago', amount=total_value) e grava o
// `expense_id` de volta na compra. Contar essa compra também como
// "comprometido" faria O MESMO DINHEIRO aparecer duas vezes no total contra o
// teto — por isso `isCommittedPurchase` recusa toda compra que já tenha
// `expense_id`, em QUALQUER etapa. Essa é a guarda real da contagem dupla.
//
// A primeira versão desta feature excluía a etapa 'pago' inteira, o que abria
// um buraco oposto: a despesa gerada pelo trigger é uma linha comum e pode ser
// excluída pela UI (a FK é ON DELETE SET NULL, então a compra fica 'pago' com
// expense_id NULL). Nesse estado o dinheiro sumia das TRÊS faixas. Hoje a
// compra paga sem despesa volta pro comprometido — e a guarda de `expense_id`
// garante que ela nunca conte junto com a despesa.
//
// 'solicitado'/'cotacao' ficam de fora por outro motivo: ainda não há
// compromisso financeiro (nem valor aprovado nem fornecedor fechado).
// 'rejeitado' idem — nunca vira dinheiro.
export const PURCHASE_COMMITTED_STAGES = [
  "aprovado",
  "pedido_fornecedor",
  "entrega_parcial",
  "entregue",
];

// Limiares do semáforo do teto: <80% ok, 80–100% atenção, >100% estourado.
export const BUDGET_WARN_RATIO = 0.8;

// ── Regra de data unificada ──────────────────────────────────────────────────
// Ano fiscal de uma linha = ano da data da fatura quando existir, senão o
// vencimento. É a regra que DespesasView.jsx já usava no filtro "Ano";
// MarketingDashboardView usava createdAt (data de digitação), o que jogava uma
// nota de dezembro lançada em janeiro no ano errado. Este helper é a fonte
// única — os três lugares (Despesas, Dashboard de Marketing, Painel Executivo)
// passam a chamá-lo.

// Vencimento e data de nota são DIA DE CALENDÁRIO, nunca instante — e chegam
// em dois formatos diferentes: marketing_expenses.due_date é `timestamptz`,
// marketing_purchase_requests.due_date é `date`, e o trigger de sincronização
// converte uma na outra com o fuso do SERVIDOR (UTC), gravando meia-noite UTC.
// Lida como instante em BRT (UTC-3), meia-noite UTC volta um dia — e num 1º de
// janeiro volta um ANO inteiro (a compra de 2026 cairia no teto de 2025).
// Cortar em 10 caracteres colapsa tanto o "00:00+00" do trigger quanto o
// "03:00+00" que a UI grava (meia-noite local) no mesmo dia correto, e o que
// sobra ("AAAA-MM-DD") é justamente o formato que parseDateInput trata como
// data LOCAL — continua sem nenhum `new Date(string)` cru.
function calendarDay(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  const s = String(raw);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : s;
}

function fiscalYearOf(rawDate) {
  if (!rawDate) return null;
  const d = parseDateInput(rawDate);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

// Aceita tanto o formato camelCase dos hooks (invoiceDate/dueDate) quanto a
// linha crua do PostgREST (invoice_date/due_date) — barato de suportar e evita
// um retorno null silencioso se alguém passar o row antes do map.
function invoiceOrDueDate(record) {
  if (!record) return null;
  return calendarDay(
    record.invoiceDate || record.invoice_date ||
    record.dueDate     || record.due_date     ||
    null
  );
}

export function expenseFiscalYear(expense) {
  return fiscalYearOf(expenseFiscalDate(expense));
}

// Mesma regra do helper acima, exposta como DATA em vez de ano — quem agrupa
// por mês (burn rate, "despesas no mês" do Painel Executivo) precisa do dia,
// não só do ano, e não pode ter uma segunda regra de data pra isso.
// Sem invoice_date nem due_date devolve null: a linha não tem posição no
// calendário fiscal. Isso NÃO é um descarte silencioso — `computeBudgetGaps`
// devolve essas linhas num bucket próprio pra tela avisar quanto dinheiro está
// fora de qualquer ano (era exatamente o buraco que engolia a despesa gerada
// por uma compra paga sem "Prazo desejado" preenchido).
export function expenseFiscalDate(expense) {
  return invoiceOrDueDate(expense);
}

// COMPRA usa um critério deliberadamente DIFERENTE da despesa, e a diferença
// é obrigatória: a faixa "comprometido" existe pra mostrar dinheiro travado
// ANTES de virar nota, então nos estágios que a compõem ('aprovado',
// 'pedido_fornecedor') invoice_date é normalmente null — e "Prazo desejado"
// (due_date) é opcional no formulário de Compras. Com o critério da despesa,
// uma compra de R$ 120 mil aprovada sem prazo não caía em ano nenhum e o teto
// aparecia saudável. `created_at` sempre existe e é o momento em que o
// compromisso nasceu, então serve de último recurso — nunca descartar.
export function purchaseFiscalDate(purchase) {
  if (!purchase) return null;
  return invoiceOrDueDate(purchase) || purchase.createdAt || purchase.created_at || null;
}

export function purchaseFiscalYear(purchase) {
  return fiscalYearOf(purchaseFiscalDate(purchase));
}

// ── Escopo por empresa ───────────────────────────────────────────────────────
function asIds(value) {
  return Array.isArray(value) ? value : [];
}

function recordCompanyIds(record) {
  return asIds(record?.companyIds ?? record?.company_ids);
}

function budgetCompanyIds(budget) {
  return asIds(budget?.companyIds ?? budget?.company_ids);
}

// Escopo do FILTRO da tela ("Todas as empresas" = lista vazia): vazio não
// restringe nada. Mesmo predicado que a tabela de Despesas usa.
function matchesFilter(recordIds, scope) {
  if (scope.length === 0) return true;
  return recordIds.some(id => scope.includes(id));
}

// Escopo do TETO é assimétrico ao do filtro, de propósito — os dois lados
// significam coisas diferentes:
//
// • Teto sem empresa NÃO é curinga. A RLS de marketing_budgets exige
//   `company_ids && current_user_companies()`, e no Postgres '{}' && qualquer
//   coisa é FALSE: um teto de array vazio é impossível de criar por gerente de
//   marketing e invisível pro time inteiro se um admin criar. Tratá-lo como
//   "vale pra todas" aqui faria o cliente e o banco discordarem justamente
//   nesse ponto, e somaria a MESMA despesa no teto do Grupo e no teto por
//   empresa (mesmo dinheiro contado duas vezes). O formulário passou a exigir
//   ao menos uma empresa; um teto legado sem empresa não acompanha nada e a
//   tela o marca com aviso, em vez de mostrar um número inflado.
//
// • Registro sem empresa também não casa com teto nenhum. Ele iria pra TODOS
//   os tetos por empresa ao mesmo tempo, e divergiria da própria tabela da
//   tela, que exclui essas linhas quando há filtro de empresa. Esse dinheiro
//   aparece no bucket `outOfScope` de `computeBudgetGaps`.
function matchesBudget(recordIds, budgetIds) {
  if (budgetIds.length === 0 || recordIds.length === 0) return false;
  return recordIds.some(id => budgetIds.includes(id));
}

function budgetPeriodYear(budget) {
  const y = budget?.periodYear ?? budget?.period_year;
  return y == null ? null : Number(y);
}

function budgetAmount(budget) {
  const n = Number(budget?.amount ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function numeric(value) {
  // PostgREST serializa `numeric` como string ("380") pra preservar precisão.
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

// Chave de deduplicação: o id do registro quando existe; senão o próprio
// objeto (Set aceita referência) — nunca dois registros distintos colapsando
// num só por acidente.
function dedupKey(record) {
  return record?.id ?? record;
}

// amount = 0 é teto degenerado (a CHECK do banco aceita >= 0) — nunca dividir
// por zero. Sem teto, qualquer gasto já é estouro; sem gasto nenhum continua
// em 0%.
function ratioAndStatus(total, amount) {
  const pct = amount > 0 ? total / amount : (total > 0 ? 1 : 0);
  let status;
  if (amount <= 0) status = total > 0 ? "estourado" : "ok";
  else if (pct > 1) status = "estourado";
  else if (pct >= BUDGET_WARN_RATIO) status = "atencao";
  else status = "ok";
  return { pct, status };
}

/** Semáforo a partir de uma razão já calculada (consumido/teto), pros lugares
 *  que medem só o consumido em vez do total contra o teto. 3ª ocorrência dos
 *  mesmos dois limiares escritos à mão (Despesas, Dashboard, Executivo) —
 *  extraído pela regra 4 do CLAUDE.md. */
export function budgetRatioStatus(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  return ratioAndStatus(ratio, 1).status;
}

/** Rótulo de porcentagem do teto.
 *
 *  Sai do MESMO número que decide a cor. Com `Math.round`, 79,6% imprimia
 *  "80%" em cinza neutro (status ainda "ok") e 100,4% imprimia "100%" já em
 *  vermelho — rótulo e cor discordando justamente na borda que interessa.
 *  `Math.floor` garante que "80%" só aparece quando o semáforo já virou
 *  atenção; e um estouro que arredondaria pra 100% vira "100%+", em vez de
 *  fingir que bateu o teto cravado. */
export function formatBudgetPct(pct, status) {
  const n = Number(pct);
  const floor = Math.floor((Number.isFinite(n) ? n : 0) * 100);
  if (status === "estourado" && floor <= 100) return "100%+";
  return `${floor}%`;
}

/** Uma compra entra no comprometido quando já é compromisso financeiro E ainda
 *  não virou despesa. Ver o comentário de PURCHASE_COMMITTED_STAGES: 'pago'
 *  entra na conta, porque a guarda contra contagem dupla é `expense_id`, não a
 *  etapa — compra paga cuja despesa foi excluída à mão continua sendo dinheiro
 *  comprometido de verdade. */
export function isCommittedPurchase(purchase) {
  const stage = purchase?.stage;
  if (stage !== "pago" && !PURCHASE_COMMITTED_STAGES.includes(stage)) return false;
  return !(purchase?.expenseId || purchase?.expense_id);
}

/**
 * Uso do teto, um item por budget.
 *
 * @param {object[]} budgets   linhas de marketing_budgets (camelCase ou cruas)
 * @param {object[]} expenses  despesas de marketing (useMarketingExpenses)
 * @param {object[]} purchases compras de marketing (useMarketingPurchaseRequests)
 * @param {number}   [year]    ano fiscal; quando omitido, cada budget usa o
 *                             próprio periodYear
 * @param {string[]} [companyIds] escopo extra de empresa (o filtro da tela);
 *                             vazio = sem restrição
 *
 * Cada item devolve, além dos números, `matchedExpenses`/`matchedPurchases` —
 * a lista de registros que entraram naquela barra. Não é enfeite: um mesmo
 * registro multi-empresa bate legitimamente em mais de um teto, e é só com
 * essas listas que `computeBudgetTotals` consegue somar o dinheiro UMA vez.
 */
export function computeBudgetUsage({
  budgets = [],
  expenses = [],
  purchases = [],
  year = null,
  companyIds = [],
} = {}) {
  const targetYear = year == null ? null : Number(year);
  const scope = asIds(companyIds);

  return (budgets || [])
    .filter(b => (targetYear == null || budgetPeriodYear(b) === targetYear))
    .filter(b => matchesFilter(budgetCompanyIds(b), scope))
    .map(budget => {
      const bCompanies = budgetCompanyIds(budget);
      const bYear = targetYear ?? budgetPeriodYear(budget);
      const amount = budgetAmount(budget);

      const inScope = (ids) => matchesBudget(ids, bCompanies) && matchesFilter(ids, scope);

      // Faixas 1 e 2 — dinheiro que já é despesa registrada.
      const matchedExpenses = [];
      let paid = 0;
      let pending = 0;
      for (const e of expenses || []) {
        if (e?.category !== budget.category) continue;
        if (e.status !== "pago" && e.status !== "pendente") continue;
        if (bYear != null && expenseFiscalYear(e) !== bYear) continue;
        if (!inScope(recordCompanyIds(e))) continue;
        const value = numeric(e.amount);
        if (e.status === "pago") paid += value;
        else pending += value;
        matchedExpenses.push({ key: dedupKey(e), value, status: e.status });
      }

      // Faixa 3 — comprometido. Só faz sentido pra categoria que as compras
      // alimentam: a compra não tem coluna `category`, ela sempre desemboca em
      // "Compra de Marketing" (é o que o trigger grava na despesa gerada).
      const matchedPurchases = [];
      let committed = 0;
      if (budget.category === PURCHASE_BUDGET_CATEGORY) {
        for (const p of purchases || []) {
          if (!isCommittedPurchase(p)) continue;
          if (bYear != null && purchaseFiscalYear(p) !== bYear) continue;
          if (!inScope(recordCompanyIds(p))) continue;
          const value = numeric(p.totalValue ?? p.total_value);
          committed += value;
          matchedPurchases.push({ key: dedupKey(p), value });
        }
      }

      const consumed = paid + pending;
      const total = consumed + committed;
      const { pct, status } = ratioAndStatus(total, amount);

      return {
        budget, paid, pending, committed, consumed, total, pct, status,
        matchedExpenses, matchedPurchases,
      };
    });
}

/**
 * Agregado do ano — mesmo vocabulário de uma linha, trocando `budget` por
 * `budgetAmount`/`count`, pra faixa de resumo (StatCard) reaproveitar a mesma
 * leitura.
 *
 * O dinheiro é somado por REGISTRO, nunca somando as barras: a UNIQUE
 * (company_ids, category, period_year) permite de propósito dois tetos com
 * escopos que se sobrepõem ("Agência 2026 — Indústria" e "Agência 2026 —
 * Resibag"), e uma despesa lançada pras duas empresas conta legitimamente
 * contra os dois tetos. Cada barra continua certa; somar as barras é que
 * inventava dinheiro (R$ 5.500 de despesa virando R$ 11.000 de "Consumido",
 * com a tabela ao lado mostrando o valor certo).
 *
 * `budgetAmount` continua sendo a soma dos tetos exibidos — dois tetos são
 * dois limites independentes, não há rateio a fazer. Por isso "Consumido"
 * (dinheiro real, contado uma vez) pode ser menor que a soma das barras.
 */
export function computeBudgetTotals(usages = []) {
  const seenExpense = new Set();
  const seenPurchase = new Set();
  let budgetTotal = 0;
  let paid = 0;
  let pending = 0;
  let committed = 0;

  for (const u of usages || []) {
    budgetTotal += budgetAmount(u.budget);
    for (const m of u.matchedExpenses || []) {
      if (seenExpense.has(m.key)) continue;
      seenExpense.add(m.key);
      if (m.status === "pago") paid += m.value;
      else pending += m.value;
    }
    for (const m of u.matchedPurchases || []) {
      if (seenPurchase.has(m.key)) continue;
      seenPurchase.add(m.key);
      committed += m.value;
    }
  }

  const consumed = paid + pending;
  const total = consumed + committed;
  const { pct, status } = ratioAndStatus(total, budgetTotal);

  return {
    budgetAmount: budgetTotal,
    paid, pending, committed, consumed, total, pct, status,
    count: (usages || []).length,
  };
}

/**
 * O que ficou FORA das barras — o contrapeso honesto do agregado acima.
 *
 * Três formas de um gasto real não aparecer em teto nenhum, todas silenciosas
 * antes deste helper existir:
 *  • `undated`    — despesa sem data de nota E sem vencimento: não pertence a
 *                   ano nenhum (as duas colunas são nullable e o formulário não
 *                   exige nenhuma das duas).
 *  • `noBudget`   — a categoria não tem teto cadastrado no ano.
 *  • `outOfScope` — a categoria tem teto, mas a empresa da despesa não bate com
 *                   o escopo de nenhum deles (inclui despesa sem empresa).
 *
 * Buckets são mutuamente exclusivos, nessa ordem de prioridade — uma linha
 * aparece uma vez só, no problema mais grave que ela tem.
 */
export function computeBudgetGaps({
  budgets = [],
  expenses = [],
  purchases = [],
  year = null,
  companyIds = [],
} = {}) {
  const targetYear = year == null ? null : Number(year);
  const scope = asIds(companyIds);

  const scopesByCategory = new Map();
  for (const b of budgets || []) {
    if (targetYear != null && budgetPeriodYear(b) !== targetYear) continue;
    const list = scopesByCategory.get(b.category) || [];
    list.push(budgetCompanyIds(b));
    scopesByCategory.set(b.category, list);
  }

  const undated    = { amount: 0, count: 0 };
  const noBudget   = { amount: 0, count: 0, categories: [] };
  const outOfScope = { amount: 0, count: 0 };
  const categorySet = new Set();

  const classify = (categoryScopes, ids, value, category) => {
    if (!categoryScopes) {
      noBudget.amount += value;
      noBudget.count += 1;
      categorySet.add(category);
      return;
    }
    if (!categoryScopes.some(bIds => matchesBudget(ids, bIds))) {
      outOfScope.amount += value;
      outOfScope.count += 1;
    }
  };

  for (const e of expenses || []) {
    if (e?.status !== "pago" && e?.status !== "pendente") continue;
    const ids = recordCompanyIds(e);
    if (!matchesFilter(ids, scope)) continue;
    const value = numeric(e.amount);
    const y = expenseFiscalYear(e);
    if (y == null) {
      undated.amount += value;
      undated.count += 1;
      continue;
    }
    if (targetYear != null && y !== targetYear) continue;
    classify(scopesByCategory.get(e.category), ids, value, e.category);
  }

  // Compra comprometida sem teto de "Compra de Marketing" no ano: o StatCard
  // "Comprometido" mostraria R$ 0 com dinheiro travado de verdade lá fora.
  // (Compra nunca cai em `undated` — purchaseFiscalDate tem fallback pra
  // created_at.)
  for (const p of purchases || []) {
    if (!isCommittedPurchase(p)) continue;
    const ids = recordCompanyIds(p);
    if (!matchesFilter(ids, scope)) continue;
    if (targetYear != null && purchaseFiscalYear(p) !== targetYear) continue;
    classify(
      scopesByCategory.get(PURCHASE_BUDGET_CATEGORY),
      ids,
      numeric(p.totalValue ?? p.total_value),
      PURCHASE_BUDGET_CATEGORY,
    );
  }

  noBudget.categories = Array.from(categorySet);
  return { undated, noBudget, outOfScope };
}

// Token de cor por status — centralizado aqui pra os consumidores não decidirem
// cor por conta própria. NUNCA --accent pra estouro: --accent muda por frente
// comercial em runtime (ficaria verde na Resibag), então não sinaliza erro.
//
// `atencao.color` é --warning, não --amber: no tema claro --amber (#E8920A)
// sobre --surface (#FFFFFF) dá 2,46:1, abaixo até do mínimo de texto grande —
// e este token é usado como cor de TEXTO em 3 pontos (faixa de saúde do
// Executivo, linha de status da barra, tile do Dashboard). --warning (#B45309)
// dá ~5:1 no claro e é o MESMO #FBBF24 no escuro, então nada muda lá.
// `atencao.bg` continua --amber-bg pros casos com fundo tintado (o badge de %),
// onde o par bg+color já resolvia o contraste.
export const BUDGET_STATUS_STYLE = {
  ok:        { color: "var(--accent)",  bg: "var(--surface-alt)", label: "Dentro do teto" },
  atencao:   { color: "var(--warning)", bg: "var(--amber-bg)",    label: "Perto do teto" },
  estourado: { color: "var(--danger)",  bg: "var(--danger-bg)",   label: "Teto estourado" },
};
