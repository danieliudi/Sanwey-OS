# Histórico de migrations (não roda mais)

Os 292 arquivos desta pasta são o histórico de mudanças de schema de
17/04/2026 até 31/08/2026. **Eles não são mais aplicados** — foram
substituídos por `../00000000000000_baseline.sql`, que consolida o estado
real de produção num ponto de partida único.

## Por que foram arquivados

Eles nunca funcionaram como ledger. A conferência de 31/08/2026 contra
produção mostrou:

| | |
|---|---|
| Arquivos aqui | 292 |
| Registros em `supabase_migrations.schema_migrations` (produção) | 381 |
| Batem por nome | 254 |
| Em produção sem arquivo correspondente | **127** |

As 127 ausentes incluem as fundacionais — `create_profiles_with_rls_and_
signup_trigger`, `create_leads_table_with_rls`, `lead_attachments_table`,
`create_marketing_deliverables`, `rh_pipeline_generic_schema`. O arquivo mais
antigo daqui é `20260504_add_client_classification.sql`, que faz
`ALTER TABLE public.leads` — numa base nova, `leads` não existe, e ele quebra
na primeira linha. As primeiras semanas de schema nunca foram versionadas.

Além disso, 11 arquivos têm uma letra colada na data (`20260807b_`,
`20260828b_`, `20260902c_`...) e a CLI do Supabase os **pula em silêncio**,
porque o formato exigido é `<timestamp>_nome.sql`. Eles estão aplicados em
produção, mas sob outra versão numérica — a `20260828b_agencia_escopo...`
consta lá como `20260828150215`.

## Para que servem agora

Registro. O comentário de cada uma explica **por que** aquela mudança foi
feita, e isso continua valendo — várias documentam decisões de segurança e
achados de auditoria que não estão em nenhum outro lugar. Consulte à vontade;
só não conte com elas para reconstruir nada.

Migration nova entra em `supabase/migrations/`, ao lado do baseline, com nome
no formato que a CLI aceita: `<timestamp>_nome.sql`, timestamp de 14 dígitos.
