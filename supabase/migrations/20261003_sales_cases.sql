-- sales_cases: casos de prospecção (ganho/perdido/andamento) registrados
-- pelo time comercial por voz ou texto, pra virar munição de playbook de
-- vendas. Companion table da edge function caso-prospeccao-voz — mesmo
-- padrão do crm-ata-voz: a IA só propõe (transcreve + estrutura), quem grava
-- é a tela, com aceite explícito do usuário, usando o JWT dele (RLS decide o
-- que pode ser gravado). Nunca service_role.
--
-- NÃO é posvenda_cases (isso é pipeline de onboarding pós-venda, domínio
-- diferente) nem um substituto de leads.activities (que já guarda a ata de
-- visita por voz como item da timeline de um negócio aberto). sales_cases é
-- deliberadamente um registro à parte, pensado pra virar dataset revisável
-- (ganhamos/perdemos/andamento + lição aprendida), inclusive pra prospecção
-- que ainda nem é lead/cliente formal — daí não herdar escopo de company
-- via join com leads/clients (nem sempre existe um pra herdar de) e ter sua
-- própria coluna company_id, mesma convenção de leads.company_id.

create table public.sales_cases (
  id uuid primary key default gen_random_uuid(),

  -- Mesma convenção/valores de leads.company_id (NOT NULL lá também) — não
  -- usar "frente" (rh_frente_model), que é vocabulário exclusivo de RH.
  company_id text not null check (company_id = any (array['industria', 'resibag', 'montemor'])),

  client_id uuid references public.clients(id) on delete set null,
  lead_id text references public.leads(id) on delete set null,

  cliente_nome text not null,
  setor text,
  resultado text check (resultado in ('ganhamos', 'perdemos', 'andamento')),
  situacao text,
  sinais text,
  objecao_principal text,
  concorrente text,
  licao text,

  -- Tag(s) da lição pra dar pra filtrar o playbook por tema depois, em vez
  -- de reler texto livre. Vocabulário fechado curto e sugerido pela própria
  -- IA (não digitado) — array porque um caso pode carregar mais de um tema
  -- (ex.: preço + concorrência). Mesmo padrão de array-CHECK já usado em
  -- rh_candidatos.frente_origem (<@ ARRAY[...]).
  categoria_licao text[] not null default '{}'
    check (categoria_licao <@ array['preco', 'prazo-entrega', 'certificacao-compliance', 'decisor-relacionamento', 'concorrencia', 'produto-especificacao']),

  raw_transcript text,
  source text not null default 'voz' check (source in ('voz', 'texto')),

  -- on delete set null (não cascade): o caso é conhecimento pro playbook,
  -- não um registro filho de leads/activities — sobrevive à saída do
  -- vendedor ou à exclusão do negócio/cliente que originou o relato.
  created_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sales_cases is
  'Casos de prospecção (ganho/perdido/andamento) relatados por voz ou texto pelo time comercial — munição pro playbook de vendas. Companion da edge function caso-prospeccao-voz. Não confundir com posvenda_cases (pipeline de onboarding pós-venda).';

create index sales_cases_company_id_idx on public.sales_cases (company_id);
create index sales_cases_created_by_idx on public.sales_cases (created_by);
create index sales_cases_created_at_idx on public.sales_cases (created_at desc);
create index sales_cases_client_id_idx on public.sales_cases (client_id) where client_id is not null;
create index sales_cases_lead_id_idx on public.sales_cases (lead_id) where lead_id is not null;

alter table public.sales_cases enable row level security;

-- updated_at trigger — mesma convenção de personal_tasks_set_updated_at /
-- crm_viagem_prestacoes_set_updated_at (uma função por tabela, não uma
-- compartilhada; search_path travado por padrão de segurança do projeto).
create or replace function public.sales_cases_set_updated_at()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger sales_cases_updated_at
  before update on public.sales_cases
  for each row execute function public.sales_cases_set_updated_at();

-- RLS — mesmo espírito de lead_samples (criador + gerente/admin escopados
-- por empresa), com a leitura de diretoria também liberada (mesmo padrão de
-- activities_diretoria_read), já que o propósito declarado é "revisar
-- depois" por quem está acima do vendedor de campo.
--
-- DELETE fica só pra admin (padrão mais perto de activities, que não tem
-- policy de DELETE nenhuma — trilha que não devia sumir por engano). Isso é
-- uma escolha, não a única certa: dá pra abrir pro próprio criador apagar
-- até virar revisão de gerente, no estilo crm_viagem_prestacoes
-- (status='rascunho'). Sinalizado como decisão em aberto na entrega.

create policy sales_cases_select on public.sales_cases
  for select
  using (
    current_user_is_admin()
    or current_user_has_role('diretoria')
    or (current_user_has_role('gerente') and company_id = any (current_user_companies()))
    or created_by = auth.uid()
  );

create policy sales_cases_insert on public.sales_cases
  for insert
  with check (
    current_user_is_admin()
    or (created_by = auth.uid() and company_id = any (current_user_companies()))
  );

create policy sales_cases_update on public.sales_cases
  for update
  using (
    current_user_is_admin()
    or (current_user_has_role('gerente') and company_id = any (current_user_companies()))
    or created_by = auth.uid()
  )
  with check (
    current_user_is_admin()
    or (current_user_has_role('gerente') and company_id = any (current_user_companies()))
    or created_by = auth.uid()
  );

create policy sales_cases_delete on public.sales_cases
  for delete
  using (current_user_is_admin());
