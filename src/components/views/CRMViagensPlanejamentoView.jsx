import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plane,
  MapPin,
  Receipt,
  Upload,
  Sparkles,
  Check,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  ExternalLink,
  AlertCircle,
  Send,
  FileText,
  CheckCircle2,
  Square,
  CheckSquare,
  CalendarDays,
  List,
  Calculator,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { useCRMViagens } from "../../hooks/use-crm-viagens";
import { useCRMDespesas } from "../../hooks/use-crm-despesas";
import { useCRMViagemPrestacoes } from "../../hooks/use-crm-viagem-prestacoes";
import { useCRMViagemCategorias } from "../../hooks/use-crm-viagem-categorias";
import { useAI } from "../../hooks/use-ai";
import { receiptExtractionPrompt } from "../../constants/ai-prompts";
import { formatDateBR, parseDateInput } from "../../utils/date";
import { STATUS_VISITA, STATUS_REEMBOLSO, STATUS_PRESTACAO, TIPO_SAIDA, fmtMoney } from "../../utils/viagens";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { Badge } from "../ui/Badge";
import { CurrencyInput } from "../ui/CurrencyInput";
import { StatCard } from "../ui/StatCard";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { usePlacesAutocomplete } from "../../hooks/use-places-autocomplete";
import { ClientSelector } from "../client/ClientSelector";
import { ClientQuickCreateModal } from "../client/ClientQuickCreateModal";

const MAX_FILE_MB = 10;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const ACCEPT_ATTR = ".pdf,image/jpeg,image/png,image/webp";

// Cor de destaque (borda/acento) por variante de badge — só usada onde a UI
// precisa de uma cor sólida além do badge em si (ex: borda esquerda do card).
const VARIANT_ACCENT = {
  secondary: "var(--accent)",
  success: "var(--success)",
  critical: "var(--danger)",
  neutral: "var(--text-faint)",
  urgent: "var(--warning)",
  dark: "var(--text)",
};

const LABEL_ST = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
const INPUT_ST = { borderColor: "var(--border)", color: "var(--text)", background: "var(--surface-alt)", fontSize: 13 };
const INPUT_CLS = "w-full text-sm rounded-xl border px-3 py-2 outline-none";

// ── helpers ───────────────────────────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function shiftMonth(mesRef, delta) {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function sameMonth(dateStr, mesRef) {
  if (!dateStr) return false;
  return dateStr.slice(0, 7) === mesRef.slice(0, 7);
}

function monthLabel(mesRef) {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Vendedor/gerente não tem SELECT em marketing_campaigns (RLS exige
// ser de Marketing) — list_evento_campaigns() é a RPC estreita (só id/nome/
// company_ids, nunca budget) que dá o mesmo dropdown do Funil de Vendas
// (OriginCampaignRow) pra quem vincula uma saída externa a uma feira.
function useEventoCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  useEffect(() => {
    let alive = true;
    if (!isSupabaseConfigured) return undefined;
    supabase.rpc("list_evento_campaigns").then(({ data }) => { if (alive) setCampaigns(data || []); });
    return () => { alive = false; };
  }, []);
  return campaigns;
}

// ── Mês nav ───────────────────────────────────────────────────────────────────

function MonthNav({ mesRef, onChange }) {
  const navBtnSt = { background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-dim)" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={() => onChange(shiftMonth(mesRef, -1))} style={navBtnSt} aria-label="Mês anterior">
        <ChevronLeft size={16} />
      </button>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", minWidth: 150, textAlign: "center" }}>
        {monthLabel(mesRef)}
      </div>
      <button type="button" onClick={() => onChange(shiftMonth(mesRef, 1))} style={navBtnSt} aria-label="Próximo mês">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// Ícone discreto que abre o endereço no Google Maps em nova aba — é só um
// link (sem chave de API), `stopPropagation` pra não disparar o onClick do
// card/detalhe por baixo dele.
function MapsLinkButton({ address, size = 13 }) {
  if (!address) return null;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Abrir no Google Maps"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", flexShrink: 0 }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-faint)"; }}
    >
      <MapPin size={size} />
    </a>
  );
}

// ── Card de visita ────────────────────────────────────────────────────────────

// Cor por tipo — só pra distinguir visualmente, não é status (aquele já é o
// Badge). Verde-evento porque é a mesma família de cor que o Relatório de
// Feiras usa pra campanha de canal Evento.
const TIPO_COLOR = { visita: "var(--text-dim)", evento: "var(--success)", outra: "var(--text-faint)" };

function TipoChip({ tipo }) {
  if (!tipo || tipo === "visita") return null; // "visita" é o padrão implícito — só marca o que foge dele
  const info = TIPO_SAIDA[tipo];
  if (!info) return null;
  const color = TIPO_COLOR[tipo] || "var(--text-dim)";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: color + "18", color, whiteSpace: "nowrap" }}>
      {info.label}
    </span>
  );
}

function VisitaCard({ registro, onClick }) {
  const info = STATUS_VISITA[registro.status] || STATUS_VISITA.planejado;
  return (
    <div
      onClick={onClick}
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${VARIANT_ACCENT[info.variant]}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <MapsLinkButton address={registro.destino_planejado} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{registro.destino_planejado}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <TipoChip tipo={registro.tipo} />
          <Badge variant={info.variant}>{info.label}</Badge>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: registro.objetivo || registro.cliente_nome ? 4 : 0 }}>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {formatDateBR(registro.data_planejada)}
          {registro.cliente_nome && <> · {registro.cliente_nome}</>}
        </div>
        {registro.valor_previsto != null && (
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            Previsto {fmtMoney(registro.valor_previsto)}
          </div>
        )}
      </div>
      {registro.objetivo && (
        <div style={{ fontSize: 11, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {registro.objetivo}
        </div>
      )}
    </div>
  );
}

// ── Calendário pessoal ───────────────────────────────────────────────────────
// Mesmo molde visual do calendário mensal já usado em Compras, Entregas,
// Campanhas e Comex (mês em grade 7 colunas, "Hoje", setas de navegação) —
// só o pedido do Daniel (11/08/2026) de ver a própria agenda de saídas sem
// precisar ler a lista mês a mês.

const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"];

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function VisitaCalendarView({ registros, initialMonth, onSelect }) {
  const [cursor, setCursor] = useState(() => {
    const d = initialMonth ? parseDateInput(initialMonth) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map();
    for (const r of registros) {
      if (!r.data_planejada) continue;
      const k = dayKey(parseDateInput(r.data_planejada));
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    return map;
  }, [registros]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const today = new Date();
  const month = cursor.getMonth();

  return (
    <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-dim)", background: "none", border: "none" }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-dim)", background: "none", border: "none" }}>
            <ChevronRight size={16} />
          </button>
          <h3 className="font-semibold" style={{ fontSize: 14, color: "var(--text)" }}>{monthLabel(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-01`)}</h3>
        </div>
        <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
          Hoje
        </button>
      </div>
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border)" }}>
        {WEEKDAYS_PT.map((w, i) => (
          <div key={i} className="px-2 py-2 text-[10px] font-bold text-center" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(72px, auto)" }}>
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const isToday = sameDay(d, today);
          const items = byDay.get(dayKey(d)) || [];
          return (
            <div key={i} className="p-1.5 border-r border-b flex flex-col gap-1"
              style={{ borderColor: "var(--border)", background: "var(--surface)", opacity: inMonth ? 1 : 0.4 }}>
              <span className="text-xs font-semibold leading-none" style={isToday
                ? { width: 20, height: 20, borderRadius: "50%", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--accent)", color: "var(--on-accent)" }
                : { color: inMonth ? "var(--text)" : "var(--text-dim)" }}>
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map((r) => {
                  const info = STATUS_VISITA[r.status] || STATUS_VISITA.planejado;
                  const color = VARIANT_ACCENT[info.variant];
                  return (
                    <span key={r.id} onClick={() => onSelect(r)}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer"
                      style={{ background: color + "18", color }}
                      title={`${r.destino_planejado}${r.cliente_nome ? ` · ${r.cliente_nome}` : ""}`}>
                      {r.destino_planejado}
                    </span>
                  );
                })}
                {items.length > 3 && (
                  <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>+{items.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Nova visita ───────────────────────────────────────────────────────────────

function TipoSelector({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {Object.entries(TIPO_SAIDA).map(([id, info]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          style={{
            fontSize: 12, fontWeight: 700, padding: "6px 13px", borderRadius: 999, cursor: "pointer",
            border: `1px solid ${value === id ? "var(--accent)" : "var(--border)"}`,
            background: value === id ? "var(--accent)" : "var(--surface)",
            color: value === id ? "var(--on-accent)" : "var(--text-dim)",
          }}
        >
          {info.label}
        </button>
      ))}
    </div>
  );
}

function NovaVisitaModal({ clients, onCreateClient, eventoCampaigns, onSave, onClose }) {
  useEscToClose(onClose);
  const [tipo, setTipo] = useState("visita");
  const [destino, setDestino] = useState("");
  // placeId do Google, guardado só quando o usuário escolhe da lista. É o que
  // permite a calculadora abrir com a quilometragem já pronta (migration
  // 20260901120000). Digitar depois de escolher invalida — o texto passa a ser
  // livre de novo, mesmo espírito do StopAutocompleteInput da calculadora.
  const [destinoPlaceId, setDestinoPlaceId] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { suggestions, search: searchDestino, clear: clearDestinoSuggestions } = usePlacesAutocomplete();
  const [dataPlanejada, setDataPlanejada] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [valorPrevisto, setValorPrevisto] = useState("");
  const [clientId, setClientId] = useState(null);
  const [campaignId, setCampaignId] = useState("");
  const [quickCreateName, setQuickCreateName] = useState(null); // string | null — abre o mini-cadastro quando != null
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const tipoInfo = TIPO_SAIDA[tipo] || TIPO_SAIDA.visita;
  const selectedClient = (clients || []).find((c) => c.id === clientId) || null;

  const handleClientCreated = (client) => {
    setClientId(client.id);
    setQuickCreateName(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!destino.trim()) { setError("Informe o destino."); return; }
    if (!dataPlanejada) { setError("Informe a data planejada."); return; }
    if (tipoInfo.clienteObrigatorio && !clientId) { setError("Informe o cliente."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        tipo,
        destino_planejado: destino.trim(),
        destino_place_id: destinoPlaceId,
        data_planejada: dataPlanejada,
        objetivo: objetivo.trim() || null,
        valor_previsto: valorPrevisto !== "" ? Number(valorPrevisto) : null,
        client_id: clientId || null,
        cliente_nome: selectedClient?.name || null,
        campaign_id: tipo === "evento" && campaignId ? campaignId : null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar registro.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Plane size={16} style={{ color: "var(--accent)" }} />
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova saída externa</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={LABEL_ST}>Tipo</label>
              <TipoSelector value={tipo} onChange={setTipo} />
            </div>
            <div style={{ position: "relative" }}>
              <label style={LABEL_ST}>Destino / local *</label>
              <input
                type="text"
                autoFocus
                value={destino}
                onChange={(e) => {
                  const v = e.target.value;
                  setDestino(v);
                  setDestinoPlaceId(null);
                  setShowSuggestions(true);
                  searchDestino(v);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Ex: Campinas, SP"
                className={INPUT_CLS}
                style={{ ...INPUT_ST, paddingRight: destino.trim() ? 30 : undefined }}
              />
              {destino.trim() && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino.trim())}`}
                  target="_blank" rel="noopener noreferrer"
                  onMouseDown={(e) => e.preventDefault()}
                  title="Abrir no Google Maps"
                  style={{ position: "absolute", right: 8, top: 33, color: "var(--text-faint)", display: "flex" }}
                >
                  <MapPin size={14} />
                </a>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-pop)", overflow: "hidden", zIndex: 20 }}>
                  {suggestions.map((s) => (
                    <button
                      key={s.placeId || s.description}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setDestino(s.description); setDestinoPlaceId(s.placeId || null); clearDestinoSuggestions(); setShowSuggestions(false); }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "none", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.mainText}</div>
                      {s.secondaryText && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{s.secondaryText}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={LABEL_ST}>Data planejada *</label>
              <input type="date" value={dataPlanejada} onChange={(e) => setDataPlanejada(e.target.value)} className={INPUT_CLS} style={INPUT_ST} />
            </div>
            {tipo !== "outra" && (
              <div>
                <label style={LABEL_ST}>Cliente{tipoInfo.clienteObrigatorio ? " *" : " (opcional)"}</label>
                <ClientSelector
                  value={clientId}
                  clients={clients || []}
                  onChange={setClientId}
                  onCreate={onCreateClient ? (query) => setQuickCreateName(query || "") : undefined}
                />
              </div>
            )}
            {tipo === "evento" && (
              <div>
                <label style={LABEL_ST}>Feira / campanha (opcional)</label>
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={INPUT_CLS} style={INPUT_ST}>
                  <option value="">Não vinculado a nenhuma campanha</option>
                  {(eventoCampaigns || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                  Liga esta saída ao Relatório de Feiras, se a feira já for uma campanha cadastrada.
                </div>
              </div>
            )}
            <div>
              <label style={LABEL_ST}>Objetivo</label>
              <textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="O que você planeja tratar?" rows={3} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={INPUT_ST} />
            </div>
            <div>
              <label style={LABEL_ST}>Valor previsto</label>
              <CurrencyInput
                placeholder="Quanto você estima gastar nesta visita"
                value={valorPrevisto}
                onChange={setValorPrevisto}
                className={INPUT_CLS}
                style={INPUT_ST}
              />
            </div>
          </div>

          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Criar registro"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>

      {quickCreateName !== null && (
        <ClientQuickCreateModal
          initialName={quickCreateName}
          clients={clients || []}
          onCreate={onCreateClient}
          onDone={handleClientCreated}
          onClose={() => setQuickCreateName(null)}
        />
      )}
    </div>
  );
}

// ── Drawer de detalhe / ações da visita ─────────────────────────────────────

function VisitaDetalheModal({ registro, onMarcarRealizado, onMarcarNaoRealizado, onExcluir, onClose }) {
  useEscToClose(onClose);
  const [action, setAction] = useState(null); // null | "realizado" | "nao_realizado"
  const [destinoReal, setDestinoReal] = useState("");
  const [resumoReal, setResumoReal] = useState("");
  const [dataReal, setDataReal] = useState(registro.data_planejada || "");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const info = STATUS_VISITA[registro.status] || STATUS_VISITA.planejado;

  const handleRealizado = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onMarcarRealizado(registro.id, { destinoRealizado: destinoReal.trim(), resumoRealizado: resumoReal.trim(), dataRealizada: dataReal || registro.data_planejada });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao marcar como realizado.");
    } finally {
      setSaving(false);
    }
  };

  const handleNaoRealizado = async (e) => {
    e.preventDefault();
    if (!motivo.trim()) { setError("Informe o motivo."); return; }
    setSaving(true);
    setError(null);
    try {
      await onMarcarNaoRealizado(registro.id, motivo.trim());
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao registrar.");
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async () => {
    setSaving(true);
    setError(null);
    try {
      await onExcluir(registro.id);
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao excluir.");
      setSaving(false);
    }
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 999 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: "var(--surface)", zIndex: 1000, display: "flex", flexDirection: "column", boxShadow: "var(--shadow-pop)", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
              <span>{registro.destino_planejado}</span>
              <MapsLinkButton address={registro.destino_realizado || registro.destino_planejado} size={14} />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{formatDateBR(registro.data_planejada)}{registro.cliente_nome && ` · ${registro.cliente_nome}`}</div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Badge variant={info.variant}>{info.label}</Badge>
              <TipoChip tipo={registro.tipo} />
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex", flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", flex: 1 }}>
          {registro.objetivo && (
            <div style={{ marginBottom: 20 }}>
              <div style={LABEL_ST}>Objetivo</div>
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{registro.objetivo}</div>
            </div>
          )}

          {registro.valor_previsto != null && (
            <div style={{ marginBottom: 20 }}>
              <div style={LABEL_ST}>Valor previsto</div>
              <div style={{ fontSize: 13, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(registro.valor_previsto)}</div>
            </div>
          )}

          {registro.status === "realizado" && (
            <div style={{ marginBottom: 20 }}>
              <div style={LABEL_ST}>Destino realizado</div>
              <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 12 }}>{registro.destino_realizado || registro.destino_planejado}</div>
              <div style={LABEL_ST}>Data realizada</div>
              <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 12 }}>{formatDateBR(registro.data_realizada)}</div>
              {registro.resumo_realizado && (
                <>
                  <div style={LABEL_ST}>Resumo</div>
                  <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{registro.resumo_realizado}</div>
                </>
              )}
            </div>
          )}

          {registro.status === "nao_realizado" && registro.motivo_divergencia && (
            <div style={{ marginBottom: 20 }}>
              <div style={LABEL_ST}>Motivo</div>
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{registro.motivo_divergencia}</div>
            </div>
          )}

          {/* Desfecho registrado por engano deixava a visita travada — sem
              editar, desfazer nem excluir. Agora dá pra excluir (e recriar
              corrigida) também com status realizado/não realizado. Achado da
              2ª auditoria. */}
          {registro.status !== "planejado" && (
            !confirmandoExclusao ? (
              <button onClick={() => setConfirmandoExclusao(true)} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", color: "var(--text-faint)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <Trash2 size={14} /> Excluir visita
              </button>
            ) : (
              <div style={{ background: "var(--danger-bg)", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>Excluir esta visita? Essa ação não pode ser desfeita. Se foi um engano, exclua e registre de novo.</div>
                <div className="flex gap-2">
                  <button onClick={handleExcluir} disabled={saving} style={{ flex: 1, background: "var(--danger)", color: "var(--on-danger)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Excluindo…" : "Confirmar exclusão"}
                  </button>
                  <button onClick={() => setConfirmandoExclusao(false)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )
          )}

          {registro.status === "planejado" && (
            <>
              {action === null && (
                <div className="flex flex-col gap-2">
                  <button onClick={() => setAction("realizado")} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--success)", color: "var(--on-success)", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    <Check size={14} /> Marcar como realizado
                  </button>
                  <button onClick={() => setAction("nao_realizado")} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-alt)", color: "var(--danger)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    <X size={14} /> Marcar como não realizado
                  </button>
                  {!confirmandoExclusao ? (
                    <button onClick={() => setConfirmandoExclusao(true)} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", color: "var(--text-faint)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      <Trash2 size={14} /> Excluir
                    </button>
                  ) : (
                    <div style={{ background: "var(--danger-bg)", borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>Excluir esta visita? Essa ação não pode ser desfeita.</div>
                      <div className="flex gap-2">
                        <button onClick={handleExcluir} disabled={saving} style={{ flex: 1, background: "var(--danger)", color: "var(--on-danger)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
                          {saving ? "Excluindo…" : "Confirmar exclusão"}
                        </button>
                        <button onClick={() => setConfirmandoExclusao(false)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {action === "realizado" && (
                <form onSubmit={handleRealizado} className="flex flex-col gap-3">
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>Marcar como realizado</div>
                  <div>
                    <label style={LABEL_ST}>Destino real (deixe em branco se foi igual ao planejado)</label>
                    <input type="text" value={destinoReal} onChange={(e) => setDestinoReal(e.target.value)} placeholder={registro.destino_planejado} className={INPUT_CLS} style={INPUT_ST} />
                  </div>
                  <div>
                    <label style={LABEL_ST}>Data realizada</label>
                    <input type="date" value={dataReal} onChange={(e) => setDataReal(e.target.value)} className={INPUT_CLS} style={INPUT_ST} />
                  </div>
                  <div>
                    <label style={LABEL_ST}>Resumo do que aconteceu</label>
                    <textarea value={resumoReal} onChange={(e) => setResumoReal(e.target.value)} rows={3} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={INPUT_ST} />
                  </div>
                  {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--success)", color: "var(--on-success)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
                      {saving ? "Salvando…" : "Confirmar"}
                    </button>
                    <button type="button" onClick={() => { setAction(null); setError(null); }} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
                      Voltar
                    </button>
                  </div>
                </form>
              )}

              {action === "nao_realizado" && (
                <form onSubmit={handleNaoRealizado} className="flex flex-col gap-3">
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>Marcar como não realizado</div>
                  <div>
                    <label style={LABEL_ST}>Motivo *</label>
                    <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Por que a visita não aconteceu?" className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={INPUT_ST} />
                  </div>
                  {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--danger)", color: "var(--on-danger)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
                      {saving ? "Salvando…" : "Confirmar"}
                    </button>
                    <button type="button" onClick={() => { setAction(null); setError(null); }} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
                      Voltar
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Nova despesa ──────────────────────────────────────────────────────────────

function NovaDespesaModal({ categorias, registros, ai, onSave, onClose }) {
  useEscToClose(onClose);
  const { complete, isConfigured, provider } = ai;
  const podeExtrairIA = isConfigured && provider === "anthropic";

  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [dataDespesa, setDataDespesa] = useState("");
  const [descricao, setDescricao] = useState("");
  const [registroId, setRegistroId] = useState("");
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [iaError, setIaError] = useState(null);
  const [iaExtraido, setIaExtraido] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const extrairComIA = async (f) => {
    setExtracting(true);
    setIaError(null);
    try {
      const base64 = await fileToBase64(f);
      const block = f.type === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image", source: { type: "base64", media_type: f.type, data: base64 } };
      const text = await complete(receiptExtractionPrompt(block), { maxTokens: 300 });
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("A IA não retornou um JSON válido.");
      const data = JSON.parse(match[0]);
      setIaExtraido(data);
      if (data.valor != null) setValor(String(data.valor));
      if (data.data) setDataDespesa(data.data);
      if (data.categoria_sugerida) {
        const found = categorias.find((c) => c.nome.toLowerCase() === String(data.categoria_sugerida).toLowerCase());
        if (found) setCategoria(found.nome);
      }
    } catch (err) {
      setIaError(err?.message || "Não foi possível ler o comprovante automaticamente.");
    } finally {
      setExtracting(false);
    }
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setFileError("Formato não suportado. Use PDF, JPEG, PNG ou WEBP.");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`Arquivo muito grande (máx. ${MAX_FILE_MB}MB).`);
      return;
    }
    setFileError(null);
    setFile(f);
    setIaExtraido(null);
    setIaError(null);
    if (podeExtrairIA) extrairComIA(f);
  };

  const removeFile = () => {
    setFile(null);
    setFileError(null);
    setIaError(null);
    setIaExtraido(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categoria) { setError("Selecione a categoria."); return; }
    const valorNum = Number(valor);
    if (!valor || !(valorNum > 0)) { setError("Informe um valor válido."); return; }
    if (!dataDespesa) { setError("Informe a data da despesa."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          registro_id: registroId || null,
          categoria,
          valor: valorNum,
          data_despesa: dataDespesa,
          descricao: descricao.trim() || null,
          ia_extraido: iaExtraido || {},
        },
        file
      );
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao lançar despesa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 500, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Receipt size={16} style={{ color: "var(--accent)" }} />
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova despesa</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={LABEL_ST}>Comprovante</label>
              {!file ? (
                <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px dashed var(--border)", borderRadius: 10, padding: "16px 12px", cursor: "pointer", color: "var(--text-dim)", fontSize: 12 }}>
                  <Upload size={14} />
                  Selecionar arquivo (PDF, JPEG, PNG ou WEBP · máx. {MAX_FILE_MB}MB)
                  <input type="file" accept={ACCEPT_ATTR} onChange={handleFile} style={{ display: "none" }} />
                </label>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}>
                  <span style={{ fontSize: 12, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                  {extracting && <Loader2 size={13} className="animate-spin" style={{ color: "var(--accent)" }} />}
                  <button type="button" onClick={removeFile} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", display: "flex" }}>
                    <X size={14} />
                  </button>
                </div>
              )}
              {fileError && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{fileError}</div>}
              {!podeExtrairIA && !fileError && (
                <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 4 }}>O upload funciona normalmente; a leitura automática do valor/data não está disponível.</div>
              )}
              {extracting && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><Sparkles size={11} /> Lendo comprovante…</div>}
              {iaExtraido && !extracting && (
                <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <Sparkles size={11} /> Lido automaticamente — confira antes de salvar
                </div>
              )}
              {iaError && (
                <div style={{ fontSize: 11, color: "var(--warning)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertCircle size={11} /> {iaError}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label style={LABEL_ST}>Categoria *</label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={INPUT_CLS} style={INPUT_ST}>
                  <option value="">Selecionar</option>
                  {categorias.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
                {categorias.length === 0 && <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 4 }}>Nenhuma categoria cadastrada ainda.</div>}
              </div>
              <div>
                <label style={LABEL_ST}>Valor (R$) *</label>
                <CurrencyInput prefix={null} value={valor} onChange={setValor} placeholder="0,00" className={INPUT_CLS} style={INPUT_ST} />
              </div>
              <div>
                <label style={LABEL_ST}>Data da despesa *</label>
                <input type="date" value={dataDespesa} onChange={(e) => setDataDespesa(e.target.value)} className={INPUT_CLS} style={INPUT_ST} />
              </div>
              <div>
                <label style={LABEL_ST}>Vincular a uma visita</label>
                <select value={registroId} onChange={(e) => setRegistroId(e.target.value)} className={INPUT_CLS} style={INPUT_ST}>
                  <option value="">Despesa avulsa</option>
                  {registros.map((r) => <option key={r.id} value={r.id}>{r.destino_planejado} · {formatDateBR(r.data_planejada)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={LABEL_ST}>Descrição</label>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={INPUT_ST} />
            </div>
          </div>

          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Lançar despesa"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Linha de despesa ──────────────────────────────────────────────────────────

function DespesaRow({ despesa, onVerComprovante, onRefazer, onOpenDetalhe }) {
  const info = STATUS_REEMBOLSO[despesa.status_reembolso] || STATUS_REEMBOLSO.pendente;
  const [opening, setOpening] = useState(false);
  const [verError, setVerError] = useState(null);
  const [refazendo, setRefazendo] = useState(false);
  const rejeitada = despesa.status_reembolso === "rejeitado";

  const handleVer = async (e) => {
    e.stopPropagation();
    setOpening(true);
    setVerError(null);
    try {
      await onVerComprovante(despesa);
    } catch (err) {
      setVerError(err?.message || "Não foi possível abrir o comprovante.");
    } finally {
      setOpening(false);
    }
  };

  const handleRefazer = async (e) => {
    e.stopPropagation();
    if (!onRefazer) return;
    if (!window.confirm("Refazer esta despesa? A rejeitada será removida e você poderá lançar uma nova corrigida.")) return;
    setRefazendo(true);
    setVerError(null);
    try {
      await onRefazer(despesa);
    } catch (err) {
      setVerError(err?.message || "Não foi possível refazer a despesa.");
      setRefazendo(false);
    }
  };

  return (
    <div
      onClick={onOpenDetalhe}
      style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", borderBottom: "1px solid var(--border)", cursor: onOpenDetalhe ? "pointer" : "default" }}
      onMouseEnter={(e) => { if (onOpenDetalhe) e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{despesa.categoria}</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{formatDateBR(despesa.data_despesa)}{despesa.descricao && ` · ${despesa.descricao}`}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>{fmtMoney(despesa.valor)}</div>
        <Badge variant={info.variant}>{info.label}</Badge>
        {despesa.comprovante_path ? (
          <button onClick={handleVer} disabled={opening} title="Ver comprovante" style={{ background: "none", border: "none", cursor: opening ? "default" : "pointer", color: "var(--accent)", display: "flex", alignItems: "center", padding: 4 }}>
            {opening ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
          </button>
        ) : (
          <span style={{ width: 22, display: "inline-block" }} />
        )}
      </div>
      {/* Motivo da rejeição (obrigatório pro gestor) agora fica visível de forma
          durável — antes só aparecia numa notificação efêmera. Achado da auditoria. */}
      {rejeitada && despesa.observacao_gestor && (
        <div style={{ fontSize: 11, color: "var(--danger)", background: "var(--danger-bg, rgba(220,38,38,0.08))", borderRadius: 6, padding: "6px 8px" }}>
          <strong>Motivo da rejeição:</strong> {despesa.observacao_gestor}
        </div>
      )}
      {rejeitada && onRefazer && (
        <div>
          <button onClick={handleRefazer} disabled={refazendo} style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: refazendo ? "default" : "pointer", padding: "2px 0", display: "inline-flex", alignItems: "center", gap: 4 }}>
            {refazendo ? <Loader2 size={12} className="animate-spin" /> : null} Refazer despesa
          </button>
        </div>
      )}
      {verError && <div style={{ fontSize: 10, color: "var(--danger)" }}>{verError}</div>}
    </div>
  );
}

// ── Detalhe da despesa ───────────────────────────────────────────────────────
// Espelha o shell do VisitaDetalheModal (painel lateral direito) — mesma
// família visual, pra consistência entre os dois tipos de registro desta
// tela. Antes só dava pra "consultar" uma despesa pelos dados truncados na
// linha da lista; agora clicar na linha abre o detalhe completo (reportado
// pelo Daniel: "despesas deveria ser clicável, pra consultar").
function DespesaDetalheModal({ despesa, onVerComprovante, onRefazer, onClose }) {
  useEscToClose(onClose);
  const info = STATUS_REEMBOLSO[despesa.status_reembolso] || STATUS_REEMBOLSO.pendente;
  const rejeitada = despesa.status_reembolso === "rejeitado";
  const [opening, setOpening] = useState(false);
  const [refazendo, setRefazendo] = useState(false);
  const [error, setError] = useState(null);

  const handleVer = async () => {
    setOpening(true);
    setError(null);
    try {
      await onVerComprovante(despesa);
    } catch (err) {
      setError(err?.message || "Não foi possível abrir o comprovante.");
    } finally {
      setOpening(false);
    }
  };

  const handleRefazer = async () => {
    if (!onRefazer) return;
    if (!window.confirm("Refazer esta despesa? A rejeitada será removida e você poderá lançar uma nova corrigida.")) return;
    setRefazendo(true);
    setError(null);
    try {
      await onRefazer(despesa);
      onClose();
    } catch (err) {
      setError(err?.message || "Não foi possível refazer a despesa.");
      setRefazendo(false);
    }
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 999 }} onClick={onClose} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: "var(--surface)", zIndex: 1000, display: "flex", flexDirection: "column", boxShadow: "var(--shadow-pop)", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{despesa.categoria}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{formatDateBR(despesa.data_despesa)}</div>
            <div style={{ marginTop: 8 }}><Badge variant={info.variant}>{info.label}</Badge></div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex", flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", flex: 1 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={LABEL_ST}>Valor</div>
            <div style={{ fontSize: 13, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(despesa.valor)}</div>
          </div>

          {despesa.descricao && (
            <div style={{ marginBottom: 20 }}>
              <div style={LABEL_ST}>Descrição</div>
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{despesa.descricao}</div>
            </div>
          )}

          {rejeitada && despesa.observacao_gestor && (
            <div style={{ marginBottom: 20 }}>
              <div style={LABEL_ST}>Motivo da rejeição</div>
              <div style={{ fontSize: 13, color: "var(--danger)", background: "var(--danger-bg, rgba(220,38,38,0.08))", borderRadius: 8, padding: "8px 12px", lineHeight: 1.5 }}>{despesa.observacao_gestor}</div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div style={LABEL_ST}>Comprovante</div>
            {despesa.comprovante_path ? (
              <button onClick={handleVer} disabled={opening} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-alt)", color: "var(--accent)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: opening ? "default" : "pointer" }}>
                {opening ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />} Ver comprovante
              </button>
            ) : (
              <div style={{ fontSize: 13, color: "var(--text-faint)" }}>Nenhum comprovante anexado.</div>
            )}
          </div>

          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>{error}</div>}

          {rejeitada && onRefazer && (
            <button onClick={handleRefazer} disabled={refazendo} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: refazendo ? "default" : "pointer", opacity: refazendo ? 0.6 : 1 }}>
              {refazendo ? <Loader2 size={14} className="animate-spin" /> : null} Refazer despesa
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Prestação de contas ──────────────────────────────────────────────────────
// Agrupa despesas soltas pendentes num lote só, pra decisão em lote do
// gestor (spec "Prestação de contas", aprovada com o Daniel 10/08/2026,
// comparando com o Zoho Expense). Despesa avulsa continua podendo ser
// decidida direto pelo gestor — nada aqui é obrigatório (decisão 1).

function PrestacaoRow({ prestacao, count, valor, onClick }) {
  const info = STATUS_PRESTACAO[prestacao.status] || STATUS_PRESTACAO.rascunho;
  return (
    <div
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{prestacao.titulo}</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{count} {count === 1 ? "despesa" : "despesas"}</div>
      </div>
      <Badge variant={info.variant}>{info.label}</Badge>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtMoney(valor)}</div>
    </div>
  );
}

function NovaPrestacaoModal({ despesas, tituloSugerido, onSave, onClose }) {
  useEscToClose(onClose);
  const [titulo, setTitulo] = useState(tituloSugerido);
  const [saving, setSaving] = useState(null); // null | "rascunho" | "enviar"
  const [error, setError] = useState(null);
  const total = despesas.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);

  const handleSave = async (enviar) => {
    setSaving(enviar ? "enviar" : "rascunho");
    setError(null);
    try {
      await onSave({ titulo: titulo.trim() || tituloSugerido, despesaIds: despesas.map((d) => d.id), enviar });
      onClose();
    } catch (err) {
      setError(err?.message || "Não foi possível salvar a prestação.");
      setSaving(null);
    }
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 999 }} onClick={onClose} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: "var(--surface)", zIndex: 1000, display: "flex", flexDirection: "column", boxShadow: "var(--shadow-pop)", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova prestação de contas</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{despesas.length} {despesas.length === 1 ? "despesa selecionada" : "despesas selecionadas"}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex", flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", flex: 1 }}>
          <label style={LABEL_ST}>Título</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={INPUT_CLS}
            style={{ ...INPUT_ST, marginBottom: 18 }}
          />

          <div style={LABEL_ST}>Despesas incluídas</div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
            {despesas.map((d) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "var(--text)" }}>{d.categoria}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{formatDateBR(d.data_despesa)}</div>
                </div>
                <div style={{ fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(d.valor)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 2px 18px", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            <span>Total</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMoney(total)}</span>
          </div>

          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>{error}</div>}

          <div className="flex" style={{ gap: 8 }}>
            <button onClick={() => handleSave(true)} disabled={!!saving} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving === "enviar" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar pra aprovação
            </button>
            <button onClick={() => handleSave(false)} disabled={!!saving} style={{ background: "var(--surface-alt)", color: "var(--text-dim)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving === "rascunho" ? <Loader2 size={14} className="animate-spin" /> : "Salvar rascunho"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function PrestacaoResumoModal({ prestacao, despesas, onEnviar, onExcluir, onClose }) {
  useEscToClose(onClose);
  const info = STATUS_PRESTACAO[prestacao.status] || STATUS_PRESTACAO.rascunho;
  const total = despesas.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const handleEnviar = async () => {
    setBusy(true);
    setError(null);
    try {
      await onEnviar(prestacao.id);
      onClose();
    } catch (err) {
      setError(err?.message || "Não foi possível enviar a prestação.");
      setBusy(false);
    }
  };

  const handleExcluir = async () => {
    setBusy(true);
    setError(null);
    try {
      await onExcluir(prestacao.id);
      onClose();
    } catch (err) {
      setError(err?.message || "Não foi possível excluir o rascunho.");
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 999 }} onClick={onClose} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: "var(--surface)", zIndex: 1000, display: "flex", flexDirection: "column", boxShadow: "var(--shadow-pop)", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{prestacao.titulo}</div>
            <div style={{ marginTop: 8 }}><Badge variant={info.variant}>{info.label}</Badge></div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex", flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", flex: 1 }}>
          <div style={LABEL_ST}>Despesas ({despesas.length})</div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
            {despesas.map((d) => {
              const dinfo = STATUS_REEMBOLSO[d.status_reembolso] || STATUS_REEMBOLSO.pendente;
              return (
                <div key={d.id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{d.categoria}</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{formatDateBR(d.data_despesa)}</div>
                    </div>
                    <Badge variant={dinfo.variant}>{dinfo.label}</Badge>
                    <div style={{ fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(d.valor)}</div>
                  </div>
                  {/* Antes só aparecia numa notificação efêmera — motivo some
                      pra sempre se o vendedor não estava com o app aberto na
                      hora. Mesmo princípio já aplicado a despesa avulsa
                      (DespesaRow/DespesaDetalheModal), achado do QA. */}
                  {d.status_reembolso === "rejeitado" && d.observacao_gestor && (
                    <div style={{ fontSize: 10.5, color: "var(--danger)", background: "var(--danger-bg, rgba(220,38,38,0.08))", borderRadius: 6, padding: "5px 8px", marginTop: 6 }}>
                      {d.observacao_gestor}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 2px 18px", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            <span>Total</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMoney(total)}</span>
          </div>

          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>{error}</div>}

          {prestacao.status === "rascunho" && !confirmandoExclusao && (
            <div className="flex" style={{ gap: 8 }}>
              <button onClick={handleEnviar} disabled={busy} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
                <Send size={14} /> Enviar pra aprovação
              </button>
              <button onClick={() => setConfirmandoExclusao(true)} title="Excluir rascunho" style={{ background: "transparent", color: "var(--text-faint)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <Trash2 size={14} />
              </button>
            </div>
          )}
          {prestacao.status === "rascunho" && confirmandoExclusao && (
            <div style={{ background: "var(--danger-bg)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>Excluir este rascunho? As despesas voltam a ficar soltas.</div>
              <div className="flex" style={{ gap: 8 }}>
                <button onClick={handleExcluir} disabled={busy} style={{ flex: 1, background: "var(--danger)", color: "var(--on-danger)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Excluindo…" : "Confirmar exclusão"}
                </button>
                <button onClick={() => setConfirmandoExclusao(false)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── View principal ────────────────────────────────────────────────────────────

export function CRMViagensPlanejamentoView({ currentUser, clients = [], onCreateClient, pushNotification, initialSelectedViagemId, onInitialViagemConsumed, onCalcularViagem }) {
  const userId = currentUser?.id;
  const { registros, loading: loadingRegistros, createRegistro, marcarRealizado, marcarNaoRealizado, deleteRegistro } = useCRMViagens({ userId });
  const { despesas, loading: loadingDespesas, createDespesa, deleteDespesa, uploadComprovante, getComprovanteUrl } = useCRMDespesas({ userId });
  const { prestacoes, loading: loadingPrestacoes, criarPrestacao, enviarRascunho, excluirRascunho } = useCRMViagemPrestacoes({ userId });
  const { categorias, loading: loadingCategorias } = useCRMViagemCategorias({ userId });
  const ai = useAI(currentUser);
  const eventoCampaigns = useEventoCampaigns();

  const [mesRef, setMesRef] = useState(currentMonthStr());
  const [visitasView, setVisitasView] = useState("lista"); // "lista" | "calendario"
  const [showNovaVisita, setShowNovaVisita] = useState(false);
  const [showNovaDespesa, setShowNovaDespesa] = useState(false);
  const [showNovaPrestacao, setShowNovaPrestacao] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState(null);
  const [selectedDespesa, setSelectedDespesa] = useState(null);
  const [selectedPrestacao, setSelectedPrestacao] = useState(null);
  const [selectedDespesaIds, setSelectedDespesaIds] = useState(() => new Set());

  // Esta é a visão "meus dados" do vendedor — a RLS permite que gestor/admin
  // também leiam todas as linhas, então filtramos por dono aqui para não
  // misturar visitas/despesas de outras pessoas nesta tela pessoal.
  const registrosProprios = useMemo(() => registros.filter((r) => r.vendedor_id === userId), [registros, userId]);

  // Saídas que ainda vão acontecer, em ordem de data — é o que o atalho da
  // calculadora manda como paradas. Só as próprias e só as planejadas: já
  // realizada não se calcula, e de outro vendedor não é da conta desta tela.
  const visitasPlanejadasFuturas = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return registrosProprios
      .filter((r) => r.status === "planejado" && r.data_planejada && r.data_planejada >= hoje && (r.destino_planejado || "").trim())
      .sort((a, b) => a.data_planejada.localeCompare(b.data_planejada));
  }, [registrosProprios]);

  // Noites sugeridas: dias entre a primeira e a última saída do bloco. Uma
  // saída só = 1 noite (o vendedor ajusta na calculadora; é sugestão, não
  // regra — o Daniel avisou que "depende muito").
  const noitesSugeridasDaAgenda = useMemo(() => {
    if (visitasPlanejadasFuturas.length === 0) return 1;
    const primeira = visitasPlanejadasFuturas[0].data_planejada;
    const ultima = visitasPlanejadasFuturas[visitasPlanejadasFuturas.length - 1].data_planejada;
    const dias = Math.round((new Date(ultima) - new Date(primeira)) / 86400000);
    return Math.max(1, Number.isFinite(dias) ? dias : 1);
  }, [visitasPlanejadasFuturas]);
  const despesasProprias = useMemo(() => despesas.filter((d) => d.vendedor_id === userId), [despesas, userId]);

  // Busca em `registros` (não `registrosProprios`) porque quem manda o id pode
  // ser o painel de Conexões do Cliente — a viagem pode ter sido registrada por
  // outro vendedor. Se não achar (RLS já restringe `registros` a só as próprias
  // linhas de quem não é gestor/admin), simplesmente não abre nada.
  useEffect(() => {
    if (!initialSelectedViagemId || loadingRegistros) return;
    const registro = registros.find((r) => r.id === initialSelectedViagemId);
    if (registro) setSelectedRegistro(registro);
    onInitialViagemConsumed?.();
  }, [initialSelectedViagemId, loadingRegistros, registros, onInitialViagemConsumed]);

  // Avisa o vendedor quando o gestor decide um reembolso — antes só se
  // descobria abrindo o app de novo. Compara contra o último status visto
  // por despesa (não contra "pendente" fixo) pra não reavisar quando o
  // Realtime só refizer o fetch sem mudança real (ex.: outra despesa mudou).
  const statusVistoRef = useRef(new Map());
  useEffect(() => {
    if (!pushNotification) return;
    for (const d of despesasProprias) {
      const anterior = statusVistoRef.current.get(d.id);
      if (anterior !== undefined && anterior !== d.status_reembolso && d.status_reembolso !== "pendente") {
        const info = STATUS_REEMBOLSO[d.status_reembolso];
        pushNotification({
          type: "reembolso_decidido",
          title: `Reembolso ${info?.label?.toLowerCase() || d.status_reembolso}`,
          body: `${d.descricao || "Despesa"} (${fmtMoney(d.valor)}) — ${info?.label || d.status_reembolso}${d.observacao_gestor ? `: ${d.observacao_gestor}` : "."}`,
          link: { module: "crm_despesas", id: d.id },
        });
      }
      statusVistoRef.current.set(d.id, d.status_reembolso);
    }
  }, [despesasProprias, pushNotification]);

  const registrosDoMes = useMemo(
    () => registrosProprios.filter((r) => sameMonth(r.mes_referencia, mesRef)).sort((a, b) => (a.data_planejada || "").localeCompare(b.data_planejada || "")),
    [registrosProprios, mesRef]
  );
  const despesasDoMes = useMemo(
    () => despesasProprias.filter((d) => sameMonth(d.mes_referencia, mesRef)).sort((a, b) => (b.data_despesa || "").localeCompare(a.data_despesa || "")),
    [despesasProprias, mesRef]
  );
  const totalDespesasDoMes = useMemo(() => despesasDoMes.reduce((sum, d) => sum + (Number(d.valor) || 0), 0), [despesasDoMes]);

  // Despesa solta = ainda não entrou numa prestação (prestacao_id null).
  // Continua decidível direto pelo gestor, sem passar por prestação nenhuma
  // (decisão 1 da spec) — por isso segue aparecendo aqui, só que agora sem
  // as que já foram agrupadas (essas aparecem dentro da prestação delas).
  const despesasSoltasDoMes = useMemo(() => despesasDoMes.filter((d) => !d.prestacao_id), [despesasDoMes]);
  const despesasSoltasPendentes = useMemo(() => despesasSoltasDoMes.filter((d) => d.status_reembolso === "pendente"), [despesasSoltasDoMes]);
  const totalSoltasPendentes = useMemo(() => despesasSoltasPendentes.reduce((sum, d) => sum + (Number(d.valor) || 0), 0), [despesasSoltasPendentes]);

  const despesasPorPrestacaoId = useMemo(() => {
    const map = new Map();
    despesasProprias.forEach((d) => {
      if (!d.prestacao_id) return;
      if (!map.has(d.prestacao_id)) map.set(d.prestacao_id, []);
      map.get(d.prestacao_id).push(d);
    });
    return map;
  }, [despesasProprias]);

  const prestacoesProprias = useMemo(() => prestacoes.filter((p) => p.vendedor_id === userId), [prestacoes, userId]);
  const prestacoesDoMes = useMemo(
    () => prestacoesProprias.filter((p) => sameMonth(p.mes_referencia, mesRef)).sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))),
    [prestacoesProprias, mesRef]
  );
  const prestacoesEnviadas = useMemo(() => prestacoesDoMes.filter((p) => p.status === "enviada"), [prestacoesDoMes]);
  const totalEnviadas = useMemo(
    () => prestacoesEnviadas.reduce((sum, p) => sum + (despesasPorPrestacaoId.get(p.id) || []).reduce((s, d) => s + (Number(d.valor) || 0), 0), 0),
    [prestacoesEnviadas, despesasPorPrestacaoId]
  );
  const prestacoesDecididas = useMemo(() => prestacoesDoMes.filter((p) => ["aprovada", "rejeitada", "parcial", "paga"].includes(p.status)), [prestacoesDoMes]);

  // Sempre que a lista de soltas pendentes muda (mês trocado, despesa nova
  // lançada, prestação enviada removendo algumas daqui), a seleção volta a
  // marcar todas — o vendedor desmarca as que não quer incluir, não o
  // contrário. `key` (ids ordenados) evita loop: só reseta quando a
  // composição da lista muda de verdade, não a cada render.
  const pendentesKey = despesasSoltasPendentes.map((d) => d.id).sort().join(",");
  useEffect(() => {
    setSelectedDespesaIds(new Set(despesasSoltasPendentes.map((d) => d.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendentesKey]);

  const toggleDespesaSelecionada = (id) => {
    setSelectedDespesaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const despesasSelecionadas = useMemo(
    () => despesasSoltasPendentes.filter((d) => selectedDespesaIds.has(d.id)),
    [despesasSoltasPendentes, selectedDespesaIds]
  );

  // Sub-prestação por viagem (decisão 2 da spec): se toda a seleção
  // pertence à mesma visita, sugere o título com o destino e já vincula
  // `registro_id` — senão fica geral do mês (registro_id nulo).
  const registroSugerido = useMemo(() => {
    if (!despesasSelecionadas.length) return null;
    const primeiro = despesasSelecionadas[0].registro_id;
    if (!primeiro || !despesasSelecionadas.every((d) => d.registro_id === primeiro)) return null;
    return registrosProprios.find((r) => r.id === primeiro) || null;
  }, [despesasSelecionadas, registrosProprios]);

  const tituloSugerido = registroSugerido
    ? `Prestação de ${monthLabel(mesRef)} — Visita a ${registroSugerido.destino_planejado}`
    : `Prestação de ${monthLabel(mesRef)}`;

  if (!isSupabaseConfigured) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", color: "var(--text-dim)", fontSize: 13 }}>
        <AlertCircle size={16} />
        Supabase não configurado. Configure a conexão para planejar visitas e lançar despesas.
      </div>
    );
  }

  const handleCreateVisita = async (payload) => {
    // mes_referencia deriva da data planejada em si, não da aba de mês
    // aberta — senão uma visita criada pro mês seguinte fica presa no filtro
    // errado no Gestor/Relatórios.
    await createRegistro({ ...payload, mes_referencia: `${String(payload.data_planejada).slice(0, 7)}-01` });
  };

  const handleCreateDespesa = async (payload, file) => {
    const mesReferencia = `${String(payload.data_despesa).slice(0, 7)}-01`;
    const nova = await createDespesa({ ...payload, mes_referencia: mesReferencia });
    if (file) {
      try {
        await uploadComprovante(nova.id, file);
      } catch (err) {
        // upload falhou: desfaz a despesa pra não deixar um registro órfão
        // sem comprovante que duplicaria numa nova tentativa.
        await deleteDespesa(nova.id).catch(() => {});
        throw err;
      }
    }
  };

  // Refazer uma despesa rejeitada: remove a rejeitada (agora permitido pela
  // RLS pro próprio dono) e reabre o formulário pra lançar a corrigida —
  // antes o vendedor ficava sem saída, só via a etiqueta "Rejeitado".
  const handleRefazerDespesa = async (despesa) => {
    await deleteDespesa(despesa.id);
    setShowNovaDespesa(true);
  };

  const handleVerComprovante = async (despesa) => {
    const url = await getComprovanteUrl(despesa.comprovante_path);
    window.open(url, "_blank");
  };

  const handleCriarPrestacao = async ({ titulo, despesaIds, enviar }) => {
    await criarPrestacao({
      titulo,
      mesReferencia: mesRef,
      registroId: registroSugerido?.id || null,
      despesaIds,
      enviar,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <MonthNav mesRef={mesRef} onChange={setMesRef} />
      </div>

      {/* Atalho pra calculadora — ideia do Daniel (01/09/2026): depois de
          montar a agenda, o vendedor não deveria redigitar endereço nenhum pra
          descobrir o meio mais barato. Só aparece com saída planejada no mês,
          e some quando não há nada a calcular. */}
      {onCalcularViagem && visitasPlanejadasFuturas.length > 0 && (
        <button
          type="button"
          onClick={() => onCalcularViagem({
            paradas: visitasPlanejadasFuturas.map((r) => ({
              description: r.destino_planejado || "",
              placeId: r.destino_place_id || null,
            })),
            noites: noitesSugeridasDaAgenda,
          })}
          data-tour="viagens-calcular-atalho"
          className="flex items-center gap-3 rounded-xl border p-3.5 text-left w-full"
          style={{ background: "var(--accent-tint)", borderColor: "var(--accent)", cursor: "pointer" }}
        >
          <Calculator size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              Quer saber o meio mais barato pra essa viagem?
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {visitasPlanejadasFuturas.length} {visitasPlanejadasFuturas.length === 1 ? "saída planejada" : "saídas planejadas"} · abre a calculadora com os endereços já preenchidos
            </div>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "var(--accent)", whiteSpace: "nowrap", flexShrink: 0 }}>
            Calcular →
          </span>
        </button>
      )}

      {/* Visitas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            <Plane size={16} style={{ color: "var(--text-dim)" }} />
            Saídas planejadas
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <ViewToggleButton active={visitasView === "lista"} onClick={() => setVisitasView("lista")} icon={List} label="Lista" iconOnlyMobile />
              <ViewToggleButton active={visitasView === "calendario"} onClick={() => setVisitasView("calendario")} icon={CalendarDays} label="Calendário" iconOnlyMobile dataTour="viagens-calendario-pessoal" />
            </div>
            <button
              onClick={() => setShowNovaVisita(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
            >
              <Plus size={13} /> Nova saída externa
            </button>
          </div>
        </div>

        {loadingRegistros ? (
          <div style={{ textAlign: "center", padding: "32px 8px", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
        ) : visitasView === "calendario" ? (
          // Consome registrosProprios (o mesmo recorte "só o meu" que a lista
          // usa), não registrosDoMes — o calendário tem navegação própria de
          // mês, então não faz sentido travar no mês do MonthNav acima
          // (regra 11 do CLAUDE.md: mesmo array filtrado, nunca o cru).
          <VisitaCalendarView registros={registrosProprios} initialMonth={mesRef} onSelect={setSelectedRegistro} />
        ) : registrosDoMes.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "32px 8px", color: "var(--text-faint)" }}>
            <Plane size={32} strokeWidth={1} />
            <span style={{ fontSize: 12 }}>Nenhuma saída planejada para {monthLabel(mesRef).toLowerCase()}</span>
          </div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {registrosDoMes.map((r) => (
              <VisitaCard key={r.id} registro={r} onClick={() => setSelectedRegistro(r)} />
            ))}
          </div>
        )}
      </div>

      {/* Despesas & prestação de contas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div data-tour="prestacao-de-contas" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            <Receipt size={16} style={{ color: "var(--text-dim)" }} />
            Despesas & prestação de contas
            {despesasDoMes.length > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>· {fmtMoney(totalDespesasDoMes)}</span>}
          </div>
          <button
            onClick={() => setShowNovaDespesa(true)}
            disabled={loadingCategorias}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: loadingCategorias ? "default" : "pointer", opacity: loadingCategorias ? 0.6 : 1 }}
            onMouseEnter={(e) => { if (!loadingCategorias) e.currentTarget.style.background = "var(--accent-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
          >
            <Plus size={13} /> Nova despesa
          </button>
        </div>

        {(loadingDespesas || loadingPrestacoes) ? (
          <div style={{ textAlign: "center", padding: "32px 8px", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
        ) : despesasDoMes.length === 0 && prestacoesDoMes.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "32px 8px", color: "var(--text-faint)" }}>
            <Receipt size={32} strokeWidth={1} />
            <span style={{ fontSize: 12 }}>Nenhuma despesa lançada para {monthLabel(mesRef).toLowerCase()}</span>
          </div>
        ) : (
          <>
            <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <StatCard icon={FileText} value={despesasSoltasPendentes.length} label={`Sem prestação — ${fmtMoney(totalSoltasPendentes)}`} compact />
              <StatCard icon={Send} value={prestacoesEnviadas.length} label={`Aguardando aprovação — ${fmtMoney(totalEnviadas)}`} compact />
              <StatCard icon={CheckCircle2} value={prestacoesDecididas.length} label="Decididas este mês" compact />
            </div>

            {despesasSoltasDoMes.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                  Despesas soltas (ainda sem prestação)
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: despesasSoltasPendentes.length > 0 ? 8 : 20 }}>
                  {despesasSoltasDoMes.map((d) => (
                    <div key={d.id} style={{ display: "flex", alignItems: "stretch" }}>
                      {d.status_reembolso === "pendente" && (
                        <button
                          onClick={() => toggleDespesaSelecionada(d.id)}
                          title={selectedDespesaIds.has(d.id) ? "Remover da seleção" : "Incluir na seleção"}
                          style={{ background: "none", border: "none", borderRight: "1px solid var(--border)", padding: "0 10px", display: "flex", alignItems: "center", cursor: "pointer", color: selectedDespesaIds.has(d.id) ? "var(--accent)" : "var(--text-faint)" }}
                        >
                          {selectedDespesaIds.has(d.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <DespesaRow despesa={d} onVerComprovante={handleVerComprovante} onRefazer={handleRefazerDespesa} onOpenDetalhe={() => setSelectedDespesa(d)} />
                      </div>
                    </div>
                  ))}
                </div>
                {despesasSelecionadas.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "color-mix(in srgb, var(--accent) 8%, var(--surface))", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                      {despesasSelecionadas.length} {despesasSelecionadas.length === 1 ? "despesa selecionada" : "despesas selecionadas"} · <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMoney(despesasSelecionadas.reduce((s, d) => s + (Number(d.valor) || 0), 0))}</span>
                    </span>
                    <button
                      onClick={() => setShowNovaPrestacao(true)}
                      style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      <Send size={13} /> Enviar prestação
                    </button>
                  </div>
                )}
              </>
            )}

            {prestacoesDoMes.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                  Prestações de contas
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                  {prestacoesDoMes.map((p) => {
                    const itens = despesasPorPrestacaoId.get(p.id) || [];
                    const valor = itens.reduce((s, d) => s + (Number(d.valor) || 0), 0);
                    return (
                      <PrestacaoRow key={p.id} prestacao={p} count={itens.length} valor={valor} onClick={() => setSelectedPrestacao(p)} />
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {showNovaVisita && (
        <NovaVisitaModal clients={clients} onCreateClient={onCreateClient} eventoCampaigns={eventoCampaigns} onSave={handleCreateVisita} onClose={() => setShowNovaVisita(false)} />
      )}

      {showNovaDespesa && (
        <NovaDespesaModal categorias={categorias} registros={registrosDoMes} ai={ai} onSave={handleCreateDespesa} onClose={() => setShowNovaDespesa(false)} />
      )}

      {selectedRegistro && (
        <VisitaDetalheModal
          registro={selectedRegistro}
          onMarcarRealizado={marcarRealizado}
          onMarcarNaoRealizado={marcarNaoRealizado}
          onExcluir={deleteRegistro}
          onClose={() => setSelectedRegistro(null)}
        />
      )}

      {selectedDespesa && (
        <DespesaDetalheModal
          despesa={selectedDespesa}
          onVerComprovante={handleVerComprovante}
          onRefazer={handleRefazerDespesa}
          onClose={() => setSelectedDespesa(null)}
        />
      )}

      {showNovaPrestacao && (
        <NovaPrestacaoModal
          despesas={despesasSelecionadas}
          tituloSugerido={tituloSugerido}
          onSave={handleCriarPrestacao}
          onClose={() => setShowNovaPrestacao(false)}
        />
      )}

      {selectedPrestacao && (
        <PrestacaoResumoModal
          prestacao={prestacoes.find((p) => p.id === selectedPrestacao.id) || selectedPrestacao}
          despesas={despesasPorPrestacaoId.get(selectedPrestacao.id) || []}
          onEnviar={enviarRascunho}
          onExcluir={excluirRascunho}
          onClose={() => setSelectedPrestacao(null)}
        />
      )}
    </div>
  );
}

export default CRMViagensPlanejamentoView;
