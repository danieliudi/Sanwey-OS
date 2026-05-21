-- Pre-approved invitations: when an admin creates one with email + role + companies,
-- the first signup with that email gets those values applied automatically via handle_new_user().

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('vendedor','gerente','admin')),
  companies text[] not null default '{}'::text[],
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);

create unique index if not exists invitations_pending_email_unique
  on public.invitations (lower(email))
  where accepted_at is null;

create index if not exists invitations_email_idx on public.invitations (lower(email));

alter table public.invitations enable row level security;

drop policy if exists invitations_admin_select on public.invitations;
create policy invitations_admin_select on public.invitations
  for select using (current_user_is_admin() or current_user_is_manager());

drop policy if exists invitations_admin_insert on public.invitations;
create policy invitations_admin_insert on public.invitations
  for insert with check (
    current_user_is_admin()
    or (current_user_is_manager() and role <> 'admin')
  );

drop policy if exists invitations_admin_delete on public.invitations;
create policy invitations_admin_delete on public.invitations
  for delete using (
    current_user_is_admin()
    or (current_user_is_manager() and role <> 'admin')
  );

-- handle_new_user(): consume pending invitation when email matches.
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
      assigned_companies := array['comercial','industria','resibag','montemor'];
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
  );

  if invitation_id is not null then
    update public.invitations
      set accepted_at = now(), accepted_by = new.id
      where id = invitation_id;
  end if;

  return new;
end;
$function$;
