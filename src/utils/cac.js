// CAC (Custo de Aquisição de Cliente) agregado — fase 1, aprovado com o
// Daniel via mockup (10/08/2026, Funil de Vendas). NÃO é por negócio
// individual — isso é fase 2, fora de escopo aqui. Fórmula:
//
//   CAC = (Σ despesas de viagem do período vinculadas ao vendedor
//           + Σ custo de amostras do período)
//         ÷ (nº de negócios com stage "ganho" no período)
//
// Despesas de viagem (`crm_viagem_despesas.valor`) só têm vínculo direto de
// VENDEDOR (`vendedor_id`, já denormalizado na própria linha da despesa —
// não precisa de join com `crm_viagem_registros` pra saber o vendedor), não
// de negócio/lead específico — por isso o agregado soma todas as despesas
// do(s) vendedor(es) em escopo no período, sem tentar casar despesa↔negócio
// 1:1 (decisão explícita da spec). Amostras (`lead_samples.cost`) já têm
// vínculo direto por `lead_id`, então dá pra escopar por um conjunto de
// leads quando o chamador tiver esse recorte (ex.: Funil de Vendas filtrado
// por vendedor/empresa).
//
// Usado em dois pontos — nunca duplicar esta lógica:
//   - KanbanAnalyticsPanel do Funil de Vendas (CRMView.jsx, aba Análise)
//   - ExecutiveDashboard.jsx (aba Comercial → Visão geral)

// `sent_at`/`data_despesa` são colunas `date` puras — `new Date("2026-08-10")`
// daria meia-noite UTC, comparada com um cutoff em ms LOCAL: amostra/despesa
// na fronteira do período entrava ou saía errado por até 3h (BRT). Ver
// parseDateInput.
import { parseDateInput } from "./date";

// Corte de período do CAC — fonte única (era uma função local do
// ExecutiveDashboard; o Funil de Vendas precisava do MESMO corte pros dois
// lados da divisão, então subiu pra cá em vez de virar 2ª cópia).
// `null` = sem recorte (todo o histórico).
export function periodCutoff(period) {
  if (period === "all" || period == null) return null;
  const now = Date.now();
  if (period === "30d") return now - 30 * 86400000;
  if (period === "60d") return now - 60 * 86400000;
  if (period === "90d") return now - 90 * 86400000;
  if (period === "ytd") return new Date(new Date().getFullYear(), 0, 1).getTime();
  return null;
}

// O texto tem que descrever a janela que a tela REALMENTE calcula: dizer
// "no período" numa tela sem recorte de período era mentira (achado de QA
// 10/08/2026 — o Funil somava despesa de 2 anos e dividia por negócios
// ganhos sem recorte nenhum, enquanto o Executivo aplicava o cutoff).
export function cacFormulaHint(period) {
  const janela = periodCutoff(period) == null ? "no histórico completo" : "no período selecionado";
  return `CAC = (despesas de viagem + custo de amostras) ÷ negócios ganhos ${janela}`;
}

function toTimestamp(value) {
  if (!value) return NaN;
  return parseDateInput(value).getTime();
}

// Soma `crm_viagem_despesas.valor` dentro do período, opcionalmente restrita
// a um conjunto de `vendedor_id` (Set). Sem `vendorIds`, some tudo que a RLS
// já deixou visível pro usuário atual (uso do Painel Executivo, onde o
// recorte é a empresa/grupo inteiro, não um vendedor específico).
export function sumTravelExpenses(despesas, { vendorIds, periodStart } = {}) {
  if (!Array.isArray(despesas)) return 0;
  let total = 0;
  for (const d of despesas) {
    if (vendorIds && !vendorIds.has(d.vendedor_id)) continue;
    if (periodStart != null) {
      const ts = toTimestamp(d.data_despesa);
      if (Number.isNaN(ts) || ts < periodStart) continue;
    }
    total += Number(d.valor) || 0;
  }
  return total;
}

// Soma `lead_samples.cost` dentro do período, opcionalmente restrita a um
// conjunto de `lead_id` (Set).
export function sumSampleCosts(samples, { leadIds, periodStart } = {}) {
  if (!Array.isArray(samples)) return 0;
  let total = 0;
  for (const s of samples) {
    if (leadIds && !leadIds.has(s.lead_id)) continue;
    if (periodStart != null) {
      const ts = toTimestamp(s.sent_at);
      if (Number.isNaN(ts) || ts < periodStart) continue;
    }
    total += Number(s.cost) || 0;
  }
  return total;
}

// CAC = null quando não há negócio ganho no escopo — divisão por zero é
// "sem dado pra calcular", não "custo zero". Exibir "R$ 0" nesse caso
// enganaria (pareceria que aquisição não custou nada).
export function calculateCAC({ travelExpensesTotal = 0, sampleCostsTotal = 0, wonCount = 0 } = {}) {
  if (!Number.isFinite(wonCount) || wonCount <= 0) return null;
  return (travelExpensesTotal + sampleCostsTotal) / wonCount;
}
