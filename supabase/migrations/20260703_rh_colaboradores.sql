-- Registro de pessoal desacoplado de login: hoje "Funcionários" só existe
-- pra quem já tem conta no sistema (profiles). Muitos trabalhadores (ex.:
-- chão de fábrica, que não sabem ler/escrever) precisam constar no RH sem
-- nunca acessar o CRM. rh_colaboradores é o cadastro independente — se essa
-- pessoa um dia ganhar acesso ao sistema, profile_id vincula os dois.

CREATE TABLE IF NOT EXISTS public.rh_colaboradores (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name             text        NOT NULL,
  cpf                   text,
  rg                    text,
  birth_date            date,
  phone                 text,
  email                 text,
  address_street        text,
  address_number        text,
  address_complement    text,
  address_neighborhood  text,
  address_city          text,
  address_state         text,
  address_zip           text,
  job_title             text,
  department            text,
  contract_type         text,
  admission_date        date,
  employee_status       text        NOT NULL DEFAULT 'ativo',
  salary                numeric,
  document_type         text        CHECK (document_type IN ('cnh','rg', NULL)),
  document_path         text,
  notes                 text,
  created_by            uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rh_colaboradores_cpf_key ON public.rh_colaboradores (cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS rh_colaboradores_profile_id_idx ON public.rh_colaboradores (profile_id);

ALTER TABLE public.rh_colaboradores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rh_colaboradores' AND policyname = 'rh_colaboradores_rh_access'
  ) THEN
    CREATE POLICY "rh_colaboradores_rh_access" ON public.rh_colaboradores
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh')));
  END IF;
END $$;

-- Documentos (CNH/RG) enviados na hora do cadastro — só RH acessa, já que
-- quem faz o upload é o RH em nome do colaborador, não a própria pessoa.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rh-documentos-colaborador', 'rh-documentos-colaborador', false, 10485760,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'rh_doc_colaborador_rh_access'
  ) THEN
    CREATE POLICY "rh_doc_colaborador_rh_access" ON storage.objects
      FOR ALL
      USING (
        bucket_id = 'rh-documentos-colaborador'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
      )
      WITH CHECK (
        bucket_id = 'rh-documentos-colaborador'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','gerente_rh','rh'))
      );
  END IF;
END $$;
