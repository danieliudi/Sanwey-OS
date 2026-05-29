-- Hierarquia de usuários e segmentação por setor
-- Adds: profiles.sector, profiles.supervisor_id, role 'consultor'

-- 1. Novas colunas em profiles
alter table public.profiles
  add column if not exists sector text,
  add column if not exists supervisor_id uuid references public.profiles(id) on delete set null;

create index if not exists profiles_supervisor_id_idx on public.profiles(supervisor_id);

-- 2. Adiciona 'consultor' ao CHECK de role em profiles
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
    check (role in ('admin', 'gerente', 'vendedor', 'consultor'));

-- 3. Adiciona 'consultor' ao CHECK de role em invitations
alter table public.invitations
  drop constraint if exists invitations_role_check;
alter table public.invitations
  add constraint invitations_role_check
    check (role in ('admin', 'gerente', 'vendedor', 'consultor'));

-- 4. Adiciona sector e supervisor_id ao convite para ser propagado ao profile
alter table public.invitations
  add column if not exists sector text,
  add column if not exists supervisor_id uuid references public.profiles(id) on delete set null;

-- 5. Permite que qualquer usuário autenticado leia perfis
--    (necessário para vendedor/consultor consultarem subordinados/peers no Kanban)
drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated on public.profiles
  for select using (auth.role() = 'authenticated');

-- 6. Atualiza handle_new_user para propagar sector e supervisor_id do convite
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
  assigned_sector text;
  assigned_supervisor uuid;
  invitation_id uuid;
begin
  select id, role, companies, sector, supervisor_id
    into invitation_id, assigned_role, assigned_companies, assigned_sector, assigned_supervisor
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

  insert into public.profiles (id, email, name, initials, role, companies, sector, supervisor_id)
  values (
    new.id,
    new.email,
    display_name,
    upper(substring(display_name from 1 for 2)),
    assigned_role,
    assigned_companies,
    assigned_sector,
    assigned_supervisor
  )
  on conflict (id) do nothing;

  -- Marca aceito imediatamente se auto-confirm está habilitado
  if invitation_id is not null and new.email_confirmed_at is not null then
    update public.invitations
      set accepted_at = now(), accepted_by = new.id
      where id = invitation_id;
  end if;

  return new;
end;
$function$;
