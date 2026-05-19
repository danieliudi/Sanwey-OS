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
        <h1 className="font-bold leading-tight" style={{ fontSize: 28, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
          Indicações Cruzadas
        </h1>
        <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
          Visibilidade exclusiva do gerente · overlap de clientes · sugestões de cross-sell
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
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
            <Network size={16} color={NEUTRAL.amber} />
            <h2 className="font-bold" style={{ fontSize: 16, color: NEUTRAL.graphite }}>
              Overlap — mesmo cliente em múltiplas empresas
            </h2>
          </div>
          <div className="space-y-3">
            {overlaps.map(o => (
              <div
                key={o.id}
                className="p-5 rounded-xl border"
                style={{ background: "#FFFFFF", borderColor: NEUTRAL.amber + "40", borderLeftWidth: 4 }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold" style={{ fontSize: 16, color: NEUTRAL.graphite }}>
                        {o.companyName}
                      </h3>
                      <Badge variant="urgent">Overlap</Badge>
                    </div>
                    <div className="text-xs" style={{ color: NEUTRAL.slate }}>
                      {o.sector} · {o.city}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-[10px] uppercase font-bold tracking-widest"
                      style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
                    >
                      Valor consolidado
                    </div>
                    <div className="font-bold text-lg" style={{ color: NEUTRAL.graphite }}>
                      {formatK(o.totalValue)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {o.leads.map(l => {
                    const u = usersById.get(l.owner);
                    return (
                      <div
                        key={l.id}
                        className="p-3 rounded-xl flex items-center justify-between flex-wrap gap-2"
                        style={{ background: "#F5F5F3" }}
                      >
                        <div className="flex items-center gap-3">
                          <CompanyTag companyId={l.companyId} />
                          <span className="text-xs" style={{ color: NEUTRAL.graphite }}>
                            Responsável: <strong>{u?.name || "—"}</strong>
                          </span>
                          <span className="text-xs" style={{ color: NEUTRAL.slate }}>
                            · Etapa: {l.stage}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FitScoreCircle score={l.fitScore} size={26} />
                          <span className="font-mono text-xs font-semibold" style={{ color: NEUTRAL.graphite }}>
                            {formatK(l.value)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="mt-3 text-xs p-2 rounded-xl"
                  style={{ background: NEUTRAL.amber + "15", color: NEUTRAL.amber }}
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
            <Sparkles size={16} color={NEUTRAL.success} />
            <h2 className="font-bold" style={{ fontSize: 16, color: NEUTRAL.graphite }}>
              Sugestões de cross-sell
            </h2>
          </div>
          <div className="space-y-3">
            {suggestions.map(s => (
              <div
                key={s.id}
                className="p-5 rounded-xl border"
                style={{ background: "#FFFFFF", borderColor: NEUTRAL.success + "40", borderLeftWidth: 4 }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold" style={{ fontSize: 16, color: NEUTRAL.graphite }}>
                        {s.companyName}
                      </h3>
                      <Badge variant="success">Confiança {s.confidence}%</Badge>
                    </div>
                    <div className="text-xs" style={{ color: NEUTRAL.slate }}>
                      {s.sector} · {s.city}
                    </div>
                  </div>
                </div>
                <div
                  className="mb-3 p-3 rounded-xl flex items-center gap-3"
                  style={{ background: "#F5F5F3" }}
                >
                  <CompanyTag companyId={s.presentIn[0]} />
                  <ArrowRight size={14} color={NEUTRAL.slate} />
                  <CompanyTag companyId={s.suggestedFor} />
                </div>
                <div className="text-sm mb-4" style={{ color: NEUTRAL.graphite }}>
                  <strong>Racional:</strong> {s.reason}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="primary"
                    icon={CheckCircle2}
                    accent={NEUTRAL.success}
                    onClick={() => onApprove(s.id)}
                  >
                    Aprovar indicação
                  </Button>
                  <Button variant="ghost" icon={X} onClick={() => onReject(s.id)}>
                    Rejeitar
                  </Button>
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
