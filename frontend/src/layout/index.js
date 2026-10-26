import React, { useState, useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";
import clsx from "clsx";
import {
  makeStyles,
  useTheme,
  useMediaQuery,
  Drawer,
  MenuItem,
  IconButton,
  Menu,
  Tooltip,
  Avatar,
  Divider,
  ListItemIcon,
} from "@material-ui/core";
import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import Brightness4Outlined from "@material-ui/icons/Brightness4Outlined";
import WbSunnyOutlined from "@material-ui/icons/WbSunnyOutlined";
import PersonOutline from "@material-ui/icons/PersonOutline";
import ExitToApp from "@material-ui/icons/ExitToApp";
import UnfoldMore from "@material-ui/icons/UnfoldMore";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import { useThemeContext } from "../context/DarkMode";

const drawerWidth = 256;
const railWidth = 76;
const COLLAPSE_KEY = "gisaio:sidebar-collapsed";

const PAGE_TITLES = [
  ["/audit", "Cofre de Auditoria", "Visão geral"],
  ["/tickets", "Tickets", "Atendimento"],
  ["/contacts", "Contatos", "Atendimento"],
  ["/quickanswers", "Respostas Rápidas", "Atendimento"],
  ["/connections", "Conexões", "Atendimento"],
  ["/users", "Usuários", "Administração"],
  ["/queues", "Filas", "Administração"],
  ["/settings", "Configurações", "Administração"],
];

const getPageMeta = (pathname) => {
  const p = pathname.toLowerCase();
  const match = PAGE_TITLES.find(([prefix]) => p.startsWith(prefix));
  return match ? { title: match[1], group: match[2] } : { title: "Dashboard", group: "Visão geral" };
};

export const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase() || "?";

const useStyles = makeStyles((theme) => {
  const c = theme.custom;
  return {
    root: {
      display: "flex",
      height: "100vh",
      backgroundColor: c.bg,
    },
    drawerPaper: {
      position: "relative",
      width: drawerWidth,
      overflowX: "hidden",
      backgroundColor: c.surface,
      display: "flex",
      flexDirection: "column",
      transition: theme.transitions.create("width", {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
    },
    drawerCollapsed: { width: railWidth },
    brand: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      height: 64,
      padding: "0 16px 0 20px",
      flex: "none",
    },
    brandCollapsed: { justifyContent: "center", padding: 0 },
    logo: {
      width: 34,
      height: 34,
      borderRadius: 10,
      background: c.gradient,
      color: "#fff",
      display: "grid",
      placeItems: "center",
      fontWeight: 800,
      fontSize: 16,
      flex: "none",
      boxShadow: `0 6px 16px -6px ${theme.palette.primary.main}`,
    },
    brandText: { flex: 1, minWidth: 0, lineHeight: 1.15 },
    brandName: { fontWeight: 750, fontSize: "1rem", letterSpacing: "-0.01em" },
    brandSub: { fontSize: "0.72rem", color: c.textSubtle, fontWeight: 500 },
    nav: {
      flex: 1,
      overflowY: "auto",
      overflowX: "hidden",
      padding: theme.spacing(0.5, 1.5, 2),
    },
    navCollapsed: { padding: theme.spacing(0.5, 1, 2) },
    userCard: {
      margin: theme.spacing(1.5),
      padding: 10,
      display: "flex",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      border: `1px solid ${c.border}`,
      backgroundColor: c.surfaceAlt,
      cursor: "pointer",
      textAlign: "left",
      font: "inherit",
      color: "inherit",
      width: `calc(100% - ${theme.spacing(3)}px)`,
      transition: "background-color .15s",
      "&:hover": { backgroundColor: c.surfaceHover },
    },
    userCardCollapsed: { justifyContent: "center", padding: 6, border: "none", background: "none" },
    avatar: {
      width: 34,
      height: 34,
      fontSize: "0.8rem",
      fontWeight: 700,
      background: c.gradient,
      color: "#fff",
    },
    userText: { flex: 1, minWidth: 0, lineHeight: 1.2 },
    userName: {
      fontWeight: 650,
      fontSize: "0.85rem",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    userRole: { fontSize: "0.72rem", color: c.textSubtle, textTransform: "capitalize" },
    main: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      height: "100vh",
    },
    topbar: {
      height: 64,
      flex: "none",
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: theme.spacing(0, 3),
      borderBottom: `1px solid ${c.border}`,
      backgroundColor: theme.palette.type === "dark" ? "rgba(18,21,31,0.8)" : "rgba(255,255,255,0.8)",
      backdropFilter: "saturate(180%) blur(10px)",
      position: "relative",
      zIndex: 2,
      [theme.breakpoints.down("xs")]: { padding: theme.spacing(0, 1.5) },
    },
    crumbs: { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 },
    crumbGroup: {
      color: c.textSubtle,
      fontSize: "0.85rem",
      fontWeight: 500,
      [theme.breakpoints.down("xs")]: { display: "none" },
    },
    crumbSep: { color: c.borderStrong, [theme.breakpoints.down("xs")]: { display: "none" } },
    crumbTitle: { fontWeight: 650, fontSize: "0.92rem", whiteSpace: "nowrap" },
    topActions: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      "& .MuiIconButton-root": { width: 38, height: 38 },
    },
    content: {
      flex: 1,
      overflow: "auto",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
    },
    menuHeader: { padding: "10px 16px 8px", minWidth: 220 },
  };
});

const LoggedInLayout = ({ children }) => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("xs"));
  const { pathname } = useLocation();

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch (e) {
      return false;
    }
  });
  const { handleLogout, loading, user } = useContext(AuthContext);
  const { darkMode, toggleTheme } = useThemeContext();

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch (e) {
      // ignore
    }
  }, [collapsed]);

  const handleCloseMenu = () => setAnchorEl(null);

  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseMenu();
  };

  const handleClickLogout = () => {
    handleCloseMenu();
    handleLogout();
  };

  if (loading) {
    return <BackdropLoading />;
  }

  const isCollapsed = !isMobile && collapsed;
  const { title, group } = getPageMeta(pathname);

  const drawerContent = (
    <>
      <div className={clsx(classes.brand, isCollapsed && classes.brandCollapsed)}>
        <div className={classes.logo}>G</div>
        {!isCollapsed && (
          <>
            <div className={classes.brandText}>
              <div className={classes.brandName}>Gisaio</div>
              <div className={classes.brandSub}>Atendimento &amp; Auditoria</div>
            </div>
            {!isMobile && (
              <Tooltip title="Recolher menu">
                <IconButton size="small" onClick={() => setCollapsed(true)} aria-label="Recolher menu">
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}
      </div>
      {isCollapsed && (
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 4 }}>
          <Tooltip title="Expandir menu" placement="right">
            <IconButton size="small" onClick={() => setCollapsed(false)} aria-label="Expandir menu">
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      )}
      <div className={clsx(classes.nav, isCollapsed && classes.navCollapsed)}>
        <MainListItems
          collapsed={isCollapsed}
          drawerClose={() => isMobile && setMobileOpen(false)}
        />
      </div>
      {user?.id && (
        <button
          type="button"
          className={clsx(classes.userCard, isCollapsed && classes.userCardCollapsed)}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-haspopup="true"
          aria-controls="user-menu"
        >
          <Avatar className={classes.avatar}>{initials(user.name)}</Avatar>
          {!isCollapsed && (
            <>
              <div className={classes.userText}>
                <div className={classes.userName}>{user.name}</div>
                <div className={classes.userRole}>{user.profile}</div>
              </div>
              <UnfoldMore fontSize="small" style={{ opacity: 0.5 }} />
            </>
          )}
        </button>
      )}
    </>
  );

  return (
    <div className={classes.root}>
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          classes={{ paper: classes.drawerPaper }}
          ModalProps={{ keepMounted: true }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          open
          classes={{ paper: clsx(classes.drawerPaper, isCollapsed && classes.drawerCollapsed) }}
        >
          {drawerContent}
        </Drawer>
      )}

      <UserModal open={userModalOpen} onClose={() => setUserModalOpen(false)} userId={user?.id} />

      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
      >
        <div className={classes.menuHeader}>
          <div className={classes.userName}>{user?.name}</div>
          <div className={classes.userRole} style={{ textTransform: "none" }}>
            {user?.email}
          </div>
        </div>
        <Divider style={{ margin: "4px 0" }} />
        <MenuItem onClick={handleOpenUserModal}>
          <ListItemIcon style={{ minWidth: 32 }}>
            <PersonOutline fontSize="small" />
          </ListItemIcon>
          {i18n.t("mainDrawer.appBar.user.profile")}
        </MenuItem>
        <MenuItem onClick={toggleTheme}>
          <ListItemIcon style={{ minWidth: 32 }}>
            {darkMode ? <WbSunnyOutlined fontSize="small" /> : <Brightness4Outlined fontSize="small" />}
          </ListItemIcon>
          {darkMode ? "Tema claro" : "Tema escuro"}
        </MenuItem>
        <MenuItem onClick={handleClickLogout}>
          <ListItemIcon style={{ minWidth: 32 }}>
            <ExitToApp fontSize="small" />
          </ListItemIcon>
          {i18n.t("mainDrawer.appBar.user.logout")}
        </MenuItem>
      </Menu>

      <div className={classes.main}>
        <header className={classes.topbar}>
          {isMobile && (
            <IconButton edge="start" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}
          <div className={classes.crumbs}>
            <span className={classes.crumbGroup}>{group}</span>
            <span className={classes.crumbSep}>/</span>
            <span className={classes.crumbTitle}>{title}</span>
          </div>
          <div className={classes.topActions}>
            <Tooltip title={darkMode ? "Tema claro" : "Tema escuro"}>
              <IconButton onClick={toggleTheme} aria-label="Alternar tema">
                {darkMode ? <WbSunnyOutlined fontSize="small" /> : <Brightness4Outlined fontSize="small" />}
              </IconButton>
            </Tooltip>
            {user?.id && <NotificationsPopOver />}
          </div>
        </header>
        <main className={classes.content}>{children ? children : null}</main>
      </div>
    </div>
  );
};

export default LoggedInLayout;
