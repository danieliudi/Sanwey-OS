# Checklist padrão de evento — Campanhas → Tarefas

Aprovado pelo Daniel via mockup (`https://claude.ai/code/artifact/e5f64395-4088-41a8-8069-437c821a991a`,
seção 3) e 2 decisões via `AskUserQuestion`: (1) 1 card por segmento, sem responsável por item — a
responsável do evento delega manualmente depois; (2) botão dentro da campanha, nunca automático.

Investigação prévia confirmou: não existe conceito de "tipo de campanha"/"template" hoje ("Evento" é só um
valor de `channel`), não existe automação que crie `marketing_tasks` em lote, e não existe conceito de
"segmento" no código — tudo isso é construído nesta rodada, sem precisar de mudança de schema (reaproveita
`marketing_tasks` + `rh_checklists`, ambos já aceitando o domínio `marketing_tasks` desde a migration
`20260782_marketing_tasks_purchase_generic_domains.sql`).

## 1. Template — novo arquivo `src/constants/event-checklist-template.js`

Transcrição da planilha real do Daniel, agrupada em 5 segmentos (confirmados pelo mockup aprovado):

```js
export const EVENT_CHECKLIST_TEMPLATE = [
  {
    segment: "Documentação e Acessos",
    items: [
      "Verificar Contrato",
      "Localização do Stand",
      "Requisitos do Manual do Expositor",
      "Crachá",
      "Credencial convidado VIP",
      "Segurança",
      "Coletor de dados",
      "Energia Elétrica",
      "Autorização da montadora",
      "Funcionamento feira virtual e presencial",
      "Acessar material de divulgação da Organizadora",
      "e-commerce",
    ],
  },
  {
    segment: "Preparação e Divulgação",
    items: [
      "Verificar o projeto Stand",
      "Banner do stand",
      "Vídeo arquivo Pen Drive",
      "Limpeza",
      "Schedule pessoal e comercial",
      "Schedule pessoal de outros departamentos",
      "Orientar os colaboradores",
      "Mailing de divulgação da feira",
      "Convidar cliente e prospects",
      "Estacionamento",
      "Cartão de visitas",
      "Contratação Seguro",
    ],
  },
  {
    segment: "Montagem e Amostras",
    items: [
      "Acompanhamento montagem",
      "Acompanhamento desmontagem",
      "Providenciar as amostras",
      "Verificar modelo para exposição",
      "Fabricação da amostra",
      "Montagem da amostra no stand",
    ],
  },
  {
    segment: "Materiais e Logística",
    items: [
      "Verificar estoque de material impresso",
      "Análise e definição dos vídeos a serem utilizados na feira",
      "Verificar estoque de brindes",
      "Sacola Sanwey",
      "Copos descartáveis, saco de lixo e material para limpeza",
      "Separar kit escritório",
      "Alimentos",
      "Bebidas",
      "Máquina de chopp",
      "Máquina de café",
      "Extintor de incêndio",
      "Emissão de nota fiscal",
      "Transporte para levar material para feira",
      "Levar o material e organizar o stand",
      "Revisar folders",
    ],
  },
  {
    segment: "Pós-evento",
    items: [
      "Dados do coletor de dados",
      "Coleta de dados com a equipe",
      "Relatório",
    ],
  },
];
```

48 itens no total, em 5 cards. Constante hardcoded (mesmo padrão de `PURCHASE_STAGES` — regra 2 do
CLAUDE.md documenta esse precedente) porque não foi pedido um editor de template configurável; se o Daniel
quiser editar o template depois, é código, não UI — registrar isso como decisão explícita, não esconder.

## 2. Gatilho — botão no drawer da campanha, só quando `channel === "Evento"`

`src/components/campaign/CampaignDetailDrawer.jsx` — na aba "Form" (`center`, onde já ficam
canal/orçamento/KPI etc.), logo abaixo do campo de canal (por volta da linha 1263, ver o `EditSelect` de
`channel`):

```jsx
{get("channel") === "Evento" && (
  <ApplyEventChecklistButton campaign={campaign} currentUser={currentUser} />
)}
```

Novo componente `ApplyEventChecklistButton` (pode viver no mesmo arquivo, perto do rodapé, junto de outros
componentes auxiliares já locais como `CampaignAIPanel`):

```jsx
function ApplyEventChecklistButton({ campaign, currentUser }) {
  const { createTask } = useMarketingTasks({ userId: currentUser?.id, roles: currentUser?.roles });
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);

  const handleApply = async () => {
    if (applying || done) return;
    setApplying(true);
    try {
      for (const { segment, items } of EVENT_CHECKLIST_TEMPLATE) {
        const task = await createTask({
          companyIds:   campaign.companyIds,
          campaignId:   campaign.id,
          title:        segment,
          assigneeIds:  campaign.ownerIds || [],
          priority:     "media",
        });
        // seed do checklist — insert direto com os itens já prontos, não
        // via addItem() um a um (a UI incremental do RHChecklistsPanel é
        // pra edição interativa, não pra semear N itens de uma vez).
        await supabase.from("rh_checklists").insert({
          domain: "marketing_tasks",
          record_id: task.id,
          title: "Checklist do segmento",
          items: items.map(text => ({ id: crypto.randomUUID(), text, done: false })),
          created_by: currentUser?.id || null,
        });
      }
      setDone(true);
    } finally {
      setApplying(false);
    }
  };

  return (
    <button onClick={handleApply} disabled={applying || done} /* estilo: mesmo btn-primary já usado no drawer */>
      {done ? "✓ Checklist aplicado" : applying ? "Aplicando…" : "☑ Aplicar checklist de evento"}
    </button>
  );
}
```

Import novo no topo do arquivo: `EVENT_CHECKLIST_TEMPLATE` de
`../../constants/event-checklist-template`, `supabase` de `../../lib/supabase` (conferir se já não está
importado — vários outros drawers já usam `supabase` direto pra ações pontuais fora do hook padrão).

### 2.1 Idempotência — não deixar duplicar

`done` (estado local) só protege a sessão atual do drawer aberto — se o usuário fechar e reabrir o drawer, o
botão volta a aparecer como se nunca tivesse sido aplicado. Antes de aplicar, checar se já existem tarefas
dessa campanha com `title` batendo em algum dos 5 nomes de segmento (`tasksForThisCampaign.some(t =>
EVENT_CHECKLIST_TEMPLATE.some(seg => seg.segment === t.title))`) — se já existir pelo menos 1, trocar o botão
por um texto informativo ("Checklist de evento já aplicado — veja em Tarefas") em vez de permitir aplicar de
novo e duplicar os 5 cards. `useMarketingTasks({ campaignId: campaign.id })` já suporta filtrar por
campanha (parâmetro existente no hook, `use-marketing-tasks.js:64`) — usar esse filtro pra buscar as tasks
já existentes antes de decidir o que mostrar.

## 3. Resultado em Tarefas — nada de código novo além do que já existe

Os 5 cards criados aparecem no board de Tarefas normalmente (já filtrável por campanha, já qualificam pra
"Minhas Tarefas" da responsável, já abrem no modal padronizado com a aba Checklist — rodada anterior). Não é
necessário nenhuma mudança em `MarketingTarefasView.jsx` nem em `MarketingTaskDetailDrawer.jsx` — o
mecanismo generico já dá conta.

## 4. Fora de escopo

- Editor de template pela UI (trocar itens/segmentos sem mexer em código) — não foi pedido; se quiser depois,
  vira uma tabela configurável (esquema novo, precisa aprovação separada).
- Responsável por item dentro do checklist — decisão explícita do Daniel: não existe, a responsável do
  evento delega manualmente depois de criado.
- Qualquer automação/gatilho automático (ex: criar sozinho ao salvar canal="Evento") — decisão explícita:
  sempre manual, via botão.
- Editar/reordenar os 5 segmentos depois de aplicado (ex: mesclar 2 segmentos) — os cards viram tarefas
  normais depois de criados, editáveis como qualquer outra tarefa, sem tratamento especial.

## 5. Verificação

1. `npx vite build` limpo.
2. Criar uma campanha com canal "Evento", abrir o drawer, confirmar que o botão aparece só nesse canal (não
   aparece em campanhas de outro canal).
3. Clicar "Aplicar checklist de evento" — confirmar que nascem exatamente 5 cards em Tarefas, cada um com o
   nome do segmento como título, atribuídos aos `ownerIds` da campanha, vinculados via `campaignId`.
4. Abrir um dos cards criados, conferir a aba Checklist — os itens do segmento aparecem certos, na ordem da
   planilha, todos desmarcados.
5. Fechar e reabrir o drawer da campanha — o botão não deve permitir aplicar de novo (idempotência, seção
   2.1).
6. Nenhuma classe de bug conhecida reintroduzida (duplicação, campo sem validação antes de interação).
