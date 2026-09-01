# Plano de implementação e reestruturação do processo de vendas

Módulo Comercial novo (Catálogo · Preço por cliente · Central de Pedidos · Portal
B2B). Schema e telas aplicados em produção 12/08/2026, versão 4.53.0.
Este documento é o plano para o que vem **depois** do código: os dados que
precisam entrar, os papéis que mudam, a ordem das ondas e o que ainda falta
construir.

Escrito em 13/08/2026, com os números lidos direto da produção nessa data.

---

## 0. Diagnóstico — onde o projeto realmente está

Estado da produção hoje (contagem direta no banco, 13/08/2026):

| O que | Hoje | Leitura |
|---|---|---|
| Clientes cadastrados | 15 | **14 sem dono definido** |
| Produtos no Catálogo | **0** | catálogo vazio |
| Preços de tabela preenchidos | **0** | o suporte ainda não subiu nada |
| Liberações cliente × produto | **0** | nenhum cliente pode comprar nada |
| Regras de margem | **0** | o guarda-corpo existe, sem número dentro |
| Pedidos | **0** | |
| Negócios no funil | **1** | último criado em 10/08 |
| Usuários | 14 (7 vendedores puros) | **nenhum com o papel `suporte`** |
| Módulos Catálogo e Pedidos | `test` | só o admin enxerga |
| Contatos e endereços de cliente | 0 e 0 | pré-requisito do pedido e do portal |
| Transições de etapa configuradas | 0 | motor pronto e desligado |
| Campos por etapa do funil | 86 | configuração feita, sem uso |

Nada disso é bug: é o estado natural de um módulo que subiu ontem. Mas define
onde está o risco do projeto, e não é onde normalmente se procura.

**O software está pronto. O processo ainda não existe.**

O aviso mais importante da tabela é a linha do funil. Já existe uma ferramenta
comercial no ar — o Funil de Vendas, com 86 campos configurados por etapa — e o
time inteiro registrou **um** negócio. Isso não é preguiça do time: é o sintoma
padrão de uma ferramenta que foi ligada sem que a rotina mudasse junto. Ligar
Catálogo e Pedidos do mesmo jeito repete o mesmo resultado numa escala maior — com
a diferença de que, desta vez, o cliente enxerga o resultado pela porta do portal.

Vale ler junto uma boa notícia escondida na mesma tabela: **a base é de 15
clientes**. As três primeiras ondas abaixo são dias de trabalho, não meses. O
projeto é pequeno o bastante para ser feito direito.

### O princípio que sustenta o plano inteiro

> Sistema nenhum cria processo. Ele só torna caro fugir do processo que a
> gerência já decidiu.

Por isso cada onda abaixo tem duas metades: **uma configuração** (dado que entra
no sistema) e **uma decisão de gestão** (regra que passa a valer para as
pessoas). Onda que sai só com a metade técnica não muda nada — e é exatamente o
que aconteceu com o funil.

---

## 1. O processo de vendas: hoje e depois

### Hoje (reconstruído das decisões registradas nas migrations)

1. Cliente pede por WhatsApp direto para o vendedor
2. Vendedor pergunta o preço de tela para o suporte
3. Suporte olha no Kronosys e responde
4. Vendedor põe a margem "de acordo com as orientações da gerência" — que vivem na conversa
5. Fecha por WhatsApp
6. Suporte sobe no Kronosys
7. O controle vive em planilha; o cliente pergunta "e meu pedido?" por WhatsApp

São 7 passos, 5 deles em canal que não deixa rastro. Onde o dinheiro vaza:
preço que depende de quem atendeu, margem sem piso, pedido sem dono nem prazo,
cliente no escuro, e nenhum histórico que a gerência consiga ler depois.

### Depois — e onde cada peça já existe no código

| Passo | Onde mora | Quem faz |
|---|---|---|
| Produto e preço de tabela | `products.preco_tabela` (Catálogo) | Suporte |
| Preço do cliente | `client_products.price` (Clientes → Produtos & Preços) | Vendedor dono |
| Limite da negociação | `margin_rules` (aviso e/ou regra dura) | Gerência define |
| Pedido entra, por qualquer canal | `orders.origem` (portal, whatsapp, e-mail, telefone) | Quem recebeu |
| Conferência e nº do ERP | trava no banco: confirmar exige `kronosys_numero` | Suporte |
| Rastro | `order_stage_history` grava quem moveu e quando | automático |
| Cliente se serve sozinho | Portal B2B, com o preço dele | Onda 5 |

**A regra do desenho: o canal não muda, o registro muda.** Ninguém precisa parar
de vender por WhatsApp. Precisa que o WhatsApp termine num card — e a tela já
nasceu para isso (o botão "Novo pedido" existe justamente para registrar o que
chegou por fora).

---

## 2. Papéis — a reestruturação de verdade

A separação de **dois preços com dois donos** já está gravada no banco, e é o
coração da mudança. Vale escrever como norma da área, não só como comentário de
migration:

- `products.preco_tabela` — o "preço tela". Dono: **suporte comercial**. Nunca entra em pedido.
- `client_products.price` — tabela + margem. Dono: **vendedor da conta**. É o único preço que entra em pedido.

Sem essa separação, o caminho fácil seria dar login de vendedor para o suporte só
para ele alcançar a Central de Pedidos — e junto viria a caneta da negociação.

| | Suporte comercial | Vendedor | Gerência | Diretoria |
|---|---|---|---|---|
| Preço de tabela | **mantém** | lê | lê | lê |
| Preço do cliente | não alcança | **define**, dentro da regra | aprova exceção | lê |
| Regra de margem | lê | lê | **define** | lê |
| Dono da conta | — | **é** | atribui | lê |
| Cadastro de produto | **pode criar** | — | pode criar | — |
| Conferência do pedido | **faz** | acompanha | — | — |
| Sobe no Kronosys e traz o número | **faz** | — | — | — |
| Confirmar o pedido no quadro | pode | pode | pode | — |
| Funil de vendas | não alcança | **é dele** | cobra | lê |

Duas observações que já estão no RLS e evitam discussão depois:

- **Cliente sem dono abre para qualquer vendedor da mesma empresa; com dono,
  fecha.** Foi decisão explícita — fechar por omissão travaria 14 dos 15
  clientes no dia da migration. É por isso que atribuir dono (Onda 0) importa:
  enquanto ninguém atribui, a regra de dono não está valendo de fato.
- **O cliente externo é o oposto: fecha por omissão.** Login sem vínculo não
  enxerga linha nenhuma. No portal, abrir por omissão seria vazamento entre
  concorrentes.

---

## 3. As ondas

Cada onda tem pré-requisito, as duas metades (dado + decisão), critério de saída
mensurável e o risco de queimar a etapa. A ordem não é negociável: cada uma
existe porque a seguinte não funciona sem ela.

### Onda 0 — Fundação de dados · 1 a 2 semanas

Sem isto, todas as telas novas abrem vazias. É a onda mais chata e a única
inegociável.

**Dado que entra**
- Catálogo carregado: SKU, nome, unidade, MOQ, certificações e preço de tabela.
  Fonte: Kronosys. Ordem de grandeza conhecida: os 15 modelos Sanbag mais a linha
  Resibag — a lista definitiva sai do ERP, não da memória.
- Dono atribuído aos 14 clientes sem dono.
- Contato e endereço de entrega por cliente ativo (o pedido usa os dois; o portal
  também).
- `clients.external_codes` preenchido com o código do cliente no Kronosys — é o
  que fecha o ciclo na hora da conferência.

**Decisão de gestão**
- Quem são os logins do suporte (Júlio, Priscila, Tainá) e criação com o papel
  `suporte`. Hoje o papel existe no banco e ninguém o tem.
- Quem responde por cada conta. Não é burocracia: é a regra de quem pode mexer
  no preço daquele cliente.

**Critério de saída**
100% dos SKUs ativos no Catálogo com preço de tabela · 15/15 clientes com dono ·
3 logins de suporte ativos · todo cliente ativo com ao menos 1 contato e 1
endereço.

**Risco de queimar a etapa:** abrir o módulo para o time com o catálogo vazio.
A primeira impressão vira "não tem nada aqui" e não se recupera. Os módulos estão
em `test` justamente para isso — só saem de `test` quando a onda correspondente
fecha.

**Trava conhecida:** o Catálogo cria produto **um a um**, num modal. Para dezenas
de SKUs isso é lento e erra. Ver backlog item 1.

---

### Onda 1 — A regra da margem · 1 semana (é decisão, não construção)

**Dado que entra**
- `margem_aviso_pct` e `margem_minima_pct` por empresa (uma regra padrão para
  `industria`, outra para `resibag`), mais as exceções por produto onde fizer
  sentido.

O número guardado é a variação percentual sobre o preço de tabela:
`preço_cliente = preço_tabela × (1 + pct/100)`. `+20` é vender 20% acima da
tabela; `-10` é conceder 10% de desconto.

**Decisão de gestão — e a recomendação forte deste plano**

Começar **só com aviso** (`margem_aviso_pct` preenchido, `margem_minima_pct`
nulo) por 30 dias. Medir a margem realmente praticada. Só então ligar a regra
dura, calibrada pelo que os dados mostraram.

Ligar o bloqueio antes de conhecer a distribuição real de descontos produz, no
primeiro dia, exceção pedida por WhatsApp para a gerência — que é exatamente o
comportamento que o projeto quer eliminar. O aviso ensina sem travar; a regra
dura entra quando já se sabe onde ela deve ficar.

**Critério de saída**
2 regras padrão ativas (uma por empresa) · gerência sabe dizer, sem consultar
ninguém, qual é o piso de desconto de cada empresa.

---

### Onda 2 — Preço por cliente para a base ativa · 2 semanas

**Dado que entra**
- Para cada cliente ativo, o vendedor dono libera os produtos que aquele cliente
  compra, com o preço que já é praticado hoje.

Isto **não é renegociação** — é transcrição do que já vale. Deixar claro para o
time evita a leitura de que o sistema está mexendo em acordo comercial fechado.

**Decisão de gestão**
- Ninguém libera produto sem preço: a coluna é obrigatória por construção. Se o
  preço daquele cliente ainda não existe, é porque a negociação ainda não
  aconteceu — e essa é a informação útil que a tela devolve.
- Pausar (`active = false`) é o jeito de suspender sem perder o preço negociado.

**Critério de saída**
Todo cliente que comprou nos últimos 12 meses tem ao menos 1 produto liberado ·
zero pedidos travados por "produto não liberado" na primeira semana da Onda 3.

**O que o time ganha aqui, e vale dizer em voz alta:** o vendedor para de
perguntar preço para o suporte a cada pedido. É o primeiro benefício visível da
mudança para quem vende — e é o que compra a adesão das ondas seguintes.

---

### Onda 3 — O pedido passa a nascer no quadro · piloto 2 semanas, depois rollout

**Piloto**
1 vendedor + 1 pessoa do suporte + os clientes daquele vendedor. Regra única do
piloto: **todo pedido daquele vendedor entra no quadro**, inclusive o que chegou
por WhatsApp (origem = `whatsapp`).

**Decisão de gestão — a frase que faz o projeto pegar**

No rollout, a partir de uma data de corte: **pedido que não está no quadro não é
subido no Kronosys.**

Essa é a única regra que muda comportamento de verdade, e ela funciona porque o
gargalo natural do fluxo — o suporte, que é quem sobe no ERP — é quem a aplica.
Não depende de cobrança individual, não depende de disciplina, não depende de
ninguém lembrar.

**Ritual que nasce junto**
O suporte abre o quadro de manhã e zera a coluna "Enviado". "Enviado" é fila
(ninguém pegou), "Conferência" é trabalho em curso — a diferença entre as duas é
o que torna o quadro útil às 8h.

**Critério de saída**
≥90% dos pedidos do mês com card · tempo médio Enviado → Confirmado abaixo de 1
dia útil · 100% dos confirmados com número do Kronosys (a trava do banco
garante) · nenhum pedido parado há mais de 3 dias.

**Risco:** o suporte virar gargalo. Medir a fila "Enviado" desde o primeiro dia.
Confirmar não é exclusividade do suporte — vendedor e gerente também podem, e
isso é intencional.

---

### Onda 4 — O funil de vendas volta a valer · em paralelo à Onda 3

Não estava no escopo do módulo novo, e é onde o projeto morre se for ignorado.

Pedido é o **fim** do processo comercial. Funil é o **começo**. Com 1 negócio
registrado, a diretoria continua sem previsão nenhuma, por mais bonito que fique
o quadro de pedidos — e a Central de Pedidos vira um sistema de digitação, não de
gestão.

**Dado que entra**
- Configurar `pipeline_stage_transitions` (0 linhas hoje; o motor
  `usePipelineTransitions`/`isTransitionAllowed` está pronto e desligado).
- Usar os 86 campos por etapa que já estão configurados — ou podar os que não
  servem. Campo obrigatório que ninguém preenche ensina o time a burlar.

**Decisão de gestão — FECHADA com o Daniel em 01/09/2026**

A regra do piloto tem três partes, e é o que a folha entregue ao vendedor diz
(artifact "Piloto do Funil Resibag", 01/09/2026):

1. **Gatilho** — toda empresa com quem houve uma *conversa comercial de
   verdade* (visita, ligação atendida, e-mail respondido, contato em feira)
   vira card no mesmo dia. Sem filtro de tamanho. A alternativa mais estreita
   que foi oferecida — "visita ou cotação enviada" — foi descartada: menos
   cards, mas o funil deixaria de mostrar o topo real.
2. **Movimento** — todo card tem uma **próxima ação com data**, sempre, em
   qualquer etapa. Card sem próxima ação avança de etapa ou vai pra Perdido.
   A coluna existe (`leads.next_follow_up`), já dispara notificação no dia
   (`use-notifications.js`) e já aparece no painel inicial e no calendário do
   funil. **Vale como combinado, não como trava** (decidido com o Daniel
   01/09/2026): o campo continua não barrando o salvamento; quem deixar em
   branco aparece na reunião de segunda. Ligar a trava foi a alternativa
   oferecida e recusada por ora — campo obrigatório em piloto de primeira
   semana ensina a burlar, que é a mesma lição já registrada no CLAUDE.md
   sobre os 28 campos obrigatórios do funil da Resibag. **Gatilho de
   revisão:** se a reunião de segunda mostrar que não pegou, a trava volta à
   mesa — e aí é mudança de comportamento visível, então passa por mockup
   antes (regra 3).
3. **Ritual** — segunda de manhã, 20 minutos, quadro aberto. Card sem próxima
   ação ou parado além do SLA da etapa entra na pauta, pra decidir junto se
   avança ou encerra.

- SLA por etapa já está configurado (7, 7, 14, 21 e 14 dias) e passa a valer
  como pauta da reunião de segunda — é o que a folha do vendedor publica.

**Estado real do funil em 01/09/2026** (contagem direta, pra medir o piloto
contra um ponto de partida honesto): 27 cards, todos Resibag, todos criados
por uma pessoa só entre 26 e 28/08 · **nenhum mudou de etapa desde que foi
criado** · **nenhum tem `next_follow_up` preenchido** · 7 têm alguma atividade
registrada · `pipeline_stage_transitions` continua em 0 linhas.

Primeiro passo combinado: na primeira semana, cada um dos 27 cards ganha uma
próxima ação com data — ou vai pra Perdido.

**Critério de saída**
Cada vendedor com ≥5 negócios ativos e movimento semanal · nenhuma etapa com card
estourando SLA sem justificativa.

---

### Onda 5 — Portal B2B, a terceira porta · só depois das anteriores

**Estado hoje:** o app não existe. O projeto Supabase `portal-b2b-resibag`, criado
em 04/08, está **vazio — zero tabelas**. A arquitetura decidida é "uma base, três
portas": um banco só, três aplicações com deploys e logins separados, e o RLS como
fronteira real. Ou seja, aquele projeto separado ou é descartado, ou vira apenas o
deploy do app, sem banco próprio.

**Pré-requisito duro:** catálogo carregado (Onda 0) e preço liberado por cliente
(Onda 2). O portal só mostra ao cliente o que foi liberado para ele — o RLS fecha
por omissão de propósito. Portal antes do dado é uma tela em branco entregue ao
cliente.

**Piloto:** 2 a 3 clientes de compra recorrente, que já pedem sempre o mesmo.

**O que ainda precisa ser construído:** o app do portal · o convite e o vínculo
`profiles.client_id` na prática · o aviso de carrinho abandonado (`rascunho`) para
o vendedor dono — decidido em 12/08 e ainda não feito.

---

## 4. Backlog técnico derivado — o que falta no sistema

Ordenado por qual onda cada item destrava.

| # | Item | Trava | Por quê |
|---|---|---|---|
| 1 | Importação de produtos em massa (colar planilha / CSV) | Onda 0 | hoje o Catálogo cria um a um, num modal |
| 2 | Liberação de preço em lote por cliente | Onda 2 | mesmo problema, multiplicado por cliente |
| 3 | Campo do código do cliente no Kronosys na tela | Onda 0 | `clients.external_codes` existe no banco e no hook, sem campo na interface |
| 4 | Notificação de pedido parado | Onda 3 | hoje é só um banner em tela; `use-notifications.js` não tem nada de pedido — suporte de folga = pedido esquecido |
| 5 | Anexo no card do pedido | Onda 3 | a aba `Anexos` existe no drawer e é só um texto de espera — não recebe arquivo. A OC em PDF do cliente não tem onde morar (achado ao escrever o playbook) |
| 6 | Configurar transições de etapa do funil | Onda 4 | 0 linhas, motor pronto |
| 7 | Painel Executivo: Pedidos na faixa de saúde + aba própria | Onda 3 | regra 9 do CLAUDE.md — domínio novo precisa de entrada; a aba "Comercial" hoje lê funil, não pedido |
| 8 | Spotlights de Catálogo e Pedidos | Onda 3 | regra 12 — `data-tour="pedidos-novo"` e `catalogo-novo-produto` já estão no código, sem entrada em `FEATURE_SPOTLIGHTS`. É o que faz o time achar a tela sozinho |
| 9 | Tutorial em Ajuda & Tutoriais | Onda 3 | regra 10 — o fluxo muda como o trabalho é feito, não é só um botão novo |
| 10 | App do portal B2B | Onda 5 | não existe |
| 11 | Aviso de carrinho abandonado ao vendedor dono | Onda 5 | decidido em 12/08, não construído |

Itens 7, 8 e 9 não são enfeite: são as três regras do CLAUDE.md que existem
justamente porque entregas anteriores foram ao ar sem elas e ninguém percebeu que
a novidade existia.

---

## 5. Indicadores — o que a gerência lê toda semana

Todos saem do que já está no banco, sem construir relatório novo:

| Indicador | Onde | Meta |
|---|---|---|
| **Cobertura** — % dos pedidos do mês que têm card | `orders` vs. o que subiu no Kronosys | ≥90% |
| **Fila** — pedidos em "Enviado" e idade do mais velho | quadro de Pedidos | zerar diariamente |
| **Ciclo** — tempo médio Enviado → Confirmado | `order_stage_history` | < 1 dia útil |
| **Integridade** — confirmados com nº do Kronosys | `orders.kronosys_numero` | 100% (a trava garante) |
| **Parados** — sem movimento há mais de 3 dias | já sinalizado na tela | 0 |
| **Margem realizada** vs. o aviso configurado | `client_products` × `products.preco_tabela` | dentro do aviso |
| **Contas sem dono** | `clients.owner_ids` | 0 |
| **Clientes ativos sem produto liberado** | `client_products` | 0 |
| **Funil** — negócios ativos por vendedor | `leads` | ≥5, com movimento semanal |

A **cobertura** é a única que mede adoção. Se ela cair, nenhuma das outras
significa coisa alguma — um quadro impecável com 30% dos pedidos é um quadro que
mente.

### Rituais

- **Diário, 10 min, suporte** — zerar a fila "Enviado".
- **Semanal, 30 min, gerência + vendedores** — quadro de pedidos e funil, três
  números na mesa: cobertura, ciclo, margem.
- **Mensal, diretoria** — Painel Executivo (depois do item 7 do backlog).

---

## 6. Riscos e antídotos

| Risco | Sinal precoce | Antídoto |
|---|---|---|
| O time continua fechando por WhatsApp e não registra | cobertura < 70% na 2ª semana | a data de corte aplicada no gargalo: sem card, o suporte não sobe no Kronosys |
| Regra dura de margem cedo demais → exceção por WhatsApp | pedidos de exceção chegando à gerência | 30 dias só de aviso antes de ligar o bloqueio (Onda 1) |
| Suporte vira gargalo | fila "Enviado" crescendo dia a dia | medir a fila desde o 1º dia; confirmar não é exclusividade do suporte |
| Catálogo desatualizado em relação ao Kronosys | divergência de preço aparecendo na conferência | dono único do preço de tabela (suporte) + revisão mensal combinada |
| Portal aberto antes do dado | cliente vê tela vazia | pré-requisito duro da Onda 5 |
| Módulo liberado antes da rotina existir | "não sei o que é isso" no primeiro dia | `module_states` em `test` até a onda fechar |
| Onda 4 ser adiada "para depois" | funil continua com 1 negócio | ela é paralela à 3, não sequencial — sem começo, o fim vira digitação |

---

## 7. Cronograma sugerido

Semanas relativas ao arranque, não datas fixas — a Onda 0 depende de extrair a
lista de SKUs do Kronosys, e esse prazo quem dá é a área.

```
Semana  1   2   3   4   5   6   7   8   9  10  11  12
O0     ███████
O1         ███                      (aviso)      ▓▓▓ (regra dura)
O2             ███████
O3                     ███████ piloto   ███████████ rollout
O4                     ███████████████████████████ em paralelo
O5                                     ███████████ portal (piloto)
```

Marcos que valem comemorar com o time, porque cada um é um problema real que
morreu: catálogo carregado · primeiro pedido registrado no quadro · primeira
semana com 90% de cobertura · primeiro pedido que o cliente fez sozinho.

---

## 8. Decisões que dependem do Daniel

1. **Data de corte da Onda 3** — a partir de quando pedido sem card não sobe no
   Kronosys.
2. **Os números da margem** por empresa (aviso e mínimo), e confirmação da
   sequência recomendada: 30 dias só de aviso, depois a regra dura.
3. **Quem são os 3 logins de suporte** e quando são criados. (O RLS já permite
   que o suporte cadastre produto — não há decisão pendente aí.)
4. **Vendedor e clientes do piloto** da Onda 3.
5. **Destino do projeto `portal-b2b-resibag`** — a recomendação é descartar e
   apontar o portal para o banco do CRM, como manda a arquitetura "uma base, três
   portas" já decidida.
6. **Onda 4 entra junto com a 3?** A recomendação é sim: o quadro de pedidos sem
   funil vivo devolve operação, não previsão.

**Atualização de 01/09/2026** — as decisões 1, 2, 3 e 5 seguem abertas (o
Daniel pediu pra pausá-las e começar pelo piloto com os vendedores). A
sub-decisão da Onda 4 que travava tudo — *o que obriga a existência de um card
e o que o faz andar* — **está fechada**; o texto acordado está na Onda 4 acima.
A última pergunta técnica que sobrou dela — se a "próxima ação com data" vira
trava de sistema ou fica como combinado — **foi respondida em 01/09/2026:
combinado**. Nenhuma mudança de código pendente pro piloto arrancar.

---

## 9. O que este plano não resolve

Honestidade sobre os limites, para não descobrir na metade:

- **Kronosys não tem API.** O número é digitado à mão, por decisão registrada. Se
  o ERP ganhar integração algum dia, a trava do banco continua valendo e só o
  preenchimento muda.
- **Nada aqui melhora a prospecção.** O módulo cuida do cliente que já é cliente.
  Trazer cliente novo é o funil (Onda 4) e é outro problema.
- **Preço por cliente não tem herança nem tabela de fallback.** Foi decisão
  explícita: conta aprovada começa com zero produtos liberados. Isso é mais
  trabalho na Onda 2 e é o que impede pedido sair com preço que ninguém negociou.
- **Este plano assume que a gerência quer mesmo o guarda-corpo de margem.** Se a
  resposta real for "cada vendedor negocia como quiser", a Onda 1 vira só o
  aviso, para sempre — e tudo bem, mas é melhor decidir isso agora do que
  descobrir por uma regra que ninguém respeita.
