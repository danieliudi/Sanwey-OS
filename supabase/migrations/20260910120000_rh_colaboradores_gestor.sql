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
--
-- POR QUE INVOKER e não SECURITY DEFINER: a travessia lê rh_colaboradores sob
-- a RLS de quem está escrevendo, e isso só é seguro porque as duas policies da
-- tabela são por CARGO e não por linha — quem pode dar UPDATE enxerga todas as
-- linhas, então a subida nunca para no meio por falta de visibilidade. Essa
-- garantia DEPENDE de MD-10 (escopo de rh_colaboradores é o Grupo inteiro).
-- No dia em que entrar uma policy por linha nesta tabela (ex.: "colaborador lê
-- só a própria ficha"), esta função precisa virar SECURITY DEFINER no MESMO
-- commit, senão a trava passa a ter ponto cego em silêncio.
create or replace function public.rh_colaboradores_check_gestor_cycle()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_cursor uuid := new.gestor_id;
  v_saltos int := 0;
begin
  -- `update of gestor_id` dispara sempre que a coluna aparece no SET, mudando
  -- de valor ou não — e o front grava a linha inteira a cada save. Sem esta
  -- saída, mudar status em massa ou salvar uma atividade percorreria a cadeia
  -- à toa, e numa base com ciclo pré-existente seria RECUSADA com "provável
  -- ciclo" por uma edição que não tem nada a ver com hierarquia.
  if tg_op = 'UPDATE' and new.gestor_id is not distinct from old.gestor_id then
    return new;
  end if;

  if new.gestor_id is null then
    return new;
  end if;

  if new.gestor_id = new.id then
    raise exception 'Um colaborador não pode ser o próprio gestor.';
  end if;

  -- Serializa só quem está mexendo em hierarquia. Sem isto a validação é
  -- TOCTOU: duas transações simultâneas (A.gestor:=B e B.gestor:=A) leem o
  -- estado antigo, as duas aprovam, e o ciclo entra. Import em lote é
  -- exatamente onde escrita concorrente acontece — que é um dos motivos de a
  -- trava estar aqui e não na tela.
  perform pg_advisory_xact_lock(hashtext('rh_colaboradores_gestor_id'));

  -- Sobe a cadeia a partir do gestor proposto. Se reencontrar o próprio
  -- colaborador, o vínculo fecharia um laço.
  while v_cursor is not null and v_saltos < 50 loop
    if v_cursor = new.id then
      raise exception 'Esse vínculo criaria um ciclo na hierarquia.';
    end if;
    select gestor_id into v_cursor from public.rh_colaboradores where id = v_cursor;
    v_saltos := v_saltos + 1;
  end loop;

  -- Testa o CURSOR, não a contagem: uma cadeia legítima de exatamente 50
  -- ancestrais termina com v_cursor nulo e v_saltos = 50, e seria recusada
  -- por engano. Só interessa o caso em que a subida foi interrompida.
  if v_cursor is not null then
    raise exception 'Cadeia de gestores profunda demais — provável ciclo pré-existente.';
  end if;

  return new;
end;
$$;

drop trigger if exists rh_colaboradores_gestor_cycle on public.rh_colaboradores;
create trigger rh_colaboradores_gestor_cycle
  before insert or update of gestor_id on public.rh_colaboradores
  for each row execute function public.rh_colaboradores_check_gestor_cycle();
