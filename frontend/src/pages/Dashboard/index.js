import React, { useContext } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Grid, makeStyles } from "@material-ui/core";
import HeadsetMicOutlined from "@material-ui/icons/HeadsetMicOutlined";
import HourglassEmptyOutlined from "@material-ui/icons/HourglassEmptyOutlined";
import CheckCircleOutline from "@material-ui/icons/CheckCircleOutline";
import WifiTethering from "@material-ui/icons/WifiTethering";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import SecurityOutlined from "@material-ui/icons/SecurityOutlined";
import SyncAlt from "@material-ui/icons/SyncAlt";
import QuestionAnswerOutlined from "@material-ui/icons/QuestionAnswerOutlined";
import ArrowForward from "@material-ui/icons/ArrowForward";

import useTickets from "../../hooks/useTickets";
import { AuthContext } from "../../context/Auth/AuthContext";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import { i18n } from "../../translate/i18n";
import { PageHeader, StatCard, SectionCard, StatusPill, EmptyState } from "../../components/ui";
import Chart from "./Chart";

const STATUS_TONE = {
  CONNECTED: ["success", "Conectado"],
  qrcode: ["warning", "Aguardando QR"],
  PAIRING: ["warning", "Pareando"],
  OPENING: ["info", "Abrindo"],
  DISCONNECTED: ["error", "Desconectado"],
  TIMEOUT: ["error", "Tempo esgotado"],
};

const FLOW = [
  {
    to: "/connections",
    step: "Passo 1",
    title: "Conectar WhatsApp",
    desc: "Pareie números e monitore o status de cada sessão.",
    icon: <SyncAlt />,
    color: "#0EA5E9",
  },
  {
    to: "/tickets",
    step: "Passo 2",
    title: "Atender tickets",
    desc: "Responda conversas, transfira e finalize atendimentos.",
    icon: <WhatsAppIcon />,
    color: "#22C55E",
  },
  {
    to: "/quickAnswers",
    step: "Passo 3",
    title: "Respostas rápidas",
    desc: "Padronize mensagens com atalhos reutilizáveis.",
    icon: <QuestionAnswerOutlined />,
    color: "#F59E0B",
  },
  {
    to: "/audit",
    step: "Passo 4",
    title: "Auditar e exportar",
    desc: "Busque no histórico completo e gere evidências.",
    icon: <SecurityOutlined />,
    color: "#5B4CF0",
  },
];

const useStyles = makeStyles((theme) => {
  const c = theme.custom;
  return {
    page: {
      width: "100%",
      maxWidth: 1440,
      margin: "0 auto",
      padding: theme.spacing(0, 3, 4),
      [theme.breakpoints.down("xs")]: { padding: theme.spacing(0, 1.5, 3) },
    },
    fill: { height: "100%" },
    connRow: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "11px 0",
      "& + &": { borderTop: `1px solid ${c.border}` },
    },
    connIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: "grid",
      placeItems: "center",
      backgroundColor: "rgba(37,211,102,0.12)",
      color: "#1FAF55",
      flex: "none",
      "& svg": { fontSize: 19 },
    },
    connName: {
      flex: 1,
      minWidth: 0,
      fontWeight: 600,
      fontSize: "0.88rem",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    link: {
      fontSize: "0.8rem",
      fontWeight: 650,
      textDecoration: "none",
      color: theme.palette.primary.main,
    },
    flow: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: theme.spacing(3),
      padding: theme.spacing(3),
      borderRadius: "0 0 16px 16px",
      ...c.dotGrid,
      [theme.breakpoints.down("sm")]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
      [theme.breakpoints.down("xs")]: { gridTemplateColumns: "1fr" },
    },
    node: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: 16,
      borderRadius: 14,
      backgroundColor: c.surface,
      border: `1px solid ${c.border}`,
      boxShadow: c.shadow,
      color: "inherit",
      textDecoration: "none",
      transition: "transform .18s, box-shadow .18s, border-color .18s",
      "&:hover": {
        transform: "translateY(-2px)",
        boxShadow: c.shadowLg,
        borderColor: theme.palette.primary.main,
      },
      "&:hover $nodeArrow": { opacity: 1, transform: "none" },
      [theme.breakpoints.up("md")]: {
        "&:not(:last-child)::after": {
          content: '""',
          position: "absolute",
          top: "50%",
          right: -theme.spacing(3) - 1,
          width: theme.spacing(3),
          borderTop: `2px dashed ${c.borderStrong}`,
        },
      },
    },
    nodeHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 2 },
    nodeIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      display: "grid",
      placeItems: "center",
      color: "#fff",
      "& svg": { fontSize: 18 },
    },
    nodeStep: {
      fontSize: "0.68rem",
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: c.textSubtle,
    },
    nodeTitle: { fontWeight: 700, fontSize: "0.92rem" },
    nodeDesc: { fontSize: "0.8rem", color: c.textMuted, lineHeight: 1.45 },
    nodeArrow: {
      marginLeft: "auto",
      fontSize: 18,
      color: theme.palette.primary.main,
      opacity: 0,
      transform: "translateX(-4px)",
      transition: "all .18s",
    },
  };
});

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

const Dashboard = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { whatsApps = [] } = useContext(WhatsAppsContext) || {};

  const userQueueIds =
    user.queues && user.queues.length > 0 ? user.queues.map((q) => q.id) : [];
  const queueIds = JSON.stringify(userQueueIds);

  const { count: openCount } = useTickets({
    status: "open",
    showAll: "true",
    withUnreadMessages: "false",
    queueIds,
  });
  const { count: pendingCount } = useTickets({
    status: "pending",
    showAll: "true",
    withUnreadMessages: "false",
    queueIds,
  });
  const { count: closedCount } = useTickets({
    status: "closed",
    showAll: "true",
    withUnreadMessages: "false",
    queueIds,
  });

  const connected = whatsApps.filter((w) => w.status === "CONNECTED").length;
  const allOnline = whatsApps.length > 0 && connected === whatsApps.length;
  const firstName = (user.name || "").split(" ")[0];
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className={`${classes.page} gisaio-page-enter`}>
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        subtitle={`Resumo da operação · ${today}`}
      />

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label={i18n.t("dashboard.messages.inAttendance.title")}
            value={openCount}
            icon={<HeadsetMicOutlined />}
            tone="primary"
            footer="Tickets abertos agora"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label={i18n.t("dashboard.messages.waiting.title")}
            value={pendingCount}
            icon={<HourglassEmptyOutlined />}
            tone="warning"
            footer="Na fila aguardando atendente"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label={i18n.t("dashboard.messages.closed.title")}
            value={closedCount}
            icon={<CheckCircleOutline />}
            tone="success"
            footer="Atendimentos concluídos"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Conexões ativas"
            value={
              <span>
                {connected}
                <span style={{ fontSize: "1rem", opacity: 0.45, fontWeight: 600 }}>
                  {" "}
                  / {whatsApps.length}
                </span>
              </span>
            }
            icon={<WifiTethering />}
            tone={allOnline ? "accent" : "error"}
            footer={allOnline ? "Todas as sessões online" : "Há sessões que precisam de atenção"}
          />
        </Grid>

        <Grid item xs={12} md={8}>
          <SectionCard
            title="Volume de tickets hoje"
            subtitle="Tickets criados por hora"
            className={classes.fill}
          >
            <div style={{ height: 280 }}>
              <Chart />
            </div>
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <SectionCard
            title="Saúde das conexões"
            subtitle="Status em tempo real"
            className={classes.fill}
            actions={
              <RouterLink to="/connections" className={classes.link}>
                Gerenciar
              </RouterLink>
            }
          >
            {whatsApps.length === 0 ? (
              <EmptyState
                icon={<SyncAlt />}
                title="Nenhuma conexão"
                description="Adicione um número de WhatsApp para começar."
              />
            ) : (
              whatsApps.slice(0, 6).map((w) => {
                const [tone, label] = STATUS_TONE[w.status] || ["neutral", w.status];
                return (
                  <div className={classes.connRow} key={w.id}>
                    <div className={classes.connIcon}>
                      <WhatsAppIcon />
                    </div>
                    <div className={classes.connName}>{w.name}</div>
                    <StatusPill tone={tone}>{label}</StatusPill>
                  </div>
                );
              })
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12}>
          <SectionCard
            title="Fluxo de trabalho"
            subtitle="Atalhos para as etapas principais do atendimento"
            flush
          >
            <div className={classes.flow}>
              {FLOW.map((n) => (
                <RouterLink to={n.to} key={n.to} className={classes.node}>
                  <div className={classes.nodeHead}>
                    <div className={classes.nodeIcon} style={{ backgroundColor: n.color }}>
                      {n.icon}
                    </div>
                    <span className={classes.nodeStep}>{n.step}</span>
                    <ArrowForward className={classes.nodeArrow} />
                  </div>
                  <div className={classes.nodeTitle}>{n.title}</div>
                  <div className={classes.nodeDesc}>{n.desc}</div>
                </RouterLink>
              ))}
            </div>
          </SectionCard>
        </Grid>
      </Grid>
    </div>
  );
};

export default Dashboard;
