import React, { useState } from "react";
import { Check, Link2 } from "lucide-react";

// Botão "Copiar link público" — extraído de 5 implementações independentes
// (3x dentro de RHRecrutamentoView.jsx + 1x em MarketingRequestsView.jsx +
// 1x em ComprasMarketingView.jsx, achado da auditoria de consistência).
// Padrão de confirmação (ícone + label trocam por até 2s após copiar) segue
// o que já era majoritário entre as implementações — ver CLAUDE.md.
//
// `url` aceita string ou função (resolvida no clique, útil quando o link
// depende de estado que só é conhecido no momento do clique).
//
// `variant="strong"` restaura o destaque de botão inteiro em verde que
// MarketingRequestsView/ComprasMarketingView já tinham antes desta extração
// (achado real do QA adversarial: a 1ª versão deste componente unificou os
// 5 lugares no padrão mais discreto do RH, perdendo esse destaque nos 2
// call sites de Marketing — corrigido aqui em vez de revertido).
export function CopyPublicLinkButton({
  url,
  label = "Copiar link",
  copiedLabel = "Link copiado!",
  title,
  variant = "subtle",
}) {
  const [copied, setCopied] = useState(false);
  const strong = variant === "strong";

  const handleCopy = async () => {
    const link = typeof url === "function" ? url() : url;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link:", link);
    }
  };

  const style = strong
    ? {
        display: "flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
        background: copied ? "#DCFCE7" : "var(--surface)",
        border: `1px solid ${copied ? "#BBF7D0" : "var(--border)"}`,
        color: copied ? "#15803D" : "var(--text)",
      }
    : {
        display: "flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
        background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)",
      };

  return (
    <button onClick={handleCopy} title={title} style={style}>
      {copied
        ? <Check size={strong ? 13 : 12} color={strong ? "#15803D" : "var(--success)"} />
        : <Link2 size={strong ? 13 : 12} />}
      {copied ? copiedLabel : label}
    </button>
  );
}

export default CopyPublicLinkButton;
