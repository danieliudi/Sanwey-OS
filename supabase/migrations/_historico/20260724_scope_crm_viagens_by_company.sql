-- Achado HIGH da auditoria de plataforma: as políticas de
-- crm_viagem_registros/crm_viagem_despesas liberavam qualquer "gerente"
-- (cargo escalar `profiles.role`, sem checar `roles[]` nem empresa) pra
-- ler, aprovar e apagar viagens/despesas/comprovantes de vendedores de
-- QUALQUER empresa do grupo — o mesmo padrão de escopo por empresa que já
-- existe pra profiles/clients/leads faltava aqui. Também corrige o mesmo
-- bug de cargo escalar (um gerente com esse cargo como ADICIONAL, não
-- principal, não era reconhecido).
--
-- Helper reutilizado nas duas tabelas: admin vê tudo; gerente só vê quem
-- tem overlap de empresa com ele (via profiles do vendedor da viagem).
CREATE OR REPLACE FUNCTION public.current_user_manages_viagem_of(p_vendedor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    'admin' = ANY (current_user_roles())
    OR (
      'gerente' = ANY (current_user_roles())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_vendedor_id
        AND p.companies && current_user_companies()
      )
    )
$function$;

DROP POLICY IF EXISTS "crm_viagem_registros_read" ON public.crm_viagem_registros;
CREATE POLICY "crm_viagem_registros_read" ON public.crm_viagem_registros
  FOR SELECT
  USING (vendedor_id = auth.uid() OR current_user_manages_viagem_of(vendedor_id));

DROP POLICY IF EXISTS "crm_viagem_registros_update" ON public.crm_viagem_registros;
CREATE POLICY "crm_viagem_registros_update" ON public.crm_viagem_registros
  FOR UPDATE
  USING (vendedor_id = auth.uid() OR current_user_manages_viagem_of(vendedor_id));

DROP POLICY IF EXISTS "crm_viagem_registros_delete" ON public.crm_viagem_registros;
CREATE POLICY "crm_viagem_registros_delete" ON public.crm_viagem_registros
  FOR DELETE
  USING (vendedor_id = auth.uid() OR current_user_manages_viagem_of(vendedor_id));

DROP POLICY IF EXISTS "crm_viagem_despesas_read" ON public.crm_viagem_despesas;
CREATE POLICY "crm_viagem_despesas_read" ON public.crm_viagem_despesas
  FOR SELECT
  USING (vendedor_id = auth.uid() OR current_user_manages_viagem_of(vendedor_id));

DROP POLICY IF EXISTS "crm_viagem_despesas_insert" ON public.crm_viagem_despesas;
CREATE POLICY "crm_viagem_despesas_insert" ON public.crm_viagem_despesas
  FOR INSERT
  WITH CHECK (
    (vendedor_id = auth.uid() AND status_reembolso = 'pendente')
    OR current_user_manages_viagem_of(vendedor_id)
  );

DROP POLICY IF EXISTS "crm_viagem_despesas_update" ON public.crm_viagem_despesas;
CREATE POLICY "crm_viagem_despesas_update" ON public.crm_viagem_despesas
  FOR UPDATE
  USING (
    (vendedor_id = auth.uid() AND status_reembolso = 'pendente')
    OR current_user_manages_viagem_of(vendedor_id)
  )
  WITH CHECK (
    (vendedor_id = auth.uid() AND status_reembolso = 'pendente')
    OR current_user_manages_viagem_of(vendedor_id)
  );

DROP POLICY IF EXISTS "crm_viagem_despesas_delete" ON public.crm_viagem_despesas;
CREATE POLICY "crm_viagem_despesas_delete" ON public.crm_viagem_despesas
  FOR DELETE
  USING (
    (vendedor_id = auth.uid() AND status_reembolso = 'pendente')
    OR current_user_manages_viagem_of(vendedor_id)
  );

-- Mesmo bug no Storage: o path é `${vendedor_id}/${despesa_id}.${ext}`, o
-- primeiro segmento do path já É o vendedor_id do dono do comprovante.
DROP POLICY IF EXISTS "crm_comprovantes_select" ON storage.objects;
CREATE POLICY "crm_comprovantes_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'crm-comprovantes' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR current_user_manages_viagem_of(((storage.foldername(name))[1])::uuid)
    )
  );
