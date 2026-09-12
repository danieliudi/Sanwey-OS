-- Reconstrução do banco a partir das migrations: os GRANTs faltavam inteiros.
--
-- ACHADO DE 11/09/2026, testando outra coisa numa branch descartável. Uma
-- branch nasce aplicando as migrations versionadas — e o resultado tinha
-- ZERO privilégio de tabela pra `authenticated`: 0 de 125 tabelas, contra
-- 125 de 125 em produção. Também faltava EXECUTE em funções que produção
-- concede (`current_user_subordinate_ids`, `current_user_is_admin`).
--
-- O que isso significa na prática: HOJE não existe caminho testado pra
-- recriar este banco a partir do repositório. Produção está certa; o que
-- estava errado era a reconstrução. Atinge recuperação de desastre e o job
-- "Matriz de RLS de etapas" do CI, que sobe o banco do zero — ele vinha
-- rodando contra um ambiente que não parece com produção.
--
-- POR QUE NÃO É "AFROUXAR A SEGURANÇA". Nesta plataforma o portão é a RLS,
-- não o GRANT: todo papel tem DML nas tabelas e a policy decide linha a
-- linha. Conferido em produção — anon, authenticated e service_role têm
-- SELECT/INSERT/UPDATE/DELETE nas 125 tabelas. Esta migration reproduz esse
-- estado, não inventa um novo.
--
-- A LISTA DE REVOKE ABAIXO NÃO É DECORATIVA. O `grant ... on all functions`
-- passaria por cima das negações deliberadas (cota de IA, alocação de
-- protocolo, `comunicado_destinatarios`, e as 45 que anon não pode chamar).
-- Por isso ela vem depois, e foi GERADA a partir de produção em 11/09/2026,
-- não escrita de memória. Função de GATILHO ficou de fora de propósito: o
-- Postgres recusa chamada direta a ela, então o grant é inócuo.
--
-- AO ACRESCENTAR FUNÇÃO NOVA que não deva ser chamável, o revoke nominal vai
-- na migration dela (CLAUDE.md 3.1) — e também aqui, senão a reconstrução a
-- reabre. Duas listas é duplicação conhecida; a saída de verdade é refazer o
-- baseline a partir de um dump de produção, e isso é decisão à parte.
--
-- COMO acrescentar (acrescentado 11/09/2026): a função nova nasce numa
-- migration de timestamp MAIOR que esta, então numa reconstrução ela ainda
-- não existe quando este arquivo roda — um `revoke` seco aqui aborta a
-- reconstrução, que é justamente o que esta migration existe pra consertar.
-- Por isso a lista de baixo, "funções posteriores", passa por
-- `to_regprocedure`: revoga se já existir, ignora se ainda não. Na
-- reconstrução quem garante a negação é a migration da própria função; aqui
-- a linha serve pra quando esta lista for reexecutada sobre um banco já
-- completo.

alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions  to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
grant all     on all tables    in schema public to anon, authenticated, service_role;
grant all     on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- ── Negações deliberadas, reaplicadas ──────────────────────────────────────
-- authenticated (5)
revoke execute on function public.ai_org_quota_increment(uuid,integer) from authenticated;
revoke execute on function public.allocate_marketing_protocol_number(text,uuid) from authenticated;
revoke execute on function public.chat_sync_membership_for_channel(uuid,uuid,text,text[]) from authenticated;
revoke execute on function public.comunicado_destinatarios(text,text,uuid) from authenticated;
revoke execute on function public.external_api_daily_increment(text,uuid) from authenticated;

-- anon (45)
revoke execute on function public.ai_org_quota_increment(uuid,integer) from anon;
revoke execute on function public.allocate_marketing_protocol_number(text,uuid) from anon;
revoke execute on function public.approve_marketing_quote(uuid) from anon;
revoke execute on function public.approve_marketing_request(uuid,text) from anon;
revoke execute on function public.approve_marketing_request_as_purchase(uuid,text) from anon;
revoke execute on function public.approve_marketing_request_as_task(uuid,text) from anon;
revoke execute on function public.approve_purchase_request(uuid,uuid,uuid,numeric) from anon;
revoke execute on function public.approve_rh_data_update_request(uuid) from anon;
revoke execute on function public.approve_rh_movimentacao(uuid) from anon;
revoke execute on function public.broadcast_announcement(text,text,text,text,jsonb,boolean,text[]) from anon;
revoke execute on function public.chat_add_member(uuid,uuid) from anon;
revoke execute on function public.chat_can_manage(uuid) from anon;
revoke execute on function public.chat_channel_roster(uuid) from anon;
revoke execute on function public.chat_count_profiles_matching_filter(jsonb) from anon;
revoke execute on function public.chat_create_channel(text,text,text,uuid[],boolean,jsonb) from anon;
revoke execute on function public.chat_leave_channel(uuid) from anon;
revoke execute on function public.chat_remove_member(uuid,uuid) from anon;
revoke execute on function public.chat_set_member_admin(uuid,uuid,boolean) from anon;
revoke execute on function public.chat_sync_membership_for_channel(uuid,uuid,text,text[]) from anon;
revoke execute on function public.chat_update_channel(uuid,text,text,boolean) from anon;
revoke execute on function public.comunicado_alcance(text,text) from anon;
revoke execute on function public.comunicado_destinatarios(text,text,uuid) from anon;
revoke execute on function public.create_mention_notifications(uuid[],text,text,text,jsonb) from anon;
revoke execute on function public.crm_create_cross_module_deliverable(text,text[],text,text,timestamp with time zone) from anon;
revoke execute on function public.enviar_pesquisa_notificacao(uuid) from anon;
revoke execute on function public.external_api_daily_increment(text,uuid) from anon;
revoke execute on function public.get_client_timeline(uuid) from anon;
revoke execute on function public.get_colaborador_connections(uuid) from anon;
revoke execute on function public.get_my_colaborador() from anon;
revoke execute on function public.get_purchase_request_number(uuid) from anon;
revoke execute on function public.get_supplier_last_purchase_price(uuid,text) from anon;
revoke execute on function public.is_comercial_operator() from anon;
revoke execute on function public.is_comercial_support() from anon;
revoke execute on function public.is_comercial_support_for_client(uuid) from anon;
revoke execute on function public.is_own_colaborador(uuid) from anon;
revoke execute on function public.list_evento_campaigns() from anon;
revoke execute on function public.margin_check(text,uuid,numeric) from anon;
revoke execute on function public.mc_set_checklist(uuid,jsonb) from anon;
revoke execute on function public.pesquisa_respostas_aggregado(uuid) from anon;
revoke execute on function public.reject_marketing_quote(uuid,text) from anon;
revoke execute on function public.reject_purchase_request(uuid,text) from anon;
revoke execute on function public.reject_rh_data_update_request(uuid,text) from anon;
revoke execute on function public.reject_rh_movimentacao(uuid,text) from anon;
revoke execute on function public.rh_submit_self_rating(uuid,numeric) from anon;
revoke execute on function public.uniform_can_write() from anon;

-- ── Funções criadas DEPOIS desta migration ─────────────────────────────────
-- Guardadas por `to_regprocedure` pelo motivo explicado no cabeçalho: numa
-- reconstrução limpa elas ainda não existem quando este arquivo roda.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.abrir_documentos_admissao(uuid)',
    'public.importar_colaboradores(jsonb,boolean)',
    'public.is_own_colaborador_folder(text)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from anon', f);
    end if;
  end loop;
end $$;
