-- Comunicado interno: registro do que foi enviado, e envio por e-mail.
--
-- Levantado na reunião de RH de 10/09/2026 ("comunicados: envio por WhatsApp
-- e/ou email") e aprovado no mockup das lacunas: plataforma e e-mail agora,
-- WhatsApp depois — ele exige conta comercial aprovada, modelo homologado e
-- custo por mensagem, e vira projeto próprio.
--
-- O QUE NÃO EXISTIA. Comunicado era só um INSERT em `notifications`: some
-- depois de lido, não fica registrado em lugar nenhum, e alcança apenas quem
-- tem login E não desligou notificação. O RH não tinha como responder "o que
-- foi comunicado em agosto" nem "quem recebeu".

create table if not exists public.rh_comunicados (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  corpo         text,
  scope_type    text not null default 'todos' check (scope_type in ('todos','frente','departamento')),
  scope_value   text,
  importante    boolean not null default false,
  canais        text[] not null default array['plataforma'],
  enviado_por   uuid references public.profiles(id) on delete set null,
  enviado_em    timestamptz not null default now(),
  -- Alcance MEDIDO no envio, não estimado depois: o quadro de pessoas muda, e
  -- recontar em janeiro daria outro número para o mesmo comunicado (regra 14).
  alcance_plataforma int not null default 0,
  alcance_email      int not null default 0,
  sem_email          int not null default 0,
  email_status  text not null default 'nao_solicitado'
                check (email_status in ('nao_solicitado','pendente','enviado','falhou')),
  email_erro    text
);

alter table public.rh_comunicados enable row level security;

-- Mesmo público que já podia ENVIAR comunicado (broadcast_announcement exige
-- admin ou gerente_rh) — não amplio quem envia ao criar o registro.
drop policy if exists rh_comunicados_rh_all on public.rh_comunicados;
create policy rh_comunicados_rh_all on public.rh_comunicados
  for all using (current_user_is_admin() or current_user_has_role('gerente_rh'))
  with check (current_user_is_admin() or current_user_has_role('gerente_rh'));

drop policy if exists rh_comunicados_diretoria_read on public.rh_comunicados;
create policy rh_comunicados_diretoria_read on public.rh_comunicados
  for select using (current_user_has_role('diretoria'));

create index if not exists rh_comunicados_enviado_em_idx
  on public.rh_comunicados (enviado_em desc);

-- Destinatários de um escopo, em UM lugar só.
--
-- A regra de escopo já existia dentro de broadcast_announcement. Em vez de
-- escrevê-la uma segunda vez aqui (pra contar o alcance e pra mandar e-mail),
-- ela é extraída e o broadcast passa a consumir esta função — senão seriam
-- três cópias da mesma regra, que é exatamente como elas divergem depois
-- (regra 1 do CLAUDE.md).
--
-- MUDANÇA DE COMPORTAMENTO, deliberada: o filtro `not (roles && externos)` é
-- novo. A versão anterior mandava "Comunicado para todos" pra TODO perfil da
-- tabela, agência inclusive (hoje 1 de 15). Na plataforma isso já era errado e
-- passava batido — comunicado interno aparecendo no sino de quem é de fora.
-- Com e-mail entrando como canal vira vazamento pra caixa de entrada de
-- terceiro, então corrijo aqui, no ponto único, e não só no caminho novo.
--
-- `aceita_notificacao` sai junto porque o alcance da PLATAFORMA depende do
-- opt-out, e o do E-MAIL não: quem desligou notificação do sino continua
-- recebendo comunicado por e-mail, que é justamente o motivo de existir o
-- segundo canal.
create or replace function public.comunicado_destinatarios(
  p_scope_type text,
  p_scope_value text,
  p_excluir uuid default null
)
returns table(profile_id uuid, nome text, email text, aceita_notificacao boolean)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select p.id, p.name, p.email, coalesce(p.mention_notifications_enabled, true)
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
    );
$$;
-- Devolve nome e e-mail de todo mundo do escopo: NÃO é chamável por usuário
-- logado. Quem precisa da lista é a edge function (service_role, pra montar o
-- BCC); a tela usa comunicado_alcance, que só conta. As duas funções SECURITY
-- DEFINER abaixo a chamam como dona, sem depender de grant.
--
-- `anon, authenticated` EXPLÍCITOS, não só `public`: o Supabase mantém um
-- ALTER DEFAULT PRIVILEGES que dá EXECUTE a anon/authenticated/service_role em
-- toda função nova do schema public, e esse grant é nominal — `revoke ... from
-- public` não encosta nele. A primeira versão desta migration tinha só o
-- `from public`, e o teste na branch mostrou visitante ANÔNIMO chamando
-- /rest/v1/rpc/comunicado_destinatarios e recebendo nome e e-mail de todo
-- mundo. Toda função nova aqui precisa do revoke nominal.
revoke all on function public.comunicado_destinatarios(text, text, uuid) from public, anon, authenticated;
grant execute on function public.comunicado_destinatarios(text, text, uuid) to service_role;

-- Prévia de alcance pra tela mostrar ANTES de enviar. Conta, nunca devolve a
-- lista: quem manda comunicado não precisa da relação de e-mails na mão.
create or replace function public.comunicado_alcance(p_scope_type text, p_scope_value text)
returns table(total int, com_notificacao int, com_email int, sem_email int)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not (current_user_is_admin() or current_user_has_role('gerente_rh')) then
    raise exception 'Sem permissão';
  end if;
  if p_scope_type not in ('todos','frente','departamento') then
    raise exception 'Escopo inválido';
  end if;
  return query
    select count(*)::int,
           count(*) filter (where d.aceita_notificacao)::int,
           count(*) filter (where coalesce(trim(d.email),'') <> '')::int,
           count(*) filter (where coalesce(trim(d.email),'') =  '')::int
    from public.comunicado_destinatarios(p_scope_type, p_scope_value, (select auth.uid())) d;
end;
$$;
revoke all on function public.comunicado_alcance(text, text) from public, anon;
grant execute on function public.comunicado_alcance(text, text) to authenticated;

-- broadcast_announcement passa a consumir a função extraída e a REGISTRAR o
-- comunicado. Devolve jsonb com o id do registro, não mais só a contagem — a
-- tela precisa do id pra pedir o e-mail depois.
--
-- DROP antes do CREATE, obrigatório por dois motivos que o `create or replace`
-- não cobre: o retorno muda (integer → jsonb), o que ele recusa; e o parâmetro
-- novo `p_canais` criaria uma SEGUNDA função em vez de substituir a primeira —
-- aí toda chamada com os 6 argumentos antigos casaria com as duas e viraria
-- erro de ambiguidade.
drop function if exists public.broadcast_announcement(text, text, text, text, jsonb, boolean);

create function public.broadcast_announcement(
  p_title text, p_body text,
  p_scope_type text default 'todos', p_scope_value text default null,
  p_link jsonb default null, p_importante boolean default false,
  p_canais text[] default array['plataforma']
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
    insert into public.notifications (recipient_id, type, title, body, link, created_by)
    select d.profile_id, v_type, p_title, p_body, p_link, v_uid
    from public.comunicado_destinatarios(p_scope_type, p_scope_value, v_uid) d
    where p_importante or d.aceita_notificacao;
    get diagnostics v_count = row_count;
  end if;

  select count(*) filter (where coalesce(trim(d.email),'') <> ''),
         count(*) filter (where coalesce(trim(d.email),'') =  '')
    into v_com_email, v_sem_email
  from public.comunicado_destinatarios(p_scope_type, p_scope_value, v_uid) d;

  insert into public.rh_comunicados
    (titulo, corpo, scope_type, scope_value, importante, canais, enviado_por,
     alcance_plataforma, alcance_email, sem_email, email_status)
  values
    (p_title, p_body, p_scope_type, p_scope_value, p_importante, p_canais, v_uid,
     v_count,
     case when v_quer_email then v_com_email else 0 end,
     case when v_quer_email then v_sem_email else 0 end,
     case when v_quer_email then 'pendente' else 'nao_solicitado' end)
  returning id into v_id;

  return jsonb_build_object(
    'comunicado_id', v_id,
    'alcance_plataforma', v_count,
    'alcance_email', case when v_quer_email then v_com_email else 0 end,
    'sem_email', case when v_quer_email then v_sem_email else 0 end
  );
end;
$$;
revoke all on function public.broadcast_announcement(text, text, text, text, jsonb, boolean, text[]) from public, anon;
grant execute on function public.broadcast_announcement(text, text, text, text, jsonb, boolean, text[]) to authenticated;
