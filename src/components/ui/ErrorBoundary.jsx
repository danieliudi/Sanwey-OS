import React from "react";

// `onReport` (opcional) recebe o erro e abre o formulário de report já com o
// contexto técnico anexado. Sem ele o componente se comporta como antes —
// os dois pontos de montagem em App.jsx passam, mas o ErrorBoundary é
// genérico e pode ser usado sem isso.
//
// Por que este botão existe (mockup aprovado 02/09/2026): até aqui esta tela
// oferecia UM botão, "Fechar". Era o momento de maior motivação e maior
// contexto da pessoa — a plataforma sabia a mensagem, a pilha, a rota e o
// navegador — e jogava tudo fora pedindo que ela fosse até a Central de Bugs
// reconstruir de memória. O time de Marketing chamava isso de preguiça.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, reportado: false };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }
  reset = () => this.setState({ error: null, reportado: false });

  reportar = () => {
    this.props.onReport?.(this.state.error);
    // Não fecha a tela de erro: quem reportou ainda pode querer recarregar ou
    // ler a mensagem. Só troca o botão pela confirmação.
    this.setState({ reportado: true });
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) {
      return this.props.fallback({
        error: this.state.error,
        reset: this.reset,
        reportar: this.props.onReport ? this.reportar : null,
        reportado: this.state.reportado,
      });
    }
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ background: "var(--overlay-scrim)" }}
        onClick={this.reset}
      >
        <div
          className="max-w-md w-full rounded-xl p-5 shadow-lg"
          style={{ background: "var(--surface)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}
          onClick={e => e.stopPropagation()}
        >
          <div className="font-bold text-base mb-2" style={{ color: "var(--danger)" }}>
            Algo deu errado
          </div>
          <div className="text-xs font-mono mb-3 p-2 rounded" style={{ background: "var(--danger-bg)", color: "var(--danger)", whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
            {this.state.error?.message || String(this.state.error)}
          </div>
          {this.props.onReport && (
            <div className="text-xs mb-3 p-2 rounded" style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}>
              {this.state.reportado
                ? "Recebemos — obrigado. Já está na fila de correção."
                : "Ao reportar, anexamos sozinhos a tela, o navegador e o erro técnico. Você não precisa tirar print."}
            </div>
          )}
          <div className="flex gap-2">
            {this.props.onReport && !this.state.reportado && (
              <button
                onClick={this.reportar}
                data-tour="reportar-da-tela-de-erro"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                style={{ background: "var(--danger)", color: "#fff", border: "none", cursor: "pointer" }}
              >
                Reportar isso
              </button>
            )}
            <button
              onClick={this.reset}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg"
              style={{ background: this.props.onReport ? "transparent" : "var(--accent)", color: this.props.onReport ? "var(--text-dim)" : "var(--on-accent)", border: this.props.onReport ? "1px solid var(--border)" : "none", cursor: "pointer" }}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
