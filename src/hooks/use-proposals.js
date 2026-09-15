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
  // Todas as versões, da mais nova pra mais velha. A Fase 1 guardava uma
  // proposta só por negócio; com o gerador de RFP (15/09/2026) cada "Gerar"
  // cria uma VERSÃO nova, porque é isso que se pergunta na revisão: qual foi
  // a que o cliente recebeu. A coluna `version` já existia sem uso.
  const [versoes, setVersoes] = useState([]);
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
        // Desempate por data: sem ele, duas linhas com a mesma `version`
        // faziam o Postgres devolver qualquer uma, e o painel abria o
        // snapshot da proposta do colega. O índice único impede que isso
        // volte a acontecer, mas a ordenação determinística fica.
        .order("version", { ascending: false })
        .order("created_at", { ascending: false });
      if (pErr) throw pErr;
      setVersoes(proposals || []);
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
  const persist = useCallback(async ({ draftText, items, createdBy, rfpSnapshot, novaVersao = false }) => {
    if (!isSupabaseConfigured || !leadId) return null;
    let p = proposal;
    // `novaVersao` cria uma linha nova em vez de sobrescrever a atual. É o
    // caminho do gerador de RFP: a proposta que o cliente recebeu não pode
    // ser reescrita por cima quando o vendedor gera a próxima.
    let criadaAgora = false;
    if (!p || novaVersao) {
      // Conteúdo no PRÓPRIO insert, numa instrução só. Antes era INSERT e
      // depois UPDATE: se o UPDATE falhasse (rede, RLS), a linha de versão já
      // estava no banco VAZIA, o estado local não sabia dela, e o próximo
      // "Gerar" recalculava o mesmo número e criava a duplicata.
      const base = {
        lead_id: leadId, company_id: companyId, created_by: createdBy || null,
        ai_draft_text: draftText ?? null,
        ...(rfpSnapshot !== undefined ? { rfp_snapshot: rfpSnapshot } : {}),
      };
      // A versão é calculada no cliente a partir de uma lista que pode estar
      // velha (outro vendedor no mesmo negócio). O índice único
      // `proposals_lead_version_uniq` transforma isso em erro 23505, e aqui a
      // resposta é reler e tentar o próximo número — nunca gravar por cima.
      let proxima = (versoes[0]?.version ?? 0) + 1;
      let inserida = null;
      for (let tentativa = 0; tentativa < 4 && !inserida; tentativa++) {
        const { data, error: err } = await supabase.from(PROPOSALS_TABLE)
          .insert({ ...base, version: proxima }).select().single();
        if (!err) { inserida = data; break; }
        if (err.code !== "23505") throw new Error(err.message);
        const { data: atuais } = await supabase.from(PROPOSALS_TABLE)
          .select("version").eq("lead_id", leadId)
          .order("version", { ascending: false }).limit(1);
        proxima = (atuais?.[0]?.version ?? proxima) + 1;
      }
      if (!inserida) throw new Error("Não foi possível criar uma versão nova da proposta. Tente de novo.");
      p = inserida;
      criadaAgora = true;
    }

    const patch = { ai_draft_text: draftText };
    if (rfpSnapshot !== undefined) patch.rfp_snapshot = rfpSnapshot;
    // Quando a versão acabou de ser criada, o conteúdo JÁ foi no INSERT — não
    // há UPDATE a fazer. O caminho de UPDATE existe só pra proposta que já
    // estava lá.
    const { data: textoSalvo, error: textErr } = criadaAgora
      ? { data: [p], error: null }
      : await supabase.from(PROPOSALS_TABLE).update(patch).eq("id", p.id).select();
    if (textErr) throw new Error(textErr.message);
    // Zero linha = RLS barrou. Importa parar AQUI: logo abaixo os itens da
    // proposta são apagados e regravados, e sem isso o texto ficava o antigo
    // com os itens novos — proposta inconsistente, sem nenhum aviso.
    if (!textoSalvo || textoSalvo.length === 0) {
      throw new Error("Não foi possível salvar a proposta — verifique suas permissões. Nenhum item foi alterado.");
    }

    // `items` ausente = o chamador não gerencia linha de item. Antes, passar
    // `[]` apagava tudo e zerava `total_value` via trigger a cada geração —
    // o painel novo virou o único escritor dessas colunas e só sabia
    // destruí-las.
    const gerenciaItens = Array.isArray(items);
    if (gerenciaItens) {
      const { error: delErr } = await supabase.from(ITEMS_TABLE).delete().eq("proposal_id", p.id);
      if (delErr) throw new Error(delErr.message);
    }

    let insertedItems = [];
    if (gerenciaItens && items.length > 0) {
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
    if (!gerenciaItens) insertedItems = lineItems;

    // total_value é recalculado no banco via trigger (proposal_line_items_sync_total)
    // — refetch pra pegar o valor real, nunca somar de novo no cliente.
    const { data: p2, error: refetchErr } = await supabase
      .from(PROPOSALS_TABLE).select("*").eq("id", p.id).single();
    if (refetchErr) throw new Error(refetchErr.message);
    setProposal(p2);
    setVersoes(prev => {
      const semEla = prev.filter(v => v.id !== p2.id);
      return [p2, ...semEla].sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
    });
    setLineItems(insertedItems);
    return p2;
  }, [proposal, versoes, lineItems, leadId, companyId]);

  return { proposal, versoes, lineItems, loading, error, persist, refetch: fetchAll };
}

export default useProposals;
