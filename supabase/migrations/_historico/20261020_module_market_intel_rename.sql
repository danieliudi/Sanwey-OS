-- Espelho SQL de MODULE_GROUPS (src/utils/module-access.js) — o comentário no
-- topo daquele arquivo já avisa "se mudar a regra aqui, mude lá também".
-- O hub "Inteligência de Mercado" (19-20/08/2026) consolidou o módulo
-- 'insights' em 'market-intel' (cobre as 3 abas agora, não só a antiga
-- InsightsView) e ampliou quem vê pra incluir vendedor (Mercado é visível
-- pra vendedor+gerência/marketing/admin, não só gerência/marketing/admin).

CREATE OR REPLACE FUNCTION public.current_user_has_module(p_module text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state text; v_override boolean; v_roles text[];
  v_is_admin boolean; v_is_manager boolean; v_is_marketing boolean;
  v_is_marketing_manager boolean; v_is_rh boolean; v_is_rh_manager boolean;
  v_is_agencia boolean; v_is_portal boolean; v_is_pure_marketing boolean;
  v_is_pure_rh boolean; v_is_market_intel boolean; v_is_diretoria boolean;
  v_is_pure_suporte boolean;
begin
  select allow into v_override from public.profile_module_overrides
   where user_id = auth.uid() and module_id = p_module;
  select roles into v_roles from public.profiles where id = auth.uid();
  if v_roles is null then v_roles := '{}'::text[]; end if;
  v_is_admin := v_roles && array['admin'];

  select state into v_state from public.module_states where module_id = p_module;
  v_state := coalesce(v_state, 'live');
  if v_state = 'off' then return false;
  elsif v_state = 'test' then
    if not (v_is_admin or v_override is true) then return false; end if;
  end if;

  if v_override is not null then return v_override; end if;

  v_is_manager           := v_roles && array['gerente','admin'];
  v_is_marketing         := v_roles && array['marketing','gerente_marketing','admin'];
  v_is_marketing_manager := v_roles && array['gerente_marketing','admin'];
  v_is_rh                := v_roles && array['rh','gerente_rh','admin'];
  v_is_rh_manager        := v_roles && array['gerente_rh','admin'];
  v_is_agencia           := v_roles && array['agencia'];
  v_is_portal            := array_length(v_roles,1) > 0 and v_roles <@ array['portal'];
  v_is_pure_marketing    := array_length(v_roles,1) > 0 and v_roles <@ array['marketing','gerente_marketing'];
  v_is_pure_rh           := array_length(v_roles,1) > 0 and v_roles <@ array['rh','gerente_rh'];
  v_is_pure_suporte      := array_length(v_roles,1) > 0 and v_roles <@ array['suporte'];
  -- Mercado: vendedor + gerência/marketing/admin (decidido com o Daniel
  -- 19/08/2026) — superset do antigo v_is_insights (que não incluía
  -- vendedor nem gerente Comercial puro).
  v_is_market_intel      := v_roles && array['vendedor','gerente','marketing','gerente_marketing','admin'];
  v_is_diretoria         := v_roles && array['diretoria'];

  if v_is_agencia or v_is_portal then return false; end if;
  if v_is_diretoria then return true; end if;

  if v_is_pure_suporte then
    return p_module = any(array['pedidos','clients','catalogo','chat','personal-tasks','meu-rh','tutorials',
                                'rh-onboarding','rh-treinamentos','rh-feedback']);
  end if;

  return case
    when p_module = 'catalogo'
      then (not v_is_pure_rh) and (v_is_marketing or not v_is_pure_marketing)
    when p_module = any(array['commercial-overview','crm','clients','pedidos','signals','explorer','crm-viagens'])
      then not v_is_pure_marketing and not v_is_pure_rh
    when p_module = 'crossref' then v_is_manager
    when p_module = any(array['marketing-home','marketing','marketing-solicitacoes','marketing-entregas',
         'marketing-fornecedores','marketing-compras','marketing-despesas','marketing-feiras'])
      then v_is_marketing
    when p_module = any(array['rh-overview','rh-recrutamento','rh-funcionarios','rh-cargos','rh-ferias',
         'rh-comunicacao','rh-bem-estar','rh-fornecedores']) then v_is_rh
    when p_module = any(array['rh-onboarding','rh-treinamentos','rh-feedback']) then true
    when p_module = 'executive' then v_is_manager or v_is_marketing_manager or v_is_rh_manager
    when p_module = 'market-intel' then v_is_market_intel
    when p_module = 'agents' then v_is_manager or v_is_rh_manager
    when p_module = 'esg-carbono' then v_is_manager
    when p_module = 'automations' then v_is_manager or v_is_rh_manager
    when p_module = any(array['chat','personal-tasks','meu-rh','tutorials']) then true
    else false
  end;
end; $function$;
