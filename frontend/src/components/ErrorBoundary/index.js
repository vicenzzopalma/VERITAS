import React from "react";
import { Box, Typography, Button } from "@material-ui/core";

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
        <Box
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 16,
            background: "#f5f7fb",
            color: "#172033",
            textAlign: "center",
            padding: 24,
            fontFamily: "'Outfit', 'Inter', sans-serif",
          }}
        >
          <Typography variant="h5" style={{ fontWeight: 800 }}>
            Ops, ocorreu uma instabilidade temporária nesta tela
          </Typography>
          <Typography variant="body2" color="textSecondary" style={{ maxWidth: 480 }}>
            Ocorreu uma falha no carregamento dos dados da interface. Clique no botão abaixo para restaurar a página.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={this.handleReload}
            style={{ marginTop: 8, borderRadius: 12, textTransform: "none", fontWeight: 700 }}
          >
            Recarregar Página
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
