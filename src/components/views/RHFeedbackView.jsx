import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare, Plus, X, TrendingUp, Pencil, Settings2, AlertCircle,
  LayoutGrid, List, CalendarDays as CalendarIcon, ChevronLeft, ChevronRight,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHFeedback } from "../../hooks/use-rh-feedback";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useMyColaborador } from "../../hooks/use-my-colaborador";
import { useRHMovimentacoes } from "../../hooks/use-rh-movimentacoes";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { useProfiles } from "../../hooks/use-profiles";
import { nextPendingCycle, addDaysISO } from "../../utils/rh-feedback-cycles";
import { formatBRL } from "../../utils/currency";
import { RHStageEditorModal } from "../rh-pipeline/RHStageEditorModal";
import { RHStageFieldEditorModal } from "../rh-pipeline/RHStageFieldEditorModal";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { RHKanbanCard } from "../rh-pipeline/RHKanbanCard";
import { RHDetailDrawerShell, RHDetailComments } from "../rh-pipeline/RHDetailDrawerShell";
import { StageNavigator } from "../shared/StageNavigator";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { resolveVisibleFields, getMissingRequiredFields, getFieldCompleteness } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { AvatarStack } from "../shared/AvatarStack";

// Avaliadores elegíveis (FASE 5) — mesmo critério admin/RH usado pela ramificação
// de acesso amplo da RLS rh_avaliacoes_read (admin/gerente_rh/rh enxergam tudo).
const EVALUATOR_ROLES = ["admin", "gerente_rh", "rh"];
function isEvaluatorEligible(u) {
  const roles = u.roles?.length ? u.roles : (u.role ? [u.role] : []);
  return roles.some(r => EVALUATOR_ROLES.includes(r));
}

const TIPOS = [
  { id: "30_dias",     label: "30 dias" },
  { id: "60_dias",     label: "60 dias" },
  { id: "90_dias",     label: "90 dias" },
  { id: "semestral",   label: "Semestral" },
  { id: "anual",       label: "Anual" },
  { id: "ad_hoc",      label: "Ad-hoc" },
  { id: "reavaliacao", label: "Reavaliação" },
];

// Nota qualitativa-ancorada em vez de número solto: pesquisa de mercado
// (Adobe/Deloitte/Microsoft e afins) mostra que escalas com rótulo reduzem o
// viés de "todo mundo tira 8" e dão contexto real pra conversa de avaliação.
// O valor numérico por trás (0-10) continua existindo pra cálculo da nota
// final e pro histórico/gráfico de tendência já existentes.
const RATING_SCALE = [
  { value: 2,  label: "Abaixo do esperado" },
  { value: 5,  label: "Em desenvolvimento" },
  { value: 7,  label: "Atende as expectativas" },
  { value: 9,  label: "Supera as expectativas" },
  { value: 10, label: "Excepcional" },
];

function findStage(stages, stageKey) {
  return stages.find((s) => s.stageKey === stageKey) || stages[0] || { name: "—", color: "#8A8680", stageKey };
}

function daysInStage(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// ── Kanban/Tabela/Calendário — mesmo padrão de ComprasMarketingView/CRMView ──

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function ViewToggleButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
      style={{
        background: active ? "var(--accent)" : "var(--surface)",
        color: active ? "#FFFFFF" : "var(--text-dim)",
        border: "none",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "var(--surface)"; }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function tipoLabel(id) {
  return TIPOS.find(t => t.id === id)?.label || id;
}

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function ratingColor(r) {
  if (r == null) return "var(--text-dim)";
  return r >= 7 ? "var(--success)" : r >= 4 ? "var(--warning)" : "var(--danger)";
}

// Resumo no topo — mesmo padrão do ComplianceStats de Treinamentos, que
// não tinha equivalente aqui (inconsistência de densidade informacional
// entre as duas telas de RH mais correlatas).
function AvaliacaoStats({ feedbacks }) {
  const stats = useMemo(() => {
    const ativos = feedbacks.filter((f) => f.status !== "concluido");
    const atrasados = ativos.filter(isAtrasado);
    const concluidos = feedbacks.filter((f) => f.status === "concluido");
    const notas = concluidos.map((f) => f.final_rating).filter((n) => typeof n === "number");
    const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
    return { ativos: ativos.length, atrasados: atrasados.length, concluidos: concluidos.length, media };
  }, [feedbacks]);

  if (feedbacks.length === 0) return null;

  const tiles = [
    { label: "Ciclos ativos", value: stats.ativos, color: "var(--text)" },
    { label: "Atrasados",     value: stats.atrasados, color: stats.atrasados > 0 ? "var(--danger)" : "var(--text)" },
    { label: "Concluídos",    value: stats.concluidos, color: "var(--text)" },
    { label: "Nota média",    value: stats.media != null ? stats.media.toFixed(1) : "—", color: ratingColor(stats.media) },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {tiles.map((t) => (
        <div key={t.label} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", background: "var(--surface)" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.color, lineHeight: 1 }}>{t.value}</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}

function ratingScaleLabel(r) {
  if (r == null) return null;
  const n = Number(r);
  let closest = RATING_SCALE[0];
  for (const s of RATING_SCALE) {
    if (Math.abs(s.value - n) < Math.abs(closest.value - n)) closest = s;
  }
  return closest.label;
}

function autoavaliacaoLabel(feedback, colaborador) {
  if (feedback.self_rating != null) return `Autoavaliação: ${Number(feedback.self_rating).toFixed(1)}/10`;
  if (!colaborador?.profileId) return "Sem login — sem autoavaliação";
  return "Aguardando autoavaliação";
}

function InitialsAvatar({ name, size = 32 }) {
  const initials = (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--color-industria)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, flexShrink: 0, letterSpacing: "0.02em" }}>
      {initials}
    </div>
  );
}

// ── Seletor de nota qualitativo ────────────────────────────────────────────────

function RatingSelector({ value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {RATING_SCALE.map((opt) => {
        const active = Number(value) === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, textAlign: "left",
              border: `1.5px solid ${active ? ratingColor(opt.value) : "var(--border)"}`,
              background: active ? `${ratingColor(opt.value)}14` : "var(--surface)",
              color: active ? ratingColor(opt.value) : "var(--text)",
              cursor: "pointer",
            }}
          >
            {opt.label}
            <span style={{ fontSize: 10, opacity: 0.7 }}>{opt.value}/10</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Modal: novo feedback ad-hoc ────────────────────────────────────────────────

function NovoFeedbackModal({ colaboradores, onSave, onClose }) {
  const [colaboradorId, setColaboradorId]         = useState("");
  const [tipo, setTipo]                           = useState("ad_hoc");
  const [notaGeral, setNotaGeral]                 = useState(null);
  const [pontosFortes, setPontosFortes]           = useState("");
  const [pontosDesenvolvimento, setPontosDesenvolvimento] = useState("");
  const [notas, setNotas]                         = useState("");
  const [saving, setSaving]                       = useState(false);
  const [error, setError]                         = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!colaboradorId) { setError("Selecione o colaborador."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        colaboradorId, tipo,
        notaGeral,
        pontosFortes: pontosFortes.trim(),
        pontosDesenvolvimento: pontosDesenvolvimento.trim(),
        notas: notas.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao registrar feedback.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Novo feedback</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Colaborador *</label>
                <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  <option value="">Selecionar</option>
                  {colaboradores.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelSt}>Nota geral</label>
              <RatingSelector value={notaGeral} onChange={setNotaGeral} />
            </div>
            <div>
              <label style={labelSt}>Pontos fortes</label>
              <textarea value={pontosFortes} onChange={(e) => setPontosFortes(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Pontos de desenvolvimento</label>
              <textarea value={pontosDesenvolvimento} onChange={(e) => setPontosDesenvolvimento(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Notas (texto livre)</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
          </div>

          {error && <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Registrar feedback"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: completar ciclo pendente (RH) ───────────────────────────────────────

const DESFECHOS = [
  { id: "mantido",   label: "Mantido no cargo",  hint: "Segue no ciclo normal de avaliação." },
  { id: "promovido", label: "Promovido",          hint: "Envia o ajuste de salário para aprovação da diretoria." },
  { id: "reavaliar", label: "Reavaliar",          hint: "Agenda uma nova avaliação em 3 ou 6 meses." },
  { id: "reprovado", label: "Não aprovado",       hint: "Encerra com parecer negativo." },
];

function CompletarFeedbackModal({ feedback, colaborador, onComplete, onClose }) {
  const [managerRating, setManagerRating]         = useState(null);
  const [pontosFortes, setPontosFortes]           = useState("");
  const [pontosDesenvolvimento, setPontosDesenvolvimento] = useState("");
  const [notas, setNotas]                         = useState("");
  const [desfecho, setDesfecho]                   = useState("mantido");
  const [novoSalario, setNovoSalario]             = useState("");
  const [reavaliarMeses, setReavaliarMeses]       = useState("3");
  const [saving, setSaving]                       = useState(false);
  const [error, setError]                         = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (desfecho === "promovido" && novoSalario !== "" && !(Number(novoSalario) > 0)) {
      setError("Informe um salário válido para a promoção (ou deixe em branco).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onComplete(feedback.id, {
        managerRating,
        pontosFortes: pontosFortes.trim(),
        pontosDesenvolvimento: pontosDesenvolvimento.trim(),
        notas: notas.trim() || null,
        desfecho,
        novoSalario: desfecho === "promovido" ? (novoSalario === "" ? null : Number(novoSalario)) : null,
        reavaliarMeses: desfecho === "reavaliar" ? Number(reavaliarMeses) : null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao concluir avaliação.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Concluir avaliação</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
            {colaborador?.fullName || "—"} · {tipoLabel(feedback.tipo)} · {fmt(feedback.period_start)} – {fmt(feedback.period_end)}
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          {feedback.self_rating != null && (
            <div style={{ background: "var(--surface-alt)", border: "1px solid #BFDBFE", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#1E40AF", marginBottom: 14 }}>
              Autoavaliação do colaborador: <b>{ratingScaleLabel(feedback.self_rating)} ({Number(feedback.self_rating).toFixed(1)}/10)</b>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelSt}>Nota do gestor</label>
              <RatingSelector value={managerRating} onChange={setManagerRating} />
            </div>
            <div>
              <label style={labelSt}>Pontos fortes</label>
              <textarea value={pontosFortes} onChange={(e) => setPontosFortes(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Pontos de desenvolvimento</label>
              <textarea value={pontosDesenvolvimento} onChange={(e) => setPontosDesenvolvimento(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Notas (texto livre)</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>

            <div>
              <label style={labelSt}>Desfecho</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {DESFECHOS.map((d) => {
                  const active = desfecho === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDesfecho(d.id)}
                      style={{
                        textAlign: "left", padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                        border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
                        background: active ? "var(--accent-tint)" : "var(--surface)",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? "var(--accent)" : "var(--text)" }}>{d.label}</div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>{d.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {desfecho === "promovido" && (
              <div>
                <label style={labelSt}>Novo salário (opcional)</label>
                <input
                  type="number" min="0" step="0.01" value={novoSalario}
                  onChange={(e) => setNovoSalario(e.target.value)}
                  placeholder={colaborador?.salary != null ? `Atual: ${formatBRL(colaborador.salary)}` : "R$ 0,00"}
                  className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt}
                />
                <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>
                  Se preenchido, atualiza o salário no cadastro do colaborador e guarda o histórico no desfecho.
                </p>
              </div>
            )}

            {desfecho === "reavaliar" && (
              <div>
                <label style={labelSt}>Reavaliar em</label>
                <select value={reavaliarMeses} onChange={(e) => setReavaliarMeses(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  <option value="3">3 meses</option>
                  <option value="6">6 meses</option>
                </select>
                <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>
                  Cria automaticamente um novo ciclo de reavaliação com esse prazo.
                </p>
              </div>
            )}
          </div>

          {error && <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : "Concluir avaliação"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: autoavaliação (colaborador) ─────────────────────────────────────────

function AutoavaliacaoModal({ feedback, onSubmit, onClose }) {
  const [rating, setRating] = useState(feedback.self_rating ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating == null) { setError("Escolha uma opção."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(feedback.id, Number(rating));
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao enviar autoavaliação.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "var(--shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Sua autoavaliação</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
            {tipoLabel(feedback.tipo)} · até {fmt(feedback.period_end)}
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12, lineHeight: 1.5 }}>
            Como você avalia o seu próprio desempenho neste período? Seu gestor vai preencher a avaliação dele separadamente.
          </p>
          <label style={labelSt}>Sua avaliação</label>
          <RatingSelector value={rating} onChange={setRating} />

          {error && <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Enviando…" : "Enviar autoavaliação"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Drawer: histórico/tendência por colaborador ────────────────────────────────

function HistoricoDrawer({ colaborador, feedbacksDoColaborador, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const concluidos = useMemo(
    () => feedbacksDoColaborador
      .filter(f => f.status === "concluido")
      .slice()
      .sort((a, b) => new Date(a.period_end) - new Date(b.period_end)),
    [feedbacksDoColaborador]
  );

  const chartData = concluidos
    .filter(f => f.final_rating != null)
    .map(f => ({ data: fmt(f.period_end), nota: Number(f.final_rating), tipo: tipoLabel(f.tipo) }));

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 999 }} onClick={onClose} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: "var(--surface)", zIndex: 1000, display: "flex", flexDirection: "column", boxShadow: "var(--shadow-pop)", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{colaborador?.fullName || "—"}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{colaborador?.jobTitle || "—"} · {colaborador?.department || "—"}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 8, display: "flex", flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Tendência da nota final</div>
          {chartData.length >= 2 ? (
            <div style={{ marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: "var(--text-dim)" }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "var(--text-dim)" }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="nota" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 20 }}>
              Ainda não há histórico suficiente pra mostrar uma tendência (precisa de pelo menos 2 avaliações concluídas).
            </div>
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Histórico completo</div>
          {concluidos.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Nenhuma avaliação concluída ainda.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {concluidos.slice().reverse().map(f => (
                <div key={f.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{tipoLabel(f.tipo)}</span>
                    {f.final_rating != null && (
                      <span style={{ fontWeight: 800, fontSize: 14, color: ratingColor(f.final_rating) }}>{Number(f.final_rating).toFixed(1)}/10</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{fmt(f.period_end)}</div>
                  {f.conteudo?.pontos_fortes && <div style={{ fontSize: 12, color: "var(--text)", marginTop: 4 }}><b>Pontos fortes:</b> {f.conteudo.pontos_fortes}</div>}
                  {f.conteudo?.pontos_desenvolvimento && <div style={{ fontSize: 12, color: "var(--text)", marginTop: 2 }}><b>A desenvolver:</b> {f.conteudo.pontos_desenvolvimento}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Card do Kanban ────────────────────────────────────────────────────────────

function isAtrasado(feedback) {
  return feedback.status !== "concluido" && feedback.period_end && new Date(feedback.period_end) < new Date();
}

function FeedbackCardBody({ feedback, colaborador }) {
  const atrasado = isAtrasado(feedback);
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <InitialsAvatar name={colaborador?.fullName} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {colaborador?.fullName || "—"}
          </div>
          <div style={{ fontSize: 10, color: atrasado ? "var(--danger)" : "var(--text-dim)", fontWeight: atrasado ? 700 : 400 }}>
            {tipoLabel(feedback.tipo)} · até {fmt(feedback.period_end)}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
        {autoavaliacaoLabel(feedback, colaborador)}
      </div>
      {atrasado && (
        <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "var(--danger)" }}>
          <AlertCircle size={10} /> Atrasado
        </div>
      )}
      {feedback.final_rating != null && (
        <div style={{ marginTop: 6, fontWeight: 800, fontSize: 14, color: ratingColor(feedback.final_rating) }}>
          {Number(feedback.final_rating).toFixed(1)}<span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 400 }}> /10</span>
        </div>
      )}
    </>
  );
}

function FeedbackKanbanColumn({
  stage, stages, feedbackList, colaboradoresById,
  onCardClick, onDragStart, onDragEnd, onMoveToStage, onDeleteFeedback,
  isDragOver, onColumnDragOver, onColumnDragLeave, onColumnDrop,
  canWrite, onEditFields, getCompleteness,
}) {
  return (
    <div
      onDragOver={(e) => onColumnDragOver(e, stage.stageKey)}
      onDragLeave={onColumnDragLeave}
      onDrop={() => onColumnDrop(stage.stageKey)}
      className="flex flex-col rounded-xl border transition-all duration-150 overflow-hidden"
      style={{
        width: 272, minWidth: 272,
        background: "var(--surface-alt)",
        borderColor: isDragOver ? stage.color + "70" : "var(--border)",
        boxShadow: isDragOver ? `0 0 0 2px ${stage.color}30` : "var(--shadow-card)",
        maxHeight: "calc(100vh - 260px)",
      }}
    >
      <div style={{ height: 8, background: stage.color, flexShrink: 0 }} />
      <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="min-w-0 flex-1">
          <div className="font-semibold flex items-center gap-1.5" style={{ color: "var(--text)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            <span title={stage.name} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "0 1 auto" }}>{stage.name}</span>
            <span style={{ color: "var(--text-dim)", fontWeight: 500, flexShrink: 0 }}>({feedbackList.length})</span>
          </div>
        </div>
        {canWrite && (
          <button
            onClick={() => onEditFields(stage)}
            title="Editar campos desta etapa"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "flex", flexShrink: 0 }}
          >
            <Settings2 size={13} />
          </button>
        )}
      </div>
      <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {feedbackList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-dim)", fontSize: 11, opacity: 0.5 }}>Nada aqui</div>
        ) : (
          feedbackList.map((f) => (
            <RHKanbanCard
              key={f.id}
              id={f.id}
              stage={f.status}
              stages={stages}
              onClick={() => onCardClick(f)}
              onDragStart={canWrite ? onDragStart : undefined}
              onDragEnd={canWrite ? onDragEnd : undefined}
              onMoveToStage={canWrite ? onMoveToStage : undefined}
              onDeleteCard={canWrite ? onDeleteFeedback : undefined}
              agingDays={daysInStage(f.status_changed_at)}
              completeness={getCompleteness?.(f)}
            >
              <FeedbackCardBody feedback={f} colaborador={colaboradoresById.get(f.user_id)} />
            </RHKanbanCard>
          ))
        )}
      </div>
    </div>
  );
}

// ── Drawer de detalhe do card ──────────────────────────────────────────────────

function FeedbackDrawer({
  feedback, colaborador, canWrite, stages, users, currentUser,
  onStageChange, moveError, onComplete, onUpdateCustomFields, onUpdateEvaluators, onAddActivity, onShowHistorico, onClose, notifyMentions, onDelete, onEditFields,
}) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const stageFieldsHook = useRHStageFields("feedback");
  const customDefs = stageFieldsHook.getFields(feedback.status);
  const [customDraft, setCustomDraft] = useState({});
  const customDebounceRef = useRef(null);
  // Ref espelha o rascunho ACUMULADO — o timer precisa mesclar todos os campos
  // tocados, não só o último (senão editar A e B em <600ms grava só B). Flush
  // no cleanup pra não perder a edição ao fechar em <600ms. Achado da auditoria.
  const customDraftRef = useRef({});

  useEffect(() => {
    setCustomDraft({});
    customDraftRef.current = {};
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    return () => {
      if (customDebounceRef.current) { clearTimeout(customDebounceRef.current); customDebounceRef.current = null; }
      if (Object.keys(customDraftRef.current).length > 0) {
        onUpdateCustomFields({ ...(feedback.custom_fields || {}), ...customDraftRef.current });
      }
    };
  }, [feedback.id]);

  const handleCustomChange = (fieldKey, value) => {
    const next = { ...customDraftRef.current, [fieldKey]: value };
    customDraftRef.current = next;
    setCustomDraft(next);
    if (customDebounceRef.current) clearTimeout(customDebounceRef.current);
    customDebounceRef.current = setTimeout(() => {
      const merged = { ...(feedback.custom_fields || {}), ...customDraftRef.current };
      onUpdateCustomFields(merged);
      customDebounceRef.current = null;
    }, 600);
  };

  const getCustomValue = (fieldKey) =>
    fieldKey in customDraft ? customDraft[fieldKey] : (feedback.custom_fields?.[fieldKey] ?? "");

  const customValuesByKey = { ...(feedback.custom_fields || {}), ...customDraft };
  const visibleCustomDefs = resolveVisibleFields(customDefs, customValuesByKey);

  const st = findStage(stages, feedback.status);
  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const moveTargets = stages.filter((s) => s.stageKey !== feedback.status && !s.terminal);

  const eligibleEvaluators = useMemo(() => (users || []).filter(isEvaluatorEligible), [users]);
  const evaluatorIds = feedback.evaluator_ids?.length ? feedback.evaluator_ids : (feedback.evaluator_id ? [feedback.evaluator_id] : []);
  const resolvedEvaluators = evaluatorIds.map(id => users.find(u => u.id === id)).filter(Boolean);

  const header = (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
      <InitialsAvatar name={colaborador?.fullName} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          onClick={() => onShowHistorico(feedback.user_id)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", textDecoration: "underline" }}>{colaborador?.fullName || "—"}</div>
          <TrendingUp size={12} color="var(--text-dim)" />
        </button>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{tipoLabel(feedback.tipo)} · {fmt(feedback.period_start)} – {fmt(feedback.period_end)}</div>
        <div style={{ marginTop: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${st.color}18`, color: st.color, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, display: "inline-block" }} /> {st.name}
          </span>
        </div>
      </div>
    </div>
  );

  const left = (
    <>
      {/* Avaliadores (FASE 5) — múltiplos responsáveis pela avaliação */}
      <div>
        <div style={labelSt}>Avaliadores</div>
        {canWrite ? (
          <AssigneeMultiSelect
            value={evaluatorIds}
            onChange={(ids) => onUpdateEvaluators(ids)}
            options={eligibleEvaluators}
            placeholder="Selecionar avaliadores…"
          />
        ) : resolvedEvaluators.length > 0 ? (
          <AvatarStack users={resolvedEvaluators} size={22} max={4} />
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Nenhum avaliador definido</div>
        )}
      </div>

      {/* Autoavaliação vs. gestor lado a lado */}
      <div>
        <div style={labelSt}>Autoavaliação × Gestor</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>Autoavaliação</div>
            {feedback.self_rating != null ? (
              <>
                <div style={{ fontWeight: 800, fontSize: 16, color: ratingColor(feedback.self_rating) }}>{Number(feedback.self_rating).toFixed(1)}/10</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{ratingScaleLabel(feedback.self_rating)}</div>
              </>
            ) : <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Ainda não preenchida</div>}
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>Gestor</div>
            {feedback.manager_rating != null ? (
              <>
                <div style={{ fontWeight: 800, fontSize: 16, color: ratingColor(feedback.manager_rating) }}>{Number(feedback.manager_rating).toFixed(1)}/10</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{ratingScaleLabel(feedback.manager_rating)}</div>
              </>
            ) : <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Ainda não preenchida</div>}
          </div>
        </div>
      </div>
    </>
  );

  const center = (
    <>
      {visibleCustomDefs.length > 0 && (
        <div>
          <div style={labelSt}>Campos desta etapa</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibleCustomDefs.map((f) => (
              <div key={f.id}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                  {f.effectiveRequired && <span style={{ color: "var(--accent)", marginRight: 4 }}>*</span>}
                  {f.label}
                </label>
                {f.helpText && <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{f.helpText}</div>}
                <RHStageFieldInput field={f} value={getCustomValue(f.fieldKey)} onChange={(val) => handleCustomChange(f.fieldKey, val)} users={users} />
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback.status === "concluido" && (feedback.conteudo?.pontos_fortes || feedback.conteudo?.pontos_desenvolvimento) && (
        <div>
          {feedback.conteudo?.pontos_fortes && <div style={{ marginBottom: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)" }}>Pontos fortes: </span><span style={{ fontSize: 12, color: "var(--text)" }}>{feedback.conteudo.pontos_fortes}</span></div>}
          {feedback.conteudo?.pontos_desenvolvimento && <div><span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)" }}>A desenvolver: </span><span style={{ fontSize: 12, color: "var(--text)" }}>{feedback.conteudo.pontos_desenvolvimento}</span></div>}
        </div>
      )}

      <div className="pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <RHDetailDrawerShell
          domain="feedback"
          recordId={feedback.id}
          activities={feedback.activities || []}
          onAddActivity={onAddActivity}
          currentUser={currentUser}
          users={users}
          stages={stages}
        />
      </div>
    </>
  );

  const right = (
    <>
      {canWrite && !st.terminal && (
        <div>
          <div style={labelSt}>Mover para</div>
          {moveError && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 11 }}>
              <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              {moveError}
            </div>
          )}
          <StageNavigator
            targets={moveTargets}
            onMove={(stageKey) => onStageChange(feedback.id, stageKey)}
            getKey={(s) => s.stageKey}
          />
          <button
            onClick={onComplete}
            style={{ marginTop: 6, width: "100%", background: "var(--accent)", color: "#FFF", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Concluir avaliação
          </button>
        </div>
      )}

      <RHDetailComments
        activities={feedback.activities || []}
        onAddActivity={onAddActivity}
        currentUser={currentUser}
        users={users}
        notifyMentions={notifyMentions}
        mentionLink={{ module: "rh_feedback", id: feedback.id }}
        mentionContextLabel={colaborador?.fullName}
      />

      {canWrite && onEditFields && (
        <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onEditFields(st); }}
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--text-dim)", textDecoration: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            <Settings2 size={12} />
            Editar campos desta etapa
          </a>
        </div>
      )}
    </>
  );

  return (
    <SplitPanelDrawer
      onClose={onClose}
      header={header}
      left={left}
      center={center}
      right={right}
      onDelete={canWrite && onDelete ? () => onDelete(feedback.id) : undefined}
      deleteLabel="Excluir ciclo de feedback"
    />
  );
}

// ── Tabela ────────────────────────────────────────────────────────────────────
// Data agendada/prevista: period_end (mesmo "até {data}" já mostrado no card
// e no drawer). Responsável: evaluator_id (gestor responsável pelo ciclo).

function FeedbackTableView({ feedbacks, stages, colaboradoresById, usersById, onRowClick }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {["Colaborador", "Tipo", "Etapa", "Prazo", "Responsável"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {feedbacks.length === 0 && (
            <tr><td colSpan={5} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>Nenhum ciclo encontrado.</td></tr>
          )}
          {feedbacks.map((f) => {
            const st = findStage(stages, f.status);
            const colaborador = colaboradoresById.get(f.user_id);
            const evaluatorIds = f.evaluator_ids?.length ? f.evaluator_ids : (f.evaluator_id ? [f.evaluator_id] : []);
            const resolvedEvaluators = evaluatorIds.map(id => usersById.get(id)).filter(Boolean);
            return (
              <tr key={f.id} onClick={() => onRowClick(f)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <InitialsAvatar name={colaborador?.fullName} size={26} />
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{colaborador?.fullName || "—"}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{tipoLabel(f.tipo)}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: st.color + "18", color: st.color, border: `1px solid ${st.color}40` }}>
                    {st.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: isAtrasado(f) ? "var(--danger)" : "var(--text-dim)", fontWeight: isAtrasado(f) ? 700 : 400 }}>{fmt(f.period_end)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>
                  {resolvedEvaluators.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <AvatarStack users={resolvedEvaluators} size={18} max={2} />
                      <span>{resolvedEvaluators[0].name}</span>
                    </div>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Calendário ───────────────────────────────────────────────────────────────
// Agrupa por period_end — mesmo campo usado na tabela e no card ("até {data}").

function FeedbackCalendarView({ feedbacks, stages, colaboradoresById, onPillClick }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map();
    for (const f of feedbacks) {
      if (!f.period_end) continue;
      const d = new Date(f.period_end.slice ? f.period_end.slice(0, 10) : f.period_end);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(f);
    }
    return map;
  }, [feedbacks]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
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
          <h2 className="font-semibold" style={{ fontSize: 16, color: "var(--text)" }}>
            {MONTHS[month]} <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>{cursor.getFullYear()}</span>
          </h2>
        </div>
        <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
          Hoje
        </button>
      </div>
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border)" }}>
        {WEEKDAYS.map(w => (
          <div key={w} className="px-2 py-2 text-[10px] font-bold uppercase text-center" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(88px, auto)" }}>
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const isToday = sameDay(d, today);
          const k = dayKey(d);
          const items = byDay.get(k) || [];
          return (
            <div key={i} className="p-1.5 border-r border-b flex flex-col gap-1"
              style={{ borderColor: "#F0F0F0", background: isToday ? "#FFFBEB" : "var(--surface)", opacity: inMonth ? 1 : 0.4 }}>
              <span className="text-xs font-semibold leading-none" style={{ color: isToday ? "var(--warning)" : inMonth ? "var(--text)" : "var(--text-dim)" }}>
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map((f) => {
                  const st = findStage(stages, f.status);
                  const colaborador = colaboradoresById.get(f.user_id);
                  return (
                    <span key={f.id} onClick={() => onPillClick(f)}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer"
                      style={{ background: st.color + "18", color: st.color }}
                      title={`${colaborador?.fullName || "—"} · ${tipoLabel(f.tipo)}`}>
                      {colaborador?.fullName || tipoLabel(f.tipo)}
                    </span>
                  );
                })}
                {items.length > 3 && (
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>+{items.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function RHFeedbackView({ currentUser, canWrite, isRHUser, notifyMentions }) {
  const {
    feedbacks, loading: loadingFeedbacks, createFeedback, createPendingCycle, completeFeedback,
    submitSelfRating, changeFeedbackStage, updateFeedbackCustomFields, updateFeedbackEvaluators, deleteFeedback, addFeedbackActivity,
  } = useRHFeedback({ userId: currentUser?.id });
  const { colaboradores, loading: loadingColaboradores } = useRHColaboradores({ userId: currentUser?.id });
  const { meuColaborador, loading: loadingMeuColaborador } = useMyColaborador(currentUser);
  const { createMovimentacao } = useRHMovimentacoes({ userId: currentUser?.id });
  const { stages, loading: loadingStages } = useRHPipelineStages("feedback");
  const feedbackStageFields = useRHStageFields("feedback");
  const { users } = useProfiles();

  const [viewMode, setViewMode]                   = useState("kanban"); // "kanban" | "table" | "calendar"
  const [novoOpen, setNovoOpen]                   = useState(false);
  const [completandoId, setCompletandoId]         = useState(null);
  const [autoavaliandoId, setAutoavaliandoId]     = useState(null);
  const [historicoColaboradorId, setHistoricoColaboradorId] = useState(null);
  const [drawerFeedbackId, setDrawerFeedbackId]   = useState(null);
  const [stageEditorOpen, setStageEditorOpen]     = useState(false);
  const [fieldEditorStage, setFieldEditorStage]   = useState(null);
  const [draggedFeedbackId, setDraggedFeedbackId] = useState(null);
  const [dragOverStageKey, setDragOverStageKey]   = useState(null);
  const [moveError, setMoveError]                 = useState(null);
  const reconciledRef = useRef(false);

  useEffect(() => {
    setMoveError(null);
  }, [drawerFeedbackId]);

  const loading = loadingFeedbacks || loadingColaboradores || loadingStages || loadingMeuColaborador;

  const colaboradoresById = useMemo(() => new Map(colaboradores.map(c => [c.id, c])), [colaboradores]);
  const usersById = useMemo(() => new Map((users || []).map(u => [u.id, u])), [users]);

  // Conclusão + desfecho estruturado (Onda 2, revisto na Onda 3): grava a
  // avaliação e dispara os efeitos do desfecho. Promoção NÃO altera mais o
  // salário direto — cria uma movimentação PENDENTE que só vale após a
  // diretoria aprovar (item 9), fechando o furo de "salário aplicado sem
  // aprovação". "Reavaliar" agenda um novo ciclo. Efeitos best-effort: a
  // conclusão nunca é revertida se um efeito colateral falhar.
  const handleCompleteFeedback = useCallback(async (avaliacaoId, data) => {
    const fb = feedbacks.find(f => f.id === avaliacaoId);
    const colaborador = fb ? colaboradoresById.get(fb.user_id) : null;
    const desfecho = data.desfecho || null;
    const desfechoMeta = {};
    if (desfecho === "promovido" && data.novoSalario != null && Number(data.novoSalario) > 0) {
      desfechoMeta.salario_anterior = colaborador?.salary ?? null;
      desfechoMeta.salario_novo = Number(data.novoSalario);
      desfechoMeta.aguardando_aprovacao = true;
    }
    if (desfecho === "reavaliar" && data.reavaliarMeses) {
      desfechoMeta.reavaliar_meses = Number(data.reavaliarMeses);
    }

    await completeFeedback(avaliacaoId, { ...data, desfecho, desfechoMeta });

    // Promoção com ajuste de salário → movimentação pendente (aprovação da
    // diretoria aplica o salário de fato).
    if (desfecho === "promovido" && desfechoMeta.salario_novo != null && colaborador) {
      try {
        const mov = await createMovimentacao({
          colaboradorId: colaborador.id,
          tipo: "promocao",
          cargoAnterior: colaborador.jobTitle ?? null,
          departmentAnterior: colaborador.department ?? null,
          salarioAnterior: desfechoMeta.salario_anterior,
          salarioNovo: desfechoMeta.salario_novo,
          avaliacaoId,
          motivo: "Promoção via avaliação de desempenho",
        });
        const directorIds = (users || []).filter(u => (u.roles?.length ? u.roles : [u.role]).includes("admin")).map(u => u.id);
        if (directorIds.length && notifyMentions) {
          notifyMentions(directorIds, {
            title: "Movimentação aguardando aprovação",
            body: `${colaborador.fullName} · Promoção`,
            link: { module: "rh_movimentacoes", id: mov?.id },
          }).catch(() => {});
        }
      } catch (e) { console.error("Falha ao criar movimentação de promoção:", e); }
    }
    if (desfecho === "reavaliar" && desfechoMeta.reavaliar_meses && colaborador) {
      try {
        const hoje = new Date().toISOString().slice(0, 10);
        const fim = addDaysISO(hoje, desfechoMeta.reavaliar_meses * 30);
        await createPendingCycle(colaborador.id, "reavaliacao", hoje, fim);
      } catch (e) { console.error("Falha ao agendar reavaliação:", e); }
    }
  }, [feedbacks, colaboradoresById, completeFeedback, createMovimentacao, createPendingCycle, users, notifyMentions]);

  // Reconciliação automática: ao abrir a tela, gera o próximo ciclo pendente
  // (check-in de onboarding ou semestral recorrente) pra quem já está sem
  // nenhum em aberto. Roda uma vez por sessão, só pra quem pode escrever —
  // evita corrida de duplicação se vários RH abrirem a tela ao mesmo tempo.
  useEffect(() => {
    if (!canWrite || loading || reconciledRef.current) return;
    reconciledRef.current = true;
    (async () => {
      for (const colaborador of colaboradores.filter(c => c.employeeStatus === "ativo")) {
        const feedbacksDoColaborador = feedbacks.filter(f => f.user_id === colaborador.id);
        const proximo = nextPendingCycle(colaborador, feedbacksDoColaborador);
        if (!proximo) continue;
        // try/catch por colaborador — sem isso, um erro (ex: colaborador sem
        // admissionDate gerando period_start nulo, rejeitado pelo banco)
        // interrompia o for e ninguém depois dele na lista era reconciliado
        // nessa sessão, sem nenhum aviso (achado da auditoria).
        try {
          await createPendingCycle(colaborador.id, proximo.tipo, proximo.periodStart, proximo.periodEnd);
        } catch (e) {
          console.error(`Falha ao reconciliar ciclo de feedback de ${colaborador.name || colaborador.id}:`, e);
        }
      }
    })();
  }, [canWrite, loading, colaboradores, feedbacks, createPendingCycle]);


  // Enforcement real: bloqueia sair da etapa atual com campo obrigatório
  // vazio/inválido — mesmo padrão de Onboarding. Mover pra "concluido" abre
  // o modal de conclusão em vez de só trocar o status.
  const handleStageChange = useCallback((id, stage) => {
    const feedback = feedbacks.find(f => f.id === id);
    if (!feedback) return;
    const targetStage = stages.find(s => s.stageKey === stage);
    if (targetStage?.terminal) {
      setCompletandoId(id);
      return;
    }
    const fields = feedbackStageFields.getFields(feedback.status);
    const missing = getMissingRequiredFields(fields, feedback.custom_fields || {});
    if (missing.length > 0) {
      setMoveError(`Não dá pra mover: preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = getInvalidFields(fields, feedback.custom_fields || {});
    if (invalid.length > 0) {
      setMoveError(`Não dá pra mover: corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
    setMoveError(null);
    changeFeedbackStage(id, stage);
    // Se veio do drawer aberto desse feedback: fecha agora (sinal visual de
    // que moveu) e reabre já na etapa nova, em vez de só trocar o conteúdo
    // por baixo do drawer aberto.
    if (drawerFeedbackId === id) {
      setDrawerFeedbackId(null);
      reopenAfterMove(setDrawerFeedbackId, id);
    }
  }, [feedbacks, stages, feedbackStageFields, changeFeedbackStage, drawerFeedbackId]);

  const getFeedbackCompleteness = (feedback) =>
    getFieldCompleteness(feedbackStageFields.getFields(feedback.status), feedback.custom_fields || {});

  const handleCardDragStart = useCallback((id) => setDraggedFeedbackId(id), []);
  const handleCardDragEnd = useCallback(() => { setDraggedFeedbackId(null); setDragOverStageKey(null); }, []);
  const handleColumnDragOver = useCallback((e, stageKey) => { e.preventDefault(); setDragOverStageKey(stageKey); }, []);
  const handleColumnDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStageKey(null); }, []);
  const handleColumnDrop = useCallback((stageKey) => {
    if (draggedFeedbackId) {
      const feedback = feedbacks.find(f => f.id === draggedFeedbackId);
      if (feedback && feedback.status !== stageKey) handleStageChange(draggedFeedbackId, stageKey);
    }
    setDraggedFeedbackId(null);
    setDragOverStageKey(null);
  }, [draggedFeedbackId, feedbacks, handleStageChange]);

  const feedbackByStage = useMemo(() => {
    const map = {};
    const defaultStageKey = stages[0]?.stageKey || "rascunho";
    stages.forEach((s) => { map[s.stageKey] = feedbacks.filter((f) => (f.status || defaultStageKey) === s.stageKey); });
    return map;
  }, [feedbacks, stages]);

  const completandoFeedback = completandoId ? feedbacks.find(f => f.id === completandoId) : null;
  const autoavaliandoFeedback = autoavaliandoId ? feedbacks.find(f => f.id === autoavaliandoId) : null;
  const historicoColaborador = historicoColaboradorId ? colaboradoresById.get(historicoColaboradorId) : null;
  const drawerFeedback = drawerFeedbackId ? feedbacks.find(f => f.id === drawerFeedbackId) : null;

  if (!isSupabaseConfigured) {
    return <EmptyState icon={MessageSquare} title="Supabase não configurado" />;
  }

  // ── Colaborador comum (sem acesso RH): visão pessoal, sem Kanban ──────────
  if (!isRHUser) {
    const visible = feedbacks.filter(f => f.user_id === meuColaborador?.id || f.evaluator_id === currentUser?.id);
    const pendentes  = visible.filter(f => f.status !== "concluido");
    const concluidos = visible.filter(f => f.status === "concluido");
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={22} style={{ color: "var(--text)" }} />
          <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Avaliação de Desempenho</h1>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
        ) : (
          <>
            {pendentes.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Pendentes ({pendentes.length})</div>
                <div className="flex flex-col gap-2">
                  {pendentes.map(f => {
                    const isMine = meuColaborador?.id === f.user_id;
                    return (
                      <div key={f.id} style={{ border: "1px solid #FDE68A", background: "var(--warning-bg)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", background: "#DBEAFE", borderRadius: 99, padding: "2px 9px" }}>{tipoLabel(f.tipo)}</span>
                          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>Prazo {fmt(f.period_end)} · {autoavaliacaoLabel(f, meuColaborador)}</div>
                        </div>
                        {isMine && f.self_rating == null && (
                          <button onClick={() => setAutoavaliandoId(f.id)} style={{ background: "var(--surface)", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                            Preencher autoavaliação
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Histórico ({concluidos.length})</div>
            {concluidos.length === 0 ? (
              <EmptyState icon={MessageSquare} title="Nenhum feedback concluído ainda" />
            ) : (
              <div className="flex flex-col gap-3">
                {concluidos.map(f => (
                  <div key={f.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", background: "#DBEAFE", borderRadius: 99, padding: "2px 9px" }}>{tipoLabel(f.tipo)}</span>
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{fmt(f.period_end)}</span>
                    </div>
                    {(f.self_rating != null || f.manager_rating != null) && (
                      <div style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: 11, color: "var(--text-dim)" }}>
                        {f.self_rating != null && <span>Autoavaliação: <b style={{ color: "var(--text)" }}>{Number(f.self_rating).toFixed(1)}</b></span>}
                        {f.manager_rating != null && <span>Gestor: <b style={{ color: "var(--text)" }}>{Number(f.manager_rating).toFixed(1)}</b></span>}
                      </div>
                    )}
                    {typeof f.final_rating === "number" && (
                      <div style={{ fontWeight: 800, fontSize: 18, color: ratingColor(f.final_rating), marginBottom: 6 }}>
                        {f.final_rating.toFixed(1)}<span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 400 }}> /10 final</span>
                      </div>
                    )}
                    {f.conteudo?.pontos_fortes && <div style={{ marginBottom: 4 }}><span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)" }}>Pontos fortes: </span><span style={{ fontSize: 12, color: "var(--text)" }}>{f.conteudo.pontos_fortes}</span></div>}
                    {f.conteudo?.pontos_desenvolvimento && <div><span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)" }}>A desenvolver: </span><span style={{ fontSize: 12, color: "var(--text)" }}>{f.conteudo.pontos_desenvolvimento}</span></div>}
                    {f.notes && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6, fontStyle: "italic" }}>{f.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {autoavaliandoFeedback && <AutoavaliacaoModal feedback={autoavaliandoFeedback} onSubmit={submitSelfRating} onClose={() => setAutoavaliandoId(null)} />}
      </div>
    );
  }

  // ── RH: Kanban completo ────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare size={22} style={{ color: "var(--text)" }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Avaliação de Desempenho</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Ciclos de avaliação e histórico</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
            <ViewToggleButton active={viewMode === "kanban"}   onClick={() => setViewMode("kanban")}   icon={LayoutGrid}   label="Kanban" />
            <ViewToggleButton active={viewMode === "table"}    onClick={() => setViewMode("table")}    icon={List}         label="Tabela" />
            <ViewToggleButton active={viewMode === "calendar"} onClick={() => setViewMode("calendar")} icon={CalendarIcon} label="Calendário" />
          </div>
          {canWrite && (
            <>
              <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setStageEditorOpen(true)}>Editar etapas</Button>
              <Button size="sm" icon={Plus} onClick={() => setNovoOpen(true)}>Novo feedback</Button>
            </>
          )}
        </div>
      </div>

      <AvaliacaoStats feedbacks={feedbacks} />

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : feedbacks.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Nenhum ciclo de avaliação ainda" />
      ) : viewMode === "table" ? (
        <FeedbackTableView
          feedbacks={feedbacks}
          stages={stages}
          colaboradoresById={colaboradoresById}
          usersById={usersById}
          onRowClick={(f) => setDrawerFeedbackId(f.id)}
        />
      ) : viewMode === "calendar" ? (
        <FeedbackCalendarView
          feedbacks={feedbacks}
          stages={stages}
          colaboradoresById={colaboradoresById}
          onPillClick={(f) => setDrawerFeedbackId(f.id)}
        />
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16, flex: 1 }} className="flex-col md:flex-row">
          <div style={{ gap: 12, flexShrink: 0 }} className="hidden md:flex">
            {stages.map((stage) => (
              <FeedbackKanbanColumn
                key={stage.id}
                stage={stage}
                stages={stages}
                feedbackList={feedbackByStage[stage.stageKey] || []}
                colaboradoresById={colaboradoresById}
                onCardClick={(f) => setDrawerFeedbackId(f.id)}
                onDragStart={handleCardDragStart}
                onDragEnd={handleCardDragEnd}
                onMoveToStage={handleStageChange}
                onDeleteFeedback={canWrite ? deleteFeedback : undefined}
                isDragOver={dragOverStageKey === stage.stageKey}
                onColumnDragOver={handleColumnDragOver}
                onColumnDragLeave={handleColumnDragLeave}
                onColumnDrop={handleColumnDrop}
                canWrite={canWrite}
                onEditFields={setFieldEditorStage}
                getCompleteness={getFeedbackCompleteness}
              />
            ))}
          </div>
          <div className="md:hidden flex flex-col gap-3">
            {stages.map((stage) => (
              <FeedbackKanbanColumn
                key={stage.id}
                stage={stage}
                stages={stages}
                feedbackList={feedbackByStage[stage.stageKey] || []}
                colaboradoresById={colaboradoresById}
                onCardClick={(f) => setDrawerFeedbackId(f.id)}
                onDragStart={handleCardDragStart}
                onDragEnd={handleCardDragEnd}
                onMoveToStage={handleStageChange}
                onDeleteFeedback={canWrite ? deleteFeedback : undefined}
                isDragOver={dragOverStageKey === stage.stageKey}
                onColumnDragOver={handleColumnDragOver}
                onColumnDragLeave={handleColumnDragLeave}
                onColumnDrop={handleColumnDrop}
                canWrite={canWrite}
                onEditFields={setFieldEditorStage}
                getCompleteness={getFeedbackCompleteness}
              />
            ))}
          </div>
        </div>
      )}

      {drawerFeedback && (
        <FeedbackDrawer
          feedback={drawerFeedback}
          colaborador={colaboradoresById.get(drawerFeedback.user_id)}
          canWrite={canWrite}
          stages={stages}
          users={users}
          currentUser={currentUser}
          onStageChange={handleStageChange}
          moveError={moveError}
          onComplete={() => { setCompletandoId(drawerFeedback.id); setDrawerFeedbackId(null); }}
          onUpdateCustomFields={(merged) => updateFeedbackCustomFields(drawerFeedback.id, merged)}
          onUpdateEvaluators={(ids) => updateFeedbackEvaluators(drawerFeedback.id, ids)}
          onAddActivity={(entry) => addFeedbackActivity(drawerFeedback.id, entry)}
          onShowHistorico={(colaboradorId) => { setHistoricoColaboradorId(colaboradorId); setDrawerFeedbackId(null); }}
          onClose={() => setDrawerFeedbackId(null)}
          notifyMentions={notifyMentions}
          onDelete={deleteFeedback}
          onEditFields={setFieldEditorStage}
        />
      )}

      {novoOpen && <NovoFeedbackModal colaboradores={colaboradores} onSave={createFeedback} onClose={() => setNovoOpen(false)} />}
      {canWrite && completandoFeedback && (
        <CompletarFeedbackModal
          feedback={completandoFeedback}
          colaborador={colaboradoresById.get(completandoFeedback.user_id)}
          onComplete={handleCompleteFeedback}
          onClose={() => setCompletandoId(null)}
        />
      )}
      {historicoColaborador && (
        <HistoricoDrawer
          colaborador={historicoColaborador}
          feedbacksDoColaborador={feedbacks.filter(f => f.user_id === historicoColaboradorId)}
          onClose={() => setHistoricoColaboradorId(null)}
        />
      )}

      {canWrite && (
        <RHStageEditorModal
          open={stageEditorOpen}
          onClose={() => setStageEditorOpen(false)}
          domain="feedback"
          domainLabel="Avaliação de Desempenho"
          records={feedbacks}
          stageField="status"
        />
      )}

      {canWrite && (
        <RHStageFieldEditorModal
          open={!!fieldEditorStage}
          onClose={() => setFieldEditorStage(null)}
          domain="feedback"
          stageKey={fieldEditorStage?.stageKey}
          stageName={fieldEditorStage?.name}
        />
      )}
    </div>
  );
}

export default RHFeedbackView;
