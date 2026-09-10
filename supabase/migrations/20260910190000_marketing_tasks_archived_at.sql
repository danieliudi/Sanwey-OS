-- Arquivamento de card em Tarefas de Marketing.
--
-- Mockup aprovado pelo Daniel em 10/09/2026 (regra 3), com as quatro decisões
-- que o mockup levantou respondidas: começar por marketing_tasks, ação em
-- massa entra, nome `archived_at`, e o quadro esconde o terminal por padrão.
--
-- POR QUE COLUNA E NÃO ETAPA (regra 5 manda conferir se dado configurável já
-- resolve): `rh_pipeline_stages` tem terminal/won/lost, mas é OUTRO eixo.
-- `terminal` responde "o trabalho acabou?"; arquivar responde "quero ver isso
-- na tela?". Uma tarefa concluída pode precisar ficar à vista no fechamento do
-- mês, e uma cancelada de 2025 pode sumir. Juntar os dois eixos numa coluna só
-- já deu errado aqui: `src/constants/personal-tasks.js:14-24` documenta a
-- correção de 12/08/2026, quando a última coluna passou a fazer dois papéis —
-- "terminar a tarefa e tirá-la da frente, que são momentos diferentes".
-- Além disso, mover o card pra uma etapa "Arquivo" APAGARIA a informação que o
-- arquivo deveria guardar: em qual etapa ele terminou, e quando.
--
-- POR QUE `archived_at` E NÃO `arquivado_em`: `chat_channels.archived_at` já
-- existe e é exatamente o mesmo conceito; todo carimbo de tempo do schema é
-- <verbo>_at. Duas grafias pro mesmo conceito é como nascem as famílias
-- paralelas da regra 2. Decidido com o Daniel no mockup.
--
-- Escolhido marketing_tasks como primeiro board não pelo tamanho (32 linhas
-- hoje), mas por ser o ÚNICO alimentado em lote por máquina: um clique em
-- "aplicar checklist de evento" cria 28 tarefas de uma vez
-- (`src/constants/event-checklist-template.js`), e o formulário público de
-- solicitação vira mais tarefas sem ninguém dosando o volume. E nada sai:
-- a única saída hoje é exclusão de verdade.

alter table public.marketing_tasks
  add column if not exists archived_at timestamptz;

comment on column public.marketing_tasks.archived_at is
  'Nulo = card no quadro. Preenchido = arquivado: sai do Kanban/Tabela/Calendário/Análise, NUNCA do CSV. Eixo independente de rh_pipeline_stages.terminal.';

-- Sem índice de propósito: 32 linhas. Índice parcial aqui seria enfeite.
-- Revisitar se a tabela passar da casa dos milhares.
--
-- Sem policy nova: as policies de marketing_tasks são por LINHA
-- (company_ids && current_user_companies()), não por coluna, então o UPDATE de
-- archived_at já está coberto por marketing_tasks_update. Não é coluna de
-- permissão, então não há caminho de auto-escalação.
