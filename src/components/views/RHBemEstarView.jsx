import React, { useEffect, useMemo, useState } from "react";
import {
  HeartHandshake, Plus, X, Trash2, Check, UserX, Clock,
} from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHBemEstar } from "../../hooks/use-rh-bemestar";
import { RH_FRENTE_LABELS } from "../../constants/rh-frentes";
import { QRCodeButton } from "../shared/QRCodeButton";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function fmtHorario(t) {
  return (t || "").slice(0, 5);
}

const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };

const FILA_STATUS = {
  na_fila:  { label: "Agendado",  color: "var(--accent)",   bg: "var(--accent-tint)" },
  chamado:  { label: "Agendado",  color: "var(--accent)",   bg: "var(--accent-tint)" },
  atendido: { label: "Atendido",  color: "var(--success)",  bg: "#DCFCE7" },
  faltou:   { label: "Faltou",    color: "var(--danger)",   bg: "#FEE2E2" },
};

function NovaSessaoModal({ onSave, onClose }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("09:00");
  const [horarioFim, setHorarioFim] = useState("17:00");
  const [slotMinutos, setSlotMinutos] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSave = async () => {
    if (!titulo.trim()) { setError("Título obrigatório."); return; }
    if (!horarioInicio || !horarioFim || horarioInicio >= horarioFim) { setError("Informe uma janela de horário válida (início antes do fim)."); return; }
    if (!slotMinutos || Number(slotMinutos) <= 0) { setError("Duração do horário inválida."); return; }
    setSaving(true); setError(null);
    try {
      await onSave({ titulo: titulo.trim(), descricao: descricao.trim() || null, data: data || null, horarioInicio, horarioFim, slotMinutos: Number(slotMinutos) });
      onClose();
    } catch (e) { setError(e?.message || "Erro ao criar sessão."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "var(--shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova sessão de bem-estar</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelSt}>Título *</label>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Massagem express" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} autoFocus />
          </div>
          <div>
            <label style={labelSt}>Descrição</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
          </div>
          <div className="grid grid-cols-3" style={{ gap: 10 }}>
            <div>
              <label style={labelSt}>Início</label>
              <input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Fim</label>
              <input type="time" value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Cada horário (min)</label>
              <input type="number" min={5} step={5} value={slotMinutos} onChange={(e) => setSlotMinutos(e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: -4 }}>
            Quem entrar pelo QR escolhe um horário livre dentro dessa janela — igual reserva de restaurante.
          </p>
          {error && <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Criar sessão"}
            </button>
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgendaSessao({ sessao, fila, canWrite, onSetStatus, origin }) {
  const reservas = useMemo(() => fila.filter((f) => f.sessao_id === sessao.id).sort((a, b) => (a.horario || "").localeCompare(b.horario || "")), [fila, sessao.id]);
  const url = `${origin}/bem-estar/${sessao.id}`;
  const aberta = sessao.status === "aberta";

  return (
    <div style={{ padding: "8px 16px 14px" }}>
      {aberta && canWrite && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <QRCodeButton url={url} title={sessao.titulo} buttonLabel="QR / link" compact />
        </div>
      )}
      {reservas.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Nenhum horário reservado ainda.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {reservas.map((f) => {
            const st = FILA_STATUS[f.status] || FILA_STATUS.na_fila;
            const contatos = [f.ramal ? `ramal ${f.ramal}` : null, f.email, f.whatsapp].filter(Boolean).join(" · ");
            return (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "'Barlow Condensed', Inter, sans-serif", fontWeight: 800, fontSize: 16, color: "var(--text)", minWidth: 56 }}>
                  <Clock size={13} style={{ color: "var(--text-dim)" }} /> {fmtHorario(f.horario)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text)" }}>{f.nome}{f.frente ? <span style={{ color: "var(--text-dim)", fontSize: 11 }}> · {RH_FRENTE_LABELS[f.frente] || f.frente}</span> : null}</div>
                  {contatos && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{contatos}</div>}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 99, padding: "2px 9px", flexShrink: 0 }}>{st.label}</span>
                {canWrite && f.status !== "atendido" && f.status !== "faltou" && (
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    <button onClick={() => onSetStatus(f.id, "atendido")} title="Atendido" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", padding: 10, minWidth: 40, minHeight: 40 }}><Check size={15} /></button>
                    <button onClick={() => onSetStatus(f.id, "faltou")} title="Faltou" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", padding: 10, minWidth: 40, minHeight: 40 }}><UserX size={15} /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RHBemEstarView({ currentUser, canWrite }) {
  const { sessoes, fila, loading, criarSessao, setSessaoStatus, deletarSessao, setFilaStatus } = useRHBemEstar({ userId: currentUser?.id });
  const [novaOpen, setNovaOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (!isSupabaseConfigured) {
    return <EmptyState icon={HeartHandshake} title="Supabase não configurado" description="Configure as variáveis de ambiente para usar este módulo." />;
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <HeartHandshake size={22} style={{ color: "var(--text)" }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Bem-estar</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Sessões com horário marcado por QR (igual reserva de restaurante)</p>
        </div>
        {canWrite && <Button icon={Plus} onClick={() => setNovaOpen(true)}>Nova sessão</Button>}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : sessoes.length === 0 ? (
        <EmptyState icon={HeartHandshake} title="Nenhuma sessão" description="Crie uma sessão (massagem, quick massage, avaliação física…), defina a janela de horários e compartilhe o QR." />
      ) : (
        <div className="flex flex-col gap-3" style={{ maxWidth: 720 }}>
          {sessoes.map((s) => {
            const aberta = s.status === "aberta";
            const reservados = fila.filter((f) => f.sessao_id === s.id && f.status !== "faltou").length;
            const isOpen = expanded.has(s.id);
            return (
              <div key={s.id} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--surface-alt)" }}>
                  <button onClick={() => toggle(s.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{s.titulo}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                      {s.data ? `${fmt(s.data)} · ` : ""}
                      {s.horario_inicio && s.horario_fim ? `${fmtHorario(s.horario_inicio)}–${fmtHorario(s.horario_fim)} · ` : ""}
                      {reservados} reserva{reservados !== 1 ? "s" : ""}
                    </div>
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 700, color: aberta ? "var(--success)" : "var(--text-dim)", background: aberta ? "#DCFCE7" : "var(--surface)", borderRadius: 99, padding: "2px 10px" }}>
                    {aberta ? "Aberta" : "Encerrada"}
                  </span>
                  {canWrite && (
                    <>
                      <button onClick={() => setSessaoStatus(s.id, aberta ? "encerrada" : "aberta")} style={{ fontSize: 11, color: "var(--text-dim)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                        {aberta ? "Encerrar" : "Reabrir"}
                      </button>
                      <button onClick={() => { if (window.confirm("Excluir esta sessão e as reservas?")) deletarSessao(s.id); }} title="Excluir" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 4, flexShrink: 0 }}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
                {isOpen && (
                  <AgendaSessao sessao={s} fila={fila} canWrite={canWrite} onSetStatus={setFilaStatus} origin={origin} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {novaOpen && <NovaSessaoModal onSave={criarSessao} onClose={() => setNovaOpen(false)} />}
    </div>
  );
}

export default RHBemEstarView;
