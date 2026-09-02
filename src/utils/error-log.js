// Anel de memória dos últimos erros do navegador.
//
// Existe por causa de um buraco encontrado em 02/09/2026: a plataforma não
// escutava `window.onerror` nem `unhandledrejection` em lugar nenhum. Isso
// significa que o bug MAIS comum — o que não quebra a tela (um salvamento
// barrado pela RLS, um fetch que falhou, uma promise rejeitada) — não deixava
// rastro nenhum. O ErrorBoundary só pega erro de renderização; tudo que
// acontece dentro de um clique ou de um `await` passa direto por ele.
//
// O anel é pequeno de propósito (8 entradas): o objetivo não é telemetria, é
// dar à pessoa que reporta o pedaço técnico que ela não saberia descrever.
// Fica só em memória — nada é persistido no navegador nem enviado sozinho;
// só viaja quando ALGUÉM aperta "Reportar".

const LIMITE = 8;
const MAX_TEXTO = 300;

const anel = [];
let instalado = false;

function registrar(tipo, texto) {
  if (!texto) return;
  const msg = String(texto).slice(0, MAX_TEXTO);
  const ultimo = anel[anel.length - 1];
  // Erro repetido em loop (um render que falha a cada frame) encheria o anel
  // com a mesma linha e jogaria fora o histórico útil — conta em vez disso.
  if (ultimo && ultimo.tipo === tipo && ultimo.msg === msg) {
    ultimo.vezes = (ultimo.vezes || 1) + 1;
    ultimo.em = new Date().toISOString();
    return;
  }
  anel.push({ tipo, msg, em: new Date().toISOString() });
  if (anel.length > LIMITE) anel.shift();
}

export function instalarCapturaDeErros() {
  if (instalado || typeof window === "undefined") return;
  instalado = true;

  window.addEventListener("error", (e) => {
    // `error` também dispara para recurso que não carregou (img/script), e aí
    // não existe `e.error` — o alvo é que interessa.
    if (e?.error) registrar("erro", e.error.message || String(e.error));
    else if (e?.target?.src || e?.target?.href) registrar("recurso", `não carregou: ${e.target.src || e.target.href}`);
  }, true);

  window.addEventListener("unhandledrejection", (e) => {
    const r = e?.reason;
    registrar("promise", r?.message || (typeof r === "string" ? r : JSON.stringify(r)?.slice(0, MAX_TEXTO)));
  });

  // console.error é onde a maioria dos erros de Supabase deste código termina
  // (vários hooks fazem `console.error` e seguem em frente). Encapsula sem
  // engolir: o original continua sendo chamado.
  const original = console.error;
  console.error = (...args) => {
    try {
      registrar("console", args.map(a => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    } catch { /* nunca deixar a captura quebrar o log de verdade */ }
    original.apply(console, args);
  };
}

export function ultimosErros() {
  return anel.map(e => ({ ...e }));
}

// Só para teste e para o "limpar" depois de um report enviado — sem isso, o
// mesmo erro viajaria de novo no próximo report da mesma sessão.
export function limparErros() {
  anel.length = 0;
}
