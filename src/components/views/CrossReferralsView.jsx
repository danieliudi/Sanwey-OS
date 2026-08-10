import React, { useMemo } from "react";
import {
  Network, Sparkles, CheckCircle2, X, ArrowRight,
} from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { StatCard } from "../ui/StatCard";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { CompanyTag } from "../ui/CompanyTag";
import { FitScoreCircle } from "../ui/FitScoreCircle";
import { EmptyState } from "../ui/EmptyState";
import { useUsersById } from "../../hooks/use-users-by-id";
import { formatK } from "../../utils/currency";

export function CrossReferralsView({ crossReferrals, users, onApprove, onReject }) {
  const usersById = useUsersById(users);

  const { overlaps, suggestions, approvedCount } = useMemo(() => {
    const overlaps = [];
    const suggestions = [];
    let approvedCount = 0;
    for (const r of crossReferrals) {
      if (r.status === "approved") approvedCount++;
      if (r.type === "overlap") overlaps.push(r);
      else if (r.type === "suggestion" && r.status === "pending") suggestions.push(r);
    }
    return { overlaps, suggestions, approvedCount };
  }, [crossReferrals]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold leading-tight" style={{ fontSize: 28, color: "var(--text)", letterSpacing: "-0.02em" }}>
          Cross-sell entre empresas do Grupo
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>
          Visibilidade exclusiva do gerente · overlap de clientes · sugestões de cross-sell
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={Network} value={overlaps.length} label="Overlaps ativos"
          sublabel="Clientes em múltiplas empresas" compact />
        <StatCard icon={Sparkles} value={suggestions.length} label="Sugestões pendentes"
          sublabel="Aguardando aprovação" compact />
        <StatCard icon={CheckCircle2} value={approvedCount} label="Aprovadas"
          sublabel="Convertidas em ação" compact />
      </div>

      {overlaps.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Network size={16} color="var(--amber)" />
            <h2 className="font-bold" style={{ fontSize: 16, color: "var(--text)" }}>
              Overlap — mesmo cliente em múltiplas empresas
            </h2>
          </div>
          <div className="space-y-3">
            {overlaps.map(o => (
              <div
                key={o.id}
                className="p-5 rounded-xl border"
                style={{ background: "var(--surface)", borderColor: NEUTRAL.amber + "40", borderLeftWidth: 4 }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold" style={{ fontSize: 16, color: "var(--text)" }}>
                        {o.companyName}
                      </h3>
                      <Badge variant="urgent">Overlap</Badge>
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                      {o.sector} · {o.city}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-[10px] uppercase font-bold tracking-widest"
                      style={{ color: "var(--text-dim)", letterSpacing: "0.15em" }}
                    >
                      Valor consolidado
                    </div>
                    <div className="font-bold text-lg" style={{ color: "var(--text)" }}>
                      {formatK(o.totalValue)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {(Array.isArray(o.leads) ? o.leads : []).map(l => {
                    const u = usersById.get(l.owner);
                    return (
                      <div
                        key={l.id}
                        className="p-3 rounded-xl flex items-center justify-between flex-wrap gap-2"
                        style={{ background: "var(--surface-alt)" }}
                      >
                        <div className="flex items-center gap-3">
                          <CompanyTag companyId={l.companyId} />
                          <span className="text-xs" style={{ color: "var(--text)" }}>
                            Responsável: <strong>{u?.name || "—"}</strong>
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                            · Etapa: {l.stage}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FitScoreCircle score={l.fitScore} size={26} />
                          <span className="font-mono text-xs font-semibold" style={{ color: "var(--text)" }}>
                            {formatK(l.value)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="mt-3 text-xs p-2 rounded-xl"
                  style={{ background: NEUTRAL.amber + "15", color: "var(--amber)" }}
                >
                  ⚠️ Atenção: risco de canibalização. Alinhe com os vendedores antes de avançar.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} color="var(--color-resibag)" />
            <h2 className="font-bold" style={{ fontSize: 16, color: "var(--text)" }}>
              Sugestões de cross-sell
            </h2>
          </div>
          <div className="space-y-3">
            {suggestions.map(s => (
              <div
                key={s.id}
                className="p-5 rounded-xl border"
                style={{ background: "var(--surface)", borderColor: "var(--color-resibag)" + "40", borderLeftWidth: 4 }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold" style={{ fontSize: 16, color: "var(--text)" }}>
                        {s.companyName}
                      </h3>
                      <Badge variant="success">Confiança {s.confidence}%</Badge>
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                      {s.sector} · {s.city}
                    </div>
                  </div>
                </div>
                <div
                  className="mb-3 p-3 rounded-xl flex items-center gap-3"
                  style={{ background: "var(--surface-alt)" }}
                >
                  <CompanyTag companyId={Array.isArray(s.presentIn) ? s.presentIn[0] : null} />
                  <ArrowRight size={14} color="var(--text-dim)" />
                  <CompanyTag companyId={s.suggestedFor} />
                </div>
                <div className="text-sm mb-4" style={{ color: "var(--text)" }}>
                  <strong>Racional:</strong> {s.reason}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    variant="primary"
                    icon={CheckCircle2}
                    accent="var(--color-resibag)"
                    onClick={() => onApprove(s.id)}
                  >
                    Aprovar indicação
                  </Button>
                  <button
                    onClick={() => onReject(s.id)}
                    className="text-xs flex items-center gap-1"
                    style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
                  >
                    <X size={12} />
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {overlaps.length === 0 && suggestions.length === 0 && (
        <EmptyState
          icon={Network}
          title="Nenhuma indicação pendente"
          description="O sistema monitora automaticamente overlaps e potenciais de cross-sell entre as empresas do Grupo."
        />
      )}
    </div>
  );
}

export default CrossReferralsView;
