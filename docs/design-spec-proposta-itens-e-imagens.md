# Spec · Itens da proposta (CPQ multi-modelo) e imagens do Pitch

15/09/2026. Fecha os dois buracos que sobraram do gerador de proposta de RFP
(`src/components/lead/PropostaPanel.jsx`, entregue no mesmo dia). Nenhum dos
dois precisa de migration: a tabela, o gatilho, as policies e os tipos MIME do
bucket já existem em produção — é código que faltou, não schema.

---

## A · Itens da proposta — tabela multi-modelo

### Problema, com arquivo:linha

`PropostaPanel.jsx` oferece **um** par quantidade/preço, via os campos `qtd` e
`preco` de `CAMPOS_RFP` (`src/utils/proposta-rfp.js:31-32`). Uma RFP real de
big bag cota mais de um modelo — foi por isso que a aba anterior
(`ProposalPanel.jsx`, deletada) tinha tabela.

O que ficou órfão quando ela saiu:

| Peça | Onde | Estado |
|---|---|---|
| `proposal_line_items` | baseline:1248, trigger `trg_proposal_line_items_sync_total` (baseline:7008), 2 policies (baseline:8056/8064) | em produção, **zero escritores** |
| `SANBAG_MODELS` (15 modelos) | `src/data/sanbag-models.js` | **zero chamadores** |
| `proposalPrompt(lead, orderHistory, lineItems)` | `src/constants/ai-prompts.js:254` | 3º argumento **nunca passado** |
| `persist({ items })` | `src/hooks/use-proposals.js:124` | caminho vivo, chamado só com `undefined` |

### Comportamento

1. Card **"Itens da proposta"** entre "Dados desta RFP" e "Matriz de
   conformidade". Cada linha: modelo (`input` + `<datalist>` de
   `SANBAG_MODELS`), quantidade, preço unitário (`CurrencyInput`), nota de
   certificação.
2. Modelo com `certificationHint` preenche a nota **só se estiver vazia** —
   nunca sobrescreve o que o vendedor escreveu.
3. A **primeira linha é semeada** de `produto`/`qtd`/`preco` da Classe 2, que
   vieram do negócio. Ninguém redigita o que o funil já sabe.
4. Havendo ao menos uma linha preenchida, `qtd` e `preco` **somem** da Classe 2
   e saem de `faltamRfp`; no lugar, linha sem modelo/quantidade/preço conta
   como pendência. **Sem linha nenhuma, nada muda** — as versões já geradas
   continuam abrindo igual.
5. Soma na tela rotulada **"Soma das linhas"** (regra 14: origem declarada).
   O total **gravado** continua vindo do gatilho (`proposals.total_value`),
   exibido como "Total da v{n} · calculado no banco"; divergiu da soma atual,
   a tela diz que há edição ainda não gerada. Duas contas, dois rótulos — o
   cliente nunca grava total.
6. Os dois documentos imprimem a tabela quando houver linhas; senão, as linhas
   únicas de hoje.

### Tokens

Nenhum novo. `--text-dim`, `--text-faint`, `--border`, `--surface-alt`,
`--warning`/`--warning-bg`, `--success`/`--success-bg` — todos já no arquivo.

---

## B · Imagens do Pitch a partir da Biblioteca de Documentos

### Problema

`DocPitch` (`PropostaPanel.jsx`) não tem imagem nenhuma. O gerador em HTML que
o Daniel montou (`resibag_gerador-proposta-rfp_v5.html`) levava ~1,3 MB de
base64 embutido — cada cópia do arquivo carregando as próprias imagens, que é
a mesma doença da tagline descontinuada que sobreviveu lá dentro. O mockup
aprovado trocou isso pela Biblioteca de Documentos.

### Comportamento

1. Card **"Imagens do Pitch"**. Lista os documentos de `useDocumentLibrary()`
   com `mime_type` começando em `image/` e escopo compatível com a frente do
   negócio (`company_ids` vazio = todas as frentes). Seleção múltipla, **até 4**.
2. URL assinada por `getSignedUrl` (1 h, bucket privado). **O snapshot guarda
   `{id, title, file_path}` — nunca a URL assinada.** Ela expira em uma hora e
   o snapshot é permanente: guardar a URL faria a v1 abrir quebrada amanhã.
3. As imagens entram no `DocPitch` como faixa logo abaixo do hero, com a
   legenda = título do documento.
4. `printarDoc` **espera as imagens do documento alvo carregarem** antes de
   `window.print()` (`img.complete`, senão `load`/`error` com teto de 4 s).
   Sem isso o papel sai com moldura vazia, e nenhum dos gates da regra 3.2
   exercita `@media print`.

### Fora de escopo, de propósito

Recorte, ordenação por arrastar e upload direto daqui. Imagem entra pela
Biblioteca, que é onde ela já é versionada e tem escopo por frente.

---

## Verificação (regra 15)

Captura de tela na largura real dos dois documentos **com conteúdo**, não só a
prova de isolamento de impressão que a entrega anterior deixou registrada.

---

## Revisão de 15/09/2026 — o que os dois revisores acharam

QA e Segurança rodaram em paralelo e **acharam o mesmo bloqueante de forma
independente**, o que é o sinal de que ele era real e não opinião.

| # | Grau | O que era | Estado |
|---|---|---|---|
| 1 | ALTO | Linha começada e não terminada mandava **string vazia** pra coluna `numeric NOT NULL` (`''::numeric` = erro 22P02). O throw acontecia DEPOIS de a versão já existir: sobrava uma v{n} com snapshot de itens, zero itens e total zero — uma a cada clique em "Gerar". Regressão de uma guarda que a aba anterior tinha. | corrigido: coerção no `use-proposals.js`, zero é o valor de pendência |
| 2 | MÉDIO | Card "Estado da peça" não listava item incompleto: chip dizia "Sai como rascunho" e a linha de motivos terminava num `" · "` solto | corrigido |
| 3 | MÉDIO | `loading` da Biblioteca descartado — a tela afirmava "nenhuma imagem, suba lá" enquanto carregava | corrigido |
| 4 | MÉDIO | Imagem cuja assinatura falhou sumia do papel em silêncio, com a caixa ainda marcada | corrigido: aviso no card + etiqueta "NÃO ABRIU" na linha |
| 5 | MÉDIO | "Total da v1 · calculado no banco: **R$ 0,00**" em versão gerada antes de itens existirem (`total_value` é `DEFAULT 0`) — o rótulo que dá autoridade ao número dizendo que a proposta valia zero | corrigido: só aparece se a versão tiver linha |
| 6 | BAIXO | Ficha técnica dizia "Produto ofertado" no singular enquanto o Pitch do mesmo dia dizia "3 modelos cotados" | corrigido: sai do Sumário quando há itens |
| 7 | BAIXO | Ramo morto "`company_ids` vazio = todas as frentes" — estado inalcançável que, inserido por SQL, viraria o único documento a aparecer em TODA frente | removido |
| 8 | BAIXO | `DELETE` de itens sem checagem de zero-linha | documentado: num DELETE, zero linha é o caso normal — a checagem quebraria o caminho feliz; quem cobre é a policy, que usa o mesmo predicado em `USING` e `WITH CHECK` |
| 9 | BAIXO | `qa:proposta` só renderizava o caminho COM itens | corrigido: 4 folhas, as duas últimas sem item nenhum |

### Aberto — precisa de decisão do Daniel, não de código

**Imagem pode atravessar frentes, para 4 usuários.** A RLS de
`document_library` escopa por empresa do **usuário**, não do **negócio**: para
1 admin e 3 vendedores/gerentes de mais de uma frente, ela entrega Resibag e
Sanwey, e o único controle que alinha a imagem à frente do lead é o filtro no
cliente. Não é vazamento de acesso (essas pessoas já podem ler os dois
documentos) — é **mistura de marca num PDF que vai ao cliente final**.

A tabela-irmã mais próxima, `lead_document_refs`, tem exatamente a mesma
lacuna, então este caminho espelha o precedente em vez de inventar modelo
próprio. Amarrar no servidor exige trocar o jsonb do snapshot por tabela
filha sob RLS com `WITH CHECK` comparando a frente do documento com a do
lead — **migration nova, logo confirmação explícita do Daniel** (regra 5).
Registrado aqui e no comentário do próprio código; nada foi aplicado.
