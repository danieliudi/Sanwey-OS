-- Agência passa a conseguir ler e anexar arquivo em entrega.
--
-- Pedido do Daniel em 10/09/2026: "da agência, não precisa ser fornecedor da
-- campanha. Não faz sentido. Deixa anexar."
--
-- O QUE ESTAVA ERRADO. Cinco policies de anexo (2 na tabela, 3 no Storage)
-- gateavam a agência por `agencia_sees_supplier(campanha.supplier_id)` — um
-- caminho entrega → campanha → fornecedor. Medido na revisão de segurança: das
-- 24 entregas, só 3 têm campanha, e NENHUMA dessas campanhas tem supplier_id.
-- O predicado é falso para 100% das entregas de hoje. Efeito prático: a
-- agência enxerga o card e não enxerga anexo nenhum — não baixa o briefing nem
-- sobe a peça pronta. Falha fechada, então nunca foi vulnerabilidade; era
-- funcionalidade que nunca funcionou.
--
-- A REGRA NOVA espelha o escopo de escrita da entrega (md_update), que é o
-- modelo que o Daniel já aprovou:
--   ler    → qualquer entrega que a agência já enxerga (a policy de SELECT de
--            marketing_deliverables já libera todas pra ela; ver o anexo de um
--            card que ela vê é coerente, e é o que destrava o briefing).
--   anexar → entrega em encaminhado_para_agencia, em_producao ou revisao. As
--            duas primeiras são onde ela trabalha; `revisao` entra porque a
--            ordem natural é anexar a peça e encaminhar, e sem ela quem
--            encaminhasse primeiro ficaria sem como subir o arquivo — que é o
--            mesmo beco de onde este pedido nasceu.
--   apagar → SÓ o que ela mesma subiu, e SÓ enquanto o card está com ela
--            (sem `revisao`). Isto é um APERTO, não uma liberação: a policy de
--            delete da tabela era `marketing OR agencia`, sem filtro de etapa,
--            empresa ou fornecedor — a agência podia apagar a linha de
--            qualquer anexo de qualquer entrega (13 de 13 anexos hoje estão em
--            cards de revisão/entregue/arquivados). Achado da revisão de
--            segurança de 10/09; é o que furava a garantia de que o card não
--            muda debaixo do revisor.

-- Uma função só, pra não repetir o join em cinco policies.
create or replace function public.agencia_pode_anexar_entrega(p_deliverable_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.marketing_deliverables md
    where md.id = p_deliverable_id
      and md.stage = any (array['encaminhado_para_agencia','em_producao','revisao'])
  );
$$;

create or replace function public.agencia_pode_mexer_entrega(p_deliverable_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.marketing_deliverables md
    where md.id = p_deliverable_id
      and md.stage = any (array['encaminhado_para_agencia','em_producao'])
  );
$$;

revoke all on function public.agencia_pode_anexar_entrega(uuid) from public, anon;
revoke all on function public.agencia_pode_mexer_entrega(uuid) from public, anon;
grant execute on function public.agencia_pode_anexar_entrega(uuid) to authenticated;
grant execute on function public.agencia_pode_mexer_entrega(uuid) to authenticated;

-- ---------- tabela ----------
drop policy if exists "Deliverable attachments table read" on public.marketing_deliverable_attachments;
create policy "Deliverable attachments table read" on public.marketing_deliverable_attachments
  for select using (
    current_user_is_marketing()
    OR (current_user_has_role('agencia') AND deliverable_id is not null)
  );

drop policy if exists "Deliverable attachments table insert" on public.marketing_deliverable_attachments;
create policy "Deliverable attachments table insert" on public.marketing_deliverable_attachments
  for insert with check (
    current_user_is_marketing()
    OR (current_user_has_role('agencia') AND public.agencia_pode_anexar_entrega(deliverable_id))
  );

drop policy if exists "Deliverable attachments table delete" on public.marketing_deliverable_attachments;
create policy "Deliverable attachments table delete" on public.marketing_deliverable_attachments
  for delete using (
    current_user_is_marketing()
    OR (current_user_has_role('agencia')
        AND uploaded_by = auth.uid()
        AND public.agencia_pode_mexer_entrega(deliverable_id))
  );

-- ---------- Storage ----------
-- O caminho do objeto é "<deliverable_id>/<arquivo>", então a pasta dá o id.
drop policy if exists "Deliverable attachments read" on storage.objects;
create policy "Deliverable attachments read" on storage.objects
  for select using (
    bucket_id = 'deliverable-attachments'
    AND (current_user_is_marketing() OR current_user_has_role('agencia'))
  );

drop policy if exists "Deliverable attachments insert" on storage.objects;
create policy "Deliverable attachments insert" on storage.objects
  for insert with check (
    bucket_id = 'deliverable-attachments'
    AND (
      current_user_is_marketing()
      OR (current_user_has_role('agencia')
          AND public.agencia_pode_anexar_entrega(((storage.foldername(name))[1])::uuid))
    )
  );

drop policy if exists "Deliverable attachments delete" on storage.objects;
create policy "Deliverable attachments delete" on storage.objects
  for delete using (
    bucket_id = 'deliverable-attachments'
    AND (
      current_user_is_marketing()
      OR (current_user_has_role('agencia')
          -- storage.objects tem `owner` (uuid, legado) e `owner_id` (text).
          -- Objeto antigo pode ter só um dos dois preenchido.
          AND (owner = auth.uid() OR owner_id = auth.uid()::text)
          AND public.agencia_pode_mexer_entrega(((storage.foldername(name))[1])::uuid))
    )
  );
