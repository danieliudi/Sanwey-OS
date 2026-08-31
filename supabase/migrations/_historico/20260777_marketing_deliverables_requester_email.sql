-- P1.7 da auditoria Zero Bullshit: marketing_deliverables só guardava
-- requester_name (texto), sem e-mail — o solicitante nunca era avisado
-- quando a entrega concluía. marketing_requests já tem requester_email;
-- approve_marketing_request passa a copiar pra cá na aprovação.
ALTER TABLE public.marketing_deliverables ADD COLUMN IF NOT EXISTS requester_email text;
