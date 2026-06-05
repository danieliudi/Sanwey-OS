import { useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

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

export function useAI(currentUser) {
  const aiConfig = currentUser?.aiConfig;
  const isConfigured = Boolean(aiConfig?.provider && aiConfig?.apiKey && aiConfig?.model);

  const complete = useCallback(async (messages, { maxTokens = 1200 } = {}) => {
    if (!isConfigured) throw new Error('Configure sua LLM nas Configurações → Integrações de IA.');
    const { provider, model, apiKey } = aiConfig;
    if (provider === 'anthropic') return callViaEdge(provider, model, apiKey, messages, maxTokens);
    return callDirect(provider, model, apiKey, messages, maxTokens);
  }, [aiConfig, isConfigured]);

  return { complete, isConfigured, provider: aiConfig?.provider, model: aiConfig?.model };
}
