-- Casos de prospecção comercial (ganhamos/perdemos/andamento) — munição pro
-- playbook de vendas, capturados por voz ou texto pelo vendedor de campo,
-- mesmo padrão de baixa fricção do crm-ata-voz: a edge function
-- caso-prospeccao-voz só PROPÕE um rascunho, nunca escreve aqui — quem grava
-- é a tela, com aceite explícito do vendedor, usando o JWT de quem chamou
-- (RLS abaixo decide o que ele pode gravar). Nunca service_role.
--
-- NÃO é posvenda_cases (pipeline de onboarding pós-venda com stage/value —
-- domínio diferente) nem lead_activities (feed de atividade de um negócio já
-- aberto) — é um registro autônomo, deliberadamente fora do funil, porque
-- nem todo caso de prospecção tem (ou precisa ter) um negócio formal por
-- trás. client_id/lead_id são só um vínculo opcional quando fizer sentido.

create table public.sales_cases (
  id uuid primary key default gen_random_uuid(),

  client_id uuid references public.clients(id) on delete set null,
  lead_id text references public.leads(id) on delete set null,
  cliente_nome text not null,
  setor text,

  -- NOT NULL: diferente de sinais/licao (genuinamente opcionais — nem toda
  -- visita tem algo surpreendente ou uma lição clara), todo caso registrado
  -- tem que ser classificado por resultado pra servir de playbook — sem
  -- isso a lista de revisão (critério de aceite) fica sem o dado mais
  -- básico pra agrupar/filtrar. O rascunho da IA pode devolver null (schema
  -- da function permite); a TELA exige a escolha antes de habilitar
  -- "Confirmar e salvar" — não é validação prematura (só bloqueia no
  -- submit, igual campo obrigatório de qualquer formulário), é o mesmo
  -- princípio que já protege `resultado` na posvenda_cases (regra do
  -- Léo/Daniel: histórico comercial errado é pior que faltando).
  resultado text not null check (resultado in ('ganhamos', 'perdemos', 'andamento')),

  situacao text,   -- o que aconteceu
  sinais text,     -- o que surpreendeu / lacuna percebida
  licao text,      -- o que isso ensina pra um vendedor novo

  raw_transcript text,              -- transcrição bruta, quando veio de voz
  source text not null default 'voz' check (source in ('voz', 'texto')),

  -- Valores de public.clients.company_ids / public.leads.company_id
  -- (src/constants/companies.js COMPANY_IDS) — "Sanwey" no dia a dia é o id
  -- "industria" no banco, não "sanwey". "montemor" fica de fora de propósito:
  -- não é frente vendedora (MARKETING_UNIT_IDS existe exatamente pra separar
  -- as unidades que só consomem Marketing das que vendem) — não faz sentido
  -- como resultado de prospecção. NOT NULL: ver pergunta em aberto na
  -- resposta — nullable quebraria a visibilidade de sales_cases_select
  -- abaixo pra todo mundo que não é admin (frente = ANY(array) nunca é TRUE
  -- quando frente é null), o que ia contra o próprio objetivo da tabela
  -- (munição de playbook visível pro time, não só pro admin).
  frente text not null check (frente = any (array['industria', 'resibag'])),

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sales_cases enable row level security;

comment on table public.sales_cases is
  'Casos de prospecção (ganho/perdido/andamento) capturados por voz ou texto pro playbook de vendas. Escrita só pela tela, com aceite do vendedor via RLS do próprio usuário — nunca service_role. Ver supabase/functions/caso-prospeccao-voz.';

-- Leitura: mesmo grupo de papel de leads_select (vendedor/gerente/consultor
-- na frente, mais admin) — mas, ao contrário de leads_select, SEM filtro de
-- owner_ids/subordinados. Diferente de um negócio (que é "do vendedor"), um
-- caso de prospecção é material de playbook: o objetivo declarado é o time
-- inteiro aprender com o caso de qualquer colega na mesma frente, não só
-- quem registrou. Desvio deliberado do predicado da tabela-irmã, não
-- descuido — registrado aqui pra próxima revisão de segurança não achar
-- que é um gap.
create policy sales_cases_select on public.sales_cases for select
  using (
    current_user_is_admin()
    or (
      current_user_roles() && array['gerente', 'vendedor', 'consultor']::text[]
      and frente = any (current_user_companies())
    )
  );

-- Escrita: mesmo papel/escopo de leads_insert — quem pode abrir um negócio
-- pode registrar um caso na mesma frente.
create policy sales_cases_insert on public.sales_cases for insert
  with check (
    (current_user_is_admin() or current_user_roles() && array['gerente', 'vendedor', 'consultor']::text[])
    and frente = any (current_user_companies())
  );

-- Exclusão: mesmo predicado de leads_delete/clients_delete — só admin ou
-- gerente da própria frente. Sem policy de UPDATE de propósito: a tela não
-- edita um caso depois de salvo (o ajuste acontece no rascunho, antes do
-- "Confirmar e salvar" — mesmo princípio do crm-ata-voz), então não existe
-- hoje nenhum caminho de escrita que precise dela. Ausência de policy aqui
-- é o mesmo padrão já usado (e documentado) em BX-04 — nega por padrão até
-- existir uma tela que precise editar, não um gap a preencher às pressas.
create policy sales_cases_delete on public.sales_cases for delete
  using (
    current_user_is_admin()
    or (current_user_has_role('gerente') and frente = any (current_user_companies()))
  );

create or replace function public.sales_cases_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger sales_cases_updated_at
  before update on public.sales_cases
  for each row execute function public.sales_cases_set_updated_at();

create index sales_cases_frente_idx on public.sales_cases (frente);
create index sales_cases_client_id_idx on public.sales_cases (client_id);
create index sales_cases_resultado_idx on public.sales_cases (resultado);
create index sales_cases_created_by_idx on public.sales_cases (created_by);
create index sales_cases_created_at_idx on public.sales_cases (created_at desc);
