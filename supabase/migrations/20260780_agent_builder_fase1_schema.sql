-- Agent Builder (PRD docs/prd-agent-builder.md) — Fase 1: Fornecedores RH.
-- Aprovado por Daniel em 24/07 (AskUserQuestion, "aplicar tudo").

-- 1. paused_reason (PRD seção 4): intervenção do sistema (chave quebrada),
--    independente de `enabled` (intenção do usuário).
alter table automations add column if not exists paused_reason text;

-- 2. automation_id (PRD seção 4): rastreia origem + conta execuções/24h sem
--    precisar de coluna de contador separada. ON DELETE SET NULL — apagar a
--    automação não deve apagar o histórico de sugestões já geradas.
alter table agent_actions add column if not exists automation_id uuid
  references automations(id) on delete set null;

-- 3. automations.module CHECK só tinha crm/marketing/universal — Fornecedores
--    RH precisa de um valor próprio pra escopar o assistente guiado e o
--    agent-runner. Uma entrada por vez (regra do próprio PRD pro mapeamento
--    módulo→tabela) — Fase 2 adiciona rh-recrutamento/rh-onboarding quando
--    chegar a hora, não agora.
alter table automations drop constraint if exists automations_module_check;
alter table automations add constraint automations_module_check
  check (module = any (array['crm','marketing','universal','rh-fornecedores']));

-- 4. agent_actions.agent_id CHECK só tinha os 5 agentes do n8n. 'automation'
--    é um valor só, fixo, pra TODA ação gerada pelo mecanismo novo — a
--    identidade específica (qual automação, de qual módulo) já vem por
--    automation_id, não precisa de um agent_id por automação.
alter table agent_actions drop constraint if exists agent_actions_agent_id_check;
alter table agent_actions add constraint agent_actions_agent_id_check
  check (agent_id = any (array['sdr_q','scout','cadencia','sentinela','cross','automation']));

-- 5. RLS automations: automations_write hoje só cobre profiles.role IN
--    ('admin','gerente') — coluna singular legada, não bate com gerente_rh
--    (confirmado com dados reais: tatiane.coelho/iudiyano têm role=gerente_rh).
--    Nova policy usando roles[] (current_user_is_rh do jeito certo), sem
--    mexer na policy existente.
create policy automations_write_rh on automations
  for all
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['gerente_rh','admin']::text[])
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['gerente_rh','admin']::text[])
  );

-- 6. RLS agent_actions: agent_actions_manager_all usa current_user_role() =
--    'gerente' (Comercial só). Nova policy espelhando a mesma forma pra
--    gerente_rh — sem company_id em rh_fornecedores/rh_fornecedor_contratos,
--    então as linhas geradas por este mecanismo nascem com company_id NULL
--    (a condição "company_id IS NULL" já cobre isso).
create policy agent_actions_rh_manager_all on agent_actions
  for all
  using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['gerente_rh','admin']::text[])
    and (company_id is null or company_id = any (current_user_companies()))
  )
  with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['gerente_rh','admin']::text[])
    and (company_id is null or company_id = any (current_user_companies()))
  );

-- 7. Módulo "agents" (Automações + Time de Agentes) só concedia a
--    v_is_manager (Comercial). Gerente de RH precisa entrar pra usar o
--    assistente guiado e aprovar as próprias sugestões.
create or replace function public.current_user_has_module(p_module text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
    when p_module = 'agents' then v_is_manager or v_is_rh_manager
    else false
  end;
end;
$function$;
