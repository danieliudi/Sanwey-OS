import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// CPQ Fase 1 (19/08/2026) — tabela filha de linha de item versionada, nunca
// um jsonb em leads (mesmo motivo de marketing_expense_items: histórico
// auditável, subtotal calculado via trigger no banco, nunca somado na mão
// no cliente). Fase 1 mantém 1 proposta "draft" por lead — versionamento
// completo (nova linha por reenvio) fica pra Fase 2, fora de escopo aqui.
const PROPOSALS_TABLE = "proposals";
const ITEMS_TABLE = "proposal_line_items";

export function useProposals(leadId, companyId) {
  const [proposal, setProposal] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !leadId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: proposals, error: pErr } = await supabase
        .from(PROPOSALS_TABLE)
        .select("*")
        .eq("lead_id", leadId)
        .order("version", { ascending: false })
        .limit(1);
      if (pErr) throw pErr;
      const current = proposals?.[0] || null;
      setProposal(current);
      if (current) {
        const { data: items, error: iErr } = await supabase
          .from(ITEMS_TABLE)
          .select("*")
          .eq("proposal_id", current.id)
          .order("created_at", { ascending: true });
        if (iErr) throw iErr;
        setLineItems(items || []);
      } else {
        setLineItems([]);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Grava texto + linhas de item substituindo tudo de uma vez (delete +
  // insert) — volume baixo por proposta, não vale reconciliar diff. Chamado
  // só nos pontos de "Gerar"/"Gerar novamente" (ver ProposalPanel.jsx),
  // nunca a cada tecla digitada na tabela.
  const persist = useCallback(async ({ draftText, items, createdBy }) => {
    if (!isSupabaseConfigured || !leadId) return null;
    let p = proposal;
    if (!p) {
      const { data, error: err } = await supabase.from(PROPOSALS_TABLE).insert({
        lead_id: leadId, company_id: companyId, created_by: createdBy || null,
      }).select().single();
      if (err) throw new Error(err.message);
      p = data;
    }

    const { data: textoSalvo, error: textErr } = await supabase.from(PROPOSALS_TABLE)
      .update({ ai_draft_text: draftText })
      .eq("id", p.id)
      .select();
    if (textErr) throw new Error(textErr.message);
    // Zero linha = RLS barrou. Importa parar AQUI: logo abaixo os itens da
    // proposta são apagados e regravados, e sem isso o texto ficava o antigo
    // com os itens novos — proposta inconsistente, sem nenhum aviso.
    if (!textoSalvo || textoSalvo.length === 0) {
      throw new Error("Não foi possível salvar a proposta — verifique suas permissões. Nenhum item foi alterado.");
    }

    const { error: delErr } = await supabase.from(ITEMS_TABLE).delete().eq("proposal_id", p.id);
    if (delErr) throw new Error(delErr.message);

    let insertedItems = [];
    if (items.length > 0) {
      const { data: ins, error: insErr } = await supabase.from(ITEMS_TABLE).insert(
        items.map(it => ({
          proposal_id: p.id,
          model_label: it.modelLabel,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          certification_note: it.certificationNote || null,
        }))
      ).select();
      if (insErr) throw new Error(insErr.message);
      insertedItems = ins || [];
    }

    // total_value é recalculado no banco via trigger (proposal_line_items_sync_total)
    // — refetch pra pegar o valor real, nunca somar de novo no cliente.
    const { data: p2, error: refetchErr } = await supabase
      .from(PROPOSALS_TABLE).select("*").eq("id", p.id).single();
    if (refetchErr) throw new Error(refetchErr.message);
    setProposal(p2);
    setLineItems(insertedItems);
    return p2;
  }, [proposal, leadId, companyId]);

  return { proposal, lineItems, loading, error, persist, refetch: fetchAll };
}

export default useProposals;
