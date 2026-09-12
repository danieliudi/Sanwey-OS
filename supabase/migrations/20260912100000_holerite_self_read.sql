-- O colaborador volta a conseguir baixar o PRÓPRIO holerite, cartão de ponto e
-- anexo de onboarding.
--
-- BUG PRÉ-EXISTENTE, achado em 11/09/2026 enquanto eu escrevia a policy dos
-- documentos de admissão — e evitado lá justamente por causa disto.
--
-- A policy `rh_attachments_self_read` (de 20260739) pergunta, em linha:
--
--   exists (select 1 from rh_colaboradores c
--            where c.profile_id = auth.uid() and ... = c.id::text)
--
-- Policy de `storage.objects` é avaliada com a ROLE DE QUEM PEDE, então esse
-- subselect sofre a RLS de `rh_colaboradores` — e `rh_colaboradores` não tem
-- policy de self-read: as únicas são as de RH, diretoria e DP. O colaborador
-- comum enxerga ZERO linhas ali, o `exists` é sempre falso, e o download é
-- negado pra todo mundo que não é RH.
--
-- Medido em produção em 11/09/2026, num funcionário real (cargos
-- vendedor/marketing), dentro de transação com rollback:
--
--   linhas de rh_colaboradores que ele enxerga ......... 0
--   is_own_colaborador(<id dele>)  (SECURITY DEFINER) ... true
--   o predicado inline da policy atual .................. false
--
-- Ou seja: o registro É dele, e a policy diz que não. Não é caso de borda,
-- é todo colaborador desde que a policy existe.
--
-- A correção é a mesma lição registrada na migration dos documentos de
-- admissão: comparação que precisa enxergar `rh_colaboradores` tem que passar
-- por função SECURITY DEFINER, nunca por subselect inline.

-- Recebe TEXTO, não uuid, de propósito: o segundo segmento do caminho vem de
-- `storage.foldername(name)` e pode ser qualquer coisa que alguém tenha
-- gravado no bucket. Um `::uuid` num caminho malformado não devolve falso —
-- levanta erro e derruba a consulta inteira, inclusive pras linhas boas.
create or replace function public.is_own_colaborador_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.rh_colaboradores
    where profile_id = (select auth.uid())
      and id::text = p_folder
  );
$$;
revoke all on function public.is_own_colaborador_folder(text) from public, anon;
grant execute on function public.is_own_colaborador_folder(text) to authenticated;

-- O escopo por pasta continua EXATAMENTE o de antes — 'onboarding', 'holerite'
-- e 'ponto', nada além. A correção é só de mecanismo: o que muda é COMO a
-- pergunta "essa pasta é dele?" é respondida, não QUAIS pastas ele alcança.
drop policy if exists rh_attachments_self_read on storage.objects;
create policy rh_attachments_self_read on storage.objects
  for select
  using (
    bucket_id = 'rh-attachments'
    and (storage.foldername(name))[1] in ('onboarding','holerite','ponto')
    and public.is_own_colaborador_folder((storage.foldername(name))[2])
  );
