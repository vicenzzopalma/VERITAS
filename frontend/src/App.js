import React, { useState, useEffect } from "react";
import Routes from "./routes";
import "react-toastify/dist/ReactToastify.css";

import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { ptBR } from "@material-ui/core/locale";

const App = () => {
  const [locale, setLocale] = useState();

  const theme = createTheme(
    {
      typography: {
        fontFamily: '"Outfit", "Inter", "Segoe UI", sans-serif',
        h1: { fontWeight: 800, letterSpacing: "-0.04em" },
        h2: { fontWeight: 800, letterSpacing: "-0.035em" },
        h3: { fontWeight: 750, letterSpacing: "-0.025em" },
        h4: { fontWeight: 750, letterSpacing: "-0.02em" },
        h5: { fontWeight: 700 },
        h6: { fontWeight: 700 },
        button: { fontWeight: 700, textTransform: "none" },
      },
      scrollbarStyles: {
        "&::-webkit-scrollbar": {
          width: "8px",
          height: "8px",
        },
        "&::-webkit-scrollbar-thumb": {
          boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
          backgroundColor: "#e8e8e8",
        },
      },
      palette: {
        primary: { main: "#5865f2", light: "#818cf8", dark: "#4752c4", contrastText: "#ffffff" },
        secondary: { main: "#06b6d4", contrastText: "#ffffff" },
        success: { main: "#10b981" },
        warning: { main: "#f59e0b" },
        error: { main: "#ef4444" },
        background: { default: "#f5f7fb", paper: "#ffffff" },
      },
      shape: { borderRadius: 14 },
      overrides: {
        MuiCssBaseline: {
          "@global": {
            "html, body, #root": { minHeight: "100%" },
            body: { backgroundColor: "#f5f7fb" },
          },
        },
        MuiPaper: {
          root: {
            backgroundImage: "none",
            border: "1px solid rgba(15, 23, 42, 0.06)",
            boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
          },
        },
        MuiButton: {
          root: { borderRadius: 10, minHeight: 40 },
          containedPrimary: {
            boxShadow: "0 8px 18px rgba(88, 101, 242, 0.22)",
            "&:hover": { boxShadow: "0 10px 24px rgba(88, 101, 242, 0.32)" },
          },
        },
        MuiOutlinedInput: {
          root: {
            borderRadius: 10,
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#818cf8" },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderWidth: 2 },
          },
        },
        MuiTableHead: {
          root: { backgroundColor: "rgba(88, 101, 242, 0.045)" },
        },
        MuiTableCell: {
          head: { fontWeight: 800, color: "#475569", letterSpacing: "0.02em" },
        },
        MuiChip: {
          root: { fontWeight: 700, borderRadius: 8 },
        },
        MuiDialog: {
          paper: { borderRadius: 18 },
        },
      },
    },
    locale
  );

  useEffect(() => {
    const i18nlocale = localStorage.getItem("i18nextLng") || "pt-BR";
    const browserLocale =
      i18nlocale.substring(0, 2) + i18nlocale.substring(3, 5);

    if (browserLocale === "ptBR") {
      setLocale(ptBR);
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <Routes />
    </ThemeProvider>
  );
};

export default App;
