import React, { useMemo, useRef, useState } from "react";
import { Mic, Square, Sparkles, Check, X, PencilLine, Loader2, AlertTriangle, Circle, CheckCircle2, MapPin, Briefcase } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAudioRecorder, formatRecordingTime, blobToBase64, AUDIO_MAX_SECONDS } from "../../hooks/use-audio-recorder";
import { useLeadAttachments } from "../../hooks/use-lead-attachments";
import { formatDateBR, parseDateInput } from "../../utils/date";

// Ata de visita por voz — o vendedor fala um minuto, confere o que a IA
// entendeu e salva. Aprovado com o Daniel em 13/08/2026 (mockup das 4 telas,
// modo "lead") e 13/08/2026 (mockup das telas de destino, modo "client").
//
// Três regras combinadas nos dois mockups, e é por elas que o código é assim:
//
//  1. NADA é gravado sem o aceite. A edge function só devolve um rascunho;
//     quem escreve no banco é o botão "Salvar ata" desta tela, pelo mesmo
//     addLeadActivity que a nota manual já usa. É o padrão "IA propõe,
//     humano aprova" do Time de Agentes.
//  2. Campo que a IA não achou fica VAZIO, nunca chutado — por isso todo
//     campo do rascunho é opcional e renderiza em branco quando vem null.
//  3. A IA NUNCA move o card de etapa. Ela sugere próximo passo e data;
//     mover no funil continua sendo ato consciente de quem vende.
//
// Dois modos, mesmo motor de gravar/organizar/conferir — só o destino do
// "Salvar" muda:
//
//  mode="lead" (LeadDetailDrawer, aba Atividades) — o negócio já existe.
//    O áudio sobe pro Storage ANTES de chamar a IA (audioPath), porque
//    lead.id já é conhecido. Salvar grava direto nesse lead.
//
//  mode="client" (ClientsManager, aba Histórico) — o negócio ainda não
//    existe quando a pessoa grava. lead-attachments exige lead_id, então
//    não há onde subir o áudio antes de saber o destino — a IA recebe o
//    áudio embutido no corpo (audioBase64) e o arquivo fica só em memória
//    (pendingAudioRef) até a tela de conferência perguntar "isso é sobre um
//    negócio já aberto, ou algo novo?" e a pessoa responder. Só então o
//    áudio sobe, escopado ao lead que a resposta resolveu.
//
// O áudio sobe pelo mesmo useLeadAttachments dos outros anexos, então ele
// aparece sozinho na aba Anexos e continua ouvível se a transcrição errar.

const TEMPERATURAS = [
  { id: "frio",   label: "Frio" },
  { id: "morno",  label: "Morno" },
  { id: "quente", label: "Quente" },
];

// Etapas que não contam como "negócio aberto" pro destino da ata — mesma
// convenção já usada em App.jsx (notificação de ganho/perdido) e em
// ClientsManager.jsx (statsByClient filtra por "ganho"). Não é um valor
// configurável por rh_pipeline_stages hoje; replicar essa convenção em vez
// de inventar uma checagem nova.
const ETAPAS_TERMINAIS = new Set(["ganho", "perdido"]);

function Lbl({ children, tag }) {
  return (
    <p className="mb-1 flex items-center gap-1.5" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "var(--text-dim)" }}>
      {children}
      {tag && (
        <span style={{ fontSize: 8.5, letterSpacing: "0.06em", padding: "1px 5px", borderRadius: 3, background: "var(--accent-bg, var(--surface-alt))", color: "var(--accent)" }}>
          {tag}
        </span>
      )}
    </p>
  );
}

const inputStyle = {
  width: "100%", borderRadius: 8, padding: "7px 9px", fontSize: 12.5,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
  lineHeight: 1.5, resize: "vertical",
};

// Novo negócio a partir de uma ata sem negócio aberto — mesmo formato que
// SignalsView.jsx já usa pra "sinal virou lead" (regra 1: não reinventar o
// shape de um lead novo). Owner vai pra quem gravou a ata (decisão do
// Daniel, 13/08/2026) — diferente do Sinal, aqui sempre tem alguém na
// origem, não uma pesquisa automática sem dono óbvio.
function buildLeadFromClientAta(client, currentUser, draft, resumo) {
  const now = new Date().toISOString();
  return {
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    companyId: client.companyIds?.[0] || "industria",
    company: client.name,
    razaoSocial: client.name,
    sector: "",
    // SEM cnpj de propósito: addLead (use-leads.js) dedupa por CNPJ+empresa e
    // devolve o registro EXISTENTE em vez de criar um novo. Cliente
    // estabelecido — que é justamente quem tem ata registrada — quase sempre
    // já teve algum negócio antigo (ganho ou perdido) com esse mesmo CNPJ.
    // Preencher aqui faria "Abrir oportunidade" reanexar silenciosamente num
    // negócio fechado de anos atrás, ao contrário do que a opção promete. O
    // vínculo de verdade já existe via clientId; o CNPJ do cliente é a fonte
    // canônica, não precisa duplicar aqui.
    cnpj: "",
    city: client.city || "—",
    state: client.state || "—",
    address: "",
    capitalSocial: 0,
    contactEmail: "",
    phone: "",
    situacao: "ATIVA",
    trigger: "Ata de visita",
    triggerLabel: "Registro por voz",
    evidence: resumo,
    fitScore: 60,
    quantity: 0,
    value: 0,
    probability: 0.1,
    closeDate: new Date(Date.now() + 60 * 86400000).toISOString(),
    dateDetected: now,
    daysAgo: 0,
    stage: "prospeccao",
    status: "prospeccao",
    owner: currentUser?.id || null,
    urgency: draft.temperatura === "quente" ? "alto" : "medio",
    decisionMaker: { name: "—", role: "—" },
    starred: false,
    notes: [],
    createdAt: now,
    lastActivity: now,
    stageChangedAt: now,
    clientId: client.id,
  };
}

export function AtaVozPanel({
  mode = "lead",
  lead, client, openLeads, onCreateLead,
  currentUser, onAddActivity, onUpdate, onSaved,
}) {
  const rec = useAudioRecorder();
  const isClientMode = mode === "client";

  // Mesmo hook dos outros anexos do lead: o áudio da ata entra no bucket e na
  // aba Anexos pelo caminho de sempre, sem storage paralelo. Em modo cliente
  // `leadId` inicial não existe — `upload()` aceita o id explícito por
  // chamada, então isso não impede o uso; só o fetch inicial (que lista
  // anexos de um lead conhecido) fica sem efeito, e não é usado aqui.
  const { upload: uploadAttachment } = useLeadAttachments(isClientMode ? undefined : lead?.id);

  const [phase, setPhase]   = useState("idle"); // idle | processing | review
  const [error, setError]   = useState(null);
  const [typing, setTyping] = useState(false);
  const [texto, setTexto]   = useState("");
  const [draft, setDraft]   = useState(null);
  const [audioInfo, setAudioInfo] = useState(null); // { path, name, seconds } — modo lead
  const [saving, setSaving] = useState(false);

  // Negócios abertos deste cliente (modo client) — sem etapa terminal.
  const negociosAbertos = useMemo(
    () => (openLeads || []).filter(l => !ETAPAS_TERMINAIS.has(l.stage)),
    [openLeads],
  );
  // "lead:<id>" ou "novo". Pré-seleciona o primeiro negócio aberto se
  // existir; senão, "novo" já vem marcado — é o caminho de menor atrito
  // (mockup aprovado 13/08/2026).
  const [destino, setDestino] = useState(
    () => (negociosAbertos[0] ? `lead:${negociosAbertos[0].id}` : "novo"),
  );

  // Áudio gravado em modo client: fica só em memória até o destino ser
  // resolvido no Salvar — ver cabeçalho do arquivo.
  const pendingAudioRef = useRef(null);

  const aiConfig = currentUser?.aiConfig;
  const podeIA = isSupabaseConfigured;

  // Check-in de visita (17/08/2026, 3 rodadas de mockup aprovadas): GPS é
  // SEMPRE anexado à ata — não existe opção de remover na UI. "Sempre"
  // aqui é sobre a interface, não sobre forçar o navegador: se a permissão
  // for negada ou a API não existir, a ata salva do mesmo jeito (nunca
  // trava o fluxo por causa disso) e tentamos de novo na próxima gravação.
  // geoStatus: idle | capturing | ok | denied | unsupported.
  const [geo, setGeo] = useState(null); // { lat, lng, accuracy }
  const [geoStatus, setGeoStatus] = useState("idle");
  const [geoAddress, setGeoAddress] = useState(null); // endereço legível, via reverse-geocode — pode nunca resolver
  const [tripMatches, setTripMatches] = useState([]); // crm_viagem_registros candidatos a vincular
  const [tripId, setTripId] = useState(null); // registro escolhido, ou null = nenhuma

  // Token de sessão de captura — incrementado toda vez que uma gravação nova
  // começa (ou é cancelada/descartada). getCurrentPosition/reverse-geocode/
  // busca de viagem são assíncronos e não têm como ser abortados de verdade;
  // sem isso, cancelar uma gravação e gravar de novo rapidamente podia deixar
  // uma resposta tardia da tentativa ANTERIOR sobrescrever geo/tripId da
  // tentativa atual (achado real de QA — corrida confirmada, não hipotética).
  // Cada chamada assíncrona guarda o valor no momento em que começou e só
  // aplica o resultado se `captureSessionRef.current` ainda for o mesmo.
  const captureSessionRef = useRef(0);
  // Guarda contra duplo clique em "Gravar ata": sem isso, dois cliques
  // rápidos disparavam duas capturas de GPS e duas buscas de viagem em
  // paralelo antes de `rec.recording` virar true (achado real de QA).
  const startingRef = useRef(false);

  // Cliente desta ata pra fins de match com Viagens — em modo client é o
  // próprio `client`; em modo lead, o negócio pode ou não ter clientId
  // (nem todo lead antigo tem cliente vinculado).
  const resolvedClientId = isClientMode ? (client?.id || null) : (lead?.clientId || null);

  const reverseGeocode = async (coords, session) => {
    try {
      const { data } = await supabase.functions.invoke("reverse-geocode", {
        body: { lat: coords.lat, lng: coords.lng },
      });
      if (captureSessionRef.current !== session) return; // sessão trocou — descarta resposta tardia
      if (data?.address) setGeoAddress(data.address);
    } catch {
      // Sem endereço legível — a Localização continua com coordenada + link
      // de mapa, nunca bloqueia (mesmo espírito das outras integrações com
      // o Google que a plataforma já tem).
    }
  };

  const capturarLocalizacao = (session) => {
    setGeo(null);
    setGeoAddress(null);
    if (!navigator.geolocation) { setGeoStatus("unsupported"); return; }
    setGeoStatus("capturing");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (captureSessionRef.current !== session) return;
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setGeo(coords);
        setGeoStatus("ok");
        reverseGeocode(coords, session);
      },
      () => { if (captureSessionRef.current === session) setGeoStatus("denied"); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    // Rede de segurança: alguns navegadores/dispositivos não disparam nem
    // sucesso nem erro dentro do `timeout` acima (bug real de plataforma,
    // não hipotético — apontado na revisão de QA). Sem isso, "Salvar ata"
    // (desabilitado enquanto geoStatus==="capturing") ficaria travado pra
    // sempre — pior que simplesmente não ter localização. Usa a forma
    // funcional do setState pra nunca depender de closure obsoleta.
    setTimeout(() => {
      if (captureSessionRef.current !== session) return;
      setGeoStatus(atual => (atual === "capturing" ? "denied" : atual));
    }, 18000);
  };

  // Visita planejada em Viagens pra este mesmo cliente/vendedor — só entra
  // como candidata tipo "visita" (não "evento"), status ainda não cancelado.
  // Auto-seleciona só quando a mais próxima é de fato próxima (diferença de
  // até 1 dia) E ainda está "planejado" — uma visita já marcada "realizado"
  // por uma ata anterior pode continuar candidata (pra listar no seletor,
  // caso seja um 2º contato de verdade no mesmo dia), mas nunca é
  // auto-selecionada, pra não sobrescrever silenciosamente o registro de
  // uma ata anterior (achado real de QA).
  const buscarVisitaPlanejada = async (session) => {
    setTripMatches([]);
    setTripId(null);
    if (!resolvedClientId || !currentUser?.id || !isSupabaseConfigured) return;
    try {
      const { data, error: err } = await supabase
        .from("crm_viagem_registros")
        .select("id, data_planejada, destino_planejado, status, cliente_nome")
        .eq("vendedor_id", currentUser.id)
        .eq("client_id", resolvedClientId)
        .eq("tipo", "visita")
        .in("status", ["planejado", "realizado"])
        .order("data_planejada", { ascending: false });
      if (err) throw err;
      if (captureSessionRef.current !== session) return; // sessão trocou — descarta resposta tardia
      // parseDateInput, não `new Date(string)` direto: data_planejada é uma
      // coluna `date` ("AAAA-MM-DD") do Postgres — new Date() interpretaria
      // como meia-noite UTC e "voltaria" um dia em fusos negativos, podendo
      // errar o threshold de auto-vínculo perto da borda (achado real de QA).
      const hojeMs = Date.now();
      const comDistancia = (data || [])
        .map(r => ({ ...r, diffDias: Math.abs((parseDateInput(r.data_planejada).getTime() - hojeMs) / 86400000) }))
        .sort((a, b) => a.diffDias - b.diffDias);
      setTripMatches(comDistancia);
      const melhor = comDistancia[0];
      setTripId(melhor && melhor.diffDias <= 1 && melhor.status === "planejado" ? melhor.id : null);
    } catch {
      // tripMatches/tripId já foram zerados no início da função.
    }
  };

  const contexto = useMemo(() => (
    isClientMode
      ? { company: client?.name || null }
      : { company: lead?.company || null, sector: lead?.sector || null, stage: lead?.stage || null }
  ), [isClientMode, client, lead]);

  const chamarIA = async (payload) => {
    const { data, error: err } = await supabase.functions.invoke("crm-ata-voz", {
      body: {
        ...payload,
        context: contexto,
        // Chave pessoal quando existir; sem ela a function cai na chave da
        // empresa (AI_ORG_*), mesmo mecanismo do resto da plataforma.
        ...(aiConfig?.provider && aiConfig?.apiKey && aiConfig?.model ? { aiConfig } : {}),
      },
    });
    // functions.invoke devolve `data: null` em qualquer resposta 4xx/5xx e
    // uma mensagem genérica ("non-2xx status code") no erro — a explicação
    // útil ("IA não configurada", "provedor não recebe áudio") está no CORPO,
    // que só é alcançável por err.context. Sem desembrulhar isso, quem opera
    // vê só "erro" e não sabe o que fazer.
    if (err) {
      let msg = err.message || "Falha ao processar a ata.";
      try {
        const body = await err.context?.json?.();
        if (body?.error) msg = body.error;
      } catch { /* corpo não era JSON — fica a mensagem genérica */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const aoParar = async () => {
    const out = await rec.stop();
    if (!out) { setError("Não veio áudio nenhum. Tente de novo."); return; }
    setPhase("processing");
    setError(null);
    try {
      let res;
      if (isClientMode) {
        // Sem lead_id ainda — manda o áudio embutido; o upload de verdade
        // acontece no Salvar, quando o destino já foi escolhido.
        pendingAudioRef.current = { file: out.file, mimeType: out.mimeType, seconds: out.durationSeconds };
        const audioBase64 = await blobToBase64(out.blob);
        res = await chamarIA({ audioBase64, mimeType: out.mimeType, durationSeconds: out.durationSeconds });
      } else {
        // `companyId` em camelCase: o objeto de lead no frontend já vem
        // mapeado por use-leads.js (rowToLead), não é a linha crua do banco.
        const anexo = await uploadAttachment(out.file, {
          leadId: lead.id, companyId: lead.companyId, uploadedBy: currentUser?.id || null,
        });
        if (!anexo?.file_path) throw new Error("Não foi possível guardar o áudio.");
        setAudioInfo({ path: anexo.file_path, name: anexo.file_name, seconds: out.durationSeconds });
        res = await chamarIA({ audioPath: anexo.file_path, mimeType: out.mimeType, durationSeconds: out.durationSeconds });
      }
      setDraft({ ...(res.structured || {}), transcricao: res.transcript || "" });
      setPhase("review");
    } catch (e) {
      setError(e.message);
      setPhase("idle");
    }
  };

  const aoEnviarTexto = async () => {
    if (!texto.trim()) return;
    setPhase("processing");
    setError(null);
    try {
      const res = await chamarIA({ text: texto.trim() });
      setDraft({ ...(res.structured || {}), transcricao: res.transcript || texto.trim() });
      setPhase("review");
    } catch (e) {
      setError(e.message);
      setPhase("idle");
    }
  };

  const descartar = () => {
    setDraft(null); setAudioInfo(null); setTexto(""); setTyping(false);
    setPhase("idle"); setError(null);
    pendingAudioRef.current = null;
    setDestino(negociosAbertos[0] ? `lead:${negociosAbertos[0].id}` : "novo");
    setGeo(null); setGeoStatus("idle"); setGeoAddress(null);
    setTripMatches([]); setTripId(null);
    // Invalida qualquer captura de GPS/busca de viagem ainda em voo desta
    // tentativa — uma resposta tardia não pode mais escrever em cima do
    // próximo "Gravar ata".
    captureSessionRef.current += 1;
  };

  const salvar = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    try {
      const resumo = (draft.resumo || "").trim() || "Ata de visita registrada.";
      const metaBase = {
        transcricao: draft.transcricao || null,
        proximoPasso: draft.proximo_passo || null,
        proximoPassoData: draft.proximo_passo_data || null,
        dor: draft.dor || null,
        objecao: draft.objecao || null,
        concorrente: draft.concorrente || null,
        temperatura: draft.temperatura || null,
        pessoas: Array.isArray(draft.pessoas) ? draft.pessoas : [],
      };

      let targetLeadId, targetCompanyId;
      if (isClientMode) {
        if (destino === "novo") {
          const novo = buildLeadFromClientAta(client, currentUser, draft, resumo);
          const salvo = await onCreateLead(novo);
          targetLeadId = salvo?.id || novo.id;
          targetCompanyId = salvo?.companyId || novo.companyId;
        } else {
          targetLeadId = destino.slice(5);
          targetCompanyId = negociosAbertos.find(l => l.id === targetLeadId)?.companyId;
        }
      } else {
        targetLeadId = lead.id;
      }

      // Modo client: o áudio só sobe agora, escopado ao lead que o destino
      // resolveu — ver cabeçalho do arquivo.
      let audioPath = audioInfo?.path || null;
      let audioSegundos = audioInfo?.seconds || null;
      const pending = pendingAudioRef.current;
      if (pending) {
        const anexo = await uploadAttachment(pending.file, {
          leadId: targetLeadId, companyId: targetCompanyId, uploadedBy: currentUser?.id || null,
        });
        audioPath = anexo?.file_path || null;
        audioSegundos = pending.seconds;
      }

      const location = geo ? {
        lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy,
        address: geoAddress || null,
        capturedAt: new Date().toISOString(),
      } : null;

      // Snapshot do rótulo da visita vinculada (não só o id) — pros dois
      // feeds de atividade (LeadDetailDrawer/ClientsManager) mostrarem
      // "12/08 — Química Amparo SA" sem precisar de um join a mais só pra
      // renderizar o card. Mesmo espírito do snapshot de campos por etapa
      // já usado no Histórico do funil.
      const tripSelecionada = tripId ? tripMatches.find(t => t.id === tripId) : null;
      const viagemLabel = tripSelecionada
        ? `${formatDateBR(tripSelecionada.data_planejada)} — ${tripSelecionada.destino_planejado || tripSelecionada.cliente_nome || "visita"}`
        : null;

      await onAddActivity(targetLeadId, {
        type: "ata_voz",
        userId: currentUser?.id || null,
        userName: currentUser?.name || null,
        body: resumo,
        meta: {
          ...metaBase,
          audioPath,
          audioSegundos,
          // Marca a origem: quem ler o histórico daqui a um ano precisa saber
          // que este texto passou por transcrição automática.
          origem: (audioPath || pending) ? "audio" : "texto",
          // Check-in de visita: localização sempre anexada (null só se o
          // navegador negou/não suportou) e o vínculo com a visita
          // planejada em Viagens, quando o vendedor confirmou uma.
          location,
          viagemRegistroId: tripId || null,
          viagemLabel,
        },
      });

      // Vincular a uma visita planejada também marca ela como realizada em
      // Viagens (decidido com o Daniel 17/08/2026) — reaproveita o mesmo
      // shape de campos que marcarRealizado (use-crm-viagens.js) já grava;
      // chamada direta aqui em vez de instanciar o hook inteiro só por essa
      // escrita (evitaria puxar fetch + subscription realtime da lista
      // completa de viagens só pra uma atualização pontual). Falha aqui
      // NUNCA derruba o salvamento da ata, que já aconteceu — é um bônus,
      // não a ação principal.
      if (tripId) {
        try {
          const { data: upd } = await supabase
            .from("crm_viagem_registros")
            .update({
              status: "realizado",
              destino_realizado: geoAddress || (geo ? `${geo.lat}, ${geo.lng}` : null),
              resumo_realizado: resumo,
              data_realizada: new Date().toISOString().slice(0, 10),
              updated_at: new Date().toISOString(),
            })
            .eq("id", tripId)
            .select();
          if (!upd || upd.length === 0) {
            console.warn("[AtaVozPanel] visita vinculada não foi marcada como realizada (RLS ou registro removido)");
          }
        } catch (e) {
          console.warn("[AtaVozPanel] falha ao marcar visita vinculada como realizada:", e?.message || e);
        }
      }

      // Só o follow-up é escrito de volta no lead, e só se a IA achou data.
      // Etapa do funil não se move sozinha (regra 3 do cabeçalho).
      // `nextFollowUp` em camelCase: patchToRow (use-leads.js) é quem traduz
      // pra coluna next_follow_up — mandar snake_case aqui seria ignorado.
      if (draft.proximo_passo_data && onUpdate) {
        await onUpdate(targetLeadId, { nextFollowUp: draft.proximo_passo_data });
      }
      descartar();
      onSaved?.();
    } catch (e) {
      setError(e.message || "Não foi possível salvar a ata.");
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  // ── Gravando ────────────────────────────────────────────────────────────
  if (rec.recording) {
    const perto = rec.seconds >= AUDIO_MAX_SECONDS - 30;
    return (
      <div className="rounded-xl p-5 text-center" style={{ border: "1px solid var(--accent)", background: "var(--surface-alt)" }}>
        <p className="flex items-center justify-center gap-2 m-0" style={{ fontSize: 26, fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.02em" }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: "var(--accent)", display: "inline-block" }} />
          {formatRecordingTime(rec.seconds)}
        </p>
        <p className="text-[11px] mt-1 mb-3" style={{ color: "var(--text-dim)" }}>
          {perto
            ? `Gravando — para sozinho em ${AUDIO_MAX_SECONDS - rec.seconds}s`
            : "Gravando — fale naturalmente, não precisa de roteiro"}
        </p>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] mb-3"
             style={{ background: "var(--surface)", border: "1px solid var(--border)", color: geoStatus === "denied" || geoStatus === "unsupported" ? "var(--text-faint)" : "var(--text-dim)" }}>
          <MapPin size={12} style={{ flexShrink: 0 }} />
          {(geoStatus === "capturing" || geoStatus === "idle") && "Capturando localização…"}
          {geoStatus === "ok" && "Localização capturada"}
          {geoStatus === "denied" && "Permissão negada"}
          {geoStatus === "unsupported" && "Sem suporte a localização"}
        </div>
        <div className="flex gap-2 justify-center">
          <button onClick={() => { rec.cancel(); descartar(); }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}>
            <X size={13} /> Cancelar
          </button>
          <button onClick={aoParar} data-tour="ata-voz-parar"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            <Square size={12} /> Parar e processar
          </button>
        </div>
      </div>
    );
  }

  // ── Processando ─────────────────────────────────────────────────────────
  if (phase === "processing") {
    return (
      <div className="rounded-xl p-7 text-center" style={{ border: "1px dashed var(--border)" }}>
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)", margin: "0 auto 10px" }} />
        <p className="text-[13px] font-semibold m-0" style={{ color: "var(--text)" }}>Organizando sua ata…</p>
        <p className="text-[11.5px] mt-1 m-0" style={{ color: "var(--text-dim)" }}>
          Transcrevendo e separando o que ficou combinado. Leva alguns segundos.
        </p>
      </div>
    );
  }

  // ── Conferência ─────────────────────────────────────────────────────────
  if (phase === "review" && draft) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
          <Sparkles size={13} style={{ color: "var(--accent)" }} />
          <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>O que entendi da sua ata</span>
          <span className="text-[10.5px] ml-auto" style={{ color: "var(--text-dim)" }}>confira antes de salvar</span>
        </div>

        <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Lbl tag="sempre anexada">Localização</Lbl>
          {(geoStatus === "ok" || geoStatus === "capturing") && (
            <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2" style={{ border: "1px solid var(--border)", background: "var(--surface-alt)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-none" style={{ background: "var(--accent-bg, var(--surface-alt))", color: "var(--accent)" }}>
                <MapPin size={14} />
              </div>
              <div className="min-w-0">
                {geoStatus === "capturing" && <span className="text-[12px] font-semibold" style={{ color: "var(--text-dim)" }}>Localizando…</span>}
                {geoStatus === "ok" && (
                  <>
                    <div className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>
                      {geoAddress || `${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`}
                    </div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                      {geoAddress && <span className="font-mono">{geo.lat.toFixed(4)}, {geo.lng.toFixed(4)} · </span>}
                      precisão ~{Math.round(geo.accuracy)}m ·{" "}
                      <a href={`https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`} target="_blank" rel="noreferrer" style={{ color: "var(--text-faint)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                        ver no mapa
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {(geoStatus === "denied" || geoStatus === "unsupported" || geoStatus === "idle") && (
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
              <MapPin size={12} style={{ flexShrink: 0 }} />
              {geoStatus === "unsupported" && "Este navegador não suporta localização — a ata é salva assim mesmo"}
              {geoStatus === "denied" && "Navegador negou a permissão — a ata é salva assim mesmo"}
              {geoStatus === "idle" && "Sem localização — só é capturada ao gravar por voz"}
            </div>
          )}
        </div>

        {tripMatches.length > 0 && (
          <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <Lbl tag={tripId ? "vinculado" : null}>Visita planejada</Lbl>
            <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2" style={{ border: "1px solid var(--border)", background: "var(--surface-alt)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-none" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                <Briefcase size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>
                  {tripId ? "Vincular a esta visita planejada" : "Escolha uma visita planejada, se for o caso"}
                </div>
                <div className="text-[10.5px] mt-0.5" style={{ color: "var(--text-faint)" }}>achamos pelo cliente + data</div>
              </div>
              <select value={tripId || ""} onChange={e => setTripId(e.target.value || null)}
                      className="rounded-lg border px-2 py-1.5 text-[11px] flex-none" style={{ ...inputStyle, width: "auto" }}>
                <option value="">Nenhuma</option>
                {tripMatches.map(t => (
                  <option key={t.id} value={t.id}>
                    {formatDateBR(t.data_planejada)} — {t.destino_planejado || t.cliente_nome || "visita"}
                    {t.status === "realizado" ? " (já realizada)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Lbl>Resumo</Lbl>
          <textarea rows={3} style={inputStyle} value={draft.resumo || ""}
                    onChange={e => set("resumo", e.target.value)}
                    placeholder="Resumo da visita" />
        </div>

        <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Lbl tag={draft.proximo_passo ? "vira follow-up" : null}>Próximo passo</Lbl>
          <input style={{ ...inputStyle, marginBottom: 6 }} value={draft.proximo_passo || ""}
                 onChange={e => set("proximo_passo", e.target.value)}
                 placeholder="Nada combinado — pode deixar vazio" />
          <input type="date" style={{ ...inputStyle, width: "auto" }} value={draft.proximo_passo_data || ""}
                 onChange={e => set("proximo_passo_data", e.target.value)} />
        </div>

        <div className="px-3.5 py-3 grid gap-3" style={{ borderBottom: "1px solid var(--border)", gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <Lbl>Dor identificada</Lbl>
            <input style={inputStyle} value={draft.dor || ""} onChange={e => set("dor", e.target.value)} placeholder="—" />
          </div>
          <div>
            <Lbl>Objeção</Lbl>
            <input style={inputStyle} value={draft.objecao || ""} onChange={e => set("objecao", e.target.value)} placeholder="—" />
          </div>
          <div>
            <Lbl>Concorrente citado</Lbl>
            <input style={inputStyle} value={draft.concorrente || ""} onChange={e => set("concorrente", e.target.value)} placeholder="—" />
          </div>
          <div>
            <Lbl>Temperatura</Lbl>
            <div className="inline-flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {TEMPERATURAS.map((t, i) => {
                const on = draft.temperatura === t.id;
                return (
                  <button key={t.id} onClick={() => set("temperatura", t.id)}
                          className="text-[10.5px] font-semibold px-2.5 py-1.5"
                          style={{
                            background: on ? "var(--accent)" : "var(--surface)",
                            color: on ? "var(--on-accent)" : "var(--text-dim)",
                            borderRight: i < TEMPERATURAS.length - 1 ? "1px solid var(--border)" : "none",
                          }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Destino — só em modo client (mockup "ata-no-cliente", aprovado
            13/08/2026). Sem negócio aberto, "Abrir oportunidade" já vem
            marcado. "Só registrar sem negócio" não está aqui — ver nota no
            cabeçalho do arquivo sobre a lacuna de armazenamento. */}
        {isClientMode && (
          <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <Lbl>Isso é sobre um negócio já aberto, ou algo novo?</Lbl>
            <div className="space-y-1.5 mt-1.5">
              {negociosAbertos.map(l => {
                const on = destino === `lead:${l.id}`;
                return (
                  <button key={l.id} onClick={() => setDestino(`lead:${l.id}`)}
                          className="w-full flex items-start gap-2 text-left rounded-lg px-2.5 py-2"
                          style={{ border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "var(--accent-bg, var(--surface-alt))" : "var(--surface)" }}>
                    {on ? <CheckCircle2 size={14} style={{ color: "var(--accent)", flex: "none", marginTop: 1 }} />
                        : <Circle size={14} style={{ color: "var(--text-dim)", flex: "none", marginTop: 1 }} />}
                    <span className="min-w-0">
                      <span className="text-[12px] font-bold block" style={{ color: "var(--text)" }}>{l.company}</span>
                      <span className="text-[10.5px]" style={{ color: "var(--text-dim)" }}>
                        A ata entra na atividade dele — a etapa continua sendo você quem move.
                      </span>
                    </span>
                  </button>
                );
              })}
              <button onClick={() => setDestino("novo")}
                      className="w-full flex items-start gap-2 text-left rounded-lg px-2.5 py-2"
                      style={{ border: `1.5px solid ${destino === "novo" ? "var(--accent)" : "var(--border)"}`, background: destino === "novo" ? "var(--accent-bg, var(--surface-alt))" : "var(--surface)" }}>
                {destino === "novo" ? <CheckCircle2 size={14} style={{ color: "var(--accent)", flex: "none", marginTop: 1 }} />
                                     : <Circle size={14} style={{ color: "var(--text-dim)", flex: "none", marginTop: 1 }} />}
                <span className="min-w-0">
                  <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>
                    Abrir oportunidade
                  </span>
                  <span className="text-[10.5px] block" style={{ color: "var(--text-dim)" }}>
                    {negociosAbertos.length === 0
                      ? "Nenhum negócio aberto com este cliente hoje. Cria um na 1ª etapa do funil, com o resumo e o próximo passo já preenchidos."
                      : "Cria um negócio novo na 1ª etapa do funil, já com o resumo e o próximo passo desta ata."}
                  </span>
                </span>
              </button>
            </div>
          </div>
        )}

        {draft.transcricao && (
          <details className="px-3.5 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <summary className="text-[11px] cursor-pointer" style={{ color: "var(--accent)" }}>
              Ver transcrição completa
            </summary>
            <p className="text-[11.5px] mt-2 mb-0 whitespace-pre-wrap" style={{ color: "var(--text-dim)", lineHeight: 1.6 }}>
              {draft.transcricao}
            </p>
          </details>
        )}

        {error && (
          <div className="px-3.5 py-2 text-[11.5px] flex items-center gap-1.5" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            <AlertTriangle size={12} /> {error}
          </div>
        )}

        <div className="px-3.5 py-2.5 flex items-center gap-2 flex-wrap" style={{ background: "var(--surface-alt)" }}>
          <button onClick={salvar} disabled={saving || geoStatus === "capturing"}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: (saving || geoStatus === "capturing") ? 0.6 : 1 }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />} Salvar ata
          </button>
          <button onClick={descartar} disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}>
            Descartar
          </button>
          <span className="text-[10.5px] ml-auto" style={{ color: "var(--text-dim)" }}>
            {geoStatus === "capturing" ? "aguardando localização…" : "nada foi gravado ainda"}
          </span>
        </div>
      </div>
    );
  }

  // ── Início ──────────────────────────────────────────────────────────────
  // Mesma casca, mesmo tamanho de botão em modo lead ou cliente, e em modo
  // cliente independente de o histórico estar vazio ou populado — quem chama
  // (LeadDetailDrawer/ClientTimelinePanel) sempre renderiza este bloco antes
  // do próprio conteúdo, nunca uma versão "compacta" alternativa (achado do
  // Daniel 13/08/2026: o botão mudava de tamanho ao sair do estado vazio).
  return (
    <div className="rounded-xl px-4 py-5 text-center" style={{ border: "1px dashed var(--border)" }}>
      <Mic size={22} style={{ color: "var(--text-dim)", margin: "0 auto 8px" }} />
      <p className="text-[13.5px] font-bold m-0" style={{ color: "var(--text)" }}>
        {isClientMode ? "Registre uma conversa falando" : "Registre a visita falando"}
      </p>
      <p className="text-[11.5px] mt-1 mb-3.5 mx-auto" style={{ color: "var(--text-dim)", maxWidth: "42ch", lineHeight: 1.5 }}>
        {isClientMode
          ? "Visita, ligação ou reunião com este cliente — mesmo sem negócio aberto. Fale o que aconteceu; você confere antes de salvar."
          : "Acabou de sair da reunião? Fale o que aconteceu. A IA transcreve, organiza e você confere antes de salvar."}
      </p>

      {(error || rec.error) && (
        <div className="rounded-lg px-3 py-2 mb-3 text-[11.5px] flex items-center gap-1.5 justify-center"
             style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          <AlertTriangle size={12} style={{ flex: "none" }} /> {error || rec.error}
        </div>
      )}

      {typing ? (
        <div className="text-left">
          <textarea rows={4} style={inputStyle} value={texto} autoFocus
                    onChange={e => setTexto(e.target.value)}
                    placeholder="Escreva o que aconteceu — a IA organiza do mesmo jeito." />
          <div className="flex gap-2 mt-2">
            <button onClick={aoEnviarTexto} disabled={!texto.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold"
                    style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: texto.trim() ? 1 : 0.5 }}>
              <Sparkles size={12} /> Organizar
            </button>
            <button onClick={() => { setTyping(false); setTexto(""); }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border"
                    style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={async () => {
              if (startingRef.current || rec.recording) return; // duplo clique — já em andamento
              startingRef.current = true;
              try {
                setError(null);
                const session = ++captureSessionRef.current;
                capturarLocalizacao(session);
                buscarVisitaPlanejada(session);
                await rec.start();
              } finally {
                startingRef.current = false;
              }
            }}
            disabled={!podeIA || !rec.supported}
            data-tour="ata-voz-gravar"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold"
            style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: (podeIA && rec.supported) ? 1 : 0.5 }}
          >
            <Mic size={14} /> Gravar ata
          </button>
          <div className="mt-2">
            <button
              onClick={() => {
                // Se "Gravar ata" tinha acabado de ser clicado (prompt de
                // permissão do navegador ainda aberto) e a pessoa trocou pra
                // "escrever à mão" antes de `rec.start()` resolver, a captura
                // de GPS/visita já disparada ficava "no ar" — invalida a
                // sessão pra ela nunca preencher/travar o Salvar desta ata
                // digitada (achado real de QA).
                captureSessionRef.current += 1;
                setGeo(null); setGeoStatus("idle"); setGeoAddress(null);
                setTripMatches([]); setTripId(null);
                setTyping(true);
              }}
              className="inline-flex items-center gap-1 text-[11px]"
              style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
              <PencilLine size={11} /> ou escrever à mão
            </button>
          </div>
          <p className="flex items-center justify-center gap-1 mt-3 mb-0" style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-faint)" }}>
            <MapPin size={11} style={{ flexShrink: 0 }} />
            Sua localização é sempre registrada com esta ata
          </p>
          {!rec.supported && (
            <p className="text-[10.5px] mt-2 mb-0" style={{ color: "var(--text-dim)" }}>
              Este navegador não grava áudio — use "escrever à mão".
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default AtaVozPanel;
