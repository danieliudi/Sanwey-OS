-- Gerador de proposta dentro do funil
--
-- Decidido com o Daniel em 15/09/2026, a partir do gerador em HTML que ele
-- mesmo montou (v5) e do mockup "O gerador da Resibag dentro do funil".
--
-- ── DUAS COLUNAS, NENHUMA TABELA NOVA ─────────────────────────────────────
-- Regra 5 conferida antes: `proposals` e `proposal_line_items` já existem, com
-- versão, status, total e snapshot de ESG. O que faltava era onde guardar o
-- que é específico de uma resposta a RFP — Classe 2, matriz de conformidade e
-- as confirmações da Classe 3. Isso é um documento por proposta, não um
-- modelo relacional: cabe num jsonb ao lado do `esg_snapshot` que já está lá.
--
-- `crm_config_comercial` ganha os fatos canônicos por frente. O Daniel
-- escolheu explicitamente "em configuração, editável por mim" entre as três
-- opções do mockup — a alternativa era arquivo no código, que exige subida de
-- versão pra corrigir um CNPJ.
--
-- O RISCO DESSA ESCOLHA, REGISTRADO: a Classe 1 existe pra impedir que a
-- proposta contradiga a base de marca. Editável na tela, alguém pode
-- desalinhar as duas. As proteções são: só admin/gerente escreve (a policy da
-- tabela já era essa) e a tela mostra quando cada fato mudou e quem mudou,
-- pra que divergência apareça em vez de passar batida.

alter table public.proposals
  add column if not exists rfp_snapshot jsonb;

comment on column public.proposals.rfp_snapshot is
  'Resposta a RFP desta versão da proposta: dados do comprador (Classe 2), matriz de conformidade e as confirmações da Classe 3 (valor + quem confirmou). Snapshot, não espelho — o que foi enviado ao cliente naquele dia fica como estava, mesmo que o negócio mude depois. Ver src/components/lead/PropostaPanel.jsx.';

alter table public.crm_config_comercial
  add column if not exists fatos_canonicos       jsonb,
  add column if not exists fatos_atualizados_em  timestamptz,
  add column if not exists fatos_atualizados_por uuid;

comment on column public.crm_config_comercial.fatos_canonicos is
  'Fatos canônicos da frente usados na Classe 1 da proposta (razão social, CNPJ, contatos, homologação, tagline). NULO = usa o padrão versionado em src/constants/fatos-canonicos.js. Editável em Configurações por admin/gerente, e é decisão do Daniel de 15/09/2026 — o risco conhecido é a tela divergir da base de marca, por isso a data e o autor da última alteração ficam gravados e aparecem na tela.';
comment on column public.crm_config_comercial.fatos_atualizados_em is
  'Quando os fatos canônicos desta frente foram editados pela última vez. Existe pra que uma divergência com a base de marca apareça na tela em vez de passar batida.';

-- RLS: nenhuma policy nova. As duas tabelas já têm RLS ligada e as policies
-- existentes são de TABELA, não de coluna — valem para coluna nova sem
-- alteração. Conferido que não há GRANT por coluna em nenhuma das duas.

-- ── Versão única por negócio (achado de revisão, 15/09/2026) ──────────────
-- `version` era calculada no cliente a partir da lista lida na abertura do
-- drawer, e `useProposals` não assina Realtime. Dois vendedores no mesmo
-- negócio geravam os dois `version = 2` — e "qual proposta o cliente
-- recebeu" passava a ter duas respostas, que é exatamente a pergunta que o
-- versionamento existe pra responder.
--
-- O índice transforma a corrida em ERRO em vez de duplicata silenciosa; o
-- cliente pega o próximo número e tenta de novo (ver use-proposals.js).
create unique index if not exists proposals_lead_version_uniq
  on public.proposals (lead_id, version);
