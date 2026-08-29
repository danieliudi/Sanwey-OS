import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

const TABLE = "marketing_budgets";

function rowToBudget(r) {
  return {
    id:         r.id,
    companyIds: Array.isArray(r.company_ids) ? r.company_ids : [],
    category:   r.category,
    periodYear: r.period_year != null ? Number(r.period_year) : null,
    // `numeric` chega como string no PostgREST — coage aqui pra ninguém somar
    // string mais pra frente (mesma armadilha já corrigida em formatBRL).
    amount:     r.amount != null ? Number(r.amount) : 0,
    notes:      r.notes ?? null,
    createdBy:  r.created_by ?? null,
    createdAt:  r.created_at ?? null,
    updatedAt:  r.updated_at ?? null,
  };
}

function budgetToRow(b) {
  const row = {};
  if (b.companyIds !== undefined) row.company_ids = b.companyIds || [];
  if (b.category   !== undefined) row.category    = b.category;
  if (b.periodYear !== undefined) row.period_year = b.periodYear === "" ? null : Number(b.periodYear);
  if (b.amount     !== undefined) row.amount      = b.amount === "" || b.amount == null ? 0 : Number(b.amount);
  if (b.notes      !== undefined) row.notes       = b.notes || null;
  return row;
}

/**
 * Tetos de orçamento de Marketing (marketing_budgets).
 *
 * `canWrite` espelha o gate do banco — a RLS de INSERT/UPDATE/DELETE exige
 * current_user_is_marketing_manager() (gerente_marketing|admin) com empresa em
 * comum. Aqui é só pra esconder o botão: quem manda continua sendo a policy.
 */
export function useMarketingBudgets({ userId, role, roles, enabled = true } = {}) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured && enabled);
  const [error, setError]     = useState(null);

  // roles[] cobre cargo adicional (ex: gerente_marketing como cargo
  // secundário) — role sozinho (cargo principal) fica só de fallback pra
  // chamadas antigas que ainda não passam o array.
  const roleList = Array.isArray(roles) && roles.length ? roles : (role ? [role] : []);
  const canWrite = roleList.some(r => ["admin", "gerente_marketing"].includes(r));

  // `isActive` é a guarda por execução do efeito (não um ref da instância)
  // — ver o porquê em use-chat.js. Default sempre-ativo p/ chamada manual.
  const fetchAll = useCallback(async (isActive = () => true) => {
    if (!isSupabaseConfigured || !enabled) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .order("period_year", { ascending: false })
        .order("category", { ascending: true });
      if (err) throw err;
      if (!isActive()) return;
      setBudgets((data || []).map(rowToBudget));
    } catch (e) {
      if (isActive()) setError(e.message || String(e));
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    let active = true;
    fetchAll(() => active);
    if (!isSupabaseConfigured || !enabled) return () => { active = false; };
    const channelName = `marketing_budgets_rt_${Math.random().toString(36).slice(2, 9)}`;
    // ATENÇÃO (verificado em 10/08/2026 via pg_publication_tables): a tabela
    // marketing_budgets ainda NÃO está na publicação `supabase_realtime` — a
    // migration criou a tabela mas não a adicionou à publicação. Enquanto isso
    // não for corrigido (exige confirmação do Daniel, regra 5 do CLAUDE.md),
    // esta assinatura não recebe evento nenhum e a sincronia entre usuários
    // depende do refetch manual. Os updates otimistas abaixo (create/update/
    // delete) garantem que a PRÓPRIA sessão continua correta — é exatamente o
    // sintoma já visto em marketing_purchase_requests antes da migration
    // enable_realtime_publication_all_tables. O código fica aqui pronto: no dia
    // em que a tabela entrar na publicação, passa a funcionar sem nova mudança.
    //
    // Debounce: um rollout de tetos (várias categorias salvas em sequência)
    // dispararia um refetch por linha sem isso — regra do CLAUDE.md.
    const debouncedFetchAll = debounce(() => { if (active) fetchAll(() => active); }, 400);
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, debouncedFetchAll)
      .subscribe();
    return () => {
      active = false;
      debouncedFetchAll.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchAll, enabled]);

  const createBudget = useCallback(async (budget) => {
    if (!isSupabaseConfigured || !canWrite) return null;
    const row = { ...budgetToRow(budget), created_by: userId ?? null };
    const { data, error: err } = await supabase.from(TABLE).insert(row).select().single();
    if (err) throw err;
    const created = rowToBudget(data);
    // Update otimista — o Realtime debounced abaixo confirma depois; sem isso
    // o teto recém-criado demoraria 400ms pra aparecer.
    setBudgets(prev => prev.some(b => b.id === created.id) ? prev : [created, ...prev]);
    return created;
  }, [canWrite, userId]);

  const updateBudget = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured || !canWrite) return;
    // `updated_at` NÃO vai daqui: o trigger marketing_budgets_updated_at já
    // grava (e sobrescreveria qualquer valor mandado pelo cliente).
    const row = budgetToRow(patch);
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
    const { data, error: err } = await supabase.from(TABLE).update(row).eq("id", id).select();
    if (err) {
      setError(err.message || String(err));
      fetchAll();
      throw err;
    }
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]) —
    // mesmo caminho do erro, pra desfazer o otimista aplicado acima.
    if (!data || data.length === 0) {
      const vazio = new Error("Não foi possível salvar o orçamento — verifique suas permissões.");
      setError(vazio.message);
      fetchAll();
      throw vazio;
    }
  }, [canWrite, fetchAll]);

  const deleteBudget = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setBudgets(prev => prev.filter(b => b.id !== id));
  }, [canWrite]);

  return {
    budgets,
    loading,
    error,
    canWrite,
    createBudget,
    updateBudget,
    deleteBudget,
    refetch: fetchAll,
  };
}
