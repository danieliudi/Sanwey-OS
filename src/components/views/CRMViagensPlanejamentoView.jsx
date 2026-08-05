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
} from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useCRMViagens } from "../../hooks/use-crm-viagens";
import { useCRMDespesas } from "../../hooks/use-crm-despesas";
import { useCRMViagemCategorias } from "../../hooks/use-crm-viagem-categorias";
import { useAI } from "../../hooks/use-ai";
import { receiptExtractionPrompt } from "../../constants/ai-prompts";
import { formatDateBR } from "../../utils/date";
import { STATUS_VISITA, STATUS_REEMBOLSO, fmtMoney } from "../../utils/viagens";
import { Badge } from "../ui/Badge";
import { CurrencyInput } from "../ui/CurrencyInput";
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
        <Badge variant={info.variant}>{info.label}</Badge>
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

// ── Nova visita ───────────────────────────────────────────────────────────────

function NovaVisitaModal({ clients, onCreateClient, onSave, onClose }) {
  useEscToClose(onClose);
  const [destino, setDestino] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { suggestions, search: searchDestino, clear: clearDestinoSuggestions } = usePlacesAutocomplete();
  const [dataPlanejada, setDataPlanejada] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [valorPrevisto, setValorPrevisto] = useState("");
  const [clientId, setClientId] = useState(null);
  const [quickCreateName, setQuickCreateName] = useState(null); // string | null — abre o mini-cadastro quando != null
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const selectedClient = (clients || []).find((c) => c.id === clientId) || null;

  const handleClientCreated = (client) => {
    setClientId(client.id);
    setQuickCreateName(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!destino.trim()) { setError("Informe o destino."); return; }
    if (!dataPlanejada) { setError("Informe a data planejada."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        destino_planejado: destino.trim(),
        data_planejada: dataPlanejada,
        objetivo: objetivo.trim() || null,
        valor_previsto: valorPrevisto !== "" ? Number(valorPrevisto) : null,
        client_id: clientId || null,
        cliente_nome: selectedClient?.name || null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar visita.");
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
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova visita</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div style={{ position: "relative" }}>
              <label style={LABEL_ST}>Destino *</label>
              <input
                type="text"
                autoFocus
                value={destino}
                onChange={(e) => {
                  const v = e.target.value;
                  setDestino(v);
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
                      onClick={() => { setDestino(s.description); clearDestinoSuggestions(); setShowSuggestions(false); }}
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
            <div>
              <label style={LABEL_ST}>Cliente</label>
              <ClientSelector
                value={clientId}
                clients={clients || []}
                onChange={setClientId}
                onCreate={onCreateClient ? (query) => setQuickCreateName(query || "") : undefined}
              />
            </div>
            <div>
              <label style={LABEL_ST}>Objetivo</label>
              <textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="O que você planeja tratar nesta visita?" rows={3} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={INPUT_ST} />
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
              {saving ? "Salvando…" : "Criar visita"}
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
            <div style={{ marginTop: 8 }}><Badge variant={info.variant}>{info.label}</Badge></div>
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

function DespesaRow({ despesa, onVerComprovante, onRefazer }) {
  const info = STATUS_REEMBOLSO[despesa.status_reembolso] || STATUS_REEMBOLSO.pendente;
  const [opening, setOpening] = useState(false);
  const [verError, setVerError] = useState(null);
  const [refazendo, setRefazendo] = useState(false);
  const rejeitada = despesa.status_reembolso === "rejeitado";

  const handleVer = async () => {
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

  const handleRefazer = async () => {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
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

// ── View principal ────────────────────────────────────────────────────────────

export function CRMViagensPlanejamentoView({ currentUser, clients = [], onCreateClient, pushNotification, initialSelectedViagemId, onInitialViagemConsumed }) {
  const userId = currentUser?.id;
  const { registros, loading: loadingRegistros, createRegistro, marcarRealizado, marcarNaoRealizado, deleteRegistro } = useCRMViagens({ userId });
  const { despesas, loading: loadingDespesas, createDespesa, deleteDespesa, uploadComprovante, getComprovanteUrl } = useCRMDespesas({ userId });
  const { categorias, loading: loadingCategorias } = useCRMViagemCategorias({ userId });
  const ai = useAI(currentUser);

  const [mesRef, setMesRef] = useState(currentMonthStr());
  const [showNovaVisita, setShowNovaVisita] = useState(false);
  const [showNovaDespesa, setShowNovaDespesa] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState(null);

  // Esta é a visão "meus dados" do vendedor — a RLS permite que gestor/admin
  // também leiam todas as linhas, então filtramos por dono aqui para não
  // misturar visitas/despesas de outras pessoas nesta tela pessoal.
  const registrosProprios = useMemo(() => registros.filter((r) => r.vendedor_id === userId), [registros, userId]);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <MonthNav mesRef={mesRef} onChange={setMesRef} />
      </div>

      {/* Visitas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            <Plane size={16} style={{ color: "var(--text-dim)" }} />
            Visitas planejadas
          </div>
          <button
            onClick={() => setShowNovaVisita(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
          >
            <Plus size={13} /> Nova visita
          </button>
        </div>

        {loadingRegistros ? (
          <div style={{ textAlign: "center", padding: "32px 8px", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
        ) : registrosDoMes.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "32px 8px", color: "var(--text-faint)" }}>
            <Plane size={32} strokeWidth={1} />
            <span style={{ fontSize: 12 }}>Nenhuma visita planejada para {monthLabel(mesRef).toLowerCase()}</span>
          </div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {registrosDoMes.map((r) => (
              <VisitaCard key={r.id} registro={r} onClick={() => setSelectedRegistro(r)} />
            ))}
          </div>
        )}
      </div>

      {/* Despesas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            <Receipt size={16} style={{ color: "var(--text-dim)" }} />
            Despesas do mês
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

        {loadingDespesas ? (
          <div style={{ textAlign: "center", padding: "32px 8px", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
        ) : despesasDoMes.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "32px 8px", color: "var(--text-faint)" }}>
            <Receipt size={32} strokeWidth={1} />
            <span style={{ fontSize: 12 }}>Nenhuma despesa lançada para {monthLabel(mesRef).toLowerCase()}</span>
          </div>
        ) : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {despesasDoMes.map((d) => (
              <DespesaRow key={d.id} despesa={d} onVerComprovante={handleVerComprovante} onRefazer={handleRefazerDespesa} />
            ))}
          </div>
        )}
      </div>

      {showNovaVisita && (
        <NovaVisitaModal clients={clients} onCreateClient={onCreateClient} onSave={handleCreateVisita} onClose={() => setShowNovaVisita(false)} />
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
    </div>
  );
}

export default CRMViagensPlanejamentoView;
