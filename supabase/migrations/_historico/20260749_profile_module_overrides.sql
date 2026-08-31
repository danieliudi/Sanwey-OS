-- Controle de acesso por módulo, complementar aos cargos/roles — um
-- usuário pode ter um módulo do próprio cargo revogado (allow=false) ou
-- ganhar um módulo extra fora do próprio cargo (allow=true), configurável
-- em Configurações → Usuários → "Acesso por módulo". Sem override, prevalece
-- o padrão do cargo (defaultModulesForRoles em src/utils/module-access.js,
-- espelhado abaixo em current_user_has_module — se mudar a regra num lado,
-- mude no outro).
--
-- Escopo deste pass: controla a NAVEGAÇÃO (sidebar + guard de rota em
-- App.jsx) de verdade. NÃO está (ainda) aplicado como trava de RLS em
-- nenhuma tabela existente — retrofit tabela a tabela é trabalho futuro
-- deliberado, feito com cuidado: ex. rh_cargo_templates é lido tanto por
-- Cargos & Salários (dado sensível) quanto por Recrutamento (aplicar um
-- cargo salvo numa vaga nova) — gatear a tabela inteira por 'rh-cargos'
-- quebraria o segundo uso sem de fato esconder salário dali (ele reaparece
-- via o formulário de vaga). Esse tipo de acoplamento precisa ser
-- desembaraçado tabela por tabela, não de uma vez.
create table public.profile_module_overrides (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  module_id   text not null,
  allow       boolean not null,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique (user_id, module_id)
);

alter table public.profile_module_overrides enable row level security;

create policy profile_module_overrides_admin_all on public.profile_module_overrides
  for all using (current_user_is_admin()) with check (current_user_is_admin());

-- Usuário lê os próprios overrides pra montar a própria navegação.
create policy profile_module_overrides_self_select on public.profile_module_overrides
  for select using (user_id = auth.uid());

create or replace function public.current_user_has_module(p_module text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_override             boolean;
  v_roles                text[];
  v_is_manager           boolean;
  v_is_marketing         boolean;
  v_is_marketing_manager boolean;
  v_is_rh                boolean;
  v_is_rh_manager        boolean;
  v_is_agencia           boolean;
  v_is_portal            boolean;
  v_is_pure_marketing    boolean;
  v_is_pure_rh           boolean;
  v_is_insights          boolean;
begin
  select allow into v_override
  from public.profile_module_overrides
  where user_id = auth.uid() and module_id = p_module;
  if v_override is not null then
    return v_override;
  end if;

  select roles into v_roles from public.profiles where id = auth.uid();
  if v_roles is null then v_roles := '{}'::text[]; end if;

  v_is_manager           := v_roles && array['gerente','admin'];
  v_is_marketing         := v_roles && array['marketing','gerente_marketing','admin'];
  v_is_marketing_manager := v_roles && array['gerente_marketing','admin'];
  v_is_rh                := v_roles && array['rh','gerente_rh','admin'];
  v_is_rh_manager        := v_roles && array['gerente_rh','admin'];
  v_is_agencia           := v_roles && array['agencia'];
  v_is_portal            := array_length(v_roles,1) > 0 and v_roles <@ array['portal'];
  v_is_pure_marketing    := array_length(v_roles,1) > 0 and v_roles <@ array['marketing','gerente_marketing'];
  v_is_pure_rh           := array_length(v_roles,1) > 0 and v_roles <@ array['rh','gerente_rh'];
  v_is_insights          := v_roles && array['admin','rh','gerente_rh','marketing','gerente_marketing'];

  if v_is_agencia or v_is_portal then
    return false;
  end if;

  return case
    when p_module = any(array['commercial-overview','crm','clients','signals','explorer','crm-viagens'])
      then not v_is_pure_marketing and not v_is_pure_rh
    when p_module = 'crossref' then v_is_manager
    when p_module = any(array['marketing-home','marketing','marketing-solicitacoes','marketing-entregas',
         'marketing-fornecedores','marketing-compras','marketing-despesas'])
      then v_is_marketing
    when p_module = any(array['rh-overview','rh-recrutamento','rh-funcionarios','rh-cargos','rh-ferias',
         'rh-comunicacao','rh-bem-estar','rh-fornecedores'])
      then v_is_rh
    when p_module = any(array['rh-onboarding','rh-treinamentos','rh-feedback']) then true
    when p_module = 'executive' then v_is_manager or v_is_marketing_manager or v_is_rh_manager
    when p_module = 'insights' then v_is_insights
    when p_module = 'agents' then v_is_manager
    else false
  end;
end;
$$;
