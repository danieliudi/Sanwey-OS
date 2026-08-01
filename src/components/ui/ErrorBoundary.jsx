import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }
  reset = () => this.setState({ error: null });
  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
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
          <button
            onClick={this.reset}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
