-- Reunião com o RH (20/07): bem-estar deixa de ser fila FIFO ("chamar o
-- próximo") e passa a funcionar como reserva de restaurante — horário
-- marcado, com nome/ramal/e-mail/WhatsApp capturados na hora do agendamento
-- e confirmação por e-mail.

ALTER TABLE public.rh_bemestar_sessoes
  ADD COLUMN horario_inicio time,
  ADD COLUMN horario_fim    time,
  ADD COLUMN slot_minutos   integer NOT NULL DEFAULT 30 CHECK (slot_minutos > 0);

ALTER TABLE public.rh_bemestar_fila
  ADD COLUMN horario           time,
  ADD COLUMN ramal             text,
  ADD COLUMN email             text,
  ADD COLUMN whatsapp          text,
  ADD COLUMN lembrete_enviado  boolean NOT NULL DEFAULT false;

-- Um horário só pode ser reservado por uma pessoa por sessão.
CREATE UNIQUE INDEX rh_bemestar_fila_horario_uniq
  ON public.rh_bemestar_fila (sessao_id, horario)
  WHERE horario IS NOT NULL;

-- Muda o formato de retorno (novos campos de horário) — precisa dropar antes.
DROP FUNCTION IF EXISTS public.get_bemestar_sessao_publica(uuid);

CREATE FUNCTION public.get_bemestar_sessao_publica(p_id uuid)
RETURNS TABLE (id uuid, titulo text, descricao text, data date, horario_inicio time, horario_fim time, slot_minutos integer)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT s.id, s.titulo, s.descricao, s.data, s.horario_inicio, s.horario_fim, s.slot_minutos
  FROM public.rh_bemestar_sessoes s
  WHERE s.id = p_id AND s.status = 'aberta';
$function$;
REVOKE ALL ON FUNCTION public.get_bemestar_sessao_publica(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bemestar_sessao_publica(uuid) TO anon, authenticated;

-- Gera os horários possíveis (horario_inicio..horario_fim em passos de
-- slot_minutos) e marca quais já estão reservados — o público só vê
-- disponível/reservado, nunca quem reservou o horário do outro.
CREATE OR REPLACE FUNCTION public.get_bemestar_horarios_disponiveis(p_id uuid)
RETURNS TABLE (horario time, disponivel boolean)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sessao record;
BEGIN
  SELECT * INTO v_sessao FROM public.rh_bemestar_sessoes WHERE id = p_id AND status = 'aberta';
  IF v_sessao.id IS NULL OR v_sessao.horario_inicio IS NULL OR v_sessao.horario_fim IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT slot::time,
           NOT EXISTS (
             SELECT 1 FROM public.rh_bemestar_fila f
             WHERE f.sessao_id = p_id AND f.horario = slot::time AND f.status <> 'faltou'
           )
    FROM generate_series(
      v_sessao.horario_inicio,
      v_sessao.horario_fim - (v_sessao.slot_minutos || ' minutes')::interval,
      (v_sessao.slot_minutos || ' minutes')::interval
    ) AS slot
    ORDER BY 1;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_bemestar_horarios_disponiveis(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bemestar_horarios_disponiveis(uuid) TO anon, authenticated;

-- Reserva um horário específico (em vez de entrar numa fila FIFO). Continua
-- gerando `senha` (contador sequencial da sessão) só como número de
-- referência amigável — quem manda no atendimento agora é o horário.
CREATE OR REPLACE FUNCTION public.submit_bemestar_agendamento(
  p_sessao_id uuid, p_horario time, p_nome text,
  p_ramal text DEFAULT NULL, p_email text DEFAULT NULL, p_whatsapp text DEFAULT NULL,
  p_frente text DEFAULT NULL
)
RETURNS TABLE (id uuid, senha integer, horario time)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sessao record;
  v_senha int;
  v_recent int;
  v_ja_ocupado boolean;
  v_novo_id uuid;
BEGIN
  IF coalesce(trim(p_nome), '') = '' THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  IF coalesce(trim(p_email), '') = '' AND coalesce(trim(p_whatsapp), '') = '' THEN
    RAISE EXCEPTION 'Informe e-mail ou WhatsApp pra receber a confirmação';
  END IF;
  IF p_frente IS NOT NULL AND btrim(p_frente) <> '' AND btrim(p_frente) NOT IN ('sanwey','resibag','montemor') THEN
    RAISE EXCEPTION 'Unidade inválida';
  END IF;

  SELECT * INTO v_sessao FROM public.rh_bemestar_sessoes WHERE id = p_sessao_id AND status = 'aberta';
  IF v_sessao.id IS NULL THEN RAISE EXCEPTION 'Sessão não está aberta'; END IF;
  IF p_horario IS NULL OR p_horario < v_sessao.horario_inicio OR p_horario >= v_sessao.horario_fim THEN
    RAISE EXCEPTION 'Horário fora da janela de atendimento';
  END IF;

  SELECT count(*) INTO v_recent FROM public.rh_bemestar_fila
  WHERE sessao_id = p_sessao_id AND created_at > now() - interval '2 minutes';
  IF v_recent >= 60 THEN RAISE EXCEPTION 'Muitas entradas no momento. Tente novamente em instantes.'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('rh_bemestar_' || p_sessao_id::text || p_horario::text));
  SELECT EXISTS (
    SELECT 1 FROM public.rh_bemestar_fila WHERE sessao_id = p_sessao_id AND horario = p_horario AND status <> 'faltou'
  ) INTO v_ja_ocupado;
  IF v_ja_ocupado THEN RAISE EXCEPTION 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.'; END IF;

  SELECT coalesce(max(f.senha), 0) + 1 INTO v_senha FROM public.rh_bemestar_fila f WHERE f.sessao_id = p_sessao_id;

  INSERT INTO public.rh_bemestar_fila (sessao_id, senha, nome, frente, horario, ramal, email, whatsapp)
  VALUES (p_sessao_id, v_senha, trim(p_nome), nullif(btrim(coalesce(p_frente, '')), ''), p_horario,
          nullif(trim(coalesce(p_ramal, '')), ''), nullif(trim(coalesce(p_email, '')), ''), nullif(trim(coalesce(p_whatsapp, '')), ''))
  RETURNING rh_bemestar_fila.id INTO v_novo_id;

  RETURN QUERY SELECT v_novo_id, v_senha, p_horario;
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_bemestar_agendamento(uuid, time, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_bemestar_agendamento(uuid, time, text, text, text, text, text) TO anon, authenticated;

-- `lembrete_enviado` é atualizado por update direto na tabela (RLS já
-- restringe a RH, mesmo padrão do resto do hook) — sem RPC dedicada.

-- Assinatura antiga (fila FIFO) fica órfã — dropa pra não confundir.
DROP FUNCTION IF EXISTS public.submit_bemestar_agendamento(uuid, text, text);
