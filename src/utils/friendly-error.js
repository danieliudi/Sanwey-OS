// Traduz erros crus de Supabase/Postgres/Storage (em inglês, com códigos) para
// mensagens pt-BR acionáveis — pra nunca vazar detalhe técnico ao usuário
// externo (formulários públicos). Achado da 2ª auditoria: os forms públicos
// renderizavam err.message direto e o fallback amigável era código morto.
//
// Uso: catch (err) { setError(friendlyError(err, "Não foi possível enviar.")); }
// O err.message original ainda deve ser logado no console pra diagnóstico.
export function friendlyError(err, fallback = "Algo deu errado. Tente novamente em instantes.") {
  const raw = (err && (err.message || err.error_description || err.msg)) || "";
  const code = err && (err.code || err.statusCode);
  const s = String(raw).toLowerCase();

  // Diagnóstico sempre no console (nunca na tela).
  if (raw) { try { console.error("[erro]", code || "", raw); } catch { /* noop */ } }

  if (code === "23505" || s.includes("duplicate key") || s.includes("already exists")) {
    return "Parece que esse registro já foi enviado. Confira se você já não fez esse envio.";
  }
  if (code === "23514" || s.includes("check constraint") || s.includes("violates check")) {
    return "Algum campo está com um valor inválido. Revise os dados e tente de novo.";
  }
  if (s.includes("row-level security") || s.includes("rls") || code === "42501" || s.includes("permission denied")) {
    return "Não foi possível concluir por uma restrição de acesso. Se persistir, fale com o responsável.";
  }
  if (s.includes("payload too large") || s.includes("exceeded the maximum") || s.includes("file size") || s.includes("too large")) {
    return "O arquivo é grande demais. Envie um arquivo menor (até 10 MB).";
  }
  if (s.includes("invalid") && s.includes("mime")) {
    return "Formato de arquivo não aceito. Envie um PDF ou uma imagem (JPG/PNG).";
  }
  if (s.includes("failed to fetch") || s.includes("network") || s.includes("timeout")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  return fallback;
}
