import { createClient } from 'jsr:@supabase/supabase-js@2';

// ============================================================
// caso-prospeccao-voz — Edge Function
//
// Caso de prospecção comercial por voz: recebe o CAMINHO de um áudio já no
// Storage (ou um texto digitado), devolve a transcrição e um rascunho
// estruturado do que a IA entendeu sobre o caso (ganhamos/perdemos/
// andamento) — munição pro playbook de vendas. NÃO grava nada — quem grava
// é a tela, com o aceite do vendedor, pelo caminho normal do CRM (RLS do
// usuário). Clone estrutural de crm-ata-voz — mesmo padrão, schema
// diferente. Ver o cabeçalho daquele arquivo pro racional completo; resumo:
//
//  1. Esta function NÃO usa service_role em lugar nenhum. Igual à ata de
//     voz, o áudio é baixado com o JWT de quem chamou, então a RLS do
//     Storage decide se aquela pessoa pode ler aquele arquivo.
//  2. Ela não escreve no banco. Uma IA que propõe e uma tela que grava com
//     aceite explícito é o mesmo padrão do Time de Agentes — impede
//     transcrição errada de virar "fato" no playbook de vendas.
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET = 'lead-attachments';
const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // teto do envio inline dos provedores

// O esquema que a IA tem que devolver. Vive aqui, e não no frontend, pra que
// a tela de conferência e o prompt nunca saiam de sincronia.
const SCHEMA_HINT = `{
  "cliente_nome": "string",
  "setor": "string ou null",
  "resultado": "ganhamos | perdemos | andamento | null",
  "situacao": "string — 2 a 4 frases, o que aconteceu",
  "sinais": "string ou null — o que surpreendeu, o que só apareceu na visita ou na conversa",
  "licao": "string ou null — o que isso ensina pra um vendedor novo nessa situação"
}`;

function systemPrompt(ctx: Record<string, unknown>): string {
  const linhas = [
    ctx.company ? `Cliente/prospect já identificado: ${ctx.company}` : null,
    ctx.hoje ? `Data de hoje: ${ctx.hoje}` : null,
  ].filter(Boolean).join('\n');

  return `Você organiza casos de prospecção comercial do Grupo Sanwey, que fabrica embalagens industriais (big bags, embalagens homologadas para resíduo perigoso) e vende para indústria, mineração, agro e química.

Contexto do atendimento:
${linhas || '(sem contexto adicional)'}

Você vai receber o relato do vendedor logo depois de uma visita, ligação ou negociação — fala espontânea, sem roteiro, com ruído, gíria e frases cortadas — contando um caso real (ganho, perdido ou ainda em andamento) pra virar munição de treinamento pra outros vendedores. Sua tarefa é devolver EXCLUSIVAMENTE um objeto JSON neste formato:

${SCHEMA_HINT}

Regras que não podem ser quebradas:
- Se algo não foi dito, o campo vai como null. NUNCA deduza, complete ou invente. Registro comercial errado é pior que registro faltando.
- "cliente_nome": se já veio identificado no contexto acima, use exatamente esse nome. Senão, extraia do relato como foi dito — sem corrigir para um nome que você "conhece".
- "resultado" reflete o que REALMENTE aconteceu no negócio (ganhamos/perdemos/andamento), não o otimismo ou a frustração do vendedor ao contar.
- "situacao" é o resumo factual do que aconteceu — 2 a 4 frases, sem opinião.
- "sinais" é o que surpreendeu ou só ficou claro na hora — uma objeção inesperada, um critério de decisão que não estava mapeado, algo do concorrente. Se o relato não tiver nada assim, null — não repita a "situacao" aqui.
- "licao" é o ensinamento prático pra um vendedor novo que encontrar uma situação parecida — não um resumo do caso de novo. Se não der pra extrair uma lição clara e específica, null.
- Nomes próprios e de empresas: transcreva como foram ditos, sem corrigir para nomes que você conhece.
- Responda com o JSON puro, sem cercas de código e sem texto antes ou depois.`;
}

// Mesma máscara de CPF do crm-ata-voz (GAP 3, 18/08/2026) — duplicada aqui
// pelo mesmo motivo: este arquivo chama fetch direto pros providers, sem
// passar por callAIProvider. Só mascara o texto mandado pro modelo de
// ESTRUTURAÇÃO (segundo passo); a transcrição devolvida pro vendedor
// conferir na tela continua completa, protegida por RLS.
function isValidCPF(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  let check1 = 11 - (sum % 11);
  if (check1 >= 10) check1 = 0;
  if (check1 !== parseInt(digits[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  let check2 = 11 - (sum % 11);
  if (check2 >= 10) check2 = 0;
  return check2 === parseInt(digits[10], 10);
}

function maskCPF(text: string): string {
  let masked = text.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, (m) => (isValidCPF(m.replace(/\D/g, "")) ? "[CPF removido]" : m));
  masked = masked.replace(/\b\d{11}\b/g, (m) => (isValidCPF(m) ? "[CPF removido]" : m));
  return masked;
}

function parseModelJson(raw: string): Record<string, unknown> {
  let s = (raw || '').trim();
  // Modelos às vezes devolvem cercado por ```json apesar da instrução.
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last > first) s = s.slice(first, last + 1);
  return JSON.parse(s);
}

// ── OpenAI: Whisper transcreve, depois o modelo de texto estrutura ─────────
async function viaOpenAI(opts: {
  model: string; apiKey: string; system: string;
  audio?: { bytes: Uint8Array; mimeType: string; filename: string }; text?: string;
}): Promise<{ transcript: string; structured: Record<string, unknown> }> {
  let transcript = opts.text || '';

  if (opts.audio) {
    const form = new FormData();
    form.append('file', new Blob([opts.audio.bytes], { type: opts.audio.mimeType }), opts.audio.filename);
    form.append('model', 'whisper-1');
    form.append('language', 'pt');
    const tr = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      body: form,
    });
    const td = await tr.json();
    if (!tr.ok) throw new Error(td?.error?.message || 'Erro na transcrição (Whisper)');
    transcript = td.text || '';
  }

  if (!transcript.trim()) return { transcript: '', structured: {} };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: `Relato do vendedor:\n\n${maskCPF(transcript)}\n\nDevolva o JSON pedido.` },
      ],
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || 'Erro do OpenAI');
  return { transcript, structured: parseModelJson(d.choices?.[0]?.message?.content || '') };
}

// ── Anthropic: estrutura texto muito bem, mas não recebe áudio ────────────
async function viaAnthropic(opts: {
  model: string; apiKey: string; system: string; text: string;
}): Promise<{ transcript: string; structured: Record<string, unknown> }> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 1200,
      system: opts.system,
      messages: [{ role: 'user', content: `Relato do vendedor:\n\n${maskCPF(opts.text)}\n\nDevolva o JSON pedido.` }],
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || 'Erro do Anthropic');
  return { transcript: opts.text, structured: parseModelJson(d.content?.[0]?.text || '') };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  // Cliente com o JWT de quem chamou — nunca service_role (ver cabeçalho).
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

  // Mesma trilha de auditoria mínima do crm-ata-voz — só metadados, nunca
  // conteúdo. Sem prompt/completion_tokens (Whisper não devolve usage).
  const t0 = Date.now();
  try {
    const body = await req.json();
    const audioPath: string | undefined = body.audioPath;
    // Áudio ainda não gravado no Storage — caso do botão solto (sem cliente
    // formal ainda), onde não há lead_id/client_id pra escopar o upload
    // antes de transcrever. Sem risco de vazamento: quem manda os bytes é o
    // dono deles, não um caminho apontando pro arquivo de outra pessoa.
    const audioInline: string | undefined = body.audioBase64;
    const textoDigitado: string | undefined = body.text;
    if (!audioPath && !audioInline && !textoDigitado?.trim()) {
      return json({ error: 'Envie audioPath, audioBase64 ou text.' }, 400);
    }
    const temAudio = Boolean(audioPath || audioInline);

    // Chave: pessoal (mandada pela tela, mesmo mecanismo do ai-assistant/
    // crm-ata-voz) com queda pra chave da empresa nos secrets do projeto.
    const p = body.aiConfig || {};
    const provider = (p.provider || Deno.env.get('AI_ORG_PROVIDER') || '').toLowerCase();
    const apiKey   = p.apiKey   || Deno.env.get('AI_ORG_API_KEY');
    const baseModel = p.model   || Deno.env.get('AI_ORG_MODEL');
    // Permite apontar um modelo específico só pro áudio (ex.: gpt-4o-mini-transcribe)
    // sem trocar o modelo padrão do resto da plataforma — mesma env var que
    // crm-ata-voz já usa, os dois fluxos de voz compartilham a config.
    const model = (temAudio && Deno.env.get('AI_AUDIO_MODEL')) || baseModel;

    if (!provider || !apiKey || !model) {
      return json({ error: 'IA não configurada. Um admin precisa definir a chave em Configurações, ou os secrets AI_ORG_* no projeto.' }, 400);
    }

    const ctx = {
      company: body.context?.company,
      hoje:    new Date().toISOString().slice(0, 10),
    };
    const system = systemPrompt(ctx);

    // ── Só texto: OpenAI ou Anthropic resolvem ───────────────────────────
    if (!temAudio) {
      const texto = textoDigitado!.trim();
      const out = provider === 'openai'    ? await viaOpenAI({ model, apiKey, system, text: texto })
                : provider === 'anthropic' ? await viaAnthropic({ model, apiKey, system, text: texto })
                : null;
      if (!out) return json({ error: provider === 'gemini' ? 'Gemini não é mais um provedor suportado. Use Anthropic ou OpenAI.' : `Provedor de IA desconhecido: ${provider}` }, 400);
      console.log(JSON.stringify({
        event: 'caso_prospeccao_voz_call', user_id: userData.user.id, crm_module: 'crm_casos_prospeccao',
        provider, execution_status: 'ok', latency_ms: Date.now() - t0, at: new Date().toISOString(),
      }));
      return json({ ...out, source: 'texto' });
    }

    // ── Com áudio: só a OpenAI (Whisper) recebe som hoje ─────────────────
    if (provider !== 'openai') {
      return json({
        error: provider === 'anthropic'
          ? 'O provedor configurado (Anthropic) não recebe áudio — escreva o caso em texto, ou peça a um admin pra configurar a OpenAI.'
          : 'Gemini não é mais um provedor suportado. Configure a OpenAI pra transcrição por voz, ou escreva o caso em texto.',
      }, 400);
    }

    let bytes: Uint8Array;
    let tipoBruto: string;
    if (audioPath) {
      // Download com a credencial do usuário: a RLS do Storage é quem autoriza.
      const { data: file, error: dlErr } = await userClient.storage.from(BUCKET).download(audioPath);
      if (dlErr || !file) return json({ error: 'Áudio não encontrado ou sem permissão de leitura.' }, 403);
      bytes = new Uint8Array(await file.arrayBuffer());
      tipoBruto = body.mimeType || file.type || 'audio/webm';
    } else {
      try {
        const bin = atob(audioInline!);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } catch {
        return json({ error: 'Áudio inválido.' }, 400);
      }
      tipoBruto = body.mimeType || 'audio/webm';
    }
    if (bytes.byteLength > MAX_AUDIO_BYTES) {
      return json({ error: 'Áudio longo demais para processar. Grave um caso mais curto.' }, 413);
    }
    const mimeType = tipoBruto.split(';')[0].trim();

    const out = await viaOpenAI({ model, apiKey, system, audio: { bytes, mimeType, filename: audioPath?.split('/').pop() || 'caso.webm' } });

    console.log(JSON.stringify({
      event: 'caso_prospeccao_voz_call', user_id: userData.user.id, crm_module: 'crm_casos_prospeccao',
      provider, execution_status: 'ok', latency_ms: Date.now() - t0, at: new Date().toISOString(),
    }));
    return json({ ...out, source: 'audio' });
  } catch (err) {
    console.log(JSON.stringify({
      event: 'caso_prospeccao_voz_call', user_id: userData.user.id, crm_module: 'crm_casos_prospeccao',
      provider: null, execution_status: 'error', latency_ms: Date.now() - t0, at: new Date().toISOString(),
    }));
    const message = err instanceof Error ? err.message : String(err);
    // JSON malformado do modelo é o erro mais provável em produção — vale
    // uma mensagem que diz o que fazer, não o stack do parser.
    const friendly = message.includes('JSON')
      ? 'A IA respondeu num formato inesperado. Tente gravar de novo, ou escreva o caso em texto.'
      : message;
    return json({ error: friendly }, 500);
  }
});
