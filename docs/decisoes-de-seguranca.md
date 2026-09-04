# Decisões de segurança — o racional completo

Extraído da regra 2 do `CLAUDE.md` em 03/09/2026. Motivo: o `CLAUDE.md` é lido
**inteiro em toda sessão** do Claude Code, e 113 das suas linhas eram o racional
histórico de decisões de segurança já fechadas — conteúdo que se consulta quando
o assunto aparece, não que se precisa carregar para trocar o rótulo de um botão.

**O que ficou lá**: a regra operativa, curta. **O que está aqui**: por que cada
decisão foi tomada, o que já foi medido, e o que não se deve reabrir.

Nada foi alterado no recorte — é o mesmo texto, com o mesmo compromisso: estas
decisões **não devem ser "corrigidas" por conta própria**. Se uma delas parecer
errada, traga o motivo novo antes de mexer.

---

**Exceção deliberada, não migrar sem perguntar antes — escopo de `rh_colaboradores`
é o Grupo inteiro, não por empresa**: achado MD-10 da auditoria de segurança
(19/08/2026) — a policy `rh_colaboradores_rh_access` (produção) libera leitura
do cadastro completo (salário e CPF inclusos) das 3 frentes pra qualquer cargo
'rh'/'gerente_rh'/admin, sem nenhum filtro por `current_user_companies()` —
diferente do padrão rigoroso do Comercial (`clients_read`/`leads_select`, que
sempre filtram por empresa). Confirmado com o Daniel 20/08/2026: é intencional
— RH é centralizado de propósito, atende as 3 frentes com o mesmo time. Não
aplicar `AND companies && current_user_companies()` nem mascarar `salary` sem
perguntar antes — mudaria o fluxo real de quem hoje precisa alternar entre
frentes no mesmo cadastro.

**Policy nova nunca lê `profiles.role` (escalar) — sempre `roles[]`**: achado
MD-11 da auditoria de segurança (19/08/2026).

**Contagem corrigida em 01/09/2026 — a dívida em POLICY já foi paga.** Este
parágrafo dizia "22 policies em produção ainda comparam contra
`profiles.role`". Conferido no banco: das **345** policies do schema
`public`, **ZERO** leem o escalar ou `current_user_role()`. As 3 que citam a
palavra "role" se referem a `invitations.role` — a coluna do próprio convite,
no guard que impede gerente convidar admin, uso correto. Não saia caçando as
22: elas não existem mais.

**O que sobrou: 1 função**, não 2 como uma varredura chegou a sugerir.
`rh_onboarding_tarefas_guard_self_update` faz
`profiles.role = any(array['admin','gerente_rh','rh'])`. (A outra candidata,
`handle_user_confirmed`, ESCREVE `role = inv.role` a partir do convite — isso
é correto, o convite carrega mesmo um cargo principal, não é leitura pra
decidir permissão.)

O efeito dessa que sobrou é NEGAR, nunca vazar: quem tem `rh` como cargo
secundário (`roles = {vendedor, rh}`, `role = 'vendedor'`) não passa no guard
apesar de ser RH. O gatilho `profiles_sync_roles` garante que o escalar esteja
DENTRO do array, não que o array caiba no escalar — por isso a divergência é
possível.

A regra pra frente continua a mesma: toda policy/função RLS nova usa `roles[]`
(via `current_user_has_role(...)`/`roles &&`), nunca `profiles.role` direto.

**Mexeu em cargo por SQL? Grave `role` E `roles` juntos, sempre** — corolário
prático do MD-11, descoberto na marra em 01/09/2026. O gatilho
`profiles_sync_roles` (BEFORE INSERT OR UPDATE em `profiles`) reinjeta o
`role` escalar dentro de `roles[]` toda vez que ele não estiver lá. Ou seja:
um `UPDATE profiles SET roles = ARRAY['suporte']` **não remove** o cargo
antigo — o escalar volta sozinho, sem erro e sem aviso. Aconteceu num teste
desta sessão: pedi "só suporte" e recebi `{suporte, vendedor}` de volta, o
que quase produziu um diagnóstico de segurança errado.

Pela interface isso NÃO é alcançável e não há nada a corrigir hoje:
`UserManagementView.jsx` monta a lista como
`[form.role, ...additionalRoles.filter(r => r !== form.role)]`, ou seja, o
cargo principal é o primeiro item por construção e o gatilho nunca tem o que
fazer. Conferido no banco em 01/09/2026: dos 15 perfis, ZERO têm o escalar
fora do array. O gatilho é rede de segurança, não bug.

O risco é só pra escrita que NÃO passa pela tela — SQL manual, migration, ou
uma tela futura que edite apenas o array: ali uma remoção de cargo
silenciosamente não acontece, e a operação parece ter dado certo. Não
"consertar" o gatilho por conta própria (mexer em cargo quebra login); a
regra é gravar os dois campos na mesma instrução.

**Chave pessoal de IA em texto plano — risco residual aceito, não é pra
"corrigir" sozinho**: achado MD-12 da auditoria de segurança (19/08/2026) —
a chave pessoal (OpenAI/Anthropic) que o usuário configura em Configurações →
Integrações de IA fica em claro no jsonb `profile_secrets.ai_config`. A
separação `profiles`/`profile_secrets` (19/08/2026) já garante que nem admin
nem gerente leem a chave de outra pessoa via RLS (`profile_secrets_self`,
`id = auth.uid()` pra ALL) — o que resta é que qualquer caminho com
service_role (edge functions, MCP, backup, dump de suporte) lê o valor em
claro. Decidido com o Daniel 20/08/2026: por ora fica como está — cifrar de
verdade (pgsodium/Supabase Vault) ou remover a opção de chave pessoal (todo
mundo na chave da empresa, já com cota por usuário via MD-06) são as duas
saídas reais, mas nenhuma foi escolhida ainda. Não implementar nenhuma das
duas por conta própria — é decisão de produto, não bug a corrigir.

**Achados BAIXO da auditoria de segurança (19/08/2026) — decisões registradas
20/08/2026, não reabrir sem motivo novo**:

- **BX-03** (`pg_net` no schema `public`, lint de higiene): não mexer. O
  acesso real já está fechado (`net.http_get/post/delete` restritos a
  `postgres`/`service_role` desde sessão anterior). A extensão não é
  relocalizável (`extrelocatable = false`) — mover pra schema `extensions`
  exigiria `DROP`+`CREATE EXTENSION`, com risco real de interromper o
  pg_cron (`agent_runner_daily_cron` usa `net.http_post`) e perder linhas de
  fila pendentes, por um ganho puramente cosmético (o lint some, nenhum
  acesso muda). Risco desproporcional ao ganho — decidido não fazer.
- **BX-04** (tabelas com RLS habilitada e zero policies — deny-all). São
  **6**, não 4 — a contagem aqui envelheceu (conferido 01/09/2026):
  `marketing_protocol_numbers` e `rh_pesquisa_respostas` já documentam a
  própria intenção na migration de origem ("só SECURITY DEFINER toca essa
  tabela"). `rapp_cargas`/`rapp_ibama` (dados IBAMA RAPP) foram conferidas
  20/08/2026: não têm migration no repo (populadas por ETL externo direto
  via `service_role`, fora do Git) nem são lidas em nenhuma tela — deny-all
  não é bug, é o comportamento correto pro que existe hoje. Se um dia uma
  tela vier a ler `rapp_cargas`/`rapp_ibama` com sessão de usuário, ela vai
  precisar de policy nova — não existe hoje. As outras duas apareceram
  depois e são igualmente deliberadas, cada uma documentando a intenção na
  própria migration de origem: `external_cache`
  (`_historico/20261020_sec_drop_external_cache_broad_read.sql`) e
  `rh_curriculo_upload_tokens`
  (`_historico/20261020_sec_rh_curriculos_upload_token.sql`). Deny-all
  proposital nas 6 — a decisão de 20/08/2026 continua valendo, só o número
  estava errado.
- **BX-08** (bucket `chat-stickers` público): confirmado deliberado —
  upload restrito a `chat_is_manager(auth.uid())`, leitura pública (figurinha
  precisa ser vista por todo mundo no chat), 2 MB + MIME `png`/`webp` já
  aplicados na migration de origem. Sem ação.
- **BX-10** (sessão em `localStorage` por padrão, sem MFA): a preferência
  "Lembrar-me" (sessionStorage quando desmarcada) já existe e está correta.
  Reduzir o tempo de vida do refresh token é configuração do painel
  Supabase (Auth → Settings), fora do alcance de migration/código — mesma
  categoria do MD-09 (leaked password protection).

