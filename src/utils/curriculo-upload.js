// Currículo em formulário público — validação e tipo do arquivo.
//
// Extraído em 15/09/2026, na 2ª ocorrência e não na 3ª (CLAUDE.md regra 4),
// porque foi exatamente a DIVERGÊNCIA entre as duas cópias que quebrou o
// formulário de vagas para os candidatos:
//
//   · `TalentPoolForm` já validava pela EXTENSÃO e derivava o contentType
//     dela — correção feita depois de um incidente real, com o motivo escrito
//     no próprio arquivo.
//   · `JobApplicationForm` continuou validando por `file.type` cru e enviando
//     `contentType: file.type`. Navegador que devolve tipo vazio (Android,
//     iOS, Windows sem Office registrado) fazia a tela RECUSAR um .pdf
//     perfeitamente válido, com a mensagem "Envie um arquivo PDF ou DOCX" —
//     e o candidato não conseguia anexar nada.
//
// A regra da 3ª ocorrência existe pra evitar abstração especulativa. Aqui não
// há especulação: são as mesmas duas funções puras e a mesma constante, já
// escritas duas vezes, e a segunda cópia custou candidaturas sem currículo.
//
// O bucket `rh-curriculos` aceita só estes dois MIME (conferido em produção
// em 15/09/2026: `storage.buckets.allowed_mime_types`). Mudar aqui sem mudar
// lá faz o upload falhar depois do envio, que é o pior momento.
export const MIME_POR_EXTENSAO = {
  pdf:  "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// 10 MB — é o `file_size_limit` do bucket. Recusar aqui dá mensagem clara;
// deixar passar dá erro genérico do Storage depois do envio.
export const MAX_CURRICULO_BYTES = 10 * 1024 * 1024;

export function extensaoDe(nome) {
  return (nome || "").split(".").pop()?.toLowerCase() || "";
}

/**
 * Valida o arquivo escolhido. Devolve `{ ok, erro, ext, mime }`.
 *
 * Valida pela EXTENSÃO, nunca por `file.type`: o tipo que o navegador informa
 * é vazio ou genérico em boa parte dos aparelhos, e confiar nele recusa
 * arquivo válido — que é o oposto do que um formulário público pode fazer.
 */
export function validarCurriculo(file) {
  if (!file) return { ok: false, erro: null, ext: null, mime: null };

  const ext = extensaoDe(file.name);
  const mime = MIME_POR_EXTENSAO[ext];
  if (!mime) {
    return { ok: false, erro: "Envie um arquivo PDF ou DOCX.", ext, mime: null };
  }
  if (file.size > MAX_CURRICULO_BYTES) {
    return { ok: false, erro: "O arquivo deve ter no máximo 10MB.", ext, mime };
  }
  return { ok: true, erro: null, ext, mime };
}

export default validarCurriculo;
