// Split-screen shell for Login / Signup: form on the left, product
// showcase (workflow-style nodes on a dotted canvas) on the right.
import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import SecurityOutlined from "@material-ui/icons/SecurityOutlined";
import HeadsetMicOutlined from "@material-ui/icons/HeadsetMicOutlined";
import CheckCircle from "@material-ui/icons/CheckCircle";

const useStyles = makeStyles((theme) => {
  const c = theme.custom;
  return {
    root: {
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
      backgroundColor: c.surface,
      [theme.breakpoints.down("sm")]: { gridTemplateColumns: "1fr" },
    },
    formSide: {
      display: "flex",
      flexDirection: "column",
      padding: theme.spacing(4, 6),
      [theme.breakpoints.down("xs")]: { padding: theme.spacing(3, 2.5) },
    },
    brand: { display: "flex", alignItems: "center", gap: 10, fontWeight: 750, fontSize: "1.05rem" },
    logo: {
      width: 34,
      height: 34,
      borderRadius: 10,
      background: c.gradient,
      color: "#fff",
      display: "grid",
      placeItems: "center",
      fontWeight: 800,
      boxShadow: `0 6px 16px -6px ${theme.palette.primary.main}`,
    },
    formWrap: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      width: "100%",
      maxWidth: 400,
      margin: "0 auto",
      padding: theme.spacing(4, 0),
    },
    title: { fontSize: "1.75rem", fontWeight: 750, letterSpacing: "-0.025em", margin: 0 },
    subtitle: { color: c.textMuted, marginTop: 6, marginBottom: theme.spacing(3), fontSize: "0.92rem" },
    foot: { fontSize: "0.78rem", color: c.textSubtle },
    showcase: {
      position: "relative",
      margin: 12,
      borderRadius: 24,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: theme.spacing(6),
      color: "#fff",
      background: `radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px) 0 0 / 20px 20px, linear-gradient(140deg, #2B1F9E 0%, #5B4CF0 45%, #0F766E 120%)`,
      [theme.breakpoints.down("sm")]: { display: "none" },
    },
    showTitle: { fontSize: "2rem", fontWeight: 750, letterSpacing: "-0.03em", lineHeight: 1.15, maxWidth: 460, margin: 0 },
    showText: { opacity: 0.8, marginTop: 12, maxWidth: 440, fontSize: "0.95rem", lineHeight: 1.6 },
    canvas: { position: "relative", marginTop: theme.spacing(5), maxWidth: 480 },
    node: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.12)",
      border: "1px solid rgba(255,255,255,0.22)",
      backdropFilter: "blur(8px)",
      width: "fit-content",
      minWidth: 260,
    },
    nodeIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      display: "grid",
      placeItems: "center",
      backgroundColor: "#fff",
      "& svg": { fontSize: 19 },
    },
    nodeTitle: { fontWeight: 650, fontSize: "0.88rem" },
    nodeSub: { fontSize: "0.75rem", opacity: 0.75 },
    edge: { height: 26, marginLeft: 30, borderLeft: "2px dashed rgba(255,255,255,0.4)" },
    check: { marginLeft: "auto", color: "#5EEAD4", fontSize: 18 },
  };
});

const NODES = [
  { icon: <WhatsAppIcon style={{ color: "#16A34A" }} />, title: "Mensagem recebida", sub: "WhatsApp · agora", indent: 0 },
  { icon: <HeadsetMicOutlined style={{ color: "#5B4CF0" }} />, title: "Ticket na fila Suporte", sub: "Atribuído automaticamente", indent: 48 },
  { icon: <SecurityOutlined style={{ color: "#0F766E" }} />, title: "Registrado no cofre", sub: "Auditoria com integridade", indent: 96 },
];

const AuthShell = ({ title, subtitle, children, hideFooter = false }) => {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <div className={classes.formSide}>
        <div className={classes.brand}>
          <div className={classes.logo}>V</div>
          VERITAS
        </div>
        <div className={`${classes.formWrap} gisaio-page-enter`}>
          <h1 className={classes.title}>{title}</h1>
          {subtitle && <div className={classes.subtitle}>{subtitle}</div>}
          {children}
        </div>
        {!hideFooter && (
          <div className={classes.foot}>© {new Date().getFullYear()} VERITAS · Atendimento e auditoria WhatsApp</div>
        )}
      </div>
      <aside className={classes.showcase} aria-hidden="true">
        <h2 className={classes.showTitle}>Todo atendimento, rastreável do início ao fim.</h2>
        <p className={classes.showText}>
          Centralize conversas do WhatsApp, distribua por filas e mantenha um histórico auditável de cada
          mensagem.
        </p>
        <div className={classes.canvas}>
          {NODES.map((n, i) => (
            <React.Fragment key={n.title}>
              {i > 0 && <div className={classes.edge} style={{ marginLeft: 30 + NODES[i - 1].indent }} />}
              <div className={classes.node} style={{ marginLeft: n.indent }}>
                <div className={classes.nodeIcon}>{n.icon}</div>
                <div>
                  <div className={classes.nodeTitle}>{n.title}</div>
                  <div className={classes.nodeSub}>{n.sub}</div>
                </div>
                <CheckCircle className={classes.check} />
              </div>
            </React.Fragment>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default AuthShell;
