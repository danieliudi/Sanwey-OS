import React, { useState } from "react";
import { Tag, Plus, Loader2, X } from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useCRMViagemCategorias } from "../../hooks/use-crm-viagem-categorias";
import { CurrencyInput } from "../ui/CurrencyInput";

const cardSt = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 };
const sectionHeaderSt = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 };
const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
const inputCls = "w-full text-sm rounded-xl border px-3 py-2 outline-none";
const inputSt = { borderColor: "var(--border)", color: "var(--text)", background: "var(--surface-alt)", fontSize: 13 };

// Uma linha por categoria — estado local pro texto/limite em edição, só
// grava (updateCategoria) no blur. Sem isso o CurrencyInput dispararia um
// UPDATE por dígito digitado (onChange emite a cada tecla).
function CategoriaRow({ categoria, onSaveNome, onSaveLimite, onDesativar, saving }) {
  const [nome, setNome] = useState(categoria.nome);
  const [limite, setLimite] = useState(categoria.limite_alerta ?? "");

  return (
    <div className="flex items-center flex-wrap" style={{ gap: 10, border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}>
      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => onSaveNome(nome)}
        className={inputCls}
        style={{ ...inputSt, flex: "1 1 160px", minWidth: 140 }}
      />
      <div style={{ width: 160 }}>
        <CurrencyInput
          value={limite}
          onChange={setLimite}
          onBlur={() => onSaveLimite(limite)}
          placeholder="Sem limite"
          className={inputCls}
          style={inputSt}
        />
      </div>
      {saving && <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-dim)" }} />}
      <button
        onClick={onDesativar}
        disabled={saving}
        style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, background: "transparent", color: "var(--text-faint)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 600, cursor: saving ? "default" : "pointer" }}
      >
        <X size={12} /> Desativar
      </button>
    </div>
  );
}

// Gestão de categorias de despesa (Viagens & Despesas) — tela nova, gestor/
// admin-only, ligada a "Prestação de contas em lote": cada categoria pode ter
// um "Limite de alerta" próprio, que substitui a constante flat
// COMPROVANTE_OBRIGATORIO_ACIMA_DE no gate de comprovante obrigatório do
// gestor (Decisão 3 do mockup aprovado — ver CRMViagensGestorView.jsx).
export function CRMViagensCategoriasView({ currentUser }) {
  const { categorias, loading, createCategoria, updateCategoria, desativarCategoria } = useCRMViagemCategorias({ userId: currentUser?.id });

  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);

  const [novoNome, setNovoNome] = useState("");
  const [novoLimite, setNovoLimite] = useState("");
  const [criando, setCriando] = useState(false);

  const handleLimiteChange = async (categoria, valor) => {
    const novoValor = valor === "" ? null : Number(valor);
    if (novoValor === (categoria.limite_alerta ?? null)) return;
    setSavingId(categoria.id);
    setError(null);
    try {
      await updateCategoria(categoria.id, { limite_alerta: novoValor });
    } catch (err) {
      setError(err?.message || "Não foi possível salvar o limite.");
    } finally {
      setSavingId(null);
    }
  };

  const handleNomeChange = async (categoria, nome) => {
    if (!nome.trim() || nome === categoria.nome) return;
    setSavingId(categoria.id);
    setError(null);
    try {
      await updateCategoria(categoria.id, { nome: nome.trim() });
    } catch (err) {
      setError(err?.message || "Não foi possível renomear a categoria.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDesativar = async (categoria) => {
    if (!window.confirm(`Desativar a categoria "${categoria.nome}"? Ela deixa de aparecer para lançar novas despesas — despesas já lançadas com ela não são afetadas.`)) return;
    setSavingId(categoria.id);
    setError(null);
    try {
      await desativarCategoria(categoria.id);
    } catch (err) {
      setError(err?.message || "Não foi possível desativar a categoria.");
      setSavingId(null);
    }
  };

  const handleCriar = async (e) => {
    e.preventDefault();
    if (!novoNome.trim()) { setError("Informe o nome da categoria."); return; }
    setCriando(true);
    setError(null);
    try {
      await createCategoria(novoNome.trim(), { limite_alerta: novoLimite === "" ? null : Number(novoLimite) });
      setNovoNome("");
      setNovoLimite("");
    } catch (err) {
      setError(err?.message || "Não foi possível criar a categoria.");
    } finally {
      setCriando(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div style={cardSt}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Supabase não configurado</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Configure a conexão com o Supabase para gerenciar categorias.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <section style={cardSt}>
        <div style={sectionHeaderSt}>
          <Tag size={16} style={{ color: "var(--text-dim)" }} />
          Categorias de despesa
        </div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 14 }}>
          O "Limite de alerta" define acima de qual valor o comprovante passa a ser obrigatório para aprovar uma despesa dessa categoria. Deixe em branco para usar o padrão da plataforma.
        </div>

        {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Carregando…</div>
        ) : categorias.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Nenhuma categoria cadastrada ainda.</div>
        ) : (
          <div className="flex flex-col" style={{ gap: 8 }}>
            {categorias.map((c) => (
              <CategoriaRow
                key={c.id}
                categoria={c}
                saving={savingId === c.id}
                onSaveNome={(nome) => handleNomeChange(c, nome)}
                onSaveLimite={(valor) => handleLimiteChange(c, valor)}
                onDesativar={() => handleDesativar(c)}
              />
            ))}
          </div>
        )}

        <form onSubmit={handleCriar} className="flex items-center flex-wrap" style={{ gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div style={{ flex: "1 1 160px", minWidth: 140 }}>
            <label style={labelSt}>Nova categoria</label>
            <input type="text" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Nome" className={inputCls} style={inputSt} />
          </div>
          <div style={{ width: 160 }}>
            <label style={labelSt}>Limite de alerta</label>
            <CurrencyInput value={novoLimite} onChange={setNovoLimite} placeholder="Sem limite" className={inputCls} style={inputSt} />
          </div>
          <button type="submit" disabled={criando} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: criando ? "default" : "pointer", opacity: criando ? 0.6 : 1, alignSelf: "flex-end" }}>
            {criando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Nova categoria
          </button>
        </form>
      </section>
    </div>
  );
}

export default CRMViagensCategoriasView;
