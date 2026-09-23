import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  CircularProgress,
  makeStyles,
  Box,
  Divider,
  TextField,
  Select,
  MenuItem,
  InputLabel,
} from "@material-ui/core";
import DescriptionOutlinedIcon from "@material-ui/icons/DescriptionOutlined";
import GetAppOutlinedIcon from "@material-ui/icons/GetAppOutlined";
import PrintOutlinedIcon from "@material-ui/icons/PrintOutlined";
import TableChartOutlinedIcon from "@material-ui/icons/TableChartOutlined";
import CodeOutlinedIcon from "@material-ui/icons/CodeOutlined";
import PictureAsPdfIcon from "@material-ui/icons/PictureAsPdf";
import PhotoLibraryOutlinedIcon from "@material-ui/icons/PhotoLibraryOutlined";
import api from "../../services/api";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
  dialogTitle: {
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(2, 3),
  },
  dialogTitleIcon: {
    color: "#38bdf8",
    fontSize: 28,
  },
  content: {
    padding: theme.spacing(2.5, 3),
  },
  formatCard: {
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(1.2),
    transition: "all 0.2s ease-in-out",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    "&:hover": {
      borderColor: "#0284c7",
      backgroundColor: "#f0f9ff",
    },
  },
  formatCardSelected: {
    borderColor: "#0284c7 !important",
    backgroundColor: "#f0f9ff !important",
    boxShadow: "0 0 0 1.5px #0284c7",
  },
  badgePill: {
    backgroundColor: "#e0f2fe",
    color: "#0369a1",
    fontSize: "0.75rem",
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 12,
    marginLeft: "auto",
  },
  summaryBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(2),
    border: "1px solid #e2e8f0",
  },
  dateFilterRow: {
    display: "flex",
    gap: theme.spacing(2),
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    [theme.breakpoints.down("xs")]: {
      flexDirection: "column",
    },
  },
  imageLimitSection: {
    backgroundColor: "#f0fdf4",
    border: "1px dashed #86efac",
    borderRadius: 8,
    padding: theme.spacing(1.5, 2),
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  scopeBox: {
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: theme.spacing(1, 1.5),
    marginTop: theme.spacing(1),
  },
}));

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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle disableTypography className={classes.dialogTitle}>
        <DescriptionOutlinedIcon className={classes.dialogTitleIcon} />
        <div>
          <Typography variant="h6" style={{ fontWeight: 700, fontSize: "1.1rem" }}>
            Exportar Laudo de Auditoria & Conversas
          </Typography>
          <Typography variant="caption" style={{ color: "#94a3b8" }}>
            Cofre Forense de WhatsApp • Padrão Digisac & Compliance Corporativo
          </Typography>
        </div>
      </DialogTitle>

      <DialogContent className={classes.content}>
        {/* Resumo da Conversa e Aparelho com Escolha de Escopo */}
        <div className={classes.summaryBox}>
          <Typography variant="body2" style={{ fontWeight: 600, color: "#334155" }}>
            📱 Aparelho:{" "}
            <span style={{ color: "#0284c7" }}>
              {selectedDevice?.name || "Todos os Aparelhos"}
            </span>
          </Typography>

          {selectedChat ? (
            <div className={classes.scopeBox}>
              <Typography variant="caption" style={{ fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                O que você deseja exportar?
              </Typography>
              <RadioGroup
                value={exportScope}
                onChange={(e) => setExportScope(e.target.value)}
              >
                <FormControlLabel
                  value="chat"
                  control={<Radio size="small" color="primary" />}
                  label={
                    <Typography variant="body2" style={{ fontWeight: 600, color: "#0f766e" }}>
                      👤 Apenas a conversa aberta ({selectedChat.contact?.name || "Sem Nome"} • {selectedChat.contact?.number})
                    </Typography>
                  }
                />
                <FormControlLabel
                  value="device"
                  control={<Radio size="small" color="primary" />}
                  label={
                    <Typography variant="body2" style={{ fontWeight: 600, color: "#334155" }}>
                      📱 Todas as conversas de {selectedDevice?.name || "Todo o Aparelho"}
                    </Typography>
                  }
                />
              </RadioGroup>
            </div>
          ) : (
            <Typography variant="body2" style={{ color: "#64748b", marginTop: 4 }}>
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
            <Typography variant="caption" style={{ color: "#0284c7", fontWeight: 600 }}>
              📅 Exportando especificamente o período selecionado acima.
            </Typography>
          )}

          {onlyDeleted && (
            <Typography
              variant="caption"
              style={{ color: "#dc2626", fontWeight: "bold", display: "block", marginTop: 4 }}
            >
              ⚠️ Filtro ativo: Apenas mensagens apagadas no WhatsApp (Anti-Delete)
            </Typography>
          )}
        </div>

        {/* Seleção do Formato */}
        <FormControl component="fieldset" style={{ width: "100%" }}>
          <FormLabel component="legend" style={{ marginBottom: 10, fontWeight: 700, color: "#1e293b", fontSize: "0.85rem" }}>
            Selecione o Formato da Exportação:
          </FormLabel>

          {/* Opção 1: Laudo Visual PDF (Estilo Digisac) */}
          <div
            className={`${classes.formatCard} ${format === "html" ? classes.formatCardSelected : ""}`}
            onClick={() => setFormat("html")}
          >
            <PictureAsPdfIcon style={{ color: "#ef4444", fontSize: 26, marginRight: 12 }} />
            <div style={{ flexGrow: 1 }}>
              <Typography variant="subtitle2" style={{ fontWeight: 700, color: "#0f172a" }}>
                Laudo Visual PDF / Impressão (Estilo Digisac)
              </Typography>
              <Typography variant="caption" color="textSecondary" style={{ lineHeight: 1.2, display: "block" }}>
                Balões de conversa WhatsApp, fotos embutidas em alta definição e paginação pericial A4
              </Typography>
            </div>
            <span className={classes.badgePill} style={{ backgroundColor: "#dcfce7", color: "#15803d" }}>
              Recomendado
            </span>
          </div>

          {/* Configuração de Limite de Imagens (Apenas quando Laudo Visual selecionado) */}
          {format === "html" && (
            <div className={classes.imageLimitSection}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <PhotoLibraryOutlinedIcon style={{ color: "#16a34a", fontSize: 18 }} />
                <Typography variant="caption" style={{ fontWeight: 700, color: "#166534" }}>
                  Limite de Fotos por Laudo (Divisão de Arquivos / Partes):
                </Typography>
              </Box>

              <Box display="flex" gap={1.5} alignItems="center" flexWrap="wrap">
                <FormControl variant="outlined" size="small" style={{ minWidth: 160 }}>
                  <InputLabel id="img-limit-label">Fotos por Laudo</InputLabel>
                  <Select
                    labelId="img-limit-label"
                    value={imageLimit}
                    onChange={(e) => setImageLimit(e.target.value)}
                    label="Fotos por Laudo"
                    style={{ backgroundColor: "#ffffff" }}
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
                    style={{ backgroundColor: "#ffffff" }}
                  >
                    <MenuItem value={1}>Parte 1</MenuItem>
                    <MenuItem value={2}>Parte 2</MenuItem>
                    <MenuItem value={3}>Parte 3</MenuItem>
                    <MenuItem value={4}>Parte 4</MenuItem>
                  </Select>
                </FormControl>

                <Typography variant="caption" style={{ color: "#475569", flex: 1 }}>
                  Evita arquivos gigantescos dividindo a conversa por limite de fotos com alta resolução.
                </Typography>
              </Box>
            </div>
          )}

          {/* Opção 2: CSV */}
          <div
            className={`${classes.formatCard} ${format === "csv" ? classes.formatCardSelected : ""}`}
            onClick={() => setFormat("csv")}
          >
            <TableChartOutlinedIcon style={{ color: "#0284c7", marginRight: 12 }} />
            <div style={{ flexGrow: 1 }}>
              <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                Planilha Tabular (.CSV / Excel)
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Colunas de ID, data/hora, remetente, telefone, status de auditoria e texto
              </Typography>
            </div>
          </div>

          {/* Opção 3: TXT */}
          <div
            className={`${classes.formatCard} ${format === "txt" ? classes.formatCardSelected : ""}`}
            onClick={() => setFormat("txt")}
          >
            <DescriptionOutlinedIcon style={{ color: "#059669", marginRight: 12 }} />
            <div style={{ flexGrow: 1 }}>
              <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                Laudo Forense em Texto (.TXT)
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Registro pericial com carimbos cronológicos e respostas citadas
              </Typography>
            </div>
          </div>

          {/* Opção 4: JSON */}
          <div
            className={`${classes.formatCard} ${format === "json" ? classes.formatCardSelected : ""}`}
            onClick={() => setFormat("json")}
          >
            <CodeOutlinedIcon style={{ color: "#7c3aed", marginRight: 12 }} />
            <div style={{ flexGrow: 1 }}>
              <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                Dados Estruturados (.JSON)
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Payload técnico com metadados de mensagens e referências de mídias
              </Typography>
            </div>
          </div>
        </FormControl>
      </DialogContent>

      <Divider />

      <DialogActions style={{ padding: "14px 24px", justifyContent: "space-between" }}>
        <Button onClick={onClose} disabled={loading} style={{ color: "#64748b" }}>
          Fechar
        </Button>

        <Box display="flex" gap={1}>
          {format === "html" && (
            <Button
              variant="outlined"
              color="primary"
              onClick={handlePrintView}
              disabled={loading}
              startIcon={<PrintOutlinedIcon />}
              style={{
                borderColor: "#0284c7",
                color: "#0284c7",
                fontWeight: 700,
                textTransform: "none",
                borderRadius: 6,
              }}
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
            style={{
              backgroundColor: "#0284c7",
              color: "#fff",
              fontWeight: 700,
              textTransform: "none",
              borderRadius: 6,
            }}
          >
            {loading ? "Exportando..." : format === "html" ? "Baixar Laudo HTML" : "Baixar Arquivo"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default ExportAuditModal;
