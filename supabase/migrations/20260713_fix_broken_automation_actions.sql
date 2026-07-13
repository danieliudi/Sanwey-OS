-- Achado importante da auditoria: 2 automações ativas em produção tinham
-- ações com formato incompatível com o executor real (use-automations.js):
--
-- 1. "Prioridade alta ao entrar em Negociação" gravava no campo `priority`,
--    que não existe em `leads` (o campo real é `urgency`), e usava a chave
--    `value` em vez de `fieldValue` — o executor sempre gravava string
--    vazia. Erro do Postgres era engolido silenciosamente, automação nunca
--    fazia nada. Corrigido no template-fonte
--    (src/constants/automation-templates.js) e nos dados já existentes.
-- 2. "Badge VIP · valor ≥ R$ 50k" passava `badge` como objeto
--    {label, color}, mas o executor espera `badge` como string e
--    `badgeColor` como campo separado — renderizava "[object Object]" e
--    ignorava a cor configurada.
update public.automations
set then_actions = '[{"type":"set_field","field":"urgency","fieldValue":"alto"}]'::jsonb
where id = 'bd057590-525f-473a-919b-e034ca4e3f62';

update public.automations
set then_actions = '[{"type":"add_badge","badge":"VIP","badgeColor":"#F59E0B"}]'::jsonb
where id = '516810b4-c81c-42a4-b5bc-6886e7254a3b';
