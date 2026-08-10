import React, { useEffect, useMemo, useRef, useState } from "react";
import { Car, Plane, Bike, Check, MapPin, Plus, X, ChevronUp, ChevronDown, Loader2, Navigation, AlertCircle } from "lucide-react";
import { fmtMoney } from "../../utils/viagens";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { usePlacesAutocomplete } from "../../hooks/use-places-autocomplete";
import { AppToast } from "../shared/AppToast";

// Calculadora de custo de viagem — compara carro próprio, avião e Uber/táxi
// pro mesmo trajeto. Puramente client-side (sem persistência): o objetivo é
// ajudar a decidir o modal antes de planejar a visita, não registrar nada.
// Parâmetros de R$/km são estimativas editáveis, não tarifas oficiais.
//
// Distância: a partir de 08/2026 é calculada automaticamente a partir de uma
// sequência de paradas (autocomplete Google Places, mesmo hook usado em
// CRMViagensPlanejamentoView) via edge function distance-matrix — mas o
// campo de km continua editável na mão como fallback gracioso, caso a
// chamada falhe ou o usuário prefira digitar (spec aprovada com o Daniel).

const LABEL_ST = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
const INPUT_ST = { borderColor: "var(--border)", color: "var(--text)", background: "var(--surface-alt)", fontSize: 13 };
const INPUT_CLS = "w-full text-sm rounded-xl border px-3 py-2 outline-none";

function NumberField({ label, value, onChange, placeholder, hint }) {
  return (
    <div>
      <label style={LABEL_ST}>{label}</label>
      <input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT_CLS}
        style={INPUT_ST}
      />
      {hint && <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>{hint}</p>}
    </div>
  );
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function ModalCard({ icon: Icon, title, total, breakdown, cheapest, disabled }) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{
        background: "var(--surface)",
        borderColor: cheapest ? "var(--accent)" : "var(--border)",
        boxShadow: cheapest ? "0 0 0 2px var(--accent)" : "var(--shadow-card)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color: "var(--text-dim)" }} />
          <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{title}</span>
        </div>
        {cheapest && !disabled && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            <Check size={10} /> Mais econômico
          </span>
        )}
      </div>
      <div className="font-bold" style={{ fontSize: 22, color: "var(--text)" }}>
        {disabled ? "—" : fmtMoney(total)}
      </div>
      <div className="space-y-0.5">
        {breakdown.map((b, i) => (
          <div key={i} className="flex items-center justify-between text-xs" style={{ color: "var(--text-dim)" }}>
            <span>{b.label}</span>
            <span>{fmtMoney(b.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Paradas (lista ordenada com autocomplete) ──────────────────────────────

let stopIdSeq = 0;
function newStop(description = "") {
  stopIdSeq += 1;
  return { id: stopIdSeq, description, placeId: null };
}

function StopAutocompleteInput({ stop, placeholder, onChange, autoFocus }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { suggestions, search, clear } = usePlacesAutocomplete();

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input
        type="text"
        autoFocus={autoFocus}
        value={stop.description}
        onChange={(e) => {
          const v = e.target.value;
          // Digitar depois de já ter selecionado uma sugestão invalida o
          // placeId confirmado — volta a ser texto livre até escolher de
          // novo (mesmo espírito do campo Destino em Planejamento).
          onChange({ description: v, placeId: null });
          setShowSuggestions(true);
          search(v);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder={placeholder}
        className={INPUT_CLS}
        style={INPUT_ST}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-pop)", overflow: "hidden", zIndex: 20 }}>
          {suggestions.map((s) => (
            <button
              key={s.placeId || s.description}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ description: s.description, placeId: s.placeId });
                clear();
                setShowSuggestions(false);
              }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "none", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.mainText}</div>
              {s.secondaryText && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{s.secondaryText}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StopRow({ stop, index, total, onChange, onMoveUp, onMoveDown, onRemove, canRemove }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="shrink-0 flex items-center justify-center font-bold"
        style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent-tint)", color: "var(--accent)", fontSize: 11 }}
      >
        {index + 1}
      </span>
      <StopAutocompleteInput
        stop={stop}
        placeholder={index === 0 ? "Ponto de partida" : index === total - 1 ? "Destino final" : `Parada ${index + 1}`}
        onChange={onChange}
        autoFocus={false}
      />
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          title="Mover pra cima"
          onClick={onMoveUp}
          disabled={index === 0}
          className="flex items-center justify-center rounded-lg border"
          style={{ width: 28, height: 28, borderColor: "var(--border)", background: "var(--surface)", color: index === 0 ? "var(--text-faint)" : "var(--text-dim)", cursor: index === 0 ? "not-allowed" : "pointer", opacity: index === 0 ? 0.5 : 1 }}
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          title="Mover pra baixo"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="flex items-center justify-center rounded-lg border"
          style={{ width: 28, height: 28, borderColor: "var(--border)", background: "var(--surface)", color: index === total - 1 ? "var(--text-faint)" : "var(--text-dim)", cursor: index === total - 1 ? "not-allowed" : "pointer", opacity: index === total - 1 ? 0.5 : 1 }}
        >
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          title={canRemove ? "Remover parada" : "Mínimo de 2 paradas"}
          onClick={onRemove}
          disabled={!canRemove}
          className="flex items-center justify-center rounded-lg border"
          style={{ width: 28, height: 28, borderColor: "var(--border)", background: "var(--surface)", color: !canRemove ? "var(--text-faint)" : "var(--danger)", cursor: !canRemove ? "not-allowed" : "pointer", opacity: !canRemove ? 0.5 : 1 }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export function CRMViagensCalculadoraView() {
  const [stops, setStops] = useState(() => [newStop(), newStop()]);
  const [distancia, setDistancia] = useState("");
  const [idaEVolta, setIdaEVolta] = useState(true);
  const [rkmCarro, setRkmCarro] = useState("1.00");
  const [rkmUber, setRkmUber] = useState("2.50");
  const [passagemAerea, setPassagemAerea] = useState("");
  const [distanciaAeroporto, setDistanciaAeroporto] = useState("");

  const [calc, setCalc] = useState({ loading: false, error: null, totalKm: null });
  const requestIdRef = useRef(0);

  const updateStop = (id, patch) => {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const moveStop = (index, dir) => {
    setStops((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };
  const removeStop = (id) => {
    setStops((prev) => (prev.length <= 2 ? prev : prev.filter((s) => s.id !== id)));
  };
  const addStop = () => setStops((prev) => [...prev, newStop()]);

  // Chave estável que só muda quando a sequência de placeIds muda de fato —
  // evita recalcular a cada tecla digitada (só dispara em seleções reais).
  const allFilled = stops.length >= 2 && stops.every((s) => s.placeId);
  const placeIdsKey = allFilled ? stops.map((s) => s.placeId).join("|") : null;

  useEffect(() => {
    if (!placeIdsKey || !isSupabaseConfigured) {
      setCalc((prev) => (prev.loading || prev.error || prev.totalKm != null ? { loading: false, error: null, totalKm: null } : prev));
      return;
    }
    const myRequestId = ++requestIdRef.current;
    setCalc({ loading: true, error: null, totalKm: null });
    const placeIds = placeIdsKey.split("|");
    supabase.functions.invoke("distance-matrix", { body: { placeIds } })
      .then(({ data, error }) => {
        if (myRequestId !== requestIdRef.current) return; // resposta obsoleta
        if (error || data?.error) {
          setCalc({ loading: false, error: data?.error || error?.message || "Não foi possível calcular a distância.", totalKm: null });
          return;
        }
        setCalc({ loading: false, error: null, totalKm: data?.totalKm ?? null });
        if (data?.totalKm != null) setDistancia(String(data.totalKm));
      })
      .catch((err) => {
        if (myRequestId !== requestIdRef.current) return;
        setCalc({ loading: false, error: err?.message || "Não foi possível calcular a distância.", totalKm: null });
      });
  }, [placeIdsKey]);

  const result = useMemo(() => {
    const mult = idaEVolta ? 2 : 1;
    const kmTotal = num(distancia) * mult;
    const kmAeroportoTotal = num(distanciaAeroporto) * mult;

    const carroTotal = kmTotal * num(rkmCarro);
    const uberTotal = kmTotal * num(rkmUber);
    const temAviao = num(passagemAerea) > 0;
    const aviaoTraslado = kmAeroportoTotal * num(rkmUber);
    const aviaoTotal = num(passagemAerea) + aviaoTraslado;

    const candidatos = [
      { id: "carro", total: carroTotal },
      { id: "uber", total: uberTotal },
      ...(temAviao ? [{ id: "aviao", total: aviaoTotal }] : []),
    ];
    const menor = candidatos.reduce((min, c) => (c.total < min.total ? c : min), candidatos[0]);

    return {
      kmTotal, carroTotal, uberTotal, aviaoTotal, aviaoTraslado, temAviao,
      cheapest: kmTotal > 0 ? menor.id : null,
    };
  }, [distancia, idaEVolta, rkmCarro, rkmUber, passagemAerea, distanciaAeroporto]);

  return (
    <div className="flex flex-col gap-5">
      {calc.error && (
        <AppToast variant="danger" position="top-right" icon={AlertCircle} onDismiss={() => setCalc((prev) => ({ ...prev, error: null }))}>
          {calc.error} Você pode editar a distância manualmente abaixo.
        </AppToast>
      )}

      <div>
        <h2 className="font-semibold" style={{ fontSize: 16, color: "var(--text)" }}>Calculadora de custo de viagem</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
          Compare carro próprio, avião e Uber/táxi pro mesmo trajeto antes de planejar a visita.
        </p>
      </div>

      <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <label style={LABEL_ST}>Paradas do trajeto (ordem importa)</label>
        <div className="flex flex-col gap-2">
          {stops.map((stop, i) => (
            <StopRow
              key={stop.id}
              stop={stop}
              index={i}
              total={stops.length}
              onChange={(patch) => updateStop(stop.id, patch)}
              onMoveUp={() => moveStop(i, -1)}
              onMoveDown={() => moveStop(i, 1)}
              onRemove={() => removeStop(stop.id)}
              canRemove={stops.length > 2}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addStop}
          className="inline-flex items-center gap-1.5 text-xs font-semibold mt-2.5"
          style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <Plus size={13} /> Adicionar parada
        </button>

        <div className="mt-2.5" style={{ minHeight: 18 }}>
          {calc.loading && (
            <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-dim)" }}>
              <Loader2 size={12} className="animate-spin" /> Calculando distância entre as paradas…
            </span>
          )}
          {!calc.loading && calc.totalKm != null && !calc.error && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--accent)" }}>
              <Navigation size={12} /> Distância total calculada: {calc.totalKm.toLocaleString("pt-BR")} km
            </span>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-3">
          <NumberField
            label="Distância total (km, só ida)"
            value={distancia}
            onChange={setDistancia}
            placeholder="Ex: 120"
            hint={allFilled ? "Preenchido automaticamente pelas paradas acima — edite se preferir." : "Preenchido automaticamente quando todas as paradas tiverem endereço selecionado, ou digite na mão."}
          />
          <div>
            <label style={LABEL_ST}>Viagem</label>
            <label className="flex items-center gap-2 text-sm mt-1" style={{ color: "var(--text)" }}>
              <input type="checkbox" checked={idaEVolta} onChange={(e) => setIdaEVolta(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
              Ida e volta
            </label>
          </div>
          <NumberField label="R$/km — carro próprio" value={rkmCarro} onChange={setRkmCarro} hint="Combustível + desgaste. Ajuste conforme seu veículo." />
          <NumberField label="R$/km — Uber/táxi" value={rkmUber} onChange={setRkmUber} hint="Estimativa de corrida intermunicipal." />
          <NumberField label="Passagem aérea estimada (ida e volta, R$)" value={passagemAerea} onChange={setPassagemAerea} placeholder="Deixe em branco pra não comparar avião" />
          <NumberField label="Distância até o aeroporto (km, só ida)" value={distanciaAeroporto} onChange={setDistanciaAeroporto} hint="Usado pra estimar o Uber/táxi de ida ao aeroporto." />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <ModalCard
          icon={Car}
          title="Carro próprio"
          total={result.carroTotal}
          cheapest={result.cheapest === "carro"}
          disabled={result.kmTotal === 0}
          breakdown={[{ label: `${result.kmTotal.toFixed(0)} km × ${fmtMoney(num(rkmCarro))}`, value: result.carroTotal }]}
        />
        <ModalCard
          icon={Bike}
          title="Uber / táxi"
          total={result.uberTotal}
          cheapest={result.cheapest === "uber"}
          disabled={result.kmTotal === 0}
          breakdown={[{ label: `${result.kmTotal.toFixed(0)} km × ${fmtMoney(num(rkmUber))}`, value: result.uberTotal }]}
        />
        <ModalCard
          icon={Plane}
          title="Avião"
          total={result.aviaoTotal}
          cheapest={result.cheapest === "aviao"}
          disabled={!result.temAviao}
          breakdown={[
            { label: "Passagem", value: num(passagemAerea) },
            { label: "Traslado (Uber/táxi)", value: result.aviaoTraslado },
          ]}
        />
      </div>
    </div>
  );
}

export default CRMViagensCalculadoraView;
