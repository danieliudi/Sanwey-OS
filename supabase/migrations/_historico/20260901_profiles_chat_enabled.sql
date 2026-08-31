-- Liberar/bloquear Chat por usuário, via painel do admin (pedido do Daniel,
-- 10/08/2026). Enforcement real na RLS (chat_is_member), não só esconder o
-- item de menu no frontend — um usuário desativado não consegue ler nem
-- escrever em canal nenhum, nem baixar/enviar anexo (chat_is_member já é o
-- choke point de chat_messages/chat_channels/chat_channel_members/storage
-- de anexos, confirmado via pg_policies antes de escrever esta migration).

alter table public.profiles
  add column if not exists chat_enabled boolean not null default true;

-- Extensão do choke point único: chat_is_member já gatekeeper de leitura e
-- (via chat_can_post) escrita em todo o domínio de chat. Basta acrescentar
-- o check aqui, sem tocar em cada política individualmente.
create or replace function public.chat_is_member(p_channel uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select
    coalesce((select chat_enabled from public.profiles where id = auth.uid()), true)
    and exists (
      select 1 from public.chat_channel_members
      where channel_id = p_channel and user_id = auth.uid()
    );
$function$;

-- Self-escalation: sem isto, um usuário desativado pelo admin conseguiria
-- reativar o próprio chat via UPDATE na própria linha de profiles (mesma
-- classe de bug já corrigida antes pra role/roles/companies/etc — ver
-- profiles_prevent_self_role_escalation, ela já intercepta todo self-UPDATE
-- de não-admin). Só falta incluir a coluna nova na lista que ela protege.
create or replace function public.profiles_prevent_self_role_escalation()
returns trigger
language plpgsql
as $function$
BEGIN
  IF auth.uid() = NEW.id AND NOT current_user_is_admin() THEN
    NEW.role := OLD.role;
    NEW.roles := OLD.roles;
    NEW.companies := OLD.companies;
    NEW.sectors := OLD.sectors;
    NEW.supervisor_id := OLD.supervisor_id;
    NEW.employee_status := OLD.employee_status;
    NEW.job_title := OLD.job_title;
    NEW.department := OLD.department;
    NEW.contract_type := OLD.contract_type;
    NEW.admission_date := OLD.admission_date;
    NEW.frente := OLD.frente;
    NEW.supplier_id := OLD.supplier_id;
    NEW.chat_enabled := OLD.chat_enabled;
  END IF;
  RETURN NEW;
END;
$function$;
