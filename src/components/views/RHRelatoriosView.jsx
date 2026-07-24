import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FileBarChart, Download, CheckSquare, Square, Users, UserMinus, BriefcaseBusiness,
  CalendarCheck, MessageSquareText, GraduationCap, Briefcase, Building2,
  Bookmark, ChevronDown, Trash2, Save, SearchX,
} from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useRHRecrutamento } from "../../hooks/use-rh-recrutamento";
import { useRHFeriasRequests } from "../../hooks/use-rh-ferias-requests";
import { useRHFeedback } from "../../hooks/use-rh-feedback";
import { useRHTreinamentos } from "../../hooks/use-rh-treinamentos";
import { useRHMovimentacoes } from "../../hooks/use-rh-movimentacoes";
import { useRHSuppliers } from "../../hooks/use-rh-suppliers";
import { useRHReportPresets } from "../../hooks/use-rh-report-presets";
import { RH_REPORT_METRICS, RH_REPORT_CATEGORIAS, buildRelatorioCSV } from "../../utils/rh-report-metrics";
import { triggerDownload } from "../../utils/export-csv";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card, CardGrid } from "../shared/Card";
import { FilterBar } from "../shared/FilterBar";

// Relatório configurável de RH (reunião com o RH, 20/07): "todo tipo de dado
// coletável possa ser exportado... por exemplo headcount, turnover e tempo
// de contratação. Ou só um deles, ou mais do que isso." Checklist de
// métricas agrupadas por categoria — a pessoa escolhe o que quer e baixa um
// único CSV combinado (uma seção por métrica). Padrão C, variante seletor
// (docs/design-spec-padroes-de-pagina.md, seção 3).

// Mesmo vocabulário de ícones do menu lateral (App.jsx) pros módulos de RH
// correspondentes a cada categoria.
const CATEGORIA_ICONS = {
  "Headcount": Users,
  "Turnover": UserMinus,
  "Recrutamento": BriefcaseBusiness,
  "Férias": CalendarCheck,
  "Avaliação": MessageSquareText,
  "Treinamentos": GraduationCap,
  "Cargos e Salários": Briefcase,
  "Fornecedores e Benefícios": Building2,
};

const VALID_METRIC_IDS = new Set(RH_REPORT_METRICS.map((m) => m.id));

const normalizar = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const secondaryBtnStyle = {
  background: "var(--surface)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "8px 14px",
  fontSize: 13,
  cursor: "pointer",
};

function ModelosDropdown({ presets, loading, onApply, onDelete }) {
  const [open, setOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) { setConfirmingId(null); setDeleteError(""); }
  }, [open]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    setDeleteError("");
    try {
      await onDelete(id);
      setConfirmingId(null);
    } catch (err) {
      setDeleteError(err.message || "Não foi possível excluir o modelo.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 font-semibold"
        style={secondaryBtnStyle}
      >
        <Bookmark size={14} /> Modelos <ChevronDown size={13} style={{ color: "var(--text-dim)" }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
            boxShadow: "var(--shadow-pop)", minWidth: 240, maxWidth: 300, overflow: "hidden",
          }}
        >
          {loading ? (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-dim)" }}>Carregando modelos…</div>
          ) : presets.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-dim)" }}>Nenhum modelo salvo ainda.</div>
          ) : (
            presets.map((p) => {
              const nMetricas = (p.metric_keys || []).length;
              if (confirmingId === p.id) {
                return (
                  <div key={p.id} style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 8, lineHeight: 1.4 }}>
                      Excluir o modelo "{p.name}"? Não pode ser desfeito.
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        style={{ flex: 1, background: "var(--danger)", color: "var(--on-accent)", border: "none", borderRadius: 6, padding: "6px 8px", fontSize: 12, fontWeight: 600, cursor: deletingId === p.id ? "default" : "pointer", opacity: deletingId === p.id ? 0.6 : 1 }}
                      >
                        {deletingId === p.id ? "Excluindo…" : "Excluir"}
                      </button>
                      <button
                        onClick={() => { setConfirmingId(null); setDeleteError(""); }}
                        style={{ flex: 1, background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 8px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={p.id} className="flex items-center">
                  <button
                    onClick={() => { onApply(p); setOpen(false); }}
                    style={{ flex: 1, minWidth: 0, textAlign: "left", padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", transition: "background 0.1s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ display: "block", fontSize: 13, color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--text-faint)" }}>
                      {nMetricas === 1 ? "1 métrica" : `${nMetricas} métricas`}
                    </span>
                  </button>
                  <button
                    onClick={() => { setConfirmingId(p.id); setDeleteError(""); }}
                    title="Excluir modelo"
                    aria-label={`Excluir modelo ${p.name}`}
                    style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: "8px 10px", display: "flex", flexShrink: 0 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-bg)"; e.currentTarget.style.color = "var(--danger)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
          {deleteError && (
            <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--danger)", background: "var(--danger-bg)" }}>{deleteError}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function RHRelatoriosView({ currentUser }) {
  const { colaboradores, loading: loadingColaboradores } = useRHColaboradores({ userId: currentUser?.id });
  const { vagas, aplicacoesRaw, loading: loadingRecrutamento } = useRHRecrutamento({ userId: currentUser?.id });
  const { requests: ferias, loading: loadingFerias } = useRHFeriasRequests({});
  const { feedbacks: avaliacoes, loading: loadingAvaliacoes } = useRHFeedback({ userId: currentUser?.id });
  const { treinamentos, atribuicoes, loading: loadingTreinamentos } = useRHTreinamentos({ userId: currentUser?.id });
  const { movimentacoes, loading: loadingMovimentacoes } = useRHMovimentacoes({ userId: currentUser?.id });
  const { contratos, loading: loadingFornecedores } = useRHSuppliers({ userId: currentUser?.id });
  const { presets, loading: loadingPresets, createPreset, deletePreset } = useRHReportPresets({ userId: currentUser?.id });

  const [selected, setSelected] = useState(() => new Set());
  const [busca, setBusca] = useState("");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const loading = loadingColaboradores || loadingRecrutamento || loadingFerias || loadingAvaliacoes || loadingTreinamentos || loadingMovimentacoes || loadingFornecedores;

  const metricsByCategoria = useMemo(() => {
    const map = new Map();
    for (const cat of RH_REPORT_CATEGORIAS) map.set(cat, []);
    for (const m of RH_REPORT_METRICS) map.get(m.categoria).push(m);
    return map;
  }, []);

  const buscaNorm = normalizar(busca.trim());
  const visibleByCategoria = useMemo(() => {
    const map = new Map();
    for (const cat of RH_REPORT_CATEGORIAS) {
      const metrics = metricsByCategoria.get(cat);
      const visiveis = buscaNorm ? metrics.filter((m) => normalizar(m.label).includes(buscaNorm)) : metrics;
      if (visiveis.length > 0) map.set(cat, visiveis);
    }
    return map;
  }, [metricsByCategoria, buscaNorm]);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Com busca ativa opera só sobre as métricas visíveis da categoria — marcar
  // itens escondidos pelo filtro mudaria a seleção sem o usuário ver.
  const toggleCategoria = (metrics) => {
    const ids = metrics.map((m) => m.id);
    const todosSelecionados = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (todosSelecionados ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const aplicarPreset = (preset) => {
    setSelected(new Set((preset.metric_keys || []).filter((id) => VALID_METRIC_IDS.has(id))));
  };

  const handleExportar = () => {
    const datasets = { colaboradores, vagas, aplicacoes: aplicacoesRaw, ferias, avaliacoes, treinamentos, atribuicoes, movimentacoes, contratos };
    const csv = buildRelatorioCSV([...selected], datasets);
    const today = new Date().toISOString().slice(0, 10);
    triggerDownload(`sanwey-relatorio-rh-${today}.csv`, csv);
  };

  const handleSalvarModelo = async () => {
    const nome = presetName.trim();
    if (!nome || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await createPreset({ name: nome, metricKeys: [...selected] });
      setSaveModalOpen(false);
      setPresetName("");
    } catch (err) {
      setSaveError(err.message || "Não foi possível salvar o modelo.");
    } finally {
      setSaving(false);
    }
  };

  if (!isSupabaseConfigured) {
    return <EmptyState icon={FileBarChart} title="Supabase não configurado" description="Configure as variáveis de ambiente para usar este módulo." />;
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileBarChart size={22} style={{ color: "var(--text)" }} />
            <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Relatórios de RH</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Escolha as métricas e exporte tudo num CSV só</p>
        </div>
      </div>

      <div
        className="flex items-center gap-2 flex-wrap mb-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", boxShadow: "var(--shadow-card)" }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: selected.size > 0 ? "var(--text)" : "var(--text-dim)" }}>
          {selected.size === 1 ? "1 métrica selecionada" : `${selected.size} métricas selecionadas`}
        </span>
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          <ModelosDropdown presets={presets} loading={loadingPresets} onApply={aplicarPreset} onDelete={deletePreset} />
          <button
            onClick={() => { setSaveError(""); setSaveModalOpen(true); }}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 font-semibold"
            style={{ ...secondaryBtnStyle, color: selected.size === 0 ? "var(--text-dim)" : "var(--text)", cursor: selected.size === 0 ? "default" : "pointer" }}
          >
            <Save size={14} /> Salvar como modelo
          </button>
          <button
            onClick={handleExportar}
            disabled={selected.size === 0 || loading}
            className="flex items-center gap-1.5 font-semibold"
            style={{ background: selected.size === 0 ? "var(--surface-alt)" : "var(--accent)", color: selected.size === 0 ? "var(--text-dim)" : "#FFF", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 13, cursor: selected.size === 0 ? "default" : "pointer" }}
          >
            <Download size={14} /> Exportar CSV{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <FilterBar
          search={{ value: busca, onChange: (e) => setBusca(e.target.value), placeholder: "Buscar métrica…" }}
        />
      </div>

      {visibleByCategoria.size === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nenhuma métrica pra esta busca"
          description={`Nada corresponde a "${busca.trim()}". Tente outro termo ou limpe a busca.`}
          action={<Button variant="secondary" onClick={() => setBusca("")}>Limpar busca</Button>}
        />
      ) : (
        <CardGrid>
          {[...visibleByCategoria.entries()].map(([cat, metrics]) => {
            const todosSelecionados = metrics.every((m) => selected.has(m.id));
            const Icon = CATEGORIA_ICONS[cat] || FileBarChart;
            return (
              <Card
                key={cat}
                icon={<Icon size={18} />}
                title={cat}
                headerAction={
                  <button
                    onClick={() => toggleCategoria(metrics)}
                    aria-pressed={todosSelecionados}
                    title={todosSelecionados ? "Desmarcar todas as métricas da categoria" : "Marcar todas as métricas da categoria"}
                    className="flex items-center gap-1.5"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 600, color: todosSelecionados ? "var(--accent)" : "var(--text-dim)" }}
                  >
                    {todosSelecionados ? <CheckSquare size={15} style={{ color: "var(--accent)" }} /> : <Square size={15} style={{ color: "var(--text-dim)" }} />}
                    Todas
                  </button>
                }
              >
                <div className="flex flex-col gap-2">
                  {metrics.map((m) => (
                    <label key={m.id} className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
                      <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} style={{ accentColor: "var(--accent)" }} />
                      {m.label}
                    </label>
                  ))}
                </div>
              </Card>
            );
          })}
        </CardGrid>
      )}

      <Modal open={saveModalOpen} onClose={() => setSaveModalOpen(false)} title="Salvar como modelo" width={440}>
        <div className="px-6 py-5 flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--text-dim)", margin: 0 }}>
            Salva a seleção atual ({selected.size === 1 ? "1 métrica" : `${selected.size} métricas`}) como um modelo compartilhado com a equipe.
          </p>
          <Input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Nome do modelo (ex.: Fechamento mensal)"
          />
          {saveError && (
            <div style={{ fontSize: 12, color: "var(--danger)", background: "var(--danger-bg)", borderRadius: 8, padding: "8px 10px" }}>{saveError}</div>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setSaveModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSalvarModelo} disabled={!presetName.trim() || saving}>
              {saving ? "Salvando…" : "Salvar modelo"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default RHRelatoriosView;
