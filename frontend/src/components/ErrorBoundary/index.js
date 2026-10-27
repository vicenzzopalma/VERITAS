import React from "react";
import ErrorOutline from "@material-ui/icons/ErrorOutline";

// Rendered outside the app ThemeProvider (see App.js), so colors are
// hard-coded to match the light theme tokens in src/theme.
const C = {
  bg: "#F4F5FA",
  dot: "rgba(15,18,34,0.09)",
  surface: "#FFFFFF",
  border: "#E6E8F0",
  text: "#0F1222",
  textMuted: "#5F6478",
  primary: "#5B4CF0",
  error: "#E5484D",
  errorSoft: "rgba(229,72,77,0.1)",
  shadowLg: "0 12px 32px -8px rgba(16,24,40,0.14), 0 4px 8px -4px rgba(16,24,40,0.06)",
  font: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary capturou uma falha de renderização:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: C.bg,
            backgroundImage: `radial-gradient(${C.dot} 1px, transparent 1px)`,
            backgroundSize: "18px 18px",
            color: C.text,
            fontFamily: C.font,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              boxShadow: C.shadowLg,
              padding: "32px 28px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                display: "grid",
                placeItems: "center",
                color: C.error,
                backgroundColor: C.errorSoft,
                marginBottom: 4,
              }}
            >
              <ErrorOutline style={{ fontSize: 28 }} />
            </div>
            <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 750, letterSpacing: "-0.02em", lineHeight: 1.3 }}>
              Ops, ocorreu uma instabilidade temporária nesta tela
            </h1>
            <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: C.textMuted }}>
              Ocorreu uma falha no carregamento dos dados da interface. Clique no botão abaixo para restaurar a página.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                marginTop: 8,
                height: 40,
                padding: "0 18px",
                borderRadius: 10,
                border: "none",
                background: C.primary,
                color: "#FFFFFF",
                fontFamily: C.font,
                fontSize: "0.88rem",
                fontWeight: 650,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(16,24,40,0.12)",
              }}
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
