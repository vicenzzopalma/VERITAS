import React, { useState, useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";
import clsx from "clsx";
import {
  makeStyles,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  MenuItem,
  IconButton,
  Menu,
  Switch,
} from "@material-ui/core";
import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import AccountCircle from "@material-ui/icons/AccountCircle";
import Brightness4Icon from "@material-ui/icons/Brightness4";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import { useThemeContext } from "../context/DarkMode";

const drawerWidth = 240;
const collapsedWidth = 68;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
  },
  toolbar: {
    paddingRight: 24,
  },
  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: "0 8px",
    minHeight: "48px",
  },
  appBar: {
    zIndex: theme.zIndex.drawer - 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: 200,
    }),
    backgroundColor: theme.palette.background.default,
    marginLeft: collapsedWidth,
    width: `calc(100% - ${collapsedWidth}px)`,
  },
  menuButton: {
    marginRight: 20,
    color: theme.palette.text.primary,
  },
  title: {
    flexGrow: 1,
    color: theme.palette.text.primary,
  },
  drawerContainer: {
    width: collapsedWidth,
    flexShrink: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  drawerPaper: {
    width: drawerWidth,
    transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
    overflowX: "hidden",
    boxShadow: "6px 0 24px rgba(0, 0, 0, 0.25)",
    zIndex: theme.zIndex.drawer + 5,
    backgroundColor: theme.palette.background.paper,
  },
  drawerPaperClose: {
    width: collapsedWidth,
    transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "2px 0 8px rgba(0, 0, 0, 0.08)",
    zIndex: theme.zIndex.drawer + 5,
    overflowX: "hidden",
    overflowY: "auto",
    boxSizing: "border-box",
    "& .MuiListItemText-root": {
      display: "none",
    },
    "& .MuiListItemIcon-root": {
      minWidth: 0,
      width: "100%",
      justifyContent: "center",
    },
    "& .MuiListItem-root": {
      width: "52px",
      minWidth: "52px",
      maxWidth: "52px",
      boxSizing: "border-box",
      overflow: "hidden",
      paddingLeft: "12px",
      paddingRight: "12px",
      marginRight: "0 !important",
      borderRight: "0 !important",
    },
    "& li": {
      width: "68px",
      maxWidth: "68px",
      overflow: "hidden",
    },
  },
  crmDrawerPaper: {
    backgroundColor: "#0c0d14 !important",
    borderRight: "1px solid rgba(255, 255, 255, 0.08) !important",
    fontFamily: "'Outfit', sans-serif !important",
    boxShadow: "8px 0 32px rgba(0, 0, 0, 0.6) !important",
    "& *": {
      fontFamily: "'Outfit', sans-serif !important",
    },
    "& .MuiDivider-root": {
      backgroundColor: "rgba(255, 255, 255, 0.1) !important",
    },
    "& .MuiIconButton-root": {
      color: "#ffffff !important",
    },
    "& .MuiSvgIcon-root": {
      color: "#ffffff !important",
      fill: "#ffffff !important",
    },
    "& .MuiTypography-root": {
      color: "#ffffff !important",
      fontWeight: 500,
    },
    "& .MuiListItemIcon-root": {
      color: "#ffffff !important",
    },
    "& .MuiListItemText-primary": {
      color: "#ffffff !important",
    },
    "& .MuiListSubheader-root": {
      color: "#94a3b8 !important",
      backgroundColor: "transparent !important",
      fontWeight: 700,
      fontSize: "0.75rem",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
    }
  },
  appBarSpacer: {
    minHeight: "48px",
  },
  content: {
    flex: 1,
    overflow: "auto",
    height: "100vh",
  },
  contentFull: {
    flex: 1,
    overflow: "hidden",
    height: "100vh",
    margin: 0,
    padding: 0,
  },
  switch: {
    transform: "scale(0.8)",
  },
  iconButton: {
    color: theme.palette.text.primary,
  },
  themeSwitchContainer: {
    display: "flex",
    alignItems: "center",
  },
  themeIcon: {
    color: theme.palette.text.primary,
  },
}));

const LoggedInLayout = ({ children }) => {
  const classes = useStyles();
  const location = useLocation();

  if (location.pathname.startsWith("/live")) {
    return <>{children}</>;
  }

  const isWhatsappControl = location.pathname.startsWith("/whatsapp-control");

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, loading } = useContext(AuthContext);

  // Menu Retrátil por Hover
  const [drawerHovered, setDrawerHovered] = useState(false);
  const isDrawerExpanded = drawerHovered;

  const { user } = useContext(AuthContext);
  const { darkMode, toggleTheme } = useThemeContext();

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuOpen(false);
  };

  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseMenu();
  };

  const handleClickLogout = () => {
    handleCloseMenu();
    handleLogout();
  };

  const drawerClose = () => {
    setDrawerHovered(false);
  };

  if (loading) {
    return <BackdropLoading />;
  }

  return (
    <div className={classes.root}>
      {/* Menu Lateral Retrátil Flutuante (expansão no hover) */}
      <div
        className={classes.drawerContainer}
        onMouseEnter={() => setDrawerHovered(true)}
        onMouseLeave={() => setDrawerHovered(false)}
      >
        <Drawer
          variant="permanent"
          classes={{
            paper: clsx(
              isDrawerExpanded ? classes.drawerPaper : classes.drawerPaperClose,
              isWhatsappControl && classes.crmDrawerPaper,
              isWhatsappControl && "crm-drawer-dark-mode"
            ),
          }}
          open={isDrawerExpanded}
        >
          <div className={classes.toolbarIcon}>
            <IconButton
              onClick={() => setDrawerHovered(!drawerHovered)}
              style={isWhatsappControl ? { color: "#ffffff" } : undefined}
            >
              {isDrawerExpanded ? (
                <ChevronLeftIcon style={isWhatsappControl ? { color: "#ffffff", fill: "#ffffff" } : undefined} />
              ) : (
                <MenuIcon style={isWhatsappControl ? { color: "#ffffff", fill: "#ffffff" } : undefined} />
              )}
            </IconButton>
          </div>
          <Divider style={isWhatsappControl ? { backgroundColor: "rgba(255, 255, 255, 0.1)" } : undefined} />
          <List>
            <MainListItems drawerClose={drawerClose} collapsed={!isDrawerExpanded} />
          </List>
          <Divider style={isWhatsappControl ? { backgroundColor: "rgba(255, 255, 255, 0.1)" } : undefined} />
        </Drawer>
      </div>

      <UserModal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        userId={user?.id}
      />

      {/* Na aba Whatsapp Control, o CRM tem seu próprio header completo, então ocultamos o AppBar do Veritas */}
      {!isWhatsappControl && (
        <AppBar position="absolute" className={classes.appBar}>
          <Toolbar variant="dense" className={classes.toolbar}>
            <Typography
              component="h1"
              variant="h6"
              noWrap
              className={classes.title}
            >
              VERITAS
            </Typography>

            <div className={classes.themeSwitchContainer}>
              <Brightness4Icon className={classes.themeIcon} />
              <Switch
                checked={darkMode}
                onChange={toggleTheme}
                color="default"
                className={classes.switch}
              />
            </div>

            {user.id && (
              <NotificationsPopOver className={classes.iconButton} />
            )}

            <div>
              <IconButton
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                className={classes.iconButton}
              >
                <AccountCircle />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                getContentAnchorEl={null}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "right",
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                open={menuOpen}
                onClose={handleCloseMenu}
              >
                <MenuItem onClick={handleOpenUserModal}>
                  {i18n.t("mainDrawer.appBar.user.profile")}
                </MenuItem>
                <MenuItem onClick={handleClickLogout}>
                  {i18n.t("mainDrawer.appBar.user.logout")}
                </MenuItem>
              </Menu>
            </div>
          </Toolbar>
        </AppBar>
      )}

      {/* Conteúdo Principal */}
      <main className={isWhatsappControl ? classes.contentFull : classes.content}>
        {!isWhatsappControl && <div className={classes.appBarSpacer} />}
        {children}
      </main>
    </div>
  );
};

export default LoggedInLayout;
