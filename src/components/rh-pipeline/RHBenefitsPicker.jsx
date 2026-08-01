import React, { useState } from "react";
import { Settings2, X, Trash2, Plus } from "lucide-react";
import { useRHBeneficios } from "../../hooks/use-rh-beneficios";
import { RH_BENEFICIO_TIPOS } from "../../constants/rh-config";

// Benefícios de cargo/vaga viravam texto livre digitado por chip (BenefitsEditor)
// — cada pessoa escrevia "VT", "vale transporte", "Vale-Transporte" de um jeito
// diferente, sem nenhuma fonte única. Agora seleciona a partir do catálogo já
// usado pra benefício de colaborador (rh_beneficios_catalogo), guardando o
// nome de exibição como string em cargo.benefits — mesmo formato de antes,
// só que vindo de uma lista fechada. Achado do usuário 20/07.

export function RHBenefitsPicker({ value, onChange, userId }) {
  const { catalogo, createCatalogoItem, deleteCatalogoItem } = useRHBeneficios({ userId });
  const [managerOpen, setManagerOpen] = useState(false);
  const ativos = catalogo.filter((c) => c.isActive);

  const toggle = (nomeExibicao) => {
    onChange(value.includes(nomeExibicao) ? value.filter((v) => v !== nomeExibicao) : [...value, nomeExibicao]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {ativos.length === 0 ? "Nenhum benefício cadastrado ainda." : "Selecione os benefícios deste cargo."}
        </span>
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          className="inline-flex items-center gap-1"
          style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
        >
          <Settings2 size={11} /> Configurar benefícios
        </button>
      </div>
      {ativos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ativos.map((c) => {
            const checked = value.includes(c.nomeExibicao);
            return (
              <label
                key={c.id}
                className="inline-flex items-center gap-1.5"
                style={{
                  fontSize: 12, fontWeight: 500, borderRadius: 999, padding: "5px 12px 5px 8px", cursor: "pointer",
                  border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                  background: checked ? "var(--accent)" : "var(--surface-alt)",
                  color: checked ? "#FFFFFF" : "var(--text)",
                }}
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(c.nomeExibicao)} style={{ display: "none" }} />
                {c.nomeExibicao}
              </label>
            );
          })}
        </div>
      )}
      {managerOpen && (
        <BeneficiosCatalogoModal
          catalogo={catalogo}
          onCreate={createCatalogoItem}
          onDelete={deleteCatalogoItem}
          onClose={() => setManagerOpen(false)}
        />
      )}
    </div>
  );
}

function BeneficiosCatalogoModal({ catalogo, onCreate, onDelete, onClose }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("outro");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [notice, setNotice] = useState(null);

  const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };
  const inputCls = "w-full text-sm rounded-lg border px-2.5 py-1.5 outline-none";

  const handleAdd = async () => {
    if (!nome.trim()) { setError("Nome do benefício é obrigatório."); return; }
    setSaving(true);
    setError(null);
    try {
      await onCreate({ nomeExibicao: nome.trim(), tipo });
      setNome("");
      setTipo("outro");
    } catch (err) {
      setError(err?.message || "Erro ao criar benefício.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    setNotice(null);
    try {
      const { deactivated } = await onDelete(id);
      setNotice(deactivated ? "Já tinha colaborador vinculado a esse benefício — ele foi desativado em vez de excluído." : null);
    } catch (err) {
      setError(err?.message || "Erro ao excluir benefício.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "var(--shadow-pop)", maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Configurar benefícios</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}><X size={18} /></button>
        </div>

        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
          {catalogo.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>Nenhum benefício cadastrado ainda.</div>
          ) : (
            <div className="flex flex-col gap-2" style={{ marginBottom: 20 }}>
              {catalogo.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", opacity: c.isActive ? 1 : 0.5 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{c.nomeExibicao}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      {RH_BENEFICIO_TIPOS.find((t) => t.id === c.tipo)?.label || c.tipo}
                      {!c.isActive && " · desativado"}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id || !c.isActive}
                    title={c.isActive ? "Excluir" : "Já desativado"}
                    style={{ background: "none", border: "none", cursor: c.isActive ? "pointer" : "default", color: "var(--text-dim)", display: "flex", opacity: c.isActive ? 1 : 0.4 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Novo benefício</div>
          <div className="flex flex-col gap-2">
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do benefício *" className={inputCls} style={inputSt} />
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls} style={inputSt}>
              {RH_BENEFICIO_TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          {notice && <div style={{ background: "var(--warning-bg)", color: "var(--warning)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginTop: 10 }}>{notice}</div>}
          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginTop: 10 }}>{error}</div>}

          <button onClick={handleAdd} disabled={saving} className="inline-flex items-center justify-center gap-1.5" style={{ marginTop: 10, width: "100%", background: "var(--accent)", color: "var(--on-accent)", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
            <Plus size={13} /> {saving ? "Adicionando…" : "Adicionar benefício"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RHBenefitsPicker;
