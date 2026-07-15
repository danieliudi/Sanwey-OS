// Pré-filtro barato de qualidade de imagem — roda no canvas, sem custo de
// rede nem de IA, pra rejeitar de graça os casos óbvios (mão tremendo,
// ambiente escuro) antes de gastar uma chamada de IA em cada foto. Não
// substitui a checagem por IA (não detecta corte/reflexo/ângulo), só filtra
// o que dá pra pegar com heurística de pixel.

// Nitidez aproximada: diferença média entre pixels adjacentes (gradiente
// horizontal simples) numa amostra em escala de cinza. Imagem borrada tem
// pouca variação de alta frequência entre vizinhos; imagem nítida tem mais,
// por causa das bordas/texto do documento.
function estimateSharpness(gray, width, height) {
  let total = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 1; x < width; x++) {
      const i = y * width + x;
      total += Math.abs(gray[i] - gray[i - 1]);
      count++;
    }
  }
  return count ? total / count : 0;
}

function estimateBrightness(gray) {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  return gray.length ? sum / gray.length : 0;
}

// Recebe um canvas já com a foto desenhada (qualquer tamanho) e devolve uma
// avaliação rápida. Downsample pra ~200px de largura antes de processar —
// não precisa da imagem em resolução total pra essa heurística.
export function assessImageQuality(sourceCanvas) {
  const targetWidth = Math.min(200, sourceCanvas.width);
  const scale = targetWidth / sourceCanvas.width;
  const targetHeight = Math.max(1, Math.round(sourceCanvas.height * scale));

  const small = document.createElement("canvas");
  small.width = targetWidth;
  small.height = targetHeight;
  const ctx = small.getContext("2d");
  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  const { data } = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const gray = new Uint8ClampedArray(targetWidth * targetHeight);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const sharpness = estimateSharpness(gray, targetWidth, targetHeight);
  const brightness = estimateBrightness(gray);

  return {
    sharpness,
    brightness,
    likelyBlurry: sharpness < 6,
    likelyDark: brightness < 40,
    likelyBright: brightness > 235,
  };
}

export default assessImageQuality;
