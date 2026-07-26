# Zona 1 — textura sistemática (trend vs. sublabel vs. nenhum)

Fecha o gap deixado pelo Grau 3 (`docs/design-spec-visao-geral-grau3-zonas.md`):
os 3 dashboards de Visão Geral já compartilham a mesma estrutura de zonas e o
mesmo `StatCard.jsx`, mas a Zona 1 tem 3 texturas visuais diferentes hoje —
Comercial 100% `sublabel`, Marketing misto, RH 100% nem-um-nem-outro. Achado
de auditoria (screenshot + leitura de código), confirmado nesta sessão linha a
linha nos 3 arquivos.

Arquivos lidos por inteiro antes de decidir: `src/components/views/DashboardView.jsx`,
`src/components/views/MarketingDashboardView.jsx`,
`src/components/views/RHOverviewView.jsx`, `src/hooks/use-rh-colaboradores.js`,
`src/hooks/use-leads.js` (grep de `createdAt`/`stageChangedAt`),
`src/components/ui/StatCard.jsx`, `src/utils/date.js`,
`src/constants/visao-geral-widgets.js`.

**Decisão-quadro já fechada com o Daniel (não reabrir)**: cada card decide
entre `trend` (comparação temporal que agrega sinal real e é barata a partir
de dado já carregado) e `sublabel` (fato secundário sem necessidade de
histórico) — nunca "todo card com X". Ficar sem nenhum dos dois só quando
genuinamente não há fato secundário, e isso tem que estar documentado, não
implícito.

---

## 0. Nenhuma mudança de schema

Todo cálculo desta spec usa campos que já existem e já estão carregados nas 3
views: `leads.createdAt`/`stageChangedAt`/`stage`/`value` (`use-leads.js:38,53,55`),
`colaboradores.admissionDate`/`desligamentoDate`/`employeeStatus`
(`use-rh-colaboradores.js:27,39,29`). Nada aqui pede coluna nova — se o
Frontend achar que precisa de uma, é sinal de que se afastou desta spec.

---

## 1. Extração `monthBounds`/`within`/`pctChange` — 3ª ocorrência, obrigatória agora

Hoje só existem em `MarketingDashboardView.jsx:31-46`, locais ao arquivo. Com
Comercial e RH também precisando do mesmo cálculo "mês corrente vs. mês
anterior" nesta spec (§2/§3), o gatilho da regra 4 do CLAUDE.md (extrair na
3ª ocorrência real, nem antes nem depois) é cruzado agora — teria sido errado
extrair antes (só 1 uso) e seria errado deixar pra depois (já são 3).

**Destino: `src/utils/trend.js` (arquivo novo), não `src/utils/date.js`.**
Motivo: `date.js` é sobre formatar/interpretar 1 data isolada
(`formatDateBR`, `daysSince`, `parseDateInput`, `closeDateUrgencyStyle`,
`relativeTime`) — nenhuma função de lá compara dois períodos. `monthBounds`/
`within`/`pctChange` são sobre bucketizar e comparar valores agregados entre
2 janelas de tempo pra alimentar a prop `trend` do `StatCard` — uma
preocupação diferente e coesa o bastante (e vai crescer, não só estes 3 usos)
pra merecer arquivo próprio. Segunda opção considerada e descartada: colocar
os 3 dentro de `date.js` mesmo — rejeitada porque misturaria "formatação de 1
data" com "aritmética de 2 janelas + %", duas responsabilidades que times
diferentes (quem escreve um badge de vencimento vs. quem escreve um card de
KPI) tendem a procurar em lugares diferentes.

**Assinatura exata (idêntica à implementação atual do Marketing — só muda
onde mora — com 1 correção de bug latente, ver nota abaixo):**

```js
// src/utils/trend.js
import { parseDateInput } from "./date";

export function monthBounds(date) {
  const d = new Date(date);
  return [
    new Date(d.getFullYear(), d.getMonth(), 1),
    new Date(d.getFullYear(), d.getMonth() + 1, 1),
  ];
}

export function within(date, start, end) {
  if (!date) return false;
  const d = parseDateInput(date);
  if (Number.isNaN(d.getTime())) return false;
  return d >= start && d < end;
}

export function pctChange(curr, prev) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}
```

**Correção de bug latente embutida nesta extração**: `within()` de hoje
(`MarketingDashboardView.jsx:38-42`) faz `new Date(date)` cru. Funciona
porque os campos que o Marketing compara (`createdAt`, `stageChangedAt`) são
`timestamptz` (têm hora). RH vai alimentar o mesmo `within()` com
`admissionDate`/`desligamentoDate`, que são colunas `date` puras
(`"AAAA-MM-DD"`) — exatamente o caso que `date.js:3-5` já documenta como
armadilha (`new Date("2026-07-01")` vira meia-noite UTC, que "volta" um dia
em fuso negativo). Trocar por `parseDateInput` (já usado em
`RHOverviewView.jsx:17,163`) fecha esse bug antes que ele exista, sem mudar
nenhum comportamento pro uso atual do Marketing (mesma saída pra strings com
hora). Isso é o tipo de achado que o CLAUDE.md pede pra pegar em revisão, não
depois em produção.

`shortMonth` (`MarketingDashboardView.jsx:47-49`) **não muda de lugar** —
formata rótulo de eixo X pros gráficos de 6 meses (Atividade mensal, Burn
rate), uso exclusivo do Marketing, nenhum outro card desta spec precisa
disso. Mover seria especulativo, não 3ª ocorrência real.

**O que muda em `MarketingDashboardView.jsx`**: remove as 3 funções locais
(`:31-46`), adiciona `import { monthBounds, within, pctChange } from
"../../utils/trend";`. Nenhuma outra linha do arquivo muda por causa da
extração (mesma assinatura, mesmo comportamento pros usos existentes).

---

## 2. Comercial (`DashboardView.jsx`) — 4 cards, 2 mudam

Estado hoje: **todos os 4 usam `sublabel`, nenhum usa `trend`** — mesmo tendo
`leads.createdAt` e `leads.stageChangedAt` disponíveis em `scopedLeads`
(confirmado via grep em `use-leads.js:38,53,55`) desde sempre, sem uso pra
nada temporal na tela.

### 2.1 `leads_count` — muda pra `trend`

**Hoje** (`DashboardView.jsx:254-260`):
```jsx
<StatCard icon={Target} value={scopedLeads.length}
  label={isManager ? (isGroupView ? "Leads no grupo" : "Leads da empresa") : "Meus leads"}
  sublabel={`${stats.fitCount70} com fit ≥ 70`} compact />
```

**Vira**:
```jsx
<StatCard icon={Target} value={scopedLeads.length}
  label={isManager ? (isGroupView ? "Leads no grupo" : "Leads da empresa") : "Meus leads"}
  trend={mom.leads.d} compact />
```

Novo `useMemo` (inserir depois de `stats`, `DashboardView.jsx:76`, antes de
`tasks`):
```jsx
// Zona 1 — mês corrente vs. mês anterior, mesmo recipe do Marketing
// (mom.campaigns), aplicado a scopedLeads já carregado.
const mom = useMemo(() => {
  const now = new Date();
  const [cs, ce] = monthBounds(now);
  const prev = new Date(now); prev.setMonth(prev.getMonth() - 1);
  const [ps, pe] = monthBounds(prev);
  const lc = scopedLeads.filter(l => within(l.createdAt, cs, ce)).length;
  const lp = scopedLeads.filter(l => within(l.createdAt, ps, pe)).length;
  const wc = scopedLeads.filter(l => l.stage === "ganho" && within(l.stageChangedAt, cs, ce))
    .reduce((s, l) => s + l.value, 0);
  const wp = scopedLeads.filter(l => l.stage === "ganho" && within(l.stageChangedAt, ps, pe))
    .reduce((s, l) => s + l.value, 0);
  return {
    leads: { v: lc, d: pctChange(lc, lp) },
    won:   { v: wc, d: pctChange(wc, wp) },
  };
}, [scopedLeads]);
```
Import novo: `import { monthBounds, within, pctChange } from "../../utils/trend";`
(`DashboardView.jsx:18`, junto de `formatDateBR`/`daysSince`).

**Nota**: `stats.fitCount70` (`:69`) fica sem consumidor depois desta troca.
Não precisa remover do `useMemo` (custo desprezível), mas fica registrado —
se o Frontend preferir limpar, pode; se deixar, não é bug, só dado ocioso.

### 2.2 `pipeline_open` — mantém `sublabel`, sem mudança

`DashboardView.jsx:261-267`, inalterado:
```jsx
<StatCard icon={HandCoins} value={formatK(stats.pipelineValue)}
  label="Funil de Vendas aberto" sublabel={`${stats.openCount} oportunidades`} compact />
```
Justificativa (ver §2.5 pra opções consideradas): `pipelineValue` é estoque
(valor de tudo que está aberto agora), não fluxo — não tem um "mês anterior"
limpo pra comparar sem forçar uma métrica diferente da que o número mostra.

### 2.3 `won_value` — muda pra `trend`

**Hoje** (`DashboardView.jsx:268-273`):
```jsx
<StatCard icon={CheckCircle2} value={formatK(stats.wonValue)}
  label="Valor ganho" sublabel={`${stats.wonCount} fechados`} accent={accent} compact />
```

**Vira**:
```jsx
<StatCard icon={CheckCircle2} value={formatK(stats.wonValue)}
  label="Valor ganho" trend={mom.won.d} accent={accent} compact />
```
Usa `mom.won` já definido em §2.1. Analogia direta com `kpi_deliverables` do
Marketing (`d.stage === "entregue" && within(d.stageChangedAt, cs, ce)`) —
mesmo recipe, campo diferente (`stage === "ganho"` em vez de `"entregue"`).
`stats.wonCount` (`:71`) fica sem consumidor, mesma nota do §2.1.

### 2.4 `avg_fit` — mantém `sublabel` + `tooltip`, sem mudança

`DashboardView.jsx:274-280`, inalterado.

### 2.5 Notas de decisão subjetiva — Comercial

- **`leads_count`**: opções eram (A, escolhida) `trend` de novos leads
  criados este mês vs. mês anterior, ou (B) manter `sublabel` de composição
  (`${stats.fitCount70} com fit ≥ 70`). Escolhido A por consistência
  sistêmica: é estruturalmente o mesmo tipo de card que `kpi_active` do
  Marketing (contagem de registros no escopo), que já usa `trend` pelo mesmo
  motivo — mesma lógica aplicada a dado diferente, não um comportamento novo
  inventado só pro Comercial.
- **`pipeline_open`**: opções eram (A) forçar um proxy de fluxo — ex.
  contagem de leads criados este mês que ainda estão em etapa não-terminal —
  ou (B, escolhida) manter `sublabel`. Escolhido B porque o proxy de fluxo em
  A mediria "ritmo de criação de leads", uma métrica diferente da que o
  número grande mostra ("quanto está aberto agora"); o risco de o usuário ler
  a seta como "o funil cresceu/encolheu X%" quando na verdade é "entraram X%
  mais leads novos" é alto o suficiente pra não valer a pena.
- **`won_value`**: pouco subjetivo — o precedente de `kpi_deliverables`
  (`stageChangedAt` dentro do mês, cohort = "o que aconteceu neste mês", não
  "o total acumulado") já resolve isso de forma direta; a alternativa
  (manter `sublabel` com `wonCount`) foi descartada porque o sinal de fluxo
  aqui é forte e a comparação já é exatamente análoga a uma que já existe em
  produção.
- **`avg_fit`**: opções eram (A) `trend` do fit médio *dos leads criados
  este mês* vs. mês anterior, ou (B, escolhida) manter `sublabel`. Rejeitado
  A porque criaria uma incoerência de cohort: o valor grande do card é a
  média de **todos** os leads no escopo (qualquer idade), mas o trend em A
  mediria só os leads **novos** deste mês — dois conjuntos diferentes de
  leads sob o mesmo card, o que é mais confuso que informativo (o usuário não
  sabe se a seta se refere ao número que está olhando). `sublabel` atual
  (`${stats.newCount} novos em 48h`) já é o fato secundário certo: fala sobre
  frescor do funil sem fingir ser histórico do próprio número mostrado.

---

## 3. Marketing (`MarketingDashboardView.jsx`) — 7 cards, 0 mudam

Confirmado: os 7 já seguem a regra. Documentando o "porquê" de cada um
(pedido explícito da tarefa — não é só o que muda que precisa de
justificativa):

| Widget | Estado hoje | Por que já está certo |
|---|---|---|
| `kpi_active` (`:592-597`) | `trend={mom.campaigns.d}` | Contagem de registros no escopo com fluxo barato disponível (campanhas criadas este mês vs. anterior) — mesmo recipe agora replicado em `leads_count` (§2.1). |
| `kpi_live` (`:598-604`) | `sublabel` ("em exibição"/"nenhuma ao vivo") | É um medidor de estado *agora* (quantas campanhas estão ao vivo neste instante), não um fluxo — comparar "ao vivo agora" com "ao vivo há 1 mês" não descreve nada útil sobre o card. |
| `kpi_budget` (`:605-610`) | `trend={-mom.expenses.d}` | Fluxo disponível (despesas lançadas este mês vs. anterior). Nota de implementação pro Frontend: o sinal é invertido (`-mom.expenses.d`) porque gasto crescendo é enquadrado como "ruim" pra um orçamento comprometido — mais um motivo pra não copiar esse trend cru pra outro card sem pensar na semântica da seta. |
| `kpi_deliverables` (`:611-616`) | `trend={mom.deliverables.d}` | Fluxo direto (`stage === "entregue"` dentro do mês) — é o modelo copiado pra `won_value` do Comercial (§2.3). |
| `kpi_score` (`:617-623`) | `sublabel` (ótimo/bom/atenção) | Mesmo argumento de cohort do `avg_fit` (§2.5): o valor é a média de **todas** as campanhas pontuadas no escopo; um trend só faria sentido pra "média das campanhas pontuadas este mês", cohort diferente do número mostrado. |
| `kpi_agency_sla` (`:624-629`) | `sublabel` (`${total} entregas`) | SLA é uma razão sobre uma amostra pequena (entregas da agência); fatiar por mês arrisca meses com poucas/nenhuma entrega concluída, produzindo trend ruidoso ou indefinido. O `sublabel` já mostra o tamanho da amostra que sustenta o %, que é a informação que mais importa quando a amostra é pequena. |
| `kpi_agency_leadtime` (`:630-635`) | `sublabel` ("Pendente → Entregue") | Mesmo argumento de amostra pequena do item acima — e aqui o `sublabel` cumpre um papel adicional: diz o que exatamente está sendo medido (di from-to), que nem `trend` nem o rótulo sozinho comunicam. |

Nenhuma linha muda no Marketing além da import de `utils/trend.js` (§1).

---

## 4. RH (`RHOverviewView.jsx`) — 6 cards, 2 mudam pra `trend`, 3 ganham `sublabel`, 1 ganha `sublabel`

Estado hoje: **nenhum dos 6 usa `sublabel` nem `trend`** — só ícone + valor
+ rótulo. É a tela com mais dado parado sem uso: `admissionDate` e
`desligamentoDate` (`use-rh-colaboradores.js:27,39`) dão pra reconstruir
histórico; `voluntariosPct` já é **calculado** (`RHOverviewView.jsx:169`)
pro painel de Zona 3 e simplesmente nunca reaproveitado na Zona 1.

### 4.1 `stat_total` — muda pra `trend`

**Novo cálculo** (inserir depois do bloco de turnover, `RHOverviewView.jsx:172`,
antes de `recentAdmissions`):
```jsx
// MoM — reconstrói o headcount no início do mês corrente a partir de
// admissionDate/desligamentoDate (sem tabela de snapshot histórico) pra
// alimentar o trend de "Total de Funcionários". Só usa fatos pontuais e
// confiáveis (data de admissão, data de desligamento) — não extrapola
// employeeStatus (ferias/afastado) pro passado, ver §4.4.
const [monthStart] = monthBounds(new Date());
const totalAtStartOfMonth = colaboradores.filter((c) => {
  if (!c.admissionDate) return false;
  const adm = parseDateInput(c.admissionDate);
  if (Number.isNaN(adm.getTime()) || adm >= monthStart) return false;
  if (c.employeeStatus === "desligado" && c.desligamentoDate) {
    const deslig = parseDateInput(c.desligamentoDate);
    if (!Number.isNaN(deslig.getTime()) && deslig < monthStart) return false;
  }
  return true;
}).length;

// Zona 1 — desligamentos por mês-calendário (fluxo), separado da janela
// rolante de 12 meses que o card mostra (ver §4.5).
const mom = useMemo(() => {
  const now = new Date();
  const [cs, ce] = monthBounds(now);
  const prev = new Date(now); prev.setMonth(prev.getMonth() - 1);
  const [ps, pe] = monthBounds(prev);
  const ec = colaboradores.filter(c => c.employeeStatus === "desligado" && within(c.desligamentoDate, cs, ce)).length;
  const ep = colaboradores.filter(c => c.employeeStatus === "desligado" && within(c.desligamentoDate, ps, pe)).length;
  return { exits: { v: ec, d: pctChange(ec, ep) } };
}, [colaboradores]);
```
Import novo: `import { monthBounds, within, pctChange } from "../../utils/trend";`
(`RHOverviewView.jsx:17`, junto de `parseDateInput`).

**Hoje** (`RHOverviewView.jsx:299-303`):
```jsx
<StatCard icon={Users} value={totalFuncionarios} label="Total de Funcionários" compact />
```
**Vira**:
```jsx
<StatCard icon={Users} value={totalFuncionarios} label="Total de Funcionários"
  trend={pctChange(totalFuncionarios, totalAtStartOfMonth)} compact />
```

### 4.2 `stat_ativos`, `stat_ferias`, `stat_afastados` — ganham `sublabel` de composição

Mesmo recipe pros 3 (percentual do quadro total) — sistemático de propósito,
não 3 decisões independentes.

**`stat_ativos`**, hoje (`:304-308`):
```jsx
<StatCard icon={UserCheck} value={totalAtivos} label="Ativos" compact />
```
Vira:
```jsx
<StatCard icon={UserCheck} value={totalAtivos} label="Ativos"
  sublabel={totalFuncionarios > 0 ? `${Math.round((totalAtivos / totalFuncionarios) * 100)}% do total` : undefined} compact />
```

**`stat_ferias`**, hoje (`:309-313`):
```jsx
<StatCard icon={Calendar} value={totalFerias} label="De Férias" compact />
```
Vira:
```jsx
<StatCard icon={Calendar} value={totalFerias} label="De Férias"
  sublabel={totalFuncionarios > 0 ? `${Math.round((totalFerias / totalFuncionarios) * 100)}% do total` : undefined} compact />
```

**`stat_afastados`**, hoje (`:314-319`):
```jsx
<StatCard icon={UserMinus} value={totalAfastados} label="Afastados"
  accent={totalAfastados > 0 ? "var(--warning)" : undefined} compact />
```
Vira:
```jsx
<StatCard icon={UserMinus} value={totalAfastados} label="Afastados"
  accent={totalAfastados > 0 ? "var(--warning)" : undefined}
  sublabel={totalFuncionarios > 0 ? `${Math.round((totalAfastados / totalFuncionarios) * 100)}% do total` : undefined} compact />
```
(`accent` continua controlando só a cor do ícone/valor quando há afastados —
`sublabel` é aditivo, não substitui o aviso visual existente.)

### 4.3 `stat_desligamentos` — muda pra `trend`

**Hoje** (`RHOverviewView.jsx:320-324`):
```jsx
<StatCard icon={UserMinus} value={desligados12m.length} label="Desligamentos (12 meses)" compact />
```
**Vira**:
```jsx
<StatCard icon={UserMinus} value={desligados12m.length} label="Desligamentos (12 meses)"
  trend={mom.exits.d} compact />
```
Usa `mom.exits` de §4.1. O valor grande continua sendo a janela rolante de 12
meses (sem mudança); o `trend` compara um recorte diferente — desligamentos
do mês-calendário atual vs. anterior — mesmo padrão de "trend mede um fluxo
que não é exatamente o mesmo cohort do valor grande" já em produção no
`kpi_budget` do Marketing (§3).

### 4.4 `stat_turnover_rate` — ganha `sublabel` reaproveitando `voluntariosPct`

**Hoje** (`RHOverviewView.jsx:325-330`):
```jsx
<StatCard icon={TrendingUp} value={`${turnoverRate}%`} label="Taxa de turnover aproximada"
  accent={turnoverRate >= 20 ? "var(--danger)" : undefined} compact />
```
**Vira**:
```jsx
<StatCard icon={TrendingUp} value={`${turnoverRate}%`} label="Taxa de turnover aproximada"
  accent={turnoverRate >= 20 ? "var(--danger)" : undefined}
  sublabel={desligados12m.length > 0 ? `${voluntariosPct}% voluntário` : undefined} compact />
```
`voluntariosPct` já existe (`RHOverviewView.jsx:169`), calculado pro painel
"Desligamentos por Tipo" de Zona 3 — custo zero de reaproveitar aqui.

### 4.5 Notas de decisão subjetiva — RH

- **Por que `stat_total` pode ter `trend` reconstruído mas `stat_ativos`/
  `stat_ferias`/`stat_afastados` não podem** (é a decisão mais importante
  desta seção, não é só estética): `admissionDate` e `desligamentoDate` são
  fatos pontuais e imutáveis — uma vez que alguém foi admitido ou desligado
  numa data X, isso é verdade pra sempre, então dá pra reconstruir "quantos
  estavam empregados em qualquer data passada" com confiança. Já
  `employeeStatus` (`ferias`/`afastado`/`ativo`) é um estado **atual**, sem
  histórico de quando começou — assumir que quem está de férias hoje também
  estava de férias há 1 mês seria inventar um dado que a tabela não guarda
  (o oposto do que a regra 5 do CLAUDE.md pede: usar o que já é configurável/
  existente, não simular o que não existe). Por isso `stat_total` recebe
  `trend` (fato histórico confiável) e os outros 3 recebem `sublabel` de
  composição-do-instante (`% do total`), que é verdadeiro sem depender de
  histórico nenhum.
- **`stat_desligamentos`**: opções eram (A, escolhida) `trend` no fluxo
  mês-calendário (mesmo padrão do `kpi_budget`), (B) `trend` na própria
  janela rolante de 12 meses comparada com a janela de 12 meses do mês
  anterior, ou (C) nenhum dos dois. B foi descartada porque duas janelas de
  12 meses com 1 mês de defasagem se sobrepõem em 11/12 — a variação
  percentual seria quase sempre próxima de zero e sem sinal útil (ruído, não
  informação). C foi descartada porque o dado de fluxo mensal já está
  disponível e é genuinamente acionável pro RH (um pico de saídas *neste
  mês* é o tipo de coisa que vale a pena notar rápido). A venceu.
- **`stat_turnover_rate`**: opções eram (A, escolhida) `sublabel` com
  `voluntariosPct`, (B) `trend` na própria taxa, ou (C) nenhum dos dois. B
  foi descartada por dois motivos: a taxa já é um percentual, então uma seta
  de "% de variação sobre um percentual" é uma camada de abstração a mais do
  que vale a pena pedir pro usuário decodificar; e o valor usa a mesma janela
  rolante de 12 meses do item acima, com o mesmo problema de baixa
  variação/ruído mês a mês. C foi descartada porque `voluntariosPct` já está
  calculado e é o dado que mais ajuda a interpretar se a taxa é "motivo de
  alarme" (turnover involuntário alto) ou não (a maioria saiu por conta
  própria) — contexto barato, alto valor.

---

## 5. Resultado — a variação passa a ser sistemática, não arbitrária

| Tela | Antes | Depois |
|---|---|---|
| Comercial | 4 `sublabel` / 0 `trend` | 2 `sublabel` (`pipeline_open`, `avg_fit`) / 2 `trend` (`leads_count`, `won_value`) |
| Marketing | 3 `trend` / 4 `sublabel` | inalterado — já seguia a regra |
| RH | 0 / 0 | 4 `sublabel` (`stat_ativos`, `stat_ferias`, `stat_afastados`, `stat_turnover_rate`) / 2 `trend` (`stat_total`, `stat_desligamentos`) |

A regra aplicada é sempre a mesma nas 3 telas: **card de contagem/valor com
fluxo mensal confiável e barato → `trend`; card de composição/estado atual ou
com risco de cohort inconsistente/amostra pequena → `sublabel`; nenhum dos
dois só quando documentado por quê** (não houve nenhum caso desse nesta
rodada — todos os 17 cards das 3 telas acabaram com pelo menos um dos dois).

---

## 6. Checklist pro Frontend

- [ ] Criar `src/utils/trend.js` (§1) com `monthBounds`/`within`/`pctChange`
      — `within` usa `parseDateInput`, não `new Date()` cru.
- [ ] `MarketingDashboardView.jsx`: remover funções locais `:31-46`, importar
      de `utils/trend.js`. Nenhuma outra mudança nesta tela.
- [ ] `DashboardView.jsx`: novo `useMemo` `mom` (§2.1), trocar `sublabel` →
      `trend` em `leads_count` (§2.1) e `won_value` (§2.3). `pipeline_open` e
      `avg_fit` ficam como estão.
- [ ] `RHOverviewView.jsx`: novo cálculo `totalAtStartOfMonth` + `useMemo`
      `mom` (§4.1), `trend` em `stat_total` (§4.1) e `stat_desligamentos`
      (§4.3), `sublabel` em `stat_ativos`/`stat_ferias`/`stat_afastados`
      (§4.2) e `stat_turnover_rate` (§4.4).
- [ ] Rodar `npx vite build` — nenhuma mudança de schema, nenhuma query nova,
      só cálculo client-side sobre dado já carregado.
