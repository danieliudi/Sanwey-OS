import React, { useMemo, useState } from "react";
import {
  Plane,
  MapPin,
  Receipt,
  Sparkles,
  Check,
  X,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useCRMViagens } from "../../hooks/use-crm-viagens";
import { useCRMDespesas } from "../../hooks/use-crm-despesas";
import { useAI } from "../../hooks/use-ai";
import { viagemCrossCheckPrompt } from "../../constants/ai-prompts";
import { Badge } from "../ui/Badge";
import { formatDateBR } from "../../utils/date";
import { COMERCIAL_ROLES, todayISO, monthKeyOf, monthLabel, fmtMoney, STATUS_VISITA, STATUS_REEMBOLSO } from "../../utils/viagens";

const COMPROVANTE_OBRIGATORIO_ACIMA_DE = 100;

function isAtrasado(registro, today) {
  return registro.status === "planejado" && !!registro.data_planejada && registro.data_planejada < today;
}

// ── Estilos compartilhados ───────────────────────────────────────────────────

const cardSt = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 };

const sectionHeaderSt = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 };

const inputSt = {
  borderColor: "var(--border)",
  color: "var(--text)",
  background: "var(--surface-alt)",
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid var(--border)",
  padding: "6px 10px",
};

const thSt = { fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" };

const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };

const errorBannerSt = { background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginTop: 10 };

function btnStyle(kind, disabled, big) {
  // big=true: alvo de toque ~40px pra ações de decisão de reembolso no celular
  const base = { display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 8, padding: big ? "10px 14px" : "5px 10px", fontSize: big ? 13 : 11, fontWeight: 700, border: "none", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1, minHeight: big ? 40 : undefined };
  if (kind === "primary") return { ...base, background: "var(--accent)", color: "var(--on-accent)" };
  if (kind === "danger")  return { ...base, background: "var(--danger)", color: "var(--on-danger)" };
  return { ...base, background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border)" };
}

// ── Subcomponentes ───────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ padding: "32px 16px", gap: 8 }}>
      <Icon size={26} style={{ color: "var(--text-faint)" }} />
      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{text}</div>
    </div>
  );
}

function Desfecho({ registro }) {
  if (registro.status === "realizado") {
    return (
      <div>
        <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{registro.destino_realizado || registro.destino_planejado || "—"}</div>
        {registro.resumo_realizado && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{registro.resumo_realizado}</div>}
      </div>
    );
  }
  if (registro.status === "nao_realizado") {
    return <div style={{ fontSize: 11, color: "var(--danger)" }}>{registro.motivo_divergencia || "Motivo não informado"}</div>;
  }
  if (registro.status === "cancelado") {
    return <div style={{ fontSize: 11, color: "var(--text-faint)" }}>—</div>;
  }
  return <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Aguardando visita</div>;
}

function VisitaCardMobile({ registro: r, showVendedorCol, nomePorId, today }) {
  const atrasado = isAtrasado(r, today);
  const destaque = atrasado || r.status === "nao_realizado";
  const badge = STATUS_VISITA[r.status] || STATUS_VISITA.planejado;
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 12,
        background: destaque ? "var(--danger-bg)" : "transparent",
        borderLeft: destaque ? "3px solid var(--danger)" : "3px solid transparent",
      }}
    >
      {showVendedorCol && (
        <div style={{ marginBottom: 8 }}>
          <span style={labelSt}>Vendedor</span>
          <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{nomePorId.get(r.vendedor_id) || "—"}</div>
        </div>
      )}
      <div style={{ marginBottom: 8 }}>
        <span style={labelSt}>Destino planejado</span>
        <div style={{ fontSize: 12, color: "var(--text)" }}>{r.destino_planejado || "—"}</div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={labelSt}>Data planejada</span>
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          {formatDateBR(r.data_planejada)}
          {atrasado && <span style={{ fontSize: 10, color: "var(--danger)", fontWeight: 700, marginLeft: 6 }}>Atrasado</span>}
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={labelSt}>Status</span>
        <div><Badge variant={badge.variant}>{badge.label}</Badge></div>
      </div>
      <div>
        <span style={labelSt}>Desfecho</span>
        <Desfecho registro={r} />
      </div>
    </div>
  );
}

function VisitasTable({ registros, showVendedorCol, nomePorId, today }) {
  const gridCols = showVendedorCol
    ? "130px 130px 90px minmax(130px,1fr) 110px minmax(180px,1.3fr)"
    : "130px 90px minmax(130px,1fr) 110px minmax(180px,1.3fr)";

  return (
    <>
      <div className="flex flex-col md:hidden" style={{ gap: 8 }}>
        {registros.map((r) => (
          <VisitaCardMobile key={r.id} registro={r} showVendedorCol={showVendedorCol} nomePorId={nomePorId} today={today} />
        ))}
      </div>
      <div className="hidden md:block" style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 760 }}>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 10, padding: "0 10px 8px", borderBottom: "1px solid var(--border)" }}>
          {showVendedorCol && <div style={thSt}>Vendedor</div>}
          <div style={thSt}>Destino planejado</div>
          <div style={thSt}>Data planejada</div>
          <div style={thSt}>Objetivo</div>
          <div style={thSt}>Status</div>
          <div style={thSt}>Desfecho</div>
        </div>
        {registros.map((r) => {
          const atrasado = isAtrasado(r, today);
          const destaque = atrasado || r.status === "nao_realizado";
          const badge = STATUS_VISITA[r.status] || STATUS_VISITA.planejado;
          return (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: gridCols,
                gap: 10,
                padding: "10px",
                borderRadius: 8,
                marginTop: 4,
                alignItems: "start",
                background: destaque ? "var(--danger-bg)" : "transparent",
                borderLeft: destaque ? "3px solid var(--danger)" : "3px solid transparent",
              }}
            >
              {showVendedorCol && <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{nomePorId.get(r.vendedor_id) || "—"}</div>}
              <div style={{ fontSize: 12, color: "var(--text)" }}>{r.destino_planejado || "—"}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                {formatDateBR(r.data_planejada)}
                {atrasado && <div style={{ fontSize: 10, color: "var(--danger)", fontWeight: 700, marginTop: 2 }}>Atrasado</div>}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{r.objetivo || "—"}</div>
              <div><Badge variant={badge.variant}>{badge.label}</Badge></div>
              <Desfecho registro={r} />
            </div>
          );
        })}
      </div>
      </div>
    </>
  );
}

function DespesaRow({ despesa, vendedorNome, deciding, isRejecting, rejectObs, setRejectObs, onVerComprovante, onAprovar, onRejeitarClick, onCancelarRejeicao, onConfirmarRejeicao, onMarcarPago }) {
  const iaValor = despesa.ia_extraido?.valor;
  const divergente = iaValor != null && Number(iaValor) !== Number(despesa.valor);
  const badge = STATUS_REEMBOLSO[despesa.status_reembolso] || STATUS_REEMBOLSO.pendente;
  const faltaComprovanteObrigatorio = Number(despesa.valor) > COMPROVANTE_OBRIGATORIO_ACIMA_DE && !despesa.comprovante_path;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
      <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
        {vendedorNome && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{vendedorNome}</span>}
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{despesa.categoria}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{fmtMoney(despesa.valor)}</span>
        {divergente && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "var(--warning)", background: "var(--warning-bg)", border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)", borderRadius: 99, padding: "2px 8px" }}>
            <AlertTriangle size={11} /> Comprovante mostra {fmtMoney(iaValor)}
          </span>
        )}
        {faltaComprovanteObrigatorio && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "var(--danger)", background: "var(--danger-bg)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)", borderRadius: 99, padding: "2px 8px" }}>
            <AlertTriangle size={11} /> Sem comprovante (obrigatório acima de {fmtMoney(COMPROVANTE_OBRIGATORIO_ACIMA_DE)})
          </span>
        )}
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{formatDateBR(despesa.data_despesa)}</span>
        <span style={{ marginLeft: "auto" }}><Badge variant={badge.variant}>{badge.label}</Badge></span>
      </div>

      {despesa.descricao && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>{despesa.descricao}</div>}

      <div className="flex items-center flex-wrap" style={{ gap: 8, marginTop: 8 }}>
        {despesa.comprovante_path && (
          <button onClick={onVerComprovante} style={btnStyle("ghost", false)}>
            <ExternalLink size={12} /> Ver comprovante
          </button>
        )}
        {despesa.status_reembolso === "pendente" && !isRejecting && (
          <>
            <button onClick={onAprovar} disabled={deciding} style={btnStyle("primary", deciding, true)}>
              <Check size={12} /> Aprovar
            </button>
            <button onClick={onRejeitarClick} disabled={deciding} style={btnStyle("danger", deciding, true)}>
              <X size={12} /> Rejeitar
            </button>
          </>
        )}
        {despesa.status_reembolso === "aprovado" && (
          <button onClick={onMarcarPago} disabled={deciding} style={btnStyle("primary", deciding, true)}>
            Marcar como pago
          </button>
        )}
      </div>

      {isRejecting && (
        <div style={{ marginTop: 10, padding: 10, background: "var(--surface-alt)", borderRadius: 8 }}>
          <label style={labelSt}>Motivo da rejeição (obrigatório)</label>
          <textarea
            value={rejectObs}
            onChange={(e) => setRejectObs(e.target.value)}
            rows={2}
            style={{ ...inputSt, width: "100%", resize: "vertical" }}
            autoFocus
          />
          <div className="flex" style={{ gap: 8, marginTop: 8 }}>
            <button onClick={onConfirmarRejeicao} disabled={!rejectObs.trim() || deciding} style={btnStyle("danger", !rejectObs.trim() || deciding, true)}>
              Confirmar rejeição
            </button>
            <button onClick={onCancelarRejeicao} style={btnStyle("ghost", false, true)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── View principal ───────────────────────────────────────────────────────────

export function CRMViagensGestorView({ currentUser, users }) {
  const { registros, loading: loadingRegistros } = useCRMViagens({ userId: currentUser?.id });
  const { despesas, loading: loadingDespesas, getComprovanteUrl, decidirReembolso } = useCRMDespesas({ userId: currentUser?.id });
  const { complete, isConfigured } = useAI(currentUser);

  const [selectedMonth, setSelectedMonth] = useState(() => todayISO().slice(0, 7));
  const [selectedVendedorId, setSelectedVendedorId] = useState("todos");

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiResult, setAiResult] = useState(null);

  const [comprovanteError, setComprovanteError] = useState(null);
  const [decidingId, setDecidingId] = useState(null);
  const [decisaoError, setDecisaoError] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectObs, setRejectObs] = useState("");

  const vendedoresComerciais = useMemo(
    () => (users || []).filter((u) => (u.roles?.length ? u.roles : [u.role]).some(r => COMERCIAL_ROLES.has(r))),
    [users]
  );

  const nomePorId = useMemo(() => {
    const map = new Map();
    (users || []).forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const registrosFiltrados = useMemo(() => {
    return (registros || [])
      .filter((r) => monthKeyOf(r.mes_referencia) === selectedMonth)
      .filter((r) => selectedVendedorId === "todos" || r.vendedor_id === selectedVendedorId)
      .sort((a, b) => String(a.data_planejada || "").localeCompare(String(b.data_planejada || "")));
  }, [registros, selectedMonth, selectedVendedorId]);

  const despesasFiltradas = useMemo(() => {
    return (despesas || [])
      .filter((d) => monthKeyOf(d.mes_referencia) === selectedMonth)
      .filter((d) => selectedVendedorId === "todos" || d.vendedor_id === selectedVendedorId);
  }, [despesas, selectedMonth, selectedVendedorId]);

  const despesasParaDecidir = useMemo(() => {
    return despesasFiltradas
      .filter((d) => d.status_reembolso === "pendente" || d.status_reembolso === "aprovado")
      .sort((a, b) => String(b.data_despesa || "").localeCompare(String(a.data_despesa || "")));
  }, [despesasFiltradas]);

  const vendedorSelecionado = selectedVendedorId === "todos"
    ? null
    : vendedoresComerciais.find((v) => v.id === selectedVendedorId);

  const today = todayISO();

  async function handleAnalisar() {
    if (!vendedorSelecionado) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const messages = viagemCrossCheckPrompt(vendedorSelecionado.name, monthLabel(selectedMonth), registrosFiltrados, despesasFiltradas);
      const text = await complete(messages, { maxTokens: 900 });
      setAiResult(text);
    } catch (e) {
      setAiError(e.message || "Não foi possível analisar agora.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleVerComprovante(despesa) {
    if (!despesa.comprovante_path) return;
    setComprovanteError(null);
    try {
      const url = await getComprovanteUrl(despesa.comprovante_path);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setComprovanteError(e.message || "Não foi possível abrir o comprovante.");
    }
  }

  async function handleAprovar(despesa) {
    // Comprovante obrigatório acima de um valor — prática padrão em
    // Concur/Expensify/Ramp (itemized receipt threshold), evita reembolso
    // de valor alto sem nota fiscal anexada.
    if (Number(despesa.valor) > COMPROVANTE_OBRIGATORIO_ACIMA_DE && !despesa.comprovante_path) {
      alert(`Não dá pra aprovar: despesas acima de ${fmtMoney(COMPROVANTE_OBRIGATORIO_ACIMA_DE)} exigem comprovante anexado.`);
      return;
    }
    setDecidingId(despesa.id);
    setDecisaoError(null);
    try {
      await decidirReembolso(despesa.id, "aprovado", despesa.observacao_gestor || null);
    } catch (e) {
      setDecisaoError(e.message || "Não foi possível aprovar a despesa.");
    } finally {
      setDecidingId(null);
    }
  }

  async function handleMarcarPago(despesa) {
    setDecidingId(despesa.id);
    setDecisaoError(null);
    try {
      await decidirReembolso(despesa.id, "pago", despesa.observacao_gestor || null);
    } catch (e) {
      setDecisaoError(e.message || "Não foi possível marcar como pago.");
    } finally {
      setDecidingId(null);
    }
  }

  async function handleConfirmarRejeicao(despesa) {
    if (!rejectObs.trim()) return;
    setDecidingId(despesa.id);
    setDecisaoError(null);
    try {
      await decidirReembolso(despesa.id, "rejeitado", rejectObs.trim());
      setRejectingId(null);
      setRejectObs("");
    } catch (e) {
      setDecisaoError(e.message || "Não foi possível rejeitar a despesa.");
    } finally {
      setDecidingId(null);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div style={cardSt}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Supabase não configurado</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Configure a conexão com o Supabase para gerenciar viagens e reembolsos.</div>
      </div>
    );
  }

  const loading = loadingRegistros || loadingDespesas;
  const showVendedorCol = selectedVendedorId === "todos";

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <div className="flex items-center flex-wrap" style={{ gap: 12 }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Plane size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Viagens & Despesas</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Visão do gestor</div>
          </div>
        </div>

        <div className="flex items-center flex-wrap" style={{ gap: 8, marginLeft: "auto" }}>
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={inputSt} />
          <select value={selectedVendedorId} onChange={(e) => setSelectedVendedorId(e.target.value)} style={inputSt}>
            <option value="todos">Todos os vendedores</option>
            {vendedoresComerciais.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={cardSt}>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Carregando...</div>
        </div>
      ) : (
        <>
          <section style={cardSt}>
            <div style={sectionHeaderSt}>
              <MapPin size={16} style={{ color: "var(--text-dim)" }} />
              Visitas do mês — {monthLabel(selectedMonth)}
            </div>
            {registrosFiltrados.length === 0 ? (
              <EmptyState icon={MapPin} text="Nenhuma visita planejada neste mês." />
            ) : (
              <VisitasTable registros={registrosFiltrados} showVendedorCol={showVendedorCol} nomePorId={nomePorId} today={today} />
            )}
          </section>

          <section style={cardSt}>
            <div className="flex items-center justify-between flex-wrap" style={{ gap: 10 }}>
              <div className="flex items-center" style={{ gap: 8 }}>
                <Sparkles size={16} style={{ color: "#7C3AED" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Análise cruzada por IA</span>
              </div>

              {isConfigured ? (
                <button onClick={handleAnalisar} disabled={!vendedorSelecionado || aiLoading} style={btnStyle("primary", !vendedorSelecionado || aiLoading)}>
                  {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {aiResult ? "Analisar novamente" : "Analisar com IA"}
                </button>
              ) : (
                <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Configure sua LLM em Configurações → Integrações para usar esta função.</span>
              )}
            </div>

            {isConfigured && !vendedorSelecionado && (
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>Selecione um vendedor específico para analisar.</div>
            )}

            {aiError && <div style={errorBannerSt}>{aiError}</div>}

            {aiResult && (
              <div style={{ marginTop: 12, background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 10, padding: 14, fontSize: 12.5, color: "#4C1D95", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                {aiResult}
              </div>
            )}
          </section>

          <section style={cardSt}>
            <div style={sectionHeaderSt}>
              <Receipt size={16} style={{ color: "var(--text-dim)" }} />
              Despesas pendentes de aprovação
            </div>

            {comprovanteError && <div style={errorBannerSt}>{comprovanteError}</div>}
            {decisaoError && <div style={errorBannerSt}>{decisaoError}</div>}

            {despesasParaDecidir.length === 0 ? (
              <EmptyState icon={Receipt} text="Nenhuma despesa pendente de decisão neste mês." />
            ) : (
              <div className="flex flex-col" style={{ gap: 8 }}>
                {despesasParaDecidir.map((d) => (
                  <DespesaRow
                    key={d.id}
                    despesa={d}
                    vendedorNome={showVendedorCol ? (nomePorId.get(d.vendedor_id) || "—") : null}
                    deciding={decidingId === d.id}
                    isRejecting={rejectingId === d.id}
                    rejectObs={rejectObs}
                    setRejectObs={setRejectObs}
                    onVerComprovante={() => handleVerComprovante(d)}
                    onAprovar={() => handleAprovar(d)}
                    onRejeitarClick={() => { setRejectingId(d.id); setRejectObs(""); }}
                    onCancelarRejeicao={() => { setRejectingId(null); setRejectObs(""); }}
                    onConfirmarRejeicao={() => handleConfirmarRejeicao(d)}
                    onMarcarPago={() => handleMarcarPago(d)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default CRMViagensGestorView;
