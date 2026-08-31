-- Setor como fronteira de visibilidade — aprovado pelo Daniel 10/08/2026.
-- (Aplicado em produção via MCP; arquivado aqui pra o histórico de migrations
-- acompanhar o banco.)
--
-- O time de vendas é dividido por setor (Alimentício = Clayton e Fernando,
-- Químico = Geraldo e Lucas, etc). Até aqui o setor era só uma LENTE: o filtro
-- rodava no navegador (CRMView.jsx) e o servidor mandava tudo junto — quem
-- abrisse as ferramentas do navegador via o que a tela escondia.
--
-- Decisões aprovadas:
--   1. Histórico do cliente limitado ao setor (ver get_client_timeline).
--   2. Negócio sem dono aparece só pra quem atende aquele setor.
--   3. Vendedor pode acumular setores (o campo já é array).
--   4. Negócio SEM setor não some pro dono nem pra gerência — só não vaza pros
--      colegas de outro setor. É o que impede a parede de ganhar buraco quando
--      alguém esquece de preencher.

create or replace function public.current_user_sectors()
returns text[]
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(sectors, '{}'::text[]) from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_user_sectors() from public;
revoke execute on function public.current_user_sectors() from anon;
grant execute on function public.current_user_sectors() to authenticated;

-- leads_select / leads_update: cláusula do vendedor passa de
--   (owner_ids = '{}' OR meus OR subordinados)
-- para
--   (meus OR subordinados OR (sem dono AND setor bate))
-- Ver o corpo aplicado no banco; reproduzido em 20260905 no projeto.
