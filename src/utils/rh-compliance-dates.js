// Cálculos de datas de conformidade trabalhista (CLT) e lembretes de RH
// sobre o diretório de Funcionários. Tudo aqui é ESTIMATIVA informativa —
// não substitui confirmação com RH/jurídico, especialmente o aviso-prévio
// (Lei 12.506/2011), que tem regras de arredondamento e exceções que este
// cálculo simplifica.

const DAY_MS = 86400000;

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

// Período de experiência CLT: até 90 dias, normalmente dividido em dois
// ciclos de até 45 dias (Art. 445, parágrafo único). Só se aplica a
// contract_type "clt" com admissão recente.
export function periodoExperienciaInfo(colaborador, hoje = new Date()) {
  if (colaborador?.contractType !== "clt" || !colaborador?.admissionDate) return null;
  const admissao = new Date(colaborador.admissionDate);
  const diasDecorridos = daysBetween(admissao, hoje);
  if (diasDecorridos < 0 || diasDecorridos > 95) return null;
  const marco = diasDecorridos <= 45 ? 45 : 90;
  return { diasDecorridos, marco, diasRestantes: marco - diasDecorridos };
}

// Aviso-prévio proporcional (Lei 12.506/2011): 30 dias + 3 dias por ano
// completo de casa, até o teto de 90 dias.
export function avisoPrevioEstimadoDias(admissionDate, desligamentoDate) {
  if (!admissionDate || !desligamentoDate) return null;
  const anos = Math.floor(daysBetween(new Date(admissionDate), new Date(desligamentoDate)) / 365);
  return Math.min(90, 30 + anos * 3);
}

export function asoDiasParaVencer(colaborador, hoje = new Date()) {
  if (!colaborador?.asoVencimento) return null;
  return daysBetween(hoje, new Date(colaborador.asoVencimento));
}

export function contratoDiasParaFim(colaborador, hoje = new Date()) {
  if (!colaborador?.contratoFim) return null;
  return daysBetween(hoje, new Date(colaborador.contratoFim));
}

function isMesDiaProximo(dateStr, hoje, janelaDias) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
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
  const anos = hoje.getFullYear() - new Date(colaborador.admissionDate).getFullYear();
  if (anos < 1) return null;
  return isMesDiaProximo(colaborador.admissionDate, hoje, janelaDias);
}
