-- Fila de prospects aprovados (mockup aprovado pelo Daniel, 03/09/2026).
--
-- Problema que isto resolve: aprovar um prospect em Agentes não levava a
-- lugar nenhum. Medido em 03/09/2026 — 24 prospects aprovados, 0 viraram
-- lead ou cliente (conferido por CNPJ, não por nome). A causa está em
-- agent-gateway/index.ts:580: ao aprovar, o gateway dispara três efeitos e
-- NENHUM trata `sugestao_prospect`; o caminho nunca foi construído.
--
-- Decisão de produto (Daniel, 03/09/2026): o prospect aprovado NÃO vira card
-- automaticamente. Ele entra numa fila de onde o vendedor puxa, e só então
-- nasce o card. Isso mantém de pé a regra do piloto entregue ao time — "card
-- nasce de uma conversa comercial de verdade" — em vez de encher o funil de
-- 24 cards sem conversa e sem próxima ação, que é exatamente o padrão de
-- "cards parados" que o piloto existe pra corrigir.

-- ── 1. Leitura ───────────────────────────────────────────────────────────
-- Achado que motivou esta policy: hoje o vendedor NÃO enxerga prospect
-- aprovado. `agent_actions_seller_read` exige `lead_id IS NOT NULL` e que o
-- lead seja dele — e prospect aprovado, por definição, ainda não tem lead
-- (conferido: os 24 têm lead_id nulo). Sem isto a fila nasceria vazia.
--
-- Escopo espelhado em `agent_actions_manager_all`, a policy-irmã mais
-- próxima: mesmo filtro por empresa via current_user_companies(). A
-- diferença é que aqui ele é ESTREITO por tipo e status — o vendedor não
-- passa a ver a fila de agentes, vê só prospect que já foi aprovado.
--
-- `company_id IS NULL` fica de fora de propósito (a manager_all aceita):
-- sugestão sem empresa não pertence a frente nenhuma, e vendedor é sempre
-- escopado por frente.
create policy agent_actions_seller_prospect_read on public.agent_actions
  for select
  using (
    action_type = 'sugestao_prospect'
    and status  = 'approved'
    and company_id = any (public.current_user_companies())
    and public.current_user_has_role('vendedor')
  );

-- ── 2. Puxar ─────────────────────────────────────────────────────────────
-- Por que uma função e não uma policy de UPDATE: com UPDATE direto, o
-- `with check` garante o status final, mas RLS não restringe COLUNA — o
-- vendedor poderia reescrever `payload`, `title` ou a evidência da sugestão
-- ao puxá-la. Aqui ele não recebe UPDATE nenhum: a função faz as duas
-- escritas (cria o lead, marca a sugestão) numa transação só, então também
-- não existe meio-estado com lead criado e sugestão ainda na fila.
--
-- SECURITY DEFINER bypassa RLS, então TODA autorização é feita à mão aqui
-- dentro — é o que as três checagens abaixo fazem, nessa ordem.
create or replace function public.puxar_prospect_sugerido(p_action_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_acao    public.agent_actions%rowtype;
  v_payload jsonb;
  v_lead    uuid;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  if not public.current_user_has_role('vendedor') then
    raise exception 'Só vendedor puxa prospect da fila.' using errcode = '42501';
  end if;

  -- FOR UPDATE: dois vendedores clicando na mesma linha ao mesmo tempo — o
  -- segundo espera e depois não encontra mais em 'approved', então recebe a
  -- mensagem de "já puxada" em vez de criar um lead duplicado.
  select * into v_acao
    from public.agent_actions
   where id = p_action_id
     and action_type = 'sugestao_prospect'
     and status = 'approved'
     for update;

  if not found then
    raise exception 'Esta sugestão não está mais na fila — alguém já puxou.' using errcode = 'P0002';
  end if;

  if v_acao.company_id is null
     or not (v_acao.company_id = any (public.current_user_companies())) then
    raise exception 'Esta sugestão não é de uma frente sua.' using errcode = '42501';
  end if;

  v_payload := coalesce(v_acao.payload, '{}'::jsonb);

  -- `owner` E `owner_ids`: a plataforma lê os dois (getLeadOwnerIds cobre
  -- co-responsável). Gravar só o escalar deixaria o lead fora de filtros que
  -- usam o array.
  insert into public.leads (
    company_id, company, razao_social, cnpj, sector, city, state,
    fit_score, evidence, stage, owner, owner_ids, created_by
  ) values (
    v_acao.company_id,
    coalesce(nullif(v_payload->>'company', ''), v_acao.title),
    nullif(v_payload->>'razao_social', ''),
    nullif(v_payload->>'cnpj', ''),
    nullif(v_payload->>'sector', ''),
    nullif(v_payload->>'city', ''),
    nullif(v_payload->>'state', ''),
    coalesce(nullif(v_payload->>'fit_score', '')::int, 0),
    nullif(v_payload->>'evidence', ''),
    'prospeccao',
    v_uid::text,
    array[v_uid::text],
    v_uid
  ) returning id into v_lead;

  -- 'executed' é o fecho que o próprio gateway já descreve como legítimo
  -- ("humano aprova → executa → registra"). Sai da fila e fica o histórico.
  update public.agent_actions
     set status = 'executed', lead_id = v_lead,
         resolved_at = now(), resolved_by = v_uid
   where id = p_action_id;

  return v_lead;
end;
$$;

revoke all on function public.puxar_prospect_sugerido(uuid) from public, anon;
grant execute on function public.puxar_prospect_sugerido(uuid) to authenticated;

comment on function public.puxar_prospect_sugerido(uuid) is
  'Vendedor puxa um prospect aprovado da fila: cria o lead em Prospecção com ele como dono e marca a sugestão como executed, numa transação só. SECURITY DEFINER porque escreve em leads sob RLS — toda autorização é feita dentro da função (autenticado, cargo vendedor, empresa do prospect entre as dele).';
