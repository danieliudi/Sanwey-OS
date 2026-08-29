-- Auditoria de RLS: rh_pipeline_stages_write / rh_pipeline_stages_posvenda_write
--
-- Por quê: a política de escrita de etapas é uma allowlist aditiva por
-- (role, domain) — toda vez que um board novo nasce (ou os papéis viram
-- array), alguém precisa lembrar de atualizar a lista, e o esquecimento não
-- dá erro óbvio: é um UPDATE/DELETE filtrado pela RLS que afeta 0 linhas
-- sem lançar exceção, ou um INSERT que estoura "new row violates row-level
-- security policy" só quando um usuário real com aquele papel clica no
-- botão. Já aconteceu pelo menos 3x (ver 20260785_comex_pipeline_stages_
-- write_scope.sql, 20260792_fix_stage_write_scope_and_candidato_upsert.sql,
-- 20260801_fix_pipeline_stages_multi_role_check.sql — este último é
-- exatamente o bug do "Nova etapa" no Kanban de Tarefas de Marketing
-- reportado em auditoria). Este script transforma esse histórico em teste
-- de regressão.
--
-- Como funciona: em vez de logar de verdade pelo browser, impersona cada
-- papel via set_config('request.jwt.claims', ...) — o mesmo claim que o
-- PostgREST injeta por trás de um login real, e que auth.uid()/current_
-- user_has_role() já leem hoje. Cada combinação testa tanto INSERT
-- ("Nova etapa") quanto DELETE (linhas afetadas, não só ausência de
-- exceção — pega o padrão de bloqueio silencioso). Personas "_multi" têm
-- profiles.role (coluna legada, singular) DIVERGENTE de profiles.roles
-- (array) de propósito — é exatamente a divergência que causou o bug do
-- 20260801: qualquer código que volte a checar a coluna singular em vez do
-- array reprova aqui na hora.
--
-- Efeito colateral: cria e apaga usuários/perfis/etapas marcados com
-- '__audit.invalid' / '_audit_%'. Limpa tudo no final mesmo se alguma
-- asserção falhar (bloco cleanup roda sempre). Ainda assim, rode preferencialmente
-- num branch/staging do Supabase, nunca direto em produção.
--
-- Rodar: cole no SQL editor do Supabase, ou:
--   psql "$DATABASE_URL" -f supabase/tests/rls_stage_matrix.sql
-- Saída: uma linha por combinação (mismatch = true quer dizer bug) e um
-- resumo final. Termina com RAISE EXCEPTION se achar qualquer divergência,
-- pra dar exit code != 0 em CI.

drop table if exists _rls_audit_results;
create temporary table _rls_audit_results (
  persona   text,
  domain    text,
  op        text,
  expected  boolean,
  actual    boolean
);

do $$
declare
  -- domain -> roles não-admin que DEVERIAM conseguir escrever (admin sempre
  -- passa via current_user_is_admin(), testado à parte pela persona 'admin').
  v_matrix jsonb := '{
    "comercial":              ["gerente"],
    "vagas":                  ["rh","gerente_rh"],
    "onboarding":              ["rh","gerente_rh"],
    "ferias":                  ["rh","gerente_rh"],
    "feedback":                ["rh","gerente_rh"],
    "candidatos":              ["rh","gerente_rh"],
    "treinamentos":            ["rh","gerente_rh"],
    "marketing":               ["marketing","gerente_marketing"],
    "marketing_deliverables":  ["marketing","gerente_marketing"],
    "marketing_tasks":         ["marketing","gerente_marketing"],
    "comex_importacao":        ["comex"],
    "comex_exportacao":        ["comex"],
    "posvenda":                ["gerente"],
    "marketing_purchase_requests": ["marketing","gerente_marketing"],
    "bugs":                    [],
    "zz_nonexistent_canary":   []
  }'::jsonb;
  -- Conferência de cobertura da matriz acima contra o banco real
  -- (28/08/2026): `select distinct domain from rh_pipeline_stages` devolve 14
  -- domínios; a matriz cobria 13. Os dois acrescentados agora:
  --
  --  * "bugs" — existe em rh_pipeline_stages (4 etapas) e NÃO está na
  --    allowlist da rh_pipeline_stages_write, ou seja hoje só admin escreve.
  --    Isso está certo, não é lacuna: BugsView.jsx:85 só LÊ as etapas
  --    (`const { stages } = useRHPipelineStages("bugs")`), não expõe
  --    addStage/reorderStages. O `[]` aqui trava esse desenho — se alguém
  --    der escrita de etapa de bugs a um papel sem querer, reprova.
  --
  --  * "marketing_purchase_requests" — o inverso: ESTÁ na allowlist da
  --    policy (marketing/gerente_marketing) mas tem ZERO linha em
  --    rh_pipeline_stages, porque Compras usa o modelo hardcoded
  --    PURCHASE_STAGES (exceção deliberada, CLAUDE.md regra 2). O domínio é
  --    usado de verdade só pra histórico/anexos/checklist
  --    (PurchaseRequestDetailDrawer.jsx:632,656,659). Fica na matriz pra
  --    afirmar que a permissão é intencional: se um dia Compras migrar pro
  --    modelo configurável, o teste já cobre; e se alguém remover a linha da
  --    policy achando que é resto, reprova aqui.

  -- personas: label -> (role singular legado, roles array). As "_multi" são
  -- o canário de divergência role x roles descrito acima.
  v_personas jsonb := '[
    {"label":"admin",             "role":"admin",    "roles":["admin"]},
    {"label":"gerente",           "role":"gerente",  "roles":["gerente"]},
    {"label":"gerente_multi",     "role":"vendedor", "roles":["vendedor","gerente"]},
    {"label":"gerente_rh",        "role":"gerente_rh","roles":["gerente_rh"]},
    {"label":"gerente_rh_multi",  "role":"vendedor", "roles":["vendedor","gerente_rh"]},
    {"label":"rh",                "role":"rh",       "roles":["rh"]},
    {"label":"rh_multi",          "role":"vendedor", "roles":["vendedor","rh"]},
    {"label":"marketing",         "role":"marketing","roles":["marketing"]},
    {"label":"marketing_multi",   "role":"vendedor", "roles":["vendedor","marketing"]},
    {"label":"gerente_marketing", "role":"gerente_marketing","roles":["gerente_marketing"]},
    {"label":"gerente_marketing_multi","role":"vendedor","roles":["vendedor","gerente_marketing"]},
    {"label":"comex",             "role":"comex",    "roles":["comex"]},
    {"label":"comex_multi",       "role":"vendedor", "roles":["vendedor","comex"]},
    {"label":"vendedor",          "role":"vendedor", "roles":["vendedor"]}
  ]'::jsonb;

  rec_persona   jsonb;
  rec_domain    text;
  v_uid         uuid;
  v_persona_roles text[];
  v_allowed     text[];
  v_expected    boolean;
  v_actual      boolean;
  v_seed_id     uuid;
  v_deleted     int;
  v_claims      text;
begin
  -- 1 usuário (auth.users + profiles) por persona.
  for rec_persona in select * from jsonb_array_elements(v_personas)
  loop
    v_uid := gen_random_uuid();
    select array_agg(value) into v_persona_roles from jsonb_array_elements_text(rec_persona->'roles');

    insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
            (rec_persona->>'label') || '@__audit.invalid', now(), now(), now(), '{}', '{}');

    update public.profiles
      set role = rec_persona->>'role', roles = v_persona_roles
      where id = v_uid;

    v_claims := json_build_object('sub', v_uid, 'role', 'authenticated')::text;

    for rec_domain in select * from jsonb_object_keys(v_matrix)
    loop
      select array_agg(value) into v_allowed from jsonb_array_elements_text(v_matrix->rec_domain);
      v_expected := (rec_persona->>'label' = 'admin')
        or (rec_persona->>'label' <> 'admin' and v_allowed is not null
            and exists (select 1 from unnest(v_persona_roles) r where r = any(v_allowed)));

      -- INSERT ("Nova etapa")
      set local role authenticated;
      perform set_config('request.jwt.claims', v_claims, true);
      begin
        insert into public.rh_pipeline_stages (domain, stage_key, name)
        values (rec_domain, '_audit_ins_' || replace(gen_random_uuid()::text, '-', ''), 'Audit Insert');
        v_actual := true;
      exception when insufficient_privilege then
        v_actual := false;
      end;
      reset role;
      insert into _rls_audit_results values (rec_persona->>'label', rec_domain, 'insert', v_expected, v_actual);

      -- DELETE (bloqueio silencioso: 0 linhas afetadas != exceção)
      insert into public.rh_pipeline_stages (domain, stage_key, name)
      values (rec_domain, '_audit_seed_' || replace(gen_random_uuid()::text, '-', ''), 'Audit Seed')
      returning id into v_seed_id;

      set local role authenticated;
      perform set_config('request.jwt.claims', v_claims, true);
      begin
        delete from public.rh_pipeline_stages where id = v_seed_id;
        get diagnostics v_deleted = row_count;
        v_actual := (v_deleted > 0);
      exception when insufficient_privilege then
        v_actual := false;
      end;
      reset role;
      insert into _rls_audit_results values (rec_persona->>'label', rec_domain, 'delete', v_expected, v_actual);
    end loop;
  end loop;
end $$;

-- cleanup incondicional, mesmo que algo acima tenha falhado antes de chegar aqui
delete from public.rh_pipeline_stages where stage_key like '_audit_%';
delete from public.profiles where email like '%@__audit.invalid';
delete from auth.users where email like '%@__audit.invalid';

-- resultado detalhado
select persona, domain, op, expected, actual, (expected is distinct from actual) as mismatch
from _rls_audit_results
order by mismatch desc, domain, persona, op;

-- resumo — se total_mismatches > 0, o CI deve tratar como falha
select
  count(*) as total_checked,
  count(*) filter (where expected is distinct from actual) as total_mismatches
from _rls_audit_results;

do $$
declare
  v_mismatches int;
begin
  select count(*) into v_mismatches from _rls_audit_results where expected is distinct from actual;
  if v_mismatches > 0 then
    raise exception 'RLS stage matrix: % divergência(s) encontrada(s) — ver SELECT acima (mismatch = true)', v_mismatches;
  end if;
end $$;
