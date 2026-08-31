-- Corrige cores de etapa quase idênticas entre colunas vizinhas do Kanban
-- (achado visual real: "Aprovação"/"Produção" em Marketing eram dois tons
-- de laranja quase iguais). Also aproveitou pra checar outros domínios e
-- corrigir dois casos parecidos: Recrutamento (Proposta/Aprovado, ambos
-- verde) e Comercial (Negociação/Negócio Fechado, ambos azul), e um caso de
-- cor duplicada não-adjacente em Onboarding (Pré-admissão/Acompanhamento).
update public.rh_pipeline_stages set color = '#DB2777' where domain='marketing' and company_id='all' and stage_key='aprovacao';
update public.rh_pipeline_stages set color = '#EA580C' where domain='marketing' and company_id='all' and stage_key='producao';
update public.rh_pipeline_stages set color = '#0D9488' where domain='candidatos' and company_id='all' and stage_key='proposta';
update public.rh_pipeline_stages set color = '#047857' where domain='comercial' and stage_key='ganho';
update public.rh_pipeline_stages set color = '#DB2777' where domain='onboarding' and company_id='all' and stage_key='acompanhamento';
