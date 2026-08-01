import React from "react";
import { relativeTime } from "../../utils/date";

// Faixa global — só visível offline. Mostrando dados salvos do último
// snapshot em vez de tela vazia (ver use-leads.js readLeadsSnapshot/cacheAge).
export function OfflineBanner({ isOnline, cacheAge }) {
  if (isOnline) return null;

  const text = cacheAge
    ? `Sem conexão — mostrando dados salvos de ${relativeTime(cacheAge)}`
    : "Sem conexão";

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium"
      style={{
        background: "var(--warning-bg)",
        color: "var(--warning)",
        borderBottom: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--warning)", flexShrink: 0 }} />
      {text}
    </div>
  );
}

export default OfflineBanner;
