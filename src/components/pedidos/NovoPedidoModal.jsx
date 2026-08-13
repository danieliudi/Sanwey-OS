import React, { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Modal } from "../ui/Modal";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { COMPANIES } from "../../constants/companies";
import { formatBRL } from "../../utils/currency";
import { ORIGENS } from "../../hooks/use-orders";

// "Novo pedido" — o caminho que faz a Central valer antes de o portal existir:
// registra o que chega hoje por WhatsApp, e-mail ou telefone.
//
// A regra que sustenta tudo: só oferece produto LIBERADO pra aquele cliente, e
// ao preço dele. Não existe digitar preço aqui — quem negocia é o vendedor, na
// aba Produtos & Preços do cliente. Isto aqui é registro de pedido, não
// negociação.

function inputStyle() {
  return {
    width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "var(--text)",
  };
}

function Label({ children }) {
  return (
    <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
    </label>
  );
}

export function NovoPedidoModal({ open, onClose, clients = [], products = [], accessibleCompanies = [], onCreate, onDone }) {
  const [companyId, setCompanyId] = useState(accessibleCompanies[0] || "industria");
  const [clientId, setClientId]   = useState("");
  const [origem, setOrigem]       = useState("whatsapp");
  const [oc, setOc]               = useState("");
  const [liberados, setLiberados] = useState([]);
  const [itens, setItens]         = useState([]);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState(null);

  const productsById = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products]);

  // Busca o que este cliente pode comprar, com o preço dele. Sem cliente
  // escolhido não há catálogo — é o contrário de uma loja, e é de propósito.
  useEffect(() => {
    if (!isSupabaseConfigured || !clientId) { setLiberados([]); return; }
    supabase.from("client_products")
      .select("product_id, price, active")
      .eq("client_id", clientId).eq("active", true)
      .then(({ data }) => setLiberados(data || []));
    setItens([]);
  }, [clientId]);

  const disponiveis = liberados.filter(l =>
    productsById[l.product_id]?.company_id === companyId
    && !itens.some(i => i.productId === l.product_id));

  const total = itens.reduce((acc, i) => acc + i.quantidade * i.preco, 0);

  const addItem = (productId) => {
    const lib = liberados.find(l => l.product_id === productId);
    if (!lib) return;
    setItens(prev => [...prev, { productId, quantidade: 1, preco: Number(lib.price) }]);
  };

  const salvar = async () => {
    if (!clientId) { setErr("Escolha o cliente."); return; }
    if (itens.length === 0) { setErr("Adicione ao menos um item — pedido vazio não segue adiante."); return; }
    setSaving(true); setErr(null);
    try {
      await onCreate({
        company_id: companyId, client_id: clientId, origem,
        situacao: "conferencia",
        ordem_compra_cliente: oc.trim() || null,
      }, itens);
      onDone?.();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const clientesDaEmpresa = clients.filter(c => (c.companyIds || []).includes(companyId));

  return (
    <Modal open={open} onClose={onClose} title="Novo pedido" width={560}>
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Empresa</Label>
            <select style={inputStyle()} value={companyId}
                    onChange={e => { setCompanyId(e.target.value); setClientId(""); setItens([]); }}>
              {accessibleCompanies.map(c => <option key={c} value={c}>{COMPANIES[c]?.name || c}</option>)}
            </select>
          </div>
          <div>
            <Label>Como chegou</Label>
            <select style={inputStyle()} value={origem} onChange={e => setOrigem(e.target.value)}>
              {ORIGENS.filter(o => o.id !== "portal").map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <Label>Cliente</Label>
          <select style={inputStyle()} value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">Selecione…</option>
            {clientesDaEmpresa.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <Label>Ordem de compra do cliente</Label>
          <input style={inputStyle()} value={oc} placeholder="opcional — sai na nota"
                 onChange={e => setOc(e.target.value)} />
        </div>

        {clientId && (
          <div>
            <Label>Itens</Label>
            {itens.length === 0 && (
              <p className="text-[11.5px] mb-2 leading-relaxed" style={{ color: "var(--text-dim)" }}>
                Só aparecem produtos liberados para este cliente, ao preço dele.
                Se falta algum, libere antes em Clientes → Produtos &amp; Preços.
              </p>
            )}
            <div className="space-y-1.5">
              {itens.map((it, i) => (
                <div key={it.productId} className="flex items-center gap-2">
                  <span className="flex-1 text-[12.5px]" style={{ color: "var(--text)" }}>
                    {productsById[it.productId]?.name || "Produto"}
                  </span>
                  <input type="number" min="1" value={it.quantidade}
                         style={{ ...inputStyle(), width: 68 }}
                         onChange={e => setItens(prev => prev.map((x, j) =>
                           j === i ? { ...x, quantidade: Math.max(1, Number(e.target.value) || 1) } : x))} />
                  <span className="text-[12.5px] w-24 text-right" style={{ color: "var(--text-dim)" }}>
                    {formatBRL(it.preco)}
                  </span>
                  <span className="text-[13px] w-28 text-right font-bold" style={{ color: "var(--text)" }}>
                    {formatBRL(it.quantidade * it.preco)}
                  </span>
                  <button type="button" onClick={() => setItens(prev => prev.filter((_, j) => j !== i))}
                          className="p-1 rounded" style={{ color: "var(--text-dim)" }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            {disponiveis.length > 0 ? (
              <select style={{ ...inputStyle(), marginTop: 8 }} value=""
                      onChange={e => e.target.value && addItem(e.target.value)}>
                <option value="">+ Adicionar produto…</option>
                {disponiveis.map(l => (
                  <option key={l.product_id} value={l.product_id}>
                    {productsById[l.product_id]?.name} — {formatBRL(l.price)}
                  </option>
                ))}
              </select>
            ) : liberados.length === 0 ? (
              <p className="text-[11.5px] mt-2 leading-relaxed" style={{ color: "var(--warning)" }}>
                Este cliente não tem nenhum produto liberado ainda. Libere em
                Clientes → Produtos &amp; Preços antes de registrar o pedido.
              </p>
            ) : null}

            {itens.length > 0 && (
              <div className="flex justify-between items-baseline pt-3 mt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <span className="text-[12.5px]" style={{ color: "var(--text-dim)" }}>Total</span>
                <strong className="text-[17px]" style={{ color: "var(--text)" }}>{formatBRL(total)}</strong>
              </div>
            )}
          </div>
        )}

        {err && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3.5 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={saving}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Salvando…" : "Criar pedido"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default NovoPedidoModal;
