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
      { id: "crm",                 label: "Funil de Vendas" },
      { id: "posvenda",            label: "Funil de Pós-venda" },
      { id: "pedidos",             label: "Pedidos" },
      { id: "clients",             label: "Clientes" },
      { id: "catalogo",            label: "Catálogo" },
      { id: "signals",             label: "Sinais" },
      { id: "explorer",            label: "Explorador" },
      { id: "crm-viagens",         label: "Viagens & Despesas" },
      { id: "crossref",            label: "Cross-sell" },
      { id: "comex",               label: "Comex" },
    ],
  },
  {
    label: "Marketing",
    modules: [
      { id: "marketing-home",         label: "Visão Geral" },
      { id: "marketing",              label: "Campanhas" },
      { id: "marketing-solicitacoes", label: "Solicitações" },
      { id: "marketing-entregas",     label: "Entregas" },
      { id: "marketing-tarefas",      label: "Tarefas" },
      { id: "marketing-fornecedores", label: "Fornecedores" },
      { id: "marketing-compras",      label: "Compras" },
      { id: "marketing-despesas",     label: "Despesas" },
      { id: "marketing-feiras",       label: "Feiras" },
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
      { id: "executive",    label: "Executivo" },
      // "Insights" virou uma aba dentro do hub "Mercado" (19-20/08/2026) —
      // id trocou de "insights" pra "market-intel" porque agora cobre as 3
      // abas (Mercado/Insights/Cruzamento), não só a antiga InsightsView.
      { id: "market-intel", label: "Mercado" },
      { id: "agents",       label: "Agentes" },
      { id: "esg-carbono",  label: "ESG & Carbono" },
      { id: "automations",  label: "Automações" },
    ],
  },
  // Páginas que existem no menu de todo mundo. Entraram no registro em
  // 12/08/2026, junto com a chave global de liga/desliga (module_states) —
  // antes disso não havia como recolher nenhuma delas, nem por pessoa nem
  // pra empresa toda. Chat e Meu To-do mantêm o liga/desliga POR PESSOA que
  // já tinham (profiles.chat_enabled e settings.personalTasksEnabled); o que
  // entra aqui é a chave da empresa, que é outra coisa.
  {
    label: "Pessoal",
    modules: [
      { id: "chat",           label: "Chat" },
      { id: "personal-tasks", label: "Meu To-do" },
      { id: "meu-rh",         label: "Meu RH" },
      { id: "tutorials",      label: "Ajuda & Tutoriais" },
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
    isPureSuporte:       rolesSubsetOf(list, ["suporte"]),
    isRH:                hasAnyRole(list, ["rh", "gerente_rh", "admin"]),
    isRHManager:         hasAnyRole(list, ["gerente_rh", "admin"]),
    isPureRH:            rolesSubsetOf(list, ["rh", "gerente_rh"]),
    isComex:             hasAnyRole(list, ["comex", "admin"]),
    isPureComex:         rolesSubsetOf(list, ["comex"]),
    isAdmin:             hasAnyRole(list, ["admin"]),
    isInsights:          hasAnyRole(list, ["admin", "rh", "gerente_rh", "marketing", "gerente_marketing"]),
    // Vendedor puro: usado só pelo gate do hub "Mercado" abaixo (aba Mercado
    // é o único módulo desta lista visível pra esse papel sozinho).
    isVendedor:          hasAnyRole(list, ["vendedor"]),
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

  // Suporte comercial "puro" opera pedido e mantém o catálogo — não vende.
  // Sem funil, sinais nem prospecção: o RLS já limitava o dado, isto enxuga
  // o menu pra função que a pessoa realmente exerce.
  //
  // "clients" aqui liberava a TELA pro suporte puro, mas a policy
  // `clients_read` (baseline) só admitia admin/gerente/vendedor — a pessoa
  // abria Clientes e via lista vazia, sem erro nenhum (achado do checkup de
  // 01/09/2026). O Daniel decidiu liberar a leitura na RLS, não tirar o item
  // do menu: a migration 20260901190000_clients_read_suporte.sql acrescenta
  // 'suporte' ao SELECT, com o MESMO filtro por empresa dos outros cargos e
  // sem tocar em clients_update (suporte lê, não edita).
  //
  // APLICADA em 01/09/2026, com confirmação do Daniel — a tela não vem mais
  // vazia, e o predicado `comercial` do App.jsx (`searchScopes.clients`)
  // ganhou 'suporte' na mesma rodada, pra busca global não ficar atrás da
  // tela. Na mesma leva foi aplicada a 20260901200000, que escopou por frente
  // as três policies *_suporte_read de client_addresses/contacts/products —
  // sem ela, liberar Clientes pro suporte teria ampliado um vazamento em vez
  // de fechar um.
  if (f.isPureSuporte) {
    ["pedidos", "clients", "catalogo"].forEach(m => set.add(m));
  } else if (!f.isPureMarketing && !f.isPureRH && !f.isPureComex) {
    ["commercial-overview", "crm", "posvenda", "pedidos", "clients", "catalogo", "signals", "explorer", "crm-viagens"].forEach(m => set.add(m));
    if (f.isManager) set.add("crossref");
  }

  if (f.isMarketing) {
    ["marketing-home", "marketing", "marketing-solicitacoes", "marketing-entregas", "marketing-tarefas",
     "marketing-fornecedores", "marketing-compras", "marketing-despesas", "marketing-feiras"].forEach(m => set.add(m));
    // Marketing mantém a metade "vitrine" do produto (chamada, destaques,
    // especificações) — o que o Portal B2B mostra pro cliente. Por isso
    // alcança o Catálogo, mesmo sendo tela do Comercial.
    set.add("catalogo");
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

  if (f.isComex) set.add("comex");

  if (f.isManager || f.isMarketingManager || f.isRHManager) set.add("executive");
  // Hub "Inteligência de Mercado" (19-20/08/2026) — substitui "insights":
  // aba Mercado é vendedor+gerência/marketing/admin (superset do antigo
  // f.isInsights, que não incluía vendedor nem gerente Comercial puro).
  if (f.isInsights || f.isManager || f.isVendedor) set.add("market-intel");
  // Agent Builder (PRD docs/prd-agent-builder.md): gerente_rh também cria e
  // aprova agentes de IA de RH, não só o gerente Comercial — espelha
  // current_user_has_module('agents') no banco (migration
  // 20260780_agent_builder_fase1_schema.sql).
  if (f.isManager || f.isRHManager) set.add("agents");
  if (f.isManager || f.isDiretoria) set.add("esg-carbono");
  if (f.isManager || f.isRHManager) set.add("automations");

  // Páginas de todo colaborador. Entram por padrão pra todo mundo — o que
  // muda por pessoa continua sendo decidido fora daqui (chat_enabled,
  // settings.personalTasksEnabled, ter ficha de colaborador).
  ["chat", "personal-tasks", "meu-rh", "tutorials"].forEach(m => set.add(m));

  return set;
}

// ── Chave global por página (module_states) ───────────────────────────────
// Espelho EXATO do portão que roda no banco, no topo de
// current_user_has_module(). Se mudar aqui, mude lá também.
//
// A chave RESTRINGE, nunca AMPLIA: entra como filtro por cima do conjunto
// que o cargo/exceção já concedeu. Pôr uma página em "liberada" não dá
// acesso a ninguém que já não teria.
//
//   off  → ninguém, nem admin
//   test → só admin e quem tiver exceção explícita (allow = true) no módulo
//   live → passa direto, vale a regra de sempre (é também o padrão de quem
//          não tem linha na tabela)
export function gateByModuleStates(modules, states, { isAdmin = false, overrides = [] } = {}) {
  const result = new Set();
  modules.forEach(id => {
    const state = (states && states[id]) || "live";
    if (state === "off") return;
    if (state === "test") {
      const isTester = (overrides || []).some(o => o.moduleId === id && o.allow);
      if (!isAdmin && !isTester) return;
    }
    result.add(id);
  });
  return result;
}

// Uma página está "em teste" pra quem está vendo ela agora? Usado só pra
// decidir se mostra a tarja no topo — o acesso em si já foi resolvido acima.
export function isModuleInTest(moduleId, states) {
  return ((states && states[moduleId]) || "live") === "test";
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
