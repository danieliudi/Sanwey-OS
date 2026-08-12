// Escopo de "quem pode ser @mencionado" por domínio — mesmo espírito do
// pedido do usuário: "sempre mostrar só usuários que podem acessar aquele
// departamento/card, não todos da plataforma". Reaproveita o único padrão
// de escopo já existente no app (LeadDetailDrawer: role + companies), só
// generalizado pros outros domínios (que hoje não tinham escopo nenhum).

const DOMAIN_ROLES = {
  crm:       ["vendedor", "gerente", "admin"],
  marketing: ["marketing", "gerente_marketing", "admin"],
  rh:        ["rh", "gerente_rh", "admin"],
  comex:     ["comex", "admin"],
};

function rolesOf(user) {
  return user?.roles?.length ? user.roles : (user?.role ? [user.role] : []);
}

// domain: "crm" | "marketing" | "rh"
// companyId: quando informado, restringe ainda mais quem-não-é-admin/gerente
//   do CRM à mesma empresa do card (vendedor só vê a própria
//   carteira — mesmo escopo já usado no picker de reatribuição de dono).
// includeAgencia: inclui o papel "agencia" mesmo não estando em DOMAIN_ROLES
//   (campanhas/entregas de marketing já dão acesso de leitura pra agência).
export function getMentionableUsers(users, { domain, companyId, includeAgencia = false } = {}) {
  const allowedRoles = DOMAIN_ROLES[domain] || [];
  return (users || []).filter((u) => {
    const userRoles = rolesOf(u);
    if (userRoles.includes("admin")) return true; // admin sempre vê (e pode ser mencionado em) tudo
    if (includeAgencia && userRoles.includes("agencia")) return true;
    if (!allowedRoles.some((r) => userRoles.includes(r))) return false;
    if (domain === "crm" && companyId && userRoles.some(r => r === "vendedor")) {
      return Array.isArray(u.companies) && u.companies.includes(companyId);
    }
    return true;
  });
}
