-- Guarda o identificador do Google Places do destino da visita.
--
-- Por quê: o Planejamento já usa o mesmo autocomplete do Google que a
-- Calculadora (usePlacesAutocomplete, CRMViagensPlanejamentoView.jsx:348),
-- mas ao salvar só o texto do endereço ia pro banco (`destino_planejado`) — o
-- placeId escolhido era descartado. Sem ele, o atalho "calcular o meio mais
-- barato pra essa viagem" abriria a calculadora com os endereços escritos mas
-- SEM quilometragem, obrigando o vendedor a reconfirmar cada parada na lista
-- do Google. Com o placeId guardado, a distância já vem calculada.
--
-- Decisão do Daniel em 01/09/2026, junto com o mockup da calculadora.
--
-- Nullable de propósito, sem backfill: registro antigo (e registro novo cujo
-- destino foi digitado à mão, sem escolher da lista) fica com NULL e cai
-- automaticamente no comportamento anterior — endereço em texto, vendedor
-- reconfirma. Nenhuma tela quebra por causa de NULL aqui.
--
-- Segurança (regra 3.1 do CLAUDE.md): tabela já existente, RLS já habilitada,
-- 4 policies (select/insert/update/delete) que operam por LINHA — coluna nova
-- entra no escopo delas sem alteração. Os GRANTs de crm_viagem_registros são
-- de tabela, não por coluna (conferido em 01/09/2026: as 20 colunas aparecem
-- uniformemente para anon/authenticated/postgres/service_role), então a
-- coluna nova herda a permissão sozinha e não precisa de GRANT explícito.
-- O valor é um identificador público do Google, escrito pelo mesmo usuário e
-- sob a mesma policy que já governa `destino_planejado` — não amplia
-- superfície nem carrega dado sensível.

alter table public.crm_viagem_registros
  add column if not exists destino_place_id text;

comment on column public.crm_viagem_registros.destino_place_id is
  'Google Places place_id do destino, quando o usuário escolheu da lista do autocomplete. NULL = endereço digitado à mão ou registro anterior a 01/09/2026; nesse caso a calculadora abre sem quilometragem e o vendedor reconfirma a parada.';
