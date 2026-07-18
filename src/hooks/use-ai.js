import { useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useOrgAIStatus } from "./use-org-ai-status";

async function callDirect(provider, model, apiKey, messages, maxTokens) {
  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Erro OpenAI');
    return data.choices[0]?.message?.content || '';
  }
  if (provider === 'gemini') {
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');
    const body = {
      contents: userMsgs.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    };
    if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Erro Gemini');
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  throw new Error(`Provider "${provider}" requer proxy server-side. Configure Supabase.`);
}

async function callViaEdge(provider, model, apiKey, messages, maxTokens) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado. Use OpenAI ou Gemini.');
  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: { provider, model, apiKey, messages, maxTokens },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data?.content || '';
}

// Chamada única de IA usada tanto pelo uso real (useAI) quanto pelo botão
// "Testar conexão" em Configurações. A chave de API nunca sai do browser
// quando o Supabase está configurado — sempre passa pela edge function
// ai-assistant, independente do provedor. Só cai pro fetch direto (chave
// exposta no cliente) quando não há Supabase disponível pra fazer de proxy.
export async function callAI(provider, model, apiKey, messages, maxTokens) {
  if (isSupabaseConfigured) return callViaEdge(provider, model, apiKey, messages, maxTokens);
  return callDirect(provider, model, apiKey, messages, maxTokens);
}

// Fallback org-wide: quando o usuário não tem chave pessoal salva, mas a
// empresa configurou uma chave própria (secrets AI_ORG_* no projeto
// Supabase, só acessível pela edge function — nunca chega no cliente),
// os recursos de IA continuam funcionando sem o usuário precisar criar
// conta em provedor nenhum. Chave pessoal, quando presente, tem prioridade.
export function useAI(currentUser) {
  const aiConfig = currentUser?.aiConfig;
  const hasPersonalConfig = Boolean(aiConfig?.provider && aiConfig?.apiKey && aiConfig?.model);
  const orgConfigured = useOrgAIStatus();
  const isConfigured = hasPersonalConfig || (isSupabaseConfigured && orgConfigured);

  const complete = useCallback(async (messages, { maxTokens = 1200 } = {}) => {
    if (!isConfigured) throw new Error('Configure sua LLM nas Configurações → Integrações de IA (ou peça a um admin pra configurar a chave da empresa).');
    if (hasPersonalConfig) {
      const { provider, model, apiKey } = aiConfig;
      return callAI(provider, model, apiKey, messages, maxTokens);
    }
    // Sem chave pessoal: usa o fallback org-wide (edge function resolve
    // provider/model/apiKey a partir dos secrets do projeto).
    return callAI(null, null, null, messages, maxTokens);
  }, [aiConfig, hasPersonalConfig, isConfigured]);

  return { complete, isConfigured, provider: aiConfig?.provider, model: aiConfig?.model };
}
