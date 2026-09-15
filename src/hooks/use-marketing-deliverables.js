import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "marketing_deliverables";

function rowToDeliverable(r) {
  return {
    id:             r.id,
    companyIds:     Array.isArray(r.company_ids) ? r.company_ids : [],
    campaignId:     r.campaign_id ?? null,

    // Formulário Inicial
    title:          r.title,
    requestNumber:  r.request_number ?? null,
    requesterName:  r.requester_name ?? null,
    requesterEmail: r.requester_email ?? null,
    emailError:     r.email_error ?? null,
    department:     r.department ?? null,
    description:    r.description ?? null,
    priority:       r.priority ?? "media",
    deadline:       r.deadline ?? null,

    // Etapa
    stage:          r.stage,
    stageChangedAt: r.stage_changed_at ?? null,

    // Top-level assignee (responsible — shown on card)
    assignee:       r.assignee ?? null,
    assigneeIds:    Array.isArray(r.assignee_ids) ? r.assignee_ids : (r.assignee ? [r.assignee] : []),

    // Stage-specific data (all stages keyed by stage id)
    stageData:      r.stage_data ?? {},
    customFields:   r.custom_fields && typeof r.custom_fields === "object" ? r.custom_fields : {},

    // Padrão
    starred:        r.starred ?? false,
    activities:     Array.isArray(r.activities) ? r.activities : [],
    notes:          Array.isArray(r.notes) ? r.notes : [],
    createdBy:      r.created_by ?? null,
    createdAt:      r.created_at ?? null,
    updatedAt:      r.updated_at ?? null,
  };
}

// Mapa campo (camelCase, como o app trata) -> coluna (como o banco guarda).
// Usado pelo recorte por patch em updateDeliverable: sem ele não há como
// saber quais colunas o patch tocou. Coluna nova em deliverableToRow PRECISA
// entrar aqui também — se faltar, updateDeliverable falha alto de propósito.
const COLUNA_POR_CAMPO = {
  requestNumber:  "request_number",
  companyIds:     "company_ids",
  campaignId:     "campaign_id",
  title:          "title",
  requesterName:  "requester_name",
  department:     "department",
  description:    "description",
  priority:       "priority",
  deadline:       "deadline",
  stage:          "stage",
  stageChangedAt: "stage_changed_at",
  assignee:       "assignee",
  assigneeIds:    "assignee_ids",
  stageData:      "stage_data",
  customFields:   "custom_fields",
  starred:        "starred",
  activities:     "activities",
  notes:          "notes",
};

function deliverableToRow(d, extras = {}) {
  return {
    request_number:   d.requestNumber ?? null,
    company_ids:      d.companyIds ?? [],
    campaign_id:      d.campaignId ?? null,

    title:            d.title,
    requester_name:   d.requesterName ?? null,
    department:       d.department ?? null,
    description:      d.description ?? null,
    priority:         d.priority ?? "media",
    deadline:         d.deadline ?? null,

    stage:            d.stage ?? "solicitacao",
    stage_changed_at: d.stageChangedAt ?? new Date().toISOString(),

    assignee:         d.assignee ?? null,
    assignee_ids:     d.assigneeIds ?? (d.assignee ? [d.assignee] : null),
    stage_data:       d.stageData ?? {},
    custom_fields:    d.customFields && typeof d.customFields === "object" ? d.customFields : {},

    starred:          d.starred ?? false,
    activities:       d.activities ?? [],
    notes:            d.notes ?? [],
    ...extras,
  };
}

// `enabled` (default true) segue o mesmo precedente de useMarketingCampaigns:
// permite montar o hook no App.jsx sem assinar Realtime pra quem não é do
// time de Marketing/Agência. Foi o que a busca global (CommandPalette) exigiu
// pra incluir Entregas sem cobrar uma assinatura a mais de TODO usuário da
// plataforma — quem não tem o cargo recebe [] e nenhum canal aberto.
export function useMarketingDeliverables({ userId, role, roles, campaignId, enabled = true } = {}) {
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  // roles[] cobre cargo adicional (ex: gerente_marketing como cargo
  // secundário) — role sozinho (cargo principal) fica só de fallback pra
  // chamadas antigas que ainda não passam o array.
  const roleList = Array.isArray(roles) && roles.length ? roles : (role ? [role] : []);
  // canManage = time interno (cria/exclui entrega, administra etapas — md_insert/
  // md_delete no banco continuam só pra esses papéis). canWrite = também a
  // Agência (30/07/2026, pedido do Daniel: "por que a agência não consegue
  // preencher os formulários dos cards?") — cobre o dia a dia de quem
  // produz a entrega: mover de etapa, preencher campos da etapa, responsáveis,
  // checklist, anexos, título. Nunca excluir/duplicar/criar — md_update no
  // banco foi ajustado pra combinar (migration 20260805), md_insert/md_delete
  // permanecem marketing-only.
  const canManage = roleList.some(r => ["admin", "marketing", "gerente_marketing"].includes(r));
  const canWrite = canManage || roleList.includes("agencia");

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      let q = supabase.from(TABLE).select("*").order("created_at", { ascending: false });
      if (campaignId) q = q.eq("campaign_id", campaignId);
      const { data, error: err } = await q;
      if (err) throw err;
      setDeliverables((data || []).map(rowToDeliverable));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [campaignId, enabled]);

  useEffect(() => { if (enabled) fetchAll(); }, [fetchAll, campaignId, enabled]);

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;
    const channelName = `marketing_deliverables_rt_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        const matchesCampaign = !campaignId || payload.new?.campaign_id === campaignId;
        if (payload.eventType === "INSERT") {
          if (!matchesCampaign) return;
          setDeliverables(prev =>
            prev.some(d => d.id === payload.new.id)
              ? prev.map(d => d.id === payload.new.id ? rowToDeliverable(payload.new) : d)
              : [rowToDeliverable(payload.new), ...prev]
          );
        } else if (payload.eventType === "UPDATE") {
          setDeliverables(prev => prev.map(d => d.id === payload.new.id ? rowToDeliverable(payload.new) : d));
        } else if (payload.eventType === "DELETE") {
          setDeliverables(prev => prev.filter(d => d.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [campaignId, enabled]);

  const createDeliverable = useCallback(async (deliverable) => {
    if (!isSupabaseConfigured || !canManage) return null;
    // Responsáveis vazios na criação deixavam a agência sem dono no card.
    // Sempre quem criou; se o chamador já mandou assigneeIds, respeita.
    const assigneeIds = Array.isArray(deliverable.assigneeIds) && deliverable.assigneeIds.length > 0
      ? deliverable.assigneeIds
      : (userId ? [userId] : []);
    const row = deliverableToRow({
      ...deliverable,
      assigneeIds,
      assignee: deliverable.assignee ?? assigneeIds[0] ?? null,
    }, { created_by: userId });
    const { data, error: err } = await supabase
      .from(TABLE)
      .insert(row)
      .select()
      .single();
    if (err) throw err;
    const created = rowToDeliverable(data);
    setDeliverables(prev => prev.some(d => d.id === created.id) ? prev : [created, ...prev]);
    return created;
  }, [canManage, userId]);

  const updateDeliverable = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = deliverables.find(d => d.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    const rowCompleta = deliverableToRow(merged);

    // Manda SÓ as colunas que o patch tocou.
    //
    // Até 01/09/2026 esta função escrevia a LINHA INTEIRA, remontada a partir
    // de `current` — a cópia local desta aba. Consequência: qualquer coluna
    // alterada no banco depois que a aba carregou voltava pro valor velho, em
    // silêncio. Foi assim que um comentário do Daniel sumiu (bug reportado
    // 01/09): ele comentou e em seguida devolveu a entrega pra agência; a
    // escrita de `activities` levou `notes` junto, com o conteúdo de antes do
    // comentário.
    //
    // O sintoma já tinha aparecido uma vez e foi tratado numa coluna só —
    // havia aqui um `delete row.request_number` com o comentário "podendo
    // reverter silenciosamente um número já alterado por outra pessoa nesse
    // meio tempo (achado da auditoria)". Era o mesmo bug, visto por uma
    // fresta. Este recorte por patch resolve pra TODAS as colunas e torna
    // aquele caso especial desnecessário (`request_number` só é enviado
    // quando `requestNumber` está no patch, que era exatamente a intenção).
    const row = {};
    for (const campo of Object.keys(patch)) {
      const coluna = COLUNA_POR_CAMPO[campo];
      if (!coluna) {
        // Chave sem coluna correspondente é IGNORADA — e isso não é novidade
        // deste recorte: o `deliverableToRow` sempre leu só as props que
        // conhece, então uma chave estranha já não era escrita antes. Chegou
        // a passar por aqui um `throw`, e ele estava errado: a automação de
        // "definir campo" (use-automations.js:319) monta o patch com a chave
        // escolhida na tela, que pode ser um campo customizado — falhar alto
        // transformaria um no-op antigo em automação quebrada.
        // O aviso fica no console pra quem estiver desenvolvendo; que campo
        // customizado não seja gravável por automação é assunto separado
        // deste bug, e não vou resolver de carona.
        console.warn(`updateDeliverable: campo "${campo}" não tem coluna mapeada — ignorado (comportamento de sempre).`);
        continue;
      }
      row[coluna] = rowCompleta[coluna];
    }
    // `assignee_ids` é derivado de `assignee` (ver deliverableToRow): mexer num
    // sem mandar o outro deixaria os dois inconsistentes no banco.
    if ("assignee" in patch || "assigneeIds" in patch) {
      row.assignee = rowCompleta.assignee;
      row.assignee_ids = rowCompleta.assignee_ids;
    }
    if (Object.keys(row).length === 0) return;

    const { data, error: err } = await supabase.from(TABLE).update(row).eq("id", id).select();
    if (err) throw err;
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta entrega.");
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }, [canWrite, deliverables]);

  // "Duplicar card" — mesmo raciocínio de duplicateTask (use-marketing-tasks.js):
  // cópia nasce sempre na 1ª etapa ("solicitacao", igual ao default de
  // deliverableToRow acima), nunca herda requestNumber (sequência própria),
  // stageData (dado específico de cada etapa já percorrida no original —
  // equivalente a approved_by/rejected_reason de outros domínios), nem
  // emailError (erro do envio de e-mail da entrega original). requesterEmail
  // não entra: deliverableToRow não grava esse campo (só é lido de volta) —
  // não existe como escrever de dentro do app hoje, então não faz sentido
  // incluir aqui.
  const duplicateDeliverable = useCallback(async (source) => {
    return createDeliverable({
      companyIds:    source.companyIds,
      campaignId:    source.campaignId,
      title:         `${source.title} (cópia)`,
      requesterName: source.requesterName,
      department:    source.department,
      description:   source.description,
      priority:      source.priority,
      deadline:      source.deadline,
      stage:         "solicitacao",
      assigneeIds:   source.assigneeIds,
      customFields:  source.customFields,
      // NÃO copiar: requestNumber, emailError, stageData, stageChangedAt,
      // notes, activities.
    });
  }, [createDeliverable]);

  const deleteDeliverable = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canManage) return;
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) throw err;
    setDeliverables(prev => prev.filter(d => d.id !== id));
  }, [canManage]);

  const changeStage = useCallback(async (id, stage) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const now      = new Date().toISOString();
    const current  = deliverables.find(d => d.id === id);
    const stageName = stage; // caller can pass a display name if needed
    const activity  = {
      type:        "stage_change",
      description: `Movido para ${stageName}`,
      at:          now,
    };
    const activities = [...(current?.activities || []), activity];
    const { data, error: err } = await supabase
      .from(TABLE)
      .update({ stage, stage_changed_at: now, activities })
      .eq("id", id)
      .select();
    if (err) throw err;
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta entrega.");
    setDeliverables(prev =>
      prev.map(d => d.id === id ? { ...d, stage, stageChangedAt: now, activities } : d)
    );
  }, [canWrite, deliverables]);

  // Avisa o solicitante por e-mail quando a entrega chega em "entregue", via
  // edge function — nunca lança: falha de e-mail não pode desfazer uma
  // mudança de etapa já gravada. Mesmo padrão de sendStatusEmail em
  // use-marketing-requests.js (P1.7 da auditoria Zero Bullshit).
  const sendCompleteEmail = useCallback(async (id) => {
    try {
      const { data, error: err } = await supabase.functions.invoke("send-deliverable-complete-email", {
        body: { deliverable_id: id },
      });
      const emailError = err ? (err.message || String(err)) : (data?.error || null);
      setDeliverables(prev => prev.map(d => d.id === id ? { ...d, emailError } : d));
      return { ok: !emailError, error: emailError };
    } catch (e) {
      const emailError = e?.message || String(e);
      setDeliverables(prev => prev.map(d => d.id === id ? { ...d, emailError } : d));
      return { ok: false, error: emailError };
    }
  }, []);

  // Avisa por e-mail o fornecedor vinculado à Campanha quando uma Entrega
  // nova é criada — via edge function, nunca lança: falha de e-mail não
  // pode desfazer uma criação já gravada. Mesmo padrão de sendCompleteEmail
  // acima (a edge function decide sozinha se há fornecedor pra quem
  // avisar; sem um vinculado, ela só responde sent:0, sem erro).
  const sendSupplierNotifyEmail = useCallback(async (id) => {
    try {
      const { data, error: err } = await supabase.functions.invoke("send-deliverable-supplier-notify", {
        body: { deliverable_id: id },
      });
      const emailError = err ? (err.message || String(err)) : (data?.error || null);
      return { ok: !emailError, error: emailError };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  }, []);

  const toggleStar = useCallback(async (id) => {
    if (!isSupabaseConfigured || !canWrite) return;
    const current = deliverables.find(d => d.id === id);
    if (!current) return;
    const starred = !current.starred;
    const { data, error: err } = await supabase.from(TABLE).update({ starred }).eq("id", id).select();
    if (err) throw err;
    if (!data || data.length === 0) throw new Error("Não foi possível salvar — sem permissão pra editar esta entrega.");
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, starred } : d));
  }, [canWrite, deliverables]);

  return {
    deliverables,
    loading,
    error,
    canWrite,
    canManage,
    createDeliverable,
    updateDeliverable,
    deleteDeliverable,
    duplicateDeliverable,
    changeStage,
    sendCompleteEmail,
    sendSupplierNotifyEmail,
    toggleStar,
    refetch: fetchAll,
  };
}
