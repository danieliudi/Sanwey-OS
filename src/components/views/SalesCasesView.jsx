import React, { useMemo, useState } from "react";
import { Plus, ClipboardCheck, TrendingUp, TrendingDown, Clock3 } from "lucide-react";
import { useSalesCases } from "../../hooks/use-sales-cases";
import { CasoProspeccaoVozPanel } from "../client/CasoProspeccaoVozPanel";
import { FilterBar } from "../shared/FilterBar";
import { StatCard } from "../ui/StatCard";
import { EmptyState } from "../ui/EmptyState";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { COMPANIES } from "../../constants/companies";
import { formatDateBR } from "../../utils/date";

// Casos Comerciais — lista de revisão dos casos de prospecção capturados
// por voz/texto (ver CasoProspeccaoVozPanel.jsx). Padrão A do CLAUDE.md
// regra 6 ("Tabela com filtro", referência RHFuncionariosView.jsx) — busca +
// filtros de FilterBar, StatCard de resumo no topo, clique na linha abre
// detalhe. Botão solto do CLAUDE.md ("caso ainda não seja cliente formal")
// vive aqui: "+ Registrar caso" abre o mesmo painel de captura sem client_id.

const RESULTADO_META = {
  ganhamos:  { label: "Ganhamos",     badge: "success" },
  perdemos:  { label: "Perdemos",     badge: "critical" },
  andamento: { label: "Em andamento", badge: "gold" },
};

const FRENTE_IDS = Object.keys(COMPANIES).filter(id => id !== "all");

function ResultadoBadge({ value }) {
  const meta = RESULTADO_META[value];
  return meta ? <Badge variant={meta.badge}>{meta.label}</Badge> : <Badge variant="neutral">—</Badge>;
}

const detailLabelStyle = { fontSize: 9, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "var(--text-dim)" };

export function SalesCasesView({ currentUser }) {
  const { cases, loading, addCase } = useSalesCases();
  const [showCapture, setShowCapture] = useState(false);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [resultadoFilter, setResultadoFilter] = useState("");
  const [frenteFilter, setFrenteFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter(c => {
      if (q && !`${c.cliente_nome} ${c.setor || ""}`.toLowerCase().includes(q)) return false;
      if (resultadoFilter && c.resultado !== resultadoFilter) return false;
      if (frenteFilter && c.frente !== frenteFilter) return false;
      return true;
    });
  }, [cases, search, resultadoFilter, frenteFilter]);

  const stats = useMemo(() => ({
    total: cases.length,
    ganhamos: cases.filter(c => c.resultado === "ganhamos").length,
    perdemos: cases.filter(c => c.resultado === "perdemos").length,
    andamento: cases.filter(c => c.resultado === "andamento").length,
  }), [cases]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold" style={{ fontSize: 20, color: "var(--text)" }}>Casos Comerciais</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            Casos reais de prospecção — munição pro playbook de vendas.
          </p>
        </div>
        <button onClick={() => setShowCapture(true)} data-tour="sales-cases-registrar"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold"
                style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <Plus size={14} /> Registrar caso
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={ClipboardCheck} value={stats.total} label="Casos registrados" />
        <StatCard icon={TrendingUp} value={stats.ganhamos} label="Ganhamos" />
        <StatCard icon={TrendingDown} value={stats.perdemos} label="Perdemos" />
        <StatCard icon={Clock3} value={stats.andamento} label="Em andamento" />
      </div>

      <FilterBar
        search={{ value: search, onChange: e => setSearch(e.target.value), placeholder: "Buscar por cliente ou setor…" }}
        filters={[
          {
            id: "resultado", label: "Resultado", value: resultadoFilter, onChange: e => setResultadoFilter(e.target.value),
            options: [{ value: "", label: "Todos os resultados" }, ...Object.entries(RESULTADO_META).map(([value, m]) => ({ value, label: m.label }))],
          },
          {
            id: "frente", label: "Frente", value: frenteFilter, onChange: e => setFrenteFilter(e.target.value),
            options: [{ value: "", label: "Todas as frentes" }, ...FRENTE_IDS.map(id => ({ value: id, label: COMPANIES[id].short }))],
          },
        ]}
      />

      {loading ? (
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>Carregando…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={cases.length === 0 ? "Nenhum caso registrado ainda" : "Nenhum resultado pra estes filtros"}
          description={cases.length === 0
            ? "Grave um áudio contando uma visita ou negociação — a IA organiza o rascunho pra você conferir antes de salvar."
            : "Tente ajustar a busca ou os filtros."}
          action={cases.length === 0 ? (
            <button onClick={() => setShowCapture(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold"
                    style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              <Plus size={14} /> Registrar caso
            </button>
          ) : undefined}
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                {["Cliente", "Setor", "Resultado", "Frente", "Registrado em"].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-semibold" style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => setDetail(c)}
                  className="cursor-pointer"
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td className="px-3 py-2 font-semibold" style={{ color: "var(--text)" }}>{c.cliente_nome}</td>
                  <td className="px-3 py-2" style={{ color: "var(--text-dim)" }}>{c.setor || "—"}</td>
                  <td className="px-3 py-2"><ResultadoBadge value={c.resultado} /></td>
                  <td className="px-3 py-2" style={{ color: "var(--text-dim)" }}>{COMPANIES[c.frente]?.short || c.frente}</td>
                  <td className="px-3 py-2" style={{ color: "var(--text-dim)" }}>{formatDateBR(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCapture && (
        <CasoProspeccaoVozPanel
          currentUser={currentUser}
          onClose={() => setShowCapture(false)}
          onConfirm={addCase}
        />
      )}

      {detail && (
        <Modal open onClose={() => setDetail(null)} title={detail.cliente_nome} width={520}>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <ResultadoBadge value={detail.resultado} />
              <Badge variant="neutral">{COMPANIES[detail.frente]?.short || detail.frente}</Badge>
              {detail.setor && <Badge variant="neutral">{detail.setor}</Badge>}
              <span className="text-xs ml-auto" style={{ color: "var(--text-faint)" }}>{formatDateBR(detail.created_at)}</span>
            </div>
            {[["Situação", detail.situacao], ["Sinais", detail.sinais], ["Lição", detail.licao]]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <p className="mb-1" style={detailLabelStyle}>{label}</p>
                  <p className="text-sm m-0" style={{ color: "var(--text)", lineHeight: 1.6 }}>{value}</p>
                </div>
              ))}
            {detail.raw_transcript && (
              <details>
                <summary className="text-[11px] cursor-pointer" style={{ color: "var(--accent)" }}>Ver transcrição completa</summary>
                <p className="text-[11.5px] mt-2 mb-0 whitespace-pre-wrap" style={{ color: "var(--text-dim)", lineHeight: 1.6 }}>{detail.raw_transcript}</p>
              </details>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default SalesCasesView;
