import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pause, Play, Package } from "lucide-react";
import { useProducts } from "../../hooks/use-products";
import { useClientProducts, checkMargin } from "../../hooks/use-client-products";
import { formatBRL } from "../../utils/currency";
import { Modal } from "../ui/Modal";

// Clientes → Produtos & Preços. É o único lugar da plataforma onde o preço
// que o cliente paga nasce.
//
// O vendedor vê o preço de tabela que o suporte manteve e põe a margem em
// cima. Digita dos dois lados — margem ou preço final — e o outro se ajusta.
// Os três estados (dentro, aviso, barrado) vêm da MESMA função do banco que
// aplica a trava, então tela e banco nunca discordam.

function pctFmt(v) {
  if (v == null) return "—";
  const n = Number(v);
  return `${n > 0 ? "+" : ""}${n.toFixed(2).replace(".", ",")}%`;
}

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

function ReleaseModal({ open, onClose, produtos, companyId, onRelease, editing }) {
  const [productId, setProductId] = useState("");
  const [preco, setPreco]   = useState("");
  const [margem, setMargem] = useState("");
  const [check, setCheck]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);
  const [seeded, setSeeded] = useState(null);

  const key = editing?.product_id ?? "novo";
  if (open && seeded !== key) {
    setSeeded(key);
    setProductId(editing?.product_id || "");
    setPreco(editing?.price ?? "");
    setMargem("");
    setCheck(null);
    setErr(null);
  }
  if (!open && seeded !== null) setSeeded(null);

  const produto = produtos.find(p => p.id === productId);
  const tabela  = produto?.preco_tabela ?? null;

  // Pergunta ao banco a cada mudança. Debounce curto: o vendedor digita o
  // preço dígito a dígito, e uma chamada por tecla seria desperdício.
  useEffect(() => {
    if (!productId || preco === "") { setCheck(null); return; }
    const t = setTimeout(async () => {
      setCheck(await checkMargin(companyId, productId, preco));
    }, 250);
    return () => clearTimeout(t);
  }, [companyId, productId, preco]);

  // Os dois campos são a mesma grandeza vista de lados diferentes: mexer num
  // recalcula o outro. Sem preço de tabela não há conversão possível — aí só
  // o preço final vale.
  const onPreco = (v) => {
    setPreco(v);
    if (tabela && v !== "") setMargem(((Number(v) / tabela - 1) * 100).toFixed(2));
    else setMargem("");
  };
  const onMargem = (v) => {
    setMargem(v);
    if (tabela && v !== "") setPreco((tabela * (1 + Number(v) / 100)).toFixed(2));
  };

  const bloqueado = check?.bloqueia === true;

  const handleSave = async () => {
    if (!productId || preco === "") { setErr("Escolha o produto e informe o preço."); return; }
    setSaving(true); setErr(null);
    try {
      await onRelease(productId, Number(preco));
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Alterar preço" : "Liberar produto"} width={480}>
      <div className="space-y-3.5">
        <div>
          <Label>Produto</Label>
          <select style={inputStyle()} value={productId} disabled={Boolean(editing)}
                  onChange={e => { setProductId(e.target.value); setPreco(""); setMargem(""); setCheck(null); }}>
            <option value="">Selecione…</option>
            {produtos.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
        </div>

        {produto && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="grid grid-cols-3">
              <div className="px-3.5 py-2.5" style={{ borderRight: "1px solid var(--border)" }}>
                <p className="text-[9.5px] font-bold uppercase mb-1" style={{ color: "var(--text-dim)", letterSpacing: "0.11em" }}>Preço de tabela</p>
                <p className="text-[15px] font-bold" style={{ color: "var(--text)" }}>
                  {tabela == null ? <span style={{ color: "var(--warning)", fontSize: 13 }}>sem tabela</span> : formatBRL(tabela)}
                </p>
              </div>
              <div className="px-3.5 py-2.5" style={{ borderRight: "1px solid var(--border)" }}>
                <p className="text-[9.5px] font-bold uppercase mb-1" style={{ color: "var(--text-dim)", letterSpacing: "0.11em" }}>Margem</p>
                <input style={{ ...inputStyle(), border: "none", padding: 0, fontSize: 15, fontWeight: 700, background: "transparent", color: "var(--accent)" }}
                       type="number" step="0.01" value={margem} placeholder={tabela == null ? "—" : "0,00"}
                       disabled={tabela == null} onChange={e => onMargem(e.target.value)} />
              </div>
              <div className="px-3.5 py-2.5">
                <p className="text-[9.5px] font-bold uppercase mb-1" style={{ color: "var(--text-dim)", letterSpacing: "0.11em" }}>Preço do cliente</p>
                <input style={{ ...inputStyle(), border: "none", padding: 0, fontSize: 15, fontWeight: 700, background: "transparent", color: "var(--accent)" }}
                       type="number" step="0.01" min="0" value={preco} placeholder="0,00"
                       onChange={e => onPreco(e.target.value)} />
              </div>
            </div>

            {check && check.margem_pct != null && (
              <div className="px-3.5 py-2.5 text-[12px] leading-relaxed"
                   style={{
                     background: check.bloqueia ? "var(--danger-bg)" : check.avisa ? "var(--warning-bg)" : "var(--surface-alt)",
                     color: check.bloqueia ? "var(--danger)" : check.avisa ? "var(--warning)" : "var(--text-dim)",
                   }}>
                {check.bloqueia ? (
                  <><strong>Abaixo do mínimo da gerência ({pctFmt(check.minimo_pct)}).</strong> Fale com a gerência para revisar a regra.</>
                ) : check.avisa ? (
                  <><strong>Abaixo de {pctFmt(check.aviso_pct)}.</strong> A gerência pediu para ser avisada nesse patamar — você pode salvar assim.</>
                ) : (
                  <>Margem de <strong>{pctFmt(check.margem_pct)}</strong>, dentro do combinado.</>
                )}
              </div>
            )}

            {tabela == null && (
              <div className="px-3.5 py-2.5 text-[12px]" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
                Este produto está sem preço de tabela, então não dá para calcular
                margem — nem o limite da gerência se aplica. Peça ao suporte para
                cadastrar a tabela.
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
          <button onClick={handleSave} disabled={saving || bloqueado}
                  title={bloqueado ? "Margem abaixo do mínimo definido pela gerência" : undefined}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold"
                  style={{
                    background: bloqueado ? "var(--surface-alt)" : "var(--accent)",
                    color: bloqueado ? "var(--text-dim)" : "var(--on-accent)",
                    cursor: bloqueado ? "not-allowed" : "pointer",
                    opacity: saving ? 0.6 : 1,
                  }}>
            {saving ? "Salvando…" : editing ? "Salvar preço" : "Liberar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ClientProductsTab({ clientId, companyIds = [], canEdit = false }) {
  const { products } = useProducts();
  const { rows, loading, release, setActive } = useClientProducts(clientId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const productsById = useMemo(
    () => Object.fromEntries(products.map(p => [p.id, p])), [products]);

  // Só produtos ativos das empresas que este cliente compra.
  const liberaveis = useMemo(
    () => products.filter(p => p.active && companyIds.includes(p.company_id)
                               && !rows.some(r => r.product_id === p.id)),
    [products, companyIds, rows]);

  const companyOf = (productId) => productsById[productId]?.company_id || companyIds[0];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)", maxWidth: "52ch" }}>
          O que este cliente pode comprar, e por quanto. O preço aqui é dele —
          nenhum outro cliente vê.
        </p>
        {canEdit && (
          <button onClick={() => { setEditing(null); setModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0"
                  style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            <Plus size={13} /> Liberar produto
          </button>
        )}
      </div>

      <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 480 }}>
          {/* thead renderiza sempre — sem liberação, a estrutura continua à vista. */}
          <thead>
            <tr>
              {["Produto", "Tabela", "Margem", "Preço do cliente", ""].map((h, i) => (
                <th key={h + i}
                    style={{
                      fontSize: 10, fontWeight: 650, letterSpacing: "0.11em", textTransform: "uppercase",
                      color: "var(--text-dim)", borderBottom: "1px solid var(--border)",
                      padding: "10px 12px 8px 0", paddingLeft: i === 0 ? 14 : 0,
                      textAlign: i === 0 || i === 4 ? "left" : "right", whiteSpace: "nowrap",
                    }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-xs" style={{ color: "var(--text-dim)" }}>Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10">
                  <Package size={20} style={{ color: "var(--text-dim)", margin: "0 auto 8px" }} />
                  <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>Nenhum produto liberado</p>
                  <p className="text-xs mt-1 mx-auto" style={{ color: "var(--text-dim)", maxWidth: "44ch" }}>
                    Cliente aprovado começa sem nada liberado. Cada produto entra
                    com o preço negociado dele — não existe preço padrão.
                  </p>
                </td>
              </tr>
            ) : rows.map(r => {
              const p = productsById[r.product_id];
              const tabela = p?.preco_tabela ?? null;
              const margem = tabela ? ((Number(r.price) / tabela - 1) * 100) : null;
              return (
                <tr key={r.product_id} style={{ borderBottom: "1px solid var(--border)", opacity: r.active ? 1 : 0.55 }}>
                  <td style={{ padding: "11px 12px 11px 14px", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                    {p?.name || "Produto removido"}
                    {!r.active && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold"
                            style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>Pausado</span>
                    )}
                  </td>
                  <td style={{ padding: "11px 12px 11px 0", fontSize: 12, color: "var(--text-dim)", textAlign: "right", whiteSpace: "nowrap" }}>
                    {tabela == null ? "—" : formatBRL(tabela)}
                  </td>
                  <td style={{ padding: "11px 12px 11px 0", fontSize: 12, textAlign: "right", whiteSpace: "nowrap",
                               color: margem == null ? "var(--text-dim)" : margem < 0 ? "var(--danger)" : "var(--text-dim)" }}>
                    {margem == null ? "—" : pctFmt(margem)}
                  </td>
                  <td style={{ padding: "11px 12px 11px 0", fontSize: 13, fontWeight: 700, color: "var(--text)", textAlign: "right", whiteSpace: "nowrap" }}>
                    {formatBRL(r.price)}
                  </td>
                  <td style={{ padding: "11px 14px 11px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                    {canEdit && (
                      <>
                        <button onClick={() => { setEditing(r); setModalOpen(true); }}
                                className="text-[11px] font-bold px-2 py-1 rounded" style={{ color: "var(--accent)" }}>
                          Preço
                        </button>
                        <button onClick={() => setActive(r.product_id, !r.active)}
                                title={r.active ? "Pausar — o preço negociado fica guardado" : "Retomar"}
                                className="p-1.5 rounded" style={{ color: "var(--text-dim)" }}>
                          {r.active ? <Pause size={13} /> : <Play size={13} />}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ReleaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        produtos={editing ? products.filter(p => p.id === editing.product_id) : liberaveis}
        companyId={editing ? companyOf(editing.product_id) : (companyIds[0] || "industria")}
        onRelease={release}
        editing={editing}
      />
    </div>
  );
}

export default ClientProductsTab;
