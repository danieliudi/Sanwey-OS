-- Achado F-13 (CRÍTICO) da auditoria funcional de 19/08/2026: prospect_seeds
-- (Explorador — contas-alvo com CNPJ, fit_score e o racional de por que cada
-- uma é alvo) tinha a policy de leitura `USING (enabled = true)`, sem NENHUM
-- escopo. Confirmado por simulação de RLS: as 48 sementes eram legíveis por
-- QUALQUER conta autenticada, inclusive a agência de marketing EXTERNA
-- (Beehave) e um vendedor de outra frente.
--
-- Escopa pelo mesmo padrão já usado em market_signals: admin vê tudo,
-- qualquer outro cargo só vê sementes cuja `relevant_for` cruza com as
-- empresas do próprio usuário, e papéis externos (agencia/cliente/
-- fornecedor) ficam de fora mesmo que tenham empresa em comum — essa lista
-- nunca deveria ser vista por quem não é do próprio Grupo.
--
-- 3 de 48 sementes têm `relevant_for` vazio hoje — ficam visíveis só para
-- admin depois desta migration (antes eram, incorretamente, visíveis a
-- todo mundo). É a postura fail-closed correta: sem empresa definida, quem
-- decide a quem atribuir é o admin.

drop policy if exists prospect_seeds_read_authenticated on public.prospect_seeds;

create policy prospect_seeds_read_scoped
  on public.prospect_seeds
  for select
  to authenticated
  using (
    enabled = true
    and not (current_user_roles() && array['agencia','cliente','fornecedor']::text[])
    and (
      current_user_is_admin()
      or relevant_for && current_user_companies()
    )
  );
