-- Aprovar/rejeitar uma Solicitação de Marketing não avisava o solicitante
-- por e-mail — só via a tela. email_error guarda a falha de envio (mesmo
-- padrão de marketing_supplier_quotes.email_error) pra tela oferecer
-- "tentar enviar de novo" sem precisar re-aprovar/rejeitar.
alter table public.marketing_requests
  add column if not exists email_error text;
