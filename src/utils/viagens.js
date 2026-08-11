// Helpers e mapas compartilhados entre as views de Viagens & Despesas
// (Planejamento, Gestor, Relatórios) — evita 3 cópias divergentes das
// mesmas regras de negócio (papéis comerciais, rótulos de status, etc).

import { formatDateBR } from "./date";

export const COMERCIAL_ROLES = new Set(["vendedor", "consultor", "gerente"]);

// Tipo de saída externa (decidido com o Daniel 11/08/2026) — "visita" é o
// comportamento original (única opção até aqui, por isso é o default no
// banco), "evento"/"outra" afrouxam a exigência de cliente vinculado. Destino
// e data continuam obrigatórios pros três: mesmo uma feira acontece num
// lugar, numa data.
export const TIPO_SAIDA = {
  visita: { label: "Visita a cliente", clienteObrigatorio: true },
  evento: { label: "Evento ou feira",  clienteObrigatorio: false },
  outra:  { label: "Outra saída",      clienteObrigatorio: false },
};

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthKeyOf(dateStr) {
  return dateStr ? String(dateStr).slice(0, 7) : null;
}

export function monthLabel(monthKey) {
  if (!monthKey) return "—";
  const [y, m] = monthKey.split("-").map(Number);
  const label = new Date(y, (m || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function fmtMoney(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const STATUS_VISITA = {
  planejado:     { label: "Planejado",     variant: "secondary" },
  realizado:     { label: "Realizado",     variant: "success" },
  nao_realizado: { label: "Não realizado", variant: "critical" },
  cancelado:     { label: "Cancelado",     variant: "neutral" },
};

export const STATUS_REEMBOLSO = {
  pendente:  { label: "Pendente",  variant: "urgent" },
  aprovado:  { label: "Aprovado",  variant: "success" },
  rejeitado: { label: "Rejeitado", variant: "critical" },
  pago:      { label: "Pago",      variant: "dark" },
};

// Prestação de contas — agrupa várias despesas pra decisão em lote (spec
// aprovada 10/08/2026, inspirada no "Relatório" do Zoho Expense; nome
// diferente de propósito pra não colidir com a aba "Relatórios" já
// existente, que é analítica/BI). Ver crm_viagem_prestacoes.
export const STATUS_PRESTACAO = {
  rascunho:  { label: "Rascunho",  variant: "neutral" },
  enviada:   { label: "Enviada",   variant: "urgent" },
  aprovada:  { label: "Aprovada",  variant: "success" },
  rejeitada: { label: "Rejeitada", variant: "critical" },
  parcial:   { label: "Parcial",   variant: "gold" },
  paga:      { label: "Paga",      variant: "dark" },
};

// Motor de divergência planejado × realizado × despesa — pedido do gerente
// comercial via Daniel (05/08/2026): cruzar automaticamente o que o vendedor
// disse que ia fazer com o que de fato foi lançado como despesa, sem
// depender de IA pra ser confiável (a análise por IA continua existindo à
// parte, um vendedor por vez, pra achados mais nebulosos que este cálculo
// direto não cobre). Usado em CRMViagensGestorView (mês único) e
// CRMViagensRelatoriosView (intervalo de meses) — mesma regra nos dois,
// por isso vive aqui em vez de duplicada.
//
// 3 tipos, nesta ordem de severidade:
// - sem_visita: despesa avulsa (sem registro_id) numa data sem nenhuma
//   visita do mesmo vendedor cobrindo — pode ser esquecimento de vincular,
//   ou o cenário que o gerente suspeita ("disse que não ia, mas gastou").
// - sumiu: visita ainda "planejado" com data já passada — vendedor mudou
//   os planos e não voltou pra registrar o desfecho.
// - estouro: despesas vinculadas à visita somam mais de 20% acima do valor
//   previsto (limiar recomendado no mockup aprovado — abaixo disso é
//   margem normal de erro de estimativa, não indício de problema).
export function computeViagemDivergencias(registros, despesas, today) {
  const out = [];

  const dataCobertaPorVendedor = new Set();
  (registros || []).forEach((r) => {
    if (r.data_planejada) dataCobertaPorVendedor.add(`${r.vendedor_id}|${r.data_planejada}`);
    if (r.data_realizada) dataCobertaPorVendedor.add(`${r.vendedor_id}|${r.data_realizada}`);
  });

  (despesas || []).forEach((d) => {
    if (!d.registro_id && !dataCobertaPorVendedor.has(`${d.vendedor_id}|${d.data_despesa}`)) {
      out.push({
        id: `sem-visita-${d.id}`,
        tipo: "sem_visita",
        severidade: "alta",
        vendedorId: d.vendedor_id,
        descricao: `Despesa de ${fmtMoney(d.valor)} em ${formatDateBR(d.data_despesa)} sem nenhuma visita planejada cobrindo essa data`,
      });
    }
  });

  (registros || []).forEach((r) => {
    if (r.status === "planejado" && r.data_planejada && r.data_planejada < today) {
      out.push({
        id: `sumiu-${r.id}`,
        tipo: "sumiu",
        severidade: "alta",
        vendedorId: r.vendedor_id,
        descricao: `Visita planejada pra ${formatDateBR(r.data_planejada)} (${r.destino_planejado}) nunca teve desfecho registrado`,
      });
    }
  });

  const totalPorRegistro = new Map();
  (despesas || []).forEach((d) => {
    if (d.registro_id) totalPorRegistro.set(d.registro_id, (totalPorRegistro.get(d.registro_id) || 0) + Number(d.valor || 0));
  });
  (registros || []).forEach((r) => {
    if (r.valor_previsto == null || r.valor_previsto <= 0) return;
    const total = totalPorRegistro.get(r.id) || 0;
    if (total > r.valor_previsto * 1.2) {
      const pct = Math.round((total / r.valor_previsto - 1) * 100);
      out.push({
        id: `estouro-${r.id}`,
        tipo: "estouro",
        severidade: "media",
        vendedorId: r.vendedor_id,
        descricao: `Previsto ${fmtMoney(r.valor_previsto)} pra visita em ${r.destino_planejado} · lançado ${fmtMoney(total)} em despesas vinculadas`,
        valorLabel: `+${pct}%`,
        valorExcedente: total - r.valor_previsto,
      });
    }
  });

  return out.sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === "alta" ? -1 : 1));
}
