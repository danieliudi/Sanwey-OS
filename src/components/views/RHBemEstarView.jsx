import React, { useEffect, useMemo, useState } from "react";
import {
  HeartHandshake, Plus, X, Trash2, Check, UserX, Clock, Pencil, AlertTriangle,
  CalendarDays, ArrowUp,
} from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHBemEstar } from "../../hooks/use-rh-bemestar";
import { RH_FRENTE_LABELS } from "../../constants/rh-frentes";
import { QRCodeButton } from "../shared/QRCodeButton";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { formatDateBR, toLocalISODate } from "../../utils/date";
import { gerarDatasRecorrentes, RECORRENCIA_TIPOS, DIAS_SEMANA, MAX_OCORRENCIAS } from "../../utils/recorrencia";

// Programas (ex-"Bem-estar" na tela; `bemestar` continua no banco e na rota
// pública — ver a nota de contrato no topo de use-rh-bemestar.js).
//
// Um programa tem N datas. Cada data carrega a própria janela de horários, a
// duração do slot e quantas vagas cabem por horário — antes disso tudo isso
// morava na sessão, uma data só e exatamente uma pessoa por horário.

function fmtHorario(t) {
  return (t || "").slice(0, 5);
}

const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };

const FILA_STATUS = {
  na_fila:   { label: "Agendado",  color: "var(--accent)",   bg: "var(--accent-tint)" },
  chamado:   { label: "Agendado",  color: "var(--accent)",   bg: "var(--accent-tint)" },
  atendido:  { label: "Atendido",  color: "var(--success)",  bg: "var(--success-bg)" },
  faltou:    { label: "Faltou",    color: "var(--danger)",   bg: "var(--danger-bg)" },
  cancelado: { label: "Cancelado", color: "var(--text-dim)", bg: "var(--surface-alt)" },
  espera:    { label: "Na espera", color: "var(--amber)",    bg: "var(--amber-bg)" },
};

// Status que OCUPA vaga. É a mesma lista da função do banco
// (get_bemestar_horarios_por_data) — se um dia divergir, a tela do RH e a
// página pública passam a contar coisas diferentes.
const OCUPA_VAGA = ["na_fila", "chamado", "atendido"];

function slotsDaData(d) {
  if (!d?.horario_inicio || !d?.horario_fim || !d?.slot_minutos) return 0;
  const toMin = (t) => {
    const [h, m] = String(t).split(":");
    return Number(h) * 60 + Number(m);
  };
  return Math.max(0, Math.floor((toMin(d.horario_fim) - toMin(d.horario_inicio)) / Number(d.slot_minutos)));
}

// ── Editor de uma data ────────────────────────────────────────────────────────
function CamposDaData({ valor, onChange }) {
  const set = (k) => (e) => onChange({ ...valor, [k]: e.target.value });
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))", gap: 10 }}>
      <div>
        <label style={labelSt}>Início</label>
        <input type="time" value={valor.horarioInicio} onChange={set("horarioInicio")} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
      </div>
      <div>
        <label style={labelSt}>Fim</label>
        <input type="time" value={valor.horarioFim} onChange={set("horarioFim")} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
      </div>
      <div>
        <label style={labelSt}>Cada horário (min)</label>
        <input type="number" min={5} step={5} value={valor.slotMinutos} onChange={set("slotMinutos")} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
      </div>
      <div>
        <label style={labelSt}>Vagas por horário</label>
        <input type="number" min={1} step={1} value={valor.vagasPorHorario} onChange={set("vagasPorHorario")} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
      </div>
    </div>
  );
}

// ── Bloco de recorrência ──────────────────────────────────────────────────────
function BlocoRecorrencia({ inicio, cfg, onChange }) {
  const set = (k, v) => onChange({ ...cfg, [k]: v });
  const usaDias = cfg.tipo === "semanal" || cfg.tipo === "quinzenal";

  const toggleDia = (id) => {
    const atual = cfg.diasSemana || [];
    set("diasSemana", atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
  };

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <label style={labelSt}>Repetir</label>
        <select value={cfg.tipo} onChange={(e) => set("tipo", e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt}>
          {RECORRENCIA_TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      {usaDias && (
        <div>
          <label style={labelSt}>Nos dias</label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {DIAS_SEMANA.map((d) => {
              const on = (cfg.diasSemana || []).includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDia(d.id)}
                  aria-pressed={on}
                  style={{ fontSize: 11, fontWeight: on ? 700 : 500, borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                    background: on ? "var(--accent)" : "var(--surface-alt)", color: on ? "var(--on-accent)" : "var(--text-dim)",
                    border: `1px solid ${on ? "var(--accent)" : "var(--border)"}` }}
                >
                  {d.curto}
                </button>
              );
            })}
          </div>
          {(cfg.diasSemana || []).length === 0 && (
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 5 }}>
              Sem dia marcado, repete no mesmo dia da semana da data inicial.
            </div>
          )}
        </div>
      )}

      {cfg.tipo === "cada_n_dias" && (
        <div>
          <label style={labelSt}>A cada quantos dias</label>
          <input type="number" min={1} step={1} value={cfg.intervaloDias} onChange={(e) => set("intervaloDias", e.target.value)} className="text-sm rounded-xl border px-3 py-2 outline-none" style={{ ...inputSt, width: 100 }} />
        </div>
      )}

      {cfg.tipo === "mensal_dia_semana" && inicio && (
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Repete na mesma posição do mês da data inicial (ex.: toda 1ª segunda).
          Mês que não tiver essa posição fica sem data, em vez de escorregar pro mês seguinte.
        </div>
      )}

      {cfg.tipo !== "nenhuma" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelSt}>Até</label>
            <input type="date" value={cfg.ate || ""} onChange={(e) => set("ate", e.target.value)} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Ou por N ocorrências</label>
            <input type="number" min={1} max={MAX_OCORRENCIAS} step={1} value={cfg.ocorrencias || ""} onChange={(e) => set("ocorrencias", e.target.value)} placeholder={`máx. ${MAX_OCORRENCIAS}`} className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal de novo programa ────────────────────────────────────────────────────
function ProgramaFormModal({ programa, onSave, onClose }) {
  const isEdit = Boolean(programa);
  const hoje = toLocalISODate(new Date());

  const [titulo, setTitulo] = useState(programa?.titulo || "");
  const [descricao, setDescricao] = useState(programa?.descricao || "");
  const [inicio, setInicio] = useState(hoje);
  const [padrao, setPadrao] = useState({ horarioInicio: "09:00", horarioFim: "17:00", slotMinutos: 30, vagasPorHorario: 1 });
  const [rec, setRec] = useState({ tipo: "nenhuma", diasSemana: [], intervaloDias: 7, ate: "", ocorrencias: "" });
  const [removidas, setRemovidas] = useState(() => new Set());
  const [extras, setExtras] = useState([]);
  const [novaExtra, setNovaExtra] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const geradas = useMemo(
    () => gerarDatasRecorrentes({ inicio, tipo: rec.tipo, diasSemana: rec.diasSemana, intervaloDias: rec.intervaloDias, ate: rec.ate, ocorrencias: rec.ocorrencias }),
    [inicio, rec],
  );

  const datasFinais = useMemo(() => {
    const todas = [...new Set([...geradas.datas, ...extras])].filter((d) => !removidas.has(d));
    return todas.sort();
  }, [geradas.datas, extras, removidas]);

  const handleSave = async () => {
    if (!titulo.trim()) { setError("Título obrigatório."); return; }
    if (!padrao.horarioInicio || !padrao.horarioFim || padrao.horarioInicio >= padrao.horarioFim) {
      setError("Informe uma janela de horário válida (início antes do fim)."); return;
    }
    if (!Number(padrao.slotMinutos) || Number(padrao.slotMinutos) <= 0) { setError("Duração do horário inválida."); return; }
    if (!Number(padrao.vagasPorHorario) || Number(padrao.vagasPorHorario) < 1) { setError("Vagas por horário precisa ser 1 ou mais."); return; }
    if (!isEdit && datasFinais.length === 0) { setError("Escolha ao menos uma data — sem data o link público não oferece horário nenhum."); return; }
    setSaving(true); setError(null);
    try {
      await onSave({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        datas: datasFinais.map((d) => ({ data: d, ...padrao })),
      });
      onClose();
    } catch (e) { setError(e?.message || "Erro ao salvar o programa."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "var(--shadow-pop)", maxHeight: "92vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{isEdit ? "Editar programa" : "Novo programa"}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>

        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          <div>
            <label style={labelSt}>Título *</label>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Massagem express" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} autoFocus />
          </div>
          <div>
            <label style={labelSt}>Descrição</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
          </div>

          {!isEdit && (
            <>
              <div>
                <label style={labelSt}>Primeira data *</label>
                <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
              </div>

              <CamposDaData valor={padrao} onChange={setPadrao} />
              <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: -4 }}>
                Vale pra todas as datas geradas. Depois de criadas, cada data pode ser ajustada sozinha.
              </p>

              <BlocoRecorrencia inicio={inicio} cfg={rec} onChange={setRec} />

              <div>
                <label style={labelSt}>Datas ({datasFinais.length})</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {datasFinais.map((d) => (
                    <span key={d} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 99, padding: "3px 8px 3px 10px", fontSize: 11, color: "var(--text)" }}>
                      {formatDateBR(d)}
                      <button type="button" onClick={() => setRemovidas((prev) => new Set(prev).add(d))} title="Tirar esta data" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}>
                        <X size={11} color="var(--text-dim)" />
                      </button>
                    </span>
                  ))}
                  {datasFinais.length === 0 && (
                    <span style={{ fontSize: 12, color: "var(--danger)" }}>
                      Nenhuma data — confira o &quot;até&quot;, que pode estar antes da primeira data.
                    </span>
                  )}
                </div>

                {geradas.truncado && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "var(--warning-bg)", color: "var(--warning)", borderRadius: 8, padding: "6px 10px", fontSize: 11, marginTop: 8 }}>
                    <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                    A recorrência parou em {MAX_OCORRENCIAS} datas, que é o teto. Defina um &quot;até&quot; se quiser controlar onde termina.
                  </div>
                )}

                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input type="date" value={novaExtra} onChange={(e) => setNovaExtra(e.target.value)} className="text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
                  <button
                    type="button"
                    onClick={() => {
                      if (!novaExtra) return;
                      setRemovidas((prev) => { const n = new Set(prev); n.delete(novaExtra); return n; });
                      setExtras((prev) => [...new Set([...prev, novaExtra])]);
                      setNovaExtra("");
                    }}
                    disabled={!novaExtra}
                    style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 10, padding: "0 12px", fontSize: 12, color: "var(--text)", cursor: novaExtra ? "pointer" : "default", opacity: novaExtra ? 1 : 0.5 }}
                  >
                    Adicionar data
                  </button>
                </div>
              </div>
            </>
          )}

          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : isEdit ? "Salvar alterações" : `Criar programa${datasFinais.length > 1 ? ` (${datasFinais.length} datas)` : ""}`}
            </button>
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal de uma data ─────────────────────────────────────────────────────────
function DataFormModal({ data, sessaoId, onSave, onClose }) {
  const isEdit = Boolean(data?.id);
  const [dia, setDia] = useState(data?.data || toLocalISODate(new Date()));
  const [campos, setCampos] = useState({
    horarioInicio: data?.horario_inicio?.slice(0, 5) || "09:00",
    horarioFim: data?.horario_fim?.slice(0, 5) || "17:00",
    slotMinutos: data?.slot_minutos || 30,
    vagasPorHorario: data?.vagas_por_horario || 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSave = async () => {
    if (!dia) { setError("Escolha a data."); return; }
    if (campos.horarioInicio >= campos.horarioFim) { setError("O início precisa vir antes do fim."); return; }
    setSaving(true); setError(null);
    try {
      await onSave(isEdit ? { ...campos, data: dia } : [{ ...campos, data: dia }], sessaoId);
      onClose();
    } catch (e) { setError(e?.message || "Erro ao salvar a data."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "var(--shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{isEdit ? "Editar data" : "Nova data"}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelSt}>Data *</label>
            <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} autoFocus />
          </div>
          <CamposDaData valor={campos} onChange={setCampos} />
          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Agenda de uma data ────────────────────────────────────────────────────────
function AgendaData({ data, fila, canWrite, onSetStatus, onPromover, onEditar, onExcluir }) {
  const [erro, setErro] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reservas = useMemo(
    () => fila.filter((f) => f.data_id === data.id).sort((a, b) => (a.horario || "").localeCompare(b.horario || "")),
    [fila, data.id],
  );
  const ocupadas = reservas.filter((f) => OCUPA_VAGA.includes(f.status)).length;
  const espera = reservas.filter((f) => f.status === "espera");
  const capacidade = slotsDaData(data) * (data.vagas_por_horario || 1);

  const promover = async (id) => {
    setErro("");
    const r = await onPromover(id);
    if (!r.ok) setErro(r.motivo);
  };

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <CalendarDays size={13} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{formatDateBR(data.data)}</span>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {fmtHorario(data.horario_inicio)}–{fmtHorario(data.horario_fim)} · {data.slot_minutos} min · {data.vagas_por_horario} vaga{data.vagas_por_horario > 1 ? "s" : ""}/horário
        </span>
        {/* Origem do número (regra 14): ocupadas = reservas desta data com
            status que ocupa vaga; capacidade = slots da janela × vagas por
            horário. Contagem inteira, sem percentual. */}
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", background: "var(--surface-alt)", borderRadius: 99, padding: "2px 9px" }}>
          {ocupadas} de {capacidade} vagas
        </span>
        {espera.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)", background: "var(--amber-bg)", borderRadius: 99, padding: "2px 9px" }}>
            {espera.length} na espera
          </span>
        )}
        <span style={{ flex: 1 }} />
        {canWrite && (
          confirmDelete ? (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text)" }}>Excluir data e {reservas.length} reserva{reservas.length !== 1 ? "s" : ""}?</span>
              <button onClick={() => { onExcluir(data.id); setConfirmDelete(false); }} style={{ background: "var(--danger)", color: "var(--on-danger)", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Excluir</button>
              <button onClick={() => setConfirmDelete(false)} style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>Cancelar</button>
            </span>
          ) : (
            <>
              <button onClick={() => onEditar(data)} title="Editar data" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 4 }}><Pencil size={13} /></button>
              <button onClick={() => setConfirmDelete(true)} title="Excluir data" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 4 }}><Trash2 size={13} /></button>
            </>
          )
        )}
      </div>

      {erro && <div style={{ fontSize: 11, color: "var(--danger)", background: "var(--danger-bg)", borderRadius: 6, padding: "5px 9px", marginBottom: 8 }}>{erro}</div>}

      {reservas.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Nenhum horário reservado nesta data.</div>
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
                {canWrite && f.status === "espera" && (
                  <button onClick={() => promover(f.id)} title="Promover para o horário" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 9px", fontSize: 11, fontWeight: 600, color: "var(--text)", cursor: "pointer", flexShrink: 0 }}>
                    <ArrowUp size={11} /> Promover
                  </button>
                )}
                {canWrite && OCUPA_VAGA.includes(f.status) && f.status !== "atendido" && (
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
  const {
    sessoes, datas, fila, loading,
    criarPrograma, atualizarPrograma, adicionarDatas, atualizarData, deletarData,
    setSessaoStatus, deletarSessao, setFilaStatus, promoverDaEspera,
  } = useRHBemEstar({ userId: currentUser?.id });
  const [novaOpen, setNovaOpen] = useState(false);
  const [editPrograma, setEditPrograma] = useState(null);
  const [dataModal, setDataModal] = useState(null); // { sessaoId, data? }
  const [expanded, setExpanded] = useState(() => new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const datasPorSessao = useMemo(() => {
    const m = new Map();
    for (const d of datas) {
      if (!m.has(d.sessao_id)) m.set(d.sessao_id, []);
      m.get(d.sessao_id).push(d);
    }
    for (const lista of m.values()) lista.sort((a, b) => String(a.data).localeCompare(String(b.data)));
    return m;
  }, [datas]);

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
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
            <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Programas</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Massagem, avaliação física, palestra — várias datas por programa, um link só</p>
        </div>
        {canWrite && <Button icon={Plus} onClick={() => setNovaOpen(true)} dataTour="programas-novo">Novo programa</Button>}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : sessoes.length === 0 ? (
        <EmptyState icon={HeartHandshake} title="Nenhum programa" description="Crie um programa (massagem, quick massage, avaliação física…), gere as datas — uma, ou uma série recorrente — e compartilhe o QR." />
      ) : (
        <div className="flex flex-col gap-3" style={{ maxWidth: 760 }}>
          {sessoes.map((s) => {
            const aberta = s.status === "aberta";
            const minhasDatas = datasPorSessao.get(s.id) || [];
            const reservados = fila.filter((f) => f.sessao_id === s.id && OCUPA_VAGA.includes(f.status)).length;
            const isOpen = expanded.has(s.id);
            const url = `${origin}/bem-estar/${s.id}`;
            return (
              <div key={s.id} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "12px 16px", background: "var(--surface-alt)" }}>
                  <button onClick={() => toggle(s.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{s.titulo}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                      {minhasDatas.length} data{minhasDatas.length !== 1 ? "s" : ""} · {reservados} reserva{reservados !== 1 ? "s" : ""}
                    </div>
                  </button>
                  {minhasDatas.length === 0 && (
                    <span title="Programa sem data nenhuma — o link público não tem horário a oferecer até você criar uma." style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--warning)", background: "var(--warning-bg)", borderRadius: 99, padding: "2px 10px", flexShrink: 0 }}>
                      <AlertTriangle size={11} /> Sem data
                    </span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 700, color: aberta ? "var(--success)" : "var(--text-dim)", background: aberta ? "var(--success-bg)" : "var(--surface)", borderRadius: 99, padding: "2px 10px", flexShrink: 0 }}>
                    {aberta ? "Aberto" : "Encerrado"}
                  </span>
                  {canWrite && (
                    confirmDeleteId === s.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: "var(--text)", whiteSpace: "nowrap" }}>Excluir programa, datas e reservas?</span>
                        <button
                          onClick={() => { deletarSessao(s.id); setConfirmDeleteId(null); }}
                          style={{ background: "var(--danger)", color: "var(--on-danger)", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                        >
                          Excluir
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => setEditPrograma(s)} title="Editar programa" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 4, flexShrink: 0 }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setSessaoStatus(s.id, aberta ? "encerrada" : "aberta")} style={{ fontSize: 11, color: "var(--text-dim)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                          {aberta ? "Encerrar" : "Reabrir"}
                        </button>
                        <button onClick={() => setConfirmDeleteId(s.id)} title="Excluir" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 4, flexShrink: 0 }}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )
                  )}
                </div>

                {isOpen && (
                  <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {aberta && canWrite && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <QRCodeButton url={url} title={s.titulo} buttonLabel="QR / link" compact />
                        <button onClick={() => setDataModal({ sessaoId: s.id })} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "var(--text)", cursor: "pointer" }}>
                          <Plus size={12} /> Adicionar data
                        </button>
                      </div>
                    )}
                    {minhasDatas.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Nenhuma data ainda. O link público só passa a oferecer horários depois da primeira.</div>
                    ) : (
                      minhasDatas.map((d) => (
                        <AgendaData
                          key={d.id}
                          data={d}
                          fila={fila}
                          canWrite={canWrite}
                          onSetStatus={setFilaStatus}
                          onPromover={promoverDaEspera}
                          onEditar={(dd) => setDataModal({ sessaoId: s.id, data: dd })}
                          onExcluir={deletarData}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {novaOpen && <ProgramaFormModal onSave={criarPrograma} onClose={() => setNovaOpen(false)} />}
      {editPrograma && (
        <ProgramaFormModal
          programa={editPrograma}
          onSave={(d) => atualizarPrograma(editPrograma.id, d)}
          onClose={() => setEditPrograma(null)}
        />
      )}
      {dataModal && (
        <DataFormModal
          data={dataModal.data}
          sessaoId={dataModal.sessaoId}
          onSave={(payload, sessaoId) => (dataModal.data ? atualizarData(dataModal.data.id, payload) : adicionarDatas(sessaoId, payload))}
          onClose={() => setDataModal(null)}
        />
      )}
    </div>
  );
}

export default RHBemEstarView;
