import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { debounce } from "../utils/debounce";

const TABLE = "marketing_suppliers";

function rowToSupplier(r) {
  return {
    id: r.id,
    name: r.name,
    category: r.category ?? "outro",
    contactName: r.contact_name ?? null,
    email: r.email,
    phone: r.phone ?? null,
    notes: r.notes ?? null,
    companyIds: Array.isArray(r.company_ids) ? r.company_ids : [],
    isActive: r.is_active ?? true,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

function supplierToRow(s, extras = {}) {
  return {
    name: s.name,
    category: s.category ?? "outro",
    contact_name: s.contactName ?? null,
    email: s.email,
    phone: s.phone ?? null,
    notes: s.notes ?? null,
    company_ids: s.companyIds ?? [],
    is_active: s.isActive ?? true,
    ...extras,
  };
}

export function useMarketingSuppliers({ userId, role, roles, enabled = true } = {}) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // roles[] cobre cargo adicional (ex: gerente_marketing como cargo
  // secundário) — role sozinho (cargo principal) fica só de fallback pra
  // chamadas antigas que ainda não passam o array.
  const roleList = Array.isArray(roles) && roles.length ? roles : (role ? [role] : []);
  const canWrite = roleList.some(r => ["admin", "marketing", "gerente_marketing"].includes(r));

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .order("name", { ascending: true });
      if (err) throw err;
      setSuppliers((data || []).map(rowToSupplier));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const debouncedFetchAll = debounce(fetchAll, 400);
    const channel = supabase
      .channel(`marketing-suppliers-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, debouncedFetchAll)
      .subscribe();
    return () => { debouncedFetchAll.cancel(); supabase.removeChannel(channel); };
  }, [enabled, fetchAll]);

  const createSupplier = useCallback(async (supplier) => {
    if (!isSupabaseConfigured || !canWrite) return null;
    const row = supplierToRow(supplier, { created_by: userId ?? null });
    const { data, error: err } = await supabase.from(TABLE).insert(row).select().single();
    if (err) throw err;
    const created = rowToSupplier(data);
    setSuppliers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }, [canWrite, userId]);

  const updateSupplier = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = suppliers.find(s => s.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    const row = supplierToRow(merged, { updated_at: new Date().toISOString() });
    const { data, error: err } = await supabase.from(TABLE).update(row).eq("id", id).select();
    if (err) throw err;
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível salvar o fornecedor — verifique suas permissões.");
    setSuppliers(prev => prev.map(s => s.id === id ? merged : s));
  }, [canWrite, suppliers]);

  const deleteSupplier = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setSuppliers(prev => prev.filter(s => s.id !== id));
  }, [canWrite]);

  return {
    suppliers, loading, error, canWrite,
    createSupplier, updateSupplier, deleteSupplier,
    refetch: fetchAll,
  };
}

export default useMarketingSuppliers;
