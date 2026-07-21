// Fonte única de verdade dos "módulos" (itens de menu/tela) que um cargo
// concede por padrão — mesma regra hoje embutida no useMemo de navGroups em
// App.jsx, extraída aqui pra ser reutilizada tanto na montagem da navegação
// de quem está logado quanto no cálculo de "Acesso por módulo" na tela de
// Usuários (Configurações → Usuários), onde um admin edita o acesso de
// QUALQUER pessoa, não só o próprio. O espelho em SQL fica em
// current_user_has_module() (ver migration profile_module_overrides) — se
// mudar a regra aqui, mude lá também.

export const MODULE_GROUPS = [
  {
    label: "Comercial",
    modules: [
      { id: "commercial-overview", label: "Visão Geral" },
      { id: "crm",                 label: "Pipeline" },
      { id: "clients",             label: "Clientes" },
      { id: "signals",             label: "Sinais" },
      { id: "explorer",            label: "Explorador" },
      { id: "crm-viagens",         label: "Viagens & Reembolsos" },
      { id: "crossref",            label: "Cross-sell" },
    ],
  },
  {
    label: "Marketing",
    modules: [
      { id: "marketing-home",         label: "Visão Geral" },
      { id: "marketing",              label: "Campanhas" },
      { id: "marketing-solicitacoes", label: "Solicitações" },
      { id: "marketing-entregas",     label: "Entregas" },
      { id: "marketing-fornecedores", label: "Fornecedores" },
      { id: "marketing-compras",      label: "Compras" },
      { id: "marketing-despesas",     label: "Despesas" },
    ],
  },
  {
    label: "Recursos Humanos",
    modules: [
      { id: "rh-overview",     label: "Visão Geral" },
      { id: "rh-recrutamento", label: "Recrutamento" },
      { id: "rh-onboarding",   label: "Onboarding" },
      { id: "rh-treinamentos", label: "Treinamentos" },
      { id: "rh-feedback",     label: "Avaliação de Desempenho" },
      { id: "rh-ferias",       label: "Férias & Licenças" },
      { id: "rh-funcionarios", label: "Funcionários" },
      { id: "rh-cargos",       label: "Cargos & Salários" },
      { id: "rh-comunicacao",  label: "Comunicação" },
      { id: "rh-bem-estar",    label: "Bem-estar" },
      { id: "rh-fornecedores", label: "Fornecedores (RH)" },
      { id: "rh-relatorios",   label: "Relatórios" },
    ],
  },
  {
    label: "Inteligência",
    modules: [
      { id: "executive", label: "Executivo" },
      { id: "insights",  label: "Insights" },
      { id: "agents",    label: "Agentes" },
    ],
  },
];

export const ALL_MODULE_IDS = MODULE_GROUPS.flatMap(g => g.modules.map(m => m.id));
export const MODULE_LABELS = Object.fromEntries(MODULE_GROUPS.flatMap(g => g.modules.map(m => [m.id, m.label])));

function hasAnyRole(roles, list) { return list.some(r => roles.includes(r)); }
function rolesSubsetOf(roles, list) { return roles.length > 0 && roles.every(r => list.includes(r)); }

export function computeRoleFlags(roles) {
  const list = Array.isArray(roles) ? roles : [];
  return {
    isManager:           hasAnyRole(list, ["gerente", "admin"]),
    isMarketing:         hasAnyRole(list, ["marketing", "gerente_marketing", "admin"]),
    isPureMarketing:     rolesSubsetOf(list, ["marketing", "gerente_marketing"]),
    isMarketingManager:  hasAnyRole(list, ["gerente_marketing", "admin"]),
    isAgencia:           hasAnyRole(list, ["agencia"]),
    isPortalOnly:        rolesSubsetOf(list, ["portal"]),
    isRH:                hasAnyRole(list, ["rh", "gerente_rh", "admin"]),
    isRHManager:         hasAnyRole(list, ["gerente_rh", "admin"]),
    isPureRH:            rolesSubsetOf(list, ["rh", "gerente_rh"]),
    isAdmin:             hasAnyRole(list, ["admin"]),
    isInsights:          hasAnyRole(list, ["admin", "rh", "gerente_rh", "marketing", "gerente_marketing"]),
    // Diretoria (reunião com o RH, 20/07): enxerga tudo da plataforma em modo
    // leitura — nenhuma escrita em lugar nenhum (garantido via RLS, ver
    // migration 20260756_papel_diretoria.sql). Não é sinônimo de admin: não
    // concede nenhuma ação, só visibilidade.
    isDiretoria:         hasAnyRole(list, ["diretoria"]),
  };
}

// Módulos concedidos por padrão pelo(s) cargo(s) — antes de qualquer
// override. Agência e Portal têm shell de navegação fixo e restritíssimo
// (ver App.jsx) — nenhum módulo desta lista se aplica a essas duas contas,
// então retornam vazio (não fazem parte do controle por módulo).
export function defaultModulesForRoles(roles) {
  const f = computeRoleFlags(roles);
  const set = new Set();
  if (f.isPortalOnly || f.isAgencia) return set;

  // Diretoria: acesso de leitura a TODOS os módulos, sem exceção (a escrita é
  // bloqueada via RLS, não aqui — ver migration 20260756_papel_diretoria.sql).
  if (f.isDiretoria) {
    ALL_MODULE_IDS.forEach(m => set.add(m));
    return set;
  }

  if (!f.isPureMarketing && !f.isPureRH) {
    ["commercial-overview", "crm", "clients", "signals", "explorer", "crm-viagens"].forEach(m => set.add(m));
    if (f.isManager) set.add("crossref");
  }

  if (f.isMarketing) {
    ["marketing-home", "marketing", "marketing-solicitacoes", "marketing-entregas",
     "marketing-fornecedores", "marketing-compras", "marketing-despesas"].forEach(m => set.add(m));
  }

  if (f.isRH) {
    ["rh-overview", "rh-recrutamento", "rh-onboarding", "rh-treinamentos", "rh-feedback",
     "rh-ferias", "rh-funcionarios", "rh-cargos", "rh-comunicacao", "rh-bem-estar", "rh-fornecedores", "rh-relatorios"]
      .forEach(m => set.add(m));
  } else {
    // Todo colaborador (não só RH) acessa o próprio checklist/treinamentos/
    // avaliação — não é uma tela de gestão de RH.
    ["rh-onboarding", "rh-treinamentos", "rh-feedback"].forEach(m => set.add(m));
  }

  if (f.isManager || f.isMarketingManager || f.isRHManager) set.add("executive");
  if (f.isInsights) set.add("insights");
  if (f.isManager) set.add("agents");

  return set;
}

// Aplica os overrides (allow=true força incluir, allow=false força excluir)
// sobre o padrão do cargo.
export function effectiveModules(roles, overrides) {
  const result = defaultModulesForRoles(roles);
  (overrides || []).forEach(o => {
    if (o.allow) result.add(o.moduleId);
    else result.delete(o.moduleId);
  });
  return result;
}

export function isModuleAllowed(moduleId, roles, overrides) {
  return effectiveModules(roles, overrides).has(moduleId);
}
