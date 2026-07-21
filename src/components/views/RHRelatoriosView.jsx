import React, { useMemo, useState } from "react";
import { FileBarChart, Download, CheckSquare, Square } from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useRHColaboradores } from "../../hooks/use-rh-colaboradores";
import { useRHRecrutamento } from "../../hooks/use-rh-recrutamento";
import { useRHFeriasRequests } from "../../hooks/use-rh-ferias-requests";
import { useRHFeedback } from "../../hooks/use-rh-feedback";
import { useRHTreinamentos } from "../../hooks/use-rh-treinamentos";
import { useRHMovimentacoes } from "../../hooks/use-rh-movimentacoes";
import { useRHSuppliers } from "../../hooks/use-rh-suppliers";
import { RH_REPORT_METRICS, RH_REPORT_CATEGORIAS, buildRelatorioCSV } from "../../utils/rh-report-metrics";
import { triggerDownload } from "../../utils/export-csv";
import { EmptyState } from "../ui/EmptyState";

// Relatório configurável de RH (reunião com o RH, 20/07): "todo tipo de dado
// coletável possa ser exportado... por exemplo headcount, turnover e tempo
// de contratação. Ou só um deles, ou mais do que isso." Checklist de
// métricas agrupadas por categoria — a pessoa escolhe o que quer e baixa um
// único CSV combinado (uma seção por métrica).
export function RHRelatoriosView({ currentUser }) {
  const { colaboradores, loading: loadingColaboradores } = useRHColaboradores({ userId: currentUser?.id });
  const { vagas, aplicacoesRaw, loading: loadingRecrutamento } = useRHRecrutamento({ userId: currentUser?.id });
  const { requests: ferias, loading: loadingFerias } = useRHFeriasRequests({});
  const { feedbacks: avaliacoes, loading: loadingAvaliacoes } = useRHFeedback({ userId: currentUser?.id });
  const { treinamentos, atribuicoes, loading: loadingTreinamentos } = useRHTreinamentos({ userId: currentUser?.id });
  const { movimentacoes, loading: loadingMovimentacoes } = useRHMovimentacoes({ userId: currentUser?.id });
  const { contratos, loading: loadingFornecedores } = useRHSuppliers({ userId: currentUser?.id });

  const [selected, setSelected] = useState(() => new Set());

  const loading = loadingColaboradores || loadingRecrutamento || loadingFerias || loadingAvaliacoes || loadingTreinamentos || loadingMovimentacoes || loadingFornecedores;

  const metricsByCategoria = useMemo(() => {
    const map = new Map();
    for (const cat of RH_REPORT_CATEGORIAS) map.set(cat, []);
    for (const m of RH_REPORT_METRICS) map.get(m.categoria).push(m);
    return map;
  }, []);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleCategoria = (cat) => {
    const ids = metricsByCategoria.get(cat).map((m) => m.id);
    const todosSelecionados = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (todosSelecionados ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const handleExportar = () => {
    const datasets = { colaboradores, vagas, aplicacoes: aplicacoesRaw, ferias, avaliacoes, treinamentos, atribuicoes, movimentacoes, contratos };
    const csv = buildRelatorioCSV([...selected], datasets);
    const today = new Date().toISOString().slice(0, 10);
    triggerDownload(`sanwey-relatorio-rh-${today}.csv`, csv);
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
        <button
          onClick={handleExportar}
          disabled={selected.size === 0 || loading}
          className="flex items-center gap-1.5 font-semibold"
          style={{ background: selected.size === 0 ? "var(--surface-alt)" : "var(--accent)", color: selected.size === 0 ? "var(--text-dim)" : "#FFF", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 13, cursor: selected.size === 0 ? "default" : "pointer" }}
        >
          <Download size={14} /> Exportar CSV{selected.size > 0 ? ` (${selected.size})` : ""}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando dados…</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {RH_REPORT_CATEGORIAS.map((cat) => {
            const metrics = metricsByCategoria.get(cat);
            const todosSelecionados = metrics.every((m) => selected.has(m.id));
            return (
              <div key={cat} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface)" }}>
                <button
                  onClick={() => toggleCategoria(cat)}
                  className="flex items-center gap-2 w-full text-left"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 10 }}
                >
                  {todosSelecionados ? <CheckSquare size={15} style={{ color: "var(--accent)" }} /> : <Square size={15} style={{ color: "var(--text-dim)" }} />}
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{cat}</span>
                </button>
                <div className="flex flex-col gap-2">
                  {metrics.map((m) => (
                    <label key={m.id} className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
                      <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RHRelatoriosView;
