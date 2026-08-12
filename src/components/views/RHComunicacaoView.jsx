import React, { useEffect, useMemo, useState } from "react";
import {
  Megaphone, Plus, X, Send, ClipboardList, BarChart3, Check,
  Loader2, Lock, AlertTriangle, Search, UserCheck, BellRing,
} from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHComunicacao } from "../../hooks/use-rh-comunicacao";
import { RH_DEPARTMENTS } from "../../constants/rh-config";
import { RH_FRENTES, RH_FRENTE_LABELS } from "../../constants/rh-frentes";
import { QRCodeButton } from "../shared/QRCodeButton";
import { MoveStageMenu } from "../shared/MoveStageMenu";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { formatDateBR } from "../../utils/date";

const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };

// ── Comunicados ───────────────────────────────────────────────────────────────

function ComunicadoComposer({ onSend }) {
  const [title, setTitle] = useState("");
  const [body, setBody]   = useState("");
  const [scopeType, setScopeType] = useState("todos");
  const [scopeValue, setScopeValue] = useState("");
  const [importante, setImportante] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError]   = useState(null);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    if (!title.trim()) { setError("Escreva um título."); return; }
    if (scopeType !== "todos" && !scopeValue) { setError("Escolha a frente/departamento."); return; }
    setSending(true); setError(null); setResult(null);
    try {
      const n = await onSend({ title: title.trim(), body: body.trim() || null, scopeType, scopeValue: scopeType === "todos" ? null : scopeValue, importante });
      setResult(n);
      setTitle(""); setBody(""); setImportante(false);
    } catch (e) {
      setError(e?.message || "Erro ao enviar comunicado.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: 620, border: "1px solid var(--border)", borderRadius: 12, padding: 20, background: "var(--surface)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={labelSt}>Título *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Recesso de fim de ano" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
        </div>
        <div>
          <label style={labelSt}>Mensagem</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Escreva o comunicado…" className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-y" style={inputSt} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <div>
            <label style={labelSt}>Enviar para</label>
            <select value={scopeType} onChange={(e) => { setScopeType(e.target.value); setScopeValue(""); }} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
              <option value="todos">Todos os colaboradores</option>
              <option value="frente">Por frente</option>
              <option value="departamento">Por departamento</option>
            </select>
          </div>
          {scopeType !== "todos" && (
            <div>
              <label style={labelSt}>{scopeType === "frente" ? "Frente" : "Departamento"}</label>
              <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                <option value="">Selecione…</option>
                {(scopeType === "frente" ? RH_FRENTES.map((id) => ({ id, label: RH_FRENTE_LABELS[id] })) : RH_DEPARTMENTS.map((d) => ({ id: d, label: d }))).map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <label
          style={{
            display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
            borderRadius: 10, padding: "10px 12px",
            border: `1px solid ${importante ? "var(--danger)" : "var(--border)"}`,
            background: importante ? "var(--danger-bg)" : "var(--surface-alt)",
          }}
        >
          <input type="checkbox" checked={importante} onChange={(e) => setImportante(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: importante ? "var(--danger)" : "var(--text)" }}>
              <AlertTriangle size={13} /> Importante
            </span>
            <span style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, display: "block" }}>
              Entrega mesmo pra quem desativou notificações. Use só pra avisos que ninguém pode perder (segurança, mudança de política, recesso).
            </span>
          </span>
        </label>

        {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
        {result != null && (
          <div style={{ background: "var(--success-bg)", color: "var(--success)", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600 }}>
            Comunicado enviado para {result} colaborador{result !== 1 ? "es" : ""}.
          </div>
        )}
        <div>
          <button
            onClick={handleSend} disabled={sending}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: importante ? "var(--danger)" : "var(--accent)", color: importante ? "var(--on-danger)" : "var(--on-accent)", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, border: "none", cursor: sending ? "default" : "pointer", opacity: sending ? 0.6 : 1 }}
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {sending ? "Enviando…" : importante ? "Enviar comunicado importante" : "Enviar comunicado"}
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Vai como notificação pra cada colaborador com login na plataforma. Não expõe a lista de destinatários.
          {" "}Quem ainda não tem acesso ao sistema não recebe por aqui — veja com o RH os outros canais (WhatsApp/SMS/mural físico).
        </p>
      </div>
    </div>
  );
}

// ── Pesquisas ─────────────────────────────────────────────────────────────────

function NovaPesquisaModal({ onSave, onClose }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fechaEm, setFechaEm] = useState("");
  const [perguntas, setPerguntas] = useState([{ label: "", tipo: "escala" }]);
  const [modo, setModo] = useState("anonima"); // "anonima" | "identificada"
  const [scopeType, setScopeType] = useState("todos");
  const [scopeValue, setScopeValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const upd = (i, patch) => setPerguntas((p) => p.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  const add = () => setPerguntas((p) => [...p, { label: "", tipo: "escala" }]);
  const rem = (i) => setPerguntas((p) => p.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    const valid = perguntas.filter((q) => q.label.trim());
    if (!titulo.trim()) { setError("Título obrigatório."); return; }
    if (valid.length === 0) { setError("Adicione ao menos uma pergunta."); return; }
    if (modo === "identificada" && scopeType !== "todos" && !scopeValue) { setError("Escolha a frente/departamento."); return; }
    setSaving(true); setError(null);
    try {
      await onSave({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        fechaEm: fechaEm || null,
        perguntas: valid.map((q, idx) => ({ key: `q${idx + 1}`, label: q.label.trim(), tipo: q.tipo })),
        modo,
        scopeType: modo === "identificada" ? scopeType : "todos",
        scopeValue: modo === "identificada" && scopeType !== "todos" ? scopeValue : null,
      });
      onClose();
    } catch (e) {
      setError(e?.message || "Erro ao criar pesquisa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "var(--shadow-pop)", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova pesquisa</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelSt}>Título *</label>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Clima organizacional 2026" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} autoFocus />
          </div>
          <div>
            <label style={labelSt}>Descrição</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Modo</label>
            <div className="grid grid-cols-2" style={{ gap: 8 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 2, cursor: "pointer", borderRadius: 10, padding: "10px 12px", border: `1px solid ${modo === "anonima" ? "var(--accent)" : "var(--border)"}`, background: modo === "anonima" ? "var(--accent-tint)" : "var(--surface-alt)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  <input type="radio" checked={modo === "anonima"} onChange={() => setModo("anonima")} /> <Lock size={12} /> Anônima
                </span>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Via QR/link — respostas nunca identificadas.</span>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 2, cursor: "pointer", borderRadius: 10, padding: "10px 12px", border: `1px solid ${modo === "identificada" ? "var(--accent)" : "var(--border)"}`, background: modo === "identificada" ? "var(--accent-tint)" : "var(--surface-alt)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  <input type="radio" checked={modo === "identificada"} onChange={() => setModo("identificada")} /> <UserCheck size={12} /> Identificada
                </span>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Enviada como comunicado — sabe quem respondeu.</span>
              </label>
            </div>
          </div>
          {modo === "identificada" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <div>
                <label style={labelSt}>Enviar para</label>
                <select value={scopeType} onChange={(e) => { setScopeType(e.target.value); setScopeValue(""); }} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  <option value="todos">Todos os colaboradores</option>
                  <option value="frente">Por frente</option>
                  <option value="departamento">Por departamento</option>
                </select>
              </div>
              {scopeType !== "todos" && (
                <div>
                  <label style={labelSt}>{scopeType === "frente" ? "Frente" : "Departamento"}</label>
                  <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                    <option value="">Selecione…</option>
                    {(scopeType === "frente" ? RH_FRENTES.map((id) => ({ id, label: RH_FRENTE_LABELS[id] })) : RH_DEPARTMENTS.map((d) => ({ id: d, label: d }))).map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          <div>
            <label style={labelSt}>Encerra em (opcional)</label>
            <input type="date" value={fechaEm} onChange={(e) => setFechaEm(e.target.value)} className="text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Perguntas</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {perguntas.map((q, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="text" value={q.label} onChange={(e) => upd(i, { label: e.target.value })} placeholder={`Pergunta ${i + 1}`} className="text-sm rounded-lg border px-2 py-1.5 outline-none" style={{ ...inputSt, flex: 1 }} />
                  <select value={q.tipo} onChange={(e) => upd(i, { tipo: e.target.value })} className="text-sm rounded-lg border outline-none px-2 py-1.5" style={{ ...inputSt, flexShrink: 0 }}>
                    <option value="escala">Escala 1-5</option>
                    <option value="texto">Texto</option>
                  </select>
                  <button type="button" onClick={() => rem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", flexShrink: 0 }}><X size={14} /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={add} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <Plus size={12} /> Adicionar pergunta
            </button>
          </div>
          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Criar pesquisa"}
            </button>
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultadosModal({ pesquisa, carregarRespostas, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ total: 0, respostas: [] });
  const [error, setError] = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await carregarRespostas(pesquisa.id);
        if (active) setData(r);
      } catch (e) {
        if (active) setError(e?.message || "Erro ao carregar respostas.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [pesquisa.id, carregarRespostas]);

  const perguntas = Array.isArray(pesquisa.perguntas) ? pesquisa.perguntas : [];

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 560, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{pesquisa.titulo}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2, display: "inline-flex", alignItems: "center", gap: 4 }}>
              {pesquisa.modo === "identificada" ? <UserCheck size={11} /> : <Lock size={11} />} {data.total} resposta{data.total !== 1 ? "s" : ""} · {pesquisa.modo === "identificada" ? "identificadas" : "anônimas"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim)" }}><Loader2 size={20} className="animate-spin" /></div>
          ) : error ? (
            <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>
          ) : data.total === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Nenhuma resposta ainda.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {perguntas.map((q) => {
                const vals = data.respostas.map((r) => r?.[q.key]).filter((v) => v !== undefined && v !== null && v !== "");
                if (q.tipo === "escala") {
                  const nums = vals.map(Number).filter((n) => !Number.isNaN(n));
                  const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
                  const dist = [1, 2, 3, 4, 5].map((n) => nums.filter((x) => x === n).length);
                  const maxD = Math.max(1, ...dist);
                  return (
                    <div key={q.key}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{q.label}</div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Média: <b style={{ color: "var(--accent)" }}>{avg.toFixed(1)}</b> / 5 · {nums.length} resposta(s)</div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
                        {dist.map((d, idx) => (
                          <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <div style={{ width: "100%", background: "var(--accent)", opacity: 0.85, borderRadius: 4, height: `${(d / maxD) * 44}px`, minHeight: d > 0 ? 4 : 0 }} />
                            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{idx + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={q.key}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{q.label}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {vals.length === 0 ? <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Sem respostas.</div> : vals.map((v, idx) => (
                        <div key={idx} style={{ fontSize: 12, color: "var(--text)", background: "var(--surface-alt)", borderRadius: 8, padding: "6px 10px" }}>{String(v)}</div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function RHComunicacaoView({ currentUser, canWrite }) {
  const { pesquisas, loading, enviarComunicado, criarPesquisa, setPesquisaStatus, deletarPesquisa, carregarRespostas, enviarPesquisaNotificacao } = useRHComunicacao({ userId: currentUser?.id });
  const [tab, setTab] = useState("comunicados");
  const [novaOpen, setNovaOpen] = useState(false);
  const [resultadosDe, setResultadosDe] = useState(null);
  const [pesquisaSearch, setPesquisaSearch] = useState("");
  const [pesquisaStatusFilter, setPesquisaStatusFilter] = useState("all");
  const [pesquisaModoFilter, setPesquisaModoFilter] = useState("all");
  const [notificando, setNotificando] = useState(null); // id da pesquisa sendo notificada
  const [notifyResult, setNotifyResult] = useState(null); // { id, count }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const pesquisasFiltradas = useMemo(() => {
    const q = pesquisaSearch.trim().toLowerCase();
    return pesquisas.filter((p) => {
      if (pesquisaStatusFilter !== "all" && p.status !== pesquisaStatusFilter) return false;
      if (pesquisaModoFilter !== "all" && (p.modo || "anonima") !== pesquisaModoFilter) return false;
      if (q && !p.titulo?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pesquisas, pesquisaSearch, pesquisaStatusFilter, pesquisaModoFilter]);

  const handleNotificar = async (pesquisaId) => {
    setNotificando(pesquisaId);
    setNotifyResult(null);
    try {
      const count = await enviarPesquisaNotificacao(pesquisaId);
      setNotifyResult({ id: pesquisaId, count });
    } catch (e) {
      setNotifyResult({ id: pesquisaId, error: e?.message || "Erro ao notificar." });
    } finally {
      setNotificando(null);
    }
  };

  if (!isSupabaseConfigured) {
    return <EmptyState icon={Megaphone} title="Supabase não configurado" description="Configure as variáveis de ambiente para usar este módulo." />;
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone size={22} style={{ color: "var(--text)" }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Comunicação</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Comunicados internos e pesquisas — anônimas ou identificadas</p>
        </div>
        {canWrite && tab === "pesquisas" && <Button icon={Plus} onClick={() => setNovaOpen(true)}>Nova pesquisa</Button>}
      </div>

      <div className="inline-flex rounded-lg border overflow-hidden mb-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
        {[{ id: "comunicados", label: "Comunicados", icon: Megaphone }, { id: "pesquisas", label: "Pesquisas", icon: ClipboardList }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} role="tab" aria-selected={tab === t.id}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
            style={{ background: tab === t.id ? "var(--accent)" : "var(--surface)", color: tab === t.id ? "var(--on-accent)" : "var(--text-dim)", border: "none" }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "comunicados" ? (
        canWrite ? <ComunicadoComposer onSend={enviarComunicado} /> : <EmptyState icon={Megaphone} title="Sem permissão" description="Só a gestão de RH envia comunicados." />
      ) : loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : (
        // Achado do Daniel (12/08/2026): sem nenhuma pesquisa cadastrada, a
        // busca e os dois filtros abaixo somiam junto com um EmptyState no
        // lugar — parecia bug. Filtros ficam sempre visíveis; a mensagem de
        // "nenhuma pesquisa" já existe logo abaixo (pesquisasFiltradas vazio
        // cobre tanto "zero pesquisas" quanto "zero pra este filtro").
        <>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <div className="relative" style={{ minWidth: 200 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
              <input
                value={pesquisaSearch}
                onChange={(e) => setPesquisaSearch(e.target.value)}
                placeholder="Buscar pesquisa…"
                className="w-full text-xs rounded-xl border pl-7 pr-3 py-1.5 outline-none"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
              />
            </div>
            <select
              value={pesquisaStatusFilter}
              onChange={(e) => setPesquisaStatusFilter(e.target.value)}
              className="text-xs rounded-xl border px-3 py-1.5 outline-none"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
            >
              <option value="all">Todos os status</option>
              <option value="aberta">Aberta</option>
              <option value="encerrada">Encerrada</option>
            </select>
            <select
              value={pesquisaModoFilter}
              onChange={(e) => setPesquisaModoFilter(e.target.value)}
              className="text-xs rounded-xl border px-3 py-1.5 outline-none"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
            >
              <option value="all">Todos os modos</option>
              <option value="anonima">Anônima</option>
              <option value="identificada">Identificada</option>
            </select>
          </div>
          {pesquisasFiltradas.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-dim)", padding: "24px 0", textAlign: "center" }}>
              {pesquisas.length === 0
                ? "Nenhuma pesquisa ainda — crie uma pesquisa anônima ou identificada acima."
                : "Nenhuma pesquisa encontrada com esses filtros."}
            </div>
          ) : (
        <div className="flex flex-col gap-3" style={{ maxWidth: 720 }}>
          {pesquisasFiltradas.map((p) => {
            const aberta = p.status === "aberta";
            const identificada = p.modo === "identificada";
            const url = `${origin}/pesquisa/${p.id}`;
            return (
              <div key={p.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{p.titulo}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                      {(p.perguntas?.length || 0)} pergunta(s) · {formatDateBR(p.created_at)}{p.fecha_em ? ` · encerra ${formatDateBR(p.fecha_em)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontSize: 11, fontWeight: 700, color: identificada ? "var(--channel-email-text)" : "var(--text-dim)", background: identificada ? "var(--channel-email-bg)" : "var(--surface-alt)", borderRadius: 99, padding: "2px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {identificada ? <UserCheck size={11} /> : <Lock size={11} />} {identificada ? "Identificada" : "Anônima"}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: aberta ? "var(--success)" : "var(--text-dim)", background: aberta ? "var(--success-bg)" : "var(--surface-alt)", borderRadius: 99, padding: "2px 10px" }}>
                      {aberta ? "Aberta" : "Encerrada"}
                    </span>
                  </div>
                </div>
                {canWrite && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                    {aberta && !identificada && <QRCodeButton url={url} title={p.titulo} buttonLabel="QR / link" compact />}
                    {aberta && identificada && (
                      <button onClick={() => handleNotificar(p.id)} disabled={notificando === p.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: notificando === p.id ? "default" : "pointer", opacity: notificando === p.id ? 0.6 : 1 }}>
                        {notificando === p.id ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />} Notificar colaboradores
                      </button>
                    )}
                    <button onClick={() => setResultadosDe(p)} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      <BarChart3 size={12} /> Ver respostas
                    </button>
                    <button onClick={() => setPesquisaStatus(p.id, aberta ? "encerrada" : "aberta")} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--surface)", color: "var(--text-dim)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {aberta ? "Encerrar" : "Reabrir"}
                    </button>
                    <MoveStageMenu
                      onDelete={() => deletarPesquisa(p.id)}
                      deleteLabel="Excluir pesquisa"
                      confirmMessage="Excluir esta pesquisa e todas as respostas? Não pode ser desfeito."
                    />
                  </div>
                )}
                {notifyResult?.id === p.id && (
                  <div style={{ marginTop: 8, fontSize: 12, color: notifyResult.error ? "var(--danger)" : "var(--success)" }}>
                    {notifyResult.error || `Notificação enviada para ${notifyResult.count} colaborador${notifyResult.count !== 1 ? "es" : ""}.`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
          )}
        </>
      )}

      {novaOpen && <NovaPesquisaModal onSave={criarPesquisa} onClose={() => setNovaOpen(false)} />}
      {resultadosDe && <ResultadosModal pesquisa={resultadosDe} carregarRespostas={carregarRespostas} onClose={() => setResultadosDe(null)} />}
    </div>
  );
}

export default RHComunicacaoView;
