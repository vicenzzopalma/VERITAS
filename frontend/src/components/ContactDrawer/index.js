import React, { useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import Drawer from "@material-ui/core/Drawer";
import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";
import Tooltip from "@material-ui/core/Tooltip";
import Divider from "@material-ui/core/Divider";

import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import FileCopyIcon from "@material-ui/icons/FileCopy";
import CheckIcon from "@material-ui/icons/Check";
import EditIcon from "@material-ui/icons/Edit";
import FingerprintIcon from "@material-ui/icons/Fingerprint";
import SmartphoneIcon from "@material-ui/icons/Smartphone";
import EmailIcon from "@material-ui/icons/Email";
import ZoomInIcon from "@material-ui/icons/ZoomIn";

import { i18n } from "../../translate/i18n";
import ContactModal from "../ContactModal";
import ContactDrawerSkeleton from "../ContactDrawerSkeleton";
import MarkdownWrapper from "../MarkdownWrapper";
import MediaViewerModal from "../MediaViewerModal";
import { formatPhoneNumber } from "../../helpers/contactHelper";
import clsx from "clsx";

const drawerWidth = 360;

const useStyles = makeStyles(theme => ({
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
    zIndex: 7,
  },
  drawerClosed: {
    display: "none !important",
    width: "0px !important",
    pointerEvents: "none !important",
  },
  drawerPaper: {
    width: drawerWidth,
    display: "flex",
    flexDirection: "column",
    backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#f8fafc",
    borderLeft: `1px solid ${theme.palette.type === "dark" ? "rgba(148, 163, 184, 0.18)" : "#e2e8f0"}`,
    boxShadow: theme.palette.type === "dark" ? "-8px 0 24px rgba(0, 0, 0, 0.28)" : "-4px 0 16px rgba(0, 0, 0, 0.04)",
  },
  header: {
    display: "flex",
    backgroundColor: "#52658C",
    color: "#ffffff",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1.5, 2),
    minHeight: 56,
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: "0.95rem",
    letterSpacing: "0.3px",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    height: "100%",
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  profileCard: {
    padding: theme.spacing(2.5, 2),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    backgroundColor: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
  },
  avatarWrapper: {
    position: "relative",
    display: "inline-flex",
    borderRadius: "50%",
    marginBottom: theme.spacing(1.5),
    transition: "transform 0.2s ease",
    "&:hover": {
      transform: "scale(1.03)",
    },
  },
  avatar: {
    width: 94,
    height: 94,
    border: "3px solid #52658C",
    boxShadow: "0 4px 10px rgba(82, 101, 140, 0.2)",
    fontSize: "2.1rem",
    fontWeight: 700,
    backgroundColor: "#52658C",
    transition: "all 0.2s ease",
  },
  avatarClickable: {
    cursor: "pointer",
    "&:hover": {
      boxShadow: "0 6px 18px rgba(2, 132, 199, 0.35)",
      borderColor: "#0284c7",
    },
  },
  avatarHoverOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
    cursor: "pointer",
    transition: "opacity 0.2s ease",
    "&:hover": {
      opacity: 1,
    },
  },
  contactName: {
    fontWeight: 800,
    fontSize: "1.15rem",
    color: theme.palette.type === "dark" ? "#f8fafc" : "#0f172a",
    marginBottom: 4,
    lineHeight: 1.3,
  },
  phoneCard: {
    width: "100%",
    marginTop: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    backgroundColor: theme.palette.type === "dark" ? "#1e293b" : "#f1f5f9",
    borderRadius: 8,
    border: `1px solid ${theme.palette.type === "dark" ? "rgba(148, 163, 184, 0.2)" : "#e2e8f0"}`,
  },
  phoneLabel: {
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    letterSpacing: "0.5px",
    marginBottom: 2,
  },
  phoneNumberText: {
    fontSize: "1.05rem",
    fontWeight: 800,
    color: theme.palette.type === "dark" ? "#e2e8f0" : "#1e293b",
    letterSpacing: "0.5px",
    fontFamily: "'Inter', monospace",
  },
  actionsRow: {
    display: "flex",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
    width: "100%",
  },
  actionButton: {
    flexGrow: 1,
    borderRadius: 8,
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.8rem",
    padding: "6px 10px",
  },
  infoSection: {
    padding: theme.spacing(2),
    borderRadius: 12,
    border: `1px solid ${theme.palette.type === "dark" ? "rgba(148, 163, 184, 0.2)" : "#e2e8f0"}`,
    backgroundColor: theme.palette.type === "dark" ? "#111827" : "#ffffff",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    fontWeight: 700,
    fontSize: "0.85rem",
    color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    paddingBottom: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.palette.type === "dark" ? "rgba(148, 163, 184, 0.16)" : "#f1f5f9"}`,
  },
  metaItem: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  metaLabel: {
    fontSize: "0.72rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    fontWeight: 600,
  },
  metaValue: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#e2e8f0" : "#1e293b",
    wordBreak: "break-all",
  },
  extraInfoBox: {
    padding: theme.spacing(1),
    borderRadius: 6,
    backgroundColor: theme.palette.type === "dark" ? "#172033" : "#f8fafc",
    border: `1px solid ${theme.palette.type === "dark" ? "rgba(148, 163, 184, 0.14)" : "#f1f5f9"}`,
  },
}));

const ContactDrawer = ({
  open,
  handleDrawerClose,
  contact,
  loading,
  deviceName,
  containerId = "drawer-container"
}) => {
  const classes = useStyles();
  const [modalOpen, setModalOpen] = useState(false);
  const [profilePicModalOpen, setProfilePicModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLid, setCopiedLid] = useState(false);

  if (!contact && !loading) return null;

  const rawNumber = String(contact?.number || "").trim();
  const cleanNumber = rawNumber.replace(/\D/g, "");
  const formattedPhone = formatPhoneNumber(rawNumber);

  const cleanLid = contact?.lid
    ? contact.lid.split("@")[0].replace(/\D/g, "")
    : rawNumber.length >= 14
    ? rawNumber
    : "";

  const handleCopyPhone = () => {
    if (formattedPhone) {
      navigator.clipboard.writeText(cleanNumber || formattedPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLid = () => {
    if (cleanLid) {
      navigator.clipboard.writeText(cleanLid);
      setCopiedLid(true);
      setTimeout(() => setCopiedLid(false), 2000);
    }
  };

  const handleOpenWhatsApp = () => {
    if (cleanNumber) {
      window.open(`https://wa.me/${cleanNumber}`, "_blank");
    }
  };

  const containerElem = typeof document !== "undefined" ? document.getElementById(containerId) : null;

  if (!open) return null;

  return (
    <Drawer
      className={clsx(classes.drawer, {
        [classes.drawerClosed]: !open,
      })}
      variant="persistent"
      anchor="right"
      open={open}
      PaperProps={{ style: { position: "absolute" } }}
      BackdropProps={{ style: { position: "absolute" } }}
      ModalProps={{
        container: containerElem,
        style: { position: "absolute" },
      }}
      classes={{
        paper: classes.drawerPaper,
      }}
    >
      {/* 1. Cabeçalho Superior Estilo Digisac */}
      <div className={classes.header}>
        <Typography className={classes.headerTitle}>
          📋 Detalhes do Contato
        </Typography>
        <IconButton size="small" onClick={handleDrawerClose} style={{ color: "#ffffff" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>

      {loading ? (
        <ContactDrawerSkeleton classes={classes} />
      ) : (
        <div className={classes.content}>
          {/* 2. Card Principal de Identificação */}
          <Paper elevation={0} className={classes.profileCard}>
            <Tooltip
              title={contact?.profilePicUrl ? "Clique para ampliar a foto do perfil" : ""}
              placement="top"
            >
              <div
                className={classes.avatarWrapper}
                onClick={() => {
                  if (contact?.profilePicUrl) {
                    setProfilePicModalOpen(true);
                  }
                }}
              >
                <Avatar
                  alt={contact?.name}
                  src={contact?.profilePicUrl}
                  className={clsx(classes.avatar, {
                    [classes.avatarClickable]: Boolean(contact?.profilePicUrl),
                  })}
                >
                  {(contact?.name || formattedPhone || "C").charAt(0).toUpperCase()}
                </Avatar>
                {contact?.profilePicUrl && (
                  <div className={classes.avatarHoverOverlay}>
                    <ZoomInIcon style={{ color: "#ffffff", fontSize: 32 }} />
                  </div>
                )}
              </div>
            </Tooltip>

            <Typography className={classes.contactName}>
              {contact?.isGroup ? (contact?.name || "Grupo WhatsApp") : (formattedPhone || contact?.name || "Sem Nome")}
            </Typography>

            {contact?.name && contact?.name !== formattedPhone && !contact?.isGroup && (
              <Typography variant="body2" style={{ color: "#64748b", fontWeight: 500, marginBottom: 6 }}>
                Salvo como: <em>{contact.name}</em>
              </Typography>
            )}

            {contact?.isGroup && (
              <Chip
                label="👥 Grupo WhatsApp"
                size="small"
                style={{ backgroundColor: "#e2e8f0", fontWeight: 700, height: 22, fontSize: "0.7rem" }}
              />
            )}

            {/* 3. Destaque Visual do Número de Telefone (Padrão Digisac) */}
            <div className={classes.phoneCard}>
              <div className={classes.phoneLabel}>
                Número de Telefone
              </div>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography className={classes.phoneNumberText}>
                  {formattedPhone || "Não identificado"}
                </Typography>
                <Tooltip title={copied ? "Copiado!" : "Copiar número"}>
                  <IconButton size="small" onClick={handleCopyPhone} style={{ color: copied ? "#10b981" : "#52658C" }}>
                    {copied ? <CheckIcon fontSize="small" /> : <FileCopyIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </Box>
            </div>

            {/* Ações Rápidas do Telefone */}
            <div className={classes.actionsRow}>
              {cleanNumber && (
                <Button
                  variant="contained"
                  style={{ backgroundColor: "#10b981", color: "#fff" }}
                  className={classes.actionButton}
                  startIcon={<WhatsAppIcon />}
                  onClick={handleOpenWhatsApp}
                >
                  WhatsApp
                </Button>
              )}
            </div>
          </Paper>

          {/* 4. Metadados de Auditoria & Conexão */}
          <Paper elevation={0} className={classes.infoSection}>
            <div className={classes.sectionHeader}>
              <SmartphoneIcon fontSize="small" style={{ color: "#52658C" }} />
              Informações do Canal & Auditoria
            </div>

            {deviceName && (
              <div className={classes.metaItem}>
                <span className={classes.metaLabel}>Dispositivo / Smartphone:</span>
                <span className={classes.metaValue}>📱 {deviceName}</span>
              </div>
            )}

            {contact?.email && (
              <div className={classes.metaItem}>
                <span className={classes.metaLabel}>E-mail:</span>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <EmailIcon fontSize="small" style={{ color: "#94a3b8", fontSize: 16 }} />
                  <span className={classes.metaValue}>{contact.email}</span>
                </Box>
              </div>
            )}

            {cleanLid && (
              <div className={classes.metaItem}>
                <span className={classes.metaLabel}>LID WhatsApp (Identificador Interno):</span>
                <Box display="flex" alignItems="center" justifyContent="space-between" mt={0.2}>
                  <Chip
                    size="small"
                    icon={<FingerprintIcon style={{ fontSize: 14, color: "#52658C" }} />}
                    label={cleanLid}
                    style={{ backgroundColor: "#e2e8f0", fontFamily: "monospace", fontSize: "0.72rem", height: 22 }}
                  />
                  <Tooltip title={copiedLid ? "LID Copiado!" : "Copiar LID"}>
                    <IconButton size="small" onClick={handleCopyLid}>
                      {copiedLid ? <CheckIcon style={{ fontSize: 14, color: "#10b981" }} /> : <FileCopyIcon style={{ fontSize: 14 }} />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </div>
            )}

            <Box mt={1}>
              <Button
                fullWidth
                variant="outlined"
                style={{ borderColor: "#cbd5e1", color: "#334155", textTransform: "none", fontWeight: 600 }}
                startIcon={<EditIcon />}
                onClick={() => setModalOpen(true)}
              >
                Editar Informações do Contato
              </Button>
            </Box>
          </Paper>

          {/* 5. Campos Personalizados (ExtraInfo) */}
          {contact?.extraInfo && contact.extraInfo.length > 0 && (
            <Paper elevation={0} className={classes.infoSection}>
              <div className={classes.sectionHeader}>
                Campos Personalizados
              </div>
              {contact.extraInfo.map(info => (
                <div key={info.id} className={classes.extraInfoBox}>
                  <div className={classes.metaLabel}>{info.name}</div>
                  <div className={classes.metaValue}>
                    <MarkdownWrapper>{info.value}</MarkdownWrapper>
                  </div>
                </div>
              ))}
            </Paper>
          )}
        </div>
      )}

      {/* Modal de Edição */}
      <ContactModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        contactId={contact?.id}
      />

      {/* Modal de Foto de Perfil Ampliada Estilo WhatsApp */}
      <MediaViewerModal
        open={profilePicModalOpen}
        onClose={() => setProfilePicModalOpen(false)}
        mediaUrl={contact?.profilePicUrl}
        mediaType="image"
        title={`${contact?.name || formattedPhone || "Contato"} - Foto de Perfil`}
      />
    </Drawer>
  );
};

export default ContactDrawer;
