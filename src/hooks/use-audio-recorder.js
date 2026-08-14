import { useCallback, useEffect, useRef, useState } from "react";

// Gravação de áudio no navegador — a mecânica, sem opinião de UI.
//
// A lógica aqui não é nova: saiu do gravador de voz do Chat
// (ChatView.jsx, `startRecording`/`finishRecording`), que já resolvia dois
// detalhes que não são óbvios e que uma reimplementação erraria de novo:
//
//   1. Negociação de formato — nem todo navegador suporta "audio/webm";
//      Safari cai pra "audio/ogg" ou pro padrão do próprio MediaRecorder.
//   2. O sufixo de codec — `recorder.mimeType` volta como
//      "audio/webm;codecs=opus" MESMO quando só "audio/webm" foi pedido, e o
//      bucket do Storage só libera o mimetype base. Sem cortar o sufixo, o
//      upload é recusado (bug real, corrigido no Chat na migration 20260815).
//
// Deliberadamente NÃO extraí a UI junto: o Chat usa pressionar-e-segurar com
// arrastar-pra-cancelar (idioma de mensageiro) e a ata de voz usa
// tocar-pra-começar/tocar-pra-parar (a pessoa acabou de sair de uma reunião,
// não vai segurar o dedo por um minuto). São gestos diferentes sobre a mesma
// mecânica — que é exatamente o que um hook resolve e um componente não.
//
// O ChatView continua com a cópia dele por ora: é código vivo e testado, e
// refatorar o áudio do Chat no mesmo commit que estreia a ata seria arriscar
// os dois de uma vez. Na 3ª ocorrência (regra 4 do CLAUDE.md), migra-se o
// Chat pra cá.

export const AUDIO_MAX_SECONDS = 300; // 5 min — ata é resumo, não reunião inteira

export function useAudioRecorder({ maxSeconds = AUDIO_MAX_SECONDS } = {}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds]     = useState(0);
  const [error, setError]         = useState(null);

  const recorderRef = useRef(null);
  const streamRef   = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);
  const secondsRef  = useRef(0);

  const releaseStream = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Solta o microfone se o componente sair da tela no meio da gravação —
  // sem isso o indicador de "gravando" do navegador fica aceso pra sempre.
  useEffect(() => () => {
    try { if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop(); } catch { /* já parado */ }
    releaseStream();
  }, [releaseStream]);

  const supported = typeof window !== "undefined"
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== "undefined";

  const start = useCallback(async () => {
    if (recording) return false;
    if (!supported) {
      setError("Este navegador não permite gravar áudio. Você ainda pode escrever a ata.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : (MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg" : "");
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start();
      recorderRef.current = recorder;
      streamRef.current   = stream;
      secondsRef.current  = 0;
      setSeconds(0);
      setError(null);
      setRecording(true);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        // Corta sozinho no teto: melhor uma ata truncada de 5 min do que um
        // arquivo que estoura o limite do bucket e falha só no upload.
        if (secondsRef.current >= maxSeconds) {
          try { if (recorderRef.current?.state !== "inactive") recorderRef.current.stop(); } catch { /* ignora */ }
        }
      }, 1000);
      return true;
    } catch {
      setError("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
      return false;
    }
  }, [recording, supported, maxSeconds]);

  // Para e devolve o arquivo. Retorna null se não houver áudio nenhum —
  // quem chama trata isso como "não gravou", não como erro.
  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    const durationSeconds = secondsRef.current;

    await new Promise(resolve => {
      recorder.onstop = resolve;
      if (recorder.state !== "inactive") recorder.stop(); else resolve();
    });

    // Ver comentário 2 no topo: corta o ";codecs=opus" antes de montar o
    // arquivo, senão o Storage recusa o upload pelo mimetype.
    const baseMimeType = (recorder.mimeType || "audio/webm").split(";")[0].trim() || "audio/webm";
    const chunks = chunksRef.current;

    releaseStream();
    recorderRef.current = null;
    setRecording(false);

    if (chunks.length === 0) return null;

    const blob = new Blob(chunks, { type: baseMimeType });
    const ext  = baseMimeType.includes("ogg") ? "ogg" : "webm";
    const file = new window.File([blob], `ata-${Date.now()}.${ext}`, { type: baseMimeType });
    return { file, blob, mimeType: baseMimeType, durationSeconds };
  }, [releaseStream]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      try { if (recorder.state !== "inactive") recorder.stop(); } catch { /* já parado */ }
    }
    chunksRef.current = [];
    releaseStream();
    recorderRef.current = null;
    setRecording(false);
    setSeconds(0);
    secondsRef.current = 0;
  }, [releaseStream]);

  return { supported, recording, seconds, error, setError, start, stop, cancel };
}

export function formatRecordingTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Ata iniciada pelo CLIENTE (AtaVozPanel modo "client"): o negócio ainda não
// existe quando o áudio é gravado, e lead-attachments exige lead_id — não há
// onde subir o arquivo antes de saber o destino. Por isso esse caminho manda
// o áudio embutido no corpo da chamada (crm-ata-voz aceita audioBase64) em
// vez de um caminho no Storage; o upload de verdade só acontece depois, se e
// quando um lead (existente ou recém-criado) for escolhido como destino.
export async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Mesmo cuidado do lado do servidor (crm-ata-voz/index.ts, toBase64): btoa
  // em pedaços, senão String.fromCharCode(...bytes) estoura a pilha num
  // áudio de alguns MB — que é o tamanho normal de uma ata de alguns minutos.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export default useAudioRecorder;
