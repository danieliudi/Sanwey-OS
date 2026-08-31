-- Lista de membros de um grupo/canal, com dados de profile já resolvidos.
-- SECURITY DEFINER porque a leitura direta chat_channel_members->profiles via
-- PostgREST ficaria sujeita à RLS de profiles (escopo por role/depto/empresa,
-- ver profiles_select) — um membro do chat pode não enxergar o profile de
-- outro membro fora do seu escopo normal, o que quebraria a lista de membros
-- do próprio grupo. Mesmo padrão de chat_dm_candidates/chat_my_channels
-- (já SECURITY DEFINER por este mesmo motivo).
create or replace function public.chat_channel_roster(p_channel_id uuid)
returns table(user_id uuid, is_admin boolean, name text, initials text, avatar_bg text, avatar_url text, job_title text, department text)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select m.user_id, m.is_admin, p.name, p.initials, p.avatar_bg, p.avatar_url, p.job_title, p.department
  from public.chat_channel_members m
  join public.profiles p on p.id = m.user_id
  where m.channel_id = p_channel_id
    and public.chat_is_member(p_channel_id)
  order by m.is_admin desc, p.name asc;
$$;

revoke all on function public.chat_channel_roster(uuid) from public;
revoke execute on function public.chat_channel_roster(uuid) from anon;
grant execute on function public.chat_channel_roster(uuid) to authenticated;
