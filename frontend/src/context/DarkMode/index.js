import React, { createContext, useState, useContext, useMemo, useEffect } from "react";
import PropTypes from "prop-types";
import { ThemeProvider as MUIThemeProvider } from "@material-ui/core/styles";
import { ptBR } from "@material-ui/core/locale";
import { CssBaseline } from "@material-ui/core";

import { buildTheme } from "../../theme";

const STORAGE_KEY = "veritas-theme";
const ThemeContext = createContext({ darkMode: false, toggleTheme: () => {} });

const readInitialMode = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved === "dark";
  } catch (e) {
    // storage unavailable
  }
  return false;
};

const readLocale = () => {
  try {
    const lng = localStorage.getItem("i18nextLng") || "pt-BR";
    return lng.replace("-", "").replace("_", "").substring(0, 4) === "ptBR" ? ptBR : undefined;
  } catch (e) {
    return ptBR;
  }
};

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(readInitialMode);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, darkMode ? "dark" : "light");
    } catch (e) {
      // ignore
    }
    // index.css keys dark-mode tweaks off this class.
    document.documentElement.classList.toggle("veritas-dark", darkMode);
    document.body.classList.toggle("veritas-dark", darkMode);
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
  }, [darkMode]);

  const toggleTheme = () => setDarkMode((prev) => !prev);

  const theme = useMemo(() => buildTheme(darkMode ? "dark" : "light", readLocale()), [darkMode]);

  const contextValue = useMemo(() => ({ darkMode, toggleTheme }), [darkMode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useThemeContext = () => useContext(ThemeContext);
