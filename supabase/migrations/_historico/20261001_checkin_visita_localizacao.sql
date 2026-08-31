-- Check-in de visita: localização sempre anexada à Ata de Visita, endereço
-- do cliente, e vínculo com a visita planejada em CRM Viagens.
--
-- Decidido com o Daniel em 3 rodadas de mockup (17/08/2026): GPS é lido uma
-- vez, no momento em que o vendedor grava a ata, e nunca pode ser removido
-- pelo próprio vendedor (sem opt-out na UI). Isso só vira contexto de
-- verdade quando ligado a outras partes do CRM: ao endereço do cliente
-- cadastrado, e à visita que o vendedor já tinha planejado em Viagens.
--
-- O QUE ESTA MIGRATION FAZ:
--  1. Adiciona clients.address (texto livre, mesmo espírito de city/state
--     que já não têm formato rígido — não é rua/número/bairro/CEP
--     estruturado, é um campo só, igual ao resto do cadastro).
--  2. Atualiza get_client_timeline() pra projetar meta.location e
--     meta.viagemRegistroId no branch 'ata_voz' — mesma técnica já usada
--     em 20260929_ata_voz_na_linha_do_tempo_do_cliente.sql pra
--     proximoPasso/concorrente, senão a localização e o vínculo aparecem
--     na aba Atividades do negócio mas somem da aba Histórico do cliente.
--
-- O QUE NÃO MUDA: RLS de clients e crm_viagem_registros — nenhuma das duas
-- precisa de policy nova. clients_update já cobre qualquer coluna da linha
-- (é RLS por linha, não por coluna); a leitura de crm_viagem_registros pelo
-- próprio vendedor (vendedor_id = auth.uid()) já é suficiente pro app
-- consultar "eu tinha uma visita planejada pra esse cliente hoje?" sem
-- policy adicional. O bloco de permissão de get_client_timeline não muda
-- nada, só a projeção.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address text;

CREATE OR REPLACE FUNCTION public.get_client_timeline(p_client_id uuid)
 RETURNS TABLE(kind text, category text, ts timestamp with time zone, title text, detail text, actor_id uuid, actor_name text, lead_id text, lead_name text, meta jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
BEGIN
  IF p_client_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    current_user_is_admin()
    OR current_user_has_role('diretoria')
    OR (
      (current_user_roles() && ARRAY['gerente','vendedor'])
      AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = p_client_id
          AND c.company_ids && current_user_companies()
      )
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão pra ver o histórico deste cliente';
  END IF;

  RETURN QUERY
  WITH visible_leads AS (
    SELECT
      l.id, l.company, l.company_id, l.activities, l.notes,
      (
        current_user_is_admin()
        OR current_user_has_role('diretoria')
        OR current_user_has_role('gerente')
        OR l.owner_ids = '{}'::text[]
        OR (auth.uid())::text = ANY (l.owner_ids)
        OR l.owner_ids && current_user_subordinate_ids()
      ) AS owned
    FROM public.leads l
    WHERE l.client_id = p_client_id
      AND (
        current_user_is_admin()
        OR current_user_has_role('diretoria')
        OR l.company_id = ANY (current_user_companies())
      )
      AND (
        current_user_is_admin()
        OR current_user_has_role('diretoria')
        OR current_user_has_role('gerente')
        OR (l.sector IS NOT NULL AND l.sector = ANY (current_user_sectors()))
        OR (auth.uid())::text = ANY (l.owner_ids)
        OR l.owner_ids && current_user_subordinate_ids()
      )
  ),
  stage_names AS (
    SELECT DISTINCT ON (s.company_id, s.stage_key)
           s.company_id, s.stage_key, s.name
    FROM public.rh_pipeline_stages s
    WHERE s.domain = 'comercial'
    ORDER BY s.company_id, s.stage_key, s.order_idx
  ),
  items AS (
    SELECT
      CASE act.elem->>'type'
        WHEN 'note'               THEN 'nota'
        WHEN 'email_sent'         THEN 'email'
        WHEN 'proposal_generated' THEN 'proposta'
        WHEN 'ata_voz'            THEN 'ata'
        ELSE 'comentario'
      END                                                                      AS kind,
      'interacao'                                                              AS category,
      at.at                                                                    AS ts,
      CASE act.elem->>'type'
        WHEN 'note'               THEN 'Nota'
        WHEN 'email_sent'         THEN 'E-mail de abordagem'
        WHEN 'proposal_generated' THEN 'Proposta gerada'
        WHEN 'ata_voz'            THEN 'Ata de visita'
        ELSE 'Comentário'
      END                                                                      AS title,
      NULLIF(act.elem->>'body', '')                                            AS detail,
      NULLIF(act.elem->>'userId', '')::uuid                                    AS actor_id,
      COALESCE(pr.name, NULLIF(act.elem->>'userName', ''))                     AS actor_name,
      vl.id                                                                    AS lead_id,
      vl.company                                                               AS lead_name,
      jsonb_build_object(
        'source', 'leads.activities',
        'activityId', act.elem->>'id',
        'activityType', act.elem->>'type',
        'mentionedIds', COALESCE(act.elem->'mentionedIds', '[]'::jsonb),
        'editedAt', act.elem->>'editedAt',
        -- Da ata: o que ficou combinado é o que faz alguém agir seis meses
        -- depois, então sobe pro meta em vez de ficar só no corpo.
        'proximoPasso', act.elem->'meta'->>'proximoPasso',
        'proximoPassoData', act.elem->'meta'->>'proximoPassoData',
        'concorrente', act.elem->'meta'->>'concorrente',
        'origem', act.elem->'meta'->>'origem',
        -- Check-in de visita (17/08/2026): localização sempre anexada e o
        -- vínculo com a visita planejada em Viagens, quando existir.
        'location', act.elem->'meta'->'location',
        'viagemRegistroId', act.elem->'meta'->>'viagemRegistroId',
        'viagemLabel', act.elem->'meta'->>'viagemLabel'
      )                                                                        AS meta
    FROM visible_leads vl
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(vl.activities, '[]'::jsonb)) AS act(elem)
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        NULLIF(act.elem->>'timestamp', '')::timestamptz,
        NULLIF(act.elem->>'createdAt', '')::timestamptz
      ) AS at
    ) at
    LEFT JOIN public.profiles pr ON pr.id = NULLIF(act.elem->>'userId', '')::uuid
    WHERE act.elem->>'type' IN ('note', 'comment', 'email_sent', 'proposal_generated', 'ata_voz')
      AND act.elem->>'deletedAt' IS NULL
      AND at.at IS NOT NULL

    UNION ALL

    SELECT
      'nota',
      'interacao',
      NULLIF(nt.elem->>'createdAt', '')::timestamptz,
      'Nota (registro antigo)',
      COALESCE(NULLIF(nt.elem->>'text', ''), NULLIF(nt.elem->>'body', '')),
      NULLIF(nt.elem->>'userId', '')::uuid,
      COALESCE(pr.name, NULLIF(nt.elem->>'userName', '')),
      vl.id,
      vl.company,
      jsonb_build_object('source', 'leads.notes', 'legacy', true)
    FROM visible_leads vl
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(vl.notes, '[]'::jsonb)) AS nt(elem)
    LEFT JOIN public.profiles pr ON pr.id = NULLIF(nt.elem->>'userId', '')::uuid
    WHERE nt.elem->>'deletedAt' IS NULL
      AND NULLIF(nt.elem->>'createdAt', '') IS NOT NULL

    UNION ALL

    SELECT
      'etapa',
      'interno',
      h.changed_at,
      'Mudança de etapa',
      CASE WHEN h.from_stage IS NULL
           THEN 'Entrou em "' || COALESCE(sn_to.name, h.to_stage) || '"'
           ELSE 'De "' || COALESCE(sn_from.name, h.from_stage) || '" para "'
                       || COALESCE(sn_to.name, h.to_stage) || '"'
      END || COALESCE(' — ' || NULLIF(h.note, ''), ''),
      h.changed_by,
      pr.name,
      vl.id,
      vl.company,
      jsonb_build_object('source', 'lead_stage_history', 'from', h.from_stage,
                         'to', h.to_stage, 'note', h.note,
                         'from_label', sn_from.name, 'to_label', sn_to.name)
    FROM visible_leads vl
    JOIN public.lead_stage_history h ON h.lead_id = vl.id
    LEFT JOIN public.profiles pr ON pr.id = h.changed_by
    LEFT JOIN stage_names sn_from ON sn_from.company_id = vl.company_id
                                 AND sn_from.stage_key = h.from_stage
    LEFT JOIN stage_names sn_to   ON sn_to.company_id = vl.company_id
                                 AND sn_to.stage_key = h.to_stage

    UNION ALL

    SELECT
      'etapa',
      'interno',
      at.at,
      'Mudança de etapa',
      NULLIF(act.elem->>'body', ''),
      NULLIF(act.elem->>'userId', '')::uuid,
      COALESCE(pr.name, NULLIF(act.elem->>'userName', '')),
      vl.id,
      vl.company,
      jsonb_build_object('source', 'leads.activities', 'from', act.elem->'meta'->>'from',
                         'to', act.elem->'meta'->>'to',
                         'from_label', sn_from.name, 'to_label', sn_to.name)
    FROM visible_leads vl
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(vl.activities, '[]'::jsonb)) AS act(elem)
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        NULLIF(act.elem->>'timestamp', '')::timestamptz,
        NULLIF(act.elem->>'createdAt', '')::timestamptz
      ) AS at
    ) at
    LEFT JOIN public.profiles pr ON pr.id = NULLIF(act.elem->>'userId', '')::uuid
    LEFT JOIN stage_names sn_from ON sn_from.company_id = vl.company_id
                                 AND sn_from.stage_key = act.elem->'meta'->>'from'
    LEFT JOIN stage_names sn_to   ON sn_to.company_id = vl.company_id
                                 AND sn_to.stage_key = act.elem->'meta'->>'to'
    WHERE act.elem->>'type' = 'stage_changed'
      AND act.elem->>'deletedAt' IS NULL
      AND at.at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_stage_history h
        WHERE h.lead_id = vl.id
          AND h.to_stage IS NOT DISTINCT FROM act.elem->'meta'->>'to'
          AND abs(extract(epoch FROM (h.changed_at - at.at))) < 300
      )

    UNION ALL

    SELECT
      'follow_up',
      'interacao',
      at.at,
      'Follow-up agendado',
      NULLIF(act.elem->>'body', ''),
      NULLIF(act.elem->>'userId', '')::uuid,
      COALESCE(pr.name, NULLIF(act.elem->>'userName', '')),
      vl.id,
      vl.company,
      jsonb_build_object('source', 'leads.activities', 'date', act.elem->'meta'->>'date')
    FROM visible_leads vl
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(vl.activities, '[]'::jsonb)) AS act(elem)
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        NULLIF(act.elem->>'timestamp', '')::timestamptz,
        NULLIF(act.elem->>'createdAt', '')::timestamptz
      ) AS at
    ) at
    LEFT JOIN public.profiles pr ON pr.id = NULLIF(act.elem->>'userId', '')::uuid
    WHERE act.elem->>'type' = 'follow_up_set'
      AND act.elem->>'deletedAt' IS NULL
      AND at.at IS NOT NULL

    UNION ALL

    SELECT
      'visita',
      CASE WHEN v.status IN ('cancelado', 'nao_realizado') THEN 'interno' ELSE 'interacao' END,
      COALESCE(
        ((COALESCE(v.data_realizada, v.data_planejada))::timestamp + interval '12 hours')
          AT TIME ZONE 'UTC',
        v.created_at
      ),
      CASE v.status
        WHEN 'realizado'     THEN 'Visita realizada'
        WHEN 'cancelado'     THEN 'Visita cancelada'
        WHEN 'nao_realizado' THEN 'Visita não realizada'
        ELSE 'Visita planejada'
      END,
      COALESCE(NULLIF(v.resumo_realizado, ''), NULLIF(v.objetivo, ''),
               NULLIF(v.destino_realizado, ''), NULLIF(v.destino_planejado, '')),
      v.vendedor_id,
      pr.name,
      vl.id,
      vl.company,
      jsonb_build_object(
        'source', 'crm_viagem_registros',
        'viagemId', v.id,
        'matched_by', CASE
          WHEN v.client_id = p_client_id AND vl.id IS NOT NULL THEN 'ambos'
          WHEN v.client_id = p_client_id THEN 'cliente'
          ELSE 'negocio' END,
        'rawLeadId', v.lead_id,
        'status', v.status,
        'objetivo', v.objetivo,
        'resumo_realizado', v.resumo_realizado,
        'motivo_divergencia', v.motivo_divergencia,
        'destino_planejado', v.destino_planejado,
        'destino_realizado', v.destino_realizado,
        'data_planejada', v.data_planejada,
        'data_realizada', v.data_realizada,
        'valor_previsto', v.valor_previsto
      )
    FROM public.crm_viagem_registros v
    LEFT JOIN visible_leads vl ON vl.id = v.lead_id
    LEFT JOIN public.profiles pr ON pr.id = v.vendedor_id
    WHERE (v.client_id = p_client_id OR vl.id IS NOT NULL)
      AND (
        current_user_is_admin()
        OR current_user_has_role('diretoria')
        OR EXISTS (
          SELECT 1 FROM public.profiles vp
          WHERE vp.id = v.vendedor_id
            AND vp.companies && current_user_companies()
        )
      )

    UNION ALL

    SELECT
      'amostra',
      'interacao',
      COALESCE((s.sent_at::timestamp + interval '12 hours') AT TIME ZONE 'UTC', s.created_at),
      'Amostra enviada',
      NULLIF(s.notes, ''),
      s.created_by,
      pr.name,
      vl.id,
      vl.company,
      jsonb_build_object('source', 'lead_samples', 'sampleId', s.id,
                         'cost', s.cost, 'sent_at', s.sent_at)
    FROM visible_leads vl
    JOIN public.lead_samples s ON s.lead_id = vl.id
    LEFT JOIN public.profiles pr ON pr.id = s.created_by

    UNION ALL

    SELECT
      'anexo',
      'interno',
      a.created_at,
      'Anexo adicionado',
      a.file_name,
      a.uploaded_by,
      pr.name,
      vl.id,
      vl.company,
      jsonb_build_object('source', 'lead_attachments', 'attachmentId', a.id,
                         'file_path', a.file_path, 'file_size', a.file_size,
                         'mime_type', a.mime_type)
    FROM visible_leads vl
    JOIN public.lead_attachments a ON a.lead_id = vl.id
    LEFT JOIN public.profiles pr ON pr.id = a.uploaded_by
    WHERE vl.owned

    UNION ALL

    SELECT
      'posvenda',
      'interacao',
      pc.created_at,
      'Caso de pós-venda',
      COALESCE(pvs.name, NULLIF(pc.stage, '')),
      pc.created_by,
      pr.name,
      vl.id,
      vl.company,
      jsonb_build_object('source', 'posvenda_cases', 'caseId', pc.id,
                         'stage', pc.stage, 'stage_label', pvs.name,
                         'value', pc.value, 'company_id', pc.company_id,
                         'client_name', pc.client_name,
                         'matched_by', CASE
                           WHEN pc.client_id = p_client_id AND vl.id IS NOT NULL THEN 'ambos'
                           WHEN pc.client_id = p_client_id THEN 'cliente'
                           ELSE 'negocio' END)
    FROM public.posvenda_cases pc
    LEFT JOIN visible_leads vl ON vl.id = pc.lead_id
    LEFT JOIN public.profiles pr ON pr.id = pc.created_by
    LEFT JOIN LATERAL (
      SELECT s.name FROM public.rh_pipeline_stages s
      WHERE s.domain = 'posvenda'
        AND s.stage_key = pc.stage
        AND s.company_id IN (pc.company_id, 'all')
      ORDER BY (s.company_id = pc.company_id) DESC, s.order_idx
      LIMIT 1
    ) pvs ON true
    WHERE (pc.client_id = p_client_id OR vl.id IS NOT NULL)
      AND (
        current_user_is_admin()
        OR current_user_has_role('diretoria')
        OR pc.company_id = ANY (current_user_companies())
      )

    UNION ALL

    SELECT
      'faturamento',
      'interno',
      make_timestamptz(b.year, 12, 31, 12, 0, 0, 'UTC'),
      'Faturamento ' || b.year::text,
      CASE WHEN COALESCE(b.order_count, 0) > 0
           THEN b.order_count::text || ' pedido(s) no ano' END,
      NULL::uuid,
      NULL::text,
      NULL::text,
      NULL::text,
      jsonb_build_object('source', 'client_billing_history', 'year', b.year,
                         'total_value', b.total_value, 'order_count', b.order_count)
    FROM public.client_billing_history b
    WHERE b.client_id = p_client_id
  )
  SELECT i.kind, i.category, i.ts, i.title, i.detail, i.actor_id, i.actor_name,
         i.lead_id, i.lead_name, i.meta
  FROM items i
  WHERE i.ts IS NOT NULL
  ORDER BY i.ts DESC;
END;
$function$;
