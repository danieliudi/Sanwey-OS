# Grupo Sanwey · Commercial Intelligence (v4)

Plataforma multi-frente do Grupo Sanwey. Duas frentes comerciais —
**Sanwey** (`industria`) e **Resibag** — mais a visão consolidada do Grupo;
Monte Mor aparece só em solicitações de Marketing, porque a unidade não vende
(`MARKETING_UNIT_IDS` em `src/constants/companies.js`).

> Este README é **setup e histórico da reescrita v4**. Pra saber **o que cada
> tela faz, quem consegue abrir e do que depende**, leia
> **[`docs/mapa-funcional.md`](docs/mapa-funcional.md)** — 45 telas em 52
> rotas, 8 rotas públicas, 30 edge functions e as integrações externas.

## Setup

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Build de produção

```bash
npm run build
npm run preview
```

## Estrutura

```
src/
  App.jsx            # raiz: estado global, navegação e as 52 rotas autenticadas
  main.jsx           # entry + as 8 rotas PÚBLICAS (sem login), fora do <App>
  index.css          # base do Tailwind + os tokens de design (--accent, --danger…)
  constants/         # companies, pipelines, routes, taxonomy, user-settings…
  data/              # geradores de dado demo, changelog, tutoriais, spotlights
  utils/             # currency, date, field-conditions, export-csv, module-access…
  hooks/             # 122 hooks — 97 falam com o banco, 1 por domínio
  lib/               # cliente Supabase e utilitários de baixo nível
  components/
    ui/              # primitivos (Button, Select, Modal, CurrencyInput…)
    shell/           # LoginScreen, Sidebar, TopBar, MobileBottomNav
    shared/          # o que é reaproveitado entre módulos (ver CLAUDE.md regra 1)
    public/          # os 7 formulários das rotas públicas
    lead/ campaign/ rh-pipeline/ client/ …   # por domínio
    views/           # 58 telas
```

As contagens acima são conferidas por `node scripts/mapa-funcional-check.mjs`
— foi escrito justamente porque a versão anterior desta árvore descrevia 7
views quando já existiam 58, e ninguém percebeu.

## Correções vs v3

### Bugs

- **B1 — Rules of Hooks:** `LeadDetailDrawer` chamava `useState/useEffect` depois
  de um `if (!lead) return null`. Hooks agora rodam incondicionalmente antes do
  guard, usando `lead?.stage ?? null`.
- **B2 — Dataset duplicado:** v3 chamava `generateLeadsForAllCompanies()` duas
  vezes com `Math.random`, gerando dois conjuntos diferentes (um para o CRM e
  outro para cross-referrals). Agora o PRNG é `mulberry32` com seed fixa e a
  geração ocorre **uma vez** em escopo de módulo.
- **B3 — Stale closures:** Atualizações de leads usavam `setLeads(leads.map(...))`,
  que capturava o snapshot no momento do render. Trocado por `setLeads(prev => ...)`
  em toda atualização.
- **B5 — Efeito disparando indevidamente:** o `useEffect` de auto-seleção de
  empresa dependia de `currentUser` inteiro, disparando em cada edição de perfil.
  Agora usa um `useRef` para detectar apenas trocas reais de id.
- **B6 — Overlaps desatualizados:** cross-referrals eram persistidos e não
  recalculados quando `stage`/`owner` mudavam. Agora derivam de `leads` via
  `useMemo`; só os *overrides* (aprovado/rejeitado) são persistidos.
- **B7 — Referências compartilhadas de pipeline:** todas as empresas
  apontavam para o mesmo array de stages, permitindo mutação cruzada. Fixo via
  `Object.freeze` + factory `defaultPipelines()`.
- **B9 — `decisionMaker` opcional:** alguns leads não têm decisor; o drawer
  falhava com `.split`. Fallback: `"—"` e iniciais em branco.
- **B10 — Sort crash:** comparações no Explorer estouravam em
  `va.localeCompare(vb)` quando `va`/`vb` eram `undefined`. Agora há guard
  null-safe e coerção para `String` quando há mistura de tipos.

### Performance

- **P1 — Filtros repetidos no CRM:** o Kanban filtrava os leads uma vez por
  coluna (N etapas × O(L)). Agora faz um único bucketing `byStage` em O(L).
- **P2 — `localStorage` spam:** cada keystroke disparava um write. `usePersistentState`
  debounce 300ms + flush no `beforeunload`.
- **P3 — Formatação de moeda recriada:** `new Intl.NumberFormat(...)` no hot
  path. Agora os formatters ficam cacheados em `utils/currency.js`.
- **P4 — `maxPipeline` dentro do `map`:** no ExecutiveDashboard, recalculava o
  máximo a cada barra. Movido para fora (`useMemo`).
- **P5 — Lookup O(N) de usuários:** `.find(u => u.id === ...)` em cada render.
  Substituído por `useUsersById` que retorna um `Map`.

## Visual/UX preservados

Toda a identidade visual da v3 foi mantida byte-a-byte: paleta, espaçamentos,
componentes, copy, seed de dados mock, ordem das seções. Só a organização
do código e o comportamento de estado mudaram.

## Supabase (autenticação)

O app funciona em dois modos:

- **Mock (padrão):** se as variáveis de ambiente do Supabase não estiverem
  definidas, o `LoginScreen` mostra o seletor de perfil clássico e os dados
  ficam apenas no `localStorage`. Útil para demo/design.
- **Supabase:** se as variáveis estiverem presentes, o login passa a ser
  email + senha real, com sessão persistida e refresh automático.

### 1. Criar projeto

1. Acesse https://supabase.com/dashboard e crie um projeto.
2. Em **Settings → API**, copie:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`

### 2. Variáveis de ambiente

Crie `.env.local` na raiz (o arquivo já está no `.gitignore`):

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

Reinicie o `npm run dev` — Vite só injeta env vars no boot.

### 3. SQL: tabela `profiles`

Execute no **SQL Editor** do Supabase. A tabela é chaveada pelo
`auth.users.id` (um-pra-um) e guarda os metadados que o app usa
(`role`, `companies`, iniciais, cor do avatar).

```sql
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  role text not null default 'vendedor' check (role in ('vendedor','gerente','admin')),
  companies text[] not null default '{}',
  initials text,
  avatar_bg text default '#1E4D8C',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- cada usuário lê/atualiza só o próprio perfil
create policy "profiles_self_select"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_self_update"
  on public.profiles for update
  using (auth.uid() = id);

-- gerentes e admins podem ler qualquer perfil (para o User Management view)
create policy "profiles_manager_select_all"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('gerente','admin')
    )
  );

-- admin pode atualizar/deletar qualquer perfil; gerente só não-admins
-- (evita que gerente promova alguém a admin ou remova um admin)
create policy "profiles_admin_update_all"
  on public.profiles for update
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );

create policy "profiles_manager_update_nonadmin"
  on public.profiles for update
  using (
    role <> 'admin'
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'gerente')
  );

create policy "profiles_admin_delete"
  on public.profiles for delete
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );

create policy "profiles_manager_delete_nonadmin"
  on public.profiles for delete
  using (
    role <> 'admin'
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'gerente')
  );
```

### 4. Trigger: criar `profile` no signup

Sem isso, um usuário novo consegue logar mas o app não acha o perfil e
trata como `vendedor` sem empresas.

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    upper(substring(coalesce(new.raw_user_meta_data->>'name', new.email) from 1 for 2))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### 5. Hierarquia de roles

Três níveis, do mais poderoso para o menos:

- **admin** — enxerga tudo, edita/remove qualquer usuário, único role que
  consegue promover outra conta a `admin`. Use para o dono/plataforma.
- **gerente** — enxerga tudo, edita/remove vendedores e outros gerentes,
  **não consegue mexer em admin nem se auto-promover a admin**.
- **vendedor** — enxerga só os próprios leads, não vê o User Management.

### 6. Promover um usuário

O signup cria sempre `role = 'vendedor'`. Para promover (e atribuir empresas),
execute no **SQL Editor**:

```sql
-- promover a admin
update public.profiles
set role = 'admin',
    companies = array['comercial','industria','resibag','montemor']
where id = (select id from auth.users where email = 'voce@empresa.com');

-- promover a gerente
update public.profiles
set role = 'gerente',
    companies = array['comercial','industria','resibag','montemor']
where id = (select id from auth.users where email = 'gerente@empresa.com');
```

### 7. Auth settings

Em **Authentication → Providers → Email**, recomendado:

- Ative **Email signup**.
- Desative **Confirm email** durante o desenvolvimento (o signup já
  autentica imediatamente). Em produção, reative para bloquear emails
  falsos.
