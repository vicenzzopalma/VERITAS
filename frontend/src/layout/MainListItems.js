import React, { useContext, useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import clsx from "clsx";

import { Badge, Tooltip, makeStyles } from "@material-ui/core";
import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import SecurityOutlinedIcon from "@material-ui/icons/SecurityOutlined";
import SettingsOutlinedIcon from "@material-ui/icons/SettingsOutlined";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import ContactPhoneOutlinedIcon from "@material-ui/icons/ContactPhoneOutlined";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import QuestionAnswerOutlinedIcon from "@material-ui/icons/QuestionAnswerOutlined";

import { i18n } from "../translate/i18n";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { Can } from "../components/Can";

const useStyles = makeStyles((theme) => {
  const c = theme.custom;
  return {
    section: {
      padding: theme.spacing(1.5, 1.5, 0.5),
      fontSize: "0.66rem",
      fontWeight: 700,
      letterSpacing: "0.09em",
      textTransform: "uppercase",
      color: c.textSubtle,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    sectionCollapsed: {
      height: 1,
      padding: 0,
      margin: theme.spacing(1.5, 1.5),
      backgroundColor: c.border,
    },
    list: { listStyle: "none", margin: 0, padding: 0 },
    item: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      gap: 12,
      height: 40,
      padding: "0 12px",
      margin: "2px 0",
      borderRadius: 10,
      color: c.textMuted,
      textDecoration: "none",
      fontSize: "0.88rem",
      fontWeight: 550,
      whiteSpace: "nowrap",
      transition: "background-color .15s, color .15s",
      "& svg": { fontSize: 20, flex: "none" },
      "&:hover": { backgroundColor: c.surfaceHover, color: c.text },
    },
    itemCollapsed: { justifyContent: "center", padding: 0 },
    active: {
      backgroundColor: c.primarySoft,
      color: theme.palette.primary.main,
      fontWeight: 650,
      "&:hover": { backgroundColor: c.primarySoft, color: theme.palette.primary.main },
      "&::before": {
        content: '""',
        position: "absolute",
        left: -12,
        top: 10,
        bottom: 10,
        width: 3,
        borderRadius: "0 3px 3px 0",
        backgroundColor: theme.palette.primary.main,
      },
    },
    label: { overflow: "hidden", textOverflow: "ellipsis" },
  };
});

const NavItem = ({ to, icon, label, collapsed }) => {
  const classes = useStyles();
  const { pathname } = useLocation();
  const target = to.toLowerCase();
  const current = pathname.toLowerCase();
  const isActive = target === "/" ? current === "/" : current.startsWith(target);

  const link = (
    <RouterLink
      to={to}
      className={clsx(classes.item, collapsed && classes.itemCollapsed, isActive && classes.active)}
      aria-current={isActive ? "page" : undefined}
    >
      {icon}
      {!collapsed && <span className={classes.label}>{label}</span>}
    </RouterLink>
  );

  return (
    <li>
      {collapsed ? (
        <Tooltip title={label} placement="right">
          {link}
        </Tooltip>
      ) : (
        link
      )}
    </li>
  );
};

const Section = ({ label, collapsed }) => {
  const classes = useStyles();
  return collapsed ? (
    <div className={classes.sectionCollapsed} />
  ) : (
    <div className={classes.section}>{label}</div>
  );
};

const MainListItems = ({ drawerClose, collapsed = false }) => {
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user } = useContext(AuthContext);
  const [connectionWarning, setConnectionWarning] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) =>
          ["qrcode", "PAIRING", "DISCONNECTED", "TIMEOUT", "OPENING"].includes(whats.status)
        );
        setConnectionWarning(offlineWhats.length > 0);
      }
    }, 2000);
    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  return (
    <nav onClick={drawerClose} aria-label="Navegação principal">
      <Section label="Visão geral" collapsed={collapsed} />
      <ul className={classes.list}>
        <NavItem to="/" label="Dashboard" icon={<DashboardOutlinedIcon />} collapsed={collapsed} />
        <NavItem to="/audit" label="Cofre de Auditoria" icon={<SecurityOutlinedIcon />} collapsed={collapsed} />
      </ul>

      <Section label="Atendimento" collapsed={collapsed} />
      <ul className={classes.list}>
        <NavItem
          to="/tickets"
          label={i18n.t("mainDrawer.listItems.tickets")}
          icon={<WhatsAppIcon />}
          collapsed={collapsed}
        />
        <NavItem
          to="/contacts"
          label={i18n.t("mainDrawer.listItems.contacts")}
          icon={<ContactPhoneOutlinedIcon />}
          collapsed={collapsed}
        />
        <NavItem
          to="/quickAnswers"
          label={i18n.t("mainDrawer.listItems.quickAnswers")}
          icon={<QuestionAnswerOutlinedIcon />}
          collapsed={collapsed}
        />
        <NavItem
          to="/connections"
          label={i18n.t("mainDrawer.listItems.connections")}
          icon={
            <Badge variant="dot" invisible={!connectionWarning} color="error" overlap="circular">
              <SyncAltIcon />
            </Badge>
          }
          collapsed={collapsed}
        />
      </ul>

      <Can
        role={user.profile}
        perform="drawer-admin-items:view"
        yes={() => (
          <>
            <Section label={i18n.t("mainDrawer.listItems.administration")} collapsed={collapsed} />
            <ul className={classes.list}>
              <NavItem
                to="/users"
                label={i18n.t("mainDrawer.listItems.users")}
                icon={<PeopleAltOutlinedIcon />}
                collapsed={collapsed}
              />
              <NavItem
                to="/queues"
                label={i18n.t("mainDrawer.listItems.queues")}
                icon={<AccountTreeOutlinedIcon />}
                collapsed={collapsed}
              />
              <NavItem
                to="/settings"
                label={i18n.t("mainDrawer.listItems.settings")}
                icon={<SettingsOutlinedIcon />}
                collapsed={collapsed}
              />
            </ul>
          </>
        )}
      />
    </nav>
  );
};

export default MainListItems;
