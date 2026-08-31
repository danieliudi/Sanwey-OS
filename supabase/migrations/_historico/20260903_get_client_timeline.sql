-- FASE 3 (nível B) — linha do tempo unificada por CLIENTE.
--
-- RPC NOVA (não estende get_client_connections): connections devolve um jsonb
-- com 2 baldes nomeados pro painel "Conexões"; a timeline devolve um SETOF
-- cronológico com contrato totalmente diferente. Unir os dois forçaria os dois
-- consumidores a buscar o que não usam.
--
-- ─────────────────────────────────────────────────────────────────────────
-- ISOLAMENTO — o que esta função afrouxa DE PROPÓSITO e o que ela NÃO afrouxa
-- ─────────────────────────────────────────────────────────────────────────
-- Gate de entrada: mesmo predicado que já roda em produção na policy
-- client_billing_history_read (admin OR diretoria OR (gerente|vendedor|
-- consultor com clients.company_ids && current_user_companies())).
--
-- A função é SECURITY DEFINER porque a pergunta que ela responde ("o que já
-- tentamos com esse cliente?") só faz sentido atravessando negócios de VÁRIOS
-- donos. Isso é afrouxamento deliberado em relação às policies de origem, e
-- por isso está escrito aqui em vez de ficar implícito:
--
--   * leads / lead_stage_history / lead_samples / activities → recortados por
--     EMPRESA (l.company_id = ANY(current_user_companies())), SEM a cláusula
--     de dono. É mais permissivo que leads_select (que exige dono/subordinado
--     pra vendedor/consultor) e MUITO mais permissivo que lsh_select (que só
--     libera pra l.created_by, admin ou gerente da empresa). Consequência
--     aceita: um vendedor lê comentário/nota/etapa/amostra de negócios de
--     OUTROS vendedores DA MESMA empresa. É exatamente a intenção aprovada da
--     fase 3 — precisa continuar ratificada, não herdada por descuido.
--   * lead_attachments → NÃO entra nesse afrouxamento. Anexo é arquivo, não é
--     "o que já tentamos com esse cliente", e é o item de maior dano por
--     vazamento; mantém a cláusula de dono (flag `owned` do CTE), espelhando
--     attachments_select.
--   * crm_viagem_registros → não tem company_id; o escopo em produção é por
--     dono (vendedor_id = auth.uid() OR current_user_manages_viagem_of). A
--     empresa é derivada do VENDEDOR (profiles.companies && companies do
--     usuário), do mesmo jeito que current_user_manages_viagem_of já faz.
--     Sem isso a viagem casada por client_id não passava por escopo nenhum.
--   * posvenda_cases → tem company_id próprio; o ramo casa por lead_id OU
--     client_id e sempre exige pc.company_id = ANY(current_user_companies()).
--
-- Nenhum ramo cruza empresa. Admin e diretoria seguem irrestritos, como em
-- todas as policies desta base.

CREATE OR REPLACE FUNCTION public.get_client_timeline(p_client_id uuid)
RETURNS TABLE (
  kind        text,
  category    text,
  ts          timestamptz,
  title       text,
  detail      text,
  actor_id    uuid,
  actor_name  text,
  lead_id     text,
  lead_name   text,
  meta        jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
      (current_user_roles() && ARRAY['gerente','vendedor','consultor'])
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
      -- Cláusula de dono de leads_select, calculada UMA vez e usada só onde o
      -- afrouxamento da fase 3 não se aplica (anexo). Ver cabeçalho.
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
  ),
  -- Nome de exibição da etapa é CONFIGURÁVEL por empresa (regra 5 do
  -- CLAUDE.md): resolver aqui evita que a linha do tempo mostre a chave crua
  -- ("pre_qualificacao") ou um nome congelado enquanto o Kanban já mostra o
  -- novo. A UI ainda tem fallback pro catálogo padrão.
  stage_names AS (
    SELECT DISTINCT ON (s.company_id, s.stage_key)
           s.company_id, s.stage_key, s.name
    FROM public.rh_pipeline_stages s
    WHERE s.domain = 'comercial'
    ORDER BY s.company_id, s.stage_key, s.order_idx
  ),
  items AS (
    -- ── INTERAÇÃO: comentários, notas, e-mail e proposta em leads.activities ─
    -- 'email_sent'/'proposal_generated' são os dois tipos que a fase Buracos
    -- passou a gravar (LeadDetailDrawer "Iniciar abordagem" / ProposalPanel
    -- "Gerar proposta"). Sem eles no IN + no CASE, os dois cairiam fora da
    -- varredura (ou virariam "Comentário" no ELSE).
    SELECT
      CASE act.elem->>'type'
        WHEN 'note'               THEN 'nota'
        WHEN 'email_sent'         THEN 'email'
        WHEN 'proposal_generated' THEN 'proposta'
        ELSE 'comentario'
      END                                                                      AS kind,
      'interacao'                                                              AS category,
      at.at                                                                    AS ts,
      CASE act.elem->>'type'
        WHEN 'note'               THEN 'Nota'
        WHEN 'email_sent'         THEN 'E-mail de abordagem'
        WHEN 'proposal_generated' THEN 'Proposta gerada'
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
        'editedAt', act.elem->>'editedAt'
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
    WHERE act.elem->>'type' IN ('note', 'comment', 'email_sent', 'proposal_generated')
      AND act.elem->>'deletedAt' IS NULL
      AND at.at IS NOT NULL

    UNION ALL

    -- ── INTERAÇÃO: notas legado (leads.notes) — sem autor por construção ─────
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

    -- ── INTERNO: mudança de etapa (fonte canônica: lead_stage_history) ───────
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

    -- ── INTERNO: stage_changed em activities que NÃO tem par em history ──────
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

    -- ── INTERAÇÃO: follow-up agendado ───────────────────────────────────────
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

    -- ── VISITA comercial ────────────────────────────────────────────────────
    -- Dedup: UMA varredura com OR (client_id OU lead_id de um lead do cliente).
    -- Nunca dois SELECTs unidos — é isso que geraria a linha repetida quando os
    -- dois batem. meta.matched_by registra por onde casou.
    --
    -- Escopo: crm_viagem_registros NÃO tem company_id; a policy em produção é
    -- 100% por dono. Casada por client_id, a viagem não passa por
    -- visible_leads, então sem o EXISTS abaixo o ramo ficava sem escopo nenhum
    -- e entregava resumo/destino/valor de visitas de qualquer vendedor de
    -- qualquer empresa. A empresa é derivada do vendedor, igual ao que
    -- current_user_manages_viagem_of já faz.
    --
    -- Categoria/título saem de v.status (vocabulário canônico de
    -- utils/viagens.js), não de data_realizada IS NOT NULL: visita cancelada e
    -- visita não realizada têm data_realizada NULL e viravam "Visita planejada"
    -- contada como INTERAÇÃO — a tela passava a responder "o que já tentamos"
    -- com tentativas que a plataforma sabe que não aconteceram. Elas continuam
    -- na linha do tempo (o registro existe e importa), mas como evento interno.
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

    -- ── INTERAÇÃO: amostra enviada ──────────────────────────────────────────
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

    -- ── INTERNO: anexo ──────────────────────────────────────────────────────
    -- Único ramo que NÃO recebe o afrouxamento de dono da fase 3 (ver
    -- cabeçalho): anexo é arquivo, não é "o que já tentamos com esse cliente".
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

    -- ── INTERAÇÃO: caso de pós-venda ────────────────────────────────────────
    -- Casa por NEGÓCIO (lead_id) OU por CLIENTE (client_id, coluna criada na
    -- fase Buracos junto com o ClientSelector do QuickAddCaseModal). Mesma
    -- varredura única com OR usada na visita — nunca dois SELECTs unidos, que
    -- é o que duplicaria a linha quando os dois vínculos batem.
    -- posvenda_cases TEM company_id próprio e hoje só era alcançado via
    -- visible_leads (já recortado por empresa); o OR por client_id precisa
    -- carregar o recorte junto, senão abre o mesmo buraco da visita.
    SELECT
      'posvenda',
      'interacao',
      pc.created_at,
      'Caso de pós-venda',
      -- O estado do caso é o que informa; pc.client_name é NOT NULL e sempre
      -- repetiria o cabeçalho da própria tela (fica em meta como fallback).
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

    -- ── INTERNO: marco anual de faturamento ─────────────────────────────────
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

REVOKE ALL ON FUNCTION public.get_client_timeline(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_client_timeline(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_client_timeline(uuid) IS
  'FASE 3 — linha do tempo unificada do cliente (interações + eventos internos). '
  'Gate de entrada espelha client_billing_history_read. AFROUXAMENTO DELIBERADO E '
  'RATIFICADO: comentário/nota/e-mail/proposta/etapa/amostra de negócios de OUTROS '
  'donos da MESMA empresa são visíveis (mais permissivo que leads_select, '
  'lsh_select e lead_samples_select) — é a intenção aprovada de "o que já tentamos '
  'com esse cliente". lead_attachments NÃO recebe esse afrouxamento (mantém a '
  'cláusula de dono). Nenhum ramo cruza empresa: viagem deriva a empresa do '
  'vendedor (profiles.companies), pós-venda usa o company_id próprio.';

-- Índices que a query pede (idempotente — os dois já existiam nesta base).
CREATE INDEX IF NOT EXISTS leads_client_id_idx ON public.leads USING btree (client_id);
CREATE INDEX IF NOT EXISTS crm_viagem_registros_client_idx ON public.crm_viagem_registros USING btree (client_id);
CREATE INDEX IF NOT EXISTS posvenda_cases_client_id_idx ON public.posvenda_cases USING btree (client_id);
