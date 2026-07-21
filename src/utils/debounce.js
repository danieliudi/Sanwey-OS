// Achado de auditoria (baixa prioridade): vários hooks de realtime chamavam
// o refetch completo direto no callback de `postgres_changes`, sem nenhum
// atraso — uma rajada de eventos (import em lote, trigger em cascata,
// múltiplos usuários mexendo ao mesmo tempo) dispara um refetch redundante
// por evento. `debounce` colapsa isso num único refetch após o "silêncio".
export function debounce(fn, delayMs) {
  let timeoutId;
  function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  }
  debounced.cancel = () => clearTimeout(timeoutId);
  return debounced;
}
