# Spec — Chat mobile: filtros, arquivadas, FAB, áudio, notificação (toast)

Mockup aprovado por Daniel (Artifact `63f56291-30f2-4a86-aea9-c2d472fd11aa`,
4 abas). Aprovação foi geral ("ok pro mockup, pode seguir") — implementar
exatamente o que estava nas 4 abas, **incluindo a aba "Arquivadas" que
tinha schema novo sinalizado** (a aprovação do mockup conta como a
confirmação exigida pela regra 5 do CLAUDE.md pra esse schema, mesmo padrão
já usado nesta sessão pra `chat_stickers`). **Não** implementar "Favoritos"
— ficou fora do mockup aprovado, era só uma nota de rodapé.

Não implementar Nível 2 de notificação (push real com app fechado —
VAPID/service worker/Edge Function) — isso foi explicitamente marcado como
projeto à parte, maior, ainda sem aprovação. Implementar só o Nível 1
(toast dentro do app).

Fatos confirmados no código antes desta spec:

- `src/components/views/ChatView.jsx` (976 linhas): `canais`/`diretas`
  já existem como arrays filtrados (linhas 568-569, `c.kind === "canal"/"dm"`).
  Lista renderizada via helper `railGroup` (678-692), chamado em 725-726.
  Botão "Nova conversa" atual: 708-715 (dentro do header 704-716).
  `mobileShowThread` (state 537) alterna sidebar (`hidden`/`flex`, linha
  701) vs. painel de thread (linha 733); volta a `false` no botão de voltar
  (linha 756).
- `use-chat.js`: canais mapeados já têm `kind` (`"canal"`/`"dm"`) e
  `unreadCount` (camelCase, `Number(r.unread_count)`) prontos pra filtro.
- `chat_channel_members` já tem policy de UPDATE na própria linha
  (`chat_members_update_self`, migration `20260812_chat_interno_fase1.sql:146-149`,
  sem restrição de coluna) — uma coluna nova `archived_at` pode ser setada
  pelo próprio usuário via update normal, mesmo caminho que `last_read_at`
  já usa hoje.
- Bucket `chat-attachments` (migration `20260813_chat_attachments_storage.sql`)
  hoje só aceita PDF/Word/Excel/CSV/imagem — precisa de `audio/webm` (e
  `audio/ogg` como fallback de codec) na lista de mime types.

## 1. Filtros (Todas / Não lidas / Canais / Diretas)

Sem schema novo — tudo já vem pronto em `channels`. Novo state
`activeFilter` (`"todas" | "nao-lidas" | "canais" | "diretas"`, default
`"todas"`). Chips renderizados acima da lista (mesmo header onde fica
"Nova conversa"), estilo exato do mockup: `filter-chip` com contagem,
`.active` usa `var(--accent)`/`var(--on-accent)`. Aplica em desktop e
mobile igualmente (só o FAB da seção 3 é mobile-only).

## 2. Arquivadas (schema novo, já confirmado)

**Migration** (`supabase/migrations/`, próxima data depois de `20260814`):
```sql
ALTER TABLE public.chat_channel_members
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
```
Sem mudança de RLS necessária (policy de self-update já cobre). Adicione
`archiveChannel(channelId)`/`unarchiveChannel(channelId)` em `use-chat.js`
(update simples em `chat_channel_members` setando/limpando `archived_at`
pra `user_id = auth.uid() AND channel_id = channelId`).

**Onde arquivar/desarquivar**: não existe gesto de swipe em nenhum lugar da
plataforma hoje — não inventar um. Adicione um botão de ícone (arquivo/
caixa) no header da thread (ao lado do botão de voltar, `mobileShowThread`),
alternando "Arquivar conversa" / "Desarquivar conversa" conforme
`archived_at` do canal aberto.

**Lista**: linha "Arquivadas" (ícone + label + contador) logo abaixo dos
chips de filtro, só aparece se houver ≥1 canal arquivado pro usuário.
Clicar abre uma sub-lista (reaproveite o mesmo componente de lista, só
trocando o array fonte pros canais com `archived_at` não nulo) com um
botão de voltar pra lista normal. Canais arquivados somem da lista
principal (incluindo dos filtros da seção 1) enquanto `archived_at` não
for nulo.

## 3. Botão flutuante "Nova conversa" (mobile)

Abaixo do breakpoint `lg` (1024px, mesmo usado por `MobileBottomNav`),
troque o botão de header atual (704-716) por um FAB fixo (`position:
fixed`, canto inferior direito, mesmo `--accent`/`--on-accent`, ~52px,
`box-shadow` do token `--shadow-pop`) — só visível quando a sidebar/lista
está sendo mostrada (`!mobileShowThread`), pra não sobrepor a thread aberta
nem a `MobileBottomNav`. Desktop mantém o botão de header sem mudança
nenhuma. Abre o mesmo `NewConversationModal` de sempre.

## 4. Mensagem de áudio

Reaproveita 100% o pipeline de anexo já existente (`use-chat-attachments.js`,
bucket `chat-attachments`, jsonb `attachments` de `chat_messages`) — não é
tabela nova, só um `type: "audio"` no objeto de attachment (mesmo formato
que `type: "sticker"` já usa pra distinguir renderização).

- Ícone de microfone substitui o botão de enviar quando o texto está vazio
  e não há anexo pendente; vira o "➤" de sempre assim que há texto ou
  anexo.
- Gravação via `MediaRecorder` (`getUserMedia({ audio: true })`). Segurar
  (mousedown/touchstart) inicia; soltar (mouseup/touchend) para e envia;
  arrastar a mais de ~60px pra esquerda antes de soltar cancela sem enviar
  (mesmo gesto do mockup).
- Indicador visual durante a gravação: bolinha vermelha + timer (mm:ss) —
  pode usar um `AnalyserNode` (Web Audio API) pra uma visualização simples
  de amplitude ao vivo se for direto, mas não é obrigatório ficar
  pixel-perfect com o mockup — uma barra de progresso/pulso já comunica
  "gravando". Não gaste tempo tentando replicar uma forma de onda real
  no mockup, que era ilustrativa.
- No envio: upload do blob (`audio/webm`) pro bucket via o mesmo
  `uploadAttachment` já existente, mensagem carrega
  `attachments: [{ type: "audio", path, durationSeconds }]`.
- Renderização na bolha: player com botão de play/pause (`<audio>` nativo
  escondido, controlado por esse botão) + duração. Não precisa desenhar
  forma de onda real na reprodução — barra decorativa estática já é
  suficiente, o essencial é o play funcionar.
- **Ajuste de bucket**: adicione `audio/webm` (e `audio/ogg` de fallback)
  em `allowed_mime_types` do bucket `chat-attachments` via migration (não
  precisa criar bucket novo, só ampliar a lista já existente).

## 5. Notificação — Nível 1 (toast dentro do app)

Quando uma mensagem nova chega num canal que **não** é o `selectedId`
atualmente aberto (e o usuário não está na tela de Chat), mostrar um
`AppToast` com avatar/inicial do remetente + nome do canal + preview da
mensagem (trunca), que ao ser clicado navega pro Chat com aquele canal
selecionado. Investigue o mecanismo de Realtime já usado por `use-chat.js`
pra manter a lista de canais atualizada (deve haver uma subscription que já
reage a mensagem nova pra atualizar `unreadCount`/preview) — o toast deve
disparar a partir do MESMO evento, não criar uma segunda subscription
paralela. Sem som, sem permissão de navegador — é só o `AppToast` já usado
em outros lugares da plataforma.

## 6. Fora de escopo — não implementar

- Favoritos/pinned (ficou fora do mockup aprovado).
- Push com app fechado (Nível 2 — projeto à parte).
- Gesto de swipe em qualquer lugar (não é padrão da plataforma).
- Forma de onda real (gravação ou reprodução) — visual decorativo simples
  já basta.
