# Ideias futuras — avaliadas, não descartadas

Coisas que o Daniel trouxe, que foram estudadas com números reais, e cuja
conclusão foi **"boa ideia, momento errado"**. Não são backlog: nada aqui está
aprovado nem priorizado. O objetivo é que quando o assunto voltar, ninguém
refaça a análise do zero — e principalmente que ninguém confunda "não agora"
com "não".

Cada item registra: o que existe hoje, o que de fato falta, o **número que
travou a decisão**, e o **gatilho** que deveria fazer a gente reabrir.

---

## 1. "Live coach" — sugestões ao vivo durante a ligação

**Data:** 28/08/2026. Referência: um anúncio (viverdeia.ai) mostrando um painel
flutuante no canto da tela do PC que, durante a call, sugere como contornar
objeções e qual o próximo passo — alimentado pelo conhecimento da equipe e pelo
registro do que deu certo.

### O que já existe e serve

Mais do que parece. A camada de captura e de IA está pronta:

- `supabase/functions/crm-ata-voz` e `caso-prospeccao-voz` — áudio → Whisper →
  JSON estruturado. Ambas em produção, com cota da chave da empresa.
- `supabase/functions/ai-assistant` — provedor, chave pessoal com queda pra
  chave da empresa, cota diária, trilha de auditoria.
- `sales_cases` (`src/hooks/use-sales-cases.js`) — situação, objeção principal,
  concorrente, lição, categoria da lição. **É exatamente o "o que deu certo e o
  que não deu" que o coach precisaria consultar.**
- Skills `sanwey-objecoes-comerciais` (playbook + política comercial ao vivo) e
  `preparar-visita`.
- Alerta de menção a concorrente, já implementado no Funil.

### O que falta, e é caro

**A janela flutuante não é web.** Navegador não sobrepõe outros aplicativos.
Exigiria app de desktop (Electron/Tauri): instalador, canal de atualização,
suporte por máquina. E se a ligação for por celular ou WhatsApp — como boa
parte da venda industrial acontece — não existe caminho de captura nenhum. O
overlay é a parte mais vistosa da ideia e a de pior custo-benefício.

**O custo passa a ser por minuto, não por chamada.** Hoje a IA da empresa é
cotada em 50 chamadas/dia por pessoa (`AI_ORG_DAILY_LIMIT`). Um coach ao vivo
consome transcrição contínua + LLM repetido durante toda a ligação. Além disso,
o Whisper em lote que a plataforma usa hoje não serve: precisaria de STT em
streaming (OpenAI Realtime, Deepgram ou equivalente), que é outra integração e
outro contrato de custo.

**LGPD.** Transcrever e armazenar a fala do outro lado precisa de base legal e
de aviso. É resolvível, mas é decisão de produto, não detalhe de implementação.

### O número que travou

```
sales_cases em produção (28/08/2026): 0 registros
```

A base de conhecimento que alimentaria o coach está **vazia**. A captura de
caso de prospecção por voz foi construída, deployada, e nunca foi usada. Um
coach sem casos acumulados só produz conselho genérico de vendas — e o risco
real não é ele ser inútil, é ser **queimado**: o vendedor testa duas vezes, vê
platitude, e não abre nunca mais. Relançar depois é muito mais difícil que
lançar.

Contexto de escala na mesma data: 11 pessoas em vendas, 15 usuários no total,
28 leads. O ROI de um coach ao vivo é bem diferente a 11 vendedores e a 200.

### O caminho barato, se o assunto voltar

Fazer o coach **antes** da ligação, não durante — mesmo conteúdo, momento em
que a pessoa consegue ler. Um painel que abre antes da call com a última ata
daquele cliente, a objeção que ele já levantou, o que funcionou em cliente
parecido, e a margem de referência. Zero infraestrutura nova: é composição do
que já existe (`preparar-visita`, `sales_cases`, `get_client_timeline`).

E, em paralelo, fazer o `caso-prospeccao-voz` ser efetivamente usado — sem isso
nenhuma versão da ideia tem do que se alimentar.

### Gatilho pra reabrir

`sales_cases` passar de ~50 registros reais com lição preenchida. Antes disso a
discussão é sobre a embalagem, não sobre o produto.

---

## 2. Marketplace de features / módulos liga-desliga

**Data:** 28/08/2026. Mesma referência: a empresa do anúncio oferece várias
ferramentas que o cliente instala ou não, liga ou não.

### Já existe — e é mais completo do que parece

Isto foi a surpresa da análise. Há **duas camadas independentes**, combinadas
por E (nunca por OU):

- `module_states` (Configurações → Módulos, `src/hooks/use-module-states.js`,
  painel em `src/components/settings/ModuleStatesPanel.jsx`) — liga/desliga a
  página pra empresa inteira.
- `use-module-overrides.js` — "Acesso por módulo", por pessoa.
- As duas se cruzam em `src/utils/module-access.js` (`gateByModuleStates`) e
  têm espelho no banco, em `current_user_has_module()`.
- Mais `EXECUTIVE_WIDGETS` (`src/constants/user-settings.js`) — visibilidade de
  widget do Painel Executivo por usuário — e `personalTasksEnabled`.

### O número que travou

```
module_states em produção (28/08/2026): 2 linhas configuradas
```

O motor está construído e praticamente parado. Então a pergunta não é "vale a
pena um marketplace?", é **"por que o que já existe não é usado?"** — e a
resposta mais provável é que ninguém sabe que existe, não que falte capacidade.

### Por que NÃO construir o marketplace

Marketplace é mecanismo de distribuição pra quando há **desenvolvedores
terceiros** ou **muitos clientes diferentes**. A plataforma tem 15 usuários,
numa empresa com 3 frentes. É solução pra um problema que não existe aqui.

E o custo real de multiplicar toggles: cada liga/desliga independente dobra a
matriz de configurações possíveis (10 toggles = 1.024 combinações), num
repositório onde o teste é manual. Isto conecta direto com o gate de
consistência criado no mesmo dia: multiplicar configuração sem multiplicar
verificação é comprar dívida com juros. Ver também a regra 4 do `CLAUDE.md` —
não construir abstração genérica especulativa.

### O caminho barato, se o assunto voltar

Uma **vitrine**: uma tela que lista os módulos disponíveis, explica o que cada
um faz, e deixa ligar. É problema de descoberta, não de arquitetura, e é barato
porque o motor já está pronto. Provavelmente resolve a maior parte do que
atraiu na ideia original.

### Gatilho pra reabrir

Um segundo cliente/tenant de fora do Grupo, ou alguém de fora escrevendo módulo
pra plataforma. Enquanto for uma empresa só, vitrine basta.

---

## Como usar este arquivo

Ao reabrir qualquer item: **confira o número que travou antes de discutir
qualquer outra coisa.** Se ele não mudou, a conclusão continua valendo e a
conversa é curta. Se mudou, aí sim vale reabrir a análise — e o resto do texto
serve de ponto de partida, não de resposta pronta.

Qualquer um dos dois, se for pra frente, é mudança visual/estrutural: exige
mockup aprovado antes de código (`CLAUDE.md`, regra 3).
