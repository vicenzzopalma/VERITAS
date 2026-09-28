import React, { useContext } from "react";
import { Route as RouterRoute, Redirect } from "react-router-dom";

import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";

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
    let defaultPath = "/";
    if (user?.profile === "operator") defaultPath = "/live";
    if (user?.profile === "whatsapp_control" || user?.profile === "whatsapp_control_high") defaultPath = "/whatsapp-control";
    return (
      <Redirect to={{ pathname: defaultPath, state: { from: rest.location } }} />
    );
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

  return (
    <RouterRoute {...rest} component={Component} />
  );
};

export default Route;
