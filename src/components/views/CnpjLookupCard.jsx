import React, { useCallback, useMemo, useState } from "react";
import {
  Building2, Search, Plus, AlertTriangle, MapPin, Briefcase, Phone, Mail,
  CheckCircle2, Loader2,
} from "lucide-react";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { CompanyTag } from "../ui/CompanyTag";
import { useCnpjLookup } from "../../hooks/use-cnpj-lookup";
import { formatBRL } from "../../utils/currency";

function stripMask(cnpj) {
  return (cnpj || "").replace(/\D/g, "");
}

function formatMask(cnpj) {
  const d = stripMask(cnpj);
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function CnpjLookupCard({ onAddLead, accessibleCompanies }) {
  const { loading, error, data, lookup, reset } = useCnpjLookup();
  const [cnpj, setCnpj] = useState("");
  const [targetCompany, setTargetCompany] = useState(null);
  const [added, setAdded] = useState(false);

  const availableCompanies = useMemo(() => {
    const ids = (accessibleCompanies || COMPANY_IDS).filter(id => id !== "all");
    return ids.length > 0 ? ids : COMPANY_IDS;
  }, [accessibleCompanies]);

  const handleSearch = useCallback(() => {
    const digits = stripMask(cnpj);
    if (digits.length !== 14) return;
    setAdded(false);
    lookup(digits);
  }, [cnpj, lookup]);

  const handleKey = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleAddAsLead = useCallback(() => {
    if (!data || !targetCompany) return;
    const now = new Date().toISOString();
    const newLead = {
      id: `lead_${Date.now()}`,
      companyId: targetCompany,
      cnpj: data.cnpj,
      company: data.company || data.razaoSocial,
      razaoSocial: data.razaoSocial,
      sector: data.sector,
      cnae: data.cnae,
      size: data.size || "PME",
      city: data.city,
      state: data.state,
      address: data.address,
      capitalSocial: data.capitalSocial,
      contactEmail: data.email,
      phone: data.telefone,
      situacao: data.situacao,
      trigger: "Prospecção ativa",
      triggerLabel: "Entrada manual via Receita Federal",
      evidence: `Empresa identificada pelo time via busca de CNPJ — CNAE ${data.cnae} ${data.cnaeDesc}`.trim(),
      fitScore: 60,
      quantity: 0,
      value: 0,
      probability: 0.15,
      closeDate: new Date(Date.now() + 45 * 86400000).toISOString(),
      dateDetected: now,
      daysAgo: 0,
      stage: "prospeccao",
      status: "prospeccao",
      owner: null,
      urgency: "indefinido",
      decisionMaker: { name: "—", role: "—" },
      starred: false,
      notes: [],
      createdAt: now,
      lastActivity: now,
      stageChangedAt: now,
    };
    onAddLead?.(newLead);
    setAdded(true);
  }, [data, targetCompany, onAddLead]);

  const handleReset = () => {
    reset();
    setCnpj("");
    setTargetCompany(null);
    setAdded(false);
  };

  return (
    <div
      className="p-5 rounded-xl border"
      style={{ background: "#FFFFFF", borderColor: "#EFEFEF" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: NEUTRAL.graphite + "10" }}
        >
          <Building2 size={16} color={NEUTRAL.graphite} />
        </div>
        <div>
          <h2 className="font-bold" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
            Buscar empresa por CNPJ
          </h2>
          <p className="text-xs" style={{ color: NEUTRAL.slate }}>
            Puxa dados oficiais da Receita Federal (BrasilAPI) e adiciona como lead
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <Input
            value={cnpj}
            onChange={e => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            icon={Search}
          />
        </div>
        <Button
          variant="primary"
          size="md"
          icon={loading ? Loader2 : Search}
          onClick={handleSearch}
          disabled={loading || stripMask(cnpj).length !== 14}
        >
          {loading ? "Buscando…" : "Buscar"}
        </Button>
        {(data || error) && !loading && (
          <Button variant="ghost" size="md" onClick={handleReset}>
            Limpar
          </Button>
        )}
      </div>
      <div className="text-[10px] mb-3" style={{ color: NEUTRAL.slate }}
        onKeyDown={handleKey}
      >
        Pressione Enter para buscar.
      </div>

      {error && (
        <div
          className="p-3 rounded-xl flex items-start gap-2 text-xs"
          style={{ background: "#FEF2F2", color: "#B91C1C" }}
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>{error.message || String(error)}</div>
        </div>
      )}

      {data && (
        <div className="space-y-3">
          <div
            className="p-4 rounded-xl border"
            style={{ background: NEUTRAL.warmWhite, borderColor: "#EFEFEF" }}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base" style={{ color: NEUTRAL.graphite }}>
                  {data.company || data.razaoSocial || "—"}
                </div>
                {data.company && data.razaoSocial && data.company !== data.razaoSocial && (
                  <div className="text-xs" style={{ color: NEUTRAL.slate }}>{data.razaoSocial}</div>
                )}
                <div className="text-xs font-mono mt-0.5" style={{ color: NEUTRAL.slate }}>
                  {formatMask(data.cnpj)}
                </div>
              </div>
              {data.situacao && (
                <div
                  className="px-2 py-0.5 rounded-xl text-[10px] uppercase font-semibold"
                  style={{
                    background: data.situacao.toUpperCase() === "ATIVA" ? "#E8F2EC" : "#FEF2F2",
                    color: data.situacao.toUpperCase() === "ATIVA" ? NEUTRAL.success : "#B91C1C",
                  }}
                >
                  {data.situacao}
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-2 text-xs" style={{ color: NEUTRAL.graphite }}>
              <div className="flex items-start gap-1.5">
                <Briefcase size={12} className="mt-0.5 shrink-0" color={NEUTRAL.slate} />
                <span>
                  <strong>CNAE {data.cnae}</strong> — {data.cnaeDesc || "—"}
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <MapPin size={12} className="mt-0.5 shrink-0" color={NEUTRAL.slate} />
                <span>{data.city || "—"}</span>
              </div>
              {data.porte && (
                <div className="flex items-start gap-1.5">
                  <Building2 size={12} className="mt-0.5 shrink-0" color={NEUTRAL.slate} />
                  <span>{data.porte} · {data.size}</span>
                </div>
              )}
              {data.capitalSocial > 0 && (
                <div className="flex items-start gap-1.5">
                  <span className="text-[10px]" style={{ color: NEUTRAL.slate }}>Capital</span>
                  <span>{formatBRL(data.capitalSocial)}</span>
                </div>
              )}
              {data.telefone && (
                <div className="flex items-start gap-1.5">
                  <Phone size={12} className="mt-0.5 shrink-0" color={NEUTRAL.slate} />
                  <span>{data.telefone}</span>
                </div>
              )}
              {data.email && (
                <div className="flex items-start gap-1.5">
                  <Mail size={12} className="mt-0.5 shrink-0" color={NEUTRAL.slate} />
                  <span>{data.email}</span>
                </div>
              )}
              {data.address && (
                <div className="flex items-start gap-1.5 md:col-span-2">
                  <MapPin size={12} className="mt-0.5 shrink-0" color={NEUTRAL.slate} />
                  <span style={{ color: NEUTRAL.slate }}>{data.address}</span>
                </div>
              )}
            </div>

            {data.cached && (
              <div className="text-[10px] mt-2" style={{ color: NEUTRAL.slate }}>
                cache · atualizado em {new Date(data.fetchedAt).toLocaleString("pt-BR")}
              </div>
            )}
          </div>

          {added ? (
            <div
              className="p-3 rounded-xl flex items-center gap-2 text-xs"
              style={{ background: "#E8F2EC", color: NEUTRAL.success }}
            >
              <CheckCircle2 size={14} />
              Lead adicionado. Vá pro final da lista ou filtre pelo CNPJ.
            </div>
          ) : (
            <div>
              <div
                className="text-[10px] uppercase font-bold tracking-widest mb-2"
                style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
              >
                Adicionar como lead em qual empresa do grupo?
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {availableCompanies.map(id => {
                    const c = COMPANIES[id];
                    const active = targetCompany === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTargetCompany(id)}
                        className="px-2.5 py-1.5 text-xs rounded-xl border transition-all flex items-center gap-1.5"
                        style={{
                          background: active ? c.light : "#FFFFFF",
                          borderColor: active ? c.primary : "#EFEFEF",
                          color: active ? c.dark : NEUTRAL.graphite,
                        }}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ background: c.primary }} />
                        <span className="font-semibold">{c.short || c.name}</span>
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={handleAddAsLead}
                  disabled={!targetCompany}
                >
                  Adicionar lead
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CnpjLookupCard;
