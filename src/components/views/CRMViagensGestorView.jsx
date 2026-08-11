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
  Send,
  Inbox,
  CalendarDays,
  List,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useCRMViagens } from "../../hooks/use-crm-viagens";
import { useCRMDespesas } from "../../hooks/use-crm-despesas";
import { useCRMViagemPrestacoes } from "../../hooks/use-crm-viagem-prestacoes";
import { useAI } from "../../hooks/use-ai";
import { viagemCrossCheckPrompt } from "../../constants/ai-prompts";
import { Badge } from "../ui/Badge";
import { formatDateBR, parseDateInput } from "../../utils/date";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { COMERCIAL_ROLES, todayISO, monthKeyOf, monthLabel, fmtMoney, STATUS_VISITA, STATUS_REEMBOLSO, STATUS_PRESTACAO, TIPO_SAIDA, computeViagemDivergencias } from "../../utils/viagens";
import { ViewToggleButton } from "../shared/ViewToggleButton";

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

// ── Calendário do time (semana, uma linha por vendedor) ─────────────────────
// Decidido com o Daniel 11/08/2026: semana (não mês) porque é o que responde
// "quem está fora nos próximos dias" num relance — um mês com uma linha por
// pessoa vira parede de bolinhas. Mostra só status="planejado" (decisão do
// Daniel: despesa é o que já aconteceu, não "o que vem por aí"). Não precisa
// de policy nova — a RLS de crm_viagem_registros já dá o time inteiro pro
// gerente via current_user_manages_viagem_of(); este componente só desenha o
// que a query já devolve.

const WEEKDAYS_FULL_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const TIPO_DOT_COLOR = { visita: "#3B5BC0", evento: "#0F8A6A", outra: "#8A6A1F" };

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}
function avatarColor(id) {
  const palette = ["#3B5BC0", "#6D3FBF", "#A5389B", "#0F8A6A", "#1F7A9E", "#8A6A1F"];
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}
function weekKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function TeamWeekCalendar({ registros, vendedores, nomePorId, onSelect }) {
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  }), [weekStart]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // dia -> vendedor -> registros — bucket único, reaproveitado por linha.
  const byDayByVendedor = useMemo(() => {
    const map = new Map();
    for (const r of registros) {
      if (!r.data_planejada) continue;
      const d = parseDateInput(r.data_planejada);
      const dk = weekKey(d);
      if (!map.has(dk)) map.set(dk, new Map());
      const porVendedor = map.get(dk);
      if (!porVendedor.has(r.vendedor_id)) porVendedor.set(r.vendedor_id, []);
      porVendedor.get(r.vendedor_id).push(r);
    }
    return map;
  }, [registros]);

  const rangeLabel = `${days[0].getDate()} de ${monthLabelShort(days[0])} – ${days[6].getDate()} de ${monthLabelShort(days[6])}`;

  return (
    <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-4 py-3 flex items-center justify-between border-b flex-wrap" style={{ borderColor: "var(--border)", gap: 8 }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}
            className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-dim)", background: "none", border: "none" }} aria-label="Semana anterior">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}
            className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-dim)", background: "none", border: "none" }} aria-label="Próxima semana">
            <ChevronRight size={16} />
          </button>
          <h3 className="font-semibold" style={{ fontSize: 13, color: "var(--text)" }}>{rangeLabel}</h3>
        </div>
        <button onClick={() => setWeekStart(() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d; })}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
          Esta semana
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 760 }}>
          <div style={{ display: "grid", gridTemplateColumns: "150px repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
            <div />
            {days.map((d, i) => (
              <div key={i} className="px-2 py-2 text-center" style={{ background: "var(--surface-alt)" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-dim)" }}>{WEEKDAYS_FULL_PT[d.getDay()]}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: sameDateAs(d, today) ? "var(--accent)" : "var(--text)" }}>{d.getDate()}</div>
              </div>
            ))}
          </div>

          {vendedores.length === 0 ? (
            <div style={{ padding: "24px 12px" }}><EmptyState icon={CalendarDays} text="Nenhum vendedor pra mostrar." /></div>
          ) : vendedores.map((v) => (
            <div key={v.id} style={{ display: "grid", gridTemplateColumns: "150px repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center" style={{ gap: 8, padding: "10px 12px" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", background: avatarColor(v.id) }}>
                  {initials(nomePorId.get(v.id) || v.name)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 650, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomePorId.get(v.id) || v.name}</div>
                  {v.sectors?.length > 0 && <div style={{ fontSize: 10, color: "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.sectors.join(", ")}</div>}
                </div>
              </div>
              {days.map((d, i) => {
                const isToday = sameDateAs(d, today);
                const itens = byDayByVendedor.get(weekKey(d))?.get(v.id) || [];
                return (
                  <div key={i} style={{ borderLeft: "1px solid var(--border)", padding: "6px 5px", minHeight: 48, display: "flex", flexDirection: "column", gap: 3, background: isToday ? "var(--surface-alt)" : "transparent" }}>
                    {itens.map((r) => {
                      const color = TIPO_DOT_COLOR[r.tipo] || TIPO_DOT_COLOR.visita;
                      const label = TIPO_SAIDA[r.tipo]?.label || "Visita";
                      return (
                        <span
                          key={r.id}
                          onClick={() => onSelect?.(r)}
                          title={`${label} · ${r.destino_planejado || ""}${r.cliente_nome ? ` · ${r.cliente_nome}` : ""}`}
                          style={{ fontSize: 10, fontWeight: 700, padding: "3px 6px", borderRadius: 6, color: "#fff", background: color, cursor: onSelect ? "pointer" : "default", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {r.destino_planejado || label}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function sameDateAs(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function monthLabelShort(d) {
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
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

// ── Prestação de contas ──────────────────────────────────────────────────────
// Fila de lotes de despesas (spec "Prestação de contas", 10/08/2026) — decide
// o lote inteiro de uma vez, em vez de despesa por despesa. Despesa avulsa
// (fora de prestação) continua na lista de baixo, decidida direto, sem
// depender disso (decisão 1 da spec).

function PrestacaoQueueRow({ prestacao, vendedorNome, count, valor, onClick }) {
  const info = STATUS_PRESTACAO[prestacao.status] || STATUS_PRESTACAO.rascunho;
  return (
    <div
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
        {(vendedorNome || "—").split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{vendedorNome} — {prestacao.titulo}</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{count} {count === 1 ? "despesa" : "despesas"}</div>
      </div>
      <Badge variant={info.variant}>{info.label}</Badge>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMoney(valor)}</div>
      <button style={btnStyle("ghost", false)}>Analisar →</button>
    </div>
  );
}

function PrestacaoDecisaoModal({ prestacao, despesas, vendedorNome, onVerComprovante, onDecidirItem, onDecidirLote, onMarcarPago, onClose }) {
  useEscToClose(onClose);
  const info = STATUS_PRESTACAO[prestacao.status] || STATUS_PRESTACAO.rascunho;
  const total = despesas.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [rejeitandoLote, setRejeitandoLote] = useState(false);
  const [motivoLote, setMotivoLote] = useState("");
  const [decidingItemId, setDecidingItemId] = useState(null);
  const [rejeitandoItemId, setRejeitandoItemId] = useState(null);
  const [motivoItem, setMotivoItem] = useState("");

  const handleDecidirItem = async (despesa, status, motivo) => {
    setDecidingItemId(despesa.id);
    setError(null);
    try {
      await onDecidirItem(despesa, status, motivo);
      setRejeitandoItemId(null);
      setMotivoItem("");
    } catch (err) {
      setError(err?.message || "Não foi possível decidir esta despesa.");
    } finally {
      setDecidingItemId(null);
    }
  };

  const handleAprovarTudo = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDecidirLote(prestacao.id, "aprovado", null);
      onClose();
    } catch (err) {
      setError(err?.message || "Não foi possível aprovar a prestação.");
      setBusy(false);
    }
  };

  const handleConfirmarRejeicaoLote = async () => {
    if (!motivoLote.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onDecidirLote(prestacao.id, "rejeitado", motivoLote.trim());
      onClose();
    } catch (err) {
      setError(err?.message || "Não foi possível rejeitar a prestação.");
      setBusy(false);
    }
  };

  const handleMarcarPago = async () => {
    setBusy(true);
    setError(null);
    try {
      await onMarcarPago(prestacao.id);
      onClose();
    } catch (err) {
      setError(err?.message || "Não foi possível marcar como paga.");
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 999 }} onClick={onClose} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: "var(--surface)", zIndex: 1000, display: "flex", flexDirection: "column", boxShadow: "var(--shadow-pop)", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{vendedorNome}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{prestacao.titulo} · <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMoney(total)}</span></div>
            <div style={{ marginTop: 8 }}><Badge variant={info.variant}>{info.label}</Badge></div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex", flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", flex: 1 }}>
          <div style={labelSt}>Despesas ({despesas.length})</div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 18 }}>
            {despesas.map((d) => {
              const dinfo = STATUS_REEMBOLSO[d.status_reembolso] || STATUS_REEMBOLSO.pendente;
              const podeDecidir = prestacao.status === "enviada" && d.status_reembolso === "pendente";
              return (
                <div key={d.id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{d.categoria}</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{formatDateBR(d.data_despesa)}</div>
                    </div>
                    {d.comprovante_path && (
                      <button onClick={() => onVerComprovante(d)} title="Ver comprovante" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", display: "flex", padding: 2 }}>
                        <ExternalLink size={13} />
                      </button>
                    )}
                    <div style={{ fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(d.valor)}</div>
                    {podeDecidir && rejeitandoItemId !== d.id ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => handleDecidirItem(d, "aprovado", null)}
                          disabled={decidingItemId === d.id}
                          title="Aprovar"
                          style={{ width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--success-bg)", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)", cursor: decidingItemId === d.id ? "default" : "pointer" }}
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => { setRejeitandoItemId(d.id); setMotivoItem(""); }}
                          disabled={decidingItemId === d.id}
                          title="Rejeitar"
                          style={{ width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)", cursor: decidingItemId === d.id ? "default" : "pointer" }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : podeDecidir ? null : (
                      <Badge variant={dinfo.variant}>{dinfo.label}</Badge>
                    )}
                  </div>
                  {podeDecidir && rejeitandoItemId === d.id && (
                    <div style={{ marginTop: 8, padding: 8, background: "var(--surface-alt)", borderRadius: 8 }}>
                      <label style={{ ...labelSt, marginBottom: 4 }}>Motivo da rejeição (obrigatório)</label>
                      <textarea value={motivoItem} onChange={(e) => setMotivoItem(e.target.value)} rows={2} style={{ ...inputSt, width: "100%", resize: "vertical" }} autoFocus />
                      <div className="flex" style={{ gap: 6, marginTop: 6 }}>
                        <button
                          onClick={() => handleDecidirItem(d, "rejeitado", motivoItem.trim())}
                          disabled={!motivoItem.trim() || decidingItemId === d.id}
                          style={{ ...btnStyle("danger", !motivoItem.trim() || decidingItemId === d.id), padding: "5px 10px" }}
                        >
                          Confirmar
                        </button>
                        <button onClick={() => { setRejeitandoItemId(null); setMotivoItem(""); }} style={{ ...btnStyle("ghost", false), padding: "5px 10px" }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  {d.status_reembolso === "rejeitado" && d.observacao_gestor && (
                    <div style={{ fontSize: 10.5, color: "var(--danger)", background: "var(--danger-bg, rgba(220,38,38,0.08))", borderRadius: 6, padding: "5px 8px", marginTop: 6 }}>
                      {d.observacao_gestor}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {error && <div style={errorBannerSt}>{error}</div>}

          {prestacao.status === "enviada" && !rejeitandoLote && (
            <div className="flex" style={{ gap: 8, marginTop: 4 }}>
              <button onClick={handleAprovarTudo} disabled={busy} style={btnStyle("primary", busy, true)}>
                <Check size={14} /> Aprovar tudo
              </button>
              <button onClick={() => setRejeitandoLote(true)} disabled={busy} style={btnStyle("danger", busy, true)}>
                <X size={14} /> Rejeitar tudo
              </button>
            </div>
          )}
          {prestacao.status === "enviada" && rejeitandoLote && (
            <div style={{ padding: 10, background: "var(--surface-alt)", borderRadius: 8 }}>
              <label style={labelSt}>Motivo da rejeição (obrigatório)</label>
              <textarea value={motivoLote} onChange={(e) => setMotivoLote(e.target.value)} rows={2} style={{ ...inputSt, width: "100%", resize: "vertical" }} autoFocus />
              <div className="flex" style={{ gap: 8, marginTop: 8 }}>
                <button onClick={handleConfirmarRejeicaoLote} disabled={!motivoLote.trim() || busy} style={btnStyle("danger", !motivoLote.trim() || busy, true)}>
                  Confirmar rejeição
                </button>
                <button onClick={() => { setRejeitandoLote(false); setMotivoLote(""); }} style={btnStyle("ghost", false, true)}>Cancelar</button>
              </div>
            </div>
          )}
          {(prestacao.status === "aprovada" || prestacao.status === "parcial") && (
            <button onClick={handleMarcarPago} disabled={busy} style={btnStyle("primary", busy, true)}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : null} Marcar como paga
              {prestacao.status === "parcial" ? " (só as aprovadas)" : ""}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── View principal ───────────────────────────────────────────────────────────

export function CRMViagensGestorView({ currentUser, users }) {
  const { registros, loading: loadingRegistros } = useCRMViagens({ userId: currentUser?.id });
  const { despesas, loading: loadingDespesas, getComprovanteUrl, decidirReembolso } = useCRMDespesas({ userId: currentUser?.id });
  const { prestacoes, loading: loadingPrestacoes, decidirLote, marcarPaga } = useCRMViagemPrestacoes({ userId: currentUser?.id });
  const { complete, isConfigured } = useAI(currentUser);

  const [selectedMonth, setSelectedMonth] = useState(() => todayISO().slice(0, 7));
  const [selectedVendedorId, setSelectedVendedorId] = useState("todos");
  const [visitasView, setVisitasView] = useState("tabela"); // "tabela" | "calendario"

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiResult, setAiResult] = useState(null);

  const [comprovanteError, setComprovanteError] = useState(null);
  const [decidingId, setDecidingId] = useState(null);
  const [decisaoError, setDecisaoError] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectObs, setRejectObs] = useState("");
  const [selectedPrestacao, setSelectedPrestacao] = useState(null);
  const [prestacaoError, setPrestacaoError] = useState(null);

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

  // Calendário do time: mesmo recorte de vendedor que a tabela ao lado usa
  // (respeita o filtro que o gestor escolheu), mas SEM o filtro de mês — o
  // calendário navega por semana, com paginação própria, e só "planejado"
  // entra (decisão do Daniel 11/08: despesa é o que já aconteceu).
  const registrosPlanejadosDoTime = useMemo(() => {
    return (registros || [])
      .filter((r) => r.status === "planejado")
      .filter((r) => selectedVendedorId === "todos" || r.vendedor_id === selectedVendedorId);
  }, [registros, selectedVendedorId]);

  const vendedoresDoCalendario = useMemo(() => {
    return selectedVendedorId === "todos"
      ? vendedoresComerciais
      : vendedoresComerciais.filter((v) => v.id === selectedVendedorId);
  }, [vendedoresComerciais, selectedVendedorId]);

  const despesasFiltradas = useMemo(() => {
    return (despesas || [])
      .filter((d) => monthKeyOf(d.mes_referencia) === selectedMonth)
      .filter((d) => selectedVendedorId === "todos" || d.vendedor_id === selectedVendedorId);
  }, [despesas, selectedMonth, selectedVendedorId]);

  // Despesa que já entrou numa prestação some daqui — decidida em lote no
  // painel de prestação, não mais uma a uma (evita decidir duas vezes a
  // mesma despesa por dois caminhos diferentes).
  const despesasParaDecidir = useMemo(() => {
    return despesasFiltradas
      .filter((d) => !d.prestacao_id && (d.status_reembolso === "pendente" || d.status_reembolso === "aprovado"))
      .sort((a, b) => String(b.data_despesa || "").localeCompare(String(a.data_despesa || "")));
  }, [despesasFiltradas]);

  const despesasPorPrestacaoId = useMemo(() => {
    const map = new Map();
    (despesas || []).forEach((d) => {
      if (!d.prestacao_id) return;
      if (!map.has(d.prestacao_id)) map.set(d.prestacao_id, []);
      map.get(d.prestacao_id).push(d);
    });
    return map;
  }, [despesas]);

  // Fila de ação do gestor: "enviada" (precisa decidir), "aprovada" e
  // "parcial" (as duas têm despesa aprovada esperando "Marcar como paga" —
  // achado do QA adversarial: "parcial" tinha ficado de fora, e a despesa
  // aprovada dentro de uma prestação mista não tinha nenhum caminho de
  // pagamento em lote); só rejeitada/paga ficam de fora de verdade (nada
  // pendente pra fazer nelas).
  const prestacoesParaAgir = useMemo(() => {
    return (prestacoes || [])
      .filter((p) => monthKeyOf(p.mes_referencia) === selectedMonth)
      .filter((p) => selectedVendedorId === "todos" || p.vendedor_id === selectedVendedorId)
      .filter((p) => p.status === "enviada" || p.status === "aprovada" || p.status === "parcial")
      .sort((a, b) => (a.status === b.status ? 0 : a.status === "enviada" ? -1 : 1));
  }, [prestacoes, selectedMonth, selectedVendedorId]);

  // Ver computeViagemDivergencias em utils/viagens.js — mesma regra usada
  // em Relatórios, pra não divergir os dois lugares que cruzam planejado ×
  // realizado × despesa.
  const divergencias = useMemo(
    () => computeViagemDivergencias(registrosFiltrados, despesasFiltradas, today),
    [registrosFiltrados, despesasFiltradas, today]
  );

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

  // Decisão item a item dentro do painel de prestação reaproveita o mesmo
  // decidirReembolso de sempre — o trigger no banco (recompute_status)
  // recalcula sozinho o status da prestação (aprovada/rejeitada/parcial)
  // conforme as despesas dela vão sendo decididas.
  async function handleDecidirItemPrestacao(despesa, status, motivo) {
    await decidirReembolso(despesa.id, status, motivo || null);
  }

  async function handleDecidirLotePrestacao(prestacaoId, status, motivo) {
    setPrestacaoError(null);
    try {
      await decidirLote(prestacaoId, status, motivo);
    } catch (e) {
      setPrestacaoError(e.message || "Não foi possível decidir a prestação.");
      throw e;
    }
  }

  async function handleMarcarPagoPrestacao(prestacaoId) {
    setPrestacaoError(null);
    try {
      await marcarPaga(prestacaoId);
    } catch (e) {
      setPrestacaoError(e.message || "Não foi possível marcar a prestação como paga.");
      throw e;
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
            <div className="flex items-center justify-between flex-wrap" style={{ gap: 10, marginBottom: 12 }}>
              <div style={{ ...sectionHeaderSt, marginBottom: 0 }}>
                <MapPin size={16} style={{ color: "var(--text-dim)" }} />
                {visitasView === "tabela" ? `Visitas do mês — ${monthLabel(selectedMonth)}` : "Calendário do time"}
              </div>
              <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <ViewToggleButton active={visitasView === "tabela"} onClick={() => setVisitasView("tabela")} icon={List} label="Tabela" iconOnlyMobile />
                <ViewToggleButton active={visitasView === "calendario"} onClick={() => setVisitasView("calendario")} icon={CalendarDays} label="Calendário" iconOnlyMobile dataTour="viagens-calendario-time" />
              </div>
            </div>
            {visitasView === "calendario" ? (
              <TeamWeekCalendar registros={registrosPlanejadosDoTime} vendedores={vendedoresDoCalendario} nomePorId={nomePorId} />
            ) : registrosFiltrados.length === 0 ? (
              <EmptyState icon={MapPin} text="Nenhuma visita planejada neste mês." />
            ) : (
              <VisitasTable registros={registrosFiltrados} showVendedorCol={showVendedorCol} nomePorId={nomePorId} today={today} />
            )}
          </section>

          <section style={cardSt}>
            <div style={sectionHeaderSt}>
              <AlertTriangle size={16} style={{ color: "var(--warning)" }} />
              Divergências — {monthLabel(selectedMonth)}
            </div>
            {divergencias.length === 0 ? (
              <EmptyState icon={AlertTriangle} text="Nenhuma divergência encontrada neste mês." />
            ) : (
              <div className="flex flex-col">
                {divergencias.map((div, idx) => (
                  <div
                    key={div.id}
                    className="flex items-center"
                    style={{ gap: 12, padding: "10px 0", borderTop: idx === 0 ? "none" : "1px solid var(--border)" }}
                  >
                    <span
                      style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: div.severidade === "alta" ? "var(--danger)" : "var(--warning)",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--text)" }}>
                        {showVendedorCol ? (nomePorId.get(div.vendedorId) || "—") : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 1 }}>{div.descricao}</div>
                    </div>
                    {div.valorLabel && (
                      <div style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: 12.5, color: "var(--warning)", whiteSpace: "nowrap" }}>
                        {div.valorLabel}
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
              <Send size={16} style={{ color: "var(--text-dim)" }} />
              Prestações a decidir — {monthLabel(selectedMonth)}
            </div>

            {prestacaoError && <div style={errorBannerSt}>{prestacaoError}</div>}

            {loadingPrestacoes ? (
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Carregando...</div>
            ) : prestacoesParaAgir.length === 0 ? (
              <EmptyState icon={Inbox} text="Nenhuma prestação de contas aguardando decisão ou pagamento neste mês." />
            ) : (
              <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                {prestacoesParaAgir.map((p) => {
                  const itens = despesasPorPrestacaoId.get(p.id) || [];
                  const valor = itens.reduce((s, d) => s + (Number(d.valor) || 0), 0);
                  return (
                    <PrestacaoQueueRow
                      key={p.id}
                      prestacao={p}
                      vendedorNome={nomePorId.get(p.vendedor_id) || "—"}
                      count={itens.length}
                      valor={valor}
                      onClick={() => setSelectedPrestacao(p)}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <section style={cardSt}>
            <div style={sectionHeaderSt}>
              <Receipt size={16} style={{ color: "var(--text-dim)" }} />
              Despesas avulsas pendentes de aprovação
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

      {selectedPrestacao && (
        <PrestacaoDecisaoModal
          prestacao={prestacoes.find((p) => p.id === selectedPrestacao.id) || selectedPrestacao}
          despesas={despesasPorPrestacaoId.get(selectedPrestacao.id) || []}
          vendedorNome={nomePorId.get(selectedPrestacao.vendedor_id) || "—"}
          onVerComprovante={handleVerComprovante}
          onDecidirItem={handleDecidirItemPrestacao}
          onDecidirLote={handleDecidirLotePrestacao}
          onMarcarPago={handleMarcarPagoPrestacao}
          onClose={() => setSelectedPrestacao(null)}
        />
      )}
    </div>
  );
}

export default CRMViagensGestorView;
