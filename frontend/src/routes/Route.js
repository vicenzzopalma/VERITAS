import React, { useContext } from "react";
import { Route as RouterRoute, Redirect } from "react-router-dom";

import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";

// Tela inicial de cada perfil: operador vai para o Atendimento; todo o resto, para o CRM.
const homePath = user => (user?.profile === "operator" ? "/live" : "/whatsapp-control");

const Route = ({ component: Component, isPrivate = false, ...rest }) => {
  const { isAuth, loading, user } = useContext(AuthContext);

  if (loading) {
    return <BackdropLoading />;
  }

  if (!isAuth && isPrivate) {
    return (
      <Redirect to={{ pathname: "/login", state: { from: rest.location } }} />
    );
  }

  if (isAuth && !isPrivate) {
    return (
      <Redirect to={{ pathname: homePath(user), state: { from: rest.location } }} />
    );
  }

  // Entrar direto no endereço do VERITAS abre a tela inicial do perfil (CRM).
  if (isAuth && rest.path === "/") {
    return <Redirect to={{ pathname: homePath(user) }} />;
  }

  // Bloqueio rigoroso de rota para operadores de chat
  if (isAuth && user?.profile === "operator" && rest.path !== "/live" && rest.path !== "/live/:ticketId?") {
    return (
      <Redirect to={{ pathname: "/live" }} />
    );
  }

  // Bloqueio rigoroso de rota para usuários originários do Whatsapp Control
  // Gestor Baixo: apenas /whatsapp-control e /connections (se canAccessConnections)
  // Gestor Alto: /whatsapp-control, /connections (se canAccessConnections) e /audit
  if (
    isAuth &&
    (user?.profile === "whatsapp_control" || user?.profile === "whatsapp_control_high")
  ) {
    const isHigh = user?.profile === "whatsapp_control_high";
    const allowed =
      rest.path === "/whatsapp-control" ||
      rest.path === "/connections" ||
      (isHigh && rest.path === "/audit");

    if (!allowed) {
      return (
        <Redirect to={{ pathname: "/whatsapp-control" }} />
      );
    }
  }

  // Bloqueio rigoroso de rota para /audit (apenas perfil admin e whatsapp_control_high)
  if (isAuth && rest.path === "/audit") {
    const isManagerHigh = user?.profile === "whatsapp_control_high";
    const isAdmin = ["admin", "admin_master", "admin_operational"].includes(user?.profile);
    const canAccessAudit = isAdmin || isManagerHigh;
    if (!canAccessAudit) {
      if (user?.profile === "whatsapp_control") {
        return <Redirect to={{ pathname: "/whatsapp-control" }} />;
      }
      if (user?.profile === "operator") {
        return <Redirect to={{ pathname: "/live" }} />;
      }
      return <Redirect to={{ pathname: homePath(user) }} />;
    }
  }

    // Bloqueio rigoroso de rota para /users e /settings (apenas perfil admin_master)
  if (
    isAuth &&
    (rest.path === "/users" || rest.path === "/settings" || rest.path === "/Settings")
  ) {
    if (user?.profile !== "admin_master") {
      let fallback = homePath(user);
      if (user?.profile === "whatsapp_control" || user?.profile === "whatsapp_control_high") {
        fallback = "/whatsapp-control";
      } else if (user?.profile === "operator") {
        fallback = "/live";
      }
      return <Redirect to={{ pathname: fallback }} />;
    }
  }

  return (
    <RouterRoute {...rest} component={Component} />
  );
};

export default Route;
