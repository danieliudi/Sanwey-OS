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
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={this.reset}
      >
        <div
          className="max-w-md w-full rounded-xl p-5 shadow-lg"
          style={{ background: "#FFFFFF", border: "1px solid #FECACA" }}
          onClick={e => e.stopPropagation()}
        >
          <div className="font-bold text-base mb-2" style={{ color: "#B91C1C" }}>
            Algo deu errado
          </div>
          <div className="text-xs font-mono mb-3 p-2 rounded" style={{ background: "#FEF2F2", color: "#7F1D1D", whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
            {this.state.error?.message || String(this.state.error)}
          </div>
          <button
            onClick={this.reset}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg"
            style={{ background: "#1E4D8C", color: "#FFFFFF" }}
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
