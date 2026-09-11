-- Comunicado passa a alcançar colaborador SEM login, pelo e-mail da ficha.
--
-- Decidido com o Daniel em 11/09/2026, junto da importação de colaboradores
-- por planilha. O pedido dele foi "importa só como ficha, para envio de
-- e-mails" — e ao conferir antes de construir, o envio não fazia isso:
-- `comunicado_destinatarios` parte de `profiles`, então quem não tem conta
-- ficava fora de todo comunicado, sem nada na tela avisando. Importar mil
-- fichas não mudaria em nada quem recebe.
--
-- O que muda: a lista de destinatários passa a ser "quem tem conta" UNIÃO
-- "ficha ativa, sem conta, com e-mail utilizável".
--
-- O que NÃO muda, e é consequência honesta de não ter conta:
--   · ficha não recebe notificação no sino (não há para quem entregar);
--   · ficha não confirma leitura DENTRO da plataforma — só pelo link pessoal
--     do e-mail, que já funciona sem login (confirmar_leitura_por_token);
--   · ficha não abre o anexo do comunicado pelo Storage (idem).
-- Os três aparecem contados na tela do RH, não sumidos: a linha de leitura
-- de quem é ficha nasce com canal_plataforma = false, que é exatamente a
-- coluna "nunca teve como confirmar" que a tela já mostra.

-- ── 1. A linha de leitura passa a aceitar os dois tipos de destinatário ─────
--
-- `email` é gravado no envio e nunca mais recalculado. Além de servir pra
-- ficha (que não tem profile pra buscar o e-mail), conserta uma fragilidade
-- que já existia: a função de e-mail lia `profiles(email)` na hora do envio,
-- então trocar o e-mail de alguém entre o disparo e a entrega mandava o link
-- pessoal pro endereço novo.
alter table public.rh_comunicado_leituras
  alter column profile_id drop not null;

alter table public.rh_comunicado_leituras
  add column if not exists colaborador_id uuid references public.rh_colaboradores(id) on delete cascade,
  add column if not exists email text;

-- Preenche o e-mail das linhas que já existem, pra coluna não nascer cega.
update public.rh_comunicado_leituras l
   set email = p.email
  from public.profiles p
 where p.id = l.profile_id and l.email is null;

alter table public.rh_comunicado_leituras
  drop constraint if exists rh_comunicado_leituras_quem;
alter table public.rh_comunicado_leituras
  add constraint rh_comunicado_leituras_quem check (
    (profile_id is not null and colaborador_id is null)
    or (profile_id is null and colaborador_id is not null)
  );

-- A unicidade antiga era (comunicado_id, profile_id). Com profile_id nulo pra
-- ficha, ela deixaria passar N linhas de ficha repetida no mesmo comunicado —
-- NULL nunca é igual a NULL num índice único comum. Vira um índice parcial
-- por tipo de destinatário.
alter table public.rh_comunicado_leituras
  drop constraint if exists rh_comunicado_leituras_comunicado_id_profile_id_key;

create unique index if not exists rh_comunicado_leituras_por_profile
  on public.rh_comunicado_leituras (comunicado_id, profile_id) where profile_id is not null;
create unique index if not exists rh_comunicado_leituras_por_colaborador
  on public.rh_comunicado_leituras (comunicado_id, colaborador_id) where colaborador_id is not null;

-- ── 2. A lista de destinatários ────────────────────────────────────────────
drop function if exists public.comunicado_destinatarios(text, text, uuid);

create function public.comunicado_destinatarios(
  p_scope_type text, p_scope_value text, p_excluir uuid default null
)
returns table(profile_id uuid, colaborador_id uuid, nome text, email text, aceita_notificacao boolean)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  -- (a) quem tem conta — exatamente o predicado de antes, sem afrouxar nada.
  select p.id, null::uuid, p.name, p.email, coalesce(p.mention_notifications_enabled, true)
  from public.profiles p
  where (p_excluir is null or p.id <> p_excluir)
    and not (coalesce(p.roles, '{}'::text[]) && array['agencia','cliente','fornecedor']::text[])
    and coalesce(p.employee_status, 'ativo') <> 'desligado'
    and (
      p_scope_type = 'todos'
      or (p_scope_type = 'frente' and exists (
            select 1 from public.rh_colaboradores c
            where c.profile_id = p.id and c.frente = p_scope_value and c.employee_status = 'ativo'))
      or (p_scope_type = 'departamento' and exists (
            select 1 from public.rh_colaboradores c
            where c.profile_id = p.id and c.department = p_scope_value and c.employee_status = 'ativo'))
    )

  union all

  -- (b) ficha ATIVA, sem conta, com e-mail que dá pra usar.
  --
  -- `profile_id is null` é o que impede contar a mesma pessoa duas vezes:
  -- quem tem ficha E conta já saiu no bloco (a). E colaborador cuja conta foi
  -- excluída do escopo em (a) — agência, cliente, fornecedor, desligado —
  -- continua fora, porque a ficha dele tem profile_id preenchido.
  select null::uuid, c.id, c.full_name, c.email, false
  from public.rh_colaboradores c
  where c.profile_id is null
    and c.employee_status = 'ativo'
    and public.email_utilizavel(c.email)
    and (
      p_scope_type = 'todos'
      or (p_scope_type = 'frente' and c.frente = p_scope_value)
      or (p_scope_type = 'departamento' and c.department = p_scope_value)
    );
$$;
revoke all on function public.comunicado_destinatarios(text, text, uuid) from public, anon, authenticated;
grant execute on function public.comunicado_destinatarios(text, text, uuid) to service_role;

-- ── 3. A lista de leitura da tela do RH ────────────────────────────────────
drop function if exists public.comunicado_leituras(uuid);

create function public.comunicado_leituras(p_comunicado_id uuid)
returns table(profile_id uuid, colaborador_id uuid, nome text, email text,
              confirmado_em timestamptz, origem text,
              canal_email boolean, canal_plataforma boolean)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not (current_user_is_admin() or current_user_has_role('gerente_rh') or current_user_has_role('diretoria')) then
    raise exception 'Sem permissão';
  end if;
  return query
    select l.profile_id, l.colaborador_id,
           coalesce(p.name, c.full_name, l.email, 'Sem nome'),
           coalesce(l.email, p.email, c.email),
           l.confirmado_em, l.origem, l.canal_email, l.canal_plataforma
    from public.rh_comunicado_leituras l
    left join public.profiles p on p.id = l.profile_id
    left join public.rh_colaboradores c on c.id = l.colaborador_id
    where l.comunicado_id = p_comunicado_id
    order by (l.confirmado_em is null), l.confirmado_em desc,
             coalesce(p.name, c.full_name, l.email);
end;
$$;
revoke all on function public.comunicado_leituras(uuid) from public, anon;
grant execute on function public.comunicado_leituras(uuid) to authenticated;

-- ── 4. O envio grava a linha certa pra cada tipo ───────────────────────────
create or replace function public.broadcast_announcement(
  p_title text, p_body text,
  p_scope_type text default 'todos', p_scope_value text default null,
  p_link jsonb default null, p_importante boolean default false,
  p_canais text[] default array['plataforma'],
  p_sensivel boolean default false,
  p_imagem_path text default null,
  p_documento_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_count integer := 0;
  v_type  text := case when p_importante then 'comunicado_importante' else 'comunicado' end;
  v_id    uuid;
  v_quer_email boolean := 'email' = any(coalesce(p_canais, array['plataforma']));
  v_com_email int; v_sem_email int;
begin
  if v_uid is null then raise exception 'Autenticação necessária'; end if;
  if not (current_user_is_admin() or current_user_has_role('gerente_rh')) then
    raise exception 'Sem permissão para enviar comunicados';
  end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Título obrigatório'; end if;
  if p_scope_type not in ('todos','frente','departamento') then raise exception 'Escopo inválido'; end if;
  if coalesce(array_length(p_canais, 1), 0) = 0 then raise exception 'Escolha ao menos um canal'; end if;
  if exists (select 1 from unnest(p_canais) c where c not in ('plataforma','email')) then
    raise exception 'Canal inválido';
  end if;

  if 'plataforma' = any(p_canais) then
    -- `d.profile_id is not null` NÃO é defensivo à toa: notificação precisa de
    -- uma conta pra entregar, e sem este filtro a ficha sem login estouraria o
    -- NOT NULL de notifications.recipient_id e derrubaria o envio inteiro.
    insert into public.notifications (recipient_id, type, title, body, link, created_by)
    select d.profile_id, v_type, p_title, p_body, p_link, v_uid
    from public.comunicado_destinatarios(p_scope_type, p_scope_value, v_uid) d
    where d.profile_id is not null
      and (p_importante or d.aceita_notificacao);
    get diagnostics v_count = row_count;
  end if;

  select count(distinct lower(trim(d.email))) filter (where public.email_utilizavel(d.email)),
         count(*) filter (where not public.email_utilizavel(d.email))
    into v_com_email, v_sem_email
  from public.comunicado_destinatarios(p_scope_type, p_scope_value, v_uid) d;

  insert into public.rh_comunicados
    (titulo, corpo, scope_type, scope_value, importante, canais, enviado_por,
     alcance_plataforma, alcance_email, sem_email, email_status,
     sensivel, imagem_path, documento_path)
  values
    (p_title, p_body, p_scope_type, p_scope_value, p_importante, p_canais, v_uid,
     v_count,
     case when v_quer_email then v_com_email else 0 end,
     case when v_quer_email then v_sem_email else 0 end,
     case when v_quer_email then 'pendente' else 'nao_solicitado' end,
     p_sensivel, p_imagem_path, p_documento_path)
  returning id into v_id;

  -- Uma linha por destinatário, com o canal que a pessoa REALMENTE tinha e o
  -- e-mail congelado no momento do envio.
  insert into public.rh_comunicado_leituras
    (comunicado_id, profile_id, colaborador_id, email, canal_email, canal_plataforma)
  select v_id, d.profile_id, d.colaborador_id, d.email,
         v_quer_email and public.email_utilizavel(d.email),
         ('plataforma' = any(p_canais)) and d.profile_id is not null
           and (p_importante or d.aceita_notificacao)
  from public.comunicado_destinatarios(p_scope_type, p_scope_value, v_uid) d
  on conflict do nothing;

  return jsonb_build_object(
    'comunicado_id', v_id,
    'alcance_plataforma', v_count,
    'alcance_email', case when v_quer_email then v_com_email else 0 end,
    'sem_email', case when v_quer_email then v_sem_email else 0 end
  );
end;
$$;
revoke all on function public.broadcast_announcement(text, text, text, text, jsonb, boolean, text[], boolean, text, text) from public, anon;
grant execute on function public.broadcast_announcement(text, text, text, text, jsonb, boolean, text[], boolean, text, text) to authenticated;
