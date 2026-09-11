// Gerador de datas de recorrência (Programas, decidido com o Daniel em
// 11/09/2026).
//
// O ponto do desenho, que está no mockup aprovado: a recorrência **gera a
// lista de datas** e para por aí. Nada aqui fica guardado como regra viva —
// depois de gerada, cada data existe sozinha no banco, e dá pra apagar a do
// feriado, mudar o horário de uma só ou acrescentar uma fora do padrão sem
// desmontar o resto. Regra viva faria o contrário: toda edição de uma data
// isolada viraria exceção a manter pra sempre.
//
// Toda a aritmética é em data LOCAL ("AAAA-MM-DD" → componentes → Date local),
// nunca via `new Date("2026-09-15")`, que é meia-noite UTC e "volta" um dia em
// fuso negativo (BRT). Mesmo motivo de toLocalISODate em utils/date.js.
import { toLocalISODate } from "./date";

export const RECORRENCIA_TIPOS = [
  { id: "nenhuma",           label: "Não repete" },
  { id: "semanal",           label: "Toda semana, nos dias marcados" },
  { id: "quinzenal",         label: "A cada 2 semanas, nos dias marcados" },
  { id: "mensal_dia_semana", label: "Todo mês, no mesmo dia da semana" },
  { id: "cada_n_dias",       label: "A cada N dias" },
];

export const DIAS_SEMANA = [
  { id: 0, curto: "Dom", label: "domingo" },
  { id: 1, curto: "Seg", label: "segunda-feira" },
  { id: 2, curto: "Ter", label: "terça-feira" },
  { id: 3, curto: "Qua", label: "quarta-feira" },
  { id: 4, curto: "Qui", label: "quinta-feira" },
  { id: 5, curto: "Sex", label: "sexta-feira" },
  { id: 6, curto: "Sáb", label: "sábado" },
];

// Teto duro. Não é limite de produto — é o que impede um "a cada 1 dia até
// 2099" digitado sem querer virar 27 mil linhas no banco.
export const MAX_OCORRENCIAS = 60;

function dataLocal(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  const d = new Date(2000, 0, 1);
  d.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  return d;
}

function somaDias(d, n) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

// Qual ocorrência do mês é esta data: 1ª segunda, 3ª quinta… (1 a 5).
function ordinalNoMes(d) {
  return Math.floor((d.getDate() - 1) / 7) + 1;
}

/**
 * Gera as datas de um programa recorrente.
 *
 * @param {object} cfg
 * @param {string} cfg.inicio        "AAAA-MM-DD" — a primeira data, sempre incluída.
 * @param {string} cfg.tipo          um dos RECORRENCIA_TIPOS.
 * @param {number[]} cfg.diasSemana  0–6, para "semanal"/"quinzenal".
 * @param {number} cfg.intervaloDias para "cada_n_dias".
 * @param {string} [cfg.ate]         "AAAA-MM-DD" — limite por data.
 * @param {number} [cfg.ocorrencias] limite por contagem.
 * @returns {{datas: string[], truncado: boolean, motivo: string|null}}
 *   `truncado` diz que o teto cortou a lista — quem mostra isso na tela
 *   precisa dizer quantas ficaram de fora (CLAUDE.md regra 14: o que o filtro
 *   descarta aparece contado, não sumido).
 */
export function gerarDatasRecorrentes(cfg) {
  const inicio = dataLocal(cfg?.inicio);
  if (!inicio) return { datas: [], truncado: false, motivo: "sem_data_inicial" };

  const tipo = cfg?.tipo || "nenhuma";
  if (tipo === "nenhuma") return { datas: [cfg.inicio], truncado: false, motivo: null };

  const limiteData = dataLocal(cfg?.ate);
  const limiteCont = Number(cfg?.ocorrencias) > 0 ? Math.min(Number(cfg.ocorrencias), MAX_OCORRENCIAS) : MAX_OCORRENCIAS;

  const dias = Array.isArray(cfg?.diasSemana) && cfg.diasSemana.length
    ? [...new Set(cfg.diasSemana.map(Number))].sort((a, b) => a - b)
    : [inicio.getDay()];

  const datas = [];
  const empurra = (d) => {
    if (limiteData && d > limiteData) return false;
    const iso = toLocalISODate(d);
    if (!datas.includes(iso)) datas.push(iso);
    return datas.length < limiteCont;
  };

  if (tipo === "cada_n_dias") {
    const passo = Math.max(1, Number(cfg?.intervaloDias) || 1);
    let cursor = inicio;
    while (empurra(cursor)) cursor = somaDias(cursor, passo);
  } else if (tipo === "semanal" || tipo === "quinzenal") {
    const passoSemanas = tipo === "quinzenal" ? 2 : 1;
    // Âncora no domingo da semana da data inicial, pra que os dias marcados
    // saiam na ordem do calendário e a data inicial não fique fora quando ela
    // mesma é um dos dias marcados.
    let semana = somaDias(inicio, -inicio.getDay());
    let seguir = true;
    let voltas = 0;
    while (seguir && voltas < MAX_OCORRENCIAS * 2) {
      for (const dia of dias) {
        const d = somaDias(semana, dia);
        if (d < inicio) continue;
        if (!empurra(d)) { seguir = false; break; }
      }
      semana = somaDias(semana, 7 * passoSemanas);
      voltas += 1;
    }
  } else if (tipo === "mensal_dia_semana") {
    const alvoDia = inicio.getDay();
    const alvoOrdinal = ordinalNoMes(inicio);
    let mes = inicio.getMonth();
    let ano = inicio.getFullYear();
    let seguir = true;
    let voltas = 0;
    while (seguir && voltas < MAX_OCORRENCIAS * 2) {
      const primeiro = new Date(2000, 0, 1);
      primeiro.setFullYear(ano, mes, 1);
      primeiro.setHours(0, 0, 0, 0);
      const desloc = (alvoDia - primeiro.getDay() + 7) % 7;
      const d = somaDias(primeiro, desloc + (alvoOrdinal - 1) * 7);
      // O mês pode não ter uma 5ª segunda — aí esse mês simplesmente não tem
      // ocorrência, em vez de escorregar pro mês seguinte.
      if (d.getMonth() === mes && d >= inicio) {
        if (!empurra(d)) seguir = false;
      }
      mes += 1;
      if (mes > 11) { mes = 0; ano += 1; }
      voltas += 1;
    }
  } else {
    return { datas: [cfg.inicio], truncado: false, motivo: "tipo_desconhecido" };
  }

  datas.sort();
  // `truncado` é só quando o TETO cortou — pedir 6 ocorrências e receber 6 não
  // é truncar, e marcar isso faria a tela avisar de um corte que não houve.
  const truncado = datas.length >= MAX_OCORRENCIAS;
  return { datas, truncado, motivo: null };
}

// Frase curta pro resumo do formulário ("3 datas · 15/09 a 29/09").
export function resumoRecorrencia(datas) {
  if (!datas?.length) return "Nenhuma data";
  const n = datas.length;
  return `${n} data${n > 1 ? "s" : ""}`;
}
