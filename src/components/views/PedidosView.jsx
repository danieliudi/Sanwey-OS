import React, { useMemo, useState } from "react";
import { Download, Plus, ClipboardList, AlertTriangle } from "lucide-react";
import { FilterBar } from "../shared/FilterBar";
import { KanbanFab } from "../shared/KanbanFab";
import { AppToast } from "../shared/AppToast";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { useOrders, useOrderItems, COLUNAS_INTERNAS, SITUACOES, ORIGENS } from "../../hooks/use-orders";
import { useProducts } from "../../hooks/use-products";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { formatBRL } from "../../utils/currency";
import { csvRow, triggerDownload } from "../../utils/export-csv";
import { OrderDetailDrawer } from "../pedidos/OrderDetailDrawer";
import { NovoPedidoModal } from "../pedidos/NovoPedidoModal";

// Comercial → Pedidos. Onde o pedido chega, é conferido e vira número no
// Kronosys. Vale antes de o portal existir: o botão "Novo pedido" registra o
// que hoje chega por WhatsApp e vira planilha.
//
// Header fora do bloco condicional (regra 11) e filtro compartilhado — o
// mesmo array filtrado alimenta tudo que a tela mostrar.

const DIAS_PARADO = 3;

function diasDesde(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function OrderCard({ order, cliente, onOpen }) {
  const parado = diasDesde(order.updated_at) >= DIAS_PARADO
    && ["conferencia", "confirmado", "producao"].includes(order.situacao);
  const origem = ORIGENS.find(o => o.id === order.origem);
  return (
    <button
      onClick={() => onOpen(order)}
      className="w-full text-left rounded-lg p-2.5 mb-2 transition-colors cursor-pointer"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold" style={{ color: "var(--text-dim)" }}>#{order.numero}</span>
        <div className="flex gap-1">
          {parado && (
            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold"
                  style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
              {diasDesde(order.updated_at)} DIAS
            </span>
          )}
          {origem && (
            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold"
                  style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
              {origem.label.toUpperCase()}
            </span>
          )}
        </div>
      </div>
      <p className="text-[12.5px] font-semibold mt-0.5 mb-1.5" style={{ color: "var(--text)", lineHeight: 1.3 }}>
        {cliente?.name || "Cliente removido"}
      </p>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-bold" style={{ color: "var(--text)" }}>{formatBRL(order.total)}</span>
        {order.kronosys_numero && (
          <span className="text-[10.5px] font-semibold" style={{ color: "var(--text-dim)" }}>{order.kronosys_numero}</span>
        )}
      </div>
    </button>
  );
}

export function PedidosView({
  clients = [], users = [], accessibleCompanies = COMPANY_IDS,
  canOperate = false, currentUser,
}) {
  const { orders, loading, stats, createOrder, updateOrder, moveOrder } = useOrders();
  const { products } = useProducts();
  const [search, setSearch]     = useState("");
  const [empresa, setEmpresa]   = useState("all");
  const [vendedor, setVendedor] = useState("all");
  const [origem, setOrigem]     = useState("all");
  const [aberto, setAberto]     = useState(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [toast, setToast]       = useState(null);
  // [ref, altura] — o ref vai no container rolável do quadro, senão a
  // barra de rolagem das colunas sai da tela (motivo do hook existir).
  const [boardRef, boardHeight] = useAvailableHeight(16);

  const clientsById = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]);
  const usersById   = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users]);
  const productsById = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      if (empresa !== "all" && o.company_id !== empresa) return false;
      if (origem !== "all" && o.origem !== origem) return false;
      if (vendedor !== "all") {
        const dono = clientsById[o.client_id]?.ownerIds || [];
        if (!dono.includes(vendedor)) return false;
      }
      if (!q) return true;
      const nome = (clientsById[o.client_id]?.name || "").toLowerCase();
      return nome.includes(q) || String(o.numero).includes(q)
        || (o.kronosys_numero || "").toLowerCase().includes(q);
    });
  }, [orders, search, empresa, vendedor, origem, clientsById]);

  // Exporta o array JÁ FILTRADO (regra 11), nunca o cru.
  const handleExport = () => {
    const header = ["Nº", "Cliente", "Empresa", "Situação", "Origem", "Nº Kronosys", "Total", "Criado em"];
    const linhas = filtrados.map(o => csvRow([
      o.numero, clientsById[o.client_id]?.name || "", COMPANIES[o.company_id]?.name || o.company_id,
      SITUACOES.find(s => s.id === o.situacao)?.name || o.situacao,
      ORIGENS.find(x => x.id === o.origem)?.label || o.origem,
      o.kronosys_numero || "", o.total, o.created_at?.slice(0, 10) || "",
    ]));
    triggerDownload("pedidos.csv", [csvRow(header), ...linhas].join("\n"));
  };

  const vendedores = users.filter(u => (u.roles || []).some(r => ["vendedor", "gerente"].includes(r)));

  return (
    <div className="space-y-4">
      {/* Header renderizado ANTES do bloco de conteúdo — nunca reflui (regra 11) */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text)", letterSpacing: "-0.015em" }}>Pedidos</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
            {stats.emConferencia} aguardando conferência
            {stats.parados > 0 && ` · ${stats.parados} parado${stats.parados > 1 ? "s" : ""} há mais de ${DIAS_PARADO} dias`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
            <Download size={13} /> Exportar CSV
          </button>
          {canOperate && (
            <button onClick={() => setNovoOpen(true)} data-tour="pedidos-novo"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
                    style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
              <Plus size={13} /> Novo pedido
            </button>
          )}
        </div>
      </div>

      {stats.parados > 0 && (
        <div className="rounded-lg px-3.5 py-2.5 text-xs flex items-center gap-2"
             style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
          <AlertTriangle size={14} style={{ flex: "none" }} />
          {stats.parados} pedido{stats.parados > 1 ? "s" : ""} sem movimento há mais de {DIAS_PARADO} dias — o cliente está no escuro.
        </div>
      )}

      <FilterBar
        search={{ value: search, onChange: e => setSearch(e.target.value), placeholder: "Buscar cliente, nº do pedido ou Kronosys…" }}
        filters={[
          { id: "empresa", value: empresa, onChange: e => setEmpresa(e.target.value), label: "Empresa",
            options: [{ value: "all", label: "Todas as empresas" },
                      ...accessibleCompanies.map(c => ({ value: c, label: COMPANIES[c]?.name || c }))] },
          { id: "vendedor", value: vendedor, onChange: e => setVendedor(e.target.value), label: "Vendedor",
            options: [{ value: "all", label: "Todos os vendedores" },
                      ...vendedores.map(u => ({ value: u.id, label: u.name }))] },
          { id: "origem", value: origem, onChange: e => setOrigem(e.target.value), label: "Origem",
            options: [{ value: "all", label: "Todas as origens" },
                      ...ORIGENS.map(o => ({ value: o.id, label: o.label }))] },
        ]}
      />

      {loading ? (
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>Carregando…</p>
      ) : (
        <div ref={boardRef} className="flex gap-2.5 overflow-x-auto pb-2" style={{ height: boardHeight }}>
          {COLUNAS_INTERNAS.map(col => {
            const daColuna = filtrados.filter(o => o.situacao === col.id);
            const soma = daColuna.reduce((acc, o) => acc + Number(o.total || 0), 0);
            return (
              <div key={col.id} className="flex flex-col rounded-xl"
                   style={{ background: "var(--surface-alt)", minWidth: 208, flex: 1 }}>
                <div style={{ height: 3, background: col.color, borderRadius: "12px 12px 0 0" }} />
                <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
                  <div>
                    <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{col.name}</span>
                    <span className="text-[11px] font-semibold ml-1.5" style={{ color: "var(--text-dim)" }}>({daColuna.length})</span>
                  </div>
                  {soma > 0 && (
                    <span className="text-[10.5px] font-semibold" style={{ color: "var(--text-dim)" }}>{formatBRL(soma)}</span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-2">
                  {daColuna.length === 0 ? (
                    <div className="rounded-lg py-6 px-2 text-center text-[11px]"
                         style={{ border: "1px dashed var(--border)", color: "var(--text-dim)" }}>
                      Nenhum pedido
                    </div>
                  ) : daColuna.map(o => (
                    <OrderCard key={o.id} order={o} cliente={clientsById[o.client_id]} onOpen={setAberto} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {orders.length === 0 && !loading && (
        <div className="rounded-xl p-6 text-center" style={{ border: "1px dashed var(--border)" }}>
          <ClipboardList size={22} style={{ color: "var(--text-dim)", margin: "0 auto 8px" }} />
          <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>Nenhum pedido ainda</p>
          <p className="text-xs mt-1 mx-auto" style={{ color: "var(--text-dim)", maxWidth: "52ch" }}>
            Esta tela já serve antes do portal existir: use "Novo pedido" para registrar
            o que chega por WhatsApp, com o preço que aquele cliente já tem negociado.
          </p>
        </div>
      )}

      {canOperate && <KanbanFab onClick={() => setNovoOpen(true)} label="Novo pedido" />}

      {aberto && (
        <OrderDetailDrawer
          order={orders.find(o => o.id === aberto.id) || aberto}
          onClose={() => setAberto(null)}
          onMove={moveOrder}
          onUpdate={updateOrder}
          clientsById={clientsById}
          usersById={usersById}
          productsById={productsById}
          canOperate={canOperate}
          currentUser={currentUser}
        />
      )}

      {novoOpen && (
        <NovoPedidoModal
          open={novoOpen}
          onClose={() => setNovoOpen(false)}
          clients={clients}
          products={products}
          accessibleCompanies={accessibleCompanies}
          onCreate={createOrder}
          onDone={() => setToast("Pedido criado.")}
        />
      )}

      {toast && <AppToast title={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

export default PedidosView;
