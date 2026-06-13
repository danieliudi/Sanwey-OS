-- Personal events (private per user) + calendar_token for ICS subscription

-- Add calendar_token to profiles (used for ICS subscription URL)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calendar_token text DEFAULT gen_random_uuid()::text;

-- Populate existing rows that have NULL
UPDATE public.profiles SET calendar_token = gen_random_uuid()::text WHERE calendar_token IS NULL;

-- Personal events table
CREATE TABLE IF NOT EXISTS public.personal_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  date        date        NOT NULL,
  end_date    date,
  description text,
  color       text        NOT NULL DEFAULT '#6366F1',
  all_day     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_events ENABLE ROW LEVEL SECURITY;

-- Only the owner can read/write their own personal events
CREATE POLICY "personal_events_owner_all"
  ON public.personal_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS personal_events_user_id_date_idx
  ON public.personal_events (user_id, date);
