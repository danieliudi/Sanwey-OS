# Painel "Conexões" — spec de design (Colaborador + Cliente)

Decidido com o Daniel: painel estilo Pipefy no perfil do Colaborador (RH) e
do Cliente (Comercial), mostrando registros de outras telas que referenciam
aquele colaborador/cliente, agrupados por origem, com preview de card
clicável. Investigação completa via Explore agent — este doc resume o
achado e as decisões de arquitetura.

## 1. O que realmente existe pra conectar (não inventar domínio do exemplo Pipefy)

**Colaborador** (`rh_colaboradores.id` é a chave canônica — cobre também
quem não tem login, via `profile_id` nullable):

| Grupo | Tabela | FK |
|---|---|---|
| Avaliação de Desempenho | `rh_avaliacoes` | `user_id → rh_colaboradores.id` |
| Cargos & Salários (movimentações) | `rh_movimentacoes` | `colaborador_id → rh_colaboradores.id` |
| Treinamentos | `rh_treinamento_atribuicoes` | `colaborador_id → rh_colaboradores.id` |
| Benefícios | `rh_colaborador_beneficios` | `colaborador_id → rh_colaboradores.id` |
| Solicitações de Atualização | `rh_data_update_requests` | `colaborador_id → rh_colaboradores.id` |
| Férias & Licenças | `rh_ferias` | `user_id → profiles.id` (⚠️ ver seção 3) |

**Cliente** (só 2, confirmado via FK live no banco):

| Grupo | Tabela | FK |
|---|---|---|
| Negócios (Funil de Vendas) | `leads` | `client_id → clients.id` |
| Viagens & Reembolsos | `crm_viagem_registros` | `client_id → clients.id` (adicionado nesta rodada) |

**Excluído deliberadamente** (não existem, ou existem mas não são "conexão"):
- Advertências/Suspensões, folha de pagamento — não existem na plataforma.
- Onboarding e Desligamento — **não são outro registro**, são o próprio
  `rh_colaboradores` em etapa/coluna diferente. Não viram grupo de conexão.
- Pesquisas de clima — anonimizadas por design (sem SELECT nem pra RH).
- Fila de Bem-estar — só nome texto livre, sem FK.
- Recrutamento/Candidatos — sem elo automático candidato→colaborador.

## 2. Reuso confirmado

- `src/components/client/ClientsManager.jsx` (linhas 52-62, 524-569) já tem
  o protótipo exato: `dealsByClient` (Map client→leads) + modal "Histórico"
  com preview de card clicável. **Generalizar este padrão**, não criar do
  zero — trocar fonte única por N grupos, e navegação de `setSelectedLead`
  (Lead, drawer global) pra `setSection + initialSelectedXId` nos domínios
  que precisarem trocar de tela.
- `DetailDrawerTabs` (já usado em `RHDetailDrawerShell.jsx:635`) — reaproveitar
  pra dar abas ao modal de Colaborador em vez de continuar empilhando seção.

## 3. Decisão pendente — bug pré-existente em `rh_ferias`

`rh_ferias.user_id` referencia `profiles.id`, não `rh_colaboradores.id` —
único domínio de RH que não passou pela correção já aplicada 5x em outras
tabelas (comentários nas próprias migrations confirmam: "colaborador sem
login não podia ter X registrado, corrigido"). Efeito: colaborador sem
login nunca aparece com férias no painel Conexões (join teria que ser via
`rh_colaboradores.profile_id`, que é NULL pra essa gente).

Duas opções, ambas viáveis:
- **A. Corrigir agora** — migration igual às 5 anteriores (mesmo padrão),
  adiciona `colaborador_id`, backfill, ajusta policies. Resolve de vez.
- **B. Deixar como está** — Conexões mostra "Férias" só pra quem tem login;
  documentado como limitação conhecida, sem mudança de schema agora.

## 4. Decisão pendente — estrutura do modal de Colaborador

Hoje é um modal único (`EmployeeDetailModal`, `RHFuncionariosView.jsx:815`,
maxWidth 560) com 7 seções empilhadas em scroll vertical. Adicionar
"Conexões" (5 grupos, cada um expansível com cards) deixaria isso
espremido.

- **A. Converter pra abas** (`DetailDrawerTabs`) — Dados/Benefícios/
  Assinatura/Solicitações/Documentos/Conexões. Mexe na tela mais usada de
  RH, mas é o padrão que o resto da plataforma já usa.
- **B. Manter empilhado**, "Conexões" vira só mais uma seção (resumida,
  com link "ver tudo" se precisar).

## 5. Navegação cross-view — trabalho novo necessário

Hoje só 2 padrões existem:
- **Lead**: drawer global (`selectedLead` fora das rotas) — abre sem trocar
  de seção. Reaproveitável tal como está pro grupo "Negócios" do Cliente.
- **Campanha/Funcionário via Cmd-K**: `setSection + initialSelectedXId`,
  cada view consome via `useEffect` próprio.

**Nenhum board de RH** (Férias, Treinamentos, Avaliação, Cargos) aceita hoje
um id inicial de fora. Pra Conexões funcionar de ponta a ponta (clicar no
card e abrir o registro), é preciso implementar
`initialSelectedXId`/`onInitialXConsumed` em cada um desses 4 componentes
de view — replicando o padrão já usado, não inventando um novo.

**Viagens** (`CRMViagensPlanejamentoView.jsx`) também precisa do mesmo
tratamento pro grupo "Viagens" do Cliente.

## 6. Busca dos dados — RPC vs. queries client-side

Recomendado: uma função `SECURITY DEFINER` central (mesmo padrão de
`get_my_colaborador`, `20260740_colaborador_portal_role.sql:27-62`) que
recebe `colaborador_id` (ou `client_id`) e devolve os grupos já contados +
os N primeiros registros de cada um, em vez de 5-6 queries client-side
separadas — mais rápido e não depende de RLS client-side coincidir em cada
tabela.

## 7. Fora de escopo desta rodada

- Onboarding/Desligamento não entram como grupo (são o próprio registro).
- Migrar arquitetura de "connections" pra domínios fora de RH/Comercial
  (Marketing, Compras) — não pedido, não há FK pra isso ainda.
