import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Tooltip
} from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import clsx from "clsx";
import CloseIcon from "@material-ui/icons/Close";
import GetAppIcon from "@material-ui/icons/GetApp";
import PictureAsPdfIcon from "@material-ui/icons/PictureAsPdf";
import ImageIcon from "@material-ui/icons/Image";
import VideocamIcon from "@material-ui/icons/Videocam";
import DescriptionIcon from "@material-ui/icons/Description";
import PrintIcon from "@material-ui/icons/Print";
import ZoomInIcon from "@material-ui/icons/ZoomIn";
import ZoomOutIcon from "@material-ui/icons/ZoomOut";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";

const useStyles = makeStyles(theme => {
  const c = theme.custom;
  const isDark = theme.palette.type === "dark";
  const tone = col => ({
    color: col,
    backgroundColor: alpha(col, isDark ? 0.16 : 0.1),
  });
  return {
    dialogPaper: {
      backgroundColor: c.surface,
      borderRadius: 16,
      border: `1px solid ${c.border}`,
      overflow: "hidden",
      boxShadow: c.shadowLg,
    },
    dialogTitle: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing(1.5),
      padding: theme.spacing(1.25, 1.5, 1.25, 2),
      backgroundColor: c.surface,
      borderBottom: `1px solid ${c.border}`,
    },
    titleLeft: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
      maxWidth: "calc(100% - 170px)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    fileTitle: {
      fontWeight: 650,
      fontSize: "0.92rem",
      color: theme.palette.text.primary,
    },
    typeIcon: {
      width: 34,
      height: 34,
      flex: "none",
      borderRadius: 10,
      display: "grid",
      placeItems: "center",
      "& svg": { fontSize: 20 },
    },
    tone_pdf: tone(theme.palette.error.main),
    tone_image: tone(theme.palette.info.main),
    tone_video: tone(theme.palette.primary.main),
    tone_file: tone(theme.palette.text.secondary),
    dialogContent: {
      padding: "0 !important",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...c.dotGrid,
      minHeight: 350,
      maxHeight: "84vh",
      overflow: "auto",
      position: "relative",
      ...theme.scrollbarStyles,
    },
    imageContainer: {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing(2),
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
      borderRadius: 10,
      boxShadow: c.shadowLg,
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
      borderRadius: 10,
      backgroundColor: "#000",
    },
    audioWrap: {
      margin: theme.spacing(4),
      padding: theme.spacing(2.5),
      width: "100%",
      maxWidth: 420,
      borderRadius: 16,
      border: `1px solid ${c.border}`,
      backgroundColor: c.surface,
      boxShadow: c.shadow,
    },
    fileFallback: {
      padding: theme.spacing(4),
      textAlign: "center",
      color: theme.palette.text.secondary,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: theme.spacing(2),
    },
    fallbackIcon: {
      width: 72,
      height: 72,
      borderRadius: 20,
      display: "grid",
      placeItems: "center",
      color: c.textSubtle,
      backgroundColor: c.surface,
      border: `1px solid ${c.border}`,
      "& svg": { fontSize: 36 },
    },
    downloadButton: {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      borderRadius: 10,
      padding: "8px 16px",
      fontSize: "0.88rem",
      fontWeight: 600,
      "&:hover": { backgroundColor: theme.palette.primary.dark },
    },
    actionButtons: {
      display: "flex",
      alignItems: "center",
      gap: 2,
    },
    zoomActive: {
      color: theme.palette.primary.main,
      backgroundColor: c.primarySoft,
    },
    actionDivider: {
      width: 1,
      height: 20,
      margin: "0 4px",
      backgroundColor: c.border,
    },
  };
});

const MediaViewerModal = ({ open, onClose, mediaUrl, mediaType, title }) => {
  const classes = useStyles();
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsZoomed(false);
    }
  }, [open, mediaUrl]);

  if (!open || !mediaUrl) return null;

  const urlLower = (mediaUrl || "").toLowerCase();
  const typeLower = (mediaType || "").toLowerCase();
  const titleLower = (title || "").toLowerCase();

  const isImage =
    typeLower.startsWith("image") ||
    urlLower.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) ||
    urlLower.includes("pps.whatsapp.net");

  const isVideo =
    typeLower.startsWith("video") ||
    urlLower.match(/\.(mp4|webm|mkv|mov)($|\?)/i);

  const isAudio =
    typeLower.startsWith("audio") ||
    urlLower.match(/\.(ogg|mp3|wav|m4a|aac)($|\?)/i);

  const isPdf =
    !isImage &&
    !isVideo &&
    !isAudio &&
    (typeLower.includes("pdf") ||
      typeLower.includes("application") ||
      typeLower.includes("document") ||
      urlLower.includes(".pdf") ||
      urlLower.includes("comprovante") ||
      titleLower.includes("comprovante") ||
      titleLower.includes(".pdf"));

  let fileName = title || mediaUrl.split("/").pop() || "Arquivo";
  if (fileName.startsWith(".")) {
    fileName = fileName.replace(/^\.+/, "");
  }

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
    if (isPdf)
      return <span className={clsx(classes.typeIcon, classes.tone_pdf)}><PictureAsPdfIcon /></span>;
    if (isImage)
      return <span className={clsx(classes.typeIcon, classes.tone_image)}><ImageIcon /></span>;
    if (isVideo)
      return <span className={clsx(classes.typeIcon, classes.tone_video)}><VideocamIcon /></span>;
    return <span className={clsx(classes.typeIcon, classes.tone_file)}><DescriptionIcon /></span>;
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
          <Typography variant="subtitle1" className={classes.fileTitle} noWrap>
            {fileName}
          </Typography>
        </div>

        <div className={classes.actionButtons}>
          {isImage && (
            <Tooltip title={isZoomed ? "Reduzir Foto (100%)" : "Ampliar Foto (Zoom)"}>
              <IconButton size="small" onClick={() => setIsZoomed(!isZoomed)} className={clsx({ [classes.zoomActive]: isZoomed })}>
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

          <Tooltip title="Abrir em Nova Aba">
            <IconButton size="small" onClick={() => window.open(mediaUrl, "_blank")}>
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Baixar Arquivo">
            <IconButton size="small" onClick={handleDownload}>
              <GetAppIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <span className={classes.actionDivider} />

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
          <div className={classes.audioWrap}>
            <audio controls autoPlay style={{ width: "100%" }}>
              <source src={mediaUrl} />
              Seu navegador não suporta áudio.
            </audio>
          </div>
        )}

        {!isImage && !isPdf && !isVideo && !isAudio && (
          <div className={classes.fileFallback}>
            <div className={classes.fallbackIcon}>
              <DescriptionIcon />
            </div>
            <Typography variant="body1">
              Visualização integrada não disponível para este tipo de formato.
            </Typography>
            <IconButton onClick={handleDownload} className={classes.downloadButton}>
              <GetAppIcon style={{ marginRight: 8 }} /> Baixar {fileName}
            </IconButton>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MediaViewerModal;
