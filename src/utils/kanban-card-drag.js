// HTML5 DnD captura o bitmap do card no dragstart — se o tilt só entrar via
// setState/React, o fantasma sai reto. Classe síncrona + setDragImage de um
// clone já tombado deixa o “carregando” visível enquanto arrasta.
const DRAG_TILT =
  "scale(1.02) rotate(1.5deg)";

export function startKanbanCardDrag(event, setDragging) {
  const el = event.currentTarget;
  el.classList.add("is-dragging");
  setDragging(true);

  try {
    const clone = el.cloneNode(true);
    clone.classList.add("is-dragging");
    clone.style.position = "fixed";
    clone.style.top = "-9999px";
    clone.style.left = "-9999px";
    clone.style.width = `${el.offsetWidth}px`;
    clone.style.margin = "0";
    clone.style.transform = DRAG_TILT;
    clone.style.boxShadow = "var(--shadow-drag)";
    clone.style.opacity = "0.95";
    clone.style.pointerEvents = "none";
    document.body.appendChild(clone);
    const offsetX = Math.min(event.offsetX || el.offsetWidth / 2, el.offsetWidth);
    const offsetY = Math.min(event.offsetY || 20, el.offsetHeight);
    event.dataTransfer.setDragImage(clone, offsetX, offsetY);
    requestAnimationFrame(() => {
      clone.remove();
    });
  } catch {
    // setDragImage não é suportado em todo browser — a classe .is-dragging
    // no source ainda vale pro settle/opacity.
  }
}

export function endKanbanCardDrag(event, setDragging) {
  event.currentTarget?.classList.remove("is-dragging");
  setDragging(false);
}
