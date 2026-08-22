-- MD-11: migra as policies que ainda comparam contra o profiles.role escalar
-- pra usar profiles.roles[] (via current_user_has_role()/current_user_is_admin()
-- ou roles && ARRAY[...] direto), fechando a dívida documentada no CLAUDE.md.
--
-- Levantamento vivo em produção (22/08/2026) achou 36 policies no modelo
-- antigo, não 22 como o número da auditoria de 19/08 registrou — o
-- escopo cresceu porque tabelas novas (lead_attachments, lead_checklists,
-- activities, marketing_deliverable_attachments, marketing_quote_email_template,
-- agent_actions) foram copiadas do padrão antigo depois da auditoria.
--
-- Segurança da mudança: o trigger profiles_sync_roles garante role = ANY(roles)
-- pra toda linha de profiles (violations = 0 confirmado em produção antes de
-- aplicar). Toda comparação abaixo era condição POSITIVA (nunca negação), então
-- trocar role = X / role = ANY([...]) por X = ANY(roles) / roles && ARRAY[...]
-- só pode AMPLIAR acesso (a quem tem X como cargo secundário), nunca restringir.

-- ============================================================
-- activities
-- ============================================================
drop policy if exists activities_insert on public.activities;
create policy activities_insert
  on public.activities
  for insert
  with check (
    ((performed_by is null) or (performed_by = auth.uid()))
    and exists (
      select 1 from leads l
      where l.id = activities.lead_id
        and (
          (current_user_has_role('admin') or current_user_has_role('gerente'))
          or (
            current_user_has_role('vendedor')
            and l.company_id = any (current_user_companies())
            and (l.owner is null or l.owner = auth.uid()::text)
          )
        )
    )
  );

drop policy if exists activities_select on public.activities;
create policy activities_select
  on public.activities
  for select
  using (
    exists (
      select 1 from leads l
      where l.id = activities.lead_id
        and (
          (current_user_has_role('admin') or current_user_has_role('gerente'))
          or (
            current_user_has_role('vendedor')
            and l.company_id = any (current_user_companies())
            and (l.owner is null or l.owner = auth.uid()::text)
          )
        )
    )
  );

drop policy if exists activities_update on public.activities;
create policy activities_update
  on public.activities
  for update
  using (
    performed_by = auth.uid()
    or (current_user_has_role('admin') or current_user_has_role('gerente'))
  );

-- ============================================================
-- agent_actions
-- ============================================================
drop policy if exists agent_actions_seller_read on public.agent_actions;
create policy agent_actions_seller_read
  on public.agent_actions
  for select
  to authenticated
  using (
    lead_id is not null
    and exists (
      select 1 from leads l join profiles p on p.id = auth.uid()
      where l.id = agent_actions.lead_id
        and l.owner = auth.uid()::text
        and 'vendedor' = any (p.roles)
    )
  );

drop policy if exists agent_actions_seller_resolve on public.agent_actions;
create policy agent_actions_seller_resolve
  on public.agent_actions
  for update
  to authenticated
  using (
    lead_id is not null
    and exists (
      select 1 from leads l join profiles p on p.id = auth.uid()
      where l.id = agent_actions.lead_id
        and l.owner = auth.uid()::text
        and 'vendedor' = any (p.roles)
    )
  )
  with check (status = any (array['approved','rejected','ignored']));

drop policy if exists agent_actions_manager_all on public.agent_actions;
create policy agent_actions_manager_all
  on public.agent_actions
  for all
  using (
    current_user_is_admin()
    or (current_user_has_role('gerente') and (company_id is null or company_id = any (current_user_companies())))
  )
  with check (
    current_user_is_admin()
    or (current_user_has_role('gerente') and (company_id is null or company_id = any (current_user_companies())))
  );

-- ============================================================
-- automations / crm_viagem_categorias / pipeline_stage_transitions
-- ============================================================
drop policy if exists automations_write on public.automations;
create policy automations_write
  on public.automations
  for all
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente']::text[]))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente']::text[]));

drop policy if exists crm_viagem_categorias_write on public.crm_viagem_categorias;
create policy crm_viagem_categorias_write
  on public.crm_viagem_categorias
  for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente']::text[]))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente']::text[]));

drop policy if exists pipeline_stage_transitions_write on public.pipeline_stage_transitions;
create policy pipeline_stage_transitions_write
  on public.pipeline_stage_transitions
  for all
  to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente']::text[]))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente']::text[]));

-- ============================================================
-- lead_attachments
-- ============================================================
drop policy if exists attachments_delete on public.lead_attachments;
create policy attachments_delete
  on public.lead_attachments
  for delete
  using (
    current_user_is_admin()
    or (current_user_has_role('gerente') and company_id = any (current_user_companies()))
    or (
      current_user_has_role('vendedor')
      and company_id = any (current_user_companies())
      and exists (
        select 1 from leads l
        where l.id = lead_attachments.lead_id
          and (l.owner is null or l.owner = auth.uid()::text or l.owner = any (current_user_subordinate_ids()))
      )
    )
  );

drop policy if exists attachments_insert on public.lead_attachments;
create policy attachments_insert
  on public.lead_attachments
  for insert
  with check (
    current_user_is_admin()
    or (current_user_has_role('gerente') and company_id = any (current_user_companies()))
    or (
      current_user_has_role('vendedor')
      and company_id = any (current_user_companies())
      and exists (
        select 1 from leads l
        where l.id = lead_attachments.lead_id
          and (l.owner is null or l.owner = auth.uid()::text or l.owner = any (current_user_subordinate_ids()))
      )
    )
  );

drop policy if exists attachments_select on public.lead_attachments;
create policy attachments_select
  on public.lead_attachments
  for select
  using (
    current_user_is_admin()
    or (current_user_has_role('gerente') and company_id = any (current_user_companies()))
    or (
      current_user_has_role('vendedor')
      and company_id = any (current_user_companies())
      and exists (
        select 1 from leads l
        where l.id = lead_attachments.lead_id
          and (l.owner is null or l.owner = auth.uid()::text or l.owner = any (current_user_subordinate_ids()))
      )
    )
  );

-- ============================================================
-- lead_checklists
-- ============================================================
drop policy if exists checklists_delete on public.lead_checklists;
create policy checklists_delete
  on public.lead_checklists
  for delete
  to authenticated
  using (
    current_user_is_admin()
    or (current_user_has_role('gerente') and company_id = any (current_user_companies()))
    or (
      current_user_has_role('vendedor')
      and company_id = any (current_user_companies())
      and exists (select 1 from leads l where l.id = lead_checklists.lead_id and (l.owner is null or l.owner = auth.uid()::text))
    )
  );

drop policy if exists checklists_insert on public.lead_checklists;
create policy checklists_insert
  on public.lead_checklists
  for insert
  to authenticated
  with check (
    current_user_is_admin()
    or (current_user_has_role('gerente') and company_id = any (current_user_companies()))
    or (
      current_user_has_role('vendedor')
      and company_id = any (current_user_companies())
      and exists (select 1 from leads l where l.id = lead_checklists.lead_id and (l.owner is null or l.owner = auth.uid()::text))
    )
  );

drop policy if exists checklists_select on public.lead_checklists;
create policy checklists_select
  on public.lead_checklists
  for select
  to authenticated
  using (
    current_user_is_admin()
    or (current_user_has_role('gerente') and company_id = any (current_user_companies()))
    or (
      current_user_has_role('vendedor')
      and company_id = any (current_user_companies())
      and exists (select 1 from leads l where l.id = lead_checklists.lead_id and (l.owner is null or l.owner = auth.uid()::text))
    )
  );

drop policy if exists checklists_update on public.lead_checklists;
create policy checklists_update
  on public.lead_checklists
  for update
  to authenticated
  using (
    current_user_is_admin()
    or (current_user_has_role('gerente') and company_id = any (current_user_companies()))
    or (
      current_user_has_role('vendedor')
      and company_id = any (current_user_companies())
      and exists (select 1 from leads l where l.id = lead_checklists.lead_id and (l.owner is null or l.owner = auth.uid()::text))
    )
  )
  with check (
    current_user_is_admin()
    or (current_user_has_role('gerente') and company_id = any (current_user_companies()))
    or (
      current_user_has_role('vendedor')
      and company_id = any (current_user_companies())
      and exists (select 1 from leads l where l.id = lead_checklists.lead_id and (l.owner is null or l.owner = auth.uid()::text))
    )
  );

-- ============================================================
-- lead_stage_history
-- ============================================================
drop policy if exists lsh_select on public.lead_stage_history;
create policy lsh_select
  on public.lead_stage_history
  for select
  using (
    exists (
      select 1 from leads l
      where l.id = lead_stage_history.lead_id
        and (
          l.created_by = auth.uid()
          or current_user_is_admin()
          or (current_user_has_role('gerente') and l.company_id = any (current_user_companies()))
        )
    )
  );

-- ============================================================
-- marketing_deliverable_attachments / marketing_quote_email_template
-- ============================================================
drop policy if exists "Deliverable attachments table delete" on public.marketing_deliverable_attachments;
create policy "Deliverable attachments table delete"
  on public.marketing_deliverable_attachments
  for delete
  using (current_user_is_marketing() or current_user_has_role('agencia'));

drop policy if exists marketing_quote_email_template_update on public.marketing_quote_email_template;
create policy marketing_quote_email_template_update
  on public.marketing_quote_email_template
  for update
  using (current_user_is_admin() or current_user_has_role('gerente_marketing'))
  with check (current_user_is_admin() or current_user_has_role('gerente_marketing'));

-- ============================================================
-- storage.objects (rh-documentos-colaborador)
-- ============================================================
drop policy if exists rh_doc_colaborador_rh_access on storage.objects;
create policy rh_doc_colaborador_rh_access
  on storage.objects
  for all
  using (
    bucket_id = 'rh-documentos-colaborador'
    and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[])
  )
  with check (
    bucket_id = 'rh-documentos-colaborador'
    and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[])
  );

-- ============================================================
-- RH: rh_aplicacoes, rh_avaliacoes, rh_candidatos, rh_onboarding_tarefas,
-- rh_onboarding_templates, rh_stage_history, rh_treinamento_atribuicoes,
-- rh_treinamentos, rh_vagas — todos no mesmo padrão admin/gerente_rh/rh
-- ============================================================
drop policy if exists rh_aplicacoes_rh_access on public.rh_aplicacoes;
create policy rh_aplicacoes_rh_access
  on public.rh_aplicacoes
  for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]));

drop policy if exists rh_avaliacoes_read on public.rh_avaliacoes;
create policy rh_avaliacoes_read
  on public.rh_avaliacoes
  for select
  using (
    is_own_colaborador(user_id)
    or auth.uid() = any (evaluator_ids)
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[])
  );

drop policy if exists rh_avaliacoes_write on public.rh_avaliacoes;
create policy rh_avaliacoes_write
  on public.rh_avaliacoes
  for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]));

drop policy if exists rh_candidatos_rh_access on public.rh_candidatos;
create policy rh_candidatos_rh_access
  on public.rh_candidatos
  for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]));

drop policy if exists rh_onboarding_tarefas_delete on public.rh_onboarding_tarefas;
create policy rh_onboarding_tarefas_delete
  on public.rh_onboarding_tarefas
  for delete
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]));

drop policy if exists rh_onboarding_tarefas_read on public.rh_onboarding_tarefas;
create policy rh_onboarding_tarefas_read
  on public.rh_onboarding_tarefas
  for select
  using (
    is_own_colaborador(colaborador_id)
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[])
  );

drop policy if exists rh_onboarding_tarefas_update on public.rh_onboarding_tarefas;
create policy rh_onboarding_tarefas_update
  on public.rh_onboarding_tarefas
  for update
  using (
    is_own_colaborador(colaborador_id)
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[])
  );

drop policy if exists rh_onboarding_tarefas_write on public.rh_onboarding_tarefas;
create policy rh_onboarding_tarefas_write
  on public.rh_onboarding_tarefas
  for insert
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]));

drop policy if exists rh_onboarding_templates_rh_access on public.rh_onboarding_templates;
create policy rh_onboarding_templates_rh_access
  on public.rh_onboarding_templates
  for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]));

drop policy if exists rh_stage_history_rh_access on public.rh_stage_history;
create policy rh_stage_history_rh_access
  on public.rh_stage_history
  for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]));

drop policy if exists rh_treinamento_atrib_delete on public.rh_treinamento_atribuicoes;
create policy rh_treinamento_atrib_delete
  on public.rh_treinamento_atribuicoes
  for delete
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]));

drop policy if exists rh_treinamento_atrib_insert on public.rh_treinamento_atribuicoes;
create policy rh_treinamento_atrib_insert
  on public.rh_treinamento_atribuicoes
  for insert
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]));

drop policy if exists rh_treinamento_atrib_read on public.rh_treinamento_atribuicoes;
create policy rh_treinamento_atrib_read
  on public.rh_treinamento_atribuicoes
  for select
  using (
    is_own_colaborador(colaborador_id)
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[])
  );

drop policy if exists rh_treinamento_atrib_update on public.rh_treinamento_atribuicoes;
create policy rh_treinamento_atrib_update
  on public.rh_treinamento_atribuicoes
  for update
  using (
    is_own_colaborador(colaborador_id)
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[])
  )
  with check (
    (
      is_own_colaborador(colaborador_id)
      and status = any (array['pendente','concluido','vencido'])
      and (data_conclusao is null or (data_conclusao >= now() - interval '5 minutes' and data_conclusao <= now() + interval '1 minute'))
    )
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[])
  );

drop policy if exists rh_treinamentos_write on public.rh_treinamentos;
create policy rh_treinamentos_write
  on public.rh_treinamentos
  for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]));

drop policy if exists rh_vagas_rh_access on public.rh_vagas;
create policy rh_vagas_rh_access
  on public.rh_vagas
  for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.roles && array['admin','gerente_rh','rh']::text[]));
