-- Correções da revisão de QA/Segurança (11/08/2026) sobre
-- chat_channel_management_rpcs (20260914):
--
-- 1) Não existia nenhuma forma de promover um membro a admin — só o criador
--    do grupo nascia admin. Combinado com o bloqueio de "não pode remover/
--    sair sendo o único admin" em chat_remove_member/chat_leave_channel, todo
--    grupo com mais de 1 membro ficava com o criador travado pra sempre (nem
--    ele mesmo conseguia sair). chat_set_member_admin resolve promovendo
--    outra pessoa antes de sair/remover.
-- 2) chat_add_member não replicava a exclusão incondicional de `agencia` que
--    chat_can_dm já aplica (fornecedor/agência nunca participa de chat
--    interno, em nenhuma direção) — o filtro só existia no client
--    (dmCandidates), um admin de grupo podia contornar chamando o RPC direto.
-- 3) Nenhum dos RPCs de gerenciamento checava chat_channels.kind = 'canal' —
--    em teoria dava pra chamar num canal de DM (kind='dm') e transformar uma
--    conversa 1:1 em grupo sem o consentimento dos dois lados.

create or replace function public.chat_set_member_admin(p_channel_id uuid, p_user_id uuid, p_is_admin boolean)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not public.chat_can_manage(p_channel_id) then
    raise exception 'Você não pode editar este grupo/canal.';
  end if;
  if not exists (select 1 from public.chat_channels where id = p_channel_id and kind = 'canal') then
    raise exception 'Essa ação só vale pra grupo ou canal.';
  end if;
  if not p_is_admin
     and exists (select 1 from public.chat_channel_members where channel_id = p_channel_id and user_id = p_user_id and is_admin = true)
     and (select count(*) from public.chat_channel_members where channel_id = p_channel_id and is_admin = true) <= 1 then
    raise exception 'Esse é o único admin do grupo — promova outra pessoa antes de tirar o admin dele.';
  end if;
  update public.chat_channel_members set is_admin = p_is_admin
  where channel_id = p_channel_id and user_id = p_user_id;
end; $$;
revoke all on function public.chat_set_member_admin(uuid, uuid, boolean) from public;
revoke execute on function public.chat_set_member_admin(uuid, uuid, boolean) from anon;
grant execute on function public.chat_set_member_admin(uuid, uuid, boolean) to authenticated;

create or replace function public.chat_add_member(p_channel_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not public.chat_can_manage(p_channel_id) then
    raise exception 'Você não pode editar este grupo/canal.';
  end if;
  if not exists (select 1 from public.chat_channels where id = p_channel_id and kind = 'canal') then
    raise exception 'Essa ação só vale pra grupo ou canal.';
  end if;
  if exists (select 1 from public.chat_channels where id = p_channel_id and sync_filter is not null) then
    raise exception 'Este grupo é sincronizado automaticamente por departamento — não dá pra adicionar pessoa à mão.';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id and roles && array['agencia']::text[]) then
    raise exception 'Fornecedor/agência não participa de grupo ou canal interno.';
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
  if not exists (select 1 from public.chat_channels where id = p_channel_id and kind = 'canal') then
    raise exception 'Essa ação só vale pra grupo ou canal.';
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

create or replace function public.chat_update_channel(
  p_channel_id uuid, p_name text default null, p_description text default null, p_read_only boolean default null
) returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not public.chat_can_manage(p_channel_id) then
    raise exception 'Você não pode editar este grupo/canal.';
  end if;
  if not exists (select 1 from public.chat_channels where id = p_channel_id and kind = 'canal') then
    raise exception 'Essa ação só vale pra grupo ou canal.';
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
