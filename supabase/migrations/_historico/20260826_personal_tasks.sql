-- Tarefas Pessoais: lista de tarefas privada, opt-in (settings do usuário,
-- não muda schema nenhum além desta tabela) — mockup aprovado com o Daniel.
-- Mesmo espírito de personal_events (20260613_personal_events.sql): um
-- usuário só enxerga e só mexe nas PRÓPRIAS linhas, sem exceção nenhuma de
-- papel/gerência/admin. Vive no grupo "Meu Espaço" do menu lateral, junto
-- de Minhas Tarefas/Chat/Meu RH.

CREATE TABLE public.personal_tasks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  description  text,
  priority     text        NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta')),
  status       text        NOT NULL DEFAULT 'a_fazer' CHECK (status IN ('a_fazer', 'fazendo', 'feito')),
  -- `date`, não timestamptz: é um alvo/prazo escolhido pelo usuário (dia,
  -- sem hora), igual devidamente a `deadline` nas outras tabelas de tarefa
  -- da plataforma (marketing_tasks etc.). Nullable e SEM default — não é
  -- pra vir preenchido com "hoje" sozinho, só quando o usuário escolhe.
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX personal_tasks_user_id_idx ON public.personal_tasks (user_id);
CREATE INDEX personal_tasks_user_id_status_idx ON public.personal_tasks (user_id, status);

ALTER TABLE public.personal_tasks ENABLE ROW LEVEL SECURITY;

-- Mesmo predicado de personal_events_owner_all (20260613_personal_events.sql)
-- — só USING/WITH CHECK com `user_id = auth.uid()`, sem nenhum OR que
-- amplie pra gerente/RH/admin (ao contrário de chat_messages/
-- chat_channel_members, que são multi-parte por design). WITH CHECK cobre
-- INSERT e UPDATE: ninguém consegue gravar um user_id que não seja o
-- próprio auth.uid(), então não dá pra "doar" uma tarefa pra outra pessoa
-- nem se apossar da tarefa de alguém trocando o dono via UPDATE.
CREATE POLICY "personal_tasks_owner_all"
  ON public.personal_tasks
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.personal_tasks_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER personal_tasks_updated_at
  BEFORE UPDATE ON public.personal_tasks
  FOR EACH ROW EXECUTE FUNCTION public.personal_tasks_set_updated_at();
