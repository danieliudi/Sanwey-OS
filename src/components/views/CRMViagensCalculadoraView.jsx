import React, { useEffect, useMemo, useRef, useState } from "react";
import { Car, Plane, Bike, Check, Plus, X, ChevronUp, ChevronDown, ChevronRight, Loader2, Navigation, AlertCircle, Minus } from "lucide-react";
import { fmtMoney } from "../../utils/viagens";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { usePlacesAutocomplete } from "../../hooks/use-places-autocomplete";
import { AppToast } from "../shared/AppToast";

// Calculadora de custo de viagem — compara carro próprio, Uber/táxi e avião
// pro mesmo trajeto. Puramente client-side (sem persistência): o objetivo é
// ajudar a decidir o modal antes de planejar a visita, não registrar nada.
// Parâmetros de R$/km e diárias são estimativas editáveis, não tarifas
// oficiais — e não existe política de reembolso na Sanwey (confirmado com o
// Daniel 01/09/2026), então as faixas abaixo são descritivas, não normativas.
//
// Distância: a partir de 08/2026 é calculada automaticamente a partir de uma
// sequência de paradas (autocomplete Google Places, mesmo hook usado em
// CRMViagensPlanejamentoView) via edge function distance-matrix — mas o
// campo de km continua editável na mão como fallback gracioso, caso a
// chamada falhe ou o usuário prefira digitar (spec aprovada com o Daniel).
//
// Rodada de 01/09/2026 (mockup aprovado pelo Daniel):
//  * Hospedagem entra na conta. Mesma diária pros dois cenários — o que muda
//    é a quantidade de noites, e de avião é sempre menos (regra do Daniel).
//  * O aluguel de carro NÃO é uma quarta opção: é o transporte NO DESTINO de
//    quem foi de avião (voa até Uberlândia, aluga pra visitar a mineradora).
//    Por isso o combustível dele usa os km LOCAIS, nunca os km da estrada.
//  * Lavagem na devolução ficou de fora por decisão do Daniel: carro próprio
//    também lavaria, então não diferencia nada — só somaria um campo.
//  * Pedágio idem: o R$/km do carro próprio já é média que absorve.
//  * No destino, aluguel e Uber são calculados JUNTOS e o mais barato entra
//    na conta — a comparação não custa campo nenhum, já que os km locais e as
//    duas tarifas já estão na tela.

const LABEL_ST = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
const INPUT_ST = { borderColor: "var(--border)", color: "var(--text)", background: "var(--surface-alt)", fontSize: 13 };
const INPUT_CLS = "w-full text-sm rounded-xl border px-3 py-2 outline-none";
const HINT_ST = { fontSize: 11, color: "var(--text-dim)", marginTop: 3 };

// Faixas de valor. Descritivas, não normativas — a Sanwey não tem teto de
// diária nem categoria obrigatória; existem só pra poupar digitação de quem
// não tem o número na cabeça. "Outro valor" libera o campo livre.
const HOTEL_FAIXAS = [
  { value: "180", label: "Econômico — R$ 180/noite" },
  { value: "320", label: "Padrão — R$ 320/noite" },
  { value: "500", label: "Executivo — R$ 500/noite" },
];
const CARRO_FAIXAS = [
  { value: "150", label: "Compacto — R$ 150/diária" },
  { value: "180", label: "Intermediário — R$ 180/diária" },
  { value: "260", label: "SUV — R$ 260/diária" },
];

function NumberField({ label, value, onChange, placeholder, hint }) {
  return (
    <div>
      {label && <label style={LABEL_ST}>{label}</label>}
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
      {hint && <p style={HINT_ST}>{hint}</p>}
    </div>
  );
}

// Faixa pré-definida OU valor livre. O valor guardado é sempre o número —
// "outro" é só estado de UI, por isso deriva de `value` em vez de virar um
// segundo estado que poderia divergir do número real.
function FaixaField({ label, faixas, value, onChange, hint, outroPlaceholder }) {
  const éFaixa = faixas.some((f) => f.value === value);
  const [mostrarLivre, setMostrarLivre] = useState(!éFaixa && value !== "");
  const selecionado = éFaixa && !mostrarLivre ? value : "__outro";

  return (
    <div>
      <label style={LABEL_ST}>{label}</label>
      <select
        value={selecionado}
        onChange={(e) => {
          if (e.target.value === "__outro") { setMostrarLivre(true); return; }
          setMostrarLivre(false);
          onChange(e.target.value);
        }}
        className={INPUT_CLS}
        style={{ ...INPUT_ST, appearance: "none", paddingRight: 32,
          backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
          backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: 14 }}
      >
        {faixas.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        <option value="__outro">Outro valor…</option>
      </select>
      {mostrarLivre && (
        <div className="mt-1.5">
          <NumberField value={value} onChange={onChange} placeholder={outroPlaceholder} />
        </div>
      )}
      {hint && <p style={HINT_ST}>{hint}</p>}
    </div>
  );
}

// Contador pra quantidade pequena (noites, diárias): dois cliques em vez de
// selecionar e digitar. Guarda string pra casar com o resto dos campos.
function Stepper({ label, value, onChange, hint, max = 60 }) {
  const n = Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
  const btnSt = { width: 32, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "var(--surface-alt)", color: "var(--text-dim)", cursor: "pointer" };
  return (
    <div>
      <label style={LABEL_ST}>{label}</label>
      <div className="inline-flex items-center rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", height: 34 }}>
        <button type="button" aria-label="Diminuir" onClick={() => onChange(String(Math.max(0, n - 1)))} style={btnSt}>
          <Minus size={13} />
        </button>
        <input
          type="number"
          min={0}
          max={max}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-center outline-none"
          style={{ width: 52, height: "100%", border: "none", background: "var(--surface)", color: "var(--text)", fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
        />
        <button type="button" aria-label="Aumentar" onClick={() => onChange(String(Math.min(max, n + 1)))} style={btnSt}>
          <Plus size={13} />
        </button>
      </div>
      {hint && <p style={HINT_ST}>{hint}</p>}
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
          b.section ? (
            <div key={i} className="text-[10px] font-bold uppercase pt-2 mt-1" style={{ color: "var(--text-faint)", letterSpacing: "0.08em", borderTop: "1px solid var(--border)" }}>
              {b.section}
            </div>
          ) : (
            <div
              key={i}
              className="flex items-center justify-between text-xs"
              style={{ color: b.descartado ? "var(--text-faint)" : "var(--text-dim)", textDecoration: b.descartado ? "line-through" : "none" }}
            >
              <span>{b.label}</span>
              <span>{fmtMoney(b.value)}</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// ── Paradas (lista ordenada com autocomplete) ──────────────────────────────

let stopIdSeq = 0;
function newStop(description = "", placeId = null) {
  stopIdSeq += 1;
  return { id: stopIdSeq, description, placeId };
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

function StopRow({ stop, index, total, onChange, onMoveUp, onMoveDown, onRemove, canRemove, placeholder }) {
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
        placeholder={placeholder || (index === 0 ? "Ponto de partida" : index === total - 1 ? "Destino final" : `Parada ${index + 1}`)}
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

// ── Rota (paradas + distância calculada) ───────────────────────────────────
//
// Extraído em 01/09/2026 porque a tela passou a ter DUAS listas de paradas: o
// trajeto até o destino e os locais visitados lá. Não foi pra shared/ ainda —
// regra 4 do CLAUDE.md manda extrair na 3ª ocorrência, e esta é a 2ª. Mas
// duplicar era pior que extrair cedo: o tratamento de resposta obsoleta e o
// "nunca sobrescrever o que o usuário digitou" são sutis demais pra copiar.

function useRota() {
  const [stops, setStops] = useState(() => [newStop(), newStop()]);
  const [distancia, setDistancia] = useState("");
  const [calc, setCalc] = useState({ loading: false, error: null, totalKm: null });
  const requestIdRef = useRef(0);
  // Último valor de `distancia` preenchido automaticamente pela rota — é o que
  // distingue "campo ainda é da rota" de "usuário digitou". Ver o useEffect
  // do cálculo abaixo.
  const autoDistanciaRef = useRef("");

  const updateStop = (id, patch) => setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const moveStop = (index, dir) => {
    setStops((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };
  const removeStop = (id) => setStops((prev) => (prev.length <= 2 ? prev : prev.filter((s) => s.id !== id)));
  const addStop = () => setStops((prev) => [...prev, newStop()]);

  // Chave estável que só muda quando a sequência de placeIds muda de fato —
  // evita recalcular a cada tecla digitada (só dispara em seleções reais).
  const allFilled = stops.length >= 2 && stops.every((s) => s.placeId);
  const placeIdsKey = allFilled ? stops.map((s) => s.placeId).join("|") : null;

  useEffect(() => {
    if (!placeIdsKey || !isSupabaseConfigured) {
      // Rota deixou de estar completa (3ª parada vazia, texto apagado): a
      // distância vinda da rota anterior fica obsoleta e os cards de custo
      // seguiriam calculando em cima de um número que não corresponde mais ao
      // que está na tela. Limpa — mas só o que ESTA tela preencheu sozinha; se
      // o valor no campo foi digitado à mão, ele é do usuário e continua
      // valendo (a calculadora funciona sem rota nenhuma).
      requestIdRef.current++; // invalida resposta em voo da rota anterior
      setDistancia((prev) => (prev !== "" && prev === autoDistanciaRef.current ? "" : prev));
      autoDistanciaRef.current = "";
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
        if (data?.totalKm != null) {
          const next = String(data.totalKm);
          // Nunca sobrescrever o que o usuário digitou enquanto o cálculo
          // estava em voo: só preenche se o campo estiver vazio ou ainda
          // contiver exatamente o valor que esta tela preencheu por último.
          setDistancia((prev) => {
            if (prev !== "" && prev !== autoDistanciaRef.current) return prev;
            autoDistanciaRef.current = next;
            return next;
          });
        }
      })
      .catch((err) => {
        if (myRequestId !== requestIdRef.current) return;
        setCalc({ loading: false, error: err?.message || "Não foi possível calcular a distância.", totalKm: null });
      });
  }, [placeIdsKey]);

  return { stops, setStops, distancia, setDistancia, calc, setCalc, allFilled, updateStop, moveStop, removeStop, addStop };
}

function ListaDeParadas({ rota, label, hint, placeholderPrefix }) {
  return (
    <div>
      <label style={LABEL_ST}>{label}</label>
      <div className="flex flex-col gap-2">
        {rota.stops.map((stop, i) => (
          <StopRow
            key={stop.id}
            stop={stop}
            index={i}
            total={rota.stops.length}
            onChange={(patch) => rota.updateStop(stop.id, patch)}
            onMoveUp={() => rota.moveStop(i, -1)}
            onMoveDown={() => rota.moveStop(i, 1)}
            onRemove={() => rota.removeStop(stop.id)}
            canRemove={rota.stops.length > 2}
            placeholder={placeholderPrefix ? `${placeholderPrefix} ${i + 1}` : undefined}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={rota.addStop}
        className="inline-flex items-center gap-1.5 text-xs font-semibold mt-2.5"
        style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <Plus size={13} /> Adicionar parada
      </button>
      <div className="mt-2.5" style={{ minHeight: 18 }}>
        {rota.calc.loading && (
          <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-dim)" }}>
            <Loader2 size={12} className="animate-spin" /> Calculando distância entre as paradas…
          </span>
        )}
        {!rota.calc.loading && rota.calc.totalKm != null && !rota.calc.error && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--accent)" }}>
            <Navigation size={12} /> Distância total calculada: {rota.calc.totalKm.toLocaleString("pt-BR")} km
          </span>
        )}
      </div>
      {hint && <p style={HINT_ST}>{hint}</p>}
    </div>
  );
}

export function CRMViagensCalculadoraView({ seed }) {
  const rota = useRota();       // trajeto de origem até o destino
  const local = useRota();      // locais visitados NO destino (não usa ida e volta)

  const [idaEVolta, setIdaEVolta] = useState(true);
  const [passagemAerea, setPassagemAerea] = useState("");

  // Duração. De avião é sempre menos que por terra (regra do Daniel).
  const [noitesTerra, setNoitesTerra] = useState("0");
  const [noitesAviao, setNoitesAviao] = useState("0");
  const [diariasAluguel, setDiariasAluguel] = useState("0");

  // A sugestão de noites vale só enquanto o vendedor não encostou no contador.
  // Sem esta trava acontece o pior tipo de bug de formulário: ele corrige pra 3
  // noites, acrescenta uma parada no trajeto, e o campo volta sozinho pro 2 sem
  // avisar. Mesmo princípio do `autoDistanciaRef` no useRota acima.
  const noitesTocadasRef = useRef(false);
  const marcarNoitesTocadas = (setter) => (v) => { noitesTocadasRef.current = true; setter(v); };

  // Parâmetros de custo: da empresa, não do vendedor. Ficam recolhidos.
  const [mostrarAjustes, setMostrarAjustes] = useState(false);
  const [diariaHotel, setDiariaHotel] = useState("320");
  const [diariaAluguel, setDiariaAluguel] = useState("180");
  const [rkmCarro, setRkmCarro] = useState("1.25");
  const [rkmUber, setRkmUber] = useState("2.50");
  const [rkmCombustivel, setRkmCombustivel] = useState("0.75");
  const [distanciaAeroporto, setDistanciaAeroporto] = useState("");

  // Semente vinda do Planejamento: paradas do roteiro já montadas e noites
  // sugeridas pelo intervalo de datas. Só na montagem — depois disso a tela é
  // do usuário, e reaplicar sobrescreveria o que ele ajustou.
  const seedAplicadaRef = useRef(false);
  useEffect(() => {
    if (!seed || seedAplicadaRef.current) return;
    seedAplicadaRef.current = true;
    const paradas = Array.isArray(seed.paradas) ? seed.paradas : [];
    // O destino da viagem (trecho de origem→destino) recebe o endereço da
    // primeira saída marcada. Antes só `local` era semeado, e com UMA saída
    // marcada (caso comum agora que o vendedor escolhe quais entram) a
    // calculadora abria completamente vazia — o atalho existe justamente pra
    // ele não redigitar endereço nenhum. A origem fica em branco de
    // propósito: é de onde ELE sai, e isso a agenda não sabe.
    if (paradas.length >= 1) {
      const destino = paradas[0];
      rota.setStops((prev) => prev.map((st, i) => (
        i === 1 ? { ...st, description: destino.description || "", placeId: destino.placeId || null } : st
      )));
    }
    // Locais visitados NO destino só fazem sentido com 2+ endereços: um ponto
    // sozinho não tem distância pra percorrer.
    if (paradas.length >= 2) {
      local.setStops(paradas.map((p) => newStop(p.description || "", p.placeId || null)));
    }
    if (seed.noites != null) {
      // Veio da agenda: o intervalo de datas real é melhor que qualquer
      // heurística de distância, então conta como "já definido".
      noitesTocadasRef.current = true;
      setNoitesAviao(String(seed.noites));
      setNoitesTerra(String(Number(seed.noites) + 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // Sugestão de noites a partir da distância — só até alguém encostar nos
  // contadores. Faixas decididas com o Daniel em 01/09/2026: até 150 km é
  // bate-e-volta, e o padrão fixo em 2/1 que existia antes mostrava hotel em
  // visita curta que ninguém ia pagar.
  useEffect(() => {
    if (noitesTocadasRef.current) return;
    const kmIda = num(rota.distancia);
    if (kmIda <= 0) return;
    const [terra, aviao] = kmIda <= 150 ? [0, 0] : kmIda <= 400 ? [1, 0] : [2, 1];
    setNoitesTerra(String(terra));
    setNoitesAviao(String(aviao));
  }, [rota.distancia]);

  const result = useMemo(() => {
    const mult = idaEVolta ? 2 : 1;
    const kmTotal = num(rota.distancia) * mult;
    const kmAeroportoTotal = num(distanciaAeroporto) * mult;
    // Os locais do destino já incluem a volta ao aeroporto como parada — por
    // isso o multiplicador de ida e volta NÃO se aplica aqui.
    const kmLocal = num(local.distancia);

    const hotelNoite = num(diariaHotel);
    const hotelTerra = hotelNoite * num(noitesTerra);
    const hotelAviao = hotelNoite * num(noitesAviao);

    const carroRodagem = kmTotal * num(rkmCarro);
    const uberRodagem = kmTotal * num(rkmUber);
    const carroTotal = carroRodagem + hotelTerra;
    const uberTotal = uberRodagem + hotelTerra;

    const temAviao = num(passagemAerea) > 0;
    const aviaoTraslado = kmAeroportoTotal * num(rkmUber);

    // No destino: alugar ou usar Uber. Calcula os dois e escolhe o menor — a
    // comparação não pede campo nenhum, os dados já estão todos na tela.
    const diarias = num(diariasAluguel);
    const custoAluguel = diarias > 0 ? diarias * num(diariaAluguel) + kmLocal * num(rkmCombustivel) : null;
    const custoUberLocal = kmLocal * num(rkmUber);

    let localModo = null;
    let localCusto = 0;
    if (custoAluguel != null && (custoUberLocal === 0 || custoAluguel <= custoUberLocal)) {
      localModo = "aluguel"; localCusto = custoAluguel;
    } else if (custoUberLocal > 0) {
      localModo = "uber"; localCusto = custoUberLocal;
    }

    const aviaoTotal = num(passagemAerea) + aviaoTraslado + localCusto + hotelAviao;

    const candidatos = [
      { id: "carro", total: carroTotal },
      { id: "uber", total: uberTotal },
      ...(temAviao ? [{ id: "aviao", total: aviaoTotal }] : []),
    ];
    const menor = candidatos.reduce((min, c) => (c.total < min.total ? c : min), candidatos[0]);

    return {
      kmTotal, kmLocal, carroRodagem, uberRodagem, carroTotal, uberTotal,
      hotelTerra, hotelAviao, aviaoTotal, aviaoTraslado, temAviao,
      custoAluguel, custoUberLocal, localModo, diarias,
      cheapest: kmTotal > 0 ? menor.id : null,
    };
  }, [rota.distancia, local.distancia, idaEVolta, rkmCarro, rkmUber, rkmCombustivel,
      passagemAerea, distanciaAeroporto, diariaHotel, diariaAluguel,
      noitesTerra, noitesAviao, diariasAluguel]);

  const erroRota = rota.calc.error || local.calc.error;

  // ── Usar como valor previsto ────────────────────────────────────────────
  // Grava direto em vez de usar o useCRMViagens: o hook mantém assinatura de
  // realtime e lista completa, e montar uma segunda só pra escrever um campo
  // custaria mais do que resolve. A tela de Planejamento recarrega sozinha
  // pelo realtime quando o vendedor volta pra ela.
  const [previstoState, setPrevistoState] = useState({ saving: false, done: false, error: null });
  const visitas = Array.isArray(seed?.visitas) ? seed.visitas : [];
  const melhorTotal = result.cheapest === "carro" ? result.carroTotal
    : result.cheapest === "aviao" ? result.aviaoTotal
    : result.cheapest === "uber" ? result.uberTotal : 0;
  const valorPorVisita = visitas.length > 0 ? melhorTotal / visitas.length : 0;

  const aplicarPrevisto = async () => {
    if (visitas.length === 0 || melhorTotal <= 0) return;
    // Divide igual entre as visitas marcadas (decisão A do mockup): mantém o
    // total certo em qualquer relatório que some, e evita uma saída inflada ao
    // lado de outra zerada.
    const jaTinham = visitas.filter((v) => v.valorPrevisto != null && Number(v.valorPrevisto) > 0);
    if (jaTinham.length > 0) {
      const lista = jaTinham.map((v) => `${v.destino || "saída"} (${fmtMoney(Number(v.valorPrevisto))})`).join(", ");
      // Decisão B do mockup: nunca sobrescrever em silêncio um número que
      // alguém pôs de propósito.
      if (!window.confirm(`${jaTinham.length === 1 ? "Esta saída já tem" : "Estas saídas já têm"} valor previsto — ${lista}. Substituir por ${fmtMoney(valorPorVisita)} cada?`)) return;
    }
    setPrevistoState({ saving: true, done: false, error: null });
    try {
      for (const v of visitas) {
        const { data, error } = await supabase
          .from("crm_viagem_registros")
          .update({ valor_previsto: Number(valorPorVisita.toFixed(2)), updated_at: new Date().toISOString() })
          .eq("id", v.id)
          .select();
        if (error) throw new Error(error.message);
        // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
        if (!data || data.length === 0) throw new Error("Não foi possível gravar o valor previsto — verifique suas permissões.");
      }
      setPrevistoState({ saving: false, done: true, error: null });
    } catch (err) {
      setPrevistoState({ saving: false, done: false, error: err?.message || "Não foi possível gravar o valor previsto." });
    }
  };

  const breakdownAviao = [
    { label: "Passagem", value: num(passagemAerea) },
    ...(result.aviaoTraslado > 0 ? [{ label: `Ida ao aeroporto — ${(num(distanciaAeroporto) * (idaEVolta ? 2 : 1)).toFixed(0)} km`, value: result.aviaoTraslado }] : []),
    ...(result.hotelAviao > 0 ? [{ label: `Hotel — ${num(noitesAviao)} noite(s)`, value: result.hotelAviao }] : []),
    ...(result.localModo ? [{ section: "No destino — o mais barato entra na conta" }] : []),
    ...(result.custoAluguel != null ? [{
      label: `${result.localModo === "aluguel" ? "✓ " : ""}Alugar — ${result.diarias} diária(s) + gasolina`,
      value: result.custoAluguel,
      descartado: result.localModo !== "aluguel",
    }] : []),
    ...(result.custoUberLocal > 0 ? [{
      label: `${result.localModo === "uber" ? "✓ " : ""}Uber lá — ${result.kmLocal.toFixed(0)} km × ${fmtMoney(num(rkmUber))}`,
      value: result.custoUberLocal,
      descartado: result.localModo !== "uber",
    }] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      {erroRota && (
        <AppToast variant="danger" position="top-right" icon={AlertCircle} onDismiss={() => { rota.setCalc((p) => ({ ...p, error: null })); local.setCalc((p) => ({ ...p, error: null })); }}>
          {erroRota} Você pode editar a distância manualmente abaixo.
        </AppToast>
      )}

      <div>
        <h2 className="font-semibold" style={{ fontSize: 16, color: "var(--text)" }}>Calculadora de custo de viagem</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
          Compare carro próprio, Uber/táxi e avião antes de planejar a visita.
        </p>
      </div>

      {/* 1 · Como você vai até lá */}
      <div className="rounded-xl border p-4 flex flex-col gap-4" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="text-[10px] font-bold uppercase" style={{ color: "var(--text-faint)", letterSpacing: "0.1em" }}>1 · Como você vai até lá</div>

        <ListaDeParadas rota={rota} label="Paradas do trajeto (ordem importa)" />

        <div className="grid md:grid-cols-3 gap-4">
          <NumberField
            label="Distância total (km, só ida)"
            value={rota.distancia}
            onChange={rota.setDistancia}
            placeholder="Ex: 120"
            hint={rota.allFilled ? "Preenchido pelas paradas — edite se preferir." : "Escolha os endereços na lista do Google e ele se preenche."}
          />
          <div>
            <label style={LABEL_ST}>Viagem</label>
            <label className="flex items-center gap-2 text-sm mt-1" style={{ color: "var(--text)" }}>
              <input type="checkbox" checked={idaEVolta} onChange={(e) => setIdaEVolta(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
              Ida e volta
            </label>
          </div>
          <NumberField
            label="Passagem aérea (ida e volta, R$)"
            value={passagemAerea}
            onChange={setPassagemAerea}
            placeholder="Ex: 2308"
            hint="Em branco = não compara avião."
          />
        </div>
      </div>

      {/* 2 · O que você vai fazer lá */}
      <div className="rounded-xl border p-4 flex flex-col gap-4" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="text-[10px] font-bold uppercase" style={{ color: "var(--text-faint)", letterSpacing: "0.1em" }}>2 · O que você vai fazer lá</div>

        <ListaDeParadas
          rota={local}
          label="Locais que vai visitar no destino"
          placeholderPrefix="Local"
          hint="Mesma busca. Vira a quilometragem rodada lá — usada tanto pro carro alugado quanto pro Uber de lá. Inclua a volta ao aeroporto como última parada."
        />

        <div className="grid md:grid-cols-3 gap-4">
          <NumberField
            label="Km no destino"
            value={local.distancia}
            onChange={local.setDistancia}
            placeholder="Ex: 150"
            hint={local.allFilled ? "Preenchido pelos locais acima." : "Só os km da visita — não os da estrada."}
          />
        </div>
      </div>

      {/* 3 · Quantos dias */}
      <div className="rounded-xl border p-4 flex flex-col gap-4" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="text-[10px] font-bold uppercase" style={{ color: "var(--text-faint)", letterSpacing: "0.1em" }}>3 · Quantos dias</div>
        <div className="grid md:grid-cols-3 gap-4">
          <Stepper
            label="Noites — indo por terra"
            value={noitesTerra}
            onChange={marcarNoitesTocadas(setNoitesTerra)}
            hint={noitesTocadasRef.current ? "Vale pro carro próprio e pro Uber." : "Sugerido pela distância — ajuste à vontade."}
          />
          <Stepper
            label="Noites — indo de avião"
            value={noitesAviao}
            onChange={marcarNoitesTocadas(setNoitesAviao)}
            hint="Normalmente menos: economiza a estrada."
          />
          <Stepper label="Diárias de carro alugado" value={diariasAluguel} onChange={setDiariasAluguel} hint="Zero = não aluga, compara com Uber de lá." />
        </div>
      </div>

      {/* Ajustar valores — parâmetros da empresa, recolhidos */}
      <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={() => setMostrarAjustes((v) => !v)}
          className="w-full flex items-center gap-2 p-3.5 text-left"
          style={{ background: "none", border: "none", cursor: "pointer" }}
          aria-expanded={mostrarAjustes}
        >
          <ChevronRight size={15} style={{ color: "var(--text-dim)", transform: mostrarAjustes ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
          <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>Ajustar valores</span>
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>
            hotel {fmtMoney(num(diariaHotel))}/noite · carro {fmtMoney(num(diariaAluguel))}/diária · {fmtMoney(num(rkmCarro))}/km · Uber {fmtMoney(num(rkmUber))}/km
          </span>
        </button>
        {mostrarAjustes && (
          <div className="grid md:grid-cols-3 gap-4 px-3.5 pb-4">
            <FaixaField label="Categoria de hotel" faixas={HOTEL_FAIXAS} value={diariaHotel} onChange={setDiariaHotel} outroPlaceholder="R$ por noite" />
            <FaixaField label="Categoria do carro alugado" faixas={CARRO_FAIXAS} value={diariaAluguel} onChange={setDiariaAluguel} outroPlaceholder="R$ por diária" />
            <NumberField label="R$/km — carro próprio" value={rkmCarro} onChange={setRkmCarro} hint="Combustível + desgaste." />
            <NumberField label="R$/km — Uber/táxi" value={rkmUber} onChange={setRkmUber} hint="Estimativa de corrida." />
            <NumberField label="R$/km — gasolina do alugado" value={rkmCombustivel} onChange={setRkmCombustivel} hint="Só combustível: o desgaste já está na diária." />
            <NumberField label="Distância até o aeroporto (km, só ida)" value={distanciaAeroporto} onChange={setDistanciaAeroporto} hint="Quase sempre a mesma pra cada vendedor." />
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <ModalCard
          icon={Car}
          title="Carro próprio"
          total={result.carroTotal}
          cheapest={result.cheapest === "carro"}
          disabled={result.kmTotal === 0}
          breakdown={[
            { label: `${result.kmTotal.toFixed(0)} km × ${fmtMoney(num(rkmCarro))}`, value: result.carroRodagem },
            ...(result.hotelTerra > 0 ? [{ label: `Hotel — ${num(noitesTerra)} noite(s)`, value: result.hotelTerra }] : []),
          ]}
        />
        <ModalCard
          icon={Plane}
          title="Avião"
          total={result.aviaoTotal}
          cheapest={result.cheapest === "aviao"}
          disabled={!result.temAviao}
          breakdown={breakdownAviao}
        />
        <ModalCard
          icon={Bike}
          title="Uber / táxi"
          total={result.uberTotal}
          cheapest={result.cheapest === "uber"}
          disabled={result.kmTotal === 0}
          breakdown={[
            { label: `${result.kmTotal.toFixed(0)} km × ${fmtMoney(num(rkmUber))}`, value: result.uberRodagem },
            ...(result.hotelTerra > 0 ? [{ label: `Hotel — ${num(noitesTerra)} noite(s)`, value: result.hotelTerra }] : []),
          ]}
        />
      </div>

      {/* Só aparece quando a calculadora foi aberta a partir da agenda — sem
          visitas vinculadas não há onde gravar o previsto. */}
      {visitas.length > 0 && melhorTotal > 0 && (
        <div className="rounded-xl border p-3.5 flex items-center gap-3 flex-wrap" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Usar {fmtMoney(melhorTotal)} como valor previsto
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {visitas.length === 1
                ? "Grava na saída que originou este cálculo."
                : `Dividido igualmente entre as ${visitas.length} saídas — ${fmtMoney(valorPorVisita)} em cada.`}
            </div>
            {previstoState.error && (
              <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{previstoState.error}</div>
            )}
          </div>
          <button
            type="button"
            onClick={aplicarPrevisto}
            disabled={previstoState.saving || previstoState.done}
            style={{
              display: "flex", alignItems: "center", gap: 6, border: "none", borderRadius: 10,
              padding: "8px 14px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
              background: previstoState.done ? "var(--surface-alt)" : "var(--accent)",
              color: previstoState.done ? "var(--text-dim)" : "var(--on-accent)",
              cursor: previstoState.saving || previstoState.done ? "default" : "pointer",
              opacity: previstoState.saving ? 0.6 : 1,
            }}
          >
            {previstoState.done ? <><Check size={13} /> Gravado</> : previstoState.saving ? "Gravando…" : "Usar como previsto"}
          </button>
        </div>
      )}
    </div>
  );
}

export default CRMViagensCalculadoraView;
