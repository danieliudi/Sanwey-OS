# Unificar o header das 3 Visões Gerais (Comercial como referência)

O Daniel apontou (com print real da tela) que o header do Comercial —
saudação + contagem de dados + botões Atualizar/Exportar/Personalizar,
largura cheia — é o padrão que **Marketing e RH deveriam seguir**, não uma
exceção a preservar. Confirmado no código: são 3 implementações realmente
diferentes hoje, não 2 variações justificadas.

| | Comercial (referência) | Marketing (hoje) | RH (hoje) |
|---|---|---|---|
| Título | saudação (`greetingFor`) | saudação (cálculo local, quase igual) | fixo "Visão Geral — RH" |
| Subtítulo | contagem de leads | contagem de campanhas + empresa | data de hoje |
| Botões | Atualizar, Exportar (gerente), Personalizar | só Personalizar (+ badge "ao vivo") | só Personalizar |
| Largura | cheia (`flex flex-col gap-7`) | 1080px centralizado | 1200px centralizado + wrapper extra |

Decisões já confirmadas com o Daniel: título/subtítulo do RH viram
saudação+contagem (igual às outras 2); Marketing exporta campanhas
filtradas, RH exporta colaboradores.

## 1. Extrair `greetingFor` pra `src/utils/greeting.js` (novo)

Hoje só existe em `DashboardView.jsx:392-397` (função local, não exportada).
Vira a 3ª ocorrência real (Comercial ganha, Marketing tinha uma quase-cópia
inline, RH vai precisar de uma) — extrair agora, per CLAUDE.md regra 4.

```js
// src/utils/greeting.js
export function greetingFor(user) {
  const hour = new Date().getHours();
  const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const first = (user?.name || "").split(" ")[0];
  return first ? `${period}, ${first}` : period;
}

export default greetingFor;
```

- `DashboardView.jsx:392-397` — remove a função local, importa
  `import { greetingFor } from "../../utils/greeting";` no topo. `{greetingFor(user)}` (linha 223) não muda.

## 2. `src/utils/export-csv.js` — 2 novas funções + reaproveitar em Marketing

Adicionar, no mesmo estilo de `exportLeadsToCSV` (usa `csvRow`/`triggerDownload`
já existentes, não reinventar):

```js
export function exportCampaignsToCSV(campaigns, { filename } = {}) {
  const header = ["Nome", "Canal", "Orçamento", "KPI", "Etapa", "Empresas", "Lançamento"];
  const rows = (campaigns || []).map(c => [
    c.name || "",
    c.channel || "",
    formatBRNumber(c.budget),
    c.kpi || "",
    c.stage || "",
    (c.companyIds || []).join(", "),
    formatDate(c.launchDate),
  ]);
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-campanhas-${today}.csv`, csv);
}

export function exportColaboradoresToCSV(colaboradores, { filename } = {}) {
  const header = ["Nome", "Departamento", "Cargo", "Status", "Admissão"];
  const rows = (colaboradores || []).map(c => [
    c.name || "",
    c.department || "",
    c.jobTitle || "",
    c.employeeStatus || "",
    formatDate(c.admissionDate),
  ]);
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(filename || `sanwey-colaboradores-${today}.csv`, csv);
}
```

`MarketingView.jsx` (Campanhas — `exportCampaignsCSV`, linhas 903-916) já tem
uma versão ad-hoc do mesmo export (Blob direto, sem BOM, delimitador vírgula
— diverge do padrão pt-BR/Excel que `export-csv.js` já resolve pros leads).
**Trocar essa função por uma chamada a `exportCampaignsToCSV(filteredCampaigns)`**
— consolida em 1 implementação em vez de 2 divergentes (mesma classe de bug
que a auditoria já achou uma vez nos exports de lead, ver comentário em
`export-csv.js:12-15`).

## 3. `src/components/views/MarketingDashboardView.jsx`

Hoje (linhas 480-565 aproximadamente):
- `const hour = new Date().getHours(); const greeting = hour < 12 ? ... ;` (cálculo
  inline) → remove, importa `greetingFor` de `../../utils/greeting` e `logExport`
  de `../../utils/log-export`, `exportCampaignsToCSV` de `../../utils/export-csv`,
  `RefreshCcw`/`Download` de `lucide-react`.
- `<h1>{greeting}, {user?.name?.split(" ")[0] || "—"}</h1>` (linha 519-522) →
  `<h1 ...>{greetingFor(user)}</h1>` (mesmo estilo inline, só troca o conteúdo).
- Wrapper `<div style={{ maxWidth: 1080, margin: "0 auto" }}>` (linha 513) →
  `<div className="flex flex-col gap-7">` (igual ao Comercial — full-width).
  Como o wrapper atual tinha margens implícitas por `mb-4`/`mb-5` entre blocos
  em vez de `gap`, ajustar essas classes internas pra não duplicar espaçamento
  (usar `gap-7` no wrapper e remover os `mb-*` das seções internas, replicando
  a estrutura exata do Comercial).
- No bloco de botões (linhas 539-557, `<div className="self-start flex items-center gap-2">`),
  adicionar ANTES do botão "Personalizar" existente, na mesma ordem do Comercial:
  ```jsx
  <Button variant="secondary" icon={RefreshCcw} size="md" onClick={() => window.location.reload()}>
    Atualizar
  </Button>
  {!isAgencia && (
    <Button
      variant="secondary"
      icon={Download}
      size="md"
      onClick={() => { exportCampaignsToCSV(fCampaigns); logExport(user?.id, "campaigns_dashboard", fCampaigns.length); }}
    >
      Exportar
    </Button>
  )}
  ```
  (`isAgencia` já existe no arquivo, linha 385 — mesmo gate que já esconde
  outras ações de escrita/edição pra usuários de agência.)
- `CompanyTabs` (linhas 559-565) e o badge "N ao vivo" **não mudam** — são
  específicos do Marketing (multi-empresa), não uma inconsistência a remover.

## 4. `src/components/views/RHOverviewView.jsx`

Hoje (linhas 278-317):
- Wrapper duplo `<div style={{ minHeight: "100vh", background: "var(--surface)" }}><div className="py-4 lg:py-6" style={{ maxWidth: 1200, margin: "0 auto" }}>` →
  `<div className="flex flex-col gap-7">`, igual ao Comercial. O `minHeight:100vh`/
  `background:var(--surface)` do wrapper externo não existe nas outras 2 telas —
  remover (a página já herda o fundo correto do shell da aplicação).
- `<h1>Visão Geral — RH</h1>` → `<h1>{greetingFor(currentUser)}</h1>` (import de
  `../../utils/greeting`).
- `<p>{fmtToday()}</p>` (subtítulo, linha 296-305) → contagem de colaboradores,
  no mesmo padrão de "quantidade · contexto" das outras 2 telas:
  ```jsx
  <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "4px 0 0" }}>
    {totalAtivos} colaborador{totalAtivos !== 1 ? "es" : ""} ativo{totalAtivos !== 1 ? "s" : ""}
  </p>
  ```
  (`totalAtivos` já existe no arquivo, calculado nas linhas ~151-153 — reaproveitar,
  não recalcular.) `fmtToday`/`fmtToday()` ficam órfãs após essa troca — se não
  forem usadas em nenhum outro lugar do arquivo, remover a função morta.
- Botão "Personalizar" (linhas 307-316) — antes dele, mesma ordem do Comercial:
  ```jsx
  <Button variant="secondary" icon={RefreshCcw} size="md" onClick={() => window.location.reload()}>
    Atualizar
  </Button>
  {canWrite && (
    <Button
      variant="secondary"
      icon={Download}
      size="md"
      onClick={() => { exportColaboradoresToCSV(colaboradores); logExport(currentUser?.id, "rh_overview_dashboard", colaboradores.length); }}
    >
      Exportar
    </Button>
  )}
  ```
  (`canWrite` já é prop do componente — mesmo gate que os outros botões de
  escrita desta tela já usam.) Import de `RefreshCcw`/`Download` de `lucide-react`,
  `exportColaboradoresToCSV`/`logExport` conforme acima.

## 5. Fora de escopo

- Nenhuma mudança nas Zonas 1-4 (stat tiles, pendências, distribuição por
  departamento) das 3 telas — só a área do header no topo.
- Nenhuma mudança em `DashboardView.jsx` além de importar `greetingFor` do
  novo util (comportamento idêntico, só remove duplicação de código).

## 6. Verificação

1. `npx vite build` limpo.
2. Testar os botões novos nas 3 telas: "Atualizar" recarrega a página,
   "Exportar" baixa um CSV com conteúdo correto (abrir no Excel/planilha e
   conferir acentuação/delimitador).
3. Confirmar que `MarketingView.jsx` (Campanhas) continua exportando CSV
   corretamente depois de trocar pra `exportCampaignsToCSV` compartilhada —
   mesmo dado, agora com BOM/delimitador `;` em vez do formato antigo.
4. Confirmar visualmente (claro + escuro) que as 3 telas ficam com a mesma
   estrutura de header — saudação, contagem, 3 botões na mesma ordem,
   largura cheia.
5. Nenhuma classe de bug conhecida reintroduzida.
