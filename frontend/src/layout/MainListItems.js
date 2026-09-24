import React, { useContext, useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";

import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import { Badge } from "@material-ui/core";
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

const useStyles = makeStyles((theme) => ({
  crmMenuContainer: {
    "& .MuiListItemIcon-root": {
      color: "#ffffff !important",
      minWidth: 42,
    },
    "& .MuiSvgIcon-root": {
      color: "#ffffff !important",
      fill: "#ffffff !important",
      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
    },
    "& .MuiListItemText-primary": {
      color: "#ffffff !important",
      fontWeight: 500,
      fontSize: "0.92rem",
    },
    "& .MuiListSubheader-root": {
      color: "#94a3b8 !important",
      fontWeight: 700,
      fontSize: "0.72rem",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    }
  },
  crmActiveItem: {
    backgroundColor: "rgba(88, 101, 242, 0.28) !important",
    borderLeft: "4px solid #5865f2 !important",
    borderRadius: "0 12px 12px 0 !important",
    margin: "3px 8px 3px 0 !important",
    color: "#ffffff !important",
    "& .MuiListItemIcon-root": {
      color: "#818cf8 !important",
    },
    "& .MuiSvgIcon-root": {
      color: "#818cf8 !important",
      fill: "#818cf8 !important",
      filter: "drop-shadow(0 0 6px rgba(88,101,242,0.6)) !important",
    },
    "& .MuiListItemText-primary": {
      color: "#ffffff !important",
      fontWeight: "700 !important",
    }
  },
  crmItem: {
    borderRadius: "12px",
    margin: "3px 8px",
    color: "#ffffff !important",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    "& .MuiListItemIcon-root": {
      color: "#ffffff !important",
      minWidth: 42,
    },
    "& .MuiSvgIcon-root": {
      color: "#ffffff !important",
      fill: "#ffffff !important",
      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
    },
    "& .MuiListItemText-primary": {
      color: "#ffffff !important",
      fontWeight: 500,
    },
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.12) !important",
      transform: "translateX(3px)",
      "& .MuiListItemIcon-root": {
        color: "#818cf8 !important",
      },
      "& .MuiSvgIcon-root": {
        color: "#818cf8 !important",
        fill: "#818cf8 !important",
      },
      "& .MuiListItemText-primary": {
        color: "#ffffff !important",
      }
    }
  }
}));

function ListItemLink(props) {
  const { icon, primary, to, className, isWhatsappControl, active, collapsed } = props;

  const renderLink = React.useMemo(
    () =>
      React.forwardRef((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to]
  );

  return (
    <li style={collapsed ? { width: "68px", maxWidth: "68px", overflow: "hidden" } : undefined}>
      <ListItem
        button
        component={renderLink}
        className={className}
        style={
          isWhatsappControl
            ? {
                borderRadius: collapsed ? "0" : active ? "0 14px 14px 0" : "14px",
                margin: collapsed ? "0" : active ? "3px 8px 3px 0" : "3px 8px",
                backgroundColor: active ? "rgba(88, 101, 242, 0.28)" : "transparent",
                borderLeft: active ? "4px solid #5865f2" : "4px solid transparent",
                color: "#ffffff",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                ...(collapsed
                  ? {
                      width: "68px",
                      maxWidth: "68px",
                      minWidth: "68px",
                      boxSizing: "border-box",
                      overflow: "hidden",
                      paddingLeft: "10px",
                      paddingRight: "10px",
                      marginRight: "0",
                      borderRight: "0",
                    }
                  : {}),
              }
            : undefined
        }
      >
        {icon ? (
          <ListItemIcon
            style={
              isWhatsappControl
                ? {
                    color: active ? "#818cf8" : "#ffffff",
                    minWidth: collapsed ? 0 : 42,
                    width: collapsed ? "100%" : undefined,
                    justifyContent: collapsed ? "center" : undefined,
                  }
                : undefined
            }
          >
            {React.isValidElement(icon)
              ? React.cloneElement(icon, {
                  style: isWhatsappControl
                    ? {
                        color: active ? "#818cf8" : "#ffffff",
                        fill: active ? "#818cf8" : "#ffffff",
                        filter: active
                          ? "drop-shadow(0 0 6px rgba(88,101,242,0.6))"
                          : "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
                      }
                    : undefined,
                })
              : icon}
          </ListItemIcon>
        ) : null}
        {!collapsed && (
          <ListItemText
            primary={primary}
            primaryTypographyProps={{
              style: isWhatsappControl
                ? {
                    color: "#ffffff",
                    fontWeight: active ? 700 : 500,
                    fontSize: "0.92rem",
                    fontFamily: "'Outfit', sans-serif",
                  }
                : undefined,
            }}
          />
        )}
      </ListItem>
    </li>
  );
}

const MainListItems = (props) => {
  const { drawerClose, collapsed = false } = props;
  const classes = useStyles();
  const location = useLocation();
  const isWhatsappControl = location.pathname.startsWith("/whatsapp-control");
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user, handleLogout } = useContext(AuthContext);
  const [connectionWarning, setConnectionWarning] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) => {
          return (
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
          );
        });
        if (offlineWhats.length > 0) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
      }
    }, 2000);
    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  const getItemClass = (path) => {
    if (isWhatsappControl) {
      if (location.pathname === path) {
        return `${classes.crmActiveItem} crm-active-item`;
      }
      return `${classes.crmItem} crm-menu-item`;
    }
    return undefined;
  };

  // O perfil Whatsapp Control acessa o CRM e as conexões do setor PA FIXA.
  if (user?.profile === "whatsapp_control") {
    return (
      <div onClick={drawerClose} className={classes.crmMenuContainer}>
        <ListItemLink
          to="/whatsapp-control"
          primary="Whatsapp Control"
          icon={<PhoneAndroidIcon />}
          className={getItemClass("/whatsapp-control")}
          isWhatsappControl={true}
          active={true}
          collapsed={collapsed}
        />
        {user.canAccessConnections && (
          <ListItemLink
            to="/connections"
            primary="Conexões"
            icon={<SyncAltIcon />}
            className={getItemClass("/connections")}
            isWhatsappControl={true}
            active={location.pathname === "/connections"}
            collapsed={collapsed}
          />
        )}
        <Divider style={{ margin: "12px 0", backgroundColor: "rgba(255, 255, 255, 0.1)" }} />
        <li>
          <ListItem
            button
            onClick={handleLogout}
            className={classes.crmItem}
            style={{ borderRadius: 8, margin: "3px 8px", color: "#ffffff" }}
          >
            <ListItemIcon style={{ color: "#ffffff", minWidth: 42 }}>
              <ExitToAppIcon style={{ color: "#ffffff", fill: "#ffffff" }} />
            </ListItemIcon>
            <ListItemText
              primary="Sair"
              primaryTypographyProps={{
                style: {
                  color: "#ffffff",
                  fontWeight: 500,
                  fontSize: "0.92rem",
                  fontFamily: "'Outfit', sans-serif",
                },
              }}
            />
          </ListItem>
        </li>
      </div>
    );
  }

  return (
    <div onClick={drawerClose} className={isWhatsappControl ? classes.crmMenuContainer : undefined}>
      {/* 1. Whatsapp Control EM PRIMEIRO */}
      <ListItemLink
        to="/whatsapp-control"
        primary="Whatsapp Control"
        icon={<PhoneAndroidIcon />}
        className={getItemClass("/whatsapp-control")}
        isWhatsappControl={isWhatsappControl}
        active={location.pathname === "/whatsapp-control"}
      />

      {/* 2. Auditoria */}
      <Can
        role={user.profile}
        perform="audit:view"
        yes={() => (
          <ListItemLink
            to="/audit"
            primary="Auditoria"
            icon={<SecurityOutlinedIcon />}
            className={getItemClass("/audit")}
            isWhatsappControl={isWhatsappControl}
            active={location.pathname === "/audit"}
          />
        )}
      />

      {/* 3. Conexões */}
      <ListItemLink
        to="/connections"
        primary={i18n.t("mainDrawer.listItems.connections")}
        icon={
          <Badge badgeContent={connectionWarning ? "!" : 0} color="error">
            <SyncAltIcon />
          </Badge>
        }
        className={getItemClass("/connections")}
        isWhatsappControl={isWhatsappControl}
        active={location.pathname === "/connections"}
      />

      {/* 4. Tickets */}
      <ListItemLink
        to="/tickets"
        primary={i18n.t("mainDrawer.listItems.tickets")}
        icon={<WhatsAppIcon />}
        className={getItemClass("/tickets")}
        isWhatsappControl={isWhatsappControl}
        active={location.pathname === "/tickets"}
      />

      {/* 5. Contatos */}
      <ListItemLink
        to="/contacts"
        primary={i18n.t("mainDrawer.listItems.contacts")}
        icon={<ContactPhoneOutlinedIcon />}
        className={getItemClass("/contacts")}
        isWhatsappControl={isWhatsappControl}
        active={location.pathname === "/contacts"}
      />

      {/* 6. Respostas Rápidas */}
      <ListItemLink
        to="/quickAnswers"
        primary={i18n.t("mainDrawer.listItems.quickAnswers")}
        icon={<QuestionAnswerOutlinedIcon />}
        className={getItemClass("/quickAnswers")}
        isWhatsappControl={isWhatsappControl}
        active={location.pathname === "/quickAnswers"}
      />

      {/* 7. Dashboard EMBAIXO DE RESPOSTAS RÁPIDAS */}
      <ListItemLink
        to="/"
        primary="Dashboard"
        icon={<DashboardOutlinedIcon />}
        className={getItemClass("/")}
        isWhatsappControl={isWhatsappControl}
        active={location.pathname === "/"}
      />

      {/* 8. Administração */}
      <Can
        role={user.profile}
        perform="drawer-admin-items:view"
        yes={() => (
          <>
            <Divider style={isWhatsappControl ? { backgroundColor: "rgba(255, 255, 255, 0.1)" } : undefined} />
            <ListSubheader
              inset
              style={
                isWhatsappControl
                  ? {
                      color: "#94a3b8",
                      backgroundColor: "transparent",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontFamily: "'Outfit', sans-serif",
                    }
                  : undefined
              }
            >
              {i18n.t("mainDrawer.listItems.administration")}
            </ListSubheader>
            <ListItemLink
              to="/users"
              primary={i18n.t("mainDrawer.listItems.users")}
              icon={<PeopleAltOutlinedIcon />}
              className={getItemClass("/users")}
              isWhatsappControl={isWhatsappControl}
              active={location.pathname === "/users"}
            />
            <ListItemLink
              to="/queues"
              primary={i18n.t("mainDrawer.listItems.queues")}
              icon={<AccountTreeOutlinedIcon />}
              className={getItemClass("/queues")}
              isWhatsappControl={isWhatsappControl}
              active={location.pathname === "/queues"}
            />
            <ListItemLink
              to="/settings"
              primary={i18n.t("mainDrawer.listItems.settings")}
              icon={<SettingsOutlinedIcon />}
              className={getItemClass("/settings")}
              isWhatsappControl={isWhatsappControl}
              active={location.pathname === "/settings"}
            />
          </>
        )}
      />
    </div>
  );
};

export default MainListItems;
