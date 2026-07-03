// System prompt base para todos os recursos de IA do CRM
const SYSTEM_BASE = `Você é um assistente de vendas B2B especializado.
Responda sempre em português brasileiro. Seja conciso, direto e prático.
Nunca use jargões vazios. Foque em ações concretas e contextualizadas.`;

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

export function proposalPrompt(lead) {
  return [
    {
      role: 'system',
      content: `Você é um redator comercial B2B. Escreva o corpo de uma proposta comercial formal em português brasileiro, pronta para ser lida pelo cliente. Não inclua saudação nem despedida com nome de remetente (isso é adicionado depois). Não invente preços — deixe um campo "[a definir]" onde condições comerciais específicas seriam necessárias.`,
    },
    {
      role: 'user',
      content: `Escreva uma proposta comercial para:

**Empresa cliente:** ${lead.company} (${lead.sector || '—'}, porte ${lead.size || '—'})
**Decisor:** ${lead.decisionMaker?.name || 'responsável pela decisão'} (${lead.decisionMaker?.role || '—'})
**Necessidade identificada:** ${lead.evidence || lead.triggerLabel || 'a definir com o cliente'}
**Produto/serviço de interesse:** ${lead.skuName || '—'}
**Valor estimado do negócio:** R$ ${lead.value?.toLocaleString('pt-BR') || '[a definir]'}

Estrutura:
1. **Contexto** — 1 parágrafo curto retomando a necessidade identificada.
2. **Proposta de solução** — 1-2 parágrafos descrevendo como o produto/serviço atende essa necessidade.
3. **Condições comerciais** — placeholder "[a definir]" para preço, prazo e forma de pagamento.
4. **Próximos passos** — 1 parágrafo curto com uma chamada para ação clara.`,
    },
  ];
}

export function pipelineChatPrompt(question, leads, users) {
  const summary = summarizeLeads(leads, users);
  return [
    {
      role: 'system',
      content: `${SYSTEM_BASE}

Você tem acesso aos dados do pipeline de vendas abaixo. Responda perguntas sobre eles com precisão.
Ao citar números, use os dados reais fornecidos. Se não souber, diga que não tem essa informação.

**Dados do pipeline:**
${summary}`,
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
**Budget:** R$ ${campaign.budget?.toLocaleString('pt-BR') || '—'}
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

function summarizeLeads(leads, users) {
  const lines = leads.slice(0, 50).map(l => {
    const owner = users?.find(u => u.id === l.owner);
    const days = l.stageChangedAt ? Math.floor((Date.now() - new Date(l.stageChangedAt)) / 86400000) : 0;
    return `${l.company} | ${l.sector || '—'} | ${l.stage} | R$${Math.round((l.value || 0) / 1000)}k | ${days}d | ${owner?.name || 'sem responsável'}`;
  });
  return `Total: ${leads.length} leads\nColunas: Empresa | Setor | Etapa | Valor | Dias na etapa | Responsável\n` + lines.join('\n');
}
