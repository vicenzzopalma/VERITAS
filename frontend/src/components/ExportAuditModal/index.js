import React, { useState, useEffect } from "react";
import clsx from "clsx";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ButtonBase,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  CircularProgress,
  makeStyles,
  useTheme,
  Box,
  TextField,
  Select,
  MenuItem,
  InputLabel,
} from "@material-ui/core";
import { alpha } from "@material-ui/core/styles";
import DescriptionOutlinedIcon from "@material-ui/icons/DescriptionOutlined";
import GetAppOutlinedIcon from "@material-ui/icons/GetAppOutlined";
import PrintOutlinedIcon from "@material-ui/icons/PrintOutlined";
import TableChartOutlinedIcon from "@material-ui/icons/TableChartOutlined";
import CodeOutlinedIcon from "@material-ui/icons/CodeOutlined";
import PictureAsPdfOutlinedIcon from "@material-ui/icons/PictureAsPdfOutlined";
import PhotoLibraryOutlinedIcon from "@material-ui/icons/PhotoLibraryOutlined";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import SmartphoneIcon from "@material-ui/icons/Smartphone";
import PersonOutlineIcon from "@material-ui/icons/PersonOutline";
import BlockIcon from "@material-ui/icons/Block";
import DateRangeIcon from "@material-ui/icons/DateRange";
import GavelIcon from "@material-ui/icons/Gavel";
import api from "../../services/api";
import { toast } from "react-toastify";

const FORMAT_OPTIONS = [
  {
    value: "html",
    title: "Laudo visual PDF / impressão",
    description: "Balões de conversa WhatsApp, fotos embutidas em alta definição e paginação pericial A4.",
    Icon: PictureAsPdfOutlinedIcon,
    tone: "error",
    badge: "Recomendado",
  },
  {
    value: "csv",
    title: "Planilha (.CSV / Excel)",
    description: "Colunas de ID, data/hora, remetente, telefone, status de auditoria e texto.",
    Icon: TableChartOutlinedIcon,
    tone: "info",
  },
  {
    value: "txt",
    title: "Laudo forense (.TXT)",
    description: "Registro pericial com carimbos cronológicos e respostas citadas.",
    Icon: DescriptionOutlinedIcon,
    tone: "success",
    badge: "Jurídico",
  },
  {
    value: "json",
    title: "Dados estruturados (.JSON)",
    description: "Payload técnico com metadados de mensagens e referências de mídias.",
    Icon: CodeOutlinedIcon,
    tone: "secondary",
  },
];

const useStyles = makeStyles((theme) => {
  const c = theme.custom;
  const isDark = theme.palette.type === "dark";
  const pill = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: "0.74rem",
    fontWeight: 650,
    "& svg": { fontSize: 14 },
  };
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
      [theme.breakpoints.down("xs")]: { padding: theme.spacing(1, 2, 2) },
    },
    summaryBox: {
      backgroundColor: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      padding: theme.spacing(1.5, 2),
      marginBottom: theme.spacing(2.5),
      display: "flex",
      flexDirection: "column",
      gap: 10,
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
    scopeBox: {
      backgroundColor: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      padding: theme.spacing(1, 1.5),
    },
    scopeLabel: {
      fontSize: "0.68rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: c.textSubtle,
      display: "block",
      marginBottom: 2,
    },
    scopeOption: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: "0.84rem",
      fontWeight: 600,
      color: theme.palette.text.primary,
      "& svg": { fontSize: 17, color: c.textMuted },
    },
    muted: { fontSize: "0.8rem", color: c.textMuted },
    dateFilterRow: {
      display: "flex",
      gap: theme.spacing(1.5),
      marginTop: 2,
      "& .MuiOutlinedInput-root": { backgroundColor: c.surface },
      [theme.breakpoints.down("xs")]: { flexDirection: "column" },
    },
    info: {
      ...pill,
      color: theme.palette.primary.main,
      backgroundColor: c.primarySoft,
    },
    warn: {
      ...pill,
      color: theme.palette.error.main,
      backgroundColor: alpha(theme.palette.error.main, isDark ? 0.16 : 0.1),
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
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: theme.spacing(1.5),
      [theme.breakpoints.down("xs")]: { gridTemplateColumns: "1fr" },
    },
    formatCard: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "flex-start",
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
    formatTitle: { fontWeight: 700, fontSize: "0.86rem", lineHeight: 1.3, paddingRight: 64 },
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
    imageLimitSection: {
      gridColumn: "1 / -1",
      backgroundColor: c.surfaceAlt,
      border: `1px dashed ${c.borderStrong}`,
      borderRadius: 12,
      padding: theme.spacing(1.5, 2),
      "& .MuiOutlinedInput-root": { backgroundColor: c.surface },
    },
    imageLimitTitle: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: "0.8rem",
      fontWeight: 700,
      marginBottom: theme.spacing(1.5),
      "& svg": { fontSize: 18, color: theme.palette.success.main },
    },
    actions: {
      padding: theme.spacing(1.5, 3, 2.5),
      borderTop: `1px solid ${c.border}`,
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: theme.spacing(1),
      "& > :not(:first-child)": { marginLeft: 0 },
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
  const [format, setFormat] = useState("html");
  const [exportScope, setExportScope] = useState("chat");
  const [imageLimit, setImageLimit] = useState(50);
  const [part, setPart] = useState(1);
  const [customStartDate, setCustomStartDate] = useState(startDate || "");
  const [customEndDate, setCustomEndDate] = useState(endDate || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomStartDate(startDate || "");
      setCustomEndDate(endDate || "");
      setPart(1);
      setExportScope(selectedChat ? "chat" : "device");
    }
  }, [open, startDate, endDate, selectedChat]);

  const getCleanAuthToken = () => {
    const raw = localStorage.getItem("token");
    if (!raw) return "";
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  const buildQueryParams = (targetFormat, isDownload = false) => {
    const token = getCleanAuthToken();
    const params = new URLSearchParams();

    if (selectedDevice?.id) params.append("whatsappId", String(selectedDevice.id));

    if (exportScope === "chat" && selectedChat) {
      if (selectedChat?.ticketId) params.append("ticketId", String(selectedChat.ticketId));
      if (selectedChat?.contact?.id) params.append("contactId", String(selectedChat.contact.id));
      if (selectedChat?.contact?.number) params.append("contactNumber", String(selectedChat.contact.number));
    }

    if (searchFilter) params.append("search", searchFilter);
    if (customStartDate) params.append("startDate", customStartDate);
    if (customEndDate) params.append("endDate", customEndDate);
    if (onlyDeleted) params.append("onlyDeleted", "true");
    if (mediaType && mediaType !== "all") params.append("mediaType", mediaType);

    params.append("format", targetFormat || format);
    params.append("imageLimit", String(imageLimit));
    params.append("part", String(part));

    if (isDownload) {
      params.append("download", "true");
    }
    if (token) {
      params.append("token", token);
    }

    return params.toString();
  };

  const handlePrintView = () => {
    const queryString = buildQueryParams("html", false);
    const url = `/audit/export?${queryString}`;
    window.open(url, "_blank");
    toast.info("Abrindo laudo visual para impressão / salvar em PDF...");
    onClose();
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const queryString = buildQueryParams(format, true);
      const url = `/audit/export?${queryString}`;

      const response = await api.get(url, {
        responseType: "blob",
      });

      let mimeType = "text/html;charset=utf-8;";
      if (format === "csv") mimeType = "text/csv;charset=utf-8;";
      else if (format === "json") mimeType = "application/json;charset=utf-8;";
      else if (format === "txt") mimeType = "text/plain;charset=utf-8;";

      const blob = new Blob([response.data], { type: mimeType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

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
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Laudo de auditoria baixado com sucesso!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar laudo de auditoria.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle disableTypography className={classes.dialogTitle}>
        <div className={classes.titleIcon}>
          <GavelIcon />
        </div>
        <div>
          <Typography className={classes.title}>Exportar laudo de auditoria & conversas</Typography>
          <Typography className={classes.subtitle}>
            Cofre forense de WhatsApp · padrão Digisac & compliance corporativo
          </Typography>
        </div>
      </DialogTitle>

      <DialogContent className={classes.content}>
        {/* Resumo da Conversa e Aparelho com Escolha de Escopo */}
        <div className={classes.summaryBox}>
          <div className={classes.summaryRow}>
            <SmartphoneIcon />
            <span>Aparelho:</span>
            <span className={classes.summaryValue}>{selectedDevice?.name || "Todos os Aparelhos"}</span>
          </div>

          {selectedChat ? (
            <div className={classes.scopeBox}>
              <span className={classes.scopeLabel}>O que você deseja exportar?</span>
              <RadioGroup value={exportScope} onChange={(e) => setExportScope(e.target.value)}>
                <FormControlLabel
                  value="chat"
                  control={<Radio size="small" color="primary" />}
                  label={
                    <span className={classes.scopeOption}>
                      <PersonOutlineIcon />
                      Apenas a conversa aberta ({selectedChat.contact?.name || "Sem Nome"} • {selectedChat.contact?.number})
                    </span>
                  }
                />
                <FormControlLabel
                  value="device"
                  control={<Radio size="small" color="primary" />}
                  label={
                    <span className={classes.scopeOption}>
                      <SmartphoneIcon />
                      Todas as conversas de {selectedDevice?.name || "Todo o Aparelho"}
                    </span>
                  }
                />
              </RadioGroup>
            </div>
          ) : (
            <Typography className={classes.muted}>
              Nenhuma conversa individual aberta no momento (serão exportadas todas as conversas do aparelho selecionado).
            </Typography>
          )}

          {/* Filtro por Período de Conversa */}
          <div className={classes.dateFilterRow}>
            <TextField
              label="Data Início"
              type="date"
              size="small"
              fullWidth
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              variant="outlined"
            />
            <TextField
              label="Data Fim"
              type="date"
              size="small"
              fullWidth
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              variant="outlined"
            />
          </div>
          {(customStartDate || customEndDate) && (
            <span className={classes.info}>
              <DateRangeIcon />
              Exportando especificamente o período selecionado acima.
            </span>
          )}

          {onlyDeleted && (
            <span className={classes.warn}>
              <BlockIcon />
              Filtro ativo: apenas mensagens apagadas no WhatsApp (anti-delete)
            </span>
          )}
        </div>

        {/* Seleção do Formato */}
        <Typography component="div" className={classes.legend} id="export-format-label">
          Formato da exportação
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

          {/* Configuração de Limite de Imagens (Apenas quando Laudo Visual selecionado) */}
          {format === "html" && (
            <div className={classes.imageLimitSection}>
              <div className={classes.imageLimitTitle}>
                <PhotoLibraryOutlinedIcon />
                Limite de fotos por laudo (divisão de arquivos / partes)
              </div>

              <Box display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 12 }}>
                <FormControl variant="outlined" size="small" style={{ minWidth: 180 }}>
                  <InputLabel id="img-limit-label">Fotos por Laudo</InputLabel>
                  <Select
                    labelId="img-limit-label"
                    value={imageLimit}
                    onChange={(e) => setImageLimit(e.target.value)}
                    label="Fotos por Laudo"
                  >
                    <MenuItem value={25}>25 fotos por laudo</MenuItem>
                    <MenuItem value={50}>50 fotos (Padrão Digisac)</MenuItem>
                    <MenuItem value={100}>100 fotos por laudo</MenuItem>
                    <MenuItem value="all">Todas (Sem divisão)</MenuItem>
                  </Select>
                </FormControl>

                <FormControl variant="outlined" size="small" style={{ minWidth: 120 }}>
                  <InputLabel id="part-select-label">Parte</InputLabel>
                  <Select
                    labelId="part-select-label"
                    value={part}
                    onChange={(e) => setPart(e.target.value)}
                    label="Parte"
                  >
                    <MenuItem value={1}>Parte 1</MenuItem>
                    <MenuItem value={2}>Parte 2</MenuItem>
                    <MenuItem value={3}>Parte 3</MenuItem>
                    <MenuItem value={4}>Parte 4</MenuItem>
                  </Select>
                </FormControl>

                <Typography className={classes.muted} style={{ flex: "1 1 200px", fontSize: "0.76rem" }}>
                  Evita arquivos gigantescos dividindo a conversa por limite de fotos com alta resolução.
                </Typography>
              </Box>
            </div>
          )}
        </div>
      </DialogContent>

      <DialogActions className={classes.actions}>
        <Button onClick={onClose} disabled={loading}>
          Fechar
        </Button>

        <Box display="flex" flexWrap="wrap" style={{ gap: 8 }}>
          {format === "html" && (
            <Button
              variant="outlined"
              color="primary"
              onClick={handlePrintView}
              disabled={loading}
              startIcon={<PrintOutlinedIcon />}
            >
              Visualizar & Salvar em PDF
            </Button>
          )}

          <Button
            variant="contained"
            color="primary"
            onClick={handleExport}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <GetAppOutlinedIcon />}
          >
            {loading ? "Exportando..." : format === "html" ? "Baixar Laudo HTML" : "Baixar Arquivo"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default ExportAuditModal;
