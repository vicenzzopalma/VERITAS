import { createTheme } from "@material-ui/core/styles";

// Design tokens for the whole app. Pages should read colors from
// theme.palette / theme.custom instead of hard-coding hex values.
export const tokens = {
  light: {
    bg: "#F4F5FA",
    surface: "#FFFFFF",
    surfaceAlt: "#F8F9FC",
    surfaceHover: "#F1F2F8",
    border: "#E6E8F0",
    borderStrong: "#D5D8E3",
    text: "#0F1222",
    textMuted: "#5F6478",
    textSubtle: "#9095A9",
    primary: "#5B4CF0",
    primaryDark: "#4637D6",
    primaryLight: "#8A7EFF",
    primarySoft: "#EEECFF",
    accent: "#14B8A6",
    dot: "rgba(15,18,34,0.09)",
    shadow: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
    shadowLg: "0 12px 32px -8px rgba(16,24,40,0.14), 0 4px 8px -4px rgba(16,24,40,0.06)",
  },
  dark: {
    bg: "#0B0D14",
    surface: "#12151F",
    surfaceAlt: "#161A26",
    surfaceHover: "#1B2030",
    border: "#232838",
    borderStrong: "#30364A",
    text: "#E9EBF3",
    textMuted: "#9DA2B8",
    textSubtle: "#6C7189",
    primary: "#8B7DFF",
    primaryDark: "#6E5FF5",
    primaryLight: "#B0A6FF",
    primarySoft: "rgba(139,125,255,0.14)",
    accent: "#2DD4BF",
    dot: "rgba(255,255,255,0.06)",
    shadow: "0 1px 2px rgba(0,0,0,0.4)",
    shadowLg: "0 16px 40px -8px rgba(0,0,0,0.6)",
  },
};

const radius = 12;

export const buildTheme = (mode = "light", locale) => {
  const t = tokens[mode] || tokens.light;
  const isDark = mode === "dark";

  const scrollbarStyles = {
    scrollbarWidth: "thin",
    scrollbarColor: `${t.borderStrong} transparent`,
    "&::-webkit-scrollbar": { width: 8, height: 8 },
    "&::-webkit-scrollbar-track": { background: "transparent" },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: t.borderStrong,
      borderRadius: 8,
      border: "2px solid transparent",
      backgroundClip: "content-box",
    },
  };

  return createTheme(
    {
      scrollbarStyles,
      custom: {
        ...t,
        radius,
        gradient: `linear-gradient(135deg, ${t.primary} 0%, ${t.primaryLight} 55%, ${t.accent} 120%)`,
        dotGrid: {
          backgroundColor: t.bg,
          backgroundImage: `radial-gradient(${t.dot} 1px, transparent 1px)`,
          backgroundSize: "18px 18px",
        },
      },
      palette: {
        type: mode,
        primary: {
          main: t.primary,
          dark: t.primaryDark,
          light: t.primaryLight,
          contrastText: "#FFFFFF",
        },
        secondary: { main: t.accent, contrastText: "#FFFFFF" },
        success: { main: isDark ? "#34D399" : "#16A34A" },
        warning: { main: isDark ? "#FBBF24" : "#D97706" },
        error: { main: isDark ? "#F87171" : "#E5484D" },
        info: { main: isDark ? "#38BDF8" : "#0284C7" },
        background: { default: t.bg, paper: t.surface },
        text: { primary: t.text, secondary: t.textMuted, disabled: t.textSubtle },
        divider: t.border,
        action: {
          hover: t.surfaceHover,
          selected: t.primarySoft,
        },
      },
      shape: { borderRadius: radius },
      typography: {
        fontFamily:
          '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif',
        h1: { fontWeight: 700, letterSpacing: "-0.03em" },
        h2: { fontWeight: 700, letterSpacing: "-0.03em" },
        h3: { fontWeight: 700, letterSpacing: "-0.02em" },
        h4: { fontWeight: 700, letterSpacing: "-0.02em" },
        h5: { fontWeight: 700, letterSpacing: "-0.015em", fontSize: "1.35rem" },
        h6: { fontWeight: 650, letterSpacing: "-0.01em", fontSize: "1.05rem" },
        subtitle1: { fontWeight: 600 },
        subtitle2: { fontWeight: 600, fontSize: "0.82rem" },
        body1: { fontSize: "0.92rem" },
        body2: { fontSize: "0.85rem" },
        button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
        overline: { fontWeight: 700, letterSpacing: "0.08em", fontSize: "0.68rem" },
      },
      props: {
        MuiButton: { disableElevation: true },
        MuiPaper: { elevation: 0 },
        MuiTextField: { variant: "outlined" },
        MuiTooltip: { arrow: true },
      },
      overrides: {
        MuiCssBaseline: {
          "@global": {
            html: { WebkitFontSmoothing: "antialiased" },
            body: { backgroundColor: t.bg, color: t.text },
            "*": scrollbarStyles,
            "::selection": { background: t.primarySoft },
          },
        },
        MuiPaper: {
          root: { backgroundImage: "none" },
          outlined: { borderColor: t.border },
          elevation0: { border: `1px solid ${t.border}` },
          elevation1: { border: `1px solid ${t.border}`, boxShadow: t.shadow },
          elevation2: { border: `1px solid ${t.border}`, boxShadow: t.shadow },
          elevation3: { border: `1px solid ${t.border}`, boxShadow: t.shadow },
          elevation8: { border: `1px solid ${t.border}`, boxShadow: t.shadowLg },
          elevation16: { boxShadow: t.shadowLg },
          elevation24: { boxShadow: t.shadowLg },
        },
        MuiAppBar: {
          root: { boxShadow: "none" },
          colorPrimary: { backgroundColor: t.surface, color: t.text },
        },
        MuiDrawer: {
          paper: { border: "none" },
          paperAnchorDockedLeft: { borderRight: `1px solid ${t.border}` },
        },
        MuiButton: {
          root: { borderRadius: 10, padding: "7px 16px", fontSize: "0.86rem" },
          contained: {
            boxShadow: "none",
            backgroundColor: t.surfaceAlt,
            border: `1px solid ${t.border}`,
            "&:hover": { backgroundColor: t.surfaceHover, boxShadow: "none" },
          },
          containedPrimary: {
            border: "none",
            backgroundColor: t.primary,
            boxShadow: `0 1px 2px rgba(16,24,40,.08), inset 0 1px 0 rgba(255,255,255,.18)`,
            "&:hover": { backgroundColor: t.primaryDark },
          },
          containedSecondary: {
            border: "none",
            "&:hover": { filter: "brightness(0.95)" },
          },
          outlined: { borderColor: t.border, padding: "6px 15px" },
          outlinedPrimary: {
            borderColor: t.border,
            "&:hover": { borderColor: t.primary, backgroundColor: t.primarySoft },
          },
          text: { padding: "7px 12px" },
          sizeSmall: { padding: "4px 10px", fontSize: "0.8rem" },
        },
        MuiIconButton: {
          root: {
            borderRadius: 10,
            color: t.textMuted,
            "&:hover": { backgroundColor: t.surfaceHover },
          },
        },
        MuiOutlinedInput: {
          root: {
            borderRadius: 10,
            backgroundColor: isDark ? t.surfaceAlt : t.surface,
            "&:hover $notchedOutline": { borderColor: t.borderStrong },
            "&$focused $notchedOutline": {
              borderColor: t.primary,
              borderWidth: 1,
              boxShadow: `0 0 0 3px ${t.primarySoft}`,
            },
          },
          notchedOutline: { borderColor: t.border, transition: "box-shadow .15s" },
          input: { padding: "14px 14px" },
          inputMarginDense: { paddingTop: 10, paddingBottom: 10 },
        },
        MuiInputLabel: {
          outlined: { transform: "translate(14px, 15px) scale(1)" },
        },
        MuiInputBase: { root: { fontSize: "0.9rem" } },
        MuiSelect: { select: { "&:focus": { backgroundColor: "transparent" } } },
        MuiTableContainer: { root: { borderRadius: radius } },
        MuiTableCell: {
          root: { borderBottom: `1px solid ${t.border}`, padding: "12px 16px" },
          head: {
            fontSize: "0.72rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: t.textMuted,
            backgroundColor: t.surfaceAlt,
            whiteSpace: "nowrap",
          },
          stickyHeader: { backgroundColor: t.surfaceAlt },
          body: { fontSize: "0.86rem" },
          sizeSmall: { padding: "8px 16px" },
        },
        MuiTableRow: {
          root: {
            transition: "background-color .12s",
            "&$hover:hover": { backgroundColor: t.surfaceHover },
          },
        },
        MuiDialog: {
          paper: {
            borderRadius: 18,
            border: `1px solid ${t.border}`,
            boxShadow: t.shadowLg,
          },
        },
        MuiBackdrop: {
          root: { backgroundColor: isDark ? "rgba(0,0,0,.6)" : "rgba(15,18,34,.35)", backdropFilter: "blur(3px)" },
          invisible: { backdropFilter: "none" },
        },
        MuiDialogTitle: {
          root: { padding: "20px 24px 8px", "& h2": { fontWeight: 700, fontSize: "1.1rem" } },
        },
        MuiDialogContent: { root: { padding: "8px 24px" }, dividers: { borderColor: t.border } },
        MuiDialogActions: { root: { padding: "12px 24px 20px", gap: 8 } },
        MuiChip: {
          root: { borderRadius: 999, fontWeight: 600, fontSize: "0.75rem", height: 26 },
          sizeSmall: { height: 22, fontSize: "0.7rem" },
          outlined: { borderColor: t.border },
        },
        MuiTabs: {
          root: { minHeight: 44 },
          indicator: { height: 3, borderRadius: "3px 3px 0 0", backgroundColor: t.primary },
        },
        MuiTab: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            minHeight: 44,
            fontSize: "0.86rem",
            "@media (min-width: 600px)": { minWidth: 110 },
          },
          textColorPrimary: { color: t.textMuted, "&$selected": { color: t.primary } },
          textColorInherit: { opacity: 0.75, "&$selected": { opacity: 1 } },
        },
        MuiListItem: {
          root: {
            "&$selected, &$selected:hover": { backgroundColor: t.primarySoft },
          },
          button: { "&:hover": { backgroundColor: t.surfaceHover } },
        },
        MuiListItemIcon: { root: { minWidth: 40, color: t.textMuted } },
        MuiListSubheader: {
          root: {
            fontSize: "0.68rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: t.textSubtle,
            lineHeight: "32px",
          },
          sticky: { backgroundColor: "inherit" },
        },
        MuiMenu: { paper: { borderRadius: 12, marginTop: 4 } },
        MuiMenuItem: {
          root: { fontSize: "0.87rem", borderRadius: 8, margin: "2px 6px", minHeight: 36 },
        },
        MuiList: { padding: { paddingTop: 6, paddingBottom: 6 } },
        MuiPopover: { paper: { borderRadius: 14 } },
        MuiTooltip: {
          tooltip: {
            backgroundColor: isDark ? "#2A2F42" : "#111427",
            fontSize: "0.75rem",
            fontWeight: 500,
            borderRadius: 8,
            padding: "6px 10px",
          },
          arrow: { color: isDark ? "#2A2F42" : "#111427" },
        },
        MuiDivider: { root: { backgroundColor: t.border } },
        MuiAvatar: { colorDefault: { backgroundColor: t.primarySoft, color: t.primary, fontWeight: 700 } },
        MuiBadge: { badge: { fontWeight: 700, fontSize: "0.68rem" } },
        MuiSwitch: {
          root: { padding: 8 },
          track: { borderRadius: 12, opacity: 1, backgroundColor: t.borderStrong },
          thumb: { boxShadow: "0 1px 3px rgba(0,0,0,.2)" },
          colorPrimary: { "&$checked + $track": { opacity: 1 } },
          colorSecondary: { "&$checked + $track": { opacity: 1 } },
        },
        MuiCheckbox: { root: { color: t.borderStrong } },
        MuiLinearProgress: {
          root: { borderRadius: 8, height: 6 },
          colorPrimary: { backgroundColor: t.primarySoft },
        },
        MuiAccordion: {
          root: {
            border: `1px solid ${t.border}`,
            borderRadius: radius,
            "&:before": { display: "none" },
            "&$expanded": { margin: "8px 0" },
          },
          rounded: { borderRadius: radius, "&:first-child, &:last-child": { borderRadius: radius } },
        },
        MuiCard: { root: { borderRadius: 16 } },
        MuiSnackbarContent: { root: { borderRadius: 12 } },
      },
    },
    locale || {}
  );
};

export default buildTheme;
