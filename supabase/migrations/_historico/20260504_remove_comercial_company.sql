-- Migration: remove_comercial_from_company_id_checks
-- Remove "comercial" do CHECK constraint de company_id (Sanwey Comercial saiu do produto).
-- Pré-requisito: nenhuma linha com company_id = 'comercial' nas tabelas leads/agent_actions.

ALTER TABLE public.leads DROP CONSTRAINT leads_company_id_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_company_id_check
  CHECK (company_id = ANY (ARRAY['industria'::text, 'resibag'::text, 'montemor'::text]));

ALTER TABLE public.agent_actions DROP CONSTRAINT agent_actions_company_id_check;
ALTER TABLE public.agent_actions
  ADD CONSTRAINT agent_actions_company_id_check
  CHECK (company_id = ANY (ARRAY['industria'::text, 'resibag'::text, 'montemor'::text]));
