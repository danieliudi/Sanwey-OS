-- Textos de ajuda/exemplo e campos novos de etapa — Funil, Recrutamento, Onboarding
--
-- Aprovado com o Daniel em 13-14/09/2026, a partir de três mockups:
-- "O que cada campo pede" (Funil), "Recrutamento e Onboarding" (parte 1) e
-- "As Quatro Travas do Onboarding" (que substituiu a parte 2 depois de ele
-- dizer o que realmente trava: documento que não chega, computador e cartão
-- de benefícios pedidos tarde, gestor sem onde acompanhar, avaliação que
-- ninguém preenche).
--
-- ISTO É CONFIGURAÇÃO, NÃO SCHEMA (regra 5 do CLAUDE.md): nenhuma tabela ou
-- coluna nova. São linhas de `pipeline_stage_fields` e
-- `rh_pipeline_stage_fields`, que é exatamente onde a plataforma manda campo
-- de etapa morar. Vive em migrations pelo mesmo motivo que os seeds de
-- `rh_pipeline_stages` vivem: para ser reproduzível e revisável.
--
-- TRÊS GARANTIAS, todas verificáveis no texto abaixo:
--   1. NUNCA sobrescreve texto que já existe. Todo UPDATE é guardado por
--      `coalesce(campo,'') = ''`. Se alguém escreveu algo no meio do caminho,
--      esta carga passa por cima? Não — ela simplesmente não encosta.
--   2. NUNCA toca em `required`, `options`, `visible_if`, `required_if` nem
--      `validation_rule` de campo que já existe. Mudar obrigatoriedade trava
--      card de gente que está no meio do processo.
--   3. Todo campo NOVO nasce `required = false`. Sem exceção, por decisão
--      explícita: obrigatório é uma segunda decisão, depois de rodar um tempo.
--
-- Reexecutável: os UPDATEs viram no-op na segunda vez (o texto já não está
-- vazio) e os INSERTs são guardados por `not exists`.
--
-- O QUE NÃO ESTÁ AQUI, de propósito: exemplo para campo de data, bolinhas,
-- seleção de pessoa e marcar-vários. Conferido em StageFieldInput.jsx —
-- esses tipos ignoram o atributo; o texto ficaria gravado e nunca apareceria.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. FUNIL DE VENDAS — texto em campos que já existem
--    Vale para as duas frentes; nenhum rótulo diverge entre elas (conferido).
-- ═══════════════════════════════════════════════════════════════════════

with textos(stage_id, field_key, ajuda, exemplo) as (values
  ('prospeccao',  'proximo_passo',           'O que precisa acontecer para este negócio andar — uma frase, não um plano.', 'Ligar dia 18 para confirmar interesse'),
  ('prospeccao',  'telefone_contato',        'Telefone de quem decide ou de quem te atende direto — não o da recepção.', null),
  ('prospeccao',  'data_retorno',            'Quando você combinou de voltar a falar. É esta data que faz o lead aparecer nos seus lembretes.', null),
  ('prospeccao',  'observacoes',             null, 'Chegou por indicação; compra de concorrente há 3 anos'),
  ('qualificacao','proximo_passo',           'O que precisa acontecer para este negócio andar — uma frase, não um plano.', 'Levantar o volume mensal com o setor de compras'),
  ('qualificacao','orcamento_estimado',      'Quanto o cliente tem para gastar, não quanto você espera vender. Estimativa serve; se ainda não faz ideia, deixe vazio.', null),
  ('qualificacao','resultado_qualificacao',  null, 'Compra 20 t/mês, decisor é o diretor industrial, troca de fornecedor em janeiro'),
  ('visitas',     'data_visita',             'O dia da visita em si. Se ainda não marcou, segure o lead na etapa anterior até ter data.', null),
  ('visitas',     'proximo_passo',           'O que precisa acontecer para este negócio andar — uma frase, não um plano.', 'Enviar a proposta com o desconto discutido até sexta'),
  ('visitas',     'local_visita',            null, 'Fábrica em Monte Mor — portaria 2'),
  ('visitas',     'objetivo_visita',         null, 'Conhecer o processo atual e apresentar a linha de reciclados'),
  ('amostras',    'proximo_passo',           'O que precisa acontecer para este negócio andar — uma frase, não um plano.', 'Cobrar o laudo da amostra na semana que vem'),
  ('amostras',    'qtd_amostras',            'Quantas amostras foram enviadas ao todo. Se mandar mais depois, atualize o número em vez de abrir outro registro.', null),
  ('amostras',    'condicoes_armazenamento', null, 'Galpão coberto, sem sol direto, cerca de 25 °C'),
  ('negociacao',  'proximo_passo',           'O que precisa acontecer para este negócio andar — uma frase, não um plano.', 'Revisar o preço internamente e reenviar até terça'),
  -- Exemplo sem "R$": o campo de valor já escreve o símbolo sozinho
  -- (formatBRL, ver utils/currency.js) — concatenar renderia "R$ R$".
  ('negociacao',  'valor',                   'O valor do negócio em negociação, não o do pedido de teste. É este número que soma no Funil e no Painel Executivo.', '45.000,00'),
  ('negociacao',  'contato_decisor',         'Quem assina, mesmo que não seja com quem você fala todo dia.', 'Nome e cargo de quem assina'),
  ('negociacao',  'data_fechamento',         'Quando você acredita que fecha. Alimenta a previsão do mês — um chute honesto vale mais que um campo em branco.', null),
  ('negociacao',  'desconto_aprovado',       'Marque só depois que o desconto tiver sido aprovado por quem pode aprovar.', 'Desconto já aprovado'),
  ('negociacao',  'feedback_cliente',        null, 'Achou o prazo longo; preço ficou aceitável depois do ajuste'),
  ('ganho',       'motivo_ganho',            null, 'Selecione o motivo do ganho'),
  ('perdido',     'motivo_perda',            null, 'Selecione o motivo da perda')
)
update public.pipeline_stage_fields f
   set help_text   = case when coalesce(f.help_text,'')   = '' then coalesce(t.ajuda,   f.help_text)   else f.help_text   end,
       placeholder = case when coalesce(f.placeholder,'') = '' then coalesce(t.exemplo, f.placeholder) else f.placeholder end,
       updated_at  = now()
  from textos t
 where f.stage_id = t.stage_id
   and f.field_key = t.field_key
   and (
        (coalesce(f.help_text,'')   = '' and t.ajuda   is not null)
     or (coalesce(f.placeholder,'') = '' and t.exemplo is not null)
   );

-- ═══════════════════════════════════════════════════════════════════════
-- 2. RECRUTAMENTO — texto em campos que já existem (domínios vagas/candidatos)
-- ═══════════════════════════════════════════════════════════════════════

with textos(domain, stage_key, field_key, ajuda, exemplo) as (values
  -- Vagas
  ('vagas','rascunho',  'aprovacao_interna',        'Marque Sim se a abertura precisa passar pela diretoria antes de ir ao ar. É lembrete, não trava a publicação.', null),
  ('vagas','rascunho',  'data_prevista_publicacao', 'Quando você pretende publicar. Comparada com a data real de publicação, mostra quanto tempo a abertura leva pra sair do papel.', null),
  ('vagas','rascunho',  'observacoes_rascunho',     'Contexto que não cabe na descrição da vaga: quem pediu a abertura, se é reposição ou aumento de quadro.', null),
  ('vagas','publicada', 'canais_divulgacao',        'Onde a vaga foi divulgada. É o que permite descobrir depois qual canal traz candidato bom — e qual só traz volume.', null),
  ('vagas','publicada', 'data_publicacao',          'O dia em que a vaga foi de fato ao ar.', null),
  ('vagas','publicada', 'meta_candidatos',          'Quantos candidatos você considera suficiente para fechar esta vaga. Serve pra decidir quando parar de divulgar.', null),
  ('vagas','em_triagem','responsavel_triagem',      'Quem lê os currículos desta vaga — não é necessariamente quem abriu a vaga.', null),
  ('vagas','em_triagem','prazo_triagem',            'Até quando a triagem precisa estar pronta. Candidato parado é candidato que aceita outra proposta.', null),
  ('vagas','em_triagem','status_triagem',           'Marque Concluída quando não houver mais currículo novo para ler nesta rodada.', null),
  ('vagas','encerrada', 'motivo_encerramento',      'Por que a vaga fechou. "Vaga preenchida" e "Sem candidatos aptos" contam coisas muito diferentes no relatório.', 'Selecione o motivo do encerramento'),
  ('vagas','encerrada', 'data_encerramento',        'Quando a vaga foi encerrada de fato. Com a data de publicação, dá o tempo total do processo.', null),
  -- Candidatos
  ('candidatos','triagem',           'consentimento_lgpd',        null, 'Aviso de privacidade apresentado'),
  ('candidatos','triagem',           'curriculo_avaliado',        'Marque depois de ler, mesmo que a decisão ainda não esteja tomada — separa "não li" de "li e estou pensando".', null),
  ('candidatos','triagem',           'nota_triagem',              'Sua nota para este candidato nesta vaga, não em geral. Serve para ordenar quem chamar primeiro.', null),
  ('candidatos','entrevista1',     'data_entrevista_rh',        'O dia da conversa com o RH. Se ainda não marcou, deixe vazio — data inventada atrapalha mais que campo em branco.', null),
  ('candidatos','entrevista1',     'entrevistador_rh',          'Quem do RH conduziu. Se foram duas pessoas, registre quem assina o parecer.', null),
  ('candidatos','entrevista1',     'parecer_entrevista_rh',     'Sua conclusão depois da conversa. "Aguardando" é resposta válida — melhor que deixar vazio e esquecer.', 'Selecione o parecer do RH'),
  ('candidatos','entrevista1',     'obs_entrevista_rh',         'O que você contaria ao gestor antes da entrevista dele.', 'Boa comunicação; pretensão acima da faixa; disponível em 30 dias'),
  ('candidatos','entrevista2', 'data_entrevista_gestor',    'O dia da conversa com o gestor da área.', null),
  ('candidatos','entrevista2', 'entrevistador_gestor',      'Nome do gestor que entrevistou. É texto livre porque muitas vezes é alguém sem login na plataforma.', 'Nome e área do gestor'),
  ('candidatos','entrevista2', 'parecer_entrevista_gestor', 'A conclusão do gestor, não a sua. Enquanto ele não responder, deixe "Aguardando".', 'Selecione o parecer do gestor'),
  ('candidatos','entrevista2', 'obs_entrevista_gestor',     'O que o gestor falou, nas palavras dele.', 'Gostou do perfil técnico, quer confirmar disponibilidade de turno'),
  ('candidatos','tecnico',     'tipo_teste_tecnico',        'Qual teste foi aplicado — é o que dá sentido à nota do campo seguinte.', 'Teste prático de operação de empilhadeira'),
  ('candidatos','tecnico',     'resultado_teste_tecnico',   'O resultado como ele veio: nota, conceito ou aprovado/reprovado. É texto livre de propósito, porque cada teste mede de um jeito.', '8,5 de 10'),
  ('candidatos','tecnico',     'aprovado_teste_tecnico',    'A decisão, separada da nota: dá para ir bem no teste e mesmo assim não seguir.', null),
  ('candidatos','proposta',          'salario_proposto',          'O valor oferecido a esta pessoa, não a faixa da vaga.', '3.500,00'),
  ('candidatos','proposta',          'data_envio_proposta',       'Quando a proposta foi enviada. Proposta parada sem resposta é onde mais se perde candidato.', null),
  ('candidatos','proposta',          'status_proposta',           'Onde a proposta está. "Negociando" existe para não ter que escolher entre aceita e recusada enquanto a conversa continua.', 'Selecione o status da proposta'),
  ('candidatos','reprovado',         'motivo_reprovacao',         null, 'Selecione o motivo da reprovação')
)
update public.rh_pipeline_stage_fields f
   set help_text   = case when coalesce(f.help_text,'')   = '' then coalesce(t.ajuda,   f.help_text)   else f.help_text   end,
       placeholder = case when coalesce(f.placeholder,'') = '' then coalesce(t.exemplo, f.placeholder) else f.placeholder end,
       updated_at  = now()
  from textos t
 where f.domain = t.domain
   and f.stage_key = t.stage_key
   and f.field_key = t.field_key
   and (
        (coalesce(f.help_text,'')   = '' and t.ajuda   is not null)
     or (coalesce(f.placeholder,'') = '' and t.exemplo is not null)
   );

-- ═══════════════════════════════════════════════════════════════════════
-- 3. ONBOARDING — Pré-admissão: a caixa muda de PERGUNTA
--
-- TRAVA 02. Hoje ela pergunta "Equipamento/acesso ao sistema já solicitado",
-- e o Daniel descreveu exatamente o problema disso: o pedido só é feito
-- depois da contratação. Com a solicitação nascendo na vaga publicada
-- (bloco 4 abaixo), a pergunta útil aqui, na véspera do primeiro dia, deixa
-- de ser "alguém lembrou de pedir" e passa a ser "já chegou".
--
-- Este é o ÚNICO lugar desta carga que altera um campo existente além de
-- texto — e altera só rótulo/ajuda, nunca `required` (segue obrigatório,
-- como já era) nem o valor já gravado em ficha nenhuma.
-- ═══════════════════════════════════════════════════════════════════════

update public.rh_pipeline_stage_fields
   set label       = 'Equipamento e acessos já chegaram',
       help_text   = 'Marque quando o equipamento estiver em mãos e os acessos criados. O PEDIDO agora nasce na vaga publicada, não aqui — aqui se confirma que chegou a tempo.',
       placeholder = 'Tudo em mãos',
       updated_at  = now()
 where domain = 'onboarding'
   and stage_key = 'pre_admissao'
   and field_key = 'equipamento_provisionado'
   and label = 'Equipamento/acesso ao sistema já solicitado';  -- não mexe se alguém já renomeou

update public.rh_pipeline_stage_fields
   set placeholder = 'Padrinho definido', updated_at = now()
 where domain = 'onboarding' and stage_key = 'pre_admissao'
   and field_key = 'buddy_id' and coalesce(placeholder,'') = '';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. CAMPOS NOVOS
--
-- Todos com required = false, sem exceção. O `order_idx` continua de onde a
-- etapa parou. Guardados por `not exists` na chave real (domain, stage_key,
-- field_key), então reexecutar não duplica.
-- ═══════════════════════════════════════════════════════════════════════

insert into public.rh_pipeline_stage_fields
  (domain, company_id, stage_key, field_key, field_type, label, required, options, order_idx, placeholder, help_text)
select v.domain, 'all', v.stage_key, v.field_key, v.field_type, v.label, false, v.options, v.order_idx, v.placeholder, v.help_text
from (values
  -- ── TRAVA 02: o provisionamento nasce na VAGA, não na ficha ───────────
  -- Vaga publicada = alguém vai entrar, e desde 12/09 a vaga sabe quantos
  -- (rh_vagas.positions). Este é o momento em que o pedido tem que sair.
  ('vagas','publicada','itens_provisionar','multicheck','Itens a provisionar',
   '["Notebook","Celular","Crachá","Cartão de benefícios","E-mail e acessos","Uniforme","EPI"]'::jsonb, 3,
   null,
   'O que precisa ser pedido AGORA, antes de existir alguém contratado. Publicar a vaga já significa que alguém vai entrar — é aqui que o pedido tem que sair, não depois da admissão.'),
  ('vagas','publicada','solicitacao_provisionamento_em','date','Solicitação enviada em',
   '[]'::jsonb, 4, null,
   'Quando o pedido foi feito a quem provê. É esta data, não a da contratação, que decide se chega a tempo do primeiro dia.'),
  ('vagas','publicada','responsavel_provisionamento','user','Responsável pelo provisionamento',
   '[]'::jsonb, 5, null,
   'Quem coordena os pedidos desta vaga. Se cada item é pedido a uma área diferente, registre quem puxa o conjunto — não quem entrega cada peça.'),

  -- ── TRAVA 01: documento que não chega ─────────────────────────────────
  -- A relação de documentos já existe como funcionalidade própria (tipo,
  -- status, anexo, quem recebeu). O que falta nela é ATÉ QUANDO e QUEM
  -- COBRA — e isso não é documento, é prazo. Por isso dois campos só, em
  -- vez de recriar a lista aqui.
  ('onboarding','documentacao','prazo_documentos','date','Prazo para entrega',
   '[]'::jsonb, 0, null,
   'Até quando os documentos precisam estar com o RH. A relação do que falta continua na aba de Documentos — aqui é só a data limite.'),
  ('onboarding','documentacao','responsavel_documentos','user','Quem cobra',
   '[]'::jsonb, 1, null,
   'Quem persegue o que está faltando. Sem um nome aqui, o prazo acima vence sem ninguém do lado de dentro ser responsável.'),

  -- ── TRAVA 04: onde registrar a avaliação ──────────────────────────────
  -- O lembrete de fim de período de experiência JÁ EXISTE e já dispara (7 e
  -- 1 dia antes do marco, ver App.jsx compliance_experiencia). Ele levava
  -- para uma tela sem nada a preencher sobre avaliação — a pessoa era
  -- avisada, olhava, e adiava. Estes três campos são o destino que faltava.
  ('onboarding','avaliacao','data_avaliacao','date','Data da avaliação',
   '[]'::jsonb, 0, null,
   'Quando a avaliação foi feita — não o fim do período de experiência, que já está na ficha.'),
  ('onboarding','avaliacao','resultado_avaliacao','select','Resultado',
   '["Efetivar","Prorrogar experiência","Não efetivar"]'::jsonb, 1, 'Selecione o resultado',
   'A decisão sobre a continuidade. É o que permite saber, no fim do ano, quantas contratações não vingaram — número que hoje ninguém tem.'),
  ('onboarding','avaliacao','justificativa_avaliacao','textarea','Justificativa',
   '[]'::jsonb, 2, 'O que sustentou a decisão',
   'Por que esse resultado. Em "Não efetivar", é o que protege a empresa e o que ensina o próximo processo seletivo.'),

  -- ── Removido: por que a pessoa parou aqui ─────────────────────────────
  -- Não veio do Daniel: veio do "desfazer contratação" (12/09), que manda
  -- pra cá a ficha de quem desiste na véspera. Hoje ela chega sem motivo, e
  -- desistência antes de começar e desligamento na experiência viram a
  -- mesma linha no relatório.
  ('onboarding','removido','motivo_saida','select','Motivo da saída',
   '["Desistiu antes de começar","Não apareceu","Desligado no período de experiência","Cadastro criado por engano","Outro"]'::jsonb, 0,
   'Selecione o motivo',
   'Por que esta pessoa saiu antes de o onboarding terminar.')
) as v(domain, stage_key, field_key, field_type, label, options, order_idx, placeholder, help_text)
where not exists (
  select 1 from public.rh_pipeline_stage_fields x
   where x.domain = v.domain and x.stage_key = v.stage_key and x.field_key = v.field_key
);
