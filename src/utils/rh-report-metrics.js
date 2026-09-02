// Catálogo de métricas do relatório configurável de RH (reunião com o RH,
// 20/07): "quero que todo tipo de dado coletável possa ser exportado... por
// exemplo headcount, turnover e tempo de contratação. Ou só um deles, ou
// mais do que isso." Cada métrica sabe montar sua própria seção de linhas
// (header + dados) a partir dos datasets brutos já carregados pelas telas de
// RH — o relatório final é a concatenação das seções escolhidas num único
// CSV (várias tabelas, separadas por linha em branco + título).
import { csvRow, formatDate } from "./export-csv";
import { formatBRL } from "./currency";

const DAY_MS = 86400000;

function diasEntre(a, b) {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((db - da) / DAY_MS);
}

function contagemPorChave(items, keyFn, labelSeNulo = "—") {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it) || labelSeNulo;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

// ── Cada métrica: { id, label, categoria, compute(datasets) => {title, rows} } ──
// `rows[0]` é sempre o header. `datasets` traz tudo já carregado pela tela
// (ver RHRelatoriosView): colaboradores, vagas, aplicacoes, ferias,
// avaliacoes, treinamentos, atribuicoes, movimentacoes, fornecedores,
// contratos.

export const RH_REPORT_METRICS = [
  {
    id: "headcount_departamento",
    label: "Headcount por departamento",
    categoria: "Headcount",
    compute({ colaboradores }) {
      const ativos = colaboradores.filter((c) => c.employeeStatus === "ativo");
      const rows = contagemPorChave(ativos, (c) => c.department);
      return { title: "Headcount por departamento", rows: [["Departamento", "Colaboradores ativos"], ...rows.map(([k, v]) => [k, v])] };
    },
  },
  {
    id: "headcount_frente",
    label: "Headcount por frente/unidade",
    categoria: "Headcount",
    compute({ colaboradores }) {
      const ativos = colaboradores.filter((c) => c.employeeStatus === "ativo");
      const rows = contagemPorChave(ativos, (c) => c.frente);
      return { title: "Headcount por frente", rows: [["Frente", "Colaboradores ativos"], ...rows.map(([k, v]) => [k, v])] };
    },
  },
  {
    id: "headcount_cargo",
    label: "Headcount por cargo",
    categoria: "Headcount",
    compute({ colaboradores }) {
      const ativos = colaboradores.filter((c) => c.employeeStatus === "ativo");
      const rows = contagemPorChave(ativos, (c) => c.jobTitle);
      return { title: "Headcount por cargo", rows: [["Cargo", "Colaboradores ativos"], ...rows.map(([k, v]) => [k, v])] };
    },
  },
  {
    id: "headcount_contrato",
    label: "Headcount por tipo de contrato",
    categoria: "Headcount",
    compute({ colaboradores }) {
      const ativos = colaboradores.filter((c) => c.employeeStatus === "ativo");
      const rows = contagemPorChave(ativos, (c) => c.contractType);
      return { title: "Headcount por tipo de contrato", rows: [["Tipo de contrato", "Colaboradores ativos"], ...rows.map(([k, v]) => [k, v])] };
    },
  },
  {
    id: "headcount_detalhado",
    label: "Headcount — lista detalhada",
    categoria: "Headcount",
    compute({ colaboradores }) {
      const ativos = colaboradores.filter((c) => c.employeeStatus === "ativo");
      return {
        title: "Colaboradores ativos (detalhado)",
        rows: [
          ["Nome", "Cargo", "Departamento", "Frente", "Tipo de contrato", "Admissão", "Tempo de casa (dias)"],
          ...ativos.map((c) => [c.fullName, c.jobTitle || "", c.department || "", c.frente || "", c.contractType || "", formatDate(c.admissionDate), c.admissionDate ? diasEntre(c.admissionDate, new Date().toISOString()) : ""]),
        ],
      };
    },
  },
  {
    id: "turnover_geral",
    label: "Turnover geral (desligamentos)",
    categoria: "Turnover",
    compute({ colaboradores }) {
      const desligados = colaboradores.filter((c) => c.employeeStatus === "desligado" || c.employeeStatus === "inativo" || c.desligamentoDate);
      const ativos = colaboradores.filter((c) => c.employeeStatus === "ativo").length;
      // A guarda tem que ser sobre o DENOMINADOR, não sobre `ativos`. Numa
      // unidade fechada (todos desligados) `ativos` é 0, o denominador é 5,
      // e o antigo `ativos > 0 ? ... : "0"` reportava turnover ZERO onde a
      // verdade é 100%. Achado da rodada 2 da auditoria, 01/09/2026.
      const base = ativos + desligados.length;
      const taxa = base > 0 ? ((desligados.length / base) * 100).toFixed(1) : "—";
      return {
        title: "Turnover geral",
        rows: [
          ["Métrica", "Valor"],
          ["Colaboradores ativos", ativos],
          ["Desligamentos (histórico)", desligados.length],
          ["Taxa de turnover (%)", taxa],
        ],
      };
    },
  },
  {
    id: "turnover_motivo",
    label: "Desligamentos por motivo/tipo",
    categoria: "Turnover",
    compute({ colaboradores }) {
      const desligados = colaboradores.filter((c) => c.desligamentoDate);
      const porTipo = contagemPorChave(desligados, (c) => c.desligamentoTipo);
      return {
        title: "Desligamentos por tipo",
        rows: [["Tipo de desligamento", "Quantidade"], ...porTipo.map(([k, v]) => [k, v])],
      };
    },
  },
  {
    id: "turnover_detalhado",
    label: "Desligamentos — lista detalhada",
    categoria: "Turnover",
    compute({ colaboradores }) {
      const desligados = colaboradores.filter((c) => c.desligamentoDate);
      return {
        title: "Desligamentos (detalhado)",
        rows: [
          ["Nome", "Cargo", "Departamento", "Admissão", "Desligamento", "Tempo de casa (dias)", "Tipo", "Motivo"],
          ...desligados.map((c) => [c.fullName, c.jobTitle || "", c.department || "", formatDate(c.admissionDate), formatDate(c.desligamentoDate), c.admissionDate && c.desligamentoDate ? diasEntre(c.admissionDate, c.desligamentoDate) : "", c.desligamentoTipo || "", c.desligamentoMotivo || ""]),
        ],
      };
    },
  },
  {
    id: "tempo_contratacao",
    label: "Tempo de contratação (time-to-hire)",
    categoria: "Recrutamento",
    compute({ aplicacoes }) {
      const contratados = aplicacoes.filter((a) => a.hired_at);
      const tempos = contratados.map((a) => diasEntre(a.created_at, a.hired_at)).filter((d) => d != null && d >= 0);
      const media = tempos.length ? Math.round(tempos.reduce((s, d) => s + d, 0) / tempos.length) : null;
      return {
        title: "Tempo de contratação (time-to-hire)",
        rows: [
          ["Métrica", "Valor"],
          ["Candidatos contratados", contratados.length],
          ["Tempo médio até contratação (dias)", media ?? "—"],
        ],
      };
    },
  },
  {
    id: "tempo_preenchimento_vaga",
    label: "Tempo de preenchimento (time-to-fill)",
    categoria: "Recrutamento",
    compute({ vagas, aplicacoes }) {
      const vagasById = new Map(vagas.map((v) => [v.id, v]));
      const tempos = aplicacoes
        .filter((a) => a.hired_at && a.vaga_id)
        .map((a) => {
          const vaga = vagasById.get(a.vaga_id);
          return vaga?.approved_at ? diasEntre(vaga.approved_at, a.hired_at) : null;
        })
        .filter((d) => d != null && d >= 0);
      const media = tempos.length ? Math.round(tempos.reduce((s, d) => s + d, 0) / tempos.length) : null;
      return {
        title: "Tempo de preenchimento (time-to-fill)",
        rows: [
          ["Métrica", "Valor"],
          ["Vagas preenchidas com dado de aprovação", tempos.length],
          ["Tempo médio da aprovação até o aceite (dias)", media ?? "—"],
        ],
      };
    },
  },
  {
    id: "funil_recrutamento",
    label: "Funil de recrutamento por etapa",
    categoria: "Recrutamento",
    compute({ aplicacoes }) {
      const porEtapa = contagemPorChave(aplicacoes, (a) => a.etapa_pipeline);
      return { title: "Funil de recrutamento", rows: [["Etapa", "Candidatos"], ...porEtapa.map(([k, v]) => [k, v])] };
    },
  },
  {
    id: "vagas_status",
    label: "Vagas por status",
    categoria: "Recrutamento",
    compute({ vagas }) {
      const porStatus = contagemPorChave(vagas, (v) => v.status);
      return { title: "Vagas por status", rows: [["Status", "Vagas"], ...porStatus.map(([k, v]) => [k, v])] };
    },
  },
  {
    id: "ferias_resumo",
    label: "Férias — resumo (dias e aprovação)",
    categoria: "Férias",
    compute({ ferias }) {
      const diasPorSolicitacao = ferias.map((f) => diasEntre(f.start_date, f.end_date)).filter((d) => d != null && d >= 0);
      const totalDias = diasPorSolicitacao.reduce((s, d) => s + d + 1, 0); // +1: intervalo inclusivo (início e fim contam)
      const porStatus = contagemPorChave(ferias, (f) => f.status);
      const aprovadas = ferias.filter((f) => f.status === "aprovado").length;
      const decididas = ferias.filter((f) => f.status === "aprovado" || f.status === "recusado").length;
      const taxaAprovacao = decididas > 0 ? ((aprovadas / decididas) * 100).toFixed(1) : "—";
      return {
        title: "Férias — resumo",
        rows: [
          ["Métrica", "Valor"],
          ["Total de dias solicitados", totalDias],
          ["Taxa de aprovação (%)", taxaAprovacao],
          ...porStatus.map(([k, v]) => [`Solicitações — ${k}`, v]),
        ],
      };
    },
  },
  {
    id: "avaliacao_resumo",
    label: "Avaliação de desempenho — nota média e desfechos",
    categoria: "Avaliação",
    compute({ avaliacoes }) {
      const concluidas = avaliacoes.filter((a) => a.status === "concluido" && typeof a.final_rating === "number");
      const media = concluidas.length ? (concluidas.reduce((s, a) => s + a.final_rating, 0) / concluidas.length).toFixed(1) : "—";
      const porDesfecho = contagemPorChave(avaliacoes.filter((a) => a.desfecho), (a) => a.desfecho);
      return {
        title: "Avaliação de desempenho — resumo",
        rows: [
          ["Métrica", "Valor"],
          ["Avaliações concluídas", concluidas.length],
          ["Nota final média", media],
          ...porDesfecho.map(([k, v]) => [`Desfecho — ${k}`, v]),
        ],
      };
    },
  },
  {
    id: "treinamentos_conclusao",
    label: "Treinamentos — taxa de conclusão e NR",
    categoria: "Treinamentos",
    compute({ atribuicoes }) {
      const porStatus = contagemPorChave(atribuicoes, (a) => a.status);
      const concluidos = atribuicoes.filter((a) => a.status === "concluido").length;
      const taxa = atribuicoes.length > 0 ? ((concluidos / atribuicoes.length) * 100).toFixed(1) : "—";
      return {
        title: "Treinamentos — conclusão",
        rows: [
          ["Métrica", "Valor"],
          ["Taxa de conclusão (%)", taxa],
          ...porStatus.map(([k, v]) => [`Atribuições — ${k}`, v]),
        ],
      };
    },
  },
  {
    id: "movimentacoes_resumo",
    label: "Movimentação — volume e variação salarial",
    categoria: "Cargos e Salários",
    compute({ movimentacoes }) {
      const aprovadas = movimentacoes.filter((m) => m.status === "aprovado");
      const porTipo = contagemPorChave(aprovadas, (m) => m.tipo);
      // `> 0`, não `!= null`: uma efetivação/primeiro registro tem
      // salario_anterior = 0, e a divisão por ele mandava `Infinity` como
      // célula literal do CSV entregue ao RH.
      const comSalario = aprovadas.filter((m) => m.salario_anterior > 0 && m.salario_novo != null);
      const variacoes = comSalario.map((m) => (m.salario_novo - m.salario_anterior) / m.salario_anterior * 100);
      const mediaVariacao = variacoes.length ? (variacoes.reduce((s, v) => s + v, 0) / variacoes.length).toFixed(1) : "—";
      return {
        title: "Movimentação — resumo",
        rows: [
          ["Métrica", "Valor"],
          ["Movimentações aprovadas", aprovadas.length],
          ["Variação salarial média (%)", mediaVariacao],
          ...porTipo.map(([k, v]) => [`Tipo — ${k}`, v]),
        ],
      };
    },
  },
  {
    id: "fornecedores_contratos",
    label: "Fornecedores — contratos ativos e custo",
    categoria: "Fornecedores e Benefícios",
    compute({ contratos }) {
      const ativos = contratos.filter((c) => c.status === "ativo");
      const custoTotal = ativos.reduce((s, c) => s + (Number(c.valor) || 0), 0);
      return {
        title: "Fornecedores — contratos ativos",
        rows: [
          ["Métrica", "Valor"],
          ["Contratos ativos", ativos.length],
          ["Custo mensal somado (contratos com valor)", formatBRL(custoTotal)],
        ],
      };
    },
  },
];

export const RH_REPORT_CATEGORIAS = [...new Set(RH_REPORT_METRICS.map((m) => m.categoria))];

// Monta o CSV combinado a partir das métricas escolhidas — cada seção vem
// separada por uma linha de título + linha em branco, célula única do
// header do csvRow evita que o "## Título" seja confundido com dado.
export function buildRelatorioCSV(selectedIds, datasets) {
  const metrics = RH_REPORT_METRICS.filter((m) => selectedIds.includes(m.id));
  const blocks = metrics.map((m) => {
    const { title, rows } = m.compute(datasets);
    return [csvRow([`## ${title}`]), ...rows.map(csvRow)].join("\r\n");
  });
  return blocks.join("\r\n\r\n");
}
