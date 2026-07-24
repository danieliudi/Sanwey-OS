-- Agent Builder Fase 1 — sweep diário do agent-runner (PRD seção 4, "Supabase
-- Scheduled Function roda 1x/dia"). pg_cron/pg_net já vêm disponíveis no
-- projeto, só não instalados ainda.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- A service_role key nunca deve ir pra um arquivo de migration (fica no git).
-- Guardamos ela no Vault sob um nome fixo; o valor em si é inserido à parte,
-- uma única vez, via SQL editor do dashboard (não por este mecanismo).
-- Enquanto o secret não existir, o cron roda mas a chamada falha por 401 —
-- não quebra nada, só fica sem efeito até o secret ser criado.
select cron.schedule(
  'agent-runner-daily-sweep',
  '0 9 * * *', -- 09:00 UTC = 06:00 BRT
  $$
  select net.http_post(
    url := 'https://adizvduyfzfftyswkijj.supabase.co/functions/v1/agent-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'agent_runner_service_key' limit 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
