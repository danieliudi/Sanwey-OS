-- Achado do Daniel (10/08/2026): perfil vendedor/consultor recebendo
-- notificação de "Nova solicitação de compra" sem ter nada a ver com ele.
-- Auditoria de todos os pontos que gravam em public.notifications (RPCs
-- broadcast_announcement/enviar_pesquisa_notificacao, trigger
-- marketing_purchase_requests_notify_new, edge functions agent-gateway/
-- manager-vaga-review) confirmou que a lógica de destinatário de cada um
-- está correta — o problema não é quem recebe no momento do envio, é que
-- nada nunca limpa depois: notificação continua existindo mesmo quando (a)
-- o registro que ela aponta é excluído (link morto) ou (b) o destinatário
-- deixa de ter o papel que justificou o envio. Achados 8 casos reais na
-- tabela (7 link morto — a maioria de Compras, dados de teste "Teste
-- diagnóstico QA"/"__audit_brinde_feira" — e 1 exatamente o caso relatado).
--
-- Este arquivo resolve a classe (a) — link morto — com cascade automático,
-- igual ao padrão ON DELETE CASCADE já usado em outras tabelas da
-- plataforma (RH, ver checklist de Segurança no CLAUDE.md). A classe (b) —
-- destinatário perdeu o papel — não ganhou automação: exigiria mapear por
-- tipo qual papel "revoga" a notificação, e a maioria dos tipos (comunicado
-- 'todos', pesquisa, aprovação/rejeição pro solicitante) não tem esse
-- conceito — ficaria over-engineering pra 1 caso observado. Fica como
-- gap conhecido, de baixo custo (usuário marca como lida).
--
-- Uma função só, reutilizada via argumento do trigger (TG_ARGV[0] = o
-- `module` gravado em notifications.link) — evita 3 cópias quase idênticas.
CREATE OR REPLACE FUNCTION public.notifications_cascade_delete_by_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  DELETE FROM public.notifications
  WHERE link ->> 'module' = TG_ARGV[0]
    AND link ->> 'id' = OLD.id::text;
  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.notifications_cascade_delete_by_link() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS marketing_purchase_requests_notifications_cascade_trg ON public.marketing_purchase_requests;
CREATE TRIGGER marketing_purchase_requests_notifications_cascade_trg
  AFTER DELETE ON public.marketing_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.notifications_cascade_delete_by_link('purchase_requests');

DROP TRIGGER IF EXISTS rh_vagas_notifications_cascade_trg ON public.rh_vagas;
CREATE TRIGGER rh_vagas_notifications_cascade_trg
  AFTER DELETE ON public.rh_vagas
  FOR EACH ROW EXECUTE FUNCTION public.notifications_cascade_delete_by_link('rh_vagas');

-- marketing_deliverables não tinha link morto hoje, mas usa o mesmo formato
-- de link (module: 'deliverables') pra notificação de @menção — mesma
-- classe de risco, cobrindo antes de acontecer em vez de esperar reportarem.
DROP TRIGGER IF EXISTS marketing_deliverables_notifications_cascade_trg ON public.marketing_deliverables;
CREATE TRIGGER marketing_deliverables_notifications_cascade_trg
  AFTER DELETE ON public.marketing_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.notifications_cascade_delete_by_link('deliverables');

-- Limpeza pontual dos 8 registros já órfãos/desatualizados encontrados na
-- auditoria de 10/08/2026 (não seriam pegos pelos triggers acima, que só
-- valem pra exclusões daqui pra frente).
DELETE FROM public.notifications
WHERE id IN (
  -- Link morto — Compras, C00006 (dados de teste QA, request excluído)
  'a4fa5068-0d4a-4834-85d7-7488413ff38d',
  'cda5c3ae-adcb-47da-baf3-414124f0ba01',
  '03b973e2-3602-4960-8816-6d18c9440d93',
  -- Link morto — Compras, C00008 (dados de teste de auditoria, request excluído)
  'cb8de75b-dbf8-477a-8206-b950bb0dec52',
  '1538ec6c-1517-4d53-92f0-950303c62264',
  'be42b342-5436-43ec-8e92-d914c9d652ee',
  -- Link morto — vaga de RH excluída
  '59d58923-6efd-473a-96ee-cc11f9a0c725',
  -- Destinatário sem o papel que justificou o envio — o caso relatado pelo Daniel
  'bd61595d-c069-4f69-8133-b972581b77e6'
);
