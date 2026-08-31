-- Semente do catálogo de benefícios genéricos pedido pelo usuário (VT, VR,
-- VA, Wellhub, convênio médico) — sem isso a tela de "Solicitar benefício"
-- fica vazia. created_by NULL: dado de catálogo/referência, não criado por
-- um usuário específico. RH pode editar valor_padrao/fornecedor_id depois
-- pela própria tabela (tela de gestão de catálogo é fast-follow, não
-- necessária pro fluxo básico de solicitar/aprovar).
INSERT INTO public.rh_beneficios_catalogo (tipo, nome_exibicao, is_active)
VALUES
  ('vt', 'Vale-transporte', true),
  ('vr', 'Vale-refeição', true),
  ('va', 'Vale-alimentação', true),
  ('wellhub', 'Wellhub (Gympass)', true),
  ('convenio_medico', 'Convênio médico', true);
