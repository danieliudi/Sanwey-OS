import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Overrides de acesso por módulo (Configurações → Usuários → "Acesso por
// módulo") — complementa os cargos, não substitui: sem override nenhum,
// prevalece o padrão do cargo (defaultModulesForRoles em
// utils/module-access.js). Usado tanto pra ler os próprios overrides
// (montar a navegação de quem está logado, em App.jsx) quanto pra editar os
// overrides de qualquer usuário (admin, em UserManagementView).
export function useModuleOverrides({ userId, enabled = true } = {}) {
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading]     = useState(false);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled || !userId) { setOverrides([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("profile_module_overrides")
      .select("module_id, allow")
      .eq("user_id", userId);
    if (!error) setOverrides((data || []).map(r => ({ moduleId: r.module_id, allow: r.allow })));
    setLoading(false);
  }, [userId, enabled]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Grava explicitamente allow=true/false pro módulo — sobrescreve o padrão
  // do cargo até alguém chamar clearOverride.
  const setOverride = useCallback(async (moduleId, allow) => {
    if (!userId) return;
    const { error } = await supabase
      .from("profile_module_overrides")
      .upsert({ user_id: userId, module_id: moduleId, allow, created_by: (await supabase.auth.getUser()).data?.user?.id ?? null }, { onConflict: "user_id,module_id" });
    if (error) throw new Error(error.message);
    setOverrides(prev => [...prev.filter(o => o.moduleId !== moduleId), { moduleId, allow }]);
  }, [userId]);

  // Remove o override — o módulo volta a seguir o padrão do cargo.
  const clearOverride = useCallback(async (moduleId) => {
    if (!userId) return;
    const { error } = await supabase
      .from("profile_module_overrides")
      .delete()
      .eq("user_id", userId)
      .eq("module_id", moduleId);
    if (error) throw new Error(error.message);
    setOverrides(prev => prev.filter(o => o.moduleId !== moduleId));
  }, [userId]);

  return { overrides, loading, setOverride, clearOverride, refetch: fetchAll };
}

export default useModuleOverrides;
