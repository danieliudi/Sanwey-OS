-- Vendedor resolvendo ação de agente: o WITH CHECK não segurava o que importa.
--
-- Achado da auditoria de 8 passadas (11/09/2026), item 1 da lista do Daniel.
--
-- A policy `agent_actions_seller_resolve` (UPDATE) tinha:
--   USING      = a linha aponta pra um lead do próprio vendedor
--   WITH CHECK = status in ('approved','rejected','ignored')
--
-- O USING olha a linha ANTES; o WITH CHECK, DEPOIS. Checando só o status
-- depois, o vendedor podia, no mesmo UPDATE, mudar tudo o que quisesse:
--
--   1. Trocar `lead_id` pro lead de OUTRO vendedor. O USING passava na linha
--      velha (o lead era dele), o WITH CHECK passava porque o status estava na
--      lista — e a ação terminava pendurada num lead que não é dele.
--   2. Reescrever `payload`, `action_type`, `title`, `summary`, `company_id`
--      da proposta e só então aprovar. `approved` dispara efeito real (ver
--      agent-gateway/index.ts:503) — notifica gestor de vaga, notifica
--      responsável, publica sinal de mercado. Ou seja: a pessoa reescreve o
--      que o agente propôs e faz a plataforma executar a versão reescrita.
--
-- Pela tela isso não é alcançável: o front resolve via `agent-gateway`, que
-- monta o patch por conta própria (só status/resolution_note/resolved_at/
-- resolved_by). Mas a policy existe justamente pra permitir o UPDATE direto
-- com o JWT do vendedor, e por aí o PostgREST aceita a linha inteira.
--
-- Duas camadas, porque uma só não cobre os dois casos:

-- 1) WITH CHECK repete o predicado do USING. Fecha o caso 1: depois do
--    UPDATE a linha PRECISA continuar apontando pra um lead do próprio
--    vendedor, então não dá pra empurrá-la pra fora do próprio escopo.
drop policy if exists agent_actions_seller_resolve on public.agent_actions;
create policy agent_actions_seller_resolve on public.agent_actions
  for update
  using (
    lead_id is not null
    and exists (
      select 1 from public.leads l
      join public.profiles p on p.id = (select auth.uid())
      where l.id = agent_actions.lead_id
        and l.owner = ((select auth.uid()))::text
        and 'vendedor' = any(p.roles)
    )
  )
  with check (
    status = any (array['approved','rejected','ignored'])
    and lead_id is not null
    and exists (
      select 1 from public.leads l
      join public.profiles p on p.id = (select auth.uid())
      where l.id = agent_actions.lead_id
        and l.owner = ((select auth.uid()))::text
        and 'vendedor' = any(p.roles)
    )
  );

-- 2) Gatilho, pro caso 2. RLS decide QUAIS LINHAS, nunca QUAIS COLUNAS — e
--    `grant update (col)` não serve aqui porque o grant é por papel
--    (`authenticated`), e o mesmo papel carrega gestor e admin, que precisam
--    do update inteiro. Então a restrição de coluna vira gatilho, mesmo
--    desenho do `marketing_deliverables_guard_agencia_frente`.
create or replace function public.agent_actions_guard_resolucao()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Sem usuário logado = service_role: edge function e n8n, que não passam
  -- por policy nenhuma e têm caminho próprio de validação no gateway.
  if (select auth.uid()) is null then return new; end if;

  -- Gestor, gerente de RH e admin entram por policy `for all` e editam a
  -- linha inteira de propósito. A guarda é pra quem só chega até aqui pela
  -- policy de vendedor.
  if current_user_is_admin()
     or current_user_has_role('gerente')
     or current_user_has_role('gerente_rh') then
    return new;
  end if;

  if new.agent_id         is distinct from old.agent_id
     or new.action_type   is distinct from old.action_type
     or new.lead_id       is distinct from old.lead_id
     or new.company_id    is distinct from old.company_id
     or new.title         is distinct from old.title
     or new.summary       is distinct from old.summary
     or new.payload       is distinct from old.payload
     or new.priority      is distinct from old.priority
     or new.run_id        is distinct from old.run_id
     or new.n8n_workflow  is distinct from old.n8n_workflow
     or new.expires_at    is distinct from old.expires_at
     or new.created_at    is distinct from old.created_at
     or new.automation_id is distinct from old.automation_id then
    raise exception 'Resolver uma ação muda o status e a nota — o que o agente propôs não é editável aqui.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agent_actions_guard_resolucao on public.agent_actions;
create trigger trg_agent_actions_guard_resolucao
  before update on public.agent_actions
  for each row execute function public.agent_actions_guard_resolucao();

-- Não é chamável por ninguém: é função de gatilho, e o `revoke` nominal é a
-- lição da migration de comunicados (o ALTER DEFAULT PRIVILEGES do Supabase
-- concede EXECUTE a anon/authenticated em toda função nova, e o
-- `revoke from public` não encosta nesse grant).
revoke all on function public.agent_actions_guard_resolucao() from public, anon, authenticated;
