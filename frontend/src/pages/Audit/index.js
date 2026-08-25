import React, { useState, useEffect, useRef } from "react";
import {
  makeStyles,
  Paper,
  Typography,
  Grid,
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Avatar,
  Divider,
  CircularProgress,
  Button,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Badge,
  Card,
  CardActionArea,
  CardContent,
} from "@material-ui/core";
import {
  Search as SearchIcon,
  Security as SecurityIcon,
  GetApp as GetAppIcon,
  Block as BlockIcon,
  Audiotrack as AudioIcon,
  Image as ImageIcon,
  Description as DocumentIcon,
  Videocam as VideoIcon,
  Clear as ClearIcon,
  CheckCircle as OnlineIcon,
  RadioButtonUnchecked as OfflineIcon,
  Phone as PhoneIcon,
  Done as DoneIcon,
  DoneAll as DoneAllIcon,
  DateRange as DateRangeIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
} from "@material-ui/icons";
import { format, parseISO } from "date-fns";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ExportAuditModal from "../../components/ExportAuditModal";
import { getContactDisplayName, formatPhoneNumber } from "../../helpers/contactHelper";
import whatsBackground from "../../assets/wa-background.png";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 64px)",
    backgroundColor: "#f1f5f9",
    overflow: "hidden",
  },
  headerBar: {
    background: "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)",
    color: "#ffffff",
    padding: theme.spacing(1.5, 2.5),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    zIndex: 10,
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    fontWeight: 700,
    fontSize: "1.25rem",
    letterSpacing: "-0.02em",
  },
  headerIcon: {
    color: "#38bdf8",
    fontSize: 28,
  },
  headerStats: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
  },
  statBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    padding: "4px 12px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: "0.85rem",
  },
  deviceRibbon: {
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    padding: theme.spacing(1, 2),
    display: "flex",
    gap: theme.spacing(1.5),
    overflowX: "auto",
    whiteSpace: "nowrap",
    "&::-webkit-scrollbar": {
      height: 6,
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "#cbd5e1",
      borderRadius: 4,
    },
  },
  deviceCard: {
    minWidth: 175,
    maxWidth: 220,
    flexShrink: 0,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    transition: "all 0.2s ease-in-out",
    cursor: "pointer",
    backgroundColor: "#ffffff",
    "&:hover": {
      borderColor: "#0284c7",
      boxShadow: "0 2px 6px rgba(2, 132, 199, 0.15)",
    },
  },
  deviceCardSelected: {
    borderColor: "#0284c7 !important",
    backgroundColor: "#f0f9ff !important",
    boxShadow: "0 0 0 2px #0284c7 !important",
  },
  deviceCardContent: {
    padding: "8px 12px !important",
  },
  mainContent: {
    display: "flex",
    flexGrow: 1,
    height: "calc(100% - 130px)",
    overflow: "hidden",
  },
  // Painel Esquerdo: Lista de Conversas
  chatsPanel: {
    width: 360,
    minWidth: 320,
    borderRight: "1px solid #e2e8f0",
    backgroundColor: "#ffffff",
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  chatSearchBox: {
    padding: theme.spacing(1.5),
    borderBottom: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
  },
  chatsList: {
    flexGrow: 1,
    overflowY: "auto",
    "&::-webkit-scrollbar": {
      width: 6,
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "#cbd5e1",
      borderRadius: 4,
    },
  },
  chatItem: {
    padding: theme.spacing(1.5, 2),
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    cursor: "pointer",
    transition: "background 0.15s ease",
    "&:hover": {
      backgroundColor: "#f8fafc",
    },
  },
  chatItemSelected: {
    backgroundColor: "#e0f2fe !important",
    borderLeft: "4px solid #0284c7",
  },
  chatAvatar: {
    backgroundColor: "#0284c7",
    width: 44,
    height: 44,
    fontWeight: 600,
  },
  chatInfo: {
    flexGrow: 1,
    overflow: "hidden",
  },
  chatName: {
    fontWeight: 600,
    fontSize: "0.92rem",
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  chatLastMsg: {
    fontSize: "0.8rem",
    color: "#64748b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginTop: 2,
  },
  chatDate: {
    fontSize: "0.72rem",
    color: "#94a3b8",
    whiteSpace: "nowrap",
  },
  // Painel Direito: Timeline de Mensagens & Filtros
  timelinePanel: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "#efeae2",
    backgroundImage: `url(${whatsBackground})`,
    backgroundRepeat: "repeat",
    overflow: "hidden",
  },
  filterToolbar: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(8px)",
    padding: theme.spacing(1, 2),
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    zIndex: 5,
  },
  filterItem: {
    minWidth: 140,
  },
  deletedSwitch: {
    color: "#dc2626 !important",
    "&.Mui-checked": {
      color: "#dc2626 !important",
    },
    "&.Mui-checked + .MuiSwitch-track": {
      backgroundColor: "#ef4444 !important",
    },
  },
  messagesScrollArea: {
    flexGrow: 1,
    padding: theme.spacing(2.5, 3),
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.2),
    "&::-webkit-scrollbar": {
      width: 8,
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "rgba(0,0,0,0.2)",
      borderRadius: 4,
    },
  },
  messageBubble: {
    maxWidth: "68%",
    minWidth: 160,
    padding: "8px 12px 6px 12px",
    borderRadius: 8,
    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
    position: "relative",
    wordBreak: "break-word",
    fontSize: "0.9rem",
  },
  messageOperator: {
    alignSelf: "flex-end",
    backgroundColor: "#dcf8c6",
    color: "#111827",
    borderTopRightRadius: 0,
  },
  messageClient: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    color: "#111827",
    borderTopLeftRadius: 0,
  },
  deletedBanner: {
    backgroundColor: "#fef2f2",
    border: "1px solid #f87171",
    color: "#b91c1c",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: "0.76rem",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  quotedMsgBox: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderLeft: "3px solid #0284c7",
    borderRadius: 4,
    padding: "4px 8px",
    marginBottom: 6,
    fontSize: "0.8rem",
    color: "#475569",
  },
  mediaPreview: {
    maxWidth: "100%",
    maxHeight: 280,
    borderRadius: 6,
    cursor: "pointer",
    marginTop: 4,
    marginBottom: 4,
    objectFit: "cover",
  },
  metaFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
    fontSize: "0.72rem",
    color: "#64748b",
  },
  noChatSelected: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    gap: theme.spacing(1.5),
  },
}));

const Audit = () => {
  const classes = useStyles();

  // Helpers de Formatação e Cores de Grupo
  const getParticipantColor = (name = "") => {
    const colors = [
      "#0284c7", // Azul
      "#7c3aed", // Roxo
      "#d97706", // Âmbar
      "#059669", // Esmeralda
      "#db2777", // Rosa
      "#ea580c", // Laranja
      "#0891b2", // Ciano
      "#4f46e5", // Indigo
      "#be185d", // Magenta
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Estados principais
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Filtros
  const [chatSearch, setChatSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [onlyDeleted, setOnlyDeleted] = useState(false);
  const [mediaType, setMediaType] = useState("all");

  // Modal Exportação
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const messagesEndRef = useRef(null);

  // 1. Carregar lista dos 20 smartphones
  const fetchDevices = async () => {
    setLoadingDevices(true);
    try {
      const { data } = await api.get("/audit/devices");
      setDevices(data);
      if (data.length > 0 && !selectedDevice) {
        setSelectedDevice(data[0]);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  // 2. Carregar conversas do aparelho selecionado
  const fetchChats = async () => {
    if (!selectedDevice) return;
    setLoadingChats(true);
    try {
      const { data } = await api.get(`/audit/devices/${selectedDevice.id}/chats`, {
        params: { search: chatSearch },
      });
      setChats(data.chats || []);
      if (data.chats?.length > 0) {
        setSelectedChat(data.chats[0]);
      } else {
        setSelectedChat(null);
        setMessages([]);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, [selectedDevice, chatSearch]);

  // 3. Carregar mensagens da conversa ou filtros
  const fetchMessages = async () => {
    if (!selectedDevice) return;
    setLoadingMessages(true);
    try {
      const params = {
        whatsappId: selectedDevice.id,
        ticketId: selectedChat?.ticketId,
        search: searchTerm || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        onlyDeleted: onlyDeleted || undefined,
        mediaType: mediaType !== "all" ? mediaType : undefined,
        limit: 100,
      };

      const { data } = await api.get("/audit/messages", { params });
      setMessages(data.messages || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (selectedDevice) {
      fetchMessages();
    }
  }, [selectedDevice, selectedChat, searchTerm, startDate, endDate, onlyDeleted, mediaType]);

  // Auto-scroll ao carregar mensagens
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setOnlyDeleted(false);
    setMediaType("all");
  };

  // Totais agregados
  const totalArchived = devices.reduce((acc, d) => acc + (d.totalMessages || 0), 0);
  const totalDeletedCount = devices.reduce((acc, d) => acc + (d.deletedMessages || 0), 0);
  const totalMediaCount = devices.reduce((acc, d) => acc + (d.mediaMessages || 0), 0);

  return (
    <div className={classes.root}>
      {/* 1. Header Bar de Auditoria */}
      <div className={classes.headerBar}>
        <div className={classes.headerTitle}>
          <SecurityIcon className={classes.headerIcon} />
          <div>
            <Typography variant="h6" style={{ fontWeight: 700, lineHeight: 1.2 }}>
              Cofre de Auditoria Perpétua & Backup WhatsApp
            </Typography>
            <Typography variant="caption" style={{ color: "#94a3b8" }}>
              Monitoramento Silencioso • Anti-Delete Forense • Preservação Soberana
            </Typography>
          </div>
        </div>

        <div className={classes.headerStats}>
          <div className={classes.statBadge}>
            <Typography variant="caption" style={{ color: "#94a3b8" }}>
              Total de Mensagens:
            </Typography>
            <Typography variant="body2" style={{ fontWeight: 700, color: "#38bdf8" }}>
              {totalArchived.toLocaleString("pt-BR")}
            </Typography>
          </div>

          <div className={classes.statBadge}>
            <BlockIcon style={{ color: "#f87171", fontSize: 16 }} />
            <Typography variant="caption" style={{ color: "#94a3b8" }}>
              Apagadas Recuperadas:
            </Typography>
            <Typography variant="body2" style={{ fontWeight: 700, color: "#f87171" }}>
              {totalDeletedCount.toLocaleString("pt-BR")}
            </Typography>
          </div>

          <Tooltip title="Atualizar dados de auditoria">
            <IconButton
              size="small"
              onClick={() => {
                fetchDevices();
                fetchChats();
                fetchMessages();
              }}
              style={{ color: "#ffffff" }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* 2. Seletor Visual dos 20 Celulares (Ribbon Superior) */}
      <div className={classes.deviceRibbon}>
        {loadingDevices ? (
          <CircularProgress size={24} style={{ margin: "auto" }} />
        ) : (
          devices.map((device) => {
            const isSelected = selectedDevice?.id === device.id;
            const isOnline = device.status === "CONNECTED";

            return (
              <Card
                key={device.id}
                className={`${classes.deviceCard} ${isSelected ? classes.deviceCardSelected : ""}`}
                onClick={() => setSelectedDevice(device)}
              >
                <CardActionArea className={classes.deviceCardContent}>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle2" style={{ fontWeight: 700, color: isSelected ? "#0284c7" : "#1e293b" }}>
                      📱 {device.name}
                    </Typography>
                    {isOnline ? (
                      <OnlineIcon style={{ color: "#10b981", fontSize: 16 }} />
                    ) : (
                      <OfflineIcon style={{ color: "#94a3b8", fontSize: 16 }} />
                    )}
                  </Box>

                  <Box display="flex" alignItems="center" justifyContent="space-between" mt={0.5}>
                    <Typography variant="caption" color="textSecondary">
                      {device.totalMessages || 0} msgs
                    </Typography>
                    {device.deletedMessages > 0 && (
                      <Chip
                        size="small"
                        label={`🚫 ${device.deletedMessages}`}
                        style={{
                          height: 18,
                          fontSize: "0.68rem",
                          backgroundColor: "#fee2e2",
                          color: "#991b1b",
                          fontWeight: 700,
                        }}
                      />
                    )}
                  </Box>
                </CardActionArea>
              </Card>
            );
          })
        )}
      </div>

      {/* 3. Área Principal: Divisão em 2 Painéis */}
      <div className={classes.mainContent}>
        {/* Painel Esquerdo: Lista de Conversas do Celular */}
        <div className={classes.chatsPanel}>
          <div className={classes.chatSearchBox}>
            <TextField
              size="small"
              fullWidth
              placeholder="Buscar contato ou número..."
              variant="outlined"
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ color: "#94a3b8" }} fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: chatSearch && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setChatSearch("")}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </div>

          <div className={classes.chatsList}>
            {loadingChats ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress size={28} />
              </Box>
            ) : chats.length === 0 ? (
              <Box p={3} textAlign="center" color="#64748b">
                <Typography variant="body2">Nenhuma conversa encontrada neste aparelho.</Typography>
              </Box>
            ) : (
              chats.map((chat) => {
                const isSelected = selectedChat?.ticketId === chat.ticketId;
                return (
                  <div
                    key={chat.ticketId}
                    className={`${classes.chatItem} ${isSelected ? classes.chatItemSelected : ""}`}
                    onClick={() => setSelectedChat(chat)}
                  >
                    <Avatar className={classes.chatAvatar} src={chat.contact?.profilePicUrl}>
                      {getContactDisplayName(chat.contact).charAt(0).toUpperCase()}
                    </Avatar>

                    <div className={classes.chatInfo}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography className={classes.chatName}>
                          {getContactDisplayName(chat.contact)}
                        </Typography>
                        <Typography className={classes.chatDate}>
                          {chat.updatedAt ? format(parseISO(chat.updatedAt), "dd/MM HH:mm") : ""}
                        </Typography>
                      </Box>

                      <Typography className={classes.chatLastMsg}>
                        {chat.lastMessage || "Conversa iniciada"}
                      </Typography>

                      <Box display="flex" gap={1} mt={0.5}>
                        {formatPhoneNumber(chat.contact?.number) && (
                          <Typography variant="caption" style={{ color: "#64748b", fontSize: "0.72rem" }}>
                            {formatPhoneNumber(chat.contact?.number)}
                          </Typography>
                        )}
                        {chat.deletedMessages > 0 && (
                          <span
                            style={{
                              backgroundColor: "#fee2e2",
                              color: "#b91c1c",
                              padding: "1px 6px",
                              borderRadius: 8,
                              fontSize: "0.68rem",
                              fontWeight: 700,
                            }}
                          >
                            🚫 {chat.deletedMessages} apagadas
                          </span>
                        )}
                      </Box>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Painel Direito: Timeline de Mensagens & Filtros */}
        <div className={classes.timelinePanel}>
          {/* Barra de Ferramentas de Auditoria */}
          <div className={classes.filterToolbar}>
            {/* Busca Textual */}
            <TextField
              size="small"
              placeholder="Buscar termo (ex: PIX, acordo)..."
              variant="outlined"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ minWidth: 220 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" style={{ color: "#64748b" }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Data Inicial */}
            <TextField
              size="small"
              type="date"
              label="Data Início"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            {/* Data Final */}
            <TextField
              size="small"
              type="date"
              label="Data Fim"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />

            {/* Tipo de Mídia */}
            <FormControl size="small" variant="outlined" style={{ minWidth: 130 }}>
              <InputLabel>Tipo Mídia</InputLabel>
              <Select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value)}
                label="Tipo Mídia"
              >
                <MenuItem value="all">Todas as Mensagens</MenuItem>
                <MenuItem value="audio">🎙️ Áudios</MenuItem>
                <MenuItem value="image">🖼️ Fotos</MenuItem>
                <MenuItem value="video">🎥 Vídeos</MenuItem>
                <MenuItem value="document">📄 Documentos / PDF</MenuItem>
              </Select>
            </FormControl>

            {/* Switch Apenas Apagadas */}
            <FormControlLabel
              control={
                <Switch
                  checked={onlyDeleted}
                  onChange={(e) => setOnlyDeleted(e.target.checked)}
                  className={classes.deletedSwitch}
                />
              }
              label={
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: onlyDeleted ? "#dc2626" : "#475569" }}>
                  🚫 Apenas Apagadas
                </span>
              }
            />

            {/* Limpar Filtros */}
            {(searchTerm || startDate || endDate || onlyDeleted || mediaType !== "all") && (
              <Button
                size="small"
                variant="outlined"
                onClick={handleClearFilters}
                startIcon={<ClearIcon />}
                style={{ textTransform: "none", fontSize: "0.78rem" }}
              >
                Limpar
              </Button>
            )}

            {/* Botão Exportar Laudo */}
            <Button
              size="small"
              variant="contained"
              onClick={() => setExportModalOpen(true)}
              startIcon={<GetAppIcon />}
              style={{
                marginLeft: "auto",
                backgroundColor: "#0284c7",
                color: "#ffffff",
                fontWeight: 700,
                textTransform: "none",
                borderRadius: 6,
              }}
            >
              Exportar Laudo
            </Button>
          </div>

          {/* Área de Mensagens (Timeline) */}
          <div className={classes.messagesScrollArea}>
            {loadingMessages ? (
              <Box display="flex" justifyContent="center" alignItems="center" flexGrow={1}>
                <CircularProgress size={32} />
              </Box>
            ) : messages.length === 0 ? (
              <div className={classes.noChatSelected}>
                <SecurityIcon style={{ fontSize: 48, color: "#94a3b8" }} />
                <Typography variant="h6" style={{ fontWeight: 600 }}>
                  Nenhuma mensagem encontrada
                </Typography>
                <Typography variant="body2">
                  Selecione uma conversa ao lado ou ajuste os filtros de auditoria.
                </Typography>
              </div>
            ) : (
              messages.map((message) => {
                const isOp = message.fromMe;
                const isDeleted = message.isDeleted;
                const dateFormatted = message.createdAt
                  ? format(parseISO(message.createdAt), "dd/MM/yyyy HH:mm:ss")
                  : "";

                const isGroupChat = selectedChat?.contact?.isGroup || message.ticket?.contact?.isGroup;
                const senderName = isOp
                  ? (selectedDevice?.name || "Você (Operador)")
                  : getContactDisplayName(message.contact);
                const senderColor = isOp ? "#059669" : getParticipantColor(senderName);

                return (
                  <div
                    key={message.id}
                    className={`${classes.messageBubble} ${
                      isOp ? classes.messageOperator : classes.messageClient
                    }`}
                  >
                    {/* Identificação do Remetente em Conversas de Grupo */}
                    {isGroupChat && (
                      <div
                        style={{
                          fontSize: "0.76rem",
                          fontWeight: 800,
                          color: senderColor,
                          marginBottom: 3,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span>{isOp ? `📱 ${senderName}` : `👤 ${senderName}`}</span>
                      </div>
                    )}

                    {/* Badge de Anti-Delete em Destaque */}
                    {isDeleted && (
                      <div className={classes.deletedBanner}>
                        <BlockIcon style={{ fontSize: 14 }} />
                        <span>🚫 MENSAGEM APAGADA NO WHATSAPP (Preservada no Cofre)</span>
                      </div>
                    )}

                    {/* Mensagem Citada (Quoted) */}
                    {message.quotedMsg && (
                      <div className={classes.quotedMsgBox}>
                        <Typography variant="caption" style={{ fontWeight: 700, display: "block" }}>
                          {message.quotedMsg.fromMe ? "Operador" : getContactDisplayName(message.quotedMsg.contact)}
                        </Typography>
                        <Typography variant="caption">{message.quotedMsg.body}</Typography>
                      </div>
                    )}

                    {/* Mídia: Imagem */}
                    {message.mediaUrl && (message.mediaType === "image" || message.mediaUrl.match(/\.(jpeg|jpg|gif|png)$/i)) && (
                      <div>
                        <img
                          src={message.mediaUrl}
                          alt="Mídia"
                          className={classes.mediaPreview}
                          onClick={() => window.open(message.mediaUrl, "_blank")}
                        />
                      </div>
                    )}

                    {/* Mídia: Áudio */}
                    {message.mediaUrl && (message.mediaType?.includes("audio") || message.mediaUrl.match(/\.(ogg|mp3|wav|m4a)$/i)) && (
                      <Box my={1}>
                        <audio controls style={{ width: "100%", height: 36 }}>
                          <source src={message.mediaUrl} type="audio/ogg" />
                          <source src={message.mediaUrl} type="audio/mpeg" />
                          Seu navegador não suporta player de áudio.
                        </audio>
                      </Box>
                    )}

                    {/* Mídia: Documento / PDF */}
                    {message.mediaUrl && (message.mediaType?.includes("document") || message.mediaUrl.match(/\.(pdf|doc|docx|xlsx|zip)$/i)) && (
                      <Box my={1} display="flex" alignItems="center" gap={1}>
                        <DocumentIcon style={{ color: "#0284c7" }} />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => window.open(message.mediaUrl, "_blank")}
                          style={{ textTransform: "none", fontSize: "0.78rem" }}
                        >
                          Baixar Documento ({message.mediaType || "arquivo"})
                        </Button>
                      </Box>
                    )}

                    {/* Texto da Mensagem */}
                    <Typography
                      variant="body2"
                      style={{
                        whiteSpace: "pre-wrap",
                        color: isDeleted ? "#7f1d1d" : "inherit",
                        textDecoration: isDeleted ? "line-through" : "none",
                      }}
                    >
                      {message.body}
                    </Typography>

                    {/* Rodapé com Timestamp e Status */}
                    <div className={classes.metaFooter}>
                      <span>{dateFormatted}</span>
                      {isOp && (
                        message.ack === 3 ? (
                          <DoneAllIcon style={{ color: "#38bdf8", fontSize: 15 }} />
                        ) : message.ack === 2 ? (
                          <DoneAllIcon style={{ color: "#94a3b8", fontSize: 15 }} />
                        ) : (
                          <DoneIcon style={{ color: "#94a3b8", fontSize: 15 }} />
                        )
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Modal de Exportação */}
      <ExportAuditModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        selectedDevice={selectedDevice}
        selectedChat={selectedChat}
        searchFilter={searchTerm}
        startDate={startDate}
        endDate={endDate}
        onlyDeleted={onlyDeleted}
        mediaType={mediaType}
      />
    </div>
  );
};

export default Audit;
