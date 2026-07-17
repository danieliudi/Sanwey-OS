// Cálculos de datas de conformidade trabalhista (CLT) e lembretes de RH
// sobre o diretório de Funcionários. Tudo aqui é ESTIMATIVA informativa —
// não substitui confirmação com RH/jurídico, especialmente o aviso-prévio
// (Lei 12.506/2011), que tem regras de arredondamento e exceções que este
// cálculo simplifica.
import { parseDateInput } from "./date";

const DAY_MS = 86400000;

// Zera a hora (fuso local) antes de comparar — sem isso, `hoje = new Date()`
// (com hora corrente) contra uma data-só parseada como meia-noite fazia a
// contagem oscilar ±1 dia conforme o horário em que a tela era aberta.
function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a, b) {
  return Math.round((startOfLocalDay(b).getTime() - startOfLocalDay(a).getTime()) / DAY_MS);
}

// Período de experiência CLT: até 90 dias, normalmente dividido em dois
// ciclos de até 45 dias (Art. 445, parágrafo único). Só se aplica a
// contract_type "clt" com admissão recente.
//
// Se o colaborador tiver periodoExperienciaDias definido (RH informou um
// valor próprio no momento da contratação, em vez do padrão CLT 45+45),
// usa esse valor como marco único (fim do período) — sem os dois ciclos
// fixos, já que um valor customizado não necessariamente segue a mesma
// divisão. Sem esse campo (colaboradores antigos, ou não-CLT que ainda
// assim tenham contractType/admissionDate), cai no cálculo fixo de sempre.
export function periodoExperienciaInfo(colaborador, hoje = new Date()) {
  if (colaborador?.contractType !== "clt" || !colaborador?.admissionDate) return null;
  const admissao = parseDateInput(colaborador.admissionDate);
  const diasDecorridos = daysBetween(admissao, hoje);
  const custom = Number(colaborador.periodoExperienciaDias) || null;
  if (custom) {
    if (diasDecorridos < 0 || diasDecorridos > custom + 5) return null;
    return { diasDecorridos, marco: custom, diasRestantes: custom - diasDecorridos };
  }
  if (diasDecorridos < 0 || diasDecorridos > 95) return null;
  const marco = diasDecorridos <= 45 ? 45 : 90;
  return { diasDecorridos, marco, diasRestantes: marco - diasDecorridos };
}

// Aviso-prévio proporcional (Lei 12.506/2011): 30 dias + 3 dias por ano
// completo de casa, até o teto de 90 dias.
export function avisoPrevioEstimadoDias(admissionDate, desligamentoDate) {
  if (!admissionDate || !desligamentoDate) return null;
  const anos = Math.floor(daysBetween(parseDateInput(admissionDate), parseDateInput(desligamentoDate)) / 365);
  return Math.min(90, 30 + anos * 3);
}

export function asoDiasParaVencer(colaborador, hoje = new Date()) {
  if (!colaborador?.asoVencimento) return null;
  return daysBetween(hoje, parseDateInput(colaborador.asoVencimento));
}

export function contratoDiasParaFim(colaborador, hoje = new Date()) {
  if (!colaborador?.contratoFim) return null;
  return daysBetween(hoje, parseDateInput(colaborador.contratoFim));
}

// Jovem Aprendiz (Áudio 6): dias até o fim do contrato de aprendizagem.
// Coluna dedicada (aprendizFim) pra não colidir com o "contrato temporário".
// Só faz sentido pra quem é contractType "aprendiz"; o chamador filtra.
export function aprendizDiasParaFim(colaborador, hoje = new Date()) {
  if (!colaborador?.aprendizFim) return null;
  return daysBetween(hoje, parseDateInput(colaborador.aprendizFim));
}

// Vencimento de treinamento NR/obrigatório (Áudio 4): data_conclusao +
// validade_dias. data_conclusao é timestamptz (parseDateInput passa direto,
// sem risco de fuso). Retorna dias até vencer (negativo = já venceu), ou null
// se a atribuição não foi concluída ou o treinamento não tem validade.
export function treinamentoDiasParaVencer(atribuicao, treinamento, hoje = new Date()) {
  const validade = Number(treinamento?.validade_dias ?? treinamento?.validadeDias) || null;
  const conclusao = atribuicao?.data_conclusao ?? atribuicao?.dataConclusao;
  if (!validade || !conclusao) return null;
  const base = parseDateInput(conclusao);
  if (Number.isNaN(base.getTime())) return null;
  const vence = new Date(base.getFullYear(), base.getMonth(), base.getDate() + validade);
  return daysBetween(hoje, vence);
}

// Avaliação de desempenho devida (Áudio 5): dias até (ou desde) o fim do
// período de avaliação, enquanto ela não foi concluída. period_end é date-only.
export function avaliacaoDiasParaVencer(avaliacao, hoje = new Date()) {
  const fim = avaliacao?.period_end ?? avaliacao?.periodEnd;
  if (!fim) return null;
  const d = parseDateInput(fim);
  if (Number.isNaN(d.getTime())) return null;
  return daysBetween(hoje, d);
}

function isMesDiaProximo(dateStr, hoje, janelaDias) {
  if (!dateStr) return null;
  const d = parseDateInput(dateStr);
  const candidato = new Date(hoje.getFullYear(), d.getMonth(), d.getDate());
  let diff = daysBetween(hoje, candidato);
  if (diff < -1) diff += 365; // já passou este ano — considera o próximo
  return diff >= 0 && diff <= janelaDias ? diff : null;
}

export function diasParaAniversario(colaborador, hoje = new Date(), janelaDias = 3) {
  return isMesDiaProximo(colaborador?.birthDate, hoje, janelaDias);
}

// "Bodas de empresa" — só sinaliza a partir de 1 ano completo de casa.
export function diasParaBodasEmpresa(colaborador, hoje = new Date(), janelaDias = 3) {
  if (!colaborador?.admissionDate) return null;
  const anos = hoje.getFullYear() - parseDateInput(colaborador.admissionDate).getFullYear();
  if (anos < 1) return null;
  return isMesDiaProximo(colaborador.admissionDate, hoje, janelaDias);
}
