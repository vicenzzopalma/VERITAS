import React, { useContext, useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import clsx from "clsx";

import { Badge, Tooltip, makeStyles } from "@material-ui/core";
import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import PhoneAndroidIcon from "@material-ui/icons/PhoneAndroid";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import SecurityOutlinedIcon from "@material-ui/icons/SecurityOutlined";
import SettingsOutlinedIcon from "@material-ui/icons/SettingsOutlined";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import ContactPhoneOutlinedIcon from "@material-ui/icons/ContactPhoneOutlined";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import QuestionAnswerOutlinedIcon from "@material-ui/icons/QuestionAnswerOutlined";
import ExitToAppIcon from "@material-ui/icons/ExitToApp";

import { i18n } from "../translate/i18n";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { Can } from "../components/Can";

const CRM_TOOLTIP = "Gestão de celulares = Whatsapp control = CRM = Whatsapp Control CRM";

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
      width: "100%",
      height: 40,
      padding: "0 12px",
      margin: "2px 0",
      borderRadius: 10,
      border: "none",
      background: "none",
      cursor: "pointer",
      font: "inherit",
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

const isPathActive = (pathname, to) => {
  const target = to.toLowerCase();
  const current = pathname.toLowerCase();
  return target === "/" ? current === "/" : current.startsWith(target);
};

const withTooltip = (node, title, show) =>
  show ? (
    <Tooltip title={title} placement="right">
      {node}
    </Tooltip>
  ) : (
    node
  );

const NavItem = ({ to, icon, label, collapsed, tooltip }) => {
  const classes = useStyles();
  const { pathname } = useLocation();
  const isActive = isPathActive(pathname, to);

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

  return <li>{withTooltip(link, tooltip || label, collapsed || Boolean(tooltip))}</li>;
};

const LogoutItem = ({ collapsed, onClick }) => {
  const classes = useStyles();
  const button = (
    <button type="button" onClick={onClick} className={clsx(classes.item, collapsed && classes.itemCollapsed)}>
      <ExitToAppIcon />
      {!collapsed && <span className={classes.label}>Sair</span>}
    </button>
  );
  return <li>{withTooltip(button, "Sair", collapsed)}</li>;
};

const Section = ({ label, collapsed }) => {
  const classes = useStyles();
  return collapsed ? <div className={classes.sectionCollapsed} /> : <div className={classes.section}>{label}</div>;
};

const MainListItems = ({ drawerClose, collapsed = false }) => {
  const classes = useStyles();
  const { user, handleLogout } = useContext(AuthContext);
  const { whatsApps } = useContext(WhatsAppsContext);
  const isMaster = user?.profile === "admin_master";
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

  const connectionsIcon = (
    <Badge variant="dot" invisible={!connectionWarning} color="error" overlap="circular">
      <SyncAltIcon />
    </Badge>
  );

  // Perfil Whatsapp Control: CRM, conexões e (nível alto) auditoria.
  if (user?.profile === "whatsapp_control" || user?.profile === "whatsapp_control_high") {
    const isHigh = user?.profile === "whatsapp_control_high";
    return (
      <nav onClick={drawerClose} aria-label="Navegação principal">
        <Section label="CRM" collapsed={collapsed} />
        <ul className={classes.list}>
          <NavItem to="/whatsapp-control" label="CRM" tooltip={CRM_TOOLTIP} icon={<PhoneAndroidIcon />} collapsed={collapsed} />
          <NavItem to="/connections" label="Conexões" icon={connectionsIcon} collapsed={collapsed} />
          {isHigh && <NavItem to="/audit" label="Auditoria" icon={<SecurityOutlinedIcon />} collapsed={collapsed} />}
        </ul>
        <Section label="Conta" collapsed={collapsed} />
        <ul className={classes.list}>
          <LogoutItem collapsed={collapsed} onClick={handleLogout} />
        </ul>
      </nav>
    );
  }

  if (user?.profile === "operator") {
    return (
      <nav onClick={drawerClose} aria-label="Navegação principal">
        <Section label="Atendimento" collapsed={collapsed} />
        <ul className={classes.list}>
          <NavItem to="/live" label="Atendimento" icon={<QuestionAnswerOutlinedIcon />} collapsed={collapsed} />
        </ul>
        <Section label="Conta" collapsed={collapsed} />
        <ul className={classes.list}>
          <LogoutItem collapsed={collapsed} onClick={handleLogout} />
        </ul>
      </nav>
    );
  }

  return (
    <nav onClick={drawerClose} aria-label="Navegação principal">
      <Section label="Gestão" collapsed={collapsed} />
      <ul className={classes.list}>
        <NavItem to="/whatsapp-control" label="CRM" tooltip={CRM_TOOLTIP} icon={<PhoneAndroidIcon />} collapsed={collapsed} />
        <Can
          role={user.profile}
          perform="audit:view"
          yes={() => <NavItem to="/audit" label="Auditoria" icon={<SecurityOutlinedIcon />} collapsed={collapsed} />}
        />
        <NavItem
          to="/connections"
          label={i18n.t("mainDrawer.listItems.connections")}
          icon={connectionsIcon}
          collapsed={collapsed}
        />
      </ul>

      <Section label="Atendimento" collapsed={collapsed} />
      <ul className={classes.list}>
        <NavItem to="/tickets" label={i18n.t("mainDrawer.listItems.tickets")} icon={<WhatsAppIcon />} collapsed={collapsed} />
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
        <NavItem to="/" label="Dashboard" icon={<DashboardOutlinedIcon />} collapsed={collapsed} />
      </ul>

      <Can
        role={user.profile}
        perform="drawer-admin-items:view"
        yes={() => (
          <>
            <Section label={i18n.t("mainDrawer.listItems.administration")} collapsed={collapsed} />
            <ul className={classes.list}>
              {isMaster && (
                <NavItem
                  to="/users"
                  label={i18n.t("mainDrawer.listItems.users")}
                  icon={<PeopleAltOutlinedIcon />}
                  collapsed={collapsed}
                />
              )}
              <NavItem
                to="/queues"
                label={i18n.t("mainDrawer.listItems.queues")}
                icon={<AccountTreeOutlinedIcon />}
                collapsed={collapsed}
              />
              {isMaster && (
                <NavItem
                  to="/settings"
                  label={i18n.t("mainDrawer.listItems.settings")}
                  icon={<SettingsOutlinedIcon />}
                  collapsed={collapsed}
                />
              )}
            </ul>
          </>
        )}
      />
    </nav>
  );
};

export default MainListItems;
