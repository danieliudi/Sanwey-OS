-- Achado da revisão de QA (11/08/2026): lead_emails_select foi espelhada em
-- activities_select (regra 3.1 do CLAUDE.md manda comparar com a tabela-irmã
-- mais próxima), mas activities_select está desatualizada em relação ao
-- modelo de acesso REAL de leads hoje — leads_select já migrou pra
-- owner_ids (array, multi-dono), ganhou fronteira de setor pra lead sem
-- dono, e tem ramo de consultor, nada disso existe em activities_select.
-- Corrigido pra espelhar leads_select diretamente (a fonte de verdade real),
-- não a tabela-irmã desatualizada.
drop policy if exists lead_emails_select on public.lead_emails;

create policy lead_emails_select on public.lead_emails
  for select
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_emails.lead_id
        and (
          current_user_is_admin()
          or (current_user_has_role('gerente'::text) and l.company_id = any (current_user_companies()))
          or (
            current_user_has_role('vendedor'::text)
            and l.company_id = any (current_user_companies())
            and (
              (auth.uid())::text = any (l.owner_ids)
              or l.owner_ids && current_user_subordinate_ids()
              or (l.owner_ids = '{}'::text[] and l.sector is not null and l.sector = any (current_user_sectors()))
            )
          )
          or (
            current_user_has_role('consultor'::text)
            and l.company_id = any (current_user_companies())
            and (auth.uid())::text = any (l.owner_ids)
          )
        )
    )
  );
