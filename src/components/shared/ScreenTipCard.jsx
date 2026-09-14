import React from "react";
import { AppToast } from "./AppToast";

// Painel de chegada numa tela — 1 frase do que a tela é, 1 primeira ação, e o
// caminho pro guia completo.
//
// Mockup aprovado com o Daniel em 14/09/2026 ("A dica de tela não cabe na
// tela"), depois de ele abrir a Visão Geral de RH e receber 8 itens de texto
// corrido com os 3 primeiros fora da viewport: "Você acha que alguém vai ler
// isso? Ninguém vai ler isso assim. Textão corrido."
//
// A restrição que decidiu o desenho: o texto do painel é O MESMO de Ajuda &
// Tutoriais. Encurtar `steps` pro painel encurtaria o guia completo junto, e
// aí quem quer de fato aprender a tela é quem perde. Por isso nada foi
// cortado — `resumo` e `comece` são campos NOVOS, curtos, e `steps` continua
// intocado, servindo a tela de Ajuda.
//
// Três opções foram mostradas (cortar em 3 passos / resumo + primeiro passo /
// só o botão "?"). A segunda foi a escolhida; as outras duas e o porquê de
// cada descarte estão no mockup. Não é a única resposta possível — é a
// escolhida, registrada pra não ser redecidida do zero na próxima sessão.
export function ScreenTipCard({ tip, titulo, onDismiss, onVerGuia, onComecar }) {
  if (!tip?.resumo) return null;

  const passos = tip.steps?.length || 0;
  const comeceTexto = typeof tip.comece === "string" ? tip.comece : tip.comece?.texto;
  // `comece` aceita string (só texto) ou { texto, alvo } — quando tem `alvo`,
  // vira botão que leva até o elemento de verdade. Decidido com o Daniel
  // 14/09/2026 ("pode fazer"): ler onde clicar é pior que ser levado até lá.
  const podeExecutar = typeof tip.comece === "object" && !!tip.comece?.alvo && !!onComecar;

  return (
    <AppToast onDismiss={onDismiss}>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <div>
          <span style={{
            display: "inline-block", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--accent)", background: "var(--accent-tint)",
            padding: "2px 6px", borderRadius: 4, marginBottom: 6,
          }}>
            {titulo}
          </span>
          {/* O `resumo` é a linha principal, não um subtítulo: com 90–150
              caracteres ele É a frase que responde "o que é isto e por que eu
              abriria". O nome da tela já está na etiqueta acima. */}
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.45, margin: 0 }}>
            {tip.resumo}
          </p>
        </div>

        {comeceTexto && (
          <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
            <span style={{
              display: "block", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 3,
            }}>
              Comece por
            </span>
            <p style={{ fontSize: 11, lineHeight: 1.45, color: "var(--text)", margin: 0 }}>{comeceTexto}</p>
            {podeExecutar && (
              <button
                onClick={() => onComecar(tip.comece.alvo)}
                style={{
                  marginTop: 7, fontSize: 11, fontWeight: 700, color: "var(--on-accent)",
                  background: "var(--accent)", border: "none", borderRadius: 7,
                  padding: "5px 11px", cursor: "pointer",
                }}
              >
                {tip.comece.rotulo || "Me leva lá"}
              </button>
            )}
          </div>
        )}

        {passos > 0 && onVerGuia && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
            <button
              onClick={onVerGuia}
              style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              Ver guia completo →
            </button>
            <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
              {passos === 1 ? "1 passo" : `${passos} passos`}
            </span>
          </div>
        )}
      </div>
    </AppToast>
  );
}

export default ScreenTipCard;
