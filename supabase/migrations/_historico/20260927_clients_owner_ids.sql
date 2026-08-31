-- Dono do cliente + menu enxuto do suporte. Aplicada 12/08/2026.
--
-- A área foi explícita: "quem toma conta do cliente é o vendedor". Só que
-- `clients` nunca teve dono — só `created_by`, que diz quem cadastrou, não
-- quem responde pela conta. Espelha `leads.owner_ids` (text[] de uuid em
-- texto, plural pra suportar supervisor/dupla) em vez de inventar um
-- `owner_id` singular ao lado: seria a terceira forma de dizer a mesma coisa.

alter table public.clients add column if not exists owner_ids text[] not null default '{}';
create index if not exists idx_clients_owner_ids on public.clients using gin (owner_ids);

comment on column public.clients.owner_ids is
  'Vendedor(es) que respondem pela conta. Vazio = sem dono definido; qualquer vendedor da empresa pode operar (ver current_user_can_manage_client).';

-- Backfill do que dá: cliente que veio de um negócio no funil herda o dono
-- daquele negócio. Cobriu 1 de 15 clientes — os outros 14 nasceram fora do
-- funil e ficam sem dono até alguém atribuir na tela.
update public.clients c
set owner_ids = sub.owners
from (
  select l.client_id, array_agg(distinct o) as owners
  from public.leads l, unnest(l.owner_ids) o
  where l.client_id is not null
  group by l.client_id
) sub
where c.id = sub.client_id and c.owner_ids = '{}';

-- ─────────────────────────────────────────────────────────────────────────
-- Quem pode operar a conta
-- ─────────────────────────────────────────────────────────────────────────
-- DECISÃO EXPLÍCITA, e é o oposto da que tomei pro cliente externo: aqui
-- cliente SEM dono abre pra qualquer vendedor da empresa, em vez de fechar.
--
-- Fechar por omissão travaria 14 dos 15 clientes no dia da migration —
-- ninguém liberaria produto pra quase toda a base até alguém atribuir dono um
-- por um. E o risco de abrir aqui é outro: é vendedor da mesma empresa vendo
-- conta da mesma empresa, não concorrente vendo preço de concorrente. Com
-- dono definido, fecha.

create or replace function public.current_user_can_manage_client(p_client uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    public.current_user_is_admin()
    or (public.current_user_has_role('gerente')
        and exists (select 1 from public.clients c
                    where c.id = p_client and c.company_ids && public.current_user_companies()))
    or (public.current_user_roles() && array['vendedor']::text[]
        and exists (select 1 from public.clients c
                    where c.id = p_client
                      and c.company_ids && public.current_user_companies()
                      and (c.owner_ids = '{}' or auth.uid()::text = any (c.owner_ids))));
$$;
revoke all on function public.current_user_can_manage_client(uuid) from public;
revoke execute on function public.current_user_can_manage_client(uuid) from anon;
grant execute on function public.current_user_can_manage_client(uuid) to authenticated;

alter policy client_products_interno on public.client_products
  using (public.current_user_can_manage_client(client_id))
  with check (public.current_user_can_manage_client(client_id));

-- ─────────────────────────────────────────────────────────────────────────
-- Menu enxuto do suporte comercial
-- ─────────────────────────────────────────────────────────────────────────
-- Suporte "puro" (sem outro cargo) estava recebendo o menu Comercial inteiro
-- — funil, sinais, explorador, viagens. O RLS já limitava o dado, então era
-- higiene de menu e não permissão: agora alcança só Clientes e Catálogo,
-- que é a função que a pessoa exerce. Espelhado em defaultModulesForRoles.
--
-- O ramo novo em current_user_has_module():
--   if v_is_pure_suporte then
--     return p_module = any(array['clients','catalogo','chat','personal-tasks',
--                                 'meu-rh','tutorials','rh-onboarding',
--                                 'rh-treinamentos','rh-feedback']);
--   end if;

-- ─────────────────────────────────────────────────────────────────────────
-- Verificado em produção, 4 casos em transação revertida
-- ─────────────────────────────────────────────────────────────────────────
-- Vendedor libera no cliente DELE · é recusado no cliente de OUTRO vendedor ·
-- consegue no cliente SEM dono · gerente libera em conta de qualquer um.
