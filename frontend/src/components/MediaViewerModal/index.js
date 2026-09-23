import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Tooltip,
  makeStyles
} from "@material-ui/core";
import CloseIcon from "@material-ui/icons/Close";
import GetAppIcon from "@material-ui/icons/GetApp";
import PictureAsPdfIcon from "@material-ui/icons/PictureAsPdf";
import ImageIcon from "@material-ui/icons/Image";
import VideocamIcon from "@material-ui/icons/Videocam";
import DescriptionIcon from "@material-ui/icons/Description";
import PrintIcon from "@material-ui/icons/Print";
import ZoomInIcon from "@material-ui/icons/ZoomIn";
import ZoomOutIcon from "@material-ui/icons/ZoomOut";

const useStyles = makeStyles(theme => ({
  dialogPaper: {
    backgroundColor: theme.palette.type === "dark" ? "#1e293b" : "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
  },
  dialogTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 16px",
    backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#f8fafc",
    borderBottom: `1px solid ${theme.palette.type === "dark" ? "#334155" : "#e2e8f0"}`,
  },
  titleLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    maxWidth: "calc(100% - 170px)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dialogContent: {
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b141a", // Dark backdrop WhatsApp style
    minHeight: 350,
    maxHeight: "84vh",
    overflow: "auto",
    position: "relative",
  },
  imageContainer: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(1.5),
    minHeight: 350,
    userSelect: "none",
    overflow: "auto",
  },
  imageViewer: {
    maxWidth: "100%",
    maxHeight: "80vh",
    objectFit: "contain",
    display: "block",
    margin: "auto",
    borderRadius: 4,
  },
  pdfIframe: {
    width: "100%",
    height: "80vh",
    border: "none",
    backgroundColor: "#ffffff",
  },
  videoViewer: {
    maxWidth: "100%",
    maxHeight: "80vh",
    outline: "none",
  },
  fileFallback: {
    padding: theme.spacing(4),
    textAlign: "center",
    color: "#ffffff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(2),
  },
  actionButtons: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
}));

const MediaViewerModal = ({ open, onClose, mediaUrl, mediaType, title }) => {
  const classes = useStyles();
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsZoomed(false);
    }
  }, [open, mediaUrl]);

  if (!open || !mediaUrl) return null;

  const isPdf =
    mediaType?.includes("pdf") ||
    mediaUrl?.toLowerCase().endsWith(".pdf") ||
    (mediaType?.includes("document") && mediaUrl?.toLowerCase().includes(".pdf"));

  const isImage =
    mediaType?.startsWith("image") ||
    mediaUrl?.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) ||
    mediaUrl?.includes("pps.whatsapp.net");

  const isVideo =
    mediaType?.startsWith("video") ||
    mediaUrl?.match(/\.(mp4|webm|mkv|mov)($|\?)/i);

  const isAudio =
    mediaType?.startsWith("audio") ||
    mediaUrl?.match(/\.(ogg|mp3|wav|m4a|aac)($|\?)/i);

  const fileName = title || mediaUrl.split("/").pop() || "Arquivo";

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = mediaUrl;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (isPdf) {
      const iframe = document.getElementById("pdf-preview-frame");
      if (iframe) {
        try {
          iframe.contentWindow.print();
          return;
        } catch {
          // fallback
        }
      }
    }
    window.open(mediaUrl, "_blank");
  };

  const renderIcon = () => {
    if (isPdf) return <PictureAsPdfIcon style={{ color: "#ef4444" }} />;
    if (isImage) return <ImageIcon style={{ color: "#38bdf8" }} />;
    if (isVideo) return <VideocamIcon style={{ color: "#a855f7" }} />;
    return <DescriptionIcon style={{ color: "#0284c7" }} />;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={isPdf ? "lg" : "md"}
      fullWidth
      classes={{ paper: classes.dialogPaper }}
    >
      <div className={classes.dialogTitle}>
        <div className={classes.titleLeft}>
          {renderIcon()}
          <Typography variant="subtitle1" style={{ fontWeight: 600, fontSize: "0.95rem" }} noWrap>
            {fileName}
          </Typography>
        </div>

        <div className={classes.actionButtons}>
          {isImage && (
            <Tooltip title={isZoomed ? "Reduzir Foto (100%)" : "Ampliar Foto (Zoom)"}>
              <IconButton size="small" onClick={() => setIsZoomed(!isZoomed)} style={{ color: "#38bdf8" }}>
                {isZoomed ? <ZoomOutIcon fontSize="small" /> : <ZoomInIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}

          {isPdf && (
            <Tooltip title="Imprimir Documento">
              <IconButton size="small" onClick={handlePrint}>
                <PrintIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Baixar Arquivo">
            <IconButton size="small" onClick={handleDownload}>
              <GetAppIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Fechar">
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <DialogContent className={classes.dialogContent}>
        {isImage && (
          <div
            className={classes.imageContainer}
            onClick={() => setIsZoomed(!isZoomed)}
            style={{
              cursor: isZoomed ? "zoom-out" : "zoom-in",
            }}
          >
            <img
              src={mediaUrl}
              alt={fileName}
              className={classes.imageViewer}
              style={{
                transform: isZoomed ? "scale(1.8)" : "scale(1)",
                transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                transformOrigin: "center center",
              }}
            />
          </div>
        )}

        {isPdf && (
          <iframe
            id="pdf-preview-frame"
            src={`${mediaUrl}#toolbar=1&navpanes=0`}
            title={fileName}
            className={classes.pdfIframe}
          />
        )}

        {isVideo && (
          <video
            src={mediaUrl}
            controls
            autoPlay
            className={classes.videoViewer}
          />
        )}

        {isAudio && (
          <div style={{ padding: 32, width: "100%", maxWidth: 400 }}>
            <audio controls autoPlay style={{ width: "100%" }}>
              <source src={mediaUrl} />
              Seu navegador não suporta áudio.
            </audio>
          </div>
        )}

        {!isImage && !isPdf && !isVideo && !isAudio && (
          <div className={classes.fileFallback}>
            <DescriptionIcon style={{ fontSize: 64, color: "#94a3b8" }} />
            <Typography variant="body1">
              Visualização integrada não disponível para este tipo de formato.
            </Typography>
            <IconButton
              onClick={handleDownload}
              style={{
                backgroundColor: "#0284c7",
                color: "#ffffff",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: "0.9rem"
              }}
            >
              <GetAppIcon style={{ marginRight: 8 }} /> Baixar {fileName}
            </IconButton>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MediaViewerModal;
