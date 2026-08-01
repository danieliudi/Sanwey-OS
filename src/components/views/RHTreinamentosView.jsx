import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  GraduationCap, Plus, X, Check, ExternalLink, ChevronDown, ChevronRight, Users, AlertTriangle, RefreshCw,
  LayoutGrid, Settings2, AlertCircle, List, CalendarDays as CalendarIcon, ChevronLeft, TrendingUp,
} from "lucide-react";
import { RH_DEPARTMENTS } from "../../constants/rh-config";
import { RH_FRENTES, RH_FRENTE_LABELS, RH_FRENTE_COLORS } from "../../constants/rh-frentes";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHTreinamentos } from "../../hooks/use-rh-treinamentos";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useMyColaborador } from "../../hooks/use-my-colaborador";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { RHStageFieldsPanel } from "../shared/stage-editor/RHStageFieldsPanel";
import { StageColorPicker } from "../shared/stage-editor/StageColorPicker";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { RHKanbanCard } from "../rh-pipeline/RHKanbanCard";
import { RHMobileKanbanAccordion } from "../rh-pipeline/RHMobileKanbanAccordion";
import { RHDetailDrawerShell, RHDetailComments } from "../rh-pipeline/RHDetailDrawerShell";
import { StageNavigator } from "../shared/StageNavigator";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { useRecordViews } from "../../hooks/use-record-views";
import { hasUnreadRHComment } from "../../lib/comment-badge";
import { resolveVisibleFields, getMissingRequiredFields, getFieldCompleteness } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { KanbanColumnSortMenu } from "../shared/KanbanColumnSortMenu";
import { useKanbanColumnSort } from "../../hooks/use-kanban-sort";
import { sortKanbanItems } from "../../utils/kanban-sort";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { KanbanAnalyticsPanel } from "../shared/KanbanAnalyticsPanel";

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function daysInStage(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function findStage(stages, stageKey) {
  return stages.find((s) => s.stageKey === stageKey) || stages[0] || { name: "—", color: "#8A8680", stageKey };
}

// ── Kanban/Tabela/Calendário — mesmo padrão de ComprasMarketingView/RHFeriasView ──

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

// ── Validade / revalidação ────────────────────────────────────────────────────
// "Vencido" agora é um stage_key gravado de verdade (reconciliado ao abrir a
// tela, ver use-rh-treinamentos.js), mas a data de vencimento em si continua
// calculada aqui só pra exibição.

function vencimentoDate(atribuicao, treinamento) {
  if (!treinamento?.validade_dias || !atribuicao?.data_conclusao) return null;
  const d = new Date(atribuicao.data_conclusao);
  d.setDate(d.getDate() + Number(treinamento.validade_dias));
  return d;
}

function atribuicaoStatusInfo(atribuicao, treinamento) {
  if (atribuicao.status === "vencido") {
    return { label: `Vencido em ${fmt(vencimentoDate(atribuicao, treinamento))}`, color: "var(--danger)", bg: "#FEE2E2" };
  }
  if (atribuicao.status === "concluido") {
    const venc = vencimentoDate(atribuicao, treinamento);
    return { label: venc ? `Concluído em ${fmt(atribuicao.data_conclusao)} · vence ${fmt(venc)}` : `Concluído em ${fmt(atribuicao.data_conclusao)}`, color: "var(--success)", bg: "#DCFCE7" };
  }
  return { label: "Pendente", color: "var(--warning)", bg: "#FEF3C7" };
}

// ── Modal: novo/editar treinamento ────────────────────────────────────────────

function NovoTreinamentoModal({ initialData, onSave, onClose }) {
  const [titulo, setTitulo]           = useState(initialData?.titulo || "");
  const [descricao, setDescricao]     = useState(initialData?.descricao || "");
  const [tipo, setTipo]               = useState(initialData?.tipo || "opcional");
  const [frente, setFrente]           = useState(initialData?.frente || "");
  const [link, setLink]               = useState(initialData?.link_conteudo || "");
  const [cargoAlvo, setCargoAlvo]     = useState(initialData?.cargo_alvo || "");
  const [departamentoAlvo, setDepartamentoAlvo] = useState(initialData?.departamento_alvo || "");
  const [validadeDias, setValidadeDias] = useState(initialData?.validade_dias ?? "");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titulo.trim()) { setError("Título obrigatório."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        tipo,
        frente: frente || null,
        link_conteudo: link.trim() || null,
        cargo_alvo: cargoAlvo.trim() || null,
        departamento_alvo: departamentoAlvo || null,
        validade_dias: validadeDias !== "" ? Number(validadeDias) : null,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao salvar treinamento.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{initialData ? "Editar treinamento" : "Novo treinamento"}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelSt}>Título *</label>
              <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: NR-35 — Trabalho em altura" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} autoFocus />
            </div>
            <div>
              <label style={labelSt}>Descrição</label>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className="w-full text-sm rounded-xl border px-3 py-2 outline-none resize-none" style={inputSt} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  <option value="opcional">Opcional</option>
                  <option value="obrigatorio">Obrigatório</option>
                </select>
              </div>
              <div>
                <label style={labelSt}>Validade (dias)</label>
                <input type="number" min="0" value={validadeDias} onChange={(e) => setValidadeDias(e.target.value)} placeholder="Ex: 365" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
              </div>
            </div>
            <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: -6 }}>Deixe a validade em branco se o treinamento não expira. Ex: NR anual = 365.</p>

            <div>
              <label style={labelSt}>Frente aplicável</label>
              <select value={frente} onChange={(e) => setFrente(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                <option value="">Todas as frentes</option>
                {RH_FRENTES.map((id) => <option key={id} value={id}>{RH_FRENTE_LABELS[id]}</option>)}
              </select>
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>Atribuição automática (opcional)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelSt}>Cargo alvo</label>
                <input type="text" value={cargoAlvo} onChange={(e) => setCargoAlvo(e.target.value)} placeholder="Ex: Operador de produção" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Departamento alvo</label>
                <select value={departamentoAlvo} onChange={(e) => setDepartamentoAlvo(e.target.value)} className="w-full text-sm rounded-xl border outline-none px-3 py-2" style={inputSt}>
                  <option value="">Nenhum</option>
                  {RH_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: -6 }}>
              Se obrigatório e o cargo ou departamento bater, o treinamento é atribuído sozinho quando o colaborador entra em "Integração" no onboarding.
            </p>

            <div>
              <label style={labelSt}>Link do conteúdo</label>
              <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/…" className="w-full text-sm rounded-xl border px-3 py-2 outline-none" style={inputSt} />
            </div>
          </div>

          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Salvando…" : initialData ? "Salvar alterações" : "Criar treinamento"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: atribuir a colaboradores ──────────────────────────────────────────

function AtribuirModal({ treinamento, colaboradores, onAssign, onClose }) {
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  // Filtro por Frente + "marcar todos visíveis" — mesmo padrão do
  // BulkTarefaModal (Onboarding), que já resolve isso pra empresa com
  // várias frentes e dezenas de colaboradores. Achado da auditoria de
  // fricção de 18/07: aqui a lista era única, sem filtro nem busca.
  const [frenteFiltro, setFrenteFiltro] = useState("todas");

  const visiveis = useMemo(
    () => colaboradores.filter(c => frenteFiltro === "todas" || c.frente === frenteFiltro),
    [colaboradores, frenteFiltro]
  );

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const selVisiveis = visiveis.filter(c => selected.has(c.id)).length;
  const allVisiveisSel = visiveis.length > 0 && selVisiveis === visiveis.length;
  const toggleAllVisiveis = () => setSelected(prev => {
    const next = new Set(prev);
    if (allVisiveisSel) visiveis.forEach(c => next.delete(c.id));
    else visiveis.forEach(c => next.add(c.id));
    return next;
  });

  const temAlvo = Boolean(treinamento.cargo_alvo || treinamento.departamento_alvo || treinamento.frente);
  const selectByAlvo = () => {
    const cargoAlvo = (treinamento.cargo_alvo || "").toLowerCase().trim();
    const deptoAlvo = treinamento.departamento_alvo || "";
    const frenteAlvo = treinamento.frente || "";
    const matches = colaboradores.filter(c =>
      (cargoAlvo && (c.jobTitle || "").toLowerCase().trim() === cargoAlvo) ||
      (deptoAlvo && c.department === deptoAlvo) ||
      (frenteAlvo && c.frente === frenteAlvo)
    );
    setSelected(new Set(matches.map(c => c.id)));
  };

  const handleSubmit = async () => {
    if (selected.size === 0) { setError("Selecione ao menos um colaborador."); return; }
    setSaving(true);
    setError(null);
    try {
      await onAssign(treinamento.id, Array.from(selected));
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao atribuir.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "var(--shadow-pop)", maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Atribuir treinamento</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{treinamento.titulo}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>
        {temAlvo && (
          <div style={{ padding: "10px 24px 0" }}>
            <button onClick={selectByAlvo} style={{ fontSize: 11, color: "var(--accent)", background: "var(--accent-tint)", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
              Selecionar todos do cargo/departamento/frente alvo
            </button>
          </div>
        )}
        <div style={{ padding: "10px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <select
            value={frenteFiltro}
            onChange={(e) => setFrenteFiltro(e.target.value)}
            style={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface-alt)", color: "var(--text)", padding: "4px 8px" }}
          >
            <option value="todas">Todas as frentes</option>
            {RH_FRENTES.map((id) => <option key={id} value={id}>{RH_FRENTE_LABELS[id]}</option>)}
          </select>
          {visiveis.length > 0 && (
            <button type="button" onClick={toggleAllVisiveis} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              {allVisiveisSel ? "Desmarcar todos" : "Marcar todos visíveis"}
            </button>
          )}
        </div>
        <div style={{ padding: "12px 24px", overflowY: "auto", flex: 1 }}>
          {visiveis.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Nenhum colaborador nesta frente.</div>
          ) : visiveis.map(c => (
            <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <span style={{ fontSize: 13, color: "var(--text)" }}>{c.fullName}</span>
              {c.jobTitle && <span style={{ fontSize: 11, color: "var(--text-dim)" }}>· {c.jobTitle}</span>}
            </label>
          ))}
        </div>
        {error && <div style={{ margin: "0 24px 12px", background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
        <div style={{ padding: "12px 24px 20px", display: "flex", gap: 8 }}>
          <button onClick={handleSubmit} disabled={saving} style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Atribuindo…" : `Atribuir a ${selected.size}`}
          </button>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Painel de conformidade ────────────────────────────────────────────────────

function computeCompliance(atribuicoes, treinamentosById) {
  let ok = 0, vencidos = 0, pendentes = 0, autodeclarados = 0;
  atribuicoes.forEach((a) => {
    if (a.status === "vencido") vencidos++;
    else if (a.status === "concluido") {
      // Treinamento obrigatório concluído sem comprovante anexado é
      // autodeclaração — não vale como conforme perante auditoria, então
      // fica fora do "ok" que puxa a Conformidade %.
      const obrigatorio = treinamentosById?.get(a.treinamento_id)?.tipo === "obrigatorio";
      if (obrigatorio && !a.certificado_url) autodeclarados++;
      else ok++;
    }
    else pendentes++;
  });
  const total = atribuicoes.length;
  return { total, ok, vencidos, pendentes, autodeclarados, pct: total > 0 ? Math.round((ok / total) * 100) : 100 };
}

function parseAuditDate(str) {
  if (!str) return null;
  const [y, m, d] = String(str).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d); // meia-noite local
}

function vencDateOnly(atribuicao, treinamento) {
  const v = vencimentoDate(atribuicao, treinamento);
  return v ? new Date(v.getFullYear(), v.getMonth(), v.getDate()) : null;
}

// Projeção pré-auditoria (Onda 2, Áudio 4): dada uma data de auditoria, o que
// estará em não-conformidade quando o auditor chegar? Cruza o estado atual com
// os vencimentos que caem até lá, e ainda cobra o comprovante (concluído sem
// certificado = pendência documental). Cada atribuição conta uma vez no total,
// mas pode aparecer em mais de um motivo.
function computePreAuditoria(atribuicoes, treinamentosById, auditDate) {
  const buckets = { vencidos: [], pendentes: [], venceAteData: [], semCertificado: [] };
  const pendenciaIds = new Set();
  for (const a of atribuicoes) {
    if (a.status === "vencido") {
      buckets.vencidos.push(a); pendenciaIds.add(a.id); continue;
    }
    if (a.status === "concluido") {
      const venc = vencDateOnly(a, treinamentosById.get(a.treinamento_id));
      if (venc && venc.getTime() <= auditDate.getTime()) { buckets.venceAteData.push(a); pendenciaIds.add(a.id); }
      if (!a.certificado_url) { buckets.semCertificado.push(a); pendenciaIds.add(a.id); }
      continue;
    }
    // pendente / qualquer status não-terminal ainda por fazer
    buckets.pendentes.push(a); pendenciaIds.add(a.id);
  }
  const total = atribuicoes.length;
  const prontos = total - pendenciaIds.size;
  return {
    ...buckets,
    totalPendencias: pendenciaIds.size,
    prontos,
    pct: total > 0 ? Math.round((prontos / total) * 100) : 100,
  };
}

// R26: relatório de compliance cruzando TODOS os treinamentos, com filtro
// por treinamento e por frente — antes só existia % por board individual,
// sem nenhum jeito de ver a conformidade agregada por frente.
function ComplianceStats({ atribuicoes, treinamentos, colaboradoresById }) {
  const [treinamentoFiltro, setTreinamentoFiltro] = useState("todos");
  const [frenteFiltro, setFrenteFiltro] = useState("todas");
  const [auditDateStr, setAuditDateStr] = useState("");

  const treinamentosById = useMemo(() => new Map(treinamentos.map((t) => [t.id, t])), [treinamentos]);

  const filtradas = useMemo(() => {
    return atribuicoes.filter((a) => {
      if (treinamentoFiltro !== "todos" && a.treinamento_id !== treinamentoFiltro) return false;
      if (frenteFiltro !== "todas" && colaboradoresById.get(a.colaborador_id)?.frente !== frenteFiltro) return false;
      return true;
    });
  }, [atribuicoes, treinamentoFiltro, frenteFiltro, colaboradoresById]);

  const stats = useMemo(() => computeCompliance(filtradas, treinamentosById), [filtradas, treinamentosById]);

  const auditDate = useMemo(() => parseAuditDate(auditDateStr), [auditDateStr]);
  const preAudit = useMemo(
    () => (auditDate ? computePreAuditoria(filtradas, treinamentosById, auditDate) : null),
    [auditDate, filtradas, treinamentosById]
  );

  const porFrente = useMemo(() => {
    return RH_FRENTES.map((id) => {
      const grupo = atribuicoes.filter((a) => {
        if (treinamentoFiltro !== "todos" && a.treinamento_id !== treinamentoFiltro) return false;
        return colaboradoresById.get(a.colaborador_id)?.frente === id;
      });
      return { id, ...computeCompliance(grupo, treinamentosById) };
    }).filter((f) => f.total > 0);
  }, [atribuicoes, treinamentoFiltro, colaboradoresById, treinamentosById]);

  if (atribuicoes.length === 0) return null;

  const tiles = [
    { label: "Conformidade", value: `${stats.pct}%`, color: stats.pct >= 80 ? "var(--success)" : stats.pct >= 50 ? "var(--warning)" : "var(--danger)" },
    {
      label: "Concluídos", value: stats.ok, color: "var(--text)",
      sub: stats.autodeclarados > 0
        ? `+${stats.autodeclarados} autodeclarado${stats.autodeclarados !== 1 ? "s" : ""} (obrigatório sem certificado, fora do %)`
        : null,
    },
    { label: "Pendentes",    value: stats.pendentes,  color: "var(--text)" },
    { label: "Vencidos",     value: stats.vencidos,   color: stats.vencidos > 0 ? "var(--danger)" : "var(--text)" },
  ];

  const selectSt = { borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <select value={treinamentoFiltro} onChange={(e) => setTreinamentoFiltro(e.target.value)} className="text-xs rounded-xl border px-3 py-1.5 outline-none" style={selectSt}>
          <option value="todos">Todos os treinamentos</option>
          {treinamentos.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
        </select>
        <select value={frenteFiltro} onChange={(e) => setFrenteFiltro(e.target.value)} className="text-xs rounded-xl border px-3 py-1.5 outline-none" style={selectSt}>
          <option value="todas">Todas as frentes</option>
          {RH_FRENTES.map((id) => <option key={id} value={id}>{RH_FRENTE_LABELS[id]}</option>)}
        </select>
        <div className="flex items-center gap-1.5 ml-auto">
          <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}>Auditoria em</span>
          <input
            type="date"
            value={auditDateStr}
            onChange={(e) => setAuditDateStr(e.target.value)}
            className="text-xs rounded-xl border px-3 py-1.5 outline-none"
            style={selectSt}
            title="Projeta as pendências que existirão até esta data"
          />
          {auditDateStr && (
            <button onClick={() => setAuditDateStr("")} title="Limpar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 2 }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {preAudit && (
        <div className="mb-3 rounded-xl border" style={{ borderColor: preAudit.totalPendencias > 0 ? "#FCA5A5" : "#86EFAC", background: preAudit.totalPendencias > 0 ? "#FEF2F2" : "#F0FDF4", padding: "12px 16px" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <AlertTriangle size={16} style={{ color: preAudit.totalPendencias > 0 ? "var(--danger)" : "var(--success)", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: preAudit.totalPendencias > 0 ? "var(--danger)" : "var(--success)" }}>
              {preAudit.totalPendencias === 0
                ? `Tudo em conformidade para a auditoria de ${fmt(auditDate)}`
                : `${preAudit.totalPendencias} pendência${preAudit.totalPendencias !== 1 ? "s" : ""} até a auditoria de ${fmt(auditDate)}`}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", marginLeft: "auto" }}>{preAudit.pct}% pronto</span>
          </div>
          {preAudit.totalPendencias > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {[
                { n: preAudit.vencidos.length, label: "vencido", labelP: "vencidos" },
                { n: preAudit.pendentes.length, label: "nunca feito", labelP: "nunca feitos" },
                { n: preAudit.venceAteData.length, label: "vence até a data", labelP: "vencem até a data" },
                { n: preAudit.semCertificado.length, label: "sem certificado", labelP: "sem certificado" },
              ].filter((b) => b.n > 0).map((b) => (
                <span key={b.label} style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", background: "var(--danger-bg)", borderRadius: 99, padding: "2px 10px" }}>
                  {b.n} {b.n !== 1 ? b.labelP : b.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {tiles.map((t) => (
          <div key={t.label} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", background: "var(--surface)" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.color, lineHeight: 1 }}>{t.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{t.label}</div>
            {t.sub && <div style={{ fontSize: 10, fontWeight: 600, color: "var(--amber)", marginTop: 2 }}>{t.sub}</div>}
          </div>
        ))}
      </div>
      {frenteFiltro === "todas" && porFrente.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {porFrente.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 99, padding: "3px 10px", background: "var(--surface)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: RH_FRENTE_COLORS[f.id], display: "inline-block" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>{RH_FRENTE_LABELS[f.id]}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: f.pct >= 80 ? "var(--success)" : f.pct >= 50 ? "var(--warning)" : "var(--danger)" }}>{f.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Nova etapa (local ao arquivo — mesmo molde de RHOnboardingView.jsx/
// RHFeriasView.jsx: "Editar etapas" saiu do header, criar etapa agora é
// isso aqui, e renomear/recolorir/excluir uma já existente vive dentro de
// "Editar campos desta etapa") ─────────────────────────────────────────────

const NEW_STAGE_DEFAULTS_COLOR = "#64748B";

function slugifyStageKeyLocal(label) {
  return (label || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || `etapa_${Date.now().toString(36)}`;
}

// domain="treinamentos" é compartilhado por TODOS os treinamentos da
// plataforma (ver comentário em nonDeletableStageKeys/protectedStageKeys
// mais abaixo) — criar uma etapa aqui a adiciona ao board de qualquer outro
// treinamento também, não só o que está aberto. Aviso explícito (Daniel,
// rollout de Treinamentos) pra não confundir com uma etapa "só deste board".
function NewStageModal({ existingKeys, nextOrderIdx, onAdd, onClose }) {
  const [name, setName]   = useState("");
  const [color, setColor] = useState(NEW_STAGE_DEFAULTS_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let key = slugifyStageKeyLocal(name);
      let suffix = 1;
      while (existingKeys.includes(key)) key = `${slugifyStageKeyLocal(name)}_${suffix++}`;
      await onAdd({ stageKey: key, name: name.trim(), color, orderIdx: nextOrderIdx, terminal: false, won: false, lost: false });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar etapa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 380, boxShadow: "var(--shadow-pop)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova etapa</div>
          <button type="button" onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 6, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" }}>
            Nome da etapa
          </label>
          <div className="flex items-center gap-2.5" style={{ marginBottom: 14 }}>
            <StageColorPicker value={color} onChange={setColor} size={38} />
            <input autoFocus type="text" placeholder="Ex.: Em análise"
              value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "#D1D5DB", color: "var(--text)", background: "var(--surface)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "var(--warning-bg)", borderRadius: 10, padding: "8px 12px", marginBottom: 18 }}>
            <AlertTriangle size={13} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 11, color: "var(--warning)", lineHeight: 1.4 }}>
              Esta etapa será adicionada a <b>todos</b> os treinamentos da plataforma, não só a este.
            </span>
          </div>
          {error && (
            <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>{error}</div>
          )}
          <button type="submit" disabled={saving || !name.trim()}
            className="w-full font-semibold py-2.5 rounded-xl text-sm"
            style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: (saving || !name.trim()) ? 0.5 : 1, border: "none", cursor: (saving || !name.trim()) ? "default" : "pointer" }}>
            {saving ? "Criando…" : "Criar etapa"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Board por treinamento (Kanban) ───────────────────────────────────────────
// Um board GLOBAL (todos os treinamentos × todas as pessoas) viraria uma
// bagunça de centenas de cards sem relação entre si — por isso o board é
// escolhido por treinamento (abre a partir do catálogo), não um board único.

function AtribuicaoCardBody({ atribuicao, colaborador }) {
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{colaborador?.fullName || "—"}</div>
      {colaborador?.jobTitle && <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{colaborador.jobTitle}</div>}
      {atribuicao.data_conclusao && (
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>Concluído em {fmt(atribuicao.data_conclusao)}</div>
      )}
    </>
  );
}

function TreinamentoBoardColumn({
  stage, stages, atribList, colaboradoresById,
  onCardClick, onDragStart, onDragEnd, onMoveToStage, onDeleteAtribuicao,
  isDragOver, onColumnDragOver, onColumnDragLeave, onColumnDrop,
  canWrite, onEditFields, getCompleteness, getUnread, boardHeight,
  draggedColumnKey, onColumnHeaderDragStart, onColumnHeaderDragEnd, onColumnHeaderDrop,
  getSortCriteria, setSortCriteria,
}) {
  return (
    <div
      onDragOver={(e) => onColumnDragOver(e, stage.stageKey)}
      onDragLeave={onColumnDragLeave}
      onDrop={() => onColumnDrop(stage.stageKey)}
      className="flex flex-col rounded-lg transition-all duration-150"
      style={{ width: 272, minWidth: 272, height: boardHeight, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface-alt)", boxShadow: isDragOver ? `0 0 0 2px ${stage.color}30` : "none" }}
    >
      {/* Arrastável pra reordenar etapas — canal de drag separado do drop de
          card acima (onColumnDrop/onColumnDragOver/onColumnDragLeave, props
          já existentes desta coluna, servem exclusivamente o card). Nomes
          diferentes (draggedColumnKey, onColumnHeaderDragStart, onColumnHeaderDragEnd,
          onColumnHeaderDrop) em vez de handleDrop/onColumnDragOver/onColumnDragLeave
          porque estes últimos já existem no arquivo pro drop de card — mesmo achado de
          colisão de nomes já resolvido em RHOnboardingView/RHFeriasView.
          stopPropagation nos handlers evita que o drag de reorder vaze pro
          div pai que escuta o drop de card. */}
      <div
        draggable={canWrite}
        onDragStart={() => canWrite && onColumnHeaderDragStart(stage.stageKey)}
        onDragEnd={onColumnHeaderDragEnd}
        onDragOver={e => { if (draggedColumnKey) { e.preventDefault(); e.stopPropagation(); } }}
        onDrop={e => { if (draggedColumnKey && draggedColumnKey !== stage.stageKey) { e.stopPropagation(); onColumnHeaderDrop(stage.stageKey); } }}
        style={{ cursor: canWrite ? "grab" : "default" }}
      >
        <KanbanColumnHeader
          color={stage.color}
          name={stage.name}
          count={atribList.length}
          bandHeight={4}
          letterSpacing="normal"
          nameColor={stage.color}
          nameFontSize={14}
          nameFontWeight={700}
          uppercase={false}
          countFontSize={12}
          actions={
            <div className="flex items-center gap-1 shrink-0">
              <KanbanColumnSortMenu
                criteria={getSortCriteria(stage.stageKey)}
                onChange={(v) => setSortCriteria(stage.stageKey, v)}
                options={["recent", "alpha"]}
                accentColor={stage.color}
              />
              {canWrite && (
                <button onClick={() => onEditFields(stage)} title="Editar campos desta etapa" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "flex", flexShrink: 0 }}>
                  <Settings2 size={13} />
                </button>
              )}
            </div>
          }
        />
      </div>
      <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {atribList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-dim)", fontSize: 11, opacity: 0.5, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ opacity: 0.5 }}>Nenhuma atribuição nesta etapa</span>
            {/* "Criar" aqui é atribuir um colaborador já existente ao treinamento
                (não criar registro novo do zero) — texto reflete isso, não o
                genérico "crie um novo" usado nos outros kanbans. */}
            {!stage.terminal && <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card aqui ou atribua alguém</span>}
          </div>
        ) : (
          atribList.map((a) => (
            <RHKanbanCard
              key={a.id}
              id={a.id}
              stage={a.status}
              stages={stages}
              onClick={() => onCardClick(a)}
              onDragStart={canWrite ? onDragStart : undefined}
              onDragEnd={canWrite ? onDragEnd : undefined}
              onMoveToStage={canWrite ? onMoveToStage : undefined}
              onDeleteCard={canWrite ? onDeleteAtribuicao : undefined}
              agingDays={daysInStage(a.status_changed_at)}
              completeness={getCompleteness?.(a)}
              unread={getUnread?.(a)}
              showMoveOptions={false}
            >
              <AtribuicaoCardBody atribuicao={a} colaborador={colaboradoresById.get(a.colaborador_id)} />
            </RHKanbanCard>
          ))
        )}
      </div>
    </div>
  );
}

function AtribuicaoDrawer({
  atribuicao, treinamento, colaborador, canWrite, stages, users, currentUser,
  onStageChange, moveError, onUpdateCustomFields, onUpdateCertificado, onReciclar, onAddActivity, onUpdateActivity, onClose, notifyMentions, onDelete, onEditFields,
}) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const stageFieldsHook = useRHStageFields("treinamentos");
  const customDefs = stageFieldsHook.getFields(atribuicao.status);
  const [customDraft, setCustomDraft] = useState({});
  const [certDraft, setCertDraft] = useState(atribuicao.certificado_url || "");
  const [reciclando, setReciclando] = useState(false);

  useEffect(() => { setCustomDraft({}); setCertDraft(atribuicao.certificado_url || ""); }, [atribuicao.id, atribuicao.certificado_url]);

  const saveCert = () => {
    const next = certDraft.trim();
    if (next === (atribuicao.certificado_url || "")) return;
    onUpdateCertificado?.(next);
  };

  const handleReciclar = async () => {
    if (reciclando) return;
    setReciclando(true);
    try { await onReciclar?.(); } finally { setReciclando(false); }
  };

  const podeReciclar = atribuicao.status === "vencido" || atribuicao.status === "concluido";

  const handleCustomChange = (fieldKey, value) => {
    setCustomDraft((prev) => ({ ...prev, [fieldKey]: value }));
    const merged = { ...(atribuicao.custom_fields || {}), [fieldKey]: value };
    onUpdateCustomFields(merged);
  };

  const getCustomValue = (fieldKey) =>
    fieldKey in customDraft ? customDraft[fieldKey] : (atribuicao.custom_fields?.[fieldKey] ?? "");

  const customValuesByKey = { ...(atribuicao.custom_fields || {}), ...customDraft };
  const visibleCustomDefs = resolveVisibleFields(customDefs, customValuesByKey);

  const st = findStage(stages, atribuicao.status);
  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const moveTargets = stages.filter((s) => s.stageKey !== atribuicao.status);

  const header = (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{colaborador?.fullName || "—"}</div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{treinamento.titulo}</div>
      <div style={{ marginTop: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${st.color}18`, color: st.color, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, display: "inline-block" }} /> {st.name}
        </span>
      </div>
    </div>
  );

  const certRelevante = atribuicao.status === "concluido" || atribuicao.status === "vencido";
  const certBlock = certRelevante ? (
    <div>
      <div style={labelSt}>Certificado de conclusão</div>
      {canWrite ? (
        <>
          <input
            type="url"
            value={certDraft}
            onChange={(e) => setCertDraft(e.target.value)}
            onBlur={saveCert}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
            placeholder="https://drive.google.com/… (link do comprovante)"
            className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
            style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 }}
          />
          {atribuicao.certificado_url ? (
            <a href={atribuicao.certificado_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
              <ExternalLink size={12} /> Abrir certificado
            </a>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11, color: "var(--warning)", fontWeight: 600 }}>
              <AlertCircle size={11} /> Sem certificado em mãos — o auditor vai cobrar.
            </div>
          )}
        </>
      ) : atribuicao.certificado_url ? (
        <a href={atribuicao.certificado_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
          <ExternalLink size={12} /> Abrir certificado
        </a>
      ) : (
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Sem certificado anexado.</div>
      )}
    </div>
  ) : null;

  const customBlock = visibleCustomDefs.length > 0 ? (
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
            <RHStageFieldInput field={f} value={getCustomValue(f.fieldKey)} onChange={(val) => handleCustomChange(f.fieldKey, val)} users={users} touched={Boolean(moveError)} />
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const formContent = (certBlock || customBlock) ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {certBlock}
      {customBlock}
    </div>
  ) : null;

  const left = null;

  const right = (
    <>
      {canWrite && (
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
            onMove={(stageKey) => onStageChange(atribuicao.id, stageKey)}
            getKey={(s) => s.stageKey}
          />
        </div>
      )}

      {canWrite && podeReciclar && onReciclar && (
        <div>
          <div style={labelSt}>Reciclagem</div>
          <button
            onClick={handleReciclar}
            disabled={reciclando}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent-tint)", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: reciclando ? "default" : "pointer", opacity: reciclando ? 0.6 : 1 }}
          >
            <RefreshCw size={13} /> {reciclando ? "Reabrindo…" : "Reciclar treinamento"}
          </button>
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
            {atribuicao.status === "vencido"
              ? "Reabre pra nova realização — zera conclusão e certificado."
              : "Antecipa a próxima rodada antes do vencimento — zera conclusão e certificado."}
          </p>
        </div>
      )}

      <RHDetailComments
        activities={atribuicao.activities || []}
        onAddActivity={onAddActivity}
        onUpdateActivity={onUpdateActivity ? (activityId, patch) => onUpdateActivity(atribuicao.id, activityId, patch) : undefined}
        currentUser={currentUser}
        users={users}
        notifyMentions={notifyMentions}
        mentionLink={{ module: "rh_treinamentos", id: atribuicao.id }}
        mentionContextLabel={[colaborador?.fullName, treinamento?.titulo].filter(Boolean).join(" · ")}
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

  const center = (
    <RHDetailDrawerShell
      domain="treinamentos"
      recordId={atribuicao.id}
      activities={atribuicao.activities || []}
      onAddActivity={onAddActivity}
      currentUser={currentUser}
      users={users}
      stages={stages}
      formContent={formContent}
      record={{ ...atribuicao, stage: atribuicao.status, stageChangedAt: atribuicao.status_changed_at }}
      recordTitle={[colaborador?.fullName, treinamento?.titulo].filter(Boolean).join(" · ")}
      domainLabel="Treinamentos"
    />
  );

  return (
    <SplitPanelDrawer
      onClose={onClose}
      header={header}
      left={left}
      center={center}
      right={right}
      onDelete={canWrite && onDelete ? () => onDelete(atribuicao.id) : undefined}
      deleteLabel="Excluir atribuição"
    />
  );
}

// ── Tabela ────────────────────────────────────────────────────────────────────
// Colaborador, etapa (dinâmica), conclusão e vencimento (validade_dias do
// treinamento aplicada sobre data_conclusao) — mesmos campos já exibidos no
// card (AtribuicaoCardBody) e na lista de conformidade do catálogo.

function TreinamentoTableView({ atribuicoes, treinamento, stages, colaboradoresById, onRowClick }) {
  return (
    <div className="rounded-2xl border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {["Colaborador", "Cargo", "Etapa", "Conclusão", "Vencimento", "Certificado"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {atribuicoes.length === 0 && (
            <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>Ninguém atribuído ainda.</td></tr>
          )}
          {atribuicoes.map((a) => {
            const st = findStage(stages, a.status);
            const colaborador = colaboradoresById.get(a.colaborador_id);
            const venc = vencimentoDate(a, treinamento);
            return (
              <tr key={a.id} onClick={() => onRowClick(a)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text)" }}>{colaborador?.fullName || "—"}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{colaborador?.jobTitle || "—"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: st.color + "18", color: st.color, border: `1px solid ${st.color}40` }}>
                    {st.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{fmt(a.data_conclusao)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: a.status === "vencido" ? "var(--danger)" : "var(--text-dim)", fontWeight: a.status === "vencido" ? 700 : 400 }}>
                  {venc ? fmt(venc) : "—"}
                </td>
                <td className="px-4 py-3 text-xs">
                  {a.certificado_url ? (
                    <a href={a.certificado_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--accent)", fontWeight: 600 }}>
                      <ExternalLink size={12} /> Ver
                    </a>
                  ) : a.status === "concluido" ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--warning)", fontWeight: 600 }}>
                      <AlertCircle size={11} /> Sem certificado
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-dim)" }}>—</span>
                  )}
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
// Agrupa por data de vencimento (data_conclusao + validade_dias do
// treinamento) — mesma conta de vencimentoDate() usada pro status "vencido".
// Atribuições sem conclusão ainda (logo, sem vencimento calculável) não têm
// como aparecer num dia específico do calendário.

function TreinamentoCalendarView({ atribuicoes, treinamento, stages, colaboradoresById, onPillClick }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map();
    for (const a of atribuicoes) {
      const venc = vencimentoDate(a, treinamento);
      if (!venc) continue;
      const k = dayKey(venc);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(a);
    }
    return map;
  }, [atribuicoes, treinamento]);

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
                {items.slice(0, 3).map((a) => {
                  const st = findStage(stages, a.status);
                  const colaborador = colaboradoresById.get(a.colaborador_id);
                  return (
                    <span key={a.id} onClick={() => onPillClick(a)}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer"
                      style={{ background: st.color + "18", color: st.color }}
                      title={colaborador?.fullName || "—"}>
                      {colaborador?.fullName || "—"}
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

function TreinamentoBoardModal({
  treinamento, atribuicoes, allAtribuicoes, colaboradoresById, canWrite, currentUser, users,
  onChangeStage, onUpdateCustomFields, onUpdateCertificado, onReciclar, onAddActivity, onUpdateActivity, onClose, notifyMentions, onDelete,
  initialDrawerId, onInitialDrawerIdConsumed,
}) {
  const { stages, loading: loadingStages, addStage, reorderStages } = useRHPipelineStages("treinamentos");
  const stageFields = useRHStageFields("treinamentos");
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "table" | "calendar" | "analytics"
  const [drawerId, setDrawerId] = useState(null);
  const [fieldEditorStage, setFieldEditorStage] = useState(null);
  const [addingStage, setAddingStage] = useState(false);
  const [draggedColumnKey, setDraggedColumnKey] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverStageKey, setDragOverStageKey] = useState(null);
  const [moveError, setMoveError] = useState(null);
  // marginBottom = 16 pra casar com o paddingBottom:16 do próprio scroll
  // container do board logo abaixo (era 24, um valor arbitrário sem
  // relação com nenhum respiro real deste board — não existe painel de
  // analytics nem texto de dica depois do Kanban aqui, então não há
  // trailingRef a passar).
  // `loadingStages` entra nas deps porque a div do board (boardRef) só
  // existe no DOM quando loadingStages vira false (antes disso o galho
  // renderizado é "Carregando…", sem o ref) — sem essa dependência, a
  // única vez que o efeito do hook roda encontra boardRef.current ainda
  // nulo, sai cedo (`if (!el) return`) e nunca mais recalcula, deixando
  // boardHeight travado no fallback de 480px pro resto da vida do modal
  // (só "curava" se o usuário trocasse viewMode manualmente) — era esse o
  // board ficando raso mesmo em janela alta, reportado de novo.
  const [boardRef, boardHeight] = useAvailableHeight(16, [viewMode, loadingStages]);

  const { viewedAt, markViewed } = useRecordViews("rh_treinamentos", currentUser?.id);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape" && !drawerId) onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, drawerId]);

  useEffect(() => {
    setMoveError(null);
    if (drawerId) markViewed(drawerId);
  }, [drawerId]);

  useEffect(() => {
    if (!initialDrawerId) return;
    setDrawerId(initialDrawerId);
    onInitialDrawerIdConsumed?.();
  }, [initialDrawerId, onInitialDrawerIdConsumed]);

  const { getCriteria: getSortCriteria, setCriteria: setSortCriteria } = useKanbanColumnSort("rh-treinamentos");
  const byStage = useMemo(() => {
    const map = {};
    const defaultKey = stages[0]?.stageKey || "pendente";
    stages.forEach(s => {
      const list = atribuicoes.filter(a => (a.status || defaultKey) === s.stageKey);
      map[s.stageKey] = sortKanbanItems(list, getSortCriteria(s.stageKey), {
        name: a => colaboradoresById.get(a.colaborador_id)?.fullName,
        createdAt: a => a.created_at,
      });
    });
    return map;
  }, [atribuicoes, stages, getSortCriteria, colaboradoresById]);

  const getCompleteness = (a) => getFieldCompleteness(stageFields.getFields(a.status), a.custom_fields || {});

  const handleMove = (id, stage) => {
    const atrib = atribuicoes.find(a => a.id === id);
    if (!atrib) return;
    const fields = stageFields.getFields(atrib.status);
    const missing = getMissingRequiredFields(fields, atrib.custom_fields || {});
    if (missing.length > 0) {
      setMoveError(`Não dá pra mover: preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = getInvalidFields(fields, atrib.custom_fields || {});
    if (invalid.length > 0) {
      setMoveError(`Não dá pra mover: corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
    setMoveError(null);
    onChangeStage(id, stage);
    // Se veio do drawer aberto dessa atribuição: fecha agora (sinal visual
    // de que moveu) e reabre já na etapa nova, em vez de só trocar o
    // conteúdo por baixo do drawer aberto.
    if (drawerId === id) {
      setDrawerId(null);
      reopenAfterMove(setDrawerId, id);
    }
  };

  const handleDrop = (stageKey) => {
    if (draggedId) {
      const atrib = atribuicoes.find(a => a.id === draggedId);
      if (atrib && atrib.status !== stageKey) handleMove(draggedId, stageKey);
    }
    setDraggedId(null);
    setDragOverStageKey(null);
  };

  // Canal de drag separado do drop de card acima (draggedColumnKey vs
  // draggedId) — reordena etapas arrastando o cabeçalho da coluna. Nomeado
  // handleStageReorder* (não handleColumnDragEnd/handleColumnDrop) porque
  // handleDrop já existe acima e serve exclusivamente o drop de card (mesmo
  // achado de colisão de nomes já resolvido em RHOnboardingView/RHFeriasView).
  const handleStageReorderDragEnd = () => setDraggedColumnKey(null);
  const handleStageReorderDrop = (targetStageKey) => {
    const draggedKey = draggedColumnKey;
    setDraggedColumnKey(null);
    if (!draggedKey || draggedKey === targetStageKey) return;
    const order = stages.map(s => s.stageKey);
    const fromIdx = order.indexOf(draggedKey);
    const toIdx   = order.indexOf(targetStageKey);
    if (fromIdx === -1 || toIdx === -1) return;
    const nextOrder = [...order];
    nextOrder.splice(fromIdx, 1);
    nextOrder.splice(toIdx, 0, draggedKey);
    const dbIdByKey = new Map(stages.map(s => [s.stageKey, s.id]));
    const orderedIds = nextOrder.map(k => dbIdByKey.get(k)).filter(Boolean);
    if (orderedIds.length === nextOrder.length) reorderStages(orderedIds);
  };

  const drawerAtrib = drawerId ? atribuicoes.find(a => a.id === drawerId) : null;

  const analyticsStages = useMemo(
    () => stages.filter(s => !s.terminal).map(s => ({ key: s.stageKey, name: s.name, color: s.color, slaDays: s.slaDays })),
    [stages]
  );

  const boardSpecificStats = useMemo(() => {
    const concluido = atribuicoes.filter(a => a.status === "concluido").length;
    const vencido = atribuicoes.filter(a => a.status === "vencido").length;
    const decided = concluido + vencido;
    const taxaConclusao = decided > 0 ? Math.round((concluido / decided) * 100) : null;
    const certificados = atribuicoes.filter(a => a.certificado_url).length;
    return [
      { label: "Taxa de conclusão", value: taxaConclusao !== null ? `${taxaConclusao}%` : "—" },
      // "no período" (sugerido na spec) não existe aqui — este board não tem
      // filtro de período (é por treinamento, sem seletor de datas) —
      // substituído pelo total de certificados emitidos entre as atribuições
      // já carregadas deste treinamento.
      { label: "Certificados emitidos", value: String(certificados) },
    ];
  }, [atribuicoes]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", flexDirection: "column" }}>
      <div style={{ background: "var(--surface)", flex: 1, display: "flex", flexDirection: "column", margin: 24, borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between flex-wrap gap-3" style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>{treinamento.titulo}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>Board de acompanhamento — {atribuicoes.length} pessoa{atribuicoes.length !== 1 ? "s" : ""} atribuída{atribuicoes.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
              <ViewToggleButton active={viewMode === "kanban"}   onClick={() => setViewMode("kanban")}   icon={LayoutGrid}   label="Kanban" />
              <ViewToggleButton active={viewMode === "table"}    onClick={() => setViewMode("table")}    icon={List}         label="Tabela" />
              <ViewToggleButton active={viewMode === "calendar"} onClick={() => setViewMode("calendar")} icon={CalendarIcon} label="Calendário" />
              <ViewToggleButton active={viewMode === "analytics"} onClick={() => setViewMode("analytics")} icon={TrendingUp} label="Análise" />
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-dim)", padding: "8px 10px", borderRadius: 10, display: "flex" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: 20, overflowX: "auto", flex: 1 }}>
          {loadingStages ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
          ) : viewMode === "table" ? (
            <TreinamentoTableView
              atribuicoes={atribuicoes}
              treinamento={treinamento}
              stages={stages}
              colaboradoresById={colaboradoresById}
              onRowClick={(a) => setDrawerId(a.id)}
            />
          ) : viewMode === "calendar" ? (
            <TreinamentoCalendarView
              atribuicoes={atribuicoes}
              treinamento={treinamento}
              stages={stages}
              colaboradoresById={colaboradoresById}
              onPillClick={(a) => setDrawerId(a.id)}
            />
          ) : viewMode === "analytics" ? (
            <KanbanAnalyticsPanel
              stages={analyticsStages}
              records={atribuicoes}
              getStageKey={(a) => a.status}
              getStageEnteredAt={(a) => a.status_changed_at}
              specificStats={boardSpecificStats}
            />
          ) : (
            <>
              <RHMobileKanbanAccordion
                stages={stages}
                itemsByStage={byStage}
                getSortCriteria={getSortCriteria}
                setSortCriteria={setSortCriteria}
                sortOptions={["recent", "alpha"]}
                renderCard={(a) => (
                  <RHKanbanCard
                    key={a.id}
                    id={a.id}
                    stage={a.status}
                    stages={stages}
                    onClick={() => setDrawerId(a.id)}
                    onDragStart={canWrite ? setDraggedId : undefined}
                    onDragEnd={canWrite ? () => { setDraggedId(null); setDragOverStageKey(null); } : undefined}
                    onMoveToStage={canWrite ? handleMove : undefined}
                    onDeleteCard={canWrite ? onDelete : undefined}
                    agingDays={daysInStage(a.status_changed_at)}
                    completeness={getCompleteness?.(a)}
                    unread={hasUnreadRHComment(a, viewedAt, currentUser?.id)}
                  >
                    <AtribuicaoCardBody atribuicao={a} colaborador={colaboradoresById.get(a.colaborador_id)} />
                  </RHKanbanCard>
                )}
                emptyLabel="Ninguém aqui"
              />
              {canWrite && (
                <button
                  onClick={() => setAddingStage(true)}
                  className="lg:hidden w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed text-xs font-semibold"
                  style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
                >
                  <Plus size={13} />
                  Nova etapa
                </button>
              )}
              <div className="hidden lg:block">
                <KanbanBoardScrollArea scrollRef={boardRef} height={boardHeight}>
                  <div className="flex gap-2 h-full" style={{ minWidth: `${stages.length * 280}px` }}>
                    {stages.map((stage) => (
                      <TreinamentoBoardColumn
                        key={stage.id}
                        stage={stage}
                        stages={stages}
                        atribList={byStage[stage.stageKey] || []}
                        colaboradoresById={colaboradoresById}
                        onCardClick={(a) => setDrawerId(a.id)}
                        onDragStart={setDraggedId}
                        onDragEnd={() => { setDraggedId(null); setDragOverStageKey(null); }}
                        onMoveToStage={handleMove}
                        onDeleteAtribuicao={canWrite ? onDelete : undefined}
                        isDragOver={dragOverStageKey === stage.stageKey}
                        onColumnDragOver={(e, key) => { e.preventDefault(); setDragOverStageKey(key); }}
                        onColumnDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStageKey(null); }}
                        onColumnDrop={handleDrop}
                        canWrite={canWrite}
                        onEditFields={setFieldEditorStage}
                        getCompleteness={getCompleteness}
                        getUnread={(a) => hasUnreadRHComment(a, viewedAt, currentUser?.id)}
                        boardHeight={boardHeight}
                        draggedColumnKey={draggedColumnKey}
                        onColumnHeaderDragStart={setDraggedColumnKey}
                        onColumnHeaderDragEnd={handleStageReorderDragEnd}
                        onColumnHeaderDrop={handleStageReorderDrop}
                        getSortCriteria={getSortCriteria}
                        setSortCriteria={setSortCriteria}
                      />
                    ))}
                    {canWrite && (
                      <button
                        onClick={() => setAddingStage(true)}
                        title="Nova etapa"
                        className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-xs font-semibold shrink-0"
                        style={{ width: 140, height: 64, borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-dim)"; }}
                      >
                        <Plus size={16} />
                        Nova etapa
                      </button>
                    )}
                  </div>
                </KanbanBoardScrollArea>
              </div>
            </>
          )}
        </div>
      </div>

      {drawerAtrib && (
        <AtribuicaoDrawer
          atribuicao={drawerAtrib}
          treinamento={treinamento}
          colaborador={colaboradoresById.get(drawerAtrib.colaborador_id)}
          canWrite={canWrite}
          stages={stages}
          users={users}
          currentUser={currentUser}
          onStageChange={(id, stage) => { handleMove(id, stage); }}
          moveError={moveError}
          onUpdateCustomFields={(merged) => onUpdateCustomFields(drawerAtrib.id, merged)}
          onUpdateCertificado={(url) => onUpdateCertificado(drawerAtrib.id, url)}
          onReciclar={() => onReciclar(drawerAtrib.id)}
          onAddActivity={(entry) => onAddActivity(drawerAtrib.id, entry)}
          onUpdateActivity={onUpdateActivity ? (activityId, patch) => onUpdateActivity(drawerAtrib.id, activityId, patch) : undefined}
          onClose={() => setDrawerId(null)}
          notifyMentions={notifyMentions}
          onDelete={onDelete}
          onEditFields={setFieldEditorStage}
        />
      )}

      {canWrite && (
        <RHStageFieldsPanel
          open={!!fieldEditorStage}
          onClose={() => setFieldEditorStage(null)}
          domain="treinamentos"
          stageKey={fieldEditorStage?.stageKey}
          stageName={fieldEditorStage?.name}
          records={allAtribuicoes}
          stageField="status"
          // pendente/concluido/vencido não são "terminal" (não representam um
          // resultado tipo ganho/perdido), mas são lidos direto em código —
          // detecção de atraso, botão de concluir/reciclar (ver
          // use-rh-treinamentos.js e este arquivo) — pra TODOS os
          // treinamentos da plataforma, não só o board aberto. Apagar
          // qualquer uma quebra essa lógica de compliance silenciosamente.
          // Usa allAtribuicoes (não a `atribuicoes` já filtrada pro
          // treinamento deste board) porque domain="treinamentos" é
          // compartilhado por todos os treinamentos — checar só as
          // atribuições deste board deixaria passar exclusão de uma etapa
          // ainda em uso por OUTRO treinamento.
          protectedStageKeys={["pendente", "concluido", "vencido"]}
          protectedLabel="Treinamentos"
        />
      )}

      {addingStage && (
        <NewStageModal
          existingKeys={stages.map(s => s.stageKey)}
          nextOrderIdx={stages.length}
          onAdd={addStage}
          onClose={() => setAddingStage(false)}
        />
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function RHTreinamentosView({ currentUser, canWrite, isRHUser, users = [], notifyMentions, initialSelectedTreinamentoAtribuicaoId, onInitialTreinamentoAtribuicaoConsumed }) {
  const {
    treinamentos, atribuicoes, loading: loadingTreinamentos, createTreinamento, updateTreinamento, deleteTreinamento,
    assignToUsers, updateAtribuicaoStatus, changeAtribuicaoStage, reciclarAtribuicao, updateAtribuicaoCertificado,
    updateAtribuicaoCustomFields, deleteAtribuicao, addAtribuicaoActivity, updateAtribuicaoActivity,
  } = useRHTreinamentos({ userId: currentUser?.id });

  const handleDeleteTreinamento = useCallback(async (t) => {
    if (!window.confirm(`Excluir "${t.title}"? As atribuições vinculadas também serão removidas.`)) return;
    try { await deleteTreinamento(t.id); } catch (e) { window.alert(`Erro ao excluir: ${e?.message || e}`); }
  }, [deleteTreinamento]);
  const { colaboradores, loading: loadingColaboradores } = useRHColaboradores({ userId: currentUser?.id });
  const { meuColaborador, loading: loadingMeuColaborador } = useMyColaborador(currentUser);
  const [novoOpen, setNovoOpen]         = useState(false);
  const [editingTreinamento, setEditingTreinamento] = useState(null);
  const [atribuindoTo, setAtribuindoTo] = useState(null);
  const [boardTreinamento, setBoardTreinamento] = useState(null);
  const [boardInitialDrawerId, setBoardInitialDrawerId] = useState(null);
  const [expanded, setExpanded]         = useState(new Set());
  const [catalogQuery, setCatalogQuery] = useState("");

  const loading = loadingTreinamentos || loadingColaboradores || loadingMeuColaborador;

  const colaboradoresById = useMemo(() => new Map(colaboradores.map(c => [c.id, c])), [colaboradores]);

  // Lista de atribuíveis do modal "Atribuir" — dois achados da auditoria de
  // QA aqui: (1) a mesma pessoa aparecia 2x (um registro legado com
  // profile_id NULL criado antes do trigger de sincronização, mais o
  // registro sincronizado de verdade — dedup por nome+e-mail, preferindo o
  // que tem profileId); (2) usuários com role "agencia" (Visitante) também
  // ganham um rh_colaboradores pelo mesmo trigger e apareciam como opção
  // atribuível, mas Visitante não deveria entrar em nada de funcionário.
  const usersById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const assignableColaboradores = useMemo(() => {
    const seen = new Map();
    for (const c of colaboradores) {
      const role = c.profileId ? usersById.get(c.profileId)?.role : null;
      if (role === "agencia") continue;
      const key = `${(c.fullName || "").trim().toLowerCase()}|${(c.email || "").trim().toLowerCase()}`;
      const existing = seen.get(key);
      if (!existing || (!existing.profileId && c.profileId)) seen.set(key, c);
    }
    return [...seen.values()];
  }, [colaboradores, usersById]);

  const atribuicoesByTreinamento = useMemo(() => {
    const map = new Map();
    atribuicoes.forEach(a => {
      if (!map.has(a.treinamento_id)) map.set(a.treinamento_id, []);
      map.get(a.treinamento_id).push(a);
    });
    return map;
  }, [atribuicoes]);

  const myAtribuicoes = useMemo(
    () => meuColaborador ? atribuicoes.filter(a => a.colaborador_id === meuColaborador.id) : [],
    [atribuicoes, meuColaborador]
  );

  // Vem do painel de Conexões do Colaborador — a atribuição vive dentro do
  // quadro do treinamento, não solta na tela principal. Abre o quadro do
  // treinamento dono da atribuição e pede pra ele abrir o drawer dela assim
  // que montar (ver TreinamentoBoardModal abaixo).
  useEffect(() => {
    if (!initialSelectedTreinamentoAtribuicaoId || loadingTreinamentos) return;
    const atrib = atribuicoes.find(a => a.id === initialSelectedTreinamentoAtribuicaoId);
    const treinamento = atrib ? treinamentos.find(t => t.id === atrib.treinamento_id) : null;
    if (treinamento) {
      setBoardTreinamento(treinamento);
      setBoardInitialDrawerId(atrib.id);
    }
    onInitialTreinamentoAtribuicaoConsumed?.();
  }, [initialSelectedTreinamentoAtribuicaoId, loadingTreinamentos, atribuicoes, treinamentos, onInitialTreinamentoAtribuicaoConsumed]);

  const filteredTreinamentos = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return treinamentos;
    return treinamentos.filter(t => (t.titulo || "").toLowerCase().includes(q));
  }, [treinamentos, catalogQuery]);

  const toggleExpand = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (!isSupabaseConfigured) {
    return (
      <EmptyState icon={GraduationCap} title="Supabase não configurado" description="Configure as variáveis de ambiente para usar este módulo." />
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap size={22} style={{ color: "var(--text)" }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Treinamentos</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            {isRHUser ? "Catálogo, atribuição e conformidade" : "Seus treinamentos atribuídos"}
          </p>
        </div>
        {canWrite && (
          <Button icon={Plus} onClick={() => setNovoOpen(true)}>Novo treinamento</Button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : isRHUser ? (
        <>
          <ComplianceStats atribuicoes={atribuicoes} treinamentos={treinamentos} colaboradoresById={colaboradoresById} />
          {treinamentos.length === 0 ? (
            <EmptyState icon={GraduationCap} title="Nenhum treinamento cadastrado" description="Cadastre um treinamento para começar a montar o catálogo." />
          ) : (
            <>
              <input
                type="text"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Buscar treinamento por título…"
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none mb-3"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", maxWidth: 360 }}
              />
              {filteredTreinamentos.length === 0 ? (
                <EmptyState icon={GraduationCap} title="Nenhum treinamento encontrado" description="Ajuste a busca." />
              ) : (
            <div className="flex flex-col gap-3">
              {filteredTreinamentos.map(t => {
                const atribs = atribuicoesByTreinamento.get(t.id) || [];
                const concluidos = atribs.filter(a => a.status === "concluido").length;
                const vencidos = atribs.filter(a => a.status === "vencido").length;
                return (
                  <div key={t.id} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--surface-alt)", flexWrap: "wrap" }}>
                      <button onClick={() => toggleExpand(t.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexShrink: 0 }}>
                        {expanded.has(t.id) ? <ChevronDown size={14} color={"var(--text-dim)"} /> : <ChevronRight size={14} color={"var(--text-dim)"} />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{t.titulo}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: t.tipo === "obrigatorio" ? "var(--danger)" : "var(--text-dim)", background: t.tipo === "obrigatorio" ? "var(--danger-bg)" : "var(--surface-alt)", borderRadius: 99, padding: "1px 8px" }}>
                            {t.tipo === "obrigatorio" ? "Obrigatório" : "Opcional"}
                          </span>
                          {t.validade_dias && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint)", borderRadius: 99, padding: "1px 8px" }}>
                              Válido {t.validade_dias}d
                            </span>
                          )}
                          {vencidos > 0 && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "var(--danger)", background: "var(--danger-bg)", borderRadius: 99, padding: "1px 8px" }}>
                              <AlertTriangle size={9} /> {vencidos} vencido{vencidos !== 1 ? "s" : ""}
                            </span>
                          )}
                          {t.frente && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: RH_FRENTE_COLORS[t.frente], background: `${RH_FRENTE_COLORS[t.frente]}18`, borderRadius: 99, padding: "1px 8px" }}>
                              {RH_FRENTE_LABELS[t.frente]}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                          {atribs.length} atribuído{atribs.length !== 1 ? "s" : ""} · {concluidos} em dia
                          {(t.cargo_alvo || t.departamento_alvo) && ` · alvo: ${[t.cargo_alvo, t.departamento_alvo].filter(Boolean).join(" / ")}`}
                        </div>
                      </div>
                      {t.link_conteudo && (
                        <a href={t.link_conteudo} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", display: "flex", flexShrink: 0 }}><ExternalLink size={14} /></a>
                      )}
                      {canWrite && (
                        <>
                          <button onClick={() => setEditingTreinamento(t)} style={{ fontSize: 11, color: "var(--text-dim)", background: "var(--surface-alt)", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                            Editar
                          </button>
                          <button onClick={() => setAtribuindoTo(t)} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--accent-tint)", color: "var(--accent)", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                            <Users size={11} /> Atribuir
                          </button>
                          {atribs.length > 0 && (
                            <button onClick={() => setBoardTreinamento(t)} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                              <LayoutGrid size={11} /> Ver quadro
                            </button>
                          )}
                          <button onClick={() => handleDeleteTreinamento(t)} style={{ fontSize: 11, color: "var(--danger)", background: "var(--surface-alt)", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                    {expanded.has(t.id) && (
                      <div style={{ padding: "8px 16px 12px" }}>
                        {atribs.length === 0 ? (
                          <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "8px 0" }}>Ninguém atribuído ainda.</div>
                        ) : atribs.map(a => {
                          const info = atribuicaoStatusInfo(a, t);
                          const venc = vencimentoDate(a, t);
                          const venceEmBreve = a.status === "concluido" && venc && (venc.getTime() - Date.now()) <= 30 * 86400000;
                          const podeReciclar = a.status === "vencido" || venceEmBreve;
                          return (
                            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                              <span style={{ flex: 1, fontSize: 12, color: "var(--text)" }}>{colaboradoresById.get(a.colaborador_id)?.fullName || "—"}</span>
                              {a.status === "concluido" && !a.certificado_url && (
                                <span title="Concluído sem certificado em mãos" style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 10, fontWeight: 700, color: "var(--warning)" }}>
                                  <AlertCircle size={10} /> sem certificado
                                </span>
                              )}
                              <span style={{ fontSize: 10, fontWeight: 700, color: info.color, background: info.bg, borderRadius: 99, padding: "2px 9px" }}>
                                {info.label}
                              </span>
                              {canWrite && podeReciclar && (
                                <button
                                  onClick={() => reciclarAtribuicao(a.id)}
                                  title={a.status === "vencido" ? "Reabrir para nova realização" : "Antecipar a próxima rodada antes de vencer"}
                                  style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}
                                >
                                  <RefreshCw size={10} /> Reciclar
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
              )}
            </>
          )}
        </>
      ) : !meuColaborador ? (
        <EmptyState icon={GraduationCap} title="Nenhum treinamento atribuído a você" description="Você ainda não está vinculado a um colaborador de RH." />
      ) : myAtribuicoes.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Nenhum treinamento atribuído a você" description="Os treinamentos atribuídos a você vão aparecer aqui." />
      ) : (
        <div className="flex flex-col gap-2">
          {myAtribuicoes.map(a => {
            const t = treinamentos.find(tr => tr.id === a.treinamento_id);
            if (!t) return null;
            const vencido = a.status === "vencido";
            // Autoatendimento só MARCA concluído — desmarcar (voltar pra
            // pendente) fica pro RH, senão o colaborador desfaz registro de
            // conformidade sem rastro.
            const jaConcluido = a.status === "concluido" && !vencido;
            return (
              <div key={a.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  onClick={() => { if (!jaConcluido) updateAtribuicaoStatus(a.id, "concluido"); }}
                  style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1.5px solid ${vencido ? "var(--danger)" : a.status === "concluido" ? "var(--success)" : "var(--border-strong)"}`, background: vencido ? "var(--surface)" : a.status === "concluido" ? "var(--success)" : "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: jaConcluido ? "default" : "pointer" }}
                  title={vencido ? "Vencido — clique para revalidar" : jaConcluido ? "Concluído — para desmarcar, fale com o RH" : undefined}
                >
                  {a.status === "concluido" && !vencido && <Check size={12} color="#FFF" />}
                  {vencido && <AlertTriangle size={11} color="var(--danger)" />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{t.titulo}</div>
                  {t.descricao && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{t.descricao}</div>}
                  {vencido && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 2, fontWeight: 600 }}>Vencido em {fmt(vencimentoDate(a, t))} — clique pra revalidar</div>}
                </div>
                {t.link_conteudo && (
                  <a href={t.link_conteudo} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", display: "flex", flexShrink: 0 }}><ExternalLink size={14} /></a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {novoOpen && <NovoTreinamentoModal onSave={createTreinamento} onClose={() => setNovoOpen(false)} />}
      {editingTreinamento && (
        <NovoTreinamentoModal
          initialData={editingTreinamento}
          onSave={(patch) => updateTreinamento(editingTreinamento.id, patch)}
          onClose={() => setEditingTreinamento(null)}
        />
      )}
      {atribuindoTo && <AtribuirModal treinamento={atribuindoTo} colaboradores={assignableColaboradores} onAssign={assignToUsers} onClose={() => setAtribuindoTo(null)} />}
      {boardTreinamento && (
        <TreinamentoBoardModal
          treinamento={boardTreinamento}
          atribuicoes={atribuicoesByTreinamento.get(boardTreinamento.id) || []}
          allAtribuicoes={atribuicoes}
          colaboradoresById={colaboradoresById}
          canWrite={canWrite}
          currentUser={currentUser}
          users={users}
          onChangeStage={changeAtribuicaoStage}
          onUpdateCustomFields={updateAtribuicaoCustomFields}
          onUpdateCertificado={updateAtribuicaoCertificado}
          onReciclar={reciclarAtribuicao}
          onAddActivity={addAtribuicaoActivity}
          onUpdateActivity={updateAtribuicaoActivity}
          onClose={() => { setBoardTreinamento(null); setBoardInitialDrawerId(null); }}
          notifyMentions={notifyMentions}
          onDelete={deleteAtribuicao}
          initialDrawerId={boardInitialDrawerId}
          onInitialDrawerIdConsumed={() => setBoardInitialDrawerId(null)}
        />
      )}
    </div>
  );
}

export default RHTreinamentosView;
