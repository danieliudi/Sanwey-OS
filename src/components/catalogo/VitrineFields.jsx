import React from "react";
import { Plus, X } from "lucide-react";

// Metade "vitrine" do produto — o que o Portal B2B mostra pro cliente.
// Mantida pelo Marketing; o suporte vê em modo leitura. Quem garante isso é o
// trigger products_enforce_field_ownership no banco, não esta tela: aqui só
// desabilitamos os campos pra pessoa não digitar algo que seria descartado em
// silêncio ao salvar.

const CATEGORIAS = [
  { id: "resibag",        label: "Resibag®" },
  { id: "epi-seguranca",  label: "EPI & Segurança" },
  { id: "movimentacao",   label: "Movimentação" },
  { id: "compliance",     label: "Compliance" },
];

function inputStyle(disabled) {
  return {
    width: "100%", background: disabled ? "var(--surface-alt)" : "var(--surface)",
    border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px",
    fontSize: 13, color: disabled ? "var(--text-dim)" : "var(--text)",
  };
}

function Label({ children, hint }) {
  return (
    <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
      {hint && <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, marginLeft: 6 }}>{hint}</span>}
    </label>
  );
}

// Lista de textos livres (destaques, aplicações). Uma linha por item — é como
// o portal renderiza, e evita o vício de digitar tudo separado por vírgula e
// depois ninguém saber se a vírgula era separador ou parte da frase.
function StringList({ value = [], onChange, disabled, placeholder }) {
  const set = (i, v) => onChange(value.map((x, j) => (j === i ? v : x)));
  return (
    <div className="space-y-1.5">
      {value.map((item, i) => (
        <div key={i} className="flex gap-1.5">
          <input style={inputStyle(disabled)} value={item} disabled={disabled}
                 placeholder={placeholder} onChange={e => set(i, e.target.value)} />
          {!disabled && (
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}
                    className="px-2 rounded-lg" style={{ color: "var(--text-dim)" }} title="Remover">
              <X size={13} />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" onClick={() => onChange([...value, ""])}
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded"
                style={{ color: "var(--accent)" }}>
          <Plus size={12} /> Adicionar
        </button>
      )}
      {disabled && value.length === 0 && (
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>—</p>
      )}
    </div>
  );
}

// Especificações: pares rótulo/valor. Guardados como jsonb no banco, e não
// como dois arrays paralelos — array paralelo desalinha na primeira edição e
// ninguém percebe até a vitrine mostrar "Capacidade: INMETRO".
function SpecList({ value = [], onChange, disabled }) {
  const set = (i, key, v) => onChange(value.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
  return (
    <div className="space-y-1.5">
      {value.map((spec, i) => (
        <div key={i} className="flex gap-1.5">
          <input style={{ ...inputStyle(disabled), flex: "0 0 40%" }} value={spec.label || ""} disabled={disabled}
                 placeholder="Capacidade" onChange={e => set(i, "label", e.target.value)} />
          <input style={inputStyle(disabled)} value={spec.value || ""} disabled={disabled}
                 placeholder="1.000 kg" onChange={e => set(i, "value", e.target.value)} />
          {!disabled && (
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}
                    className="px-2 rounded-lg" style={{ color: "var(--text-dim)" }} title="Remover">
              <X size={13} />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" onClick={() => onChange([...value, { label: "", value: "" }])}
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded"
                style={{ color: "var(--accent)" }}>
          <Plus size={12} /> Adicionar especificação
        </button>
      )}
      {disabled && value.length === 0 && (
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>—</p>
      )}
    </div>
  );
}

export function VitrineFields({ form, setForm, disabled = false }) {
  const upd = (patch) => setForm(f => ({ ...f, ...patch }));

  return (
    <div className="space-y-3.5">
      {disabled && (
        <div className="rounded-lg px-3 py-2 text-[11.5px] leading-relaxed"
             style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
          A vitrine é mantida pelo Marketing. Você vê o conteúdo, mas as
          alterações feitas aqui não são salvas.
        </div>
      )}

      <div>
        <Label hint="uma frase, aparece embaixo do nome no portal">Chamada</Label>
        <input style={inputStyle(disabled)} value={form.tagline} disabled={disabled}
               placeholder="A embalagem que substitui o tambor com vantagem"
               onChange={e => upd({ tagline: e.target.value })} />
      </div>

      <div>
        <Label hint="o texto longo da página do produto">Descrição</Label>
        <textarea style={{ ...inputStyle(disabled), minHeight: 84, resize: "vertical" }}
                  value={form.description} disabled={disabled}
                  onChange={e => upd({ description: e.target.value })} />
      </div>

      <div>
        <Label>Destaques</Label>
        <StringList value={form.features} disabled={disabled}
                    placeholder="Substitui tambores de 200 L com até 1.000 kg"
                    onChange={features => upd({ features })} />
      </div>

      <div>
        <Label>Especificações</Label>
        <SpecList value={form.specs} disabled={disabled} onChange={specs => upd({ specs })} />
      </div>

      <div>
        <Label>Aplicações</Label>
        <StringList value={form.applications} disabled={disabled}
                    placeholder="Resíduos Classe I e II"
                    onChange={applications => upd({ applications })} />
      </div>

      <div>
        <Label hint="agrupa o produto na vitrine">Categoria</Label>
        <select style={inputStyle(disabled)} value={form.category} disabled={disabled}
                onChange={e => upd({ category: e.target.value })}>
          <option value="">Sem categoria</option>
          {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      <label className="flex items-start gap-2 text-[13px]" style={{ color: disabled ? "var(--text-dim)" : "var(--text)" }}>
        <input type="checkbox" checked={form.proposed} disabled={disabled} className="mt-0.5"
               onChange={() => upd({ proposed: !form.proposed })} />
        <span>
          Produto conceitual
          <span className="block text-[11px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
            Aparece na vitrine marcado como proposta, sem valer como item de
            catálogo — para testar interesse antes de existir SKU e preço.
          </span>
        </span>
      </label>
    </div>
  );
}

export default VitrineFields;
