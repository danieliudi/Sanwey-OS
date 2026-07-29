import React, { useState, useRef, useEffect, useCallback } from "react";
import { Modal } from "../ui/Modal";

const STAGE_SIZE = 280;
const OUTPUT_SIZE = 480;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function clampOffset(offset, scaledW, scaledH) {
  const maxX = Math.max(0, (scaledW - STAGE_SIZE) / 2);
  const maxY = Math.max(0, (scaledH - STAGE_SIZE) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

function touchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function AvatarCropModal({ imageSrc, onSave, onCancel }) {
  const [naturalSize, setNaturalSize] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    setNaturalSize(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [imageSrc]);

  const baseScale = naturalSize
    ? Math.max(STAGE_SIZE / naturalSize.w, STAGE_SIZE / naturalSize.h)
    : 1;
  const effectiveScale = baseScale * zoom;
  const scaledW = naturalSize ? naturalSize.w * effectiveScale : STAGE_SIZE;
  const scaledH = naturalSize ? naturalSize.h * effectiveScale : STAGE_SIZE;

  const applyZoom = useCallback((nextZoom, baseOffset) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    setZoom(z);
    if (!naturalSize) return;
    const w = naturalSize.w * baseScale * z;
    const h = naturalSize.h * baseScale * z;
    setOffset(o => clampOffset(baseOffset || o, w, h));
  }, [naturalSize, baseScale]);

  const handleImgLoad = (e) => {
    setNaturalSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    applyZoom(zoom - e.deltaY * 0.0015);
  };

  const handleMouseDown = (e) => {
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, offset };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setOffset(clampOffset({
        x: dragRef.current.offset.x + dx,
        y: dragRef.current.offset.y + dy,
      }, scaledW, scaledH));
    };
    const handleMouseUp = () => {
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [scaledW, scaledH]);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinchRef.current = { dist: touchDistance(e.touches), zoom, offset };
      dragRef.current = null;
    } else if (e.touches.length === 1) {
      dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, offset };
      pinchRef.current = null;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dist = touchDistance(e.touches);
      applyZoom(pinchRef.current.zoom * (dist / pinchRef.current.dist), pinchRef.current.offset);
    } else if (e.touches.length === 1 && dragRef.current) {
      const dx = e.touches[0].clientX - dragRef.current.startX;
      const dy = e.touches[0].clientY - dragRef.current.startY;
      setOffset(clampOffset({
        x: dragRef.current.offset.x + dx,
        y: dragRef.current.offset.y + dy,
      }, scaledW, scaledH));
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length === 0) {
      dragRef.current = null;
      pinchRef.current = null;
    }
  };

  const handleSave = () => {
    if (!imgRef.current || !naturalSize) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    const k = OUTPUT_SIZE / STAGE_SIZE;
    const drawW = scaledW * k;
    const drawH = scaledH * k;
    const centerX = OUTPUT_SIZE / 2 + offset.x * k;
    const centerY = OUTPUT_SIZE / 2 + offset.y * k;
    ctx.drawImage(imgRef.current, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
    onSave(canvas.toDataURL("image/jpeg", 0.92));
  };

  return (
    <Modal open={!!imageSrc} onClose={onCancel} title="Ajustar foto de perfil" width={420}>
      <div className="px-6 py-5 flex flex-col items-center gap-4">
        <div
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            width: STAGE_SIZE,
            height: STAGE_SIZE,
            position: "relative",
            overflow: "hidden",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-strong)",
            background: "var(--surface-alt)",
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
        >
          {imageSrc && (
            <img
              ref={imgRef}
              src={imageSrc}
              alt=""
              onLoad={handleImgLoad}
              draggable={false}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: scaledW,
                height: scaledH,
                maxWidth: "none",
                opacity: naturalSize ? 1 : 0,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          )}
          {!naturalSize && (
            <div
              className="absolute inset-0 flex items-center justify-center text-xs"
              style={{ color: "var(--text-dim)" }}
            >
              Carregando imagem…
            </div>
          )}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: STAGE_SIZE,
              height: STAGE_SIZE,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              boxShadow: "0 0 0 9999px var(--overlay-scrim)",
              pointerEvents: "none",
            }}
          />
        </div>

        <div className="w-full flex items-center gap-3">
          <span className="text-xs shrink-0" style={{ color: "var(--text-dim)" }}>100%</span>
          <input
            type="range"
            min={100}
            max={300}
            value={Math.round(zoom * 100)}
            onChange={e => applyZoom(Number(e.target.value) / 100)}
            disabled={!naturalSize}
            className="flex-1"
            style={{ accentColor: "var(--accent)" }}
          />
          <span className="text-xs shrink-0" style={{ color: "var(--text-dim)" }}>300%</span>
        </div>

        <p className="text-xs text-center" style={{ color: "var(--text-faint)" }}>
          Arraste a foto pra reposicionar. Use o controle acima (ou scroll/pinça) pra dar zoom.
        </p>

        <div
          className="flex justify-end gap-2 w-full pt-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!naturalSize}
            className="px-4 py-2 text-sm rounded-lg font-semibold transition-opacity"
            style={{
              background: "var(--accent)",
              color: "var(--on-accent)",
              opacity: naturalSize ? 1 : 0.5,
              cursor: naturalSize ? "pointer" : "not-allowed",
              border: "none",
            }}
          >
            Salvar foto
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default AvatarCropModal;
