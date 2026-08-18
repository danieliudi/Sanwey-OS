import { createClient } from 'jsr:@supabase/supabase-js@2';

// ============================================================
// sanwey-crm-mcp — Edge Function
//
// Servidor MCP (Model Context Protocol) da plataforma Sanwey CRM, pra
// conectar como "Custom Connector" no claude.ai — decidido com o Daniel
// 14/08/2026: conexão única, nível admin (não é por vendedor; quem tiver o
// token vê o que um admin vê). Ele já usa isso pessoalmente, fora de
// qualquer sessão de Claude Code, no dia a dia.
//
// Três decisões de desenho que valem ler antes de mexer:
//
//  1. Autenticação é um token fixo (`SANWEY_MCP_TOKEN`, secret do projeto),
//     não um JWT de usuário — por isso o deploy é com verify_jwt=false e a
//     checagem do token é feita à mão aqui dentro, ANTES de qualquer coisa.
//     Isso é intencional (single admin-level connection, não por-usuário) —
//     não é o mesmo modelo de segurança do resto da plataforma, e não deve
//     ser copiado pra nenhuma function que sirva usuário final.
//  2. Roda com SUPABASE_SERVICE_ROLE_KEY (RLS não se aplica) — é exatamente
//     por isso que só o Daniel deve ter o token. Vazou o token, vazou o
//     banco inteiro pra leitura. Não é um caminho de escrita: as três
//     ferramentas abaixo só fazem SELECT.
//  3. Protocolo MCP implementado à mão (JSON-RPC 2.0 sobre HTTP, sem SDK
//     externo) — mesmo espírito de dependência mínima das outras functions
//     deste projeto (crm-ata-voz só usa supabase-js). O parser cobre só os
//     métodos que um servidor MCP somente-leitura precisa: initialize,
//     notifications/initialized, tools/list, tools/call, ping.
//
// Achado da auditoria de segurança de 18/08/2026 (pedido do Daniel: mais
// salvaguardas contra "a IA ler tudo da plataforma"): esta é a conexão de
// maior alcance que existe hoje — service_role, token único, buscar_cliente
// sem filtro de empresa (de propósito, é a busca do próprio Daniel no grupo
// inteiro). Não mudamos o escopo das consultas aqui (isso contrariaria a
// decisão de 14/08/2026 sem confirmação explícita) — a mitigação aplicada
// agora é só uma trilha de auditoria: cada chamada de ferramenta vira uma
// linha de log estruturado (ferramenta + argumentos, que já são só termos de
// busca/UUID que o próprio Daniel digitou — nunca o corpo da resposta), pra
// existir rastro caso um dia surja dúvida sobre o que foi consultado e
// quando. Sem tabela nova (mudança de schema exige confirmação explícita —
// regra 5 do CLAUDE.md): os logs de Edge Function já são persistidos pelo
// próprio Supabase e consultáveis via mcp__Supabase__query_logs.
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-session-id',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const PROTOCOL_FALLBACK = '2025-06-18';
const SERVER_INFO = { name: 'sanwey-crm-mcp', version: '1.0.0' };

// ------------------------------------------------------------------
// Auth: comparação em tempo constante — evita vazar, por diferença de
// tempo de resposta, quantos caracteres do token estão certos.
// ------------------------------------------------------------------
function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: unknown): s is string {
  return typeof s === 'string' && UUID_RE.test(s);
}

// Log estruturado de toda chamada de ferramenta — só ferramenta + argumentos
// (termos de busca/UUID já digitados pelo próprio Daniel, nunca a resposta
// nem dado de terceiro que não estivesse já no request). Vai pro stdout da
// function, que o Supabase já persiste e indexa por padrão — sem tabela
// nova, sem duplicar dado sensível em outro lugar.
function logToolCall(name: string, args: Record<string, unknown>, ok: boolean) {
  console.log(JSON.stringify({
    event: 'sanwey_crm_mcp_tool_call',
    tool: name,
    args,
    ok,
    at: new Date().toISOString(),
  }));
}

// ------------------------------------------------------------------
// Helpers de formatação — mesma convenção do resto da plataforma
// (src/utils/currency.js / date.js), reimplementada aqui porque a Edge
// Function não importa código do frontend.
// ------------------------------------------------------------------
function fmtBRL(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDateBR(v: unknown): string {
  if (!v) return '—';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
function digitsOnly(s: string): string {
  return (s || '').replace(/\D/g, '');
}

// ------------------------------------------------------------------
// Ferramentas — cada uma é a mesma lógica já validada nas skills pessoais
// dossie-cliente / preparar-visita (14/08/2026), reescrita aqui como
// consultas via supabase-js (select/filter, nunca SQL cru) em vez de uma
// query UNION só — PostgREST não executa SQL arbitrário, e isso evita
// precisar de uma function nova no banco (que seria mudança de schema e
// exigiria confirmação explícita — regra 5 do CLAUDE.md). Tabela pequena
// (15 clientes hoje): buscar tudo e filtrar em memória é seguro e simples;
// se a base crescer muito, isso é o primeiro ponto a revisar.
// ------------------------------------------------------------------

const TOOLS = [
  {
    name: 'buscar_cliente',
    description:
      'Busca cliente(s) do Grupo Sanwey (Sanwey/Resibag) por nome (mesmo parcial) ou CNPJ. Devolve id, nome, cidade/UF, CNPJ e categoria de cada correspondência — use o id devolvido para chamar dossie_cliente ou preparar_visita.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nome (mesmo parcial) ou CNPJ do cliente.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'dossie_cliente',
    description:
      'Monta o dossiê completo de um cliente já identificado (use buscar_cliente primeiro para achar o client_id): negócios abertos/fechados, atas de visita, mudanças de etapa, visitas, amostras, pós-venda e faturamento por ano — tudo direto do banco real.',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'UUID do cliente (devolvido por buscar_cliente).' },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'preparar_visita',
    description:
      'Monta uma pauta de uma página pra antes de visitar, ligar ou se reunir com um cliente: última ata e o que ficou combinado, etapa/valor do negócio, sinal de mercado relevante, produto liberado e margem de referência.',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'UUID do cliente (devolvido por buscar_cliente).' },
        lead_id: {
          type: 'string',
          description: 'Opcional — UUID do negócio específico, se o cliente tiver mais de um aberto.',
        },
      },
      required: ['client_id'],
    },
  },
] as const;

async function toolBuscarCliente(db: ReturnType<typeof createClient>, args: { query?: string }) {
  const q = (args.query || '').trim();
  if (!q) return 'Informe um nome ou CNPJ pra buscar.';

  const { data: all, error } = await db
    .from('clients')
    .select('id, name, cnpj, category, city, state, status')
    .limit(2000);
  // Nunca repassar error.message do PostgREST cru — pode citar nome de
  // tabela/coluna. Achado da revisão de segurança de 15/08/2026 (severidade
  // baixa, mas barato de corrigir): mensagem genérica pro chamador.
  if (error) throw new Error('Falha ao consultar clientes.');

  const digits = digitsOnly(q);
  const needle = q.toLowerCase();
  const matches = (all || []).filter((c) => {
    const nameHit = String(c.name || '').toLowerCase().includes(needle);
    const cnpjHit = digits.length >= 6 && digitsOnly(String(c.cnpj || '')) === digits;
    return nameHit || cnpjHit;
  });

  if (matches.length === 0) return `Nenhum cliente encontrado pra "${q}".`;

  const lines = matches
    .slice(0, 8)
    .map(
      (c) =>
        `- **${c.name}** (${c.city || '?'}/${c.state || '?'}) — CNPJ ${c.cnpj || '—'} — status ${c.status} — id: \`${c.id}\``,
    );
  const extra = matches.length > 8 ? `\n\n(+${matches.length - 8} outro(s) resultado(s), refine a busca)` : '';
  return `## Clientes encontrados pra "${q}"\n\n${lines.join('\n')}${extra}`;
}

// Puxa negócios (leads) + as 5 fontes de histórico de um cliente, mesma
// lógica da skill dossie-cliente — só que via .from()/.select() em vez de
// SQL cru, porque supabase-js não executa SQL arbitrário.
async function fetchClientAndLeads(db: ReturnType<typeof createClient>, clientId: string) {
  if (!isUuid(clientId)) return { client: null, leads: [] as Record<string, unknown>[], invalid: true as const };
  const { data: client, error: cErr } = await db
    .from('clients')
    .select('id, name, cnpj, category, city, state, status')
    .eq('id', clientId)
    .maybeSingle();
  if (cErr) throw new Error('Falha ao consultar o cliente.');
  if (!client) return { client: null, leads: [] as Record<string, unknown>[] };

  const { data: leads, error: lErr } = await db
    .from('leads')
    .select('id, company, stage, value, probability, sector, company_id, close_date, next_follow_up, activities, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (lErr) throw new Error('Falha ao consultar os negócios do cliente.');

  return { client, leads: leads || [] };
}

type TimelineItem = {
  kind: string;
  ts: string | null;
  resumo: string | null;
  detalhe: Record<string, unknown>;
  negocio_id: string | null;
  negocio_nome: string | null;
};

const KIND_LABEL: Record<string, string> = {
  ata_voz: 'ata',
  note: 'nota',
  email_sent: 'email',
  proposal_generated: 'proposta',
};

function ataEntriesFromActivities(leadId: string, leadName: string, activities: unknown): TimelineItem[] {
  if (!Array.isArray(activities)) return [];
  return activities
    .filter((a: Record<string, unknown>) => {
      const type = String(a?.type || '');
      return ['ata_voz', 'note', 'email_sent', 'proposal_generated'].includes(type) && !a?.deletedAt;
    })
    .map((a: Record<string, unknown>) => {
      const meta = (a.meta || {}) as Record<string, unknown>;
      return {
        kind: KIND_LABEL[String(a.type)] || 'comentario',
        ts: (a.timestamp as string) || (a.createdAt as string) || null,
        resumo: (a.body as string) || null,
        detalhe: {
          proximoPasso: meta.proximoPasso ?? null,
          proximoPassoData: meta.proximoPassoData ?? null,
          concorrente: meta.concorrente ?? null,
          objecao: meta.objecao ?? null,
          dor: meta.dor ?? null,
          temperatura: meta.temperatura ?? null,
        },
        negocio_id: leadId,
        negocio_nome: leadName,
      };
    });
}

// client_id/lead_id sempre entram via .eq()/.in() parametrizados — nunca
// concatenados numa string de filtro (.or() do PostgREST aceita string
// crua, e um client_id vindo de fora sem validar poderia injetar operador
// de filtro extra). Duas consultas + dedupe em memória em vez de uma só
// com .or() evita essa classe de bug por construção, não por escaping.
async function fetchByClientOrLeads(
  db: ReturnType<typeof createClient>,
  table: string,
  select: string,
  clientId: string,
  leadIds: string[],
): Promise<Record<string, unknown>[]> {
  const seen = new Map<string, Record<string, unknown>>();
  const { data: byClient } = await db.from(table).select(select).eq('client_id', clientId);
  for (const r of byClient || []) seen.set(r.id as string, r);
  if (leadIds.length > 0) {
    const { data: byLead } = await db.from(table).select(select).in('lead_id', leadIds);
    for (const r of byLead || []) seen.set(r.id as string, r);
  }
  return [...seen.values()];
}

async function fetchTimeline(
  db: ReturnType<typeof createClient>,
  clientId: string,
  leads: Record<string, unknown>[],
): Promise<TimelineItem[]> {
  const leadIds = leads.map((l) => l.id as string);
  const leadById = new Map(leads.map((l) => [l.id as string, l]));
  const items: TimelineItem[] = [];

  for (const l of leads) {
    items.push(...ataEntriesFromActivities(l.id as string, l.company as string, l.activities));
  }

  if (leadIds.length > 0) {
    const { data: hist } = await db
      .from('lead_stage_history')
      .select('lead_id, from_stage, to_stage, changed_at, note')
      .in('lead_id', leadIds);
    for (const h of hist || []) {
      const lead = leadById.get(h.lead_id as string);
      items.push({
        kind: 'etapa',
        ts: h.changed_at as string,
        resumo: `${h.from_stage || '—'} → ${h.to_stage}`,
        detalhe: { note: h.note ?? null },
        negocio_id: h.lead_id as string,
        negocio_nome: (lead?.company as string) || null,
      });
    }
  }

  const visitas = await fetchByClientOrLeads(
    db,
    'crm_viagem_registros',
    'id, client_id, lead_id, status, objetivo, resumo_realizado, destino_planejado, destino_realizado, data_planejada, data_realizada',
    clientId,
    leadIds,
  );
  for (const v of visitas) {
    const lead = leadById.get(v.lead_id as string);
    items.push({
      kind: 'visita',
      ts: (v.data_realizada as string) || (v.data_planejada as string) || null,
      resumo: v.status as string,
      detalhe: {
        objetivo: v.objetivo ?? null,
        resumo: v.resumo_realizado ?? null,
        destino: v.destino_realizado ?? v.destino_planejado ?? null,
      },
      negocio_id: (v.lead_id as string) || null,
      negocio_nome: (lead?.company as string) || null,
    });
  }

  if (leadIds.length > 0) {
    const { data: amostras } = await db
      .from('lead_samples')
      .select('lead_id, notes, cost, sent_at')
      .in('lead_id', leadIds);
    for (const s of amostras || []) {
      const lead = leadById.get(s.lead_id as string);
      items.push({
        kind: 'amostra',
        ts: s.sent_at as string,
        resumo: 'Amostra enviada',
        detalhe: { notes: s.notes ?? null, cost: s.cost ?? null },
        negocio_id: s.lead_id as string,
        negocio_nome: (lead?.company as string) || null,
      });
    }
  }

  const posvenda = await fetchByClientOrLeads(
    db,
    'posvenda_cases',
    'id, client_id, lead_id, stage, value, created_at',
    clientId,
    leadIds,
  );
  for (const pc of posvenda) {
    const lead = leadById.get(pc.lead_id as string);
    items.push({
      kind: 'posvenda',
      ts: pc.created_at as string,
      resumo: `Caso de pós-venda — etapa ${pc.stage || '?'}`,
      detalhe: { value: pc.value ?? null },
      negocio_id: (pc.lead_id as string) || null,
      negocio_nome: (lead?.company as string) || null,
    });
  }

  const { data: faturamento } = await db
    .from('client_billing_history')
    .select('year, total_value, order_count')
    .eq('client_id', clientId);
  for (const b of faturamento || []) {
    items.push({
      kind: 'faturamento',
      ts: `${b.year}-12-31T12:00:00Z`,
      resumo: `Faturamento ${b.year}`,
      detalhe: { total_value: b.total_value ?? null, order_count: b.order_count ?? null },
      negocio_id: null,
      negocio_nome: null,
    });
  }

  items.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
  return items;
}

async function toolDossieCliente(db: ReturnType<typeof createClient>, args: { client_id?: string }) {
  const clientId = (args.client_id || '').trim();
  if (!clientId) return 'Informe o client_id (use buscar_cliente primeiro).';

  const { client, leads } = await fetchClientAndLeads(db, clientId);
  if (!client) return `Nenhum cliente com id ${clientId}.`;

  const timeline = await fetchTimeline(db, clientId, leads);
  const ata = timeline.find((i) => i.kind === 'ata');

  const lines: string[] = [];
  lines.push(`# ${client.name}`);
  lines.push(
    `${client.city || '?'}/${client.state || '?'} · CNPJ ${client.cnpj || '—'} · ${client.category || ''} · ${leads.length} negócio(s) no funil`.trim(),
  );

  lines.push('\n## Antes de ligar');
  if (ata) {
    lines.push(`- Última ata: ${ata.resumo || '(sem resumo)'}`);
    const d = ata.detalhe as Record<string, unknown>;
    if (d.proximoPasso) lines.push(`- Próximo passo combinado: ${d.proximoPasso}${d.proximoPassoData ? ` (${fmtDateBR(d.proximoPassoData)})` : ''}`);
    if (d.objecao) lines.push(`- Objeção levantada: ${d.objecao}`);
    if (d.concorrente) lines.push(`- Concorrente citado: ${d.concorrente}`);
  } else {
    lines.push('- Sem ata de visita registrada ainda.');
  }

  lines.push('\n## Negócios');
  if (leads.length === 0) {
    lines.push('Sem negócio registrado ainda pra este cliente.');
  } else {
    for (const l of leads) {
      lines.push(`- **${l.company}** — etapa \`${l.stage}\` — ${fmtBRL(l.value)}${l.probability ? ` — prob. ${l.probability}%` : ''}`);
    }
  }

  const secoes: Array<[string, string, (i: TimelineItem) => string]> = [
    ['Visitas', 'visita', (i) => `${fmtDateBR(i.ts)} — ${i.resumo}${(i.detalhe as Record<string, unknown>).destino ? ` (${(i.detalhe as Record<string, unknown>).destino})` : ''}`],
    ['Amostras enviadas', 'amostra', (i) => `${fmtDateBR(i.ts)} — ${(i.detalhe as Record<string, unknown>).notes || 'sem observação'}`],
    ['Pós-venda', 'posvenda', (i) => `${fmtDateBR(i.ts)} — ${i.resumo}`],
  ];
  for (const [titulo, kind, render] of secoes) {
    const rows = timeline.filter((i) => i.kind === kind);
    lines.push(`\n## ${titulo}`);
    lines.push(rows.length ? rows.map((r) => `- ${render(r)}`).join('\n') : 'Sem registro ainda.');
  }

  const fat = timeline.filter((i) => i.kind === 'faturamento');
  lines.push('\n## Faturamento por ano');
  lines.push(
    fat.length
      ? fat.map((f) => `- ${(f.detalhe as Record<string, unknown>).total_value ? fmtBRL((f.detalhe as Record<string, unknown>).total_value) : '—'} (${(f.detalhe as Record<string, unknown>).order_count ?? 0} pedido(s)) — ${f.resumo}`).join('\n')
      : 'Sem registro ainda.',
  );

  return lines.join('\n');
}

async function toolPrepararVisita(db: ReturnType<typeof createClient>, args: { client_id?: string; lead_id?: string }) {
  const clientId = (args.client_id || '').trim();
  if (!clientId) return 'Informe o client_id (use buscar_cliente primeiro).';

  const { client, leads } = await fetchClientAndLeads(db, clientId);
  if (!client) return `Nenhum cliente com id ${clientId}.`;
  if (leads.length === 0) return `${client.name} ainda não tem negócio aberto registrado — não há o que preparar por enquanto.`;

  let lead = args.lead_id ? leads.find((l) => l.id === args.lead_id) : undefined;
  if (!lead) {
    if (!args.lead_id && leads.length > 1) {
      const opts = leads.map((l) => `- **${l.company}** (\`${l.id}\`) — etapa ${l.stage}`).join('\n');
      return `${client.name} tem mais de um negócio aberto — chame de novo com um lead_id:\n\n${opts}`;
    }
    lead = leads[0];
  }

  const timeline = await fetchTimeline(db, clientId, [lead]);
  const ata = timeline.find((i) => i.kind === 'ata' && i.negocio_id === lead!.id);

  const { data: signals } = await db
    .from('market_signals')
    .select('title, excerpt, url, urgency, detected_at')
    .eq('company_id', lead.company_id as string)
    .order('detected_at', { ascending: false })
    .limit(15);

  const { data: cps } = await db
    .from('client_products')
    .select('product_id, price, active')
    .eq('client_id', clientId);
  let produtos: Array<{ nome: string; sku: string; preco_tabela: unknown; preco_negociado: unknown; margem_minima_pct: unknown; margem_aviso_pct: unknown }> = [];
  if (cps && cps.length > 0) {
    const productIds = cps.map((c) => c.product_id as string);
    const { data: products } = await db.from('products').select('id, name, sku, preco_tabela, company_id').in('id', productIds);
    const { data: rules } = await db.from('margin_rules').select('product_id, company_id, margem_minima_pct, margem_aviso_pct, active').in('product_id', productIds);
    produtos = cps.map((cp) => {
      const p = (products || []).find((x) => x.id === cp.product_id);
      const r = (rules || []).find((x) => x.product_id === cp.product_id && x.active);
      return {
        nome: (p?.name as string) || '(produto não encontrado)',
        sku: (p?.sku as string) || '',
        preco_tabela: p?.preco_tabela,
        preco_negociado: cp.price,
        margem_minima_pct: r?.margem_minima_pct,
        margem_aviso_pct: r?.margem_aviso_pct,
      };
    });
  }

  const lines: string[] = [];
  lines.push(`# Pauta — ${client.name}`);
  lines.push(`${lead.company} · etapa **${lead.stage}** · ${fmtBRL(lead.value)}${lead.probability ? ` · prob. ${lead.probability}%` : ''}`);

  lines.push('\n## Última ata');
  if (ata) {
    lines.push(`(${fmtDateBR(ata.ts)}) ${ata.resumo || ''}`);
    const d = ata.detalhe as Record<string, unknown>;
    if (d.proximoPasso) lines.push(`Próximo passo: ${d.proximoPasso}${d.proximoPassoData ? ` (${fmtDateBR(d.proximoPassoData)})` : ''}`);
    if (d.objecao) lines.push(`Objeção: ${d.objecao}`);
    if (d.dor) lines.push(`Dor identificada: ${d.dor}`);
    if (d.concorrente) lines.push(`Concorrente citado: ${d.concorrente}`);
  } else {
    lines.push('Ainda não tem ata registrada pra este negócio.');
  }

  lines.push('\n## Sinal de mercado');
  lines.push(
    `Setor do cliente: ${lead.sector || '(não preenchido)'}. Sinais gerais da empresa (${lead.company_id}) — leia e cite só o que realmente conversa com esse setor, o banco não tem essa relação estruturada:`,
  );
  lines.push(
    (signals || []).length
      ? (signals || []).map((s) => `- [${s.urgency}] ${s.title} — ${s.excerpt}${s.url ? ` (${s.url})` : ''} — ${fmtDateBR(s.detected_at)}`).join('\n')
      : 'Nenhum sinal de mercado registrado pra esta empresa ainda.',
  );

  lines.push('\n## Produto e margem');
  if (produtos.length === 0) {
    lines.push('Nenhum produto liberado pra este cliente ainda — não negocie preço sem confirmar com o financeiro.');
  } else {
    for (const p of produtos) {
      const piso =
        typeof p.preco_tabela === 'number' && typeof p.margem_minima_pct === 'number'
          ? fmtBRL(p.preco_tabela * (1 - p.margem_minima_pct / 100))
          : null;
      lines.push(
        `- **${p.nome}** (${p.sku}) — preço negociado: ${fmtBRL(p.preco_negociado)}${p.preco_tabela ? ` · tabela: ${fmtBRL(p.preco_tabela)}` : ''}${piso ? ` · piso de margem: ${piso}` : ' · sem regra de margem cadastrada'}`,
      );
    }
  }

  return lines.join('\n');
}

async function callTool(db: ReturnType<typeof createClient>, name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'buscar_cliente':
      return toolBuscarCliente(db, args as { query?: string });
    case 'dossie_cliente':
      return toolDossieCliente(db, args as { client_id?: string });
    case 'preparar_visita':
      return toolPrepararVisita(db, args as { client_id?: string; lead_id?: string });
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}

// ------------------------------------------------------------------
// Envelope JSON-RPC 2.0 — só os métodos que um servidor MCP somente-
// leitura, sem sessão com estado, precisa responder.
// ------------------------------------------------------------------
function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function handleRpc(db: ReturnType<typeof createClient>, msg: Record<string, unknown>) {
  const { id, method, params } = msg as { id: unknown; method: string; params?: Record<string, unknown> };

  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    // Notificação — sem resposta.
    return null;
  }

  if (method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: (params?.protocolVersion as string) || PROTOCOL_FALLBACK,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  }

  if (method === 'ping') return rpcResult(id, {});

  if (method === 'tools/list') return rpcResult(id, { tools: TOOLS });

  if (method === 'tools/call') {
    const name = String(params?.name || '');
    const args = (params?.arguments || {}) as Record<string, unknown>;
    try {
      const text = await callTool(db, name, args);
      logToolCall(name, args, true);
      return rpcResult(id, { content: [{ type: 'text', text }] });
    } catch (err) {
      logToolCall(name, args, false);
      const message = err instanceof Error ? err.message : String(err);
      // Nunca vaza detalhe de SQL/stack — só a mensagem já pensada pra
      // leitura humana que as funções de ferramenta lançam.
      return rpcResult(id, { content: [{ type: 'text', text: `Erro ao consultar: ${message}` }], isError: true });
    }
  }

  return rpcError(id, -32601, `Método não suportado: ${method}`);
}

Deno.serve(async (req: Request) => {
  // CORS preflight nunca leva auth (é assim que o navegador manda OPTIONS
  // por padrão) — mas não devolve dado nenhum, só os headers.
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // Autenticação antes de qualquer outra coisa — inclusive o GET de
  // identificação. Achado da revisão de segurança de 15/08/2026: o GET
  // sem token confirmava pra qualquer request não-autenticado que o
  // servidor existe (reconhecimento mínimo, mas sem necessidade). Token
  // fixo (conexão única, nível admin), checado em tempo constante.
  const expected = Deno.env.get('SANWEY_MCP_TOKEN');
  const authHeader = req.headers.get('authorization') || '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!expected) {
    return new Response(JSON.stringify({ error: 'Servidor sem SANWEY_MCP_TOKEN configurado.' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  if (!provided || !timingSafeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ name: SERVER_INFO.name, version: SERVER_INFO.version, protocol: 'mcp', transport: 'streamable-http (somente POST)' }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify(rpcError(null, -32700, 'JSON inválido')), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Batch (array de mensagens) é opcional na spec — suportado por
  // completude; a maioria dos clientes manda uma mensagem por vez.
  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const m of messages) {
    try {
      const r = await handleRpc(db, m as Record<string, unknown>);
      if (r !== null) responses.push(r);
    } catch {
      // Item malformado no lote (ex.: null, primitivo) — achado da revisão
      // de segurança de 15/08/2026: sem isto, uma mensagem inválida
      // derrubava a resposta inteira em vez de virar um erro JSON-RPC.
      responses.push(rpcError(null, -32600, 'Mensagem inválida'));
    }
  }

  if (responses.length === 0) {
    // Só notificação(ões) — nada a responder.
    return new Response(null, { status: 202, headers: CORS });
  }

  const payload = Array.isArray(body) ? responses : responses[0];
  return new Response(JSON.stringify(payload), { headers: { ...CORS, 'Content-Type': 'application/json' } });
});
