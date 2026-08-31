-- Remove o papel "consultor" da plataforma, migrando pra "vendedor" — pedido
-- do Daniel (12/08/2026). Escopo levantado ANTES de aplicar:
--   * 0 profiles com role (singular) = 'consultor';
--   * 3 profiles com 'consultor' no array roles, todos já com outro papel
--     primário (marketing/gerente/vendedor) — nenhum consultor puro;
--   * nenhum supervisor_id aponta pra um deles (consultor era papel-folha,
--     ninguém dependia de um consultor como supervisor).
--
-- Por que isso não é escalada de permissão: toda política que tratava
-- consultor separadamente dava a ele MENOS que a vendedor (só owner_ids,
-- sem o `owner_ids && current_user_subordinate_ids()` e sem o fallback por
-- setor). Os 3 perfis afetados já carregavam vendedor/gerente junto, então
-- já caíam no ramo mais amplo — o que sai daqui é código morto, não acesso
-- novo. Ainda assim, o campo "Supervisor" no cadastro de usuário (que só
-- aparecia pra consultor e era o único lugar que definia supervisor_id)
-- passou a aparecer pra vendedor, senão o mecanismo de subordinados ficaria
-- sem nenhuma tela pra ser configurado daqui pra frente.

-- 1) Migra os 3 profiles: tira 'consultor', garante 'vendedor' (dedup).
update public.profiles
set roles = (select array_agg(distinct r) from unnest(array_remove(roles, 'consultor') || array['vendedor']) as r)
where 'consultor' = any(roles);

-- 2) Constraints: 'consultor' deixa de ser valor permitido.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin','gerente','vendedor','marketing','gerente_marketing','agencia','rh','gerente_rh','diretoria','comex']));

alter table public.profiles drop constraint profiles_roles_check;
alter table public.profiles add constraint profiles_roles_check
  check (roles <@ array['admin','gerente','vendedor','marketing','gerente_marketing','agencia','rh','gerente_rh','portal','diretoria','comex']);

-- 3) Políticas RLS — remove o ramo/elemento 'consultor' em 9 tabelas
-- (client_billing_history, clients, email_templates, lead_attachments,
-- lead_emails, lead_samples, leads, posvenda_cases, profiles), mantendo o
-- resto de cada predicado idêntico ao que já estava em produção.
--
-- NOTA: o corpo completo dos ALTER POLICY foi aplicado via
-- mcp Supabase apply_migration (versão 20260812025730 "remove_consultor_role").
-- Este arquivo existe pro histórico local ficar completo — a fonte de
-- verdade do predicado final é o próprio banco (pg_policy). Ao precisar
-- reproduzir num ambiente novo, gere os ALTER POLICY a partir do banco de
-- produção em vez de copiar daqui, pra não divergir silenciosamente.

-- 4) Funções que listavam 'consultor' junto com vendedor/gerente:
--    get_client_timeline  → array['gerente','vendedor'] no gate de permissão
--    list_evento_campaigns → array['vendedor','gerente'] no mesmo lugar
-- (idem nota acima: recriadas na íntegra pelo apply_migration).
