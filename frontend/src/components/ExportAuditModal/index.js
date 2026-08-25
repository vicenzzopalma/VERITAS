import React, { useState } from "react";
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
} from "@material-ui/core";
import DescriptionOutlinedIcon from "@material-ui/icons/DescriptionOutlined";
import GetAppOutlinedIcon from "@material-ui/icons/GetAppOutlined";
import PrintOutlinedIcon from "@material-ui/icons/PrintOutlined";
import TableChartOutlinedIcon from "@material-ui/icons/TableChartOutlined";
import CodeOutlinedIcon from "@material-ui/icons/CodeOutlined";
import api from "../../services/api";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
  dialogTitle: {
    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
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
    padding: theme.spacing(3),
  },
  formatCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(1.5),
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
    borderColor: "#0284c7",
    backgroundColor: "#f0f9ff",
    boxShadow: "0 0 0 1px #0284c7",
  },
  badgePill: {
    backgroundColor: "#e0f2fe",
    color: "#0369a1",
    fontSize: "0.75rem",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 12,
    marginLeft: "auto",
  },
  summaryBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    border: "1px dashed #cbd5e1",
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle disableTypography className={classes.dialogTitle}>
        <DescriptionOutlinedIcon className={classes.dialogTitleIcon} />
        <div>
          <Typography variant="h6" style={{ fontWeight: 600 }}>
            Exportar Laudo de Auditoria & Conversa
          </Typography>
          <Typography variant="caption" style={{ color: "#94a3b8" }}>
            Cofre Autônomo WhatsApp • Conformidade Jurídica & Compliance
          </Typography>
        </div>
      </DialogTitle>

      <DialogContent className={classes.content}>
        <div className={classes.summaryBox}>
          <Typography variant="body2" style={{ fontWeight: 600, color: "#334155" }}>
            📱 Aparelho:{" "}
            <span style={{ color: "#0284c7" }}>
              {selectedDevice?.name || "Todos os Aparelhos"}
            </span>
          </Typography>
          {selectedChat && (
            <Typography variant="body2" style={{ fontWeight: 600, color: "#334155" }}>
              👤 Conversa:{" "}
              <span style={{ color: "#0f766e" }}>
                {selectedChat.contact?.name || "Sem Nome"} ({selectedChat.contact?.number})
              </span>
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

        <FormControl component="fieldset" style={{ width: "100%" }}>
          <FormLabel component="legend" style={{ marginBottom: 12, fontWeight: 600, color: "#1e293b" }}>
            Selecione o Formato do Laudo / Arquivo:
          </FormLabel>
          <RadioGroup value={format} onChange={(e) => setFormat(e.target.value)}>
            {/* Opção CSV */}
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
                  Ideal para auditoria em massa, planilhas e cruzamento de dados
                </Typography>
              </div>
              <span className={classes.badgePill}>Mais Usado</span>
            </div>

            {/* Opção TXT */}
            <div
              className={`${classes.formatCard} ${format === "txt" ? classes.formatCardSelected : ""}`}
              onClick={() => setFormat("txt")}
            >
              <DescriptionOutlinedIcon style={{ color: "#059669", marginRight: 12 }} />
              <div style={{ flexGrow: 1 }}>
                <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                  Laudo Pericial em Texto (.TXT)
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Cabeçalho pericial com timestamps exatos, remetentes e badges de auditoria
                </Typography>
              </div>
              <span className={classes.badgePill} style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>
                Jurídico
              </span>
            </div>

            {/* Opção JSON */}
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
                  Payload completo com metadados técnicos de mensagens e mídias
                </Typography>
              </div>
            </div>
          </RadioGroup>
        </FormControl>
      </DialogContent>

      <Divider />

      <DialogActions style={{ padding: "16px 24px" }}>
        <Button onClick={onClose} disabled={loading} style={{ color: "#64748b" }}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleExport}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <GetAppOutlinedIcon />}
          style={{
            backgroundColor: "#0284c7",
            color: "#fff",
            fontWeight: 600,
            textTransform: "none",
            padding: "8px 20px",
          }}
        >
          {loading ? "Gerando Laudo..." : "Baixar Laudo de Auditoria"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportAuditModal;
