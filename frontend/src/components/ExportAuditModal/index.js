import React, { useState } from "react";
import clsx from "clsx";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ButtonBase,
  Typography,
  CircularProgress,
  makeStyles,
  useTheme,
} from "@material-ui/core";
import { alpha } from "@material-ui/core/styles";
import DescriptionOutlinedIcon from "@material-ui/icons/DescriptionOutlined";
import GetAppOutlinedIcon from "@material-ui/icons/GetAppOutlined";
import TableChartOutlinedIcon from "@material-ui/icons/TableChartOutlined";
import CodeOutlinedIcon from "@material-ui/icons/CodeOutlined";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import SmartphoneIcon from "@material-ui/icons/Smartphone";
import PersonOutlineIcon from "@material-ui/icons/PersonOutline";
import BlockIcon from "@material-ui/icons/Block";
import GavelIcon from "@material-ui/icons/Gavel";
import api from "../../services/api";
import { toast } from "react-toastify";

const FORMAT_OPTIONS = [
  {
    value: "csv",
    title: "Planilha (.CSV / Excel)",
    description: "Auditoria em massa, planilhas e cruzamento de dados.",
    Icon: TableChartOutlinedIcon,
    tone: "info",
    badge: "Mais usado",
  },
  {
    value: "txt",
    title: "Laudo pericial (.TXT)",
    description: "Cabeçalho pericial com timestamps exatos, remetentes e marcações de auditoria.",
    Icon: DescriptionOutlinedIcon,
    tone: "success",
    badge: "Jurídico",
  },
  {
    value: "json",
    title: "Dados estruturados (.JSON)",
    description: "Payload completo com metadados técnicos de mensagens e mídias.",
    Icon: CodeOutlinedIcon,
    tone: "secondary",
  },
];

const useStyles = makeStyles((theme) => {
  const c = theme.custom;
  const isDark = theme.palette.type === "dark";
  return {
    dialogTitle: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1.5),
      padding: theme.spacing(2.5, 3, 1.5),
    },
    titleIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      display: "grid",
      placeItems: "center",
      flex: "none",
      color: theme.palette.primary.main,
      backgroundColor: c.primarySoft,
      "& svg": { fontSize: 22 },
    },
    title: { fontWeight: 750, fontSize: "1.08rem", letterSpacing: "-0.01em", lineHeight: 1.25 },
    subtitle: { color: c.textMuted, fontSize: "0.78rem" },
    content: {
      padding: theme.spacing(1, 3, 2.5),
    },
    summaryBox: {
      backgroundColor: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      padding: theme.spacing(1.5, 2),
      marginBottom: theme.spacing(2.5),
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    summaryRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: "0.84rem",
      color: c.textMuted,
      "& svg": { fontSize: 17, color: c.textSubtle },
    },
    summaryValue: { color: theme.palette.text.primary, fontWeight: 650 },
    warn: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      marginTop: 2,
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: "0.74rem",
      fontWeight: 650,
      color: theme.palette.error.main,
      backgroundColor: alpha(theme.palette.error.main, isDark ? 0.16 : 0.1),
      "& svg": { fontSize: 14 },
    },
    legend: {
      fontSize: "0.72rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: `${c.textSubtle} !important`,
      marginBottom: theme.spacing(1.25),
    },
    formatGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: theme.spacing(1.5),
      [theme.breakpoints.down("xs")]: { gridTemplateColumns: "1fr" },
    },
    formatCard: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      textAlign: "left",
      gap: 6,
      padding: theme.spacing(1.75),
      borderRadius: 14,
      border: `1px solid ${c.border}`,
      backgroundColor: c.surface,
      transition: "border-color .15s, background-color .15s, box-shadow .15s",
      "&:hover": { borderColor: c.borderStrong, backgroundColor: c.surfaceHover },
      "&.Mui-focusVisible": { boxShadow: `0 0 0 3px ${c.primarySoft}` },
    },
    formatCardSelected: {
      borderColor: `${theme.palette.primary.main} !important`,
      backgroundColor: `${c.primarySoft} !important`,
      boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
    },
    formatIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: "grid",
      placeItems: "center",
      marginBottom: 4,
      "& svg": { fontSize: 20 },
    },
    formatTitle: { fontWeight: 700, fontSize: "0.86rem", lineHeight: 1.3 },
    formatDesc: { fontSize: "0.74rem", color: c.textMuted, lineHeight: 1.4 },
    check: {
      position: "absolute",
      top: 10,
      right: 10,
      fontSize: 20,
      color: theme.palette.primary.main,
    },
    badgePill: {
      position: "absolute",
      top: 12,
      right: 12,
      fontSize: "0.66rem",
      fontWeight: 700,
      padding: "1px 8px",
      borderRadius: 999,
    },
    actions: {
      padding: theme.spacing(1.5, 3, 2.5),
      borderTop: `1px solid ${c.border}`,
    },
  };
});

const toneStyle = (theme, tone) => {
  const col = theme.palette[tone].main;
  return { color: col, backgroundColor: alpha(col, theme.palette.type === "dark" ? 0.16 : 0.1) };
};

const ExportAuditModal = ({
  open,
  onClose,
  selectedDevice,
  selectedChat,
  searchFilter,
  startDate,
  endDate,
  onlyDeleted,
  mediaType,
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const [format, setFormat] = useState("csv");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = {
        whatsappId: selectedDevice?.id,
        ticketId: selectedChat?.ticketId,
        search: searchFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        onlyDeleted: onlyDeleted || undefined,
        mediaType: mediaType !== "all" ? mediaType : undefined,
        format,
      };

      const response = await api.get("/audit/export", {
        params,
        responseType: "blob",
      });

      // Se for formato TXT ou CSV ou JSON
      const blob = new Blob([response.data], {
        type:
          format === "csv"
            ? "text/csv;charset=utf-8;"
            : format === "json"
            ? "application/json"
            : "text/plain;charset=utf-8;",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Extrair nome do arquivo do header ou gerar padrão
      const contentDisposition = response.headers["content-disposition"];
      let filename = `laudo-auditoria-${selectedDevice?.name || "whatsapp"}-${Date.now()}.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Laudo de auditoria gerado e baixado com sucesso!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar laudo de auditoria.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintView = () => {
    // Abrir janela de visualização limpa para impressão pericial
    const query = new URLSearchParams({
      whatsappId: selectedDevice?.id || "",
      ticketId: selectedChat?.ticketId || "",
      search: searchFilter || "",
      startDate: startDate || "",
      endDate: endDate || "",
      onlyDeleted: onlyDeleted ? "true" : "",
      mediaType: mediaType || "",
      format: "txt",
    }).toString();

    window.open(`/audit/export?${query}`, "_blank");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle disableTypography className={classes.dialogTitle}>
        <div className={classes.titleIcon}>
          <GavelIcon />
        </div>
        <div>
          <Typography className={classes.title}>Exportar laudo de auditoria</Typography>
          <Typography className={classes.subtitle}>
            Cofre WhatsApp · conformidade jurídica & compliance
          </Typography>
        </div>
      </DialogTitle>

      <DialogContent className={classes.content}>
        <div className={classes.summaryBox}>
          <div className={classes.summaryRow}>
            <SmartphoneIcon />
            <span>Aparelho:</span>
            <span className={classes.summaryValue}>{selectedDevice?.name || "Todos os Aparelhos"}</span>
          </div>
          {selectedChat && (
            <div className={classes.summaryRow}>
              <PersonOutlineIcon />
              <span>Conversa:</span>
              <span className={classes.summaryValue}>
                {selectedChat.contact?.name || "Sem Nome"} ({selectedChat.contact?.number})
              </span>
            </div>
          )}
          {onlyDeleted && (
            <span className={classes.warn}>
              <BlockIcon />
              Filtro ativo: apenas mensagens apagadas no WhatsApp (anti-delete)
            </span>
          )}
        </div>

        <Typography component="div" className={classes.legend} id="export-format-label">
          Formato do laudo
        </Typography>
        <div className={classes.formatGrid} role="radiogroup" aria-labelledby="export-format-label">
          {FORMAT_OPTIONS.map(({ value, title, description, Icon, tone, badge }) => {
            const selected = format === value;
            return (
              <ButtonBase
                key={value}
                role="radio"
                aria-checked={selected}
                className={clsx(classes.formatCard, selected && classes.formatCardSelected)}
                onClick={() => setFormat(value)}
              >
                <div className={classes.formatIcon} style={toneStyle(theme, tone)}>
                  <Icon />
                </div>
                {selected ? (
                  <CheckCircleIcon className={classes.check} />
                ) : (
                  badge && (
                    <span className={classes.badgePill} style={toneStyle(theme, tone)}>
                      {badge}
                    </span>
                  )
                )}
                <span className={classes.formatTitle}>{title}</span>
                <span className={classes.formatDesc}>{description}</span>
              </ButtonBase>
            );
          })}
        </div>
      </DialogContent>

      <DialogActions className={classes.actions}>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleExport}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <GetAppOutlinedIcon />}
        >
          {loading ? "Gerando laudo..." : "Baixar laudo"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportAuditModal;
