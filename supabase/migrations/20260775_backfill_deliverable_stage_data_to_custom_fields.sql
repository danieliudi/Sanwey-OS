-- Backfill único: entregas já em andamento têm respostas preenchidas em
-- stage_data (formulário fixo antigo, por etapa) — sem copiar isso pra
-- custom_fields (o que "Editar campos desta etapa" agora controla, ver
-- 20260774), essas entregas perderiam visualmente todo o histórico já
-- preenchido no formulário do meio do card.
--
-- stage_data é {etapa: {chave: valor}}; custom_fields é {chave: valor} liso
-- — como as chaves de cada etapa não colidem entre si, dá pra achatar tudo
-- num insert só. Dois campos guardavam um valor "cru" que não bate com as
-- opções do campo genérico novo (request_status guardava o código
-- pendente/em_andamento/concluido, não o rótulo; revision_needed guardava
-- boolean, o campo genérico usa radio "Sim"/"Não") — convertidos aqui.
-- "assignee" da etapa solicitacao não entra: virou o campo geral
-- Responsáveis (assignee_ids), já teu dado real, não custom_fields.
do $$
declare
  r record;
  flattened jsonb;
  stage_key text;
  stage_obj jsonb;
begin
  for r in
    select id, stage_data, custom_fields
    from public.marketing_deliverables
    where coalesce(stage_data, '{}'::jsonb) <> '{}'::jsonb
  loop
    flattened := '{}'::jsonb;

    for stage_key, stage_obj in select * from jsonb_each(r.stage_data)
    loop
      if jsonb_typeof(stage_obj) <> 'object' then
        continue;
      end if;

      flattened := flattened || stage_obj;

      if stage_obj ? 'request_status' then
        flattened := jsonb_set(flattened, '{request_status}', to_jsonb(
          case stage_obj->>'request_status'
            when 'pendente'      then 'Pendente'
            when 'em_andamento'  then 'Em andamento'
            when 'concluido'     then 'Concluído'
            else stage_obj->>'request_status'
          end
        ));
      end if;

      if stage_obj ? 'revision_needed' and jsonb_typeof(stage_obj->'revision_needed') = 'boolean' then
        flattened := jsonb_set(flattened, '{revision_needed}', to_jsonb(
          case (stage_obj->>'revision_needed')::boolean
            when true  then 'Sim'
            when false then 'Não'
          end
        ));
      end if;
    end loop;

    flattened := flattened - 'assignee';

    -- custom_fields existente vence em caso de conflito de chave (não deve
    -- haver, mas por segurança nunca sobrescreve edição já feita no sistema
    -- dinâmico).
    update public.marketing_deliverables
      set custom_fields = flattened || coalesce(r.custom_fields, '{}'::jsonb)
      where id = r.id;
  end loop;
end $$;
