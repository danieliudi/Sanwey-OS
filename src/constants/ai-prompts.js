// System prompt base para todos os recursos de IA do CRM
const SYSTEM_BASE = `Você é um assistente de vendas B2B especializado.
Responda sempre em português brasileiro. Seja conciso, direto e prático.
Nunca use jargões vazios. Foque em ações concretas e contextualizadas.`;

// Recurso padrão universal (Frente 10, item 2): roda em QUALQUER Kanban da
// plataforma, mesmo os que não têm nenhum prompt de domínio próprio — só usa
// dado que todo card de todo board já tem (etapa, SLA, campos configurados
// por etapa, comentários). Ver docs/mockup "Padrão universal de IA por
// Kanban" — este é o prompt-builder que RecordAIPanel.jsx chama por padrão.
export function genericCardSummaryPrompt({ title, domainLabel, stageName, slaDays, daysInStage, customFields = [], recentComments = [] }) {
  const fieldLines = customFields.length
    ? customFields.map(f => `- ${f.label}: ${f.value ?? '—'}`).join('\n')
    : '- Nenhum campo específico preenchido nesta etapa';

  const commentLines = recentComments.length
    ? recentComments.slice(-5).map(c => `- ${c}`).join('\n')
    : '- Nenhum comentário/atividade registrada';

  const slaLine = slaDays
    ? `${daysInStage}d (SLA desta etapa: ${slaDays}d)${daysInStage > slaDays ? ' — ACIMA DO SLA' : ''}`
    : `${daysInStage}d (sem SLA configurado para esta etapa)`;

  return [
    {
      role: 'system',
      content: `Você é um assistente de gestão de fluxo de trabalho (Kanban) genérico — não conhece o domínio específico deste registro além do que for informado abaixo. Responda sempre em português brasileiro, de forma concisa e prática. Baseie-se só nos dados fornecidos, nunca invente contexto que não esteja ali.`,
    },
    {
      role: 'user',
      content: `Analise este card${domainLabel ? ` de um Kanban de ${domainLabel}` : ' de um Kanban'}:

**Título/registro:** ${title || '—'}
**Etapa atual:** ${stageName || '—'}
**Tempo nesta etapa:** ${slaLine}

**Campos preenchidos nesta etapa:**
${fieldLines}

**Últimos comentários/atividades:**
${commentLines}

Responda com exatamente 3 blocos, cada um com o título em negrito markdown:
**Situação** (1-2 frases resumindo o estado atual)
**Risco ou bloqueio** (1-2 frases — SLA estourado, campo importante vazio, sem responsável, sem atividade recente; se não houver nenhum, diga "Nenhum risco aparente")
**Sugestão de próximo passo** (1 frase, ação concreta)`,
    },
  ];
}

export function briefingPrompt(lead, activities, linkedEmails) {
  const recentActivities = (activities || [])
    .slice(-5)
    .map(a => `- ${a.body}`)
    .join('\n') || '- Nenhuma atividade registrada';

  const recentEmails = (linkedEmails || [])
    .slice(-3)
    .map(e => `- ${e.direction === 'recebido' ? '←' : '→'} ${e.subject}`)
    .join('\n') || '- Nenhum e-mail vinculado';

  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `Prepare-me para uma reunião com este lead:

**Empresa:** ${lead.company} (${lead.sector || '—'}, porte ${lead.size || '—'})
**Etapa:** ${lead.stage} | **Dias na etapa:** ${lead.stageChangedAt ? Math.floor((Date.now() - new Date(lead.stageChangedAt)) / 86400000) : '?'}d
**Valor estimado:** R$ ${lead.value?.toLocaleString('pt-BR') || '—'}
**Decisor:** ${lead.decisionMaker?.name || '—'} (${lead.decisionMaker?.role || '—'})
**Gatilho:** ${lead.triggerLabel || '—'}: ${lead.evidence || '—'}

**Histórico recente:**
${recentActivities}

**E-mails recentes:**
${recentEmails}

Forneça exatamente:
1. **3 pontos-chave** para abordar (bullet points curtos)
2. **1 objeção provável** e como responder (1-2 frases)
3. **Pergunta de abertura** sugerida (1 frase)`,
    },
  ];
}

export function emailDraftPrompt(lead, tone = 'profissional') {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `Escreva um e-mail de abordagem inicial para:

**Empresa:** ${lead.company} (${lead.sector || '—'})
**Decisor:** ${lead.decisionMaker?.name || 'responsável'} (${lead.decisionMaker?.role || '—'})
**Produto/serviço:** ${lead.skuName || '—'}
**Gatilho:** ${lead.evidence || lead.triggerLabel || '—'}
**Tom:** ${tone}

Regras:
- Máximo 120 palavras no corpo
- Sem saudações genéricas ("Espero que esteja bem")
- Referência ao gatilho específico
- Terminar com uma pergunta ou CTA claro
- Inclua assunto na primeira linha como "Assunto: ..."`,
    },
  ];
}

export function nextStepPrompt(lead, activities) {
  const daysInStage = lead.stageChangedAt
    ? Math.floor((Date.now() - new Date(lead.stageChangedAt)) / 86400000)
    : 0;

  const recentActivities = (activities || [])
    .slice(-3)
    .map(a => `- ${a.body}`)
    .join('\n') || '- Nenhuma atividade';

  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `Lead parado há ${daysInStage} dias na etapa "${lead.stage}".

**Empresa:** ${lead.company} (${lead.sector || '—'})
**Valor:** R$ ${lead.value?.toLocaleString('pt-BR') || '—'}
**Decisor:** ${lead.decisionMaker?.name || '—'}

**Últimas atividades:**
${recentActivities}

Sugira **3 próximos passos concretos e priorizados** para reativar este lead.
Para cada um: ação específica + canal + argumento de abordagem (máx 2 frases cada).`,
    },
  ];
}

export function objectionPrompt(lead, objectionText) {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `O decisor da ${lead.company} (${lead.decisionMaker?.role || '—'}, setor ${lead.sector || '—'}) disse:

"${objectionText}"

Dê **2 respostas práticas e adaptadas ao contexto**, numeradas.
Cada resposta: máx 3 frases. Seja direto, sem jargões.`,
    },
  ];
}

export function scorePrompt(lead, activities) {
  const recentActivities = (activities || [])
    .slice(-5)
    .map(a => `- ${a.body}`)
    .join('\n') || '- Nenhuma atividade registrada';

  const daysInStage = lead.stageChangedAt
    ? Math.floor((Date.now() - new Date(lead.stageChangedAt)) / 86400000)
    : 0;

  return [
    {
      role: 'system',
      content: `Você é um analista de qualificação de leads B2B. Avalie exclusivamente com base nos dados fornecidos — não presuma informação não escrita.

Retorne APENAS um JSON no formato abaixo, sem texto adicional, sem markdown, sem explicações fora do JSON:
{"score": <número de 0 a 100>, "justificativa": "<2-3 frases objetivas>"}`,
    },
    {
      role: 'user',
      content: `Avalie o potencial de conversão deste lead:

**Empresa:** ${lead.company} (${lead.sector || '—'}, porte ${lead.size || '—'})
**Capital social:** R$ ${lead.capitalSocial?.toLocaleString('pt-BR') || '—'}
**Etapa atual:** ${lead.stage} | **Dias nesta etapa:** ${daysInStage}d
**Valor estimado do negócio:** R$ ${lead.value?.toLocaleString('pt-BR') || '—'}
**Decisor identificado:** ${lead.decisionMaker?.name ? `${lead.decisionMaker.name} (${lead.decisionMaker.role || '—'})` : 'Não identificado'}
**Gatilho comercial:** ${lead.triggerLabel || '—'}: ${lead.evidence || '—'}
**Classificação atual:** ${lead.clientClassification || '—'}

**Atividades recentes:**
${recentActivities}

Considere: presença de decisor identificado, força do gatilho comercial, engajamento (atividades recentes), tempo parado na etapa e porte/capital da empresa.`,
    },
  ];
}

// Extrai dados de um documento de identificação (CNH/RG) anexado como
// imagem ou PDF em base64 (ver src/components/views/NovoColaboradorModal.jsx).
// Usado pra preencher o cadastro automaticamente — importante pra
// colaboradores que não sabem ler/escrever e não conseguem digitar os
// próprios dados.
export function documentExtractionPrompt(fileContentBlock) {
  return [
    {
      role: 'system',
      content: `Você é um assistente de RH que extrai dados de documentos de identificação brasileiros (CNH ou RG). Leia o documento anexado com atenção. Se um campo não estiver legível ou não existir no documento, retorne null para ele — nunca invente informação.

Retorne APENAS um JSON no formato abaixo, sem texto adicional, sem markdown:
{"fullName": "<nome completo ou null>", "cpf": "<apenas números ou null>", "rg": "<apenas números ou null>", "birthDate": "<AAAA-MM-DD ou null>"}`,
    },
    {
      role: 'user',
      content: [fileContentBlock, { type: 'text', text: 'Extraia os dados deste documento.' }],
    },
  ];
}

// Descrição de cargo (Onda 3, item 8): gera responsabilidades + requisitos +
// resumo a partir do que já está no catálogo (nome/depto/faixa/benefícios).
export function cargoDescriptionPrompt(cargo) {
  const benefits = Array.isArray(cargo?.benefits) ? cargo.benefits.filter(Boolean) : [];
  const faixa = (cargo?.salary_min != null || cargo?.salary_max != null)
    ? `R$ ${cargo?.salary_min?.toLocaleString("pt-BR") || "—"} a R$ ${cargo?.salary_max?.toLocaleString("pt-BR") || "—"}`
    : "não informada";
  return [
    {
      role: "system",
      content: `Você é um especialista de RH brasileiro. Escreva uma descrição de cargo objetiva e realista em português brasileiro, pronta pra usar num catálogo interno e em anúncios de vaga. Não invente exigências absurdas nem cite a faixa salarial no texto. Use linguagem clara e inclusiva.

Estruture EXATAMENTE assim, com estes títulos em negrito markdown:
**Resumo do cargo**
(2-3 frases)
**Responsabilidades**
(5 a 8 itens em lista)
**Requisitos**
(5 a 7 itens em lista, separando desejáveis de obrigatórios quando fizer sentido)`,
    },
    {
      role: "user",
      content: `Gere a descrição para o cargo:
**Cargo:** ${cargo?.name || "—"}
**Departamento:** ${cargo?.department || "—"}
**Tipo de contrato:** ${cargo?.contract_type || "—"}
**Jornada:** ${cargo?.schedule || "—"}${cargo?.shift ? ` · turno ${cargo.shift}` : ""}${cargo?.escala ? ` · escala ${cargo.escala}` : ""}
**Faixa salarial (só contexto, não citar):** ${faixa}
${benefits.length ? `**Benefícios:** ${benefits.join(", ")}` : ""}`,
    },
  ];
}

// orderHistory: outros negócios já ganhos do mesmo cliente (mesmo clientId),
// usado pra sugerir upsell/cross-sell com base no que ele já comprou.
// lineItems (Fase 1 do CPQ, opcional): [{modelLabel, quantity, unitPrice}].
// Quando presente, os valores reais substituem "[a definir]" — sem quebrar
// quem ainda chama proposalPrompt(lead, orderHistory) sem 3º argumento.
export function proposalPrompt(lead, orderHistory = [], lineItems = []) {
  const hasHistory = orderHistory.length > 0;
  const hasLineItems = lineItems.length > 0;
  const historyLines = orderHistory
    .map(l => `- ${l.skuName || l.sector || 'negócio anterior'}: R$ ${l.value?.toLocaleString('pt-BR') || '—'}`)
    .join('\n');
  const lineItemsTotal = lineItems.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const lineItemLines = lineItems
    .map(it => `- ${it.modelLabel} · ${Number(it.quantity) || 0} un × R$ ${(Number(it.unitPrice) || 0).toLocaleString('pt-BR')} = R$ ${((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)).toLocaleString('pt-BR')}`)
    .join('\n');

  return [
    {
      role: 'system',
      content: hasLineItems
        ? `Você é um redator comercial B2B. Escreva o corpo de uma proposta comercial formal em português brasileiro, pronta para ser lida pelo cliente. Não inclua saudação nem despedida com nome de remetente (isso é adicionado depois). Os itens e valores da proposta já estão definidos abaixo — use os valores reais informados, nunca escreva "[a definir]" para preço.`
        : `Você é um redator comercial B2B. Escreva o corpo de uma proposta comercial formal em português brasileiro, pronta para ser lida pelo cliente. Não inclua saudação nem despedida com nome de remetente (isso é adicionado depois). Não invente preços — deixe um campo "[a definir]" onde condições comerciais específicas seriam necessárias.`,
    },
    {
      role: 'user',
      content: `Escreva uma proposta comercial para:

**Empresa cliente:** ${lead.company} (${lead.sector || '—'}, porte ${lead.size || '—'})
**Decisor:** ${lead.decisionMaker?.name || 'responsável pela decisão'} (${lead.decisionMaker?.role || '—'})
**Necessidade identificada:** ${lead.evidence || lead.triggerLabel || 'a definir com o cliente'}
**Produto/serviço de interesse:** ${lead.skuName || '—'}
${hasLineItems
  ? `**Itens da proposta:**\n${lineItemLines}\n**Valor total:** R$ ${lineItemsTotal.toLocaleString('pt-BR')}`
  : `**Valor estimado do negócio:** R$ ${lead.value?.toLocaleString('pt-BR') || '[a definir]'}`}
**Classificação do cliente:** ${lead.clientClassification || '—'}
${hasHistory ? `\n**Negócios anteriores já fechados com este cliente:**\n${historyLines}` : ''}

Estrutura:
1. **Contexto** — 1 parágrafo curto retomando a necessidade identificada.
2. **Proposta de solução** — 1-2 parágrafos descrevendo como o produto/serviço atende essa necessidade.
3. **Condições comerciais** — ${hasLineItems ? 'apresente os itens e valores acima de forma narrativa; prazo e forma de pagamento continuam como "[a definir]".' : 'placeholder "[a definir]" para preço, prazo e forma de pagamento.'}
${hasHistory ? '4. **Oportunidade de upsell/cross-sell** — 1 parágrafo curto sugerindo produtos/serviços complementares com base no histórico de compras acima, só se fizer sentido comercial real.\n5. **Próximos passos**' : '4. **Próximos passos**'} — 1 parágrafo curto com uma chamada para ação clara.`,
    },
  ];
}

// Recebe o objeto já calculado por aggregatePipeline() (src/utils/pipeline-metrics.js)
// — a LLM só interpreta/explica números já certos, nunca faz a conta sozinha.
export function pipelineChatPrompt(question, aggregate) {
  const stageLines = aggregate.byStage
    .map(s => `- ${s.stage}: ${s.count} leads, R$ ${(s.value / 1000).toFixed(0)}k`)
    .join('\n') || '- Nenhum lead no pipeline';

  const ownerLines = aggregate.byOwner
    .slice(0, 15)
    .map(o => `- ${o.name}: ${o.count} leads | ganho R$ ${(o.valueWon / 1000).toFixed(0)}k | em aberto R$ ${(o.valueOpen / 1000).toFixed(0)}k`)
    .join('\n') || '- Nenhum responsável com leads atribuídos';

  return [
    {
      role: 'system',
      content: `${SYSTEM_BASE}

Os números abaixo já foram calculados com precisão — use-os exatamente como estão, nunca recalcule ou estime por conta própria. Se a pergunta pedir algo que não está nos dados, diga que não tem essa informação, não invente.

**Total de leads:** ${aggregate.totalLeads}
**Ganhos:** ${aggregate.wonCount} (R$ ${(aggregate.wonValue / 1000).toFixed(0)}k) | **Perdidos:** ${aggregate.lostCount}
**Taxa de conversão (ganho / (ganho + perdido)):** ${aggregate.conversionRate}%
**Valor total em aberto (pipeline ativo):** R$ ${(aggregate.openValue / 1000).toFixed(0)}k

**Por etapa:**
${stageLines}

**Por responsável (top 15 por valor ganho):**
${ownerLines}`,
    },
    { role: 'user', content: question },
  ];
}

export function forecastPrompt(leads) {
  const byStage = {};
  let totalValue = 0;
  const criticalLeads = [];

  for (const l of leads) {
    if (!byStage[l.stage]) byStage[l.stage] = { count: 0, value: 0 };
    byStage[l.stage].count++;
    byStage[l.stage].value += l.value || 0;
    totalValue += l.value || 0;
    if (l.stageChangedAt) {
      const days = Math.floor((Date.now() - new Date(l.stageChangedAt)) / 86400000);
      if (days > 21) criticalLeads.push(l.company);
    }
  }

  const stageLines = Object.entries(byStage)
    .map(([stage, d]) => `- ${stage}: ${d.count} leads, R$ ${(d.value / 1000).toFixed(0)}k`)
    .join('\n');

  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `Gere um parágrafo de forecast executivo baseado nestes dados do pipeline:

**Por etapa:**
${stageLines}

**Total:** ${leads.length} leads, R$ ${(totalValue / 1000).toFixed(0)}k potencial
**Leads críticos (>21d parados):** ${criticalLeads.length} (${criticalLeads.slice(0, 3).join(', ')}${criticalLeads.length > 3 ? '...' : ''})

Escreva 2-3 frases, tom executivo. Inclua previsão de receita realizável e principal risco.`,
    },
  ];
}

export function funnelDiagnosisPrompt(leads) {
  const stageMap = {};
  for (const l of leads) {
    if (!stageMap[l.stage]) stageMap[l.stage] = { count: 0, totalDays: 0, value: 0 };
    stageMap[l.stage].count++;
    stageMap[l.stage].value += l.value || 0;
    if (l.stageChangedAt) {
      const days = Math.floor((Date.now() - new Date(l.stageChangedAt)) / 86400000);
      stageMap[l.stage].totalDays += days;
    }
  }

  const stageLines = Object.entries(stageMap).map(([stage, d]) => {
    const avgDays = d.count > 0 ? Math.round(d.totalDays / d.count) : 0;
    return `- ${stage}: ${d.count} leads, média ${avgDays}d, R$ ${(d.value / 1000).toFixed(0)}k`;
  }).join('\n');

  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `Analise o funil de vendas e identifique gargalos:

**Dados por etapa (contagem, tempo médio, valor):**
${stageLines}

Forneça:
1. **Principal gargalo** identificado (com dados que suportam)
2. **Hipótese de causa** (1-2 frases)
3. **2 ações corretivas** concretas e priorizadas`,
    },
  ];
}

export function campaignStageSuggestionPrompt(campaign) {
  const daysInStage = campaign.stageChangedAt
    ? Math.floor((Date.now() - new Date(campaign.stageChangedAt)) / 86400000)
    : 0;

  const launchDays = campaign.launchDate
    ? Math.floor((new Date(campaign.launchDate) - Date.now()) / 86400000)
    : null;

  const checklistDone  = (campaign.approvalChecklist || []).filter(i => i.done).length;
  const checklistTotal = (campaign.approvalChecklist || []).length;

  return [
    {
      role: 'system',
      content: `Você é um especialista em marketing e gestão de campanhas.
Responda sempre em português brasileiro. Seja conciso e prático.
Analise os dados da campanha e recomende se é hora de avançar de etapa.`,
    },
    {
      role: 'user',
      content: `Analise esta campanha e recomende a próxima ação:

**Nome:** ${campaign.name || '—'}
**Etapa atual:** ${campaign.stage || '—'}
**Dias nesta etapa:** ${daysInStage}d
**Canal:** ${campaign.channel || '—'}
**KPI principal:** ${campaign.kpi || '—'}
**Orçamento:** R$ ${campaign.budget?.toLocaleString('pt-BR') || '—'}
**Lançamento:** ${launchDays !== null ? (launchDays > 0 ? `em ${launchDays} dias` : `${Math.abs(launchDays)} dias atrás`) : '—'}
**Checklist de aprovação:** ${checklistTotal > 0 ? `${checklistDone}/${checklistTotal} itens concluídos` : 'Não configurado'}
**Agência:** ${campaign.agencyName || '—'}
**Score de performance:** ${campaign.performanceScore > 0 ? `${campaign.performanceScore}/100` : '—'}

Responda com:
1. **Diagnóstico** (1-2 frases sobre o estado atual)
2. **Recomendação** (avançar / manter / retroceder — justificativa em 1-2 frases)
3. **Próximo passo** (ação concreta antes de mover — 1 frase)`,
    },
  ];
}

export function deliverableStageSuggestionPrompt(item) {
  const daysInStage = item.stageChangedAt
    ? Math.floor((Date.now() - new Date(item.stageChangedAt)) / 86400000)
    : 0;

  const deadlineDays = item.deadline
    ? Math.floor((new Date(item.deadline) - Date.now()) / 86400000)
    : null;

  const stageData = item.stageData?.[item.stage] || {};

  return [
    {
      role: 'system',
      content: `Você é um especialista em gestão de entregas e produção criativa.
Responda sempre em português brasileiro. Seja conciso e prático.`,
    },
    {
      role: 'user',
      content: `Analise esta entrega e recomende a próxima ação:

**Título:** ${item.title || '—'}
**Etapa atual:** ${item.stage || '—'}
**Dias nesta etapa:** ${daysInStage}d
**Prioridade:** ${item.priority || '—'}
**Prazo:** ${deadlineDays !== null ? (deadlineDays > 0 ? `${deadlineDays} dias restantes` : `atrasado ${Math.abs(deadlineDays)} dias`) : '—'}
**Tipo de solicitação:** ${stageData.request_type || item.requestType || '—'}
**Progresso de produção:** ${stageData.production_progress !== undefined ? `${stageData.production_progress}%` : '—'}
**Status revisão:** ${stageData.revision_status || '—'}

Responda com:
1. **Diagnóstico** (1-2 frases sobre o estado atual)
2. **Recomendação** (avançar / manter / retroceder — justificativa em 1-2 frases)
3. **Próximo passo** (ação concreta antes de mover — 1 frase)`,
    },
  ];
}

// Lê um comprovante de despesa (foto ou PDF) e extrai valor/data/fornecedor
// — usado pra pré-preencher o formulário de despesa e, depois, pro gestor
// comparar o que a IA leu com o que o vendedor digitou.
export function receiptExtractionPrompt(fileContentBlock) {
  return [
    {
      role: 'system',
      content: `Você é um assistente que extrai dados de comprovantes de despesa (recibo, nota fiscal, cupom) brasileiros. Leia o documento anexado com atenção. Se um campo não estiver legível ou não existir, retorne null — nunca invente informação.

Retorne APENAS um JSON no formato abaixo, sem texto adicional, sem markdown:
{"valor": <número em reais ou null>, "data": "<AAAA-MM-DD ou null>", "fornecedor": "<nome do estabelecimento ou null>", "categoria_sugerida": "<uma de: Combustível, Hospedagem, Alimentação, Pedágio, Transporte, Outros>"}`,
    },
    {
      role: 'user',
      content: [fileContentBlock, { type: 'text', text: 'Extraia os dados deste comprovante.' }],
    },
  ];
}

// Cruza o planejamento mensal de visitas com o que foi de fato realizado e
// com as despesas lançadas — o objetivo é substituir a conferência manual,
// vendedor por vendedor, que o gestor faz hoje. registros/despesas já vêm
// filtrados por vendedor+mês; a IA só aponta divergências, não recalcula nada.
export function viagemCrossCheckPrompt(vendedorNome, mesReferencia, registros, despesas) {
  const registrosLines = registros.map(r =>
    `- [${r.status}] Planejado: ${r.destino_planejado} em ${r.data_planejada} — objetivo: ${r.objetivo || '—'}` +
    (r.status !== 'planejado' ? ` | Realizado: ${r.destino_realizado || r.destino_planejado} em ${r.data_realizada || '—'} — resumo: ${r.resumo_realizado || '—'}${r.motivo_divergencia ? ` — motivo da divergência: ${r.motivo_divergencia}` : ''}` : '')
  ).join('\n') || '(nenhuma visita planejada neste mês)';

  const despesasLines = despesas.map(d => {
    const ia = d.ia_extraido || {};
    const iaNote = (ia.valor != null && Number(ia.valor) !== Number(d.valor))
      ? ` ⚠ comprovante lido pela IA mostra R$ ${ia.valor}, divergente do valor lançado`
      : '';
    return `- ${d.categoria}: R$ ${d.valor} em ${d.data_despesa} (status: ${d.status_reembolso})${d.registro_id ? ' — vinculada a uma visita' : ' — despesa avulsa, sem visita vinculada'}${iaNote}`;
  }).join('\n') || '(nenhuma despesa lançada neste mês)';

  return [
    {
      role: 'system',
      content: `Você é um analista que ajuda um gestor comercial a revisar rapidamente o que um vendedor planejou e o que de fato executou num mês, incluindo despesas de reembolso. Seja direto e objetivo — o gestor não tem tempo de ler um relatório longo. Responda em português brasileiro.`,
    },
    {
      role: 'user',
      content: `Vendedor: ${vendedorNome}
Mês de referência: ${mesReferencia}

VISITAS PLANEJADAS x REALIZADAS:
${registrosLines}

DESPESAS LANÇADAS:
${despesasLines}

Responda com:
1. **Taxa de cumprimento** — quantas visitas planejadas foram de fato realizadas (número e %).
2. **Pontos de atenção** — liste objetivamente: visitas planejadas e não realizadas sem justificativa clara; visitas realizadas que não estavam no plano; despesas sem visita vinculada; despesas com valor divergente do comprovante lido pela IA. Se não houver nenhum, diga "Nenhum ponto de atenção identificado".
3. **Recomendação** — 1-2 frases sobre se esse mês do vendedor parece consistente ou precisa de conversa direta.`,
    },
  ];
}
