// Sugestao de vinculo documento->colaborador pra upload em lote de
// holerite/ponto (RHFuncionariosView). 100% local (string matching no nome
// do arquivo) - nenhum conteudo de documento e lido por IA nem sai do
// navegador. RH sempre revisa e aprova/rejeita a sugestao antes do upload.

var COMBINING_DIACRITICS_RE = new RegExp(
  "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
  "g"
);

function onlyDigits(str) {
  return (str || "").replace(/\D/g, "");
}

function normalizeName(str) {
  return (str || "")
    .normalize("NFD").replace(COMBINING_DIACRITICS_RE, "")
    .toLowerCase()
    .replace(/\.(pdf|jpe?g|png|webp)$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\b(holerite|contracheque|folha|pagamento|ponto|registro|comprovante|espelho|frequencia|mes|referencia|ref|\d+)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Retorna { colaboradorId, colaboradorNome, confidence: "alta"|"media", basis: "cpf"|"nome" }
// ou null se nao achou sugestao segura o bastante.
export function matchDocumentToColaborador(fileName, colaboradores) {
  const digits = onlyDigits(fileName);
  if (digits.length >= 11) {
    for (let i = 0; i + 11 <= digits.length; i++) {
      const candidate = digits.slice(i, i + 11);
      const hit = colaboradores.find((c) => onlyDigits(c.cpf).length === 11 && onlyDigits(c.cpf) === candidate);
      if (hit) return { colaboradorId: hit.id, colaboradorNome: hit.fullName, confidence: "alta", basis: "cpf" };
    }
  }

  const tokens = normalizeName(fileName).split(" ").filter((t) => t.length > 1);
  if (tokens.length === 0) return null;

  let best = null;
  let bestScore = 0;
  let tie = false;
  for (const c of colaboradores) {
    const nameTokens = normalizeName(c.fullName).split(" ").filter(Boolean);
    if (nameTokens.length === 0) continue;
    const matches = nameTokens.filter((nt) => tokens.includes(nt)).length;
    if (matches === 0) continue;
    const score = matches / nameTokens.length;
    if (score > bestScore) {
      bestScore = score;
      best = c;
      tie = false;
    } else if (score === bestScore && best && c.id !== best.id) {
      tie = true;
    }
  }

  // Exige pelo menos 60% do nome do colaborador presente no arquivo, sem
  // empate com outro colaborador - evita falso positivo em primeiro nome
  // comum (ex: "joao.pdf" batendo com qualquer Joao do cadastro).
  if (best && !tie && bestScore >= 0.6) {
    return { colaboradorId: best.id, colaboradorNome: best.fullName, confidence: "media", basis: "nome" };
  }
  return null;
}
