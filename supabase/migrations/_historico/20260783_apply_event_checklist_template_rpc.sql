-- Corrige achado real de QA (checklist de evento, docs/design-spec-checklist-evento.md):
-- o laço client-side que cria os 5 cards de segmento + checklist tinha uma
-- janela de corrida entre 2 sessões clicando "Aplicar checklist de evento"
-- quase ao mesmo tempo — cada uma calculava `alreadyApplied=false` a partir
-- do próprio estado antes do realtime propagar, e ambas completavam o loop,
-- gerando 10 tasks em vez de 5. Move a criação pra uma função atômica no
-- banco com advisory lock por campanha, serializando chamadas concorrentes
-- sem precisar de UNIQUE constraint (que poderia rejeitar títulos duplicados
-- legítimos criados manualmente por coincidência).
--
-- Não é SECURITY DEFINER — roda como o usuário chamador, RLS de
-- marketing_tasks/rh_checklists continua valendo normalmente (só usuário de
-- marketing consegue inserir).
CREATE OR REPLACE FUNCTION public.apply_event_checklist_template(
  p_campaign_id uuid,
  p_company_ids text[],
  p_owner_ids uuid[],
  p_segments jsonb -- [{"segment": "...", "items": ["...", "..."]}]
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_seg jsonb;
  v_task_id uuid;
  v_created integer := 0;
  v_existing_titles text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  -- Serializa chamadas concorrentes pra mesma campanha — libera automaticamente
  -- no fim da transação da chamada RPC.
  PERFORM pg_advisory_xact_lock(hashtext(p_campaign_id::text));

  SELECT array_agg(title) INTO v_existing_titles
  FROM public.marketing_tasks
  WHERE campaign_id = p_campaign_id;

  FOR v_seg IN SELECT * FROM jsonb_array_elements(p_segments)
  LOOP
    IF v_existing_titles IS NOT NULL AND (v_seg->>'segment') = ANY(v_existing_titles) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.marketing_tasks (company_ids, campaign_id, title, assignee_ids, priority, created_by)
    VALUES (p_company_ids, p_campaign_id, v_seg->>'segment', p_owner_ids, 'media', v_uid)
    RETURNING id INTO v_task_id;

    INSERT INTO public.rh_checklists (domain, record_id, title, items, created_by)
    SELECT
      'marketing_tasks',
      v_task_id,
      'Checklist do segmento',
      (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'text', item, 'done', false))
         FROM jsonb_array_elements_text(v_seg->'items') AS item),
      v_uid;

    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$function$;
