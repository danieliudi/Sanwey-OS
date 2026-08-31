-- Achado F-14 (ALTO) da auditoria funcional de 19/08/2026: agencia_sees_
-- supplier() tinha duas válvulas fail-OPEN — "p_supplier_id IS NULL" e
-- "supplier_id do próprio usuário IS NULL" — ambas abrindo acesso em vez de
-- fechar. Como 13 de 15 entregas não têm campaign_id (achado F-09), o
-- supplier_id da campanha nunca resolve, a válvula (1) abria, e a agência
-- externa Beehave enxergava 15 de 15 entregas contra 13 de 15 da própria
-- gerente de Marketing (medido por simulação de RLS).
--
-- Troca pra fail-closed: sem fornecedor identificado dos dois lados, a
-- agência NÃO vê. Também troca current_user_role() (coluna escalar legada)
-- por current_user_roles() (roles[], fonte de verdade multi-cargo — mesma
-- classe de achado do AL-06/MD-11 do relatório de segurança).

create or replace function public.agencia_sees_supplier(p_supplier_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    'agencia' = any(current_user_roles())
    and p_supplier_id is not null
    and (select supplier_id from public.profiles where id = auth.uid()) = p_supplier_id;
$$;
