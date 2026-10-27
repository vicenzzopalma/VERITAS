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

const useStyles = makeStyles(theme => {
  const c = theme.custom;
  const success = theme.palette.success.main;
  return {
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
      maxWidth: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: c.surface,
      border: "none",
      borderLeft: `1px solid ${c.border}`,
      boxShadow: c.shadowLg,
      overflow: "hidden",
    },
    header: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1),
      borderBottom: `1px solid ${c.border}`,
      padding: theme.spacing(0, 1.5, 0, 2),
      minHeight: 68,
      flex: "none",
    },
    headerTitle: {
      flex: 1,
      fontWeight: 700,
      fontSize: "0.95rem",
      color: c.text,
    },
    closeButton: {
      width: 34,
      height: 34,
      padding: 0,
    },
    content: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.5),
      padding: theme.spacing(2),
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      backgroundColor: c.surfaceAlt,
      ...theme.scrollbarStyles,
    },

    // Profile card (class names shared with ContactDrawerSkeleton)
    contactHeader: {
      display: "flex",
      padding: theme.spacing(3, 2, 2),
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      gap: 4,
      borderRadius: 14,
      border: `1px solid ${c.border}`,
      background: `linear-gradient(180deg, ${c.primarySoft} 0%, ${c.surface} 75%)`,
    },
    avatarWrapper: {
      position: "relative",
      display: "inline-flex",
      borderRadius: "50%",
      marginBottom: theme.spacing(1),
      transition: "transform .2s ease",
      "&:hover": { transform: "scale(1.03)" },
    },
    contactAvatar: {
      width: 96,
      height: 96,
      fontSize: "2.1rem",
      fontWeight: 700,
      border: `3px solid ${c.surface}`,
      boxShadow: `0 0 0 1px ${c.border}, ${c.shadow}`,
      transition: "box-shadow .2s ease",
    },
    avatarClickable: {
      cursor: "pointer",
      "&:hover": {
        boxShadow: `0 0 0 2px ${c.primary}, ${c.shadowLg}`,
      },
    },
    avatarHoverOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      backgroundColor: "rgba(15, 18, 34, 0.45)",
      color: "#FFFFFF",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: 0,
      cursor: "pointer",
      transition: "opacity .2s ease",
      "&:hover": { opacity: 1 },
    },
    contactName: {
      fontWeight: 700,
      fontSize: "1.05rem",
      color: c.text,
      lineHeight: 1.3,
      wordBreak: "break-word",
    },
    savedAs: {
      color: c.textMuted,
      fontWeight: 500,
      fontSize: "0.82rem",
      marginBottom: 4,
    },
    groupChip: {
      height: 22,
      fontSize: "0.7rem",
      color: c.primary,
      backgroundColor: c.primarySoft,
    },
    phoneCard: {
      width: "100%",
      marginTop: theme.spacing(1.5),
      padding: theme.spacing(1.25, 1.5),
      backgroundColor: c.surface,
      borderRadius: 12,
      border: `1px solid ${c.border}`,
      textAlign: "left",
    },
    phoneLabel: {
      fontSize: "0.68rem",
      fontWeight: 700,
      textTransform: "uppercase",
      color: c.textSubtle,
      letterSpacing: "0.08em",
      marginBottom: 2,
    },
    phoneNumberText: {
      fontSize: "1.02rem",
      fontWeight: 700,
      color: c.text,
      letterSpacing: "0.02em",
      fontVariantNumeric: "tabular-nums",
    },
    copyButton: {
      color: c.textMuted,
    },
    copiedIcon: {
      color: success,
    },
    actionsRow: {
      display: "flex",
      gap: theme.spacing(1),
      marginTop: theme.spacing(1.5),
      width: "100%",
      "&:empty": { display: "none" },
    },
    actionButton: {
      flexGrow: 1,
      fontSize: "0.82rem",
    },
    whatsappButton: {
      border: "none",
      backgroundColor: success,
      color: "#FFFFFF",
      "&:hover": { backgroundColor: success, filter: "brightness(0.95)" },
    },

    // Info sections (class names shared with ContactDrawerSkeleton)
    contactDetails: {
      padding: theme.spacing(1.5),
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.25),
      borderRadius: 14,
      border: `1px solid ${c.border}`,
      backgroundColor: c.surface,
    },
    sectionTitle: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1),
      fontSize: "0.7rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: c.textSubtle,
      padding: theme.spacing(0, 0.5),
    },
    sectionIcon: {
      fontSize: 16,
      color: c.primary,
    },
    metaItem: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
      padding: theme.spacing(0, 0.5),
    },
    metaLabel: {
      fontSize: "0.72rem",
      color: c.textMuted,
      fontWeight: 600,
    },
    metaValue: {
      fontSize: "0.86rem",
      fontWeight: 600,
      color: c.text,
      wordBreak: "break-all",
    },
    metaIcon: {
      fontSize: 16,
      color: c.textSubtle,
    },
    lidChip: {
      height: 22,
      fontFamily: "monospace",
      fontSize: "0.72rem",
      fontWeight: 600,
      color: c.textMuted,
      backgroundColor: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      "& svg": { fontSize: 14, color: c.primary },
    },
    smallIcon: {
      fontSize: 14,
    },
    contactExtraInfo: {
      padding: theme.spacing(1, 1.25),
      borderRadius: 10,
      backgroundColor: c.surfaceAlt,
      border: `1px solid ${c.border}`,
    },
  };
});

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
      {/* 1. Cabeçalho */}
      <div className={classes.header}>
        <Typography className={classes.headerTitle}>
          Detalhes do Contato
        </Typography>
        <IconButton size="small" className={classes.closeButton} onClick={handleDrawerClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>

      {loading ? (
        <ContactDrawerSkeleton classes={classes} />
      ) : (
        <div className={classes.content}>
          {/* 2. Card Principal de Identificação */}
          <Paper elevation={0} className={classes.contactHeader}>
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
                  className={clsx(classes.contactAvatar, {
                    [classes.avatarClickable]: Boolean(contact?.profilePicUrl),
                  })}
                >
                  {(contact?.name || formattedPhone || "C").charAt(0).toUpperCase()}
                </Avatar>
                {contact?.profilePicUrl && (
                  <div className={classes.avatarHoverOverlay}>
                    <ZoomInIcon style={{ fontSize: 32 }} />
                  </div>
                )}
              </div>
            </Tooltip>

            <Typography className={classes.contactName}>
              {contact?.isGroup ? (contact?.name || "Grupo WhatsApp") : (formattedPhone || contact?.name || "Sem Nome")}
            </Typography>

            {contact?.name && contact?.name !== formattedPhone && !contact?.isGroup && (
              <Typography variant="body2" className={classes.savedAs}>
                Salvo como: <em>{contact.name}</em>
              </Typography>
            )}

            {contact?.isGroup && (
              <Chip
                label="👥 Grupo WhatsApp"
                size="small"
                className={classes.groupChip}
              />
            )}

            {/* 3. Destaque Visual do Número de Telefone */}
            <div className={classes.phoneCard}>
              <div className={classes.phoneLabel}>
                Número de Telefone
              </div>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography className={classes.phoneNumberText}>
                  {formattedPhone || "Não identificado"}
                </Typography>
                <Tooltip title={copied ? "Copiado!" : "Copiar número"}>
                  <IconButton size="small" onClick={handleCopyPhone} className={copied ? classes.copiedIcon : classes.copyButton}>
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
                  className={clsx(classes.actionButton, classes.whatsappButton)}
                  startIcon={<WhatsAppIcon />}
                  onClick={handleOpenWhatsApp}
                >
                  WhatsApp
                </Button>
              )}
            </div>
          </Paper>

          {/* 4. Metadados de Auditoria & Conexão */}
          <Paper elevation={0} className={classes.contactDetails}>
            <div className={classes.sectionTitle}>
              <SmartphoneIcon className={classes.sectionIcon} />
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
                  <EmailIcon className={classes.metaIcon} />
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
                    icon={<FingerprintIcon />}
                    label={cleanLid}
                    className={classes.lidChip}
                  />
                  <Tooltip title={copiedLid ? "LID Copiado!" : "Copiar LID"}>
                    <IconButton size="small" onClick={handleCopyLid}>
                      {copiedLid ? <CheckIcon className={clsx(classes.smallIcon, classes.copiedIcon)} /> : <FileCopyIcon className={classes.smallIcon} />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </div>
            )}

            <Box mt={1}>
              <Button
                fullWidth
                variant="outlined"
                color="primary"
                startIcon={<EditIcon fontSize="small" />}
                onClick={() => setModalOpen(true)}
              >
                Editar Informações do Contato
              </Button>
            </Box>
          </Paper>

          {/* 5. Campos Personalizados (ExtraInfo) */}
          {contact?.extraInfo && contact.extraInfo.length > 0 && (
            <Paper elevation={0} className={classes.contactDetails}>
              <div className={classes.sectionTitle}>
                Campos Personalizados
              </div>
              {contact.extraInfo.map(info => (
                <div key={info.id} className={classes.contactExtraInfo}>
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
