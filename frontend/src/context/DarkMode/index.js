import React, { createContext, useState, useContext, useMemo, useEffect } from "react";
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

  useEffect(() => {
    document.documentElement.classList.toggle("veritas-dark", darkMode);
    document.body.classList.toggle("veritas-dark", darkMode);
  }, [darkMode]);

  const theme = useMemo(
    () =>
      createMuiTheme({
        palette: {
          type: darkMode ? "dark" : "light",
          primary: { main: "#5865f2", light: "#818cf8", dark: "#4752c4" },
          secondary: { main: "#06b6d4" },
          background: {
            default: darkMode ? "#0b1120" : "#f5f7fb",
            paper: darkMode ? "#111827" : "#ffffff",
          },
          text: {
            primary: darkMode ? "#e5e7eb" : "#0f172a",
            secondary: darkMode ? "#94a3b8" : "#64748b",
          },
          divider: darkMode ? "rgba(148, 163, 184, 0.18)" : "rgba(15, 23, 42, 0.12)",
        },
        typography: {
          fontFamily: '"Outfit", "Inter", "Segoe UI", sans-serif',
          button: { fontWeight: 700, textTransform: "none" },
        },
        shape: { borderRadius: 14 },
        overrides: {
          MuiCssBaseline: {
            "@global": {
              "html, body, #root": {
                backgroundColor: darkMode ? "#0b1120" : "#f5f7fb",
              },
              body: {
                color: darkMode ? "#e5e7eb" : "#0f172a",
              },
            },
          },
          MuiPaper: {
            root: {
              backgroundImage: "none",
              backgroundColor: darkMode ? "#111827" : "#ffffff",
              borderColor: darkMode ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.06)",
              boxShadow: darkMode ? "0 10px 30px rgba(0, 0, 0, 0.24)" : "0 8px 30px rgba(15, 23, 42, 0.06)",
            },
          },
          MuiAppBar: {
            root: {
              backgroundColor: darkMode ? "#111827" : "#ffffff",
              color: darkMode ? "#e5e7eb" : "#0f172a",
              backgroundImage: "none",
            },
          },
          MuiDrawer: {
            paper: {
              backgroundColor: darkMode ? "#0f172a" : "#ffffff",
              color: darkMode ? "#e5e7eb" : "#0f172a",
              backgroundImage: "none",
              borderColor: darkMode ? "rgba(148, 163, 184, 0.16)" : "rgba(15, 23, 42, 0.08)",
            },
          },
          MuiButton: {
            root: { borderRadius: 10, minHeight: 40 },
            outlined: {
              borderColor: darkMode ? "rgba(148, 163, 184, 0.35)" : undefined,
            },
          },
          MuiOutlinedInput: {
            root: { borderRadius: 10 },
            notchedOutline: {
              borderColor: darkMode ? "rgba(148, 163, 184, 0.35)" : undefined,
            },
          },
          MuiInputBase: {
            root: { color: darkMode ? "#e5e7eb" : undefined },
          },
          MuiTableHead: {
            root: { backgroundColor: darkMode ? "rgba(88, 101, 242, 0.16)" : "rgba(88, 101, 242, 0.045)" },
          },
          MuiTableCell: {
            root: {
              color: darkMode ? "#dbe4f0" : undefined,
              borderBottomColor: darkMode ? "rgba(148, 163, 184, 0.16)" : undefined,
            },
            head: { color: darkMode ? "#cbd5e1" : undefined },
          },
          MuiListItem: {
            root: {
              "&$selected": {
                backgroundColor: darkMode ? "rgba(129, 140, 248, 0.18)" : undefined,
              },
            },
          },
          MuiMenu: {
            paper: {
              backgroundColor: darkMode ? "#1e293b" : undefined,
              color: darkMode ? "#e5e7eb" : undefined,
            },
          },
          MuiDialog: {
            paper: {
              borderRadius: 18,
              backgroundColor: darkMode ? "#111827" : undefined,
              color: darkMode ? "#e5e7eb" : undefined,
            },
          },
          MuiChip: {
            root: {
              backgroundColor: darkMode ? "#1e293b" : undefined,
              color: darkMode ? "#dbe4f0" : undefined,
            },
          },
          MuiTooltip: {
            tooltip: {
              backgroundColor: darkMode ? "#e5e7eb" : undefined,
              color: darkMode ? "#0f172a" : undefined,
            },
          },
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
