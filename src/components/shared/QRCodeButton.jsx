import React, { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { QrCode, X, Download, Check, Link2 } from "lucide-react";

// Botão + modal de QR code (Onda 2, item 5) — para impressão/exibição no local
// (banco de talentos, vaga aberta). Aponta para uma URL pública já existente;
// o QR é gerado 100% no cliente (qrcode.react), sem chamada externa.
export function QRCodeButton({ url, title, buttonLabel = "QR code", compact = false }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasWrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  const handleDownload = () => {
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    const safe = (title || "qrcode").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.download = `qr-${safe || "sanwey"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponível — ignora */ }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Gerar QR code para impressão"
        style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: compact ? "5px 10px" : "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--text)", cursor: "pointer" }}
      >
        <QrCode size={12} /> {buttonLabel}
      </button>

      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 340, boxShadow: "var(--shadow-pop)", padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>QR code</div>
                {title && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>}
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "flex", flexShrink: 0 }}>
                <X size={18} />
              </button>
            </div>

            <div ref={canvasWrapRef} style={{ display: "flex", justifyContent: "center", padding: 16, background: "#FFFFFF", borderRadius: 12, border: "1px solid var(--border)" }}>
              <QRCodeCanvas value={url} size={200} level="M" includeMargin marginSize={2} />
            </div>

            <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", marginTop: 10, wordBreak: "break-all" }}>{url}</div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleDownload} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--accent)", color: "#FFF", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
                <Download size={14} /> Baixar PNG
              </button>
              <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {copied ? <Check size={14} color="var(--success)" /> : <Link2 size={14} />} {copied ? "Copiado!" : "Link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default QRCodeButton;
