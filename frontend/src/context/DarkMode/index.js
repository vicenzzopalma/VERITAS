import React, { createContext, useState, useContext, useMemo } from "react";
import PropTypes from "prop-types";
import { createMuiTheme, ThemeProvider as MUIThemeProvider } from "@material-ui/core/styles";
import { CssBaseline } from "@material-ui/core";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("veritas-theme") === "dark";
    } catch {
      return false;
    }
  });

  const toggleTheme = () => {
    setDarkMode((prevMode) => {
      const nextMode = !prevMode;
      try {
        localStorage.setItem("veritas-theme", nextMode ? "dark" : "light");
      } catch {
        // Prefer the current session when storage is unavailable.
      }
      return nextMode;
    });
  };

  const theme = useMemo(
    () =>
      createMuiTheme({
        palette: {
          type: darkMode ? "dark" : "light",
          primary: { main: "#5865f2", light: "#818cf8", dark: "#4752c4" },
          secondary: { main: "#06b6d4" },
        },
        typography: {
          fontFamily: '"Outfit", "Inter", "Segoe UI", sans-serif',
          button: { fontWeight: 700, textTransform: "none" },
        },
        shape: { borderRadius: 14 },
        overrides: {
          MuiPaper: { root: { backgroundImage: "none" } },
          MuiButton: { root: { borderRadius: 10, minHeight: 40 } },
          MuiOutlinedInput: { root: { borderRadius: 10 } },
          MuiDialog: { paper: { borderRadius: 18 } },
        },
      }),
    [darkMode]
  );

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
