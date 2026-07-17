import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X, RotateCcw, Loader2, AlertTriangle, Upload } from "lucide-react";
import { assessImageQuality } from "../../utils/image-quality";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Ferramenta de captura de documento com moldura-guia (câmera) + checagem de
// qualidade 100% local (desfoque/brilho via canvas, ver utils/image-quality)
// — nenhum documento de identidade sai do navegador. Existiu uma checagem
// extra via IA (check-document-legibility, chave da empresa) que foi
// removida por decisão explícita: documento de colaborador não pode passar
// por nenhuma IA, nem a paga pela própria empresa. Sempre tem fallback pro
// input de arquivo tradicional — câmera indisponível/permissão negada não
// deve travar quem só quer anexar o PDF.
export function DocumentCaptureModal({ onCapture, onClose, title = "Capturar documento" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [phase, setPhase] = useState("camera"); // camera | checking | rejected
  const [rejection, setRejection] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Câmera não disponível neste dispositivo.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
      } catch (err) {
        setCameraError(err?.message || "Não foi possível acessar a câmera.");
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const processFile = useCallback(async (file) => {
    setPhase("checking");
    setRejection(null);

    if (file.type !== "application/pdf" && typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file).catch(() => null);
      if (bitmap) {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d").drawImage(bitmap, 0, 0);
        const quality = assessImageQuality(canvas);
        if (quality.likelyBlurry) {
          setRejection({ motivo: "A foto parece desfocada.", sugestao: "Segure o celular firme e tente de novo." });
          setPhase("rejected");
          return;
        }
        if (quality.likelyDark) {
          setRejection({ motivo: "A foto está escura demais.", sugestao: "Tire a foto em um local com mais luz." });
          setPhase("rejected");
          return;
        }
      }
    }

    onCapture(file);
  }, [onCapture]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      processFile(new File([blob], `documento-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }, [processFile]);

  const handleFileInput = useCallback((f) => {
    if (!f || !ALLOWED_TYPES.includes(f.type) || f.size > MAX_FILE_SIZE) return;
    processFile(f);
  }, [processFile]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "var(--shadow-pop)", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {phase === "checking" && (
            <div className="flex flex-col items-center justify-center gap-2" style={{ padding: "40px 0" }}>
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Checando qualidade da foto…</div>
            </div>
          )}

          {phase === "rejected" && rejection && (
            <div className="flex flex-col items-center gap-3" style={{ padding: "20px 0" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={20} style={{ color: "var(--warning)" }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textAlign: "center" }}>{rejection.motivo}</div>
              {rejection.sugestao && <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>{rejection.sugestao}</div>}
              <button
                onClick={() => setPhase("camera")}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "#FFF", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                <RotateCcw size={13} /> Tentar de novo
              </button>
            </div>
          )}

          {phase === "camera" && (
            <>
              {!cameraError && (
                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", aspectRatio: "4/3" }}>
                  <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: "8% 6%", border: "2px dashed rgba(255,255,255,0.85)", borderRadius: 8, pointerEvents: "none" }} />
                  {!cameraReady && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Loader2 size={20} className="animate-spin" style={{ color: "#FFF" }} />
                    </div>
                  )}
                </div>
              )}
              {cameraError && (
                <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", padding: "12px 0" }}>
                  Não foi possível acessar a câmera. Envie o arquivo direto.
                </div>
              )}

              <div className="flex gap-2 mt-4">
                {!cameraError && (
                  <button
                    onClick={handleCapture}
                    disabled={!cameraReady}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--accent)", color: "#FFF", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: cameraReady ? "pointer" : "default", opacity: cameraReady ? 1 : 0.6 }}
                  >
                    <Camera size={15} /> Capturar
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ flex: cameraError ? 1 : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  <Upload size={15} /> {cameraError ? "Selecionar arquivo" : "Enviar arquivo"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  style={{ display: "none" }}
                  onChange={(e) => handleFileInput(e.target.files?.[0] || null)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentCaptureModal;
