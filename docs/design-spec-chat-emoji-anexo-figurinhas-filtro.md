# Spec — Chat interno: emoji, anexo, figurinhas, filtro de linguagem

Decisões de produto já fechadas com o Daniel (mockup aprovado) — esta spec só
formaliza o detalhe técnico/visual em cima delas, não reabre nenhuma. Onde
sobrou uma decisão genuinamente subjetiva não coberta pelo mockup original,
está isolada na seção (e), sinalizada como proposta aguardando aprovação.

Arquivos de referência lidos para esta spec:
- `src/components/views/ChatView.jsx` (composer: linhas 483-513; `handleSend`/`handleKeyDown`: 324-344)
- `src/hooks/use-chat.js` (`sendMessage`: 116-126; `MESSAGE_SELECT`: linha 7)
- `supabase/migrations/20260812_chat_interno_fase1.sql` (schema + RLS do chat, `chat_is_manager`: linha 58)
- `src/hooks/use-lead-attachments.js` (padrão de upload/Storage)
- `src/components/lead/LeadDetailDrawer.jsx` (`FileIcon`/`formatBytes`/`AttachmentsPanel`: linhas 1756-1930 — referência de card de arquivo)
- `src/components/shared/MoveStageMenu.jsx` (padrão de popover via portal — referência de posicionamento)
- `src/components/ui/Modal.jsx`, `src/components/shared/AppToast.jsx`
- `src/components/views/SettingsView.jsx` (`Section`/`ToggleRow`: linhas 22-89 — referência do painel de Configurações)
- `src/components/views/FornecedoresView.jsx` (`ConfirmDeleteModal`: linhas 130-146 — padrão de exclusão, CLAUDE.md regra 1)
- `src/index.css` (tokens: `--radius-sm` 6px, `--radius-md` 8px, `--radius-lg` 12px, `--danger`/`--danger-bg`, `--warning`/`--warning-bg`, `--shadow-pop`, `--overlay-scrim`, `--accent-tint`)
- Convenção de upload já em uso (10 MB, extensões): `src/components/shared/DocumentCaptureModal.jsx:6`, `src/components/public/TalentPoolForm.jsx:10`, `src/components/public/JobApplicationForm.jsx:8`, `src/components/views/NovoColaboradorModal.jsx:19`
- `supabase/migrations/20260714_profiles_multi_role_foundation.sql:102` (`current_user_is_manager()` — mais restrito que `chat_is_manager`, por isso não é o usado aqui)

---

## a) `src/constants/chat-emojis.js`

Arquivo de constante pura (mesmo padrão de `src/constants/client-categories.js`),
sem cor por item — o glifo do emoji já é o próprio "swatch" visual, não precisa
de token de cor.

```js
// Paleta curada do Chat interno — fixa, sem seletor de emoji "do sistema"
// (nenhum picker genérico tipo emoji-mart). 32 emojis em 4 categorias,
// decidido com o Daniel em 01/08/2026 — a lista é fechada, não editável
// pelo usuário final. Mudança de conteúdo desta lista é decisão de produto,
// não implementação livre.

export const CHAT_EMOJI_CATEGORIES = [
  {
    id: "reacoes",
    label: "Reações rápidas",
    emojis: ["👍", "👏", "🙏", "❤️", "😂", "😍", "😮", "🎉"],
  },
  {
    id: "trabalho",
    label: "Trabalho/status",
    emojis: ["✅", "❌", "⚠️", "🚀", "📅", "📎", "💰", "📈"],
  },
  {
    id: "pessoas",
    label: "Pessoas/presença",
    emojis: ["☕", "🏭", "🤝", "👋", "🥳", "💪", "🙌", "✋"],
  },
  {
    id: "simbolos",
    label: "Símbolos",
    emojis: ["🔥", "⭐", "💡", "🔔", "💯", "📌", "🕐", "✍️"],
  },
];

// Flat, pra validação/teste (deve ter 32 itens, sem duplicata).
export const CHAT_EMOJIS_FLAT = CHAT_EMOJI_CATEGORIES.flatMap(c => c.emojis);
```

Nenhum campo `value`/`color` como em `CLIENT_CATEGORIES` — o array de emojis
já é o dado final consumido pelo grid (não precisa de label individual por
emoji, só por categoria).

---

## b) Composer — popover de emoji, popover/grid de figurinhas, preview strip de anexo

### Estrutura geral do composer (`ChatView.jsx:483-513`)

O bloco atual é:
```
<div className="flex items-end gap-2">
  <textarea .../>
  <button (enviar) .../>
</div>
```

Passa a ser, de cima para baixo, dentro do mesmo container `<div className="px-3 py-2.5 border-t ...">` (linha 466):

1. **Banner de erro/bloqueio** (já existe, linha 467-474) — reaproveitado também pelo filtro de linguagem, ver seção (d).
2. **Preview strip de anexos pendentes** (novo, só renderiza se houver 1+ arquivo selecionado ainda não enviado).
3. **Linha do composer** (`flex items-end gap-2`): 3 botões de ícone à esquerda, depois o `textarea`, depois o botão enviar (inalterado).

### Botões de ícone (emoji / figurinha / anexo)

Ordem da esquerda pra direita: emoji → figurinha → anexo (ordem da decisão 1).

Ícones `lucide-react`: `Smile` (emoji), `Image` (figurinha), `Paperclip` (anexo — já importado em outros arquivos do projeto, ex. `LeadDetailDrawer.jsx`).

Cada botão:
```
width: 32, height: 32, borderRadius: "50%",
background: "transparent", border: "none", color: "var(--text-dim)",
display: flex, alignItems: center, justifyContent: center, cursor: pointer
```
- **Hover**: `background: var(--surface-alt)`, `color: var(--accent)` — mesmo par usado no botão "..." do `MoveStageMenu.jsx:140`.
- **Popover aberto** (estado ativo do próprio botão, emoji/figurinha): mantém o mesmo hover-state fixo (`background: var(--surface-alt)`, `color: var(--accent)`) enquanto o popover estiver montado, pra indicar qual dos 3 está aberto.
- Tamanho do ícone: 18px.
- `title`/`aria-label`: "Emoji", "Figurinha", "Anexar arquivo" respectivamente.
- Ícone de anexo não abre popover — dispara direto um `<input type="file" multiple hidden>` via `ref.current.click()`, igual ao padrão de `LeadDetailDrawer.jsx:1853-1860` (só que sem a drop-zone visual — aqui é só o clique no ícone).

### Popover de emoji

Reaproveita o padrão de posicionamento de `MoveStageMenu.jsx` (portal em `document.body`, `position: fixed`, cálculo de `top`/`bottom`/`left` via `getBoundingClientRect` do botão-gatilho, fecha em clique fora/scroll/resize — linhas 89-99 e 67-84 daquele arquivo). Como o composer fica sempre no rodapé da tela, o popover deve abrir **para cima** (mesma lógica de `openUpward` do `MoveStageMenu`, que aqui será quase sempre `true`).

Shell do popover:
```
position: fixed, background: var(--surface), border: 1px solid var(--border),
borderRadius: var(--radius-lg) /* 12px */, boxShadow: var(--shadow-pop),
zIndex: 2000, width: 288px, padding: 10px
```

Conteúdo — 4 blocos (um por categoria), cada um:
- Header: `padding: "8px 4px 4px"` (primeiro bloco) / `"12px 4px 4px"` (demais), `fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)"` — mesmo estilo dos headers de grupo do `MoveStageMenu.jsx:194,203`.
- Grid dos 8 emojis da categoria: `display: grid, gridTemplateColumns: "repeat(8, 32px)", gap: 2px`.
- Cada emoji: `<button>` 32×32, `fontSize: 18`, `borderRadius: var(--radius-sm)` (6px), `background: transparent`, `border: none`, hover `background: var(--surface-alt)`.

Comportamento ao clicar num emoji: insere o emoji ao final do `draft` atual (`setDraft(d => d + emoji)`), devolve o foco ao `textarea`, e **mantém o popover aberto** (permite escolher vários emojis em sequência sem reabrir) — ver decisão subjetiva (e.1). Fecha só por clique fora, `Escape`, scroll/resize da janela, ou clique de novo no botão-gatilho.

### Popover/grid de figurinhas

Mesmo shell de popover (mesma função de posicionamento, reaproveitada — não reimplementar o cálculo de `top`/`left`/`openUpward` uma terceira vez dentro do mesmo arquivo).

Diferença de conteúdo:
```
width: 300px, padding: 10px, maxHeight: 280px, overflowY: "auto"
gridTemplateColumns: "repeat(4, 1fr)", gap: 8px
```
Cada figurinha: `<button>` quadrado (aspect-ratio 1:1, ~64px), `<img>` com `objectFit: "contain"`, `background: var(--surface-alt)`, `border: 1px solid var(--border)`, `borderRadius: var(--radius-md)` (8px). Hover: `borderColor: var(--accent)`.

Estado vazio (nenhuma figurinha ativa cadastrada ainda): mesmo padrão visual do `EmptyState` simplificado inline — ícone `Image` (18px, `var(--text-faint)`), texto 12px `var(--text-faint)`, centralizado, `padding: 24px`, mensagem: *"Nenhuma figurinha disponível ainda."*

Fonte dos dados: hook novo `useChatStickers()` (não detalhado aqui — cabe ao frontend-agent), lendo a tabela `chat_stickers` (seção c) filtrada por `active = true` e resolvendo a imagem via `getPublicUrl` (bucket público, ver seção c).

Comportamento ao clicar numa figurinha: envia a mensagem imediatamente (ver seção (e.2) — decisão sinalizada como proposta, não fechada no mockup original) e fecha o popover.

### Preview strip de anexo (antes de enviar)

Não é um popover flutuante — é uma faixa **inline**, dentro do próprio composer, acima da linha de texto, que só aparece quando há 1+ arquivo pendente (selecionado mas ainda não enviado). Reaproveita a mesma lógica de ícone-por-mimetype e formatação de tamanho já existentes em `LeadDetailDrawer.jsx:1756-1776` (`FILE_ICON_MAP`/`FileIcon`/`formatBytes`) — 2ª ocorrência dessa lógica na plataforma, ainda não é a 3ª (regra 4 do CLAUDE.md), então não é obrigatório extrair pra `shared/` agora; réplica local é aceitável, extração vira obrigatória se um 3º lugar precisar da mesma coisa.

Estrutura:
```
display: flex, gap: 8px, overflowX: "auto", paddingBottom: 8px (antes da linha do composer)
```
Cada item pendente:
- **Imagem** (`image/*`): thumbnail 64×64, `objectFit: "cover"`, `borderRadius: var(--radius-md)`, `border: 1px solid var(--border)` — gerado via `URL.createObjectURL(file)` local, sem upload ainda.
- **Não-imagem** (pdf/doc/xls/etc.): chip retangular, `height: 64px`, `minWidth: 120px`, `padding: 8px`, `display: flex, alignItems: center, gap: 8px`, `background: var(--surface-alt)`, `border: 1px solid var(--border)`, `borderRadius: var(--radius-md)` — ícone (`FileIcon`, 16px) + nome truncado (12px, `var(--text)`, `font-weight: 600`) + tamanho (`formatBytes`, 10px, `var(--text-dim)`).
- **Badge de remover ("x")**: círculo 16px sobreposto no canto superior-direito (`position: absolute, top: -6, right: -6`), `background: var(--surface)`, `border: 1px solid var(--border)`, ícone `X` 10px `var(--text-dim)`; hover: `color: var(--danger)` (nunca `var(--accent)` — remover é uma ação destrutiva local, mesmo antes do upload).

Ao clicar em enviar (`handleSend`): para cada item pendente, faz upload pro bucket (seção c) e só então inclui no array `attachments` da mensagem via `sendMessage`. Depois do envio bem-sucedido, limpa a preview strip.

### Renderização da mensagem enviada com anexo

Reaproveita o mesmo vocabulário de ícone-por-tipo/`formatBytes`, adaptado às cores da bolha (`MessageBubble`, `ChatView.jsx:137-170`):

- **Imagem inline**: `<img>` dentro da bolha, `maxWidth: 240px, maxHeight: 240px, borderRadius: 12px` (mesmo raio da bolha), abre em nova aba ao clicar.
- **Card de arquivo** (não-imagem): mesma estrutura da preview strip (ícone + nome + tamanho), mas cores adaptadas por quem é o dono da bolha:
  - Bolha própria (`own`, fundo `var(--accent)`): caixa do ícone com `background: rgba(255,255,255,0.15)`, ícone/texto em `var(--on-accent)`.
  - Bolha de terceiro (fundo `var(--surface)`): caixa do ícone `var(--surface-alt)`, ícone `var(--text-dim)`, nome `var(--text)`, tamanho `var(--text-faint)`.
- Múltiplos anexos na mesma mensagem: empilhados verticalmente, `gap: 6px`, anexos sempre **abaixo** do texto (`body`) quando os dois existem na mesma mensagem.
- **Comportamento**: se a mensagem só tem anexo (sem texto), `body` chega vazio (`""`) — a bolha não deve renderizar uma linha de texto em branco acima do(s) anexo(s) (checar `message.body` truthy antes de renderizar o `<div>` do texto em `MessageBubble`). Isso exige também relaxar a guarda de `sendMessage` (`use-chat.js:117-118`, hoje `if (!text) return null`) pra aceitar `attachments.length > 0` mesmo com `text` vazio — comportamento, não schema (`chat_messages.body` já é `NOT NULL` mas aceita string vazia).

---

## c) Schema SQL — tabela de figurinhas + bucket de Storage

### Tabela `chat_stickers`

```sql
CREATE TABLE IF NOT EXISTS public.chat_stickers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,             -- label/alt text, mostrado no title do botão no picker
  image_path  text NOT NULL,             -- caminho dentro do bucket chat-stickers (não URL completa)
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_stickers_active_idx ON public.chat_stickers (active);

ALTER TABLE public.chat_stickers ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer colaborador autenticado vê as ativas (pro picker do
-- composer); gestor/admin também vê as inativas (pro painel de gestão saber
-- o que já foi desativado sem precisar reativar às cegas).
DROP POLICY IF EXISTS chat_stickers_read ON public.chat_stickers;
CREATE POLICY chat_stickers_read ON public.chat_stickers FOR SELECT
  USING (active OR public.chat_is_manager(auth.uid()));

-- Escrita/remoção: mesma regra de quem cria canal no Chat hoje
-- (chat_is_manager — chat_create_channel, migration 20260812, linha 213).
DROP POLICY IF EXISTS chat_stickers_write ON public.chat_stickers;
CREATE POLICY chat_stickers_write ON public.chat_stickers FOR INSERT
  WITH CHECK (public.chat_is_manager(auth.uid()));

DROP POLICY IF EXISTS chat_stickers_update ON public.chat_stickers;
CREATE POLICY chat_stickers_update ON public.chat_stickers FOR UPDATE
  USING      (public.chat_is_manager(auth.uid()))
  WITH CHECK (public.chat_is_manager(auth.uid()));

DROP POLICY IF EXISTS chat_stickers_delete ON public.chat_stickers;
CREATE POLICY chat_stickers_delete ON public.chat_stickers FOR DELETE
  USING (public.chat_is_manager(auth.uid()));
```

Duas ações distintas no painel de Configurações (não confundir):
- **Toggle ativo/inativo** — esconde do picker sem apagar o arquivo (`UPDATE active`).
- **Excluir (`Trash2` → `ConfirmDeleteModal`)** — remoção definitiva: apaga a linha **e** o arquivo no Storage. Esta é a ação que o Daniel pediu explicitamente ("deixar remover qualquer um") — segue o padrão de exclusão já documentado no CLAUDE.md regra 1 (`FornecedoresView.jsx:130-146`: `Modal` + botões "Cancelar"/"Excluir", "Excluir" em `var(--danger)`).

### Bucket de Storage — `chat-stickers`

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-stickers', 'chat-stickers', true, 2097152, ARRAY['image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Público (ao contrário de lead-attachments/rh-documentos-assinatura): conteúdo
-- curado e não confidencial, carregado com frequência no composer e nas bolhas
-- de mensagem — getPublicUrl evita round-trip de signed URL por figurinha.
DROP POLICY IF EXISTS chat_stickers_storage_read ON storage.objects;
CREATE POLICY chat_stickers_storage_read ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-stickers');

DROP POLICY IF EXISTS chat_stickers_storage_write ON storage.objects;
CREATE POLICY chat_stickers_storage_write ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-stickers' AND public.chat_is_manager(auth.uid()));

DROP POLICY IF EXISTS chat_stickers_storage_delete ON storage.objects;
CREATE POLICY chat_stickers_storage_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-stickers' AND public.chat_is_manager(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.chat_is_manager(uuid) FROM anon; -- já revogado na migration original; conferir se não regride.
```

Convenção de path (mesmo padrão de `use-lead-attachments.js:40`): `${Date.now()}-${slug(nome)}.${ext}` na raiz do bucket (sem pasta por entidade — não há "dono" por registro além de `uploaded_by`).

### Bucket de Storage — `chat-attachments` (anexo de mensagem, não figurinha)

Distinto do bucket de figurinhas — conteúdo de conversa real, não curado, segue o mesmo padrão de **privado** já usado para anexos de Lead/RH:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments', 'chat-attachments', false, 10485760,
  ARRAY['application/pdf','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv','text/plain',
        'image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: `${channelId}/${timestamp}-${rand}.ext` (mesmo padrão de
-- lead-attachments, migration 20260713_fix_lead_attachments_storage_scope.sql).
-- Escopo: só membro do canal lê/envia/apaga — chat_is_member já existe.
DROP POLICY IF EXISTS chat_attachments_storage_read ON storage.objects;
CREATE POLICY chat_attachments_storage_read ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-attachments'
    AND public.chat_is_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS chat_attachments_storage_insert ON storage.objects;
CREATE POLICY chat_attachments_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.chat_is_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS chat_attachments_storage_delete ON storage.objects;
CREATE POLICY chat_attachments_storage_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-attachments'
    AND public.chat_is_member((storage.foldername(name))[1]::uuid)
  );
```

Leitura no client via `createSignedUrl(path, 3600)` (mesmo padrão de `use-lead-attachments.js:89-96`), não `getPublicUrl` — bucket privado.

> Nota: esta última tabela/bucket de anexo (`chat-attachments`) não foi pedida explicitamente na seção (c) do enunciado (que pede só a tabela de **figurinhas**), mas é pré-requisito direto da decisão 3 (anexo de mensagem) e a coluna `attachments jsonb` já existe em `chat_messages` sem nada gravando nela — incluí aqui pra spec não deixar a decisão 3 sem schema de apoio. Se preferir revisar separadamente, é só remover esta subseção antes de implementar.

---

## d) Filtro de linguagem — integração no fluxo de envio

### Arquivo de lista de palavras

`src/data/chat-banned-words.js` — dado puro (mesmo padrão de `src/data/changelog.js`/`src/data/tutorials.js`), não é este agente (design) quem deve **inventar o conteúdo** de uma lista de baixo calão real — isso é call de conteúdo/RH, não de design visual. Formato esperado, com placeholders neutros só pra ilustrar a estrutura:

```js
// Lista de palavras bloqueadas no Chat interno — PT-BR, minúsculo, sem
// acento (a normalização de acento acontece em src/utils/language-filter.js,
// não precisa duplicar variantes acentuadas aqui). Lista viva: Daniel/RH
// decide o conteúdo real; abaixo é só a estrutura esperada.
export const CHAT_BANNED_WORDS = [
  // "exemplo1", "exemplo2", ...
];
```

### Utilitário de checagem

`src/utils/language-filter.js` (novo — hoje não existe nenhum, confirmado por grep):

```js
import { CHAT_BANNED_WORDS } from "../data/chat-banned-words";

// normaliza: minúsculo + remove acento, pra "PÊSSEGO"/"pessego" caírem no
// mesmo token que a entrada da lista.
function normalize(text) { ... }

// Retorna a palavra encontrada (string) ou null. Match por token inteiro
// (split em não-letra), não por substring — evita falso positivo tipo uma
// palavra da lista aparecer embutida dentro de outra palavra inocente.
export function findBannedWord(text) { ... }
```

### Onde entra no fluxo

Em `ChatView.jsx`, dentro de `handleSend` (linha 324-337), **antes** de chamar `sendMessage` — checagem 100% client-side, síncrona, sem round-trip:

```js
const handleSend = async () => {
  const text = draft.trim();
  if ((!text && pendingAttachments.length === 0) || !selectedId || sending) return;

  const banned = findBannedWord(text);
  if (banned) {
    setSendError("Essa mensagem tem uma palavra não permitida no Chat — ajuste antes de enviar.");
    return; // nunca chega a chamar sendMessage — ninguém mais no canal sabe que a tentativa existiu
  }

  setSending(true);
  setSendError(null);
  try {
    await sendMessage(selectedId, text, pendingAttachments);
    setDraft("");
    setPendingAttachments([]);
  } catch (e) {
    setSendError(e?.message || "Não foi possível enviar a mensagem.");
  } finally {
    setSending(false);
  }
};
```

**Decisão de reaproveitamento**: o aviso usa o **mesmo state e o mesmo banner** que já existe pra erro de envio (`sendError`, `ChatView.jsx:467-474` — `background: var(--danger-bg)`, `color: var(--danger)`, `fontSize: 12`). Não é um segundo slot de banner novo — é a mesma UI, só que a mensagem de texto varia por causa (rede vs. conteúdo bloqueado). Token: `--danger`/`--danger-bg`, não `--warning` — segundo a própria definição do token no CLAUDE.md ("`--danger` = erro / bloqueio de input do usuário"), que é exatamente este caso, e não "atenção/configuração que não é responsabilidade de quem preenche o formulário" (isso seria `--warning`).

### Comportamento

- Checagem só dispara ao tentar enviar (clique no botão ou Enter) — **nunca** a cada tecla digitada, pra não interromper o usuário no meio da frase.
- Bloqueio é total: `sendMessage` nunca é chamado, nada é gravado, nada passa pelo Realtime — ninguém no canal (nem quem seria destinatário) sabe que houve uma tentativa. Isso já é garantido pela checagem ser puramente client-side antes do `insert`.
- O aviso some assim que o usuário editar o texto de novo (mesmo padrão do `sendError` de rede: reseta em `useEffect` ao trocar de `selectedId`, e recomendo também limpar ao digitar — `onChange` do textarea chama `setSendError(null)` se havia uma mensagem de bloqueio ativa, pra não deixar o aviso "grudado" depois que o usuário já corrigiu).

---

## e) Decisões subjetivas — proposta e alternativas

Estas não estavam fechadas nas 5 decisões do mockup original; são detalhes de
interação que precisei resolver pra a spec ficar acionável, sinalizados aqui
como **proposta**, não fato consumado:

**e.1 — Popover de emoji fecha ou continua aberto após escolher um emoji?**
- Opção A (proposta): continua aberto, permite escolher vários em sequência (padrão WhatsApp/Slack/Telegram). Fecha só em clique fora, Escape, ou clique de novo no botão.
- Opção B: fecha a cada emoji escolhido (mais simples de implementar, mas obriga reabrir pra cada emoji).
- Escolhi A porque combinação de emojis em sequência (ex.: "👍🎉") é um padrão de uso comum em chat de equipe.

**e.2 — Clique numa figurinha envia a mensagem na hora, ou só anexa como pendente (igual anexo de arquivo)?**
- Opção A (proposta): envia imediatamente ao clicar — a figurinha É a mensagem, sem passo extra de confirmação (padrão WhatsApp/Telegram/Slack). Popover fecha após o envio.
- Opção B: figurinha vira item pendente na preview strip, igual anexo de arquivo, exige clicar em "Enviar" depois.
- Escolhi A porque separar clique-em-figurinha de "enviar" adiciona uma etapa que nenhum chat de mercado usa pra sticker — mas como isso não estava no mockup original aprovado, **sinalizo explicitamente que esta é uma peça nova de interação, não coberta pela aprovação anterior**, e pode valer a pena confirmar com o Daniel antes do frontend-agent implementar (CLAUDE.md regra 3 trata isso como mudança estrutural nova).

**e.3 — Bolha de mensagem para figurinha: mantém o "balão" (fundo/borda da bolha de texto) ou a figurinha flutua sem chrome, tipo WhatsApp?**
- Opção A (proposta): sem chrome de bolha — a imagem da figurinha (tamanho fixo, ex. 96×96px) aparece sozinha, sem `background`/`border`/`padding` de bolha de texto, mas mantém o timestamp abaixo (consistência com o resto do feed).
- Opção B: mantém a bolha como está hoje (fundo `var(--accent)`/`var(--surface)`), só troca o conteúdo interno pela imagem.
- Escolhi A porque bolha de texto ao redor de uma imagem decorativa fica com espaço morto ao redor da figurinha (contraste ruim, sobra de fundo colorido). Mesma ressalva da e.2 — não estava no mockup original, marcar como proposta.

**e.4 — Pacote de figurinhas é global (toda a plataforma) ou por empresa/frente comercial (`COMPANIES[companyId]`)?**
- Opção A (proposta): global — uma tabela só, um painel de gestão só, sem `company_id`. Justificativa: figurinha de chat interno é sobre humor/cultura de equipe, não sobre identidade visual de marca por frente comercial (diferente de `--accent`, que precisa mudar por empresa).
- Opção B: `chat_stickers.company_id text` (nullable = todas), replicando o padrão já usado em `chat_channels.company_id` (migration 20260812, linha 16).
- **Esta é a que mais se aproxima de mudança de schema "de verdade"** (adicionar ou não uma coluna de escopo) — como o CLAUDE.md exige confirmação explícita do Daniel pra isso, deixo como pergunta em aberto em vez de decidir sozinho: a tabela em (c) foi escrita **sem** `company_id` (opção A), mas se a resposta for "por empresa", é a coluna que falta antes de aplicar a migration.

**e.5 — Tamanho máximo e extensões aceitas pro anexo de mensagem de chat.**
Baixa margem de subjetividade real — a plataforma já tem um número de fato
(10 MB) repetido em 4 arquivos (`DocumentCaptureModal.jsx:6`, `TalentPoolForm.jsx:10`,
`JobApplicationForm.jsx:8`, `NovoColaboradorModal.jsx:19`) e uma lista de
extensões já usada em `LeadDetailDrawer.jsx:1858` (pdf/doc/docx/xls/xlsx/csv/txt/
jpg/jpeg/png/gif/webp). Proposta: reaproveitar os dois valores tal qual — 10 MB
por arquivo, mesma lista de extensões — em vez de inventar um limite novo só
pro Chat. Já refletido no bucket `chat-attachments` da seção (c).

**e.6 — Filtro de linguagem: checagem só no cliente é suficiente, ou precisa também de uma trava no banco (RLS/trigger) contra quem manda direto pela API?**
Fora do escopo de design puro (é decisão de validação/segurança, que este
agente explicitamente não decide) — sinalizando para o frontend-agent/Daniel
avaliarem: hoje a spec (d) cobre só o bloqueio client-side, que atende a UX
pedida ("só o autor vê, ninguém no canal sabe") mas não impede alguém
chamando a REST API do Supabase diretamente sem passar pelo `ChatView.jsx`.
