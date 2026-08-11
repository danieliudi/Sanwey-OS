// Escapa os 5 caracteres que quebram HTML — usado antes de interpolar
// qualquer string vinda de dado do usuário (inclusive dado de formulário
// PÚBLICO, sem login, como o nome de cliente em submit_lead_capture) dentro
// de um e-mail HTML real. Achado da revisão de QA (11/08/2026, aba Email do
// Funil de Vendas): sem isso, um "nome de cliente" malicioso enviado pelo
// formulário público de captura de lead virava HTML de verdade no corpo de
// um e-mail assinado noreply@sanwey.com.br.
export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default escapeHtml;
