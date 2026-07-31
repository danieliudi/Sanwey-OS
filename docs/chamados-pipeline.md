# Piloto: chamados → triagem → correção (GitHub Issues)

Decidido com o Daniel em 31/07/2026 — primeiro passo de uma "mini agência"
de correção que deve cobrir a sanwey-crm e, depois, outros projetos dele.
Este documento é a referência de como o mecanismo funciona; ajustar aqui
sempre que o comportamento mudar.

## Por que GitHub Issues, não um Kanban novo dentro do app

O pedido original era um Kanban de "ordem de serviço". Optamos por **GitHub
Issues** (com label como coluna) em vez de construir uma tela nova porque:

- É multi-projeto de graça — não fica preso ao sanwey-crm.
- Zero UI nova pra manter.
- Já dá pra abrir chamado achando um bug ("New issue" → template "Chamado"),
  sem precisar logar em nada além do GitHub.

Se no futuro fizer sentido um Project (v2) com board visual arrastável, dá
pra criar em cima disso sem mudar nada do que já existe — é só configuração
adicional no GitHub, os labels abaixo continuam sendo a fonte da verdade.

## Ciclo de vida de um chamado (labels = colunas)

Toda issue de chamado carrega o label `chamado` (aplicado pelo template).
O restante do ciclo é outro label, sempre no formato `status:<etapa>`:

1. **(sem label de status)** — chamado recém-aberto, ainda não triado.
2. `status:em-correcao` — o agente já pegou, está investigando/corrigindo.
3. `status:aguardando-aprovacao` — PR aberto, esperando o Daniel revisar e
   mergear. **Nunca mergeia sozinho** (decisão explícita do piloto).
4. `status:resolvido` — PR mergeado, issue fechada.
5. `status:escalado` — o agente não seguiu sozinho; comentário na issue
   explica por quê. Fica esperando o Daniel decidir.

Severidade (`severidade:critico` / `severidade:importante` / `severidade:menor`)
vem do que a pessoa marcou no formulário — o agente pode reclassificar se a
investigação mostrar outra coisa, mas registra por quê no comentário.

## Quando o agente segue sozinho vs. escala

**Segue sozinho** (mesma régua já usada nas correções desta sessão): causa
raiz identificável, é claramente bug fix (algo que já deveria funcionar e
não funciona), build fecha limpo depois do fix, não mexe em autenticação/
pagamento/schema de banco/dado sensível.

**Escala pra `status:escalado`** sempre que:
- Não conseguir reproduzir ou entender a causa raiz com confiança.
- A correção implica decisão de produto/design (mudança visual/estrutural —
  mesma régua da regra 3 do `CLAUDE.md`), não só bug fix.
- Toca autenticação, pagamento, RLS/schema de banco, ou qualquer dado sensível.
- O build quebra depois da tentativa de correção.

Em qualquer um desses casos, o agente comenta na issue explicando o motivo
e o que já investigou — não desiste em silêncio.

## Autonomia (nível atual do piloto)

**Só abre PR — o Daniel aprova e mergeia tudo.** Nenhum merge automático
nesta fase. Se depois de um tempo o histórico mostrar acerto consistente
numa categoria de bug (ex.: os mesmos padrões corrigidos nesta sessão —
campo obrigatório não travando, exclusão não persistindo, etc.), dá pra
subir o nível de autonomia pra essa categoria especificamente — não é
tudo-ou-nada.

## Como o agente é acionado

Rotina do Claude Code Remote (`claude mcp` / `/routines`), sessão nova a
cada disparo (não fica presa a uma conversa). Nesta fase o disparo é
**manual** (o Daniel pede pra rodar, ou eu rodo quando ele confirmar) — sem
agendamento automático ainda, até o padrão se provar. Virar cron (ex.:
1x/hora) é só uma linha de configuração depois.

## Extensão futura (fora do escopo deste piloto)

- Intake por WhatsApp (secretária agêntica cria a issue via API, em vez do
  Daniel abrir no GitHub direto) — decidido explicitamente adiar até o
  piloto validar o resto do fluxo.
- Registrar outros repositórios/projetos no mesmo mecanismo — mesma lógica,
  só aponta pra outro repo.
- Métrica de acerto (PR aceito vs. revertido, taxa de escalonamento) pra
  decidir quando subir o nível de autonomia.
