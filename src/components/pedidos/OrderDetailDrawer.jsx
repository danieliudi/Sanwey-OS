import React, { useMemo, useState } from "react";
import { Package, History, Paperclip, FileText } from "lucide-react";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { DetailDrawerTabs } from "../shared/DetailDrawerTabs";
import { StageNavigator } from "../shared/StageNavigator";
import { AppToast } from "../shared/AppToast";
import { COMPANIES } from "../../constants/companies";
import { formatBRL } from "../../utils/currency";
import { formatDateBR } from "../../utils/date";
import { SITUACOES, ORIGENS, useOrderItems, useOrderHistory } from "../../hooks/use-orders";

// Drawer do pedido. Mesmo SplitPanelDrawer de 13 telas — três painéis, abas em
// pastilha no painel esquerdo, StageNavigator à direita. No celular o
// componente já colapsa a esquerda atrás de "+ detalhes" e sobe o "Mover para"
// como bandeja no rodapé, sem nada a fazer aqui.
//
// O centro são os ITENS: é a única coisa que alguém abre um pedido pra ver.

const TABS = [
  { id: "itens",      label: "Itens",      icon: Package },
  { id: "dados",      label: "Dados",      icon: FileText },
  { id: "historico",  label: "Histórico",  icon: History },
  { id: "anexos",     label: "Anexos",     icon: Paperclip },
];

function Lbl({ children }) {
  return (
    <p className="mb-1" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "var(--text-dim)" }}>
      {children}
    </p>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <Lbl>{label}</Lbl>
      <p className="text-[12.5px]" style={{ color: "var(--text)" }}>{children || "—"}</p>
    </div>
  );
}

export function OrderDetailDrawer({
  order, onClose, onMove, onUpdate, clientsById = {}, usersById = {},
  productsById = {}, canOperate = false, currentUser,
}) {
  const [tab, setTab]       = useState("itens");
  const [kron, setKron]     = useState(order.kronosys_numero || "");
  const [toast, setToast]   = useState(null);
  const { items, loading }  = useOrderItems(order.id);
  const history             = useOrderHistory(order.id);

  const cliente = clientsById[order.client_id];
  const situacao = SITUACOES.find(s => s.id === order.situacao);
  const origem = ORIGENS.find(o => o.id === order.origem);
  const dono = (cliente?.ownerIds || []).map(id => usersById[id]?.name).filter(Boolean).join(", ");

  // Sem número do Kronosys, "Confirmado" some da lista de destinos. É cortesia
  // com quem opera — a garantia é o trigger orders_guard_stage_change, que
  // recusa por qualquer caminho.
  const temKronosys = Boolean((kron || "").trim());
  const destinos = useMemo(() => SITUACOES.filter(s =>
    s.interno !== false && s.id !== order.situacao &&
    (temKronosys || !["confirmado", "producao", "faturado"].includes(s.id))
  ), [order.situacao, temKronosys]);

  const salvarKronosys = async () => {
    try {
      await onUpdate(order.id, { kronosys_numero: kron.trim() || null });
      setToast("Número do Kronosys salvo.");
    } catch (e) { setToast(e.message); }
  };

  const mover = async (destino) => {
    try { await onMove(order.id, destino); }
    catch (e) { setToast(e.message); }
  };

  return (
    <>
    {toast && <AppToast variant="danger" title={toast} onDismiss={() => setToast(null)} />}
    <SplitPanelDrawer
      onClose={onClose}
      header={
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-bold" style={{ color: "var(--text-dim)" }}>#{order.numero}</span>
            {origem && (
              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold"
                    style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
                {origem.label.toUpperCase()}
              </span>
            )}
            {situacao && (
              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold"
                    style={{ background: `${situacao.color}1F`, color: situacao.color }}>
                {situacao.name.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-[17px] font-bold mt-1" style={{ color: "var(--text)", letterSpacing: "-0.015em" }}>
            {cliente?.name || "Cliente removido"}
          </p>
          <p className="text-[12px]" style={{ color: "var(--text-dim)" }}>
            {[cliente?.city, COMPANIES[order.company_id]?.name, dono && `vendedor: ${dono}`]
              .filter(Boolean).join(" · ")}
          </p>
        </div>
      }
      left={
        <>
          <DetailDrawerTabs tabs={TABS} activeId={tab} onChange={setTab} />
          <Campo label="Cliente">{cliente?.name}</Campo>
          <Campo label="Ordem de compra do cliente">{order.ordem_compra_cliente}</Campo>
          <Campo label="Observação">{order.observacao}</Campo>
          <Campo label="Criado em">{formatDateBR(order.created_at)}</Campo>
        </>
      }
      center={
        tab === "itens" ? (
          <>
            <Lbl>Itens do pedido</Lbl>
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 400 }}>
                {/* thead sempre presente — pedido sem item mostra a estrutura */}
                <thead>
                  <tr>
                    {["Produto", "Qtd", "Unitário", "Subtotal"].map((h, i) => (
                      <th key={h} style={{
                        fontSize: 10, fontWeight: 650, letterSpacing: "0.11em", textTransform: "uppercase",
                        color: "var(--text-dim)", borderBottom: "1px solid var(--border)",
                        padding: "10px 12px 8px 0", paddingLeft: i === 0 ? 14 : 0,
                        textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-8 text-xs" style={{ color: "var(--text-dim)" }}>Carregando…</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-xs" style={{ color: "var(--text-dim)" }}>
                      Pedido sem itens. Um pedido vazio não deveria seguir adiante.
                    </td></tr>
                  ) : items.map(it => (
                    <tr key={it.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "11px 12px 11px 14px", fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
                        {productsById[it.product_id]?.name || "Produto removido"}
                      </td>
                      <td style={{ padding: "11px 12px 11px 0", fontSize: 12.5, color: "var(--text-dim)", textAlign: "right" }}>{it.quantidade}</td>
                      <td style={{ padding: "11px 12px 11px 0", fontSize: 12.5, color: "var(--text-dim)", textAlign: "right", whiteSpace: "nowrap" }}>{formatBRL(it.preco_unitario)}</td>
                      <td style={{ padding: "11px 12px 11px 0", fontSize: 13, color: "var(--text)", fontWeight: 650, textAlign: "right", whiteSpace: "nowrap" }}>
                        {formatBRL(it.quantidade * it.preco_unitario)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-baseline pt-3 mt-3" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-[12.5px]" style={{ color: "var(--text-dim)" }}>Total</span>
              <strong className="text-[18px]" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>{formatBRL(order.total)}</strong>
            </div>
            <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
              Total somado pelo banco, não pela tela. O preço unitário é o negociado
              deste cliente, gravado no item — reajuste posterior não reescreve pedido antigo.
            </p>
          </>
        ) : tab === "historico" ? (
          <>
            <Lbl>Movimentações</Lbl>
            {history.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                Nenhuma movimentação ainda — o pedido está na situação em que nasceu.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="flex items-baseline gap-2 text-[12.5px]">
                    <span style={{ color: "var(--text-dim)", minWidth: 108 }}>{formatDateBR(h.moved_at)}</span>
                    <span style={{ color: "var(--text)" }}>
                      {SITUACOES.find(s => s.id === h.de)?.name || "—"} → <strong>{SITUACOES.find(s => s.id === h.para)?.name || h.para}</strong>
                    </span>
                    <span style={{ color: "var(--text-dim)" }}>{usersById[h.moved_by]?.name || ""}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : tab === "dados" ? (
          <div className="space-y-3.5">
            <Campo label="Empresa">{COMPANIES[order.company_id]?.name}</Campo>
            <Campo label="Origem">{origem?.label}</Campo>
            <Campo label="Confirmado por">
              {order.confirmed_at ? `${usersById[order.confirmed_by]?.name || "—"} em ${formatDateBR(order.confirmed_at)}` : null}
            </Campo>
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
            Anexos do pedido — a ordem de compra em PDF que o cliente manda vive aqui.
          </p>
        )
      }
      right={
        <>
          <div>
            <Lbl>Nº no Kronosys</Lbl>
            <input
              value={kron}
              onChange={e => setKron(e.target.value)}
              onBlur={salvarKronosys}
              disabled={!canOperate}
              placeholder="KR-00000"
              style={{
                width: "100%", borderRadius: 8, padding: "7px 10px", fontSize: 13,
                background: temKronosys ? "var(--surface)" : "var(--warning-bg)",
                border: `1px solid ${temKronosys ? "var(--border)" : "var(--warning)"}`,
                color: temKronosys ? "var(--text)" : "var(--warning)",
              }}
            />
            {!temKronosys && (
              <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--warning)" }}>
                Obrigatório para confirmar. Sem ele o cliente veria "confirmado" no
                portal sem nada por trás no ERP.
              </p>
            )}
          </div>

          {canOperate && (
            <StageNavigator
              targets={destinos}
              currentStageKey={order.situacao}
              allStages={SITUACOES.filter(s => s.interno !== false)}
              onMove={mover}
              getKey={(s) => s.id}
            />
          )}

          <Campo label="Entrega">{cliente?.city}</Campo>
        </>
      }
    />
    </>
  );
}

export default OrderDetailDrawer;
