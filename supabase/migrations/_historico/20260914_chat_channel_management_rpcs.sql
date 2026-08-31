-- Gerenciamento de grupo/canal (renomear, tipo, adicionar/remover/sair) —
-- pedido do Daniel 11/08/2026: "falta a função de poder editar aquele
-- canal/grupo, para adicionar e deletar usuários, mudar nome". Modelo de
-- permissão (mockup aprovado): gestor da plataforma (chat_is_manager) OU
-- admin daquele grupo específico (chat_channel_members.is_admin) podem
-- gerenciar — resolvido num único helper pra não duplicar o check 4x.

create or replace function public.chat_can_manage(p_channel uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    public.chat_is_manager(auth.uid())
    or exists (
      select 1 from public.chat_channel_members
      where channel_id = p_channel and user_id = auth.uid() and is_admin = true
    );
$$;
revoke all on function public.chat_can_manage(uuid) from public;
revoke execute on function public.chat_can_manage(uuid) from anon;
grant execute on function public.chat_can_manage(uuid) to authenticated;

create or replace function public.chat_update_channel(
  p_channel_id uuid, p_name text default null, p_description text default null, p_read_only boolean default null
) returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not public.chat_can_manage(p_channel_id) then
    raise exception 'Você não pode editar este grupo/canal.';
  end if;
  if p_name is not null and trim(p_name) = '' then
    raise exception 'O nome não pode ficar vazio.';
  end if;
  update public.chat_channels set
    name = coalesce(nullif(trim(p_name), ''), name),
    description = case when p_description is not null then p_description else description end,
    read_only = coalesce(p_read_only, read_only),
    updated_at = now()
  where id = p_channel_id;
end; $$;
revoke all on function public.chat_update_channel(uuid, text, text, boolean) from public;
revoke execute on function public.chat_update_channel(uuid, text, text, boolean) from anon;
grant execute on function public.chat_update_channel(uuid, text, text, boolean) to authenticated;

create or replace function public.chat_add_member(p_channel_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not public.chat_can_manage(p_channel_id) then
    raise exception 'Você não pode editar este grupo/canal.';
  end if;
  if exists (select 1 from public.chat_channels where id = p_channel_id and sync_filter is not null) then
    raise exception 'Este grupo é sincronizado automaticamente por departamento — não dá pra adicionar pessoa à mão.';
  end if;
  insert into public.chat_channel_members (channel_id, user_id) values (p_channel_id, p_user_id) on conflict do nothing;
end; $$;
revoke all on function public.chat_add_member(uuid, uuid) from public;
revoke execute on function public.chat_add_member(uuid, uuid) from anon;
grant execute on function public.chat_add_member(uuid, uuid) to authenticated;

create or replace function public.chat_remove_member(p_channel_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not public.chat_can_manage(p_channel_id) then
    raise exception 'Você não pode editar este grupo/canal.';
  end if;
  if exists (select 1 from public.chat_channels where id = p_channel_id and sync_filter is not null) then
    raise exception 'Este grupo é sincronizado automaticamente por departamento — não dá pra remover pessoa à mão.';
  end if;
  if exists (select 1 from public.chat_channel_members where channel_id = p_channel_id and user_id = p_user_id and is_admin = true)
     and (select count(*) from public.chat_channel_members where channel_id = p_channel_id and is_admin = true) <= 1 then
    raise exception 'Esse é o único admin do grupo — promova outra pessoa antes de remover.';
  end if;
  delete from public.chat_channel_members where channel_id = p_channel_id and user_id = p_user_id;
end; $$;
revoke all on function public.chat_remove_member(uuid, uuid) from public;
revoke execute on function public.chat_remove_member(uuid, uuid) from anon;
grant execute on function public.chat_remove_member(uuid, uuid) to authenticated;

create or replace function public.chat_leave_channel(p_channel_id uuid)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not exists (select 1 from public.chat_channel_members where channel_id = p_channel_id and user_id = auth.uid()) then
    raise exception 'Você não é membro deste grupo/canal.';
  end if;
  if exists (select 1 from public.chat_channel_members where channel_id = p_channel_id and user_id = auth.uid() and is_admin = true)
     and (select count(*) from public.chat_channel_members where channel_id = p_channel_id and is_admin = true) <= 1
     and (select count(*) from public.chat_channel_members where channel_id = p_channel_id) > 1 then
    raise exception 'Você é o único admin do grupo — promova outra pessoa antes de sair.';
  end if;
  delete from public.chat_channel_members where channel_id = p_channel_id and user_id = auth.uid();
end; $$;
revoke all on function public.chat_leave_channel(uuid) from public;
revoke execute on function public.chat_leave_channel(uuid) from anon;
grant execute on function public.chat_leave_channel(uuid) to authenticated;
