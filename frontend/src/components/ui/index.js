// Shared UI kit built on the theme tokens (theme.custom). Use these instead
// of ad-hoc Paper/Typography combos so every page looks the same.
import React from "react";
import clsx from "clsx";
import { makeStyles, alpha } from "@material-ui/core/styles";
import { Paper, Typography, InputBase } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";

const TONES = ["primary", "success", "warning", "error", "info", "neutral"];

export const toneColor = (theme, tone = "primary") => {
  if (tone === "neutral") return theme.palette.text.secondary;
  if (tone === "accent") return theme.palette.secondary.main;
  return (theme.palette[tone] || theme.palette.primary).main;
};

const useStyles = makeStyles((theme) => {
  const c = theme.custom;
  const toneClasses = {};
  [...TONES, "accent"].forEach((tone) => {
    const col = toneColor(theme, tone);
    toneClasses[`tone_${tone}`] = {
      color: col,
      backgroundColor: alpha(col, theme.palette.type === "dark" ? 0.16 : 0.1),
    };
  });

  return {
    ...toneClasses,
    pageHeader: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing(2),
      padding: theme.spacing(3, 0, 2.5),
    },
    pageHeaderIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      display: "grid",
      placeItems: "center",
      flex: "none",
      "& svg": { fontSize: 22 },
    },
    pageHeaderText: { minWidth: 0, flex: "1 1 240px" },
    pageTitle: { fontWeight: 750, fontSize: "1.45rem", letterSpacing: "-0.02em", lineHeight: 1.2 },
    pageSubtitle: { color: theme.palette.text.secondary, marginTop: 2, fontSize: "0.88rem" },
    pageActions: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing(1),
      marginLeft: "auto",
    },
    statCard: {
      position: "relative",
      padding: theme.spacing(2.25, 2.5),
      borderRadius: 16,
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.5),
      height: "100%",
      overflow: "hidden",
      transition: "transform .18s ease, box-shadow .18s ease",
      "&:hover": { transform: "translateY(-2px)", boxShadow: c.shadowLg },
    },
    statTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },
    statLabel: { fontSize: "0.82rem", fontWeight: 600, color: theme.palette.text.secondary },
    statIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: "grid",
      placeItems: "center",
      "& svg": { fontSize: 19 },
    },
    statValue: { fontSize: "2rem", fontWeight: 750, letterSpacing: "-0.03em", lineHeight: 1 },
    statFoot: { fontSize: "0.78rem", color: theme.palette.text.secondary },
    statBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
    sectionCard: { borderRadius: 16, display: "flex", flexDirection: "column", minHeight: 0 },
    sectionHead: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1),
      padding: theme.spacing(2, 2.5),
      borderBottom: `1px solid ${c.border}`,
    },
    sectionTitle: { fontWeight: 700, fontSize: "0.98rem" },
    sectionSub: { color: theme.palette.text.secondary, fontSize: "0.8rem" },
    sectionBody: { padding: theme.spacing(2.5), flex: 1, minHeight: 0 },
    flush: { padding: 0 },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: "0.74rem",
      fontWeight: 650,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
    },
    pillDot: { width: 6, height: 6, borderRadius: "50%", backgroundColor: "currentColor" },
    empty: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      padding: theme.spacing(6, 3),
      gap: theme.spacing(1),
      color: theme.palette.text.secondary,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      display: "grid",
      placeItems: "center",
      marginBottom: theme.spacing(1),
      "& svg": { fontSize: 28 },
    },
    emptyTitle: { color: theme.palette.text.primary, fontWeight: 700, fontSize: "1rem" },
    search: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: 40,
      padding: "0 12px",
      borderRadius: 10,
      border: `1px solid ${c.border}`,
      backgroundColor: theme.palette.type === "dark" ? c.surfaceAlt : c.surface,
      minWidth: 220,
      transition: "border-color .15s, box-shadow .15s",
      "&:focus-within": { borderColor: theme.palette.primary.main, boxShadow: `0 0 0 3px ${c.primarySoft}` },
      "& svg": { fontSize: 19, color: c.textSubtle },
    },
    searchInput: { flex: 1, fontSize: "0.88rem" },
  };
});

export const PageHeader = ({ icon, title, subtitle, actions, tone = "primary", className }) => {
  const classes = useStyles();
  return (
    <div className={clsx(classes.pageHeader, className)}>
      {icon && <div className={clsx(classes.pageHeaderIcon, classes[`tone_${tone}`])}>{icon}</div>}
      <div className={classes.pageHeaderText}>
        <Typography component="h1" className={classes.pageTitle} noWrap>
          {title}
        </Typography>
        {subtitle && <Typography className={classes.pageSubtitle}>{subtitle}</Typography>}
      </div>
      {actions && <div className={classes.pageActions}>{actions}</div>}
    </div>
  );
};

export const StatCard = ({ label, value, icon, tone = "primary", footer, className }) => {
  const classes = useStyles();
  return (
    <Paper className={clsx(classes.statCard, className)}>
      <div className={clsx(classes.statBar, classes[`tone_${tone}`])} style={{ opacity: 0.9 }} />
      <div className={classes.statTop}>
        <span className={classes.statLabel}>{label}</span>
        {icon && <div className={clsx(classes.statIcon, classes[`tone_${tone}`])}>{icon}</div>}
      </div>
      <div className={classes.statValue}>{value}</div>
      {footer && <div className={classes.statFoot}>{footer}</div>}
    </Paper>
  );
};

export const SectionCard = ({ title, subtitle, icon, actions, children, flush, className, bodyClassName }) => {
  const classes = useStyles();
  return (
    <Paper className={clsx(classes.sectionCard, className)}>
      {(title || actions) && (
        <div className={classes.sectionHead}>
          {icon}
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && <div className={classes.sectionTitle}>{title}</div>}
            {subtitle && <div className={classes.sectionSub}>{subtitle}</div>}
          </div>
          {actions}
        </div>
      )}
      <div className={clsx(classes.sectionBody, flush && classes.flush, bodyClassName)}>{children}</div>
    </Paper>
  );
};

export const StatusPill = ({ tone = "neutral", children, dot = true, className }) => {
  const classes = useStyles();
  return (
    <span className={clsx(classes.pill, classes[`tone_${tone}`], className)}>
      {dot && <span className={classes.pillDot} />}
      {children}
    </span>
  );
};

export const EmptyState = ({ icon, title, description, action, tone = "primary" }) => {
  const classes = useStyles();
  return (
    <div className={classes.empty}>
      {icon && <div className={clsx(classes.emptyIcon, classes[`tone_${tone}`])}>{icon}</div>}
      {title && <div className={classes.emptyTitle}>{title}</div>}
      {description && <Typography variant="body2" color="textSecondary">{description}</Typography>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
};

export const SearchField = ({ value, onChange, placeholder, className, inputProps, ...rest }) => {
  const classes = useStyles();
  return (
    <div className={clsx(classes.search, className)}>
      <SearchIcon />
      <InputBase
        className={classes.searchInput}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputProps={{ "aria-label": placeholder, ...inputProps }}
        {...rest}
      />
    </div>
  );
};
