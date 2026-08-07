-- Lista Pessoal: Nível 1 (paridade com o Kanban padrão da plataforma —
-- checklist, anexos, notas) + Nível 2 (tags, recorrência, prazo com hora
-- pro lembrete/quick-add) — proposta mostrada e aprovada com o Daniel em
-- 07/08/2026 (artifact "Lista Pessoal — proposta de redesenho").
--
-- Mesma filosofia de isolamento de 20260826_personal_tasks.sql: cada tabela
-- nova tem user_id denormalizado e RLS `user_id = auth.uid()` sem exceção
-- de papel/gerência — dado 100% privado, nunca compartilhado, então não faz
-- sentido comparar com predicado de tabela colaborativa (ex.: deliverable
-- attachments, que é escopado por módulo/papel). O predicado-irmão mais
-- próximo é a própria personal_tasks.

-- ── personal_tasks: campos novos ────────────────────────────────────────────

ALTER TABLE public.personal_tasks
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly')),
  -- Hora do prazo, formato "HH:MM" — coluna separada de due_date (mantém o
  -- comentário original de 20260826: due_date é só o dia). Nullable: tarefa
  -- sem hora continua valendo, só perde o lembrete de horário específico.
  ADD COLUMN IF NOT EXISTS due_time text,
  -- Log de notas com carimbo de data/hora — decisão registrada no mockup:
  -- "comentário" pressupõe outra pessoa lendo, o que não faz sentido numa
  -- lista 100% privada; isto substitui a ideia sem herdar menção/notificação
  -- a terceiros. Formato: [{ id, body, createdAt }].
  ADD COLUMN IF NOT EXISTS notes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ── Checklists ───────────────────────────────────────────────────────────────
-- Mesmo formato de use-deliverable-checklists.js (items jsonb por checklist),
-- já reaproveitado 3x na plataforma (Lead/Deliverable/RH) — 4ª ocorrência.

CREATE TABLE public.personal_task_checklists (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid        NOT NULL REFERENCES public.personal_tasks(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      text        NOT NULL DEFAULT 'Checklist',
  items      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid        REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX personal_task_checklists_task_id_idx ON public.personal_task_checklists (task_id);

ALTER TABLE public.personal_task_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_task_checklists_owner_all"
  ON public.personal_task_checklists
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.personal_task_checklists_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER personal_task_checklists_updated_at
  BEFORE UPDATE ON public.personal_task_checklists
  FOR EACH ROW EXECUTE FUNCTION public.personal_task_checklists_set_updated_at();

-- ── Anexos ───────────────────────────────────────────────────────────────────
-- Mesmo formato de use-deliverable-attachments.js (linha por arquivo +
-- bucket privado no Storage).

CREATE TABLE public.personal_task_attachments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid        NOT NULL REFERENCES public.personal_tasks(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name  text        NOT NULL,
  file_path  text        NOT NULL,
  file_size  bigint,
  mime_type  text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX personal_task_attachments_task_id_idx ON public.personal_task_attachments (task_id);

ALTER TABLE public.personal_task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_task_attachments_owner_all"
  ON public.personal_task_attachments
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Bucket privado — path convention `${userId}/${taskId}/${timestamp}-${rand}.ext`,
-- mesmo espírito de chat-attachments (20260813_chat_attachments_storage.sql):
-- policy verifica o 1º segmento do path em vez de depender só da tabela de
-- metadados, então um objeto órfão (linha apagada, arquivo esquecido) nunca
-- fica legível por outro usuário só por engano de query.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'personal-task-attachments', 'personal-task-attachments', false, 10485760,
  ARRAY['application/pdf','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv','text/plain',
        'image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS personal_task_attachments_storage_read ON storage.objects;
CREATE POLICY personal_task_attachments_storage_read ON storage.objects FOR SELECT
  USING (
    bucket_id = 'personal-task-attachments'
    AND (storage.foldername(name))[1]::uuid = auth.uid()
  );

DROP POLICY IF EXISTS personal_task_attachments_storage_insert ON storage.objects;
CREATE POLICY personal_task_attachments_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'personal-task-attachments'
    AND (storage.foldername(name))[1]::uuid = auth.uid()
  );

DROP POLICY IF EXISTS personal_task_attachments_storage_delete ON storage.objects;
CREATE POLICY personal_task_attachments_storage_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'personal-task-attachments'
    AND (storage.foldername(name))[1]::uuid = auth.uid()
  );
