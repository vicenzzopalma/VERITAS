import React, { useCallback, useEffect, useMemo, useState } from "react";
import { makeStyles, Box, CircularProgress } from "@material-ui/core";
import QrcodeModal from "../../components/QrcodeModal";

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
  const [qrWhatsappId, setQrWhatsappId] = useState(null);

  // O CRM (iframe, mesma origem) pede para abrir o QR de uma conexão pelo mini botão de QR.
  useEffect(() => {
    const onMessage = event => {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type === "crm:open-qr" && Number.isInteger(data.whatsappId) && data.whatsappId > 0) {
        setQrWhatsappId(data.whatsappId);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleCloseQr = useCallback(() => setQrWhatsappId(null), []);

  // Fixo por token: abrir/fechar o QR não pode recarregar o CRM.
  const iframeSrc = useMemo(
    () => (token ? `/crm/?sso_token=${encodeURIComponent(token)}&_t=${Date.now()}` : "/crm/"),
    [token]
  );

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

  return (
    <div className={classes.root}>
      <iframe
        src={iframeSrc}
        title="Whatsapp Control CRM (Gestão de Celulares)"
        className={classes.iframe}
        allow="camera; microphone; clipboard-read; clipboard-write"
      />
      {qrWhatsappId && (
        <QrcodeModal open whatsAppId={qrWhatsappId} onClose={handleCloseQr} />
      )}
    </div>
  );
};

export default WhatsappControl;
