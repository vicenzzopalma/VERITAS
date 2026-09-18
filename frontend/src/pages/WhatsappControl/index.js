import React, { useEffect, useState } from "react";
import { makeStyles, Box, CircularProgress } from "@material-ui/core";

const useStyles = makeStyles(() => ({
  root: {
    height: "100vh",
    width: "100%",
    padding: 0,
    margin: 0,
    overflow: "hidden",
    backgroundColor: "#0c0d14",
  },
  iframe: {
    width: "100%",
    height: "100%",
    border: "none",
    display: "block",
  },
  loadingBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    width: "100%",
    backgroundColor: "#0c0d14",
    color: "#5865f2",
  }
}));

const WhatsappControl = () => {
  const classes = useStyles();
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let currentToken = localStorage.getItem("token") || "";
    try {
      currentToken = JSON.parse(currentToken);
    } catch (e) {}
    if (typeof currentToken === "string") {
      currentToken = currentToken.replace(/^["']|["']$/g, "").trim();
    }
    if (currentToken) {
      try {
        sessionStorage.setItem("crm_sso_token", currentToken);
        localStorage.setItem("crm_sso_token", currentToken);
      } catch (e) {}
    }
    setToken(currentToken);
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <Box className={classes.loadingBox}>
        <CircularProgress color="inherit" />
      </Box>
    );
  }

  const iframeSrc = token ? `/crm/?sso_token=${encodeURIComponent(token)}&_t=${Date.now()}` : "/crm/";

  return (
    <div className={classes.root}>
      <iframe
        src={iframeSrc}
        title="Whatsapp Control"
        className={classes.iframe}
        allow="camera; microphone; clipboard-read; clipboard-write"
      />
    </div>
  );
};

export default WhatsappControl;
