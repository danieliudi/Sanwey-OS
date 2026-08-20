-- Achado BX-02 (baixo, relatório de segurança): única função da plataforma
-- sem `SET search_path` explícito — todas as outras já seguem esse padrão.
-- Baixo risco real aqui (a função não referencia nenhuma tabela, só
-- jsonb_array_elements_text builtin), mas o custo de fechar é uma linha.
alter function public.chat_profile_matches_filter(jsonb, text, text[])
  set search_path = public, pg_temp;
