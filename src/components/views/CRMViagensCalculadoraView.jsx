import React, { useMemo, useState } from "react";
import { Car, Plane, Bike, Check } from "lucide-react";
import { fmtMoney } from "../../utils/viagens";

// Calculadora de custo de viagem — compara carro próprio, avião e Uber/táxi
// pro mesmo trajeto. Puramente client-side (sem persistência): o objetivo é
// ajudar a decidir o modal antes de planejar a visita, não registrar nada.
// Parâmetros de R$/km são estimativas editáveis, não tarifas oficiais.

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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "var(--accent)", color: "#FFF" }}>
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

export function CRMViagensCalculadoraView() {
  const [distancia, setDistancia] = useState("");
  const [idaEVolta, setIdaEVolta] = useState(true);
  const [rkmCarro, setRkmCarro] = useState("1.00");
  const [rkmUber, setRkmUber] = useState("2.50");
  const [passagemAerea, setPassagemAerea] = useState("");
  const [distanciaAeroporto, setDistanciaAeroporto] = useState("");

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
      <div>
        <h2 className="font-semibold" style={{ fontSize: 16, color: "var(--text)" }}>Calculadora de custo de viagem</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
          Compare carro próprio, avião e Uber/táxi pro mesmo trajeto antes de planejar a visita.
        </p>
      </div>

      <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="grid md:grid-cols-2 gap-4">
          <NumberField label="Distância até o destino (km, só ida)" value={distancia} onChange={setDistancia} placeholder="Ex: 120" />
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
