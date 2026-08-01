import React, { useMemo, useState } from "react";
import { X, Building2, AlertTriangle } from "lucide-react";
import { isValidCnpj } from "../../utils/field-validation";
import { findClientByCnpj, DuplicateClientError } from "../../utils/client-dedup";

// Mini-cadastro de cliente pra fluxos que só precisam de nome (+ CNPJ
// opcional pra dedupe) — diferente do formulário completo de
// ClientsManager.jsx (categoria/cidade/UF/notas), que fica reservado pra
// quem está gerenciando o cadastro de verdade em Comercial → Clientes.
// Sempre checa CNPJ contra a lista de clients já carregada (mesmo
// normalize-digits + find em memória de LeadDetailDrawer.jsx) antes de
// deixar criar — se bater, força usar o cliente existente em vez de
// duplicar, ao custo de exigir que quem cadastra confira o CNPJ certo.
//
// Props:
//   initialName    texto já digitado na busca do ClientSelector (opcional)
//   initialCnpj    CNPJ já conhecido no contexto de origem (ex: lead.cnpj) —
//                  pré-preenche e já dispara a checagem de duplicata na hora
//   extra          campos extras a incluir na criação sem expor input pra
//                  eles (ex: {city, state} vindos do lead de origem)
//   clients        lista completa de clientes (pra checar duplicata)
//   onCreate({name, cnpj, ...extra}) -> Promise<client>  cria de fato (createClient do use-clients.js)
//   onDone(client) chamado com o cliente resultante (criado OU já existente escolhido)
//   onClose
export function ClientQuickCreateModal({ initialName = "", initialCnpj = "", extra = {}, clients = [], onCreate, onDone, onClose }) {
  const [name, setName] = useState(initialName);
  const [cnpj, setCnpj] = useState(initialCnpj);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const cnpjDigits = cnpj.replace(/\D/g, "");
  const duplicateMatch = useMemo(() => findClientByCnpj(clients, cnpjDigits), [cnpjDigits, clients]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Informe o nome do cliente."); return; }
    if (duplicateMatch) return; // botão de submit fica desabilitado, mas trava aqui também
    if (cnpjDigits && !isValidCnpj(cnpjDigits)) { setError("CNPJ inválido — confira os números."); return; }
    setSaving(true);
    setError(null);
    try {
      const created = await onCreate({ name: name.trim(), cnpj: cnpjDigits || null, ...extra });
      onDone(created);
    } catch (err) {
      if (err instanceof DuplicateClientError) { onDone(err.existingClient); return; }
      setError(err?.message || "Erro ao cadastrar cliente.");
    } finally {
      setSaving(false);
    }
  };

  const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
  const inputSt = { borderColor: "var(--border)", color: "var(--text)", background: "var(--surface-alt)", fontSize: 13 };
  const inputCls = "w-full text-sm rounded-xl border px-3 py-2 outline-none";

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "var(--shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Building2 size={16} style={{ color: "var(--accent)" }} />
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Cadastrar novo cliente</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelSt}>Nome *</label>
              <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente/empresa" className={inputCls} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>CNPJ</label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="Opcional — usado pra evitar duplicata"
                className={inputCls}
                style={{ ...inputSt, borderColor: duplicateMatch ? "var(--danger)" : inputSt.borderColor }}
              />
            </div>
            {duplicateMatch && (
              <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 10, padding: "10px 12px", fontSize: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  Já existe um cliente com esse CNPJ: <b>{duplicateMatch.name}</b>.
                  <button
                    type="button"
                    onClick={() => onDone(duplicateMatch)}
                    style={{ display: "block", marginTop: 6, background: "none", border: "none", padding: 0, color: "var(--accent)", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                  >
                    Usar "{duplicateMatch.name}" em vez de criar outro
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, margin: "12px 0" }}>{error}</div>}

          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving || !!duplicateMatch}
              style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: (saving || duplicateMatch) ? "default" : "pointer", opacity: (saving || duplicateMatch) ? 0.5 : 1 }}
            >
              {saving ? "Cadastrando…" : "Cadastrar cliente"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
