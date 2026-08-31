-- Central de Pedidos: as duas travas decididas com o Daniel 12/08/2026.
-- Aplicada em produção na mesma data.
--
-- 1) Confirmar exige o número do Kronosys. Confirmado sem número é
--    exatamente o pedido que some — ninguém sabe se subiu no ERP, e o
--    cliente vê "confirmado" no portal sem nada por trás.
-- 2) Voltar card é livre, mas fica registrado quem moveu. Engessar cedo faz
--    o time trabalhar por fora; sem registro, ninguém reconstrói o que houve.

create table public.order_stage_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  de text,
  para text not null,
  moved_by uuid references auth.users(id) on delete set null,
  moved_at timestamptz not null default now()
);
create index idx_order_stage_history_order on public.order_stage_history(order_id, moved_at desc);
alter table public.order_stage_history enable row level security;

-- Quem enxerga o pedido enxerga o histórico dele. Sem policy de escrita: só
-- o trigger grava (SECURITY DEFINER), então não há como forjar uma linha.
create policy order_stage_history_read on public.order_stage_history for select
  using (exists (select 1 from public.orders o where o.id = order_stage_history.order_id));

create or replace function public.orders_guard_stage_change()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.situacao is not distinct from old.situacao then
    return new;
  end if;

  -- Trava do Kronosys. Vale por qualquer caminho, não só pelo botão.
  if new.situacao in ('confirmado','producao','faturado')
     and coalesce(trim(new.kronosys_numero), '') = '' then
    raise exception 'Informe o número do pedido no Kronosys antes de confirmar. Sem ele, o cliente vê "confirmado" no portal sem nada por trás no ERP.'
      using errcode = 'check_violation';
  end if;

  -- Carimbo de confirmação: quem e quando. Preenchido pelo banco pra não
  -- depender de a tela lembrar de mandar.
  if new.situacao = 'confirmado' and old.situacao <> 'confirmado' then
    new.confirmed_by := coalesce(new.confirmed_by, auth.uid());
    new.confirmed_at := coalesce(new.confirmed_at, now());
  end if;

  insert into public.order_stage_history (order_id, de, para, moved_by)
  values (new.id, old.situacao, new.situacao, auth.uid());

  return new;
end; $$;

create trigger trg_orders_guard_stage
  before update of situacao on public.orders
  for each row execute function public.orders_guard_stage_change();

-- Módulo "pedidos": espelhado em current_user_has_module() (mesma lista de
-- commercial-overview/crm/clients) e nascendo em "test" na chave global —
-- só admin vê até liberar em Configurações → Módulos.
insert into public.module_states (module_id, state) values ('pedidos','test')
  on conflict (module_id) do update set state='test';

-- ─────────────────────────────────────────────────────────────────────────
-- Verificado em produção, 4 casos em transação revertida
-- ─────────────────────────────────────────────────────────────────────────
-- Confirmar SEM número → recusado · mover pra Conferência sem número →
-- permitido · confirmar COM número → permitido e carimba confirmed_at ·
-- voltar de Confirmado pra Conferência → permitido, e as 3 movimentações
-- ficaram no histórico com quem moveu.
