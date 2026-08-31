-- Sessões de Bem-estar criadas antes do modelo "reserva de restaurante"
-- (migration 20260755) nasceram no modelo antigo de fila FIFO, sem nenhuma
-- janela de horário — horario_inicio/horario_fim ficam NULL pra sempre, o
-- que faz get_bemestar_horarios_disponiveis nunca gerar nenhum slot e o
-- link público mostrar "Nenhum horário livre" mesmo com a sessão aberta.
-- Backfill pontual: aplica o mesmo default (09:00-17:00/30min) que o modal
-- de criação já usa, só nas sessões que nunca tiveram janela nenhuma —
-- sessões já configuradas (mesmo que por engano) não são tocadas.
update public.rh_bemestar_sessoes
set horario_inicio = '09:00',
    horario_fim    = '17:00',
    slot_minutos   = coalesce(slot_minutos, 30)
where horario_inicio is null
  and horario_fim is null;
