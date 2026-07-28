// Checagem de cliente duplicado por CNPJ — usada em todo caminho de criação
// (ClientsManager, ClientQuickCreateModal, e o guard central em
// use-clients.js/createClient). Extraído depois da 3ª implementação da mesma
// lógica (regra 4 do CLAUDE.md).

export function normalizeCnpjDigits(cnpj) {
  return (cnpj || "").replace(/\D/g, "");
}

export function findClientByCnpj(clients, cnpj, { excludeId } = {}) {
  const digits = normalizeCnpjDigits(cnpj);
  if (digits.length !== 14) return null;
  return clients.find(c => c.id !== excludeId && normalizeCnpjDigits(c.cnpj) === digits) || null;
}

// Lançado por use-clients.js/createClient quando o CNPJ já existe — todo
// caminho de criação (UI) deve tratar isso oferecendo usar o cliente
// existente em vez de deixar o erro estourar cru.
export class DuplicateClientError extends Error {
  constructor(existingClient) {
    super(`Já existe um cliente com esse CNPJ: ${existingClient.name}.`);
    this.name = "DuplicateClientError";
    this.existingClient = existingClient;
  }
}
