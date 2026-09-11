// Hierarquia de RH — quem responde a quem (rh_colaboradores.gestor_id).
//
// Existe como utilitário porque a MESMA pergunta é feita em três lugares que
// discordavam entre si na primeira versão (achado do QA, 10/09/2026): o bloco
// "Lidera N pessoas" excluía desligado, o botão "Minha equipe" não excluía, e
// o filtro da tabela também não. Resultado: quem só liderava gente desligada
// via o botão, clicava, e a própria ficha dizia que ele não liderava ninguém.
// Um predicado só, usado pelos três.
//
// NÃO confundir com profiles.supervisor_id — aquele é o supervisor COMERCIAL
// e decide escopo de lead (CRMView.jsx). Ver o comentário da migration
// 20260910120000_rh_colaboradores_gestor.sql.

// Quem NÃO pode ser gestor de alguém: quem já está abaixo dessa pessoa na
// cadeia. Espelha a trava do banco (trigger rh_colaboradores_gestor_cycle) —
// aqui é só pra não oferecer na tela o que o banco recusaria.
export function descendentesDe(colaboradores, colaboradorId) {
  const encontrados = new Set();
  if (!colaboradorId) return encontrados;
  let fronteira = [colaboradorId];
  // Teto de 50 voltas: mesma rede de segurança do trigger, pro caso de um
  // ciclo pré-existente ter escapado (linha gravada antes desta versão).
  for (let volta = 0; volta < 50 && fronteira.length; volta += 1) {
    const proxima = colaboradores
      .filter((c) => fronteira.includes(c.gestorId) && !encontrados.has(c.id))
      .map((c) => c.id);
    proxima.forEach((id) => encontrados.add(id));
    fronteira = proxima;
  }
  return encontrados;
}

// "A equipe de X" — reportes diretos, sem desligado. Única definição.
export function equipeDe(colaboradores, gestorId) {
  if (!gestorId) return [];
  return colaboradores.filter(
    (c) => c.gestorId === gestorId && c.employeeStatus !== "desligado"
  );
}

// Quem pode aparecer como gestor. Inclui férias e afastado de propósito —
// quem está de férias continua sendo o gestor de alguém; só desligado sai.
// (A spec do mockup dizia "ativos"; corrigida aqui pro que faz sentido
// operacionalmente, decisão registrada no commit.)
export function podeSerGestor(colaborador) {
  return colaborador.employeeStatus !== "desligado";
}
