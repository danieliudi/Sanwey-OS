-- Campo "Gestor" na ficha do colaborador.
--
-- Mockup aprovado pelo Daniel em 10/09/2026 (regra 3 do CLAUDE.md).
-- Nasceu da análise do material de RH: avaliação 360, feedback líder↔liderado
-- e mentoria dependem de saber quem responde a quem, e isso não existia.
--
-- POR QUE NÃO REAPROVEITAR `profiles.supervisor_id` (regra 1 manda reaproveitar
-- antes de criar): aquele campo já existe e já significa "chefe", MAS ele é o
-- supervisor COMERCIAL — `CRMView.jsx:386`, `PosVendaView.jsx:873`,
-- `DashboardView.jsx:45` e `AbmAccountsView.jsx:76` o usam pra decidir QUAIS
-- LEADS a pessoa enxerga, e o seletor em UserManagementView só lista
-- vendedores. Se o RH mexesse nele pra definir avaliador, mudaria a
-- visibilidade de lead de alguém sem querer. Além disso ele vive em
-- `profiles`, então cobre só quem tem login (14 dos 15 colaboradores hoje).
-- São dois conceitos com o mesmo nome popular; ficam separados de propósito.
-- Se um dia forem unificados, é decisão do Daniel e passa por desacoplar
-- primeiro o escopo de leads.

alter table public.rh_colaboradores
  add column if not exists gestor_id uuid
    references public.rh_colaboradores(id) on delete set null;

comment on column public.rh_colaboradores.gestor_id is
  'Gestor direto (RH). Não confundir com profiles.supervisor_id, que é o supervisor comercial e controla escopo de leads.';

-- A busca real é sempre "quem reporta a X" (o recíproco "Lidera N pessoas" e
-- o filtro "Minha equipe"), então o índice é pelo gestor, não pelo liderado.
create index if not exists rh_colaboradores_gestor_id_idx
  on public.rh_colaboradores(gestor_id)
  where gestor_id is not null;

-- Trava de ciclo. Sem ela, A→B→A faz "Lidera N pessoas" e qualquer subida de
-- cadeia entrarem em recursão infinita. Barrado no banco e não só na tela
-- porque a tela não é o único caminho de escrita (import, SQL, agente).
create or replace function public.rh_colaboradores_check_gestor_cycle()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_cursor uuid := new.gestor_id;
  v_saltos int := 0;
begin
  if new.gestor_id is null then
    return new;
  end if;

  if new.gestor_id = new.id then
    raise exception 'Um colaborador não pode ser o próprio gestor.';
  end if;

  -- Sobe a cadeia a partir do gestor proposto. Se reencontrar o próprio
  -- colaborador, o vínculo fecharia um laço. O teto de 50 saltos é rede de
  -- segurança contra laço pré-existente que a trava não tenha visto.
  while v_cursor is not null and v_saltos < 50 loop
    if v_cursor = new.id then
      raise exception 'Esse vínculo criaria um ciclo na hierarquia (% já reporta, direta ou indiretamente, a %).',
        new.gestor_id, new.id;
    end if;
    select gestor_id into v_cursor from public.rh_colaboradores where id = v_cursor;
    v_saltos := v_saltos + 1;
  end loop;

  if v_saltos >= 50 then
    raise exception 'Cadeia de gestores profunda demais — provável ciclo pré-existente.';
  end if;

  return new;
end;
$$;

drop trigger if exists rh_colaboradores_gestor_cycle on public.rh_colaboradores;
create trigger rh_colaboradores_gestor_cycle
  before insert or update of gestor_id on public.rh_colaboradores
  for each row execute function public.rh_colaboradores_check_gestor_cycle();
