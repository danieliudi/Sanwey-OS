import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

const TABLE = "rh_ferias";
const SELECT = "*, approver:approved_by(name)";

export function useRHFeriasRequests({ enabled = true } = {}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLE)
      .select(SELECT)
      .order("created_at", { ascending: false });
    if (!error) setRequests(data || []);
    setLoading(false);
  }, [enabled]);

  useEffect(() => { if (enabled) fetchAll(); else setLoading(false); }, [fetchAll, enabled]);

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const channelName = `rh_ferias_rt_${Math.random().toString(36).slice(2, 9)}`;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, debouncedFetchAll)
      .subscribe();
    return () => { debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [enabled, fetchAll]);

  const createRequest = useCallback(async (data) => {
    const { data: novo, error } = await supabase
      .from(TABLE)
      .insert(data)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    setRequests(prev => [novo, ...prev]);
    return novo;
  }, []);

  // Mover card entre etapas do Kanban (pendente/aprovado/recusado).
  // approvedBy/approvedAt são preenchidos só ao entrar em aprovado/recusado.
  //
  // Decisão de fila compartilhada (27/08/2026): quando a etapa de destino é
  // aprovado/recusado, isto é uma DECISÃO — precisa da mesma trava de
  // concorrência que Compras/Cotações já têm no banco ("Solicitação já foi
  // decidida"). Sem isso, dois gerentes com o drawer aberto ao mesmo tempo
  // podiam sobrescrever a decisão um do outro, e o segundo via a mensagem
  // genérica de "sem permissão" mesmo tendo permissão de sobra — só chegou
  // tarde. `.eq("status", ...)` faz o UPDATE não casar nenhuma linha quando
  // o status já mudou; refetchOnConflict devolve o registro atual pra quem
  // chamou poder mostrar quem decidiu, em vez de só falhar.
  // O check-consistencia acusa `update-sem-select` aqui, mas é falso
  // positivo: ele lê o statement `supabase.from(TABLE).update(patch).eq(...)`
  // isolado, e o `.select(SELECT)` está na linha do `await query.select(...)`
  // logo abaixo, porque a cadeia é montada em duas etapas (o `.eq("status")`
  // é condicional). A checagem de linha afetada que a regra quer JÁ existe,
  // e aqui ela é ainda mais rica: zero linha não vira erro genérico, vira o
  // refetchOnConflict que mostra quem decidiu antes. Segue na linha de base.
  const changeStatus = useCallback(async (id, status, extra = {}, { expectedStatus } = {}) => {
    const patch = { status, status_changed_at: new Date().toISOString(), ...extra };
    let query = supabase.from(TABLE).update(patch).eq("id", id);
    if (expectedStatus) query = query.eq("status", expectedStatus);
    const { data, error } = await query.select(SELECT);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      if (expectedStatus) {
        const { data: atual } = await supabase.from(TABLE).select(SELECT).eq("id", id).maybeSingle();
        if (atual) {
          setRequests(prev => prev.map(r => r.id === id ? atual : r));
          if (atual.status !== expectedStatus) {
            // Pipelines de férias podem ter mais etapas além de
            // pendente/aprovado/recusado (ex.: "em análise") — o fallback
            // genérico evita afirmar "recusado" quando na verdade foi
            // movido pra uma etapa custom qualquer.
            const quemDecidiu = atual.approver?.name || "outra pessoa";
            const mensagem =
              atual.status === "pendente" ? "Este pedido voltou a ficar pendente — confira antes de decidir de novo."
              : atual.status === "aprovado" ? `Este pedido já foi aprovado por ${quemDecidiu}.`
              : atual.status === "recusado" ? `Este pedido já foi recusado por ${quemDecidiu}.`
              : `Este pedido já foi movido para outra etapa por ${quemDecidiu}.`;
            const err = new Error(mensagem);
            err.current = atual;
            throw err;
          }
        }
      }
      throw new Error("Não foi possível salvar — sem permissão pra editar este pedido de férias.");
    }
    setRequests(prev => prev.map(r => r.id === id ? data[0] : r));
    return data[0];
  }, []);

  const updateCustomFields = useCallback(async (id, customFields) => {
    const { data, error } = await supabase.from(TABLE).update({ custom_fields: customFields }).eq("id", id).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar este pedido de férias.");
    setRequests(prev => prev.map(r => r.id === id ? { ...r, custom_fields: customFields } : r));
  }, []);

  // "Duplicar card" — cria uma NOVA solicitação para o mesmo colaborador
  // (user_id é quem o afastamento é PARA, não um autor/criador — precisa ir
  // junto, senão a cópia não tem dono). Sem campo de título/nome nesse
  // domínio (o card mostra o nome do colaborador, resolvido client-side via
  // useRHColaboradores, não uma coluna própria) — não há onde aplicar o
  // sufixo "(cópia)" da regra geral. `firstStatus` vem de quem chama
  // (RHFeriasView conhece as etapas de rh_pipeline_stages, domain "ferias").
  const duplicateRequest = useCallback(async (source, firstStatus) => {
    return createRequest({
      user_id: source.user_id,
      type: source.type,
      start_date: source.start_date,
      end_date: source.end_date,
      notes: source.notes,
      custom_fields: source.custom_fields || {},
      status: firstStatus,
      // NÃO copiar: approved_by, approved_at, status_changed_at, activities.
    });
  }, [createRequest]);

  const deleteRequest = useCallback(async (id) => {
    // .select() força retornar a linha apagada — sem isso, RLS que não casa
    // nenhuma linha responde error:null (0 linhas afetadas), e o card sumia
    // da UI sem o registro ter sido de fato removido no banco (reaparecia no F5).
    const { data, error } = await supabase.from(TABLE).delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível excluir — sem permissão ou já removido.");
    setRequests(prev => prev.filter(r => r.id !== id));
  }, []);

  const addActivity = useCallback(async (id, entry) => {
    const current = requests.find(r => r.id === id);
    if (!current) return;
    const nextActivities = [...(Array.isArray(current.activities) ? current.activities : []), entry];
    const { data, error } = await supabase.from(TABLE).update({ activities: nextActivities }).eq("id", id).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar este pedido de férias.");
    setRequests(prev => prev.map(r => r.id === id ? { ...r, activities: nextActivities } : r));
  }, [requests]);

  const updateActivity = useCallback(async (id, activityId, patch) => {
    const current = requests.find(r => r.id === id);
    if (!current) return;
    const nextActivities = (Array.isArray(current.activities) ? current.activities : [])
      .map(a => (a.id === activityId ? { ...a, ...patch } : a));
    const { data, error } = await supabase.from(TABLE).update({ activities: nextActivities }).eq("id", id).select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar este pedido de férias.");
    setRequests(prev => prev.map(r => r.id === id ? { ...r, activities: nextActivities } : r));
  }, [requests]);

  return { requests, loading, createRequest, changeStatus, updateCustomFields, duplicateRequest, deleteRequest, addActivity, updateActivity, refetch: fetchAll };
}
