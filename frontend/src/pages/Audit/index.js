import React, { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import {
  makeStyles,
  Paper,
  Typography,
  Grid,
  Box,
  TextField,
  InputAdornment,
  InputBase,
  IconButton,
  Chip,
  Avatar,
  CircularProgress,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  ButtonBase,
  Popper,
  ClickAwayListener,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from "@material-ui/core";
import { alpha } from "@material-ui/core/styles";
import Skeleton from "@material-ui/lab/Skeleton";
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
  Done as DoneIcon,
  DoneAll as DoneAllIcon,
  Refresh as RefreshIcon,
  Smartphone as PhoneAndroidIcon,
  ArrowForward as ArrowForwardIcon,
  Forum as ForumIcon,
  FindInPage as FindInPageIcon,
  WifiTethering as OnlineDevicesIcon,
  ContactPhone as VcardIcon,
  ChatBubbleOutline as ChatIcon,
} from "@material-ui/icons";
import { format, parseISO } from "date-fns";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ExportAuditModal from "../../components/ExportAuditModal";
import { getContactDisplayName, formatPhoneNumber } from "../../helpers/contactHelper";
import { PageHeader, StatCard, StatusPill, EmptyState } from "../../components/ui";

const useStyles = makeStyles((theme) => {
  const c = theme.custom;
  const isDark = theme.palette.type === "dark";
  const err = theme.palette.error.main;

  return {
    root: {
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - 48px)",
      backgroundColor: theme.palette.background.default,
      padding: theme.spacing(0, 3, 3),
      overflow: "hidden",
      [theme.breakpoints.down("sm")]: {
        height: "auto",
        minHeight: "calc(100vh - 48px)",
        overflow: "visible",
        padding: theme.spacing(0, 2, 2),
      },
    },
    kpiRow: {
      marginBottom: theme.spacing(2),
      flex: "none",
    },
    kpiCard: {
      padding: theme.spacing(1.75, 2),
      gap: theme.spacing(1),
      "& > div:nth-child(3)": { fontSize: "1.55rem" },
    },

    // ---------- Omnisearch / dispositivos ----------
    consoleCard: {
      flex: "none",
      borderRadius: 16,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.5),
    },
    omniRow: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1.5),
      flexWrap: "wrap",
    },
    globalSearchContainer: {
      position: "relative",
      flex: "1 1 360px",
      minWidth: 0,
    },
    omniField: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      height: 46,
      padding: "0 8px 0 14px",
      borderRadius: 12,
      border: `1px solid ${c.border}`,
      backgroundColor: c.surfaceAlt,
      transition: "border-color .15s, box-shadow .15s, background-color .15s",
      "&:focus-within": {
        borderColor: theme.palette.primary.main,
        backgroundColor: c.surface,
        boxShadow: `0 0 0 3px ${c.primarySoft}`,
      },
    },
    omniIcon: { color: theme.palette.primary.main, fontSize: 21 },
    omniInput: { flex: 1, fontSize: "0.95rem" },
    omniHint: {
      fontSize: "0.72rem",
      fontWeight: 600,
      color: c.textSubtle,
      border: `1px solid ${c.border}`,
      borderRadius: 6,
      padding: "1px 6px",
      whiteSpace: "nowrap",
      [theme.breakpoints.down("xs")]: { display: "none" },
    },
    popperPaper: {
      maxHeight: 400,
      overflowY: "auto",
      borderRadius: 14,
      boxShadow: c.shadowLg,
      border: `1px solid ${c.border}`,
      marginTop: 6,
      ...theme.scrollbarStyles,
    },
    popperHeader: {
      padding: theme.spacing(1, 2),
      backgroundColor: c.surfaceAlt,
      borderBottom: `1px solid ${c.border}`,
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: c.textMuted,
      position: "sticky",
      top: 0,
      zIndex: 1,
    },
    globalResultItem: {
      padding: theme.spacing(1.25, 2),
      borderBottom: `1px solid ${c.border}`,
      cursor: "pointer",
      transition: "background 0.15s ease",
      "&:last-child": { borderBottom: 0 },
      "&:hover": { backgroundColor: c.surfaceHover },
    },
    resultAvatar: {
      width: 34,
      height: 34,
      fontSize: "0.85rem",
      fontWeight: 700,
      color: theme.palette.primary.main,
      backgroundColor: c.primarySoft,
    },
    deviceBadge: {
      backgroundColor: alpha(theme.palette.info.main, isDark ? 0.16 : 0.1),
      color: theme.palette.info.main,
      fontWeight: 650,
      fontSize: "0.7rem",
      padding: "2px 8px",
      borderRadius: 999,
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      whiteSpace: "nowrap",
      "& svg": { fontSize: 13 },
    },
    popperState: {
      padding: theme.spacing(3, 2),
      textAlign: "center",
      color: c.textMuted,
    },

    deviceRibbonWrap: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1.5),
      minWidth: 0,
    },
    ribbonLabel: {
      fontSize: "0.72rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: c.textSubtle,
      flex: "none",
      [theme.breakpoints.down("xs")]: { display: "none" },
    },
    deviceRibbon: {
      display: "flex",
      gap: theme.spacing(1),
      overflowX: "auto",
      paddingBottom: 2,
      minWidth: 0,
      flex: 1,
      ...theme.scrollbarStyles,
    },
    deviceCard: {
      flex: "none",
      minWidth: 168,
      maxWidth: 220,
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "7px 12px 7px 8px",
      borderRadius: 12,
      border: `1px solid ${c.border}`,
      backgroundColor: c.surface,
      textAlign: "left",
      transition: "border-color .15s, background-color .15s, box-shadow .15s",
      "&:hover": { borderColor: c.borderStrong, backgroundColor: c.surfaceHover },
    },
    deviceCardSelected: {
      borderColor: theme.palette.primary.main,
      backgroundColor: c.primarySoft,
      boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
      "&:hover": { borderColor: theme.palette.primary.main, backgroundColor: c.primarySoft },
    },
    deviceIcon: {
      position: "relative",
      width: 30,
      height: 30,
      borderRadius: 9,
      display: "grid",
      placeItems: "center",
      flex: "none",
      color: c.textMuted,
      backgroundColor: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      "& svg": { fontSize: 17 },
    },
    deviceIconSelected: {
      color: theme.palette.primary.main,
      backgroundColor: c.surface,
      borderColor: "transparent",
    },
    statusDot: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 9,
      height: 9,
      borderRadius: "50%",
      border: `2px solid ${c.surface}`,
    },
    dotOnline: { backgroundColor: theme.palette.success.main },
    dotOffline: { backgroundColor: c.textSubtle },
    deviceName: {
      fontWeight: 650,
      fontSize: "0.83rem",
      lineHeight: 1.25,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    deviceMeta: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: "0.72rem",
      color: c.textMuted,
      marginTop: 1,
    },
    deviceDeleted: { color: err, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 },

    // ---------- Workspace ----------
    workspace: {
      display: "flex",
      flex: 1,
      minHeight: 0,
      borderRadius: 16,
      overflow: "hidden",
      [theme.breakpoints.down("sm")]: { flexDirection: "column", minHeight: 640 },
    },
    chatsPanel: {
      width: 340,
      minWidth: 280,
      borderRight: `1px solid ${c.border}`,
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      [theme.breakpoints.down("sm")]: {
        width: "100%",
        borderRight: 0,
        borderBottom: `1px solid ${c.border}`,
        maxHeight: 320,
      },
    },
    panelHead: {
      padding: theme.spacing(1.5, 1.5, 1.25),
      borderBottom: `1px solid ${c.border}`,
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1),
    },
    panelTitleRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing(0, 0.5),
    },
    panelTitle: { fontWeight: 700, fontSize: "0.88rem" },
    countBadge: {
      fontSize: "0.72rem",
      fontWeight: 700,
      color: c.textMuted,
      backgroundColor: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      borderRadius: 999,
      padding: "1px 8px",
    },
    compactSearch: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      height: 36,
      padding: "0 6px 0 10px",
      borderRadius: 10,
      border: `1px solid ${c.border}`,
      backgroundColor: c.surfaceAlt,
      transition: "border-color .15s, box-shadow .15s",
      "&:focus-within": {
        borderColor: theme.palette.primary.main,
        boxShadow: `0 0 0 3px ${c.primarySoft}`,
      },
      "& > svg": { fontSize: 18, color: c.textSubtle },
    },
    compactInput: { flex: 1, fontSize: "0.84rem" },
    chatsList: {
      flexGrow: 1,
      overflowY: "auto",
      padding: theme.spacing(0.75),
      ...theme.scrollbarStyles,
    },
    chatItem: {
      padding: theme.spacing(1.1, 1.25),
      borderRadius: 12,
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1.25),
      cursor: "pointer",
      position: "relative",
      transition: "background 0.15s ease",
      "&:hover": { backgroundColor: c.surfaceHover },
    },
    chatItemSelected: {
      backgroundColor: `${c.primarySoft} !important`,
      "&::before": {
        content: '""',
        position: "absolute",
        left: 0,
        top: 10,
        bottom: 10,
        width: 3,
        borderRadius: 3,
        backgroundColor: theme.palette.primary.main,
      },
    },
    chatAvatar: {
      width: 40,
      height: 40,
      fontSize: "0.95rem",
      fontWeight: 700,
      color: theme.palette.primary.main,
      backgroundColor: c.primarySoft,
    },
    chatInfo: { flexGrow: 1, overflow: "hidden", minWidth: 0 },
    chatName: {
      fontWeight: 650,
      fontSize: "0.86rem",
      color: theme.palette.text.primary,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    chatLastMsg: {
      fontSize: "0.78rem",
      color: c.textMuted,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      marginTop: 2,
    },
    chatDate: {
      fontSize: "0.7rem",
      color: c.textSubtle,
      whiteSpace: "nowrap",
      marginLeft: 8,
      fontVariantNumeric: "tabular-nums",
    },
    miniPill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      marginTop: 5,
      padding: "1px 7px",
      borderRadius: 999,
      fontSize: "0.66rem",
      fontWeight: 700,
      color: err,
      backgroundColor: alpha(err, isDark ? 0.16 : 0.1),
      "& svg": { fontSize: 11 },
    },

    // ---------- Timeline ----------
    timelinePanel: {
      flexGrow: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      minHeight: 0,
      overflow: "hidden",
    },
    convHeader: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1.5),
      padding: theme.spacing(1.25, 2),
      borderBottom: `1px solid ${c.border}`,
      minHeight: 60,
    },
    convName: {
      fontWeight: 700,
      fontSize: "0.92rem",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    convSub: { fontSize: "0.76rem", color: c.textMuted, fontVariantNumeric: "tabular-nums" },
    convPills: { display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto", justifyContent: "flex-end" },
    filterToolbar: {
      padding: theme.spacing(1.25, 2),
      borderBottom: `1px solid ${c.border}`,
      backgroundColor: c.surfaceAlt,
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1),
      flexWrap: "wrap",
    },
    filterSearch: {
      flex: "1 1 220px",
      backgroundColor: c.surface,
    },
    filterItem: {
      width: 150,
      "& .MuiOutlinedInput-root": { backgroundColor: c.surface },
      [theme.breakpoints.down("xs")]: { width: "calc(50% - 4px)" },
    },
    filterSelect: {
      minWidth: 170,
      "& .MuiOutlinedInput-root": { backgroundColor: c.surface },
      [theme.breakpoints.down("xs")]: { minWidth: 0, width: "100%" },
    },
    menuIcon: { fontSize: 17, marginRight: 10, color: c.textMuted, verticalAlign: "middle" },
    deletedChip: {
      height: 36,
      borderRadius: 10,
      fontWeight: 650,
      backgroundColor: c.surface,
      border: `1px solid ${c.border}`,
      color: c.textMuted,
      "& .MuiChip-icon": { color: "inherit", fontSize: 17 },
    },
    deletedChipActive: {
      color: `${err} !important`,
      borderColor: `${alpha(err, 0.5)} !important`,
      backgroundColor: `${alpha(err, isDark ? 0.16 : 0.08)} !important`,
    },
    clearBtn: { height: 36, borderRadius: 10, color: c.textMuted },

    messagesScrollArea: {
      flexGrow: 1,
      padding: theme.spacing(2.5, 3),
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1),
      ...c.dotGrid,
      ...theme.scrollbarStyles,
      [theme.breakpoints.down("xs")]: { padding: theme.spacing(2, 1.5) },
    },
    messageBubble: {
      maxWidth: "68%",
      minWidth: 180,
      padding: "8px 12px 6px",
      borderRadius: 14,
      boxShadow: c.shadow,
      position: "relative",
      wordBreak: "break-word",
      fontSize: "0.88rem",
      border: `1px solid ${c.border}`,
      [theme.breakpoints.down("xs")]: { maxWidth: "88%" },
    },
    messageOperator: {
      alignSelf: "flex-end",
      backgroundColor: isDark ? alpha(theme.palette.primary.main, 0.18) : c.primarySoft,
      borderColor: alpha(theme.palette.primary.main, isDark ? 0.3 : 0.18),
      color: theme.palette.text.primary,
      borderTopRightRadius: 4,
    },
    messageClient: {
      alignSelf: "flex-start",
      backgroundColor: c.surface,
      color: theme.palette.text.primary,
      borderTopLeftRadius: 4,
    },
    messageDeleted: {
      borderColor: alpha(err, 0.45),
      boxShadow: `0 0 0 1px ${alpha(err, 0.15)}`,
    },
    senderName: {
      fontWeight: 700,
      display: "block",
      marginBottom: 3,
      fontSize: "0.76rem",
    },
    deletedBanner: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 8px",
      marginBottom: 6,
      borderRadius: 999,
      fontSize: "0.68rem",
      fontWeight: 750,
      letterSpacing: "0.03em",
      color: err,
      backgroundColor: alpha(err, isDark ? 0.18 : 0.1),
    },
    quotedMsgBox: {
      backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
      borderLeft: `3px solid ${theme.palette.primary.main}`,
      borderRadius: 8,
      padding: "4px 8px",
      marginBottom: 6,
      fontSize: "0.78rem",
      color: c.textMuted,
    },
    quotedAuthor: { fontWeight: 700, color: theme.palette.primary.main, display: "block" },
    mediaPreview: {
      maxWidth: "100%",
      maxHeight: 260,
      borderRadius: 10,
      cursor: "pointer",
      marginTop: 4,
      marginBottom: 4,
      objectFit: "cover",
      display: "block",
    },
    docButton: { textTransform: "none", borderRadius: 10, maxWidth: "100%", justifyContent: "flex-start" },
    metaFooter: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
      marginTop: 4,
      fontSize: "0.68rem",
      color: c.textSubtle,
      fontVariantNumeric: "tabular-nums",
      "& svg": { fontSize: 14 },
    },
    directionTag: {
      marginRight: "auto",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      fontSize: "0.62rem",
    },
    ackRead: { color: theme.palette.info.main },
    centerState: {
      flexGrow: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    stateCard: {
      borderRadius: 16,
      maxWidth: 420,
      width: "100%",
      boxShadow: c.shadow,
    },
    skeletonBubble: { borderRadius: 14 },
  };
});

const MEDIA_ICONS = {
  image: ImageIcon,
  audio: AudioIcon,
  video: VideoIcon,
  document: DocumentIcon,
  vcard: VcardIcon,
};

const getMediaKind = (message) => {
  const t = message.mediaType || "";
  if (!message.mediaUrl && (!t || t === "chat")) return null;
  if (t === "image") return "image";
  if (t.includes("audio") || t === "ptt") return "audio";
  if (t.includes("video")) return "video";
  if (t.includes("document")) return "document";
  if (t.includes("vcard")) return "vcard";
  return null;
};

const ListSkeleton = () => (
  <Box p={0.5}>
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <Box key={i} display="flex" alignItems="center" px={1.25} py={1.1}>
        <Skeleton variant="circle" width={40} height={40} />
        <Box flex={1} ml={1.25}>
          <Skeleton variant="text" width="60%" height={18} />
          <Skeleton variant="text" width="85%" height={16} />
        </Box>
      </Box>
    ))}
  </Box>
);

const TimelineSkeleton = ({ className }) => (
  <>
    {[220, 300, 180, 260, 320, 200].map((w, i) => (
      <Box key={i} alignSelf={i % 2 ? "flex-end" : "flex-start"}>
        <Skeleton variant="rect" width={w} height={i % 3 === 1 ? 72 : 48} className={className} />
      </Box>
    ))}
  </>
);

const Audit = () => {
  const classes = useStyles();

  // Helpers de Cores de Grupo
  const getParticipantColor = (name = "") => {
    const colors = [
      "#0284c7", "#7c3aed", "#d97706", "#059669",
      "#db2777", "#ea580c", "#0891b2", "#4f46e5", "#be185d",
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

  // Busca Global no Topo (Todos os Aparelhos)
  const [globalSearchInput, setGlobalSearchInput] = useState("");
  const [globalResults, setGlobalResults] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalPopperOpen, setGlobalPopperOpen] = useState(false);
  const globalSearchRef = useRef(null);
  const globalSearchTimeout = useRef(null);

  // Filtros de busca local
  const [chatSearchInput, setChatSearchInput] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [searchTermInput, setSearchTermInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [onlyDeleted, setOnlyDeleted] = useState(false);
  const [mediaType, setMediaType] = useState("all");

  // Modal Exportação
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const chatSearchTimeout = useRef(null);
  const searchTermTimeout = useRef(null);

  // 1. Busca Global em Todos os Aparelhos
  const executeGlobalSearch = async (val) => {
    if (!val || val.trim().length === 0) {
      setGlobalResults([]);
      setGlobalPopperOpen(false);
      setGlobalLoading(false);
      return;
    }

    setGlobalLoading(true);
    setGlobalPopperOpen(true);

    try {
      const { data } = await api.get("/audit/search-all", {
        params: { search: val.trim() },
      });
      setGlobalResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro na busca global:", err);
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleGlobalSearchChange = (e) => {
    const val = e.target.value;
    setGlobalSearchInput(val);

    if (globalSearchTimeout.current) clearTimeout(globalSearchTimeout.current);

    if (!val || val.trim().length === 0) {
      setGlobalResults([]);
      setGlobalPopperOpen(false);
      setGlobalLoading(false);
      return;
    }

    setGlobalLoading(true);
    setGlobalPopperOpen(true);

    globalSearchTimeout.current = setTimeout(() => {
      executeGlobalSearch(val);
    }, 150);
  };

  // Ao clicar em um resultado da busca global: seleciona o smartphone e a conversa!
  const handleSelectGlobalResult = (result) => {
    setGlobalPopperOpen(false);
    setGlobalSearchInput("");

    // 1. Encontrar o smartphone do resultado na lista
    const targetDevice = devices.find((d) => d.id === result.whatsappId) || {
      id: result.whatsappId,
      name: result.deviceName,
      status: result.deviceStatus,
    };

    setSelectedDevice(targetDevice);

    // 2. Definir a conversa selecionada
    setSelectedChat({
      ticketId: result.ticketId,
      whatsappId: result.whatsappId,
      contact: result.contact,
      lastMessage: result.lastMessage,
      totalMessages: result.totalMessages,
      deletedMessages: result.deletedMessages,
    });
  };

  // Debounce para busca de conversas na lateral
  const handleChatSearchChange = (e) => {
    const val = e.target.value;
    setChatSearchInput(val);
    if (chatSearchTimeout.current) clearTimeout(chatSearchTimeout.current);
    chatSearchTimeout.current = setTimeout(() => {
      setChatSearch(val);
    }, 350);
  };

  // Debounce para busca de termos dentro das mensagens
  const handleSearchTermChange = (e) => {
    const val = e.target.value;
    setSearchTermInput(val);
    if (searchTermTimeout.current) clearTimeout(searchTermTimeout.current);
    searchTermTimeout.current = setTimeout(() => {
      setSearchTerm(val);
    }, 400);
  };

  // 1. Carregar lista dos smartphones
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
        if (!selectedChat || selectedChat.whatsappId !== selectedDevice.id) {
          setSelectedChat(data.chats[0]);
        }
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
    const activeWhatsappId = selectedChat?.whatsappId || selectedDevice?.id;
    if (!activeWhatsappId) return;

    setLoadingMessages(true);
    try {
      const params = {
        whatsappId: activeWhatsappId,
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
    if (selectedChat || searchTerm || startDate || endDate || onlyDeleted || mediaType !== "all") {
      fetchMessages();
    }
  }, [selectedDevice, selectedChat, searchTerm, startDate, endDate, onlyDeleted, mediaType]);

  // Scroll suave para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const clearFilters = () => {
    setSearchTermInput("");
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setOnlyDeleted(false);
    setMediaType("all");
  };

  // Totais agregados
  const totalArchived = devices.reduce((acc, d) => acc + (d.totalMessages || 0), 0);
  const totalDeletedCount = devices.reduce((acc, d) => acc + (d.deletedMessages || 0), 0);

  const onlineDevices = devices.filter((d) => d.status === "CONNECTED").length;
  const hasActiveFilters = Boolean(searchTerm || startDate || endDate || onlyDeleted || mediaType !== "all");
  const fmtNum = (n) => (n || 0).toLocaleString("pt-BR");

  return (
    <div className={classes.root}>
      {/* 1. Cabeçalho do Cofre */}
      <PageHeader
        icon={<SecurityIcon />}
        title="Cofre de Auditoria"
        subtitle="Investigação forense de conversas WhatsApp: mensagens arquivadas, apagadas e mídias."
        actions={
          <>
            <Tooltip title="Atualizar dados">
              <IconButton
                size="small"
                onClick={() => {
                  fetchDevices();
                  fetchChats();
                  fetchMessages();
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              color="primary"
              startIcon={<GetAppIcon />}
              onClick={() => setExportModalOpen(true)}
            >
              Exportar laudo
            </Button>
          </>
        }
      />

      {/* 2. KPIs */}
      <Grid container spacing={2} className={classes.kpiRow}>
        <Grid item xs={6} md={3}>
          <StatCard
            className={classes.kpiCard}
            label="Aparelhos"
            value={loadingDevices ? <Skeleton width={48} /> : fmtNum(devices.length)}
            icon={<PhoneAndroidIcon />}
            tone="primary"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            className={classes.kpiCard}
            label="Online agora"
            value={loadingDevices ? <Skeleton width={48} /> : fmtNum(onlineDevices)}
            icon={<OnlineDevicesIcon />}
            tone="success"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            className={classes.kpiCard}
            label="Mensagens arquivadas"
            value={loadingDevices ? <Skeleton width={80} /> : fmtNum(totalArchived)}
            icon={<ForumIcon />}
            tone="info"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            className={classes.kpiCard}
            label="Apagadas recuperadas"
            value={loadingDevices ? <Skeleton width={64} /> : fmtNum(totalDeletedCount)}
            icon={<BlockIcon />}
            tone="error"
          />
        </Grid>
      </Grid>

      {/* 3. Omnisearch + seletor de aparelhos */}
      <Paper className={classes.consoleCard}>
        <div className={classes.omniRow}>
          {/* Busca Global: localiza o número e em qual celular está */}
          <ClickAwayListener onClickAway={() => setGlobalPopperOpen(false)}>
            <div className={classes.globalSearchContainer} ref={globalSearchRef}>
              <div className={classes.omniField}>
                <SearchIcon className={classes.omniIcon} />
                <InputBase
                  className={classes.omniInput}
                  placeholder="Localizar número em qualquer aparelho..."
                  value={globalSearchInput}
                  onChange={handleGlobalSearchChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (globalSearchTimeout.current) clearTimeout(globalSearchTimeout.current);
                      executeGlobalSearch(globalSearchInput);
                    }
                  }}
                  onFocus={() => {
                    if (globalSearchInput.trim().length > 0) setGlobalPopperOpen(true);
                  }}
                  inputProps={{ "aria-label": "Localizar número em qualquer aparelho" }}
                />
                {globalLoading ? (
                  <CircularProgress size={16} style={{ marginRight: 8 }} />
                ) : globalSearchInput ? (
                  <IconButton
                    size="small"
                    onClick={() => {
                      setGlobalSearchInput("");
                      setGlobalResults([]);
                      setGlobalPopperOpen(false);
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                ) : (
                  <span className={classes.omniHint}>Todos os aparelhos</span>
                )}
              </div>

              <Popper
                open={Boolean(globalPopperOpen && globalSearchInput.trim().length > 0)}
                anchorEl={globalSearchRef.current}
                placement="bottom-start"
                disablePortal
                style={{ zIndex: 1400, width: "100%" }}
              >
                <Paper className={classes.popperPaper}>
                  {globalLoading ? (
                    <div className={classes.popperState}>
                      <CircularProgress size={22} />
                      <Typography variant="body2" style={{ marginTop: 8, fontWeight: 600 }}>
                        Buscando número em todos os aparelhos...
                      </Typography>
                    </div>
                  ) : globalResults.length === 0 ? (
                    <EmptyState
                      icon={<FindInPageIcon />}
                      tone="neutral"
                      title="Nenhum resultado nos aparelhos"
                      description="Verifique se o número foi digitado corretamente."
                    />
                  ) : (
                    <List disablePadding>
                      <div className={classes.popperHeader}>
                        Encontrado em {globalResults.length} aparelho(s) · clique para abrir
                      </div>
                      {globalResults.map((res) => (
                        <ListItem
                          key={`${res.whatsappId}-${res.ticketId}`}
                          className={classes.globalResultItem}
                          onClick={() => handleSelectGlobalResult(res)}
                        >
                          <ListItemAvatar style={{ minWidth: 46 }}>
                            <Avatar className={classes.resultAvatar}>
                              {getContactDisplayName(res.contact).charAt(0).toUpperCase()}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            disableTypography
                            primary={
                              <Box display="flex" justifyContent="space-between" alignItems="center" style={{ gap: 8 }}>
                                <Typography variant="subtitle2" noWrap style={{ fontWeight: 700 }}>
                                  {getContactDisplayName(res.contact)}
                                </Typography>
                                <span className={classes.deviceBadge}>
                                  <PhoneAndroidIcon />
                                  {res.deviceName}
                                </span>
                              </Box>
                            }
                            secondary={
                              <Box display="flex" justifyContent="space-between" alignItems="center" mt={0.4} style={{ gap: 8 }}>
                                <Typography variant="caption" color="textSecondary" noWrap style={{ minWidth: 0 }}>
                                  {res.lastMessage || "Conversa iniciada"}
                                </Typography>
                                <Box display="flex" alignItems="center" flex="none" style={{ gap: 6 }}>
                                  <Typography variant="caption" color="textSecondary" style={{ fontSize: "0.7rem" }}>
                                    {res.totalMessages} msgs
                                  </Typography>
                                  {res.deletedMessages > 0 && (
                                    <StatusPill tone="error" dot={false}>
                                      <BlockIcon style={{ fontSize: 11 }} /> {res.deletedMessages}
                                    </StatusPill>
                                  )}
                                  <ArrowForwardIcon color="primary" style={{ fontSize: 15 }} />
                                </Box>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Paper>
              </Popper>
            </div>
          </ClickAwayListener>
        </div>

        {/* Seletor de aparelhos */}
        <div className={classes.deviceRibbonWrap}>
          <span className={classes.ribbonLabel}>Aparelhos</span>
          <div className={classes.deviceRibbon}>
            {loadingDevices
              ? [0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rect" width={176} height={46} style={{ borderRadius: 12, flex: "none" }} />
                ))
              : devices.map((device) => {
                  const isSelected = selectedDevice?.id === device.id;
                  const isOnline = device.status === "CONNECTED";

                  return (
                    <ButtonBase
                      key={device.id}
                      className={clsx(classes.deviceCard, isSelected && classes.deviceCardSelected)}
                      onClick={() => setSelectedDevice(device)}
                    >
                      <div className={clsx(classes.deviceIcon, isSelected && classes.deviceIconSelected)}>
                        <PhoneAndroidIcon />
                        <Tooltip title={isOnline ? "Conectado" : "Desconectado"}>
                          <span
                            className={clsx(classes.statusDot, isOnline ? classes.dotOnline : classes.dotOffline)}
                          />
                        </Tooltip>
                      </div>
                      <Box minWidth={0} flex={1}>
                        <div className={classes.deviceName}>{device.name}</div>
                        <div className={classes.deviceMeta}>
                          <span>{fmtNum(device.totalMessages)} msgs</span>
                          {device.deletedMessages > 0 && (
                            <span className={classes.deviceDeleted}>
                              <BlockIcon style={{ fontSize: 11 }} />
                              {device.deletedMessages}
                            </span>
                          )}
                        </div>
                      </Box>
                    </ButtonBase>
                  );
                })}
          </div>
        </div>
      </Paper>

      {/* 4. Área de investigação: conversas + timeline */}
      <Paper className={classes.workspace}>
        {/* Painel Esquerdo: Lista de Conversas do Celular */}
        <div className={classes.chatsPanel}>
          <div className={classes.panelHead}>
            <div className={classes.panelTitleRow}>
              <span className={classes.panelTitle}>
                Conversas{selectedDevice?.name ? ` · ${selectedDevice.name}` : ""}
              </span>
              {!loadingChats && <span className={classes.countBadge}>{chats.length}</span>}
            </div>
            <div className={classes.compactSearch}>
              <SearchIcon />
              <InputBase
                className={classes.compactInput}
                placeholder="Buscar no aparelho selecionado..."
                value={chatSearchInput}
                onChange={handleChatSearchChange}
                inputProps={{ "aria-label": "Buscar no aparelho selecionado" }}
              />
              {chatSearchInput && (
                <IconButton size="small" onClick={() => { setChatSearchInput(""); setChatSearch(""); }}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              )}
            </div>
          </div>

          <div className={classes.chatsList}>
            {loadingChats ? (
              <ListSkeleton />
            ) : chats.length === 0 ? (
              <EmptyState
                icon={<ChatIcon />}
                tone="neutral"
                title="Nenhuma conversa"
                description="Nenhuma conversa encontrada neste aparelho."
                action={
                  chatSearchInput && (
                    <Button size="small" color="primary" onClick={() => { setChatSearchInput(""); setChatSearch(""); }}>
                      Limpar busca
                    </Button>
                  )
                }
              />
            ) : (
              chats.map((chat) => {
                const isSelected = selectedChat?.ticketId === chat.ticketId;
                return (
                  <div
                    key={chat.ticketId}
                    className={clsx(classes.chatItem, isSelected && classes.chatItemSelected)}
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

                      {chat.deletedMessages > 0 && (
                        <span className={classes.miniPill}>
                          <BlockIcon />
                          {chat.deletedMessages} apagadas
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Painel Direito: Timeline de Mensagens & Filtros */}
        <div className={classes.timelinePanel}>
          {/* Cabeçalho da conversa em análise */}
          {selectedChat && (
            <div className={classes.convHeader}>
              <Avatar className={classes.chatAvatar} src={selectedChat.contact?.profilePicUrl}>
                {getContactDisplayName(selectedChat.contact).charAt(0).toUpperCase()}
              </Avatar>
              <Box minWidth={0}>
                <div className={classes.convName}>{getContactDisplayName(selectedChat.contact)}</div>
                <div className={classes.convSub}>
                  {selectedChat.contact?.isGroup
                    ? "Grupo WhatsApp"
                    : formatPhoneNumber(selectedChat.contact?.number) || "Conversa individual"}
                  {selectedDevice?.name ? ` · via ${selectedDevice.name}` : ""}
                </div>
              </Box>
              <div className={classes.convPills}>
                {selectedChat.totalMessages != null && (
                  <StatusPill tone="primary" dot={false}>
                    {fmtNum(selectedChat.totalMessages)} msgs
                  </StatusPill>
                )}
                {selectedChat.deletedMessages > 0 && (
                  <StatusPill tone="error">{fmtNum(selectedChat.deletedMessages)} apagadas</StatusPill>
                )}
              </div>
            </div>
          )}

          {/* Barra de Filtros e Busca Rápida */}
          <div className={classes.filterToolbar}>
            <TextField
              size="small"
              placeholder="Buscar termo nesta conversa (ex: PIX, acordo)..."
              variant="outlined"
              value={searchTermInput}
              onChange={handleSearchTermChange}
              className={classes.filterSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchTermInput && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => { setSearchTermInput(""); setSearchTerm(""); }}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              size="small"
              type="date"
              label="De"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={classes.filterItem}
            />

            <TextField
              size="small"
              type="date"
              label="Até"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={classes.filterItem}
            />

            <FormControl size="small" variant="outlined" className={classes.filterSelect}>
              <InputLabel>Tipo de mídia</InputLabel>
              <Select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value)}
                label="Tipo de mídia"
              >
                <MenuItem value="all"><ChatIcon className={classes.menuIcon} />Todas as mensagens</MenuItem>
                <MenuItem value="audio"><AudioIcon className={classes.menuIcon} />Áudios & voz</MenuItem>
                <MenuItem value="image"><ImageIcon className={classes.menuIcon} />Fotos & imagens</MenuItem>
                <MenuItem value="document"><DocumentIcon className={classes.menuIcon} />Documentos & boletos</MenuItem>
                <MenuItem value="video"><VideoIcon className={classes.menuIcon} />Vídeos</MenuItem>
                <MenuItem value="vcard"><VcardIcon className={classes.menuIcon} />Contatos (vCard)</MenuItem>
              </Select>
            </FormControl>

            <Chip
              clickable
              icon={<BlockIcon />}
              label="Apenas apagadas"
              onClick={() => setOnlyDeleted(!onlyDeleted)}
              onDelete={onlyDeleted ? () => setOnlyDeleted(false) : undefined}
              className={clsx(classes.deletedChip, onlyDeleted && classes.deletedChipActive)}
              aria-pressed={onlyDeleted}
            />

            {hasActiveFilters && (
              <Button
                size="small"
                startIcon={<ClearIcon />}
                onClick={clearFilters}
                className={classes.clearBtn}
              >
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Área de Mensagens (Timeline) */}
          <div className={classes.messagesScrollArea}>
            {loadingMessages ? (
              <TimelineSkeleton className={classes.skeletonBubble} />
            ) : !selectedChat && !searchTerm ? (
              <div className={classes.centerState}>
                <Paper className={classes.stateCard}>
                  <EmptyState
                    icon={<SecurityIcon />}
                    title="Selecione uma conversa para auditar"
                    description="Use a busca global acima para localizar qualquer número em todos os aparelhos."
                  />
                </Paper>
              </div>
            ) : messages.length === 0 ? (
              <div className={classes.centerState}>
                <Paper className={classes.stateCard}>
                  <EmptyState
                    icon={<FindInPageIcon />}
                    tone="neutral"
                    title="Nenhum registro encontrado"
                    description="Nenhuma mensagem corresponde aos filtros selecionados."
                    action={
                      hasActiveFilters && (
                        <Button size="small" variant="outlined" color="primary" onClick={clearFilters}>
                          Limpar filtros
                        </Button>
                      )
                    }
                  />
                </Paper>
              </div>
            ) : (
              messages.map((message) => {
                const isOp = message.fromMe;
                const isGroup = selectedChat?.contact?.isGroup;
                const senderName = isOp
                  ? (selectedDevice?.name || "Operador")
                  : (message.contact ? getContactDisplayName(message.contact) : "Participante");
                const senderColor = isOp ? undefined : getParticipantColor(senderName);
                const mediaKind = getMediaKind(message);
                const MediaIcon = mediaKind ? MEDIA_ICONS[mediaKind] : null;

                return (
                  <div
                    key={message.id}
                    className={clsx(
                      classes.messageBubble,
                      isOp ? classes.messageOperator : classes.messageClient,
                      message.isDeleted && classes.messageDeleted
                    )}
                  >
                    {/* Header do Remetente em Grupo */}
                    {isGroup && (
                      <Typography
                        variant="caption"
                        className={classes.senderName}
                        color={isOp ? "primary" : undefined}
                        style={senderColor ? { color: senderColor } : undefined}
                      >
                        {senderName}
                      </Typography>
                    )}

                    {/* Banner de Mensagem Apagada */}
                    {message.isDeleted && (
                      <div className={classes.deletedBanner}>
                        <BlockIcon style={{ fontSize: 12 }} />
                        <span>APAGADA NO WHATSAPP</span>
                      </div>
                    )}

                    {/* Mensagem Respondida (Quoted) */}
                    {message.quotedMsg && (
                      <div className={classes.quotedMsgBox}>
                        <Typography variant="caption" className={classes.quotedAuthor}>
                          {message.quotedMsg.fromMe
                            ? (selectedDevice?.name || "Operador")
                            : (message.quotedMsg.contact ? getContactDisplayName(message.quotedMsg.contact) : "Participante")}
                        </Typography>
                        <Typography variant="caption" style={{ whiteSpace: "pre-wrap", display: "block" }}>
                          {message.quotedMsg.body}
                        </Typography>
                      </div>
                    )}

                    {/* Mídia: Foto / Imagem */}
                    {message.mediaUrl && (message.mediaType === "image" || message.mediaUrl.match(/\.(jpeg|jpg|gif|png)$/i)) && (
                      <div>
                        <img
                          src={message.mediaUrl}
                          alt="Arquivo"
                          className={classes.mediaPreview}
                          onClick={() => window.open(message.mediaUrl, "_blank")}
                        />
                      </div>
                    )}

                    {/* Mídia: Áudio */}
                    {message.mediaUrl && (message.mediaType?.includes("audio") || message.mediaUrl.match(/\.(ogg|mp3|wav|m4a)$/i)) && (
                      <div style={{ margin: "4px 0" }}>
                        <audio controls style={{ width: "100%", maxWidth: 280, height: 38 }}>
                          <source src={message.mediaUrl} type="audio/ogg" />
                          <source src={message.mediaUrl} type="audio/mp4" />
                          <source src={message.mediaUrl} type="audio/mpeg" />
                          <source src={message.mediaUrl} type="audio/wav" />
                          Seu navegador não suporta áudio.
                        </audio>
                      </div>
                    )}

                    {/* Mídia: Documento / Boleto / PDF */}
                    {message.mediaUrl && (message.mediaType?.includes("document") || message.mediaUrl.match(/\.(pdf|doc|docx|xlsx|zip)$/i)) && (
                      <div style={{ margin: "6px 0" }}>
                        <Button
                          variant="outlined"
                          size="small"
                          color="primary"
                          startIcon={<DocumentIcon />}
                          onClick={() => window.open(message.mediaUrl, "_blank")}
                          className={classes.docButton}
                        >
                          {message.body && message.body !== message.mediaUrl ? message.body : "Abrir Documento"}
                        </Button>
                      </div>
                    )}

                    {/* Texto Principal */}
                    {(!message.mediaUrl || message.mediaType === "chat" || (message.body && !message.body.includes(".pdf") && !message.body.includes(".ogg"))) && (
                      <Typography variant="body2" style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                        {message.body}
                      </Typography>
                    )}

                    {/* Rodapé: direção, mídia, horário & status */}
                    <div className={classes.metaFooter}>
                      <span className={classes.directionTag} style={{ color: "inherit" }}>
                        {isOp ? "Enviada" : "Recebida"}
                      </span>
                      {MediaIcon && (
                        <Tooltip title={mediaKind}>
                          <MediaIcon />
                        </Tooltip>
                      )}
                      <Tooltip
                        title={message.createdAt ? format(parseISO(message.createdAt), "dd/MM/yyyy HH:mm:ss") : ""}
                      >
                        <span>
                          {message.createdAt ? format(parseISO(message.createdAt), "dd/MM HH:mm") : ""}
                        </span>
                      </Tooltip>
                      {isOp && (
                        <span style={{ display: "inline-flex" }}>
                          {message.ack === 3 ? (
                            <DoneAllIcon className={classes.ackRead} />
                          ) : message.ack === 2 ? (
                            <DoneAllIcon />
                          ) : (
                            <DoneIcon />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </Paper>

      {/* Modal de Exportação */}
      <ExportAuditModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        selectedDevice={selectedDevice}
        devices={devices}
      />
    </div>
  );
};

export default Audit;
