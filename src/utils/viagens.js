// Helpers e mapas compartilhados entre as views de Viagens & Despesas
// (Planejamento, Gestor, Relatórios) — evita 3 cópias divergentes das
// mesmas regras de negócio (papéis comerciais, rótulos de status, etc).

export const COMERCIAL_ROLES = new Set(["vendedor", "consultor", "gerente"]);

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthKeyOf(dateStr) {
  return dateStr ? String(dateStr).slice(0, 7) : null;
}

export function monthLabel(monthKey) {
  if (!monthKey) return "—";
  const [y, m] = monthKey.split("-").map(Number);
  const label = new Date(y, (m || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function fmtMoney(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const STATUS_VISITA = {
  planejado:     { label: "Planejado",     variant: "secondary" },
  realizado:     { label: "Realizado",     variant: "success" },
  nao_realizado: { label: "Não realizado", variant: "critical" },
  cancelado:     { label: "Cancelado",     variant: "neutral" },
};

export const STATUS_REEMBOLSO = {
  pendente:  { label: "Pendente",  variant: "urgent" },
  aprovado:  { label: "Aprovado",  variant: "success" },
  rejeitado: { label: "Rejeitado", variant: "critical" },
  pago:      { label: "Pago",      variant: "dark" },
};
