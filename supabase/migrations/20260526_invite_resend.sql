-- Adiciona last_sent_at à tabela invitations para rastrear quando o e-mail foi enviado.
-- Ajusta handle_new_user para não marcar o convite como aceito no INSERT
-- (só na confirmação de e-mail), e cria trigger handle_user_confirmed para isso.

alter table public.invitations
  add column if not exists last_sent_at timestamptz;

-- Permite que admins/gerentes atualizem invitations (para last_sent_at)
drop policy if exists invitations_admin_update on public.invitations;
create policy invitations_admin_update on public.invitations
  for update using (
    current_user_is_admin()
    or (current_user_is_manager() and role <> 'admin')
  );

-- handle_new_user: cria o profile com role/companies do convite, mas NÃO marca
-- accepted_at aqui. Isso é feito em handle_user_confirmed (abaixo), que dispara
-- quando o e-mail é confirmado — garantindo que o convite fique visível na lista
-- até o usuário de fato confirmar o acesso.
--
-- Exceção: se email_confirmed_at já vier preenchido no INSERT (auto-confirm
-- habilitado no projeto), marca aceito imediatamente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  display_name text;
  user_count int;
  assigned_role text;
  assigned_companies text[];
  invitation_id uuid;
begin
  select id, role, companies
    into invitation_id, assigned_role, assigned_companies
    from public.invitations
    where lower(email) = lower(new.email)
      and accepted_at is null
    order by created_at desc
    limit 1;

  if invitation_id is null then
    select count(*) into user_count from public.profiles;
    if user_count = 0 then
      assigned_role := 'admin';
      assigned_companies := array['industria', 'resibag', 'montemor'];
    else
      assigned_role := 'vendedor';
      assigned_companies := '{}'::text[];
    end if;
  end if;

  display_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  insert into public.profiles (id, email, name, initials, role, companies)
  values (
    new.id,
    new.email,
    display_name,
    upper(substring(display_name from 1 for 2)),
    assigned_role,
    assigned_companies
  )
  on conflict (id) do nothing;

  -- Marca aceito imediatamente se o e-mail já está confirmado no INSERT
  -- (auto-confirm habilitado). Caso contrário, handle_user_confirmed cuida disso.
  if invitation_id is not null and new.email_confirmed_at is not null then
    update public.invitations
      set accepted_at = now(), accepted_by = new.id
      where id = invitation_id;
  end if;

  return new;
end;
$function$;

-- Dispara quando email_confirmed_at muda de null para um valor (usuário confirma e-mail).
create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.invitations
      set accepted_at = now(), accepted_by = new.id
      where lower(email) = lower(new.email)
        and accepted_at is null;
  end if;
  return new;
end;
$function$;

drop trigger if exists on_user_confirmed on auth.users;
create trigger on_user_confirmed
  after update on auth.users
  for each row execute function public.handle_user_confirmed();
