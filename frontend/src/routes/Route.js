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
    if (user?.profile === "whatsapp_control") defaultPath = "/whatsapp-control";
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
  // Não permite ver, enxergar ou usar nenhuma outra tela do Veritas
  if (isAuth && user?.profile === "whatsapp_control" && rest.path !== "/whatsapp-control") {
    return (
      <Redirect to={{ pathname: "/whatsapp-control" }} />
    );
  }

  return (
    <RouterRoute {...rest} component={Component} />
  );
};

export default Route;
