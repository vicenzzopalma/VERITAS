import React, { useState, useEffect, useRef, useContext, useMemo, useCallback } from "react";
import {
  makeStyles,
  useTheme,
  useMediaQuery,
  Collapse,
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
  Popper,
  ClickAwayListener,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
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
  Smartphone as PhoneAndroidIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  CropFree as QrCodeIcon,
  Person as PersonIcon,
  SyncAlt as SyncAltIcon,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  OpenInNew as OpenInNewIcon,
} from "@material-ui/icons";
import { format, parseISO } from "date-fns";
import { useHistory, useLocation } from "react-router-dom";
import PictureAsPdfIcon from "@material-ui/icons/PictureAsPdf";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";
import ExportAuditModal from "../../components/ExportAuditModal";
import MediaViewerModal from "../../components/MediaViewerModal";
import ContactDrawer from "../../components/ContactDrawer";
import { getContactDisplayName, formatPhoneNumber, isPendingResolution, PENDING_TOOLTIP } from "../../helpers/contactHelper";
import whatsBackground from "../../assets/wa-background.png";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 48px)",
    [theme.breakpoints.down("sm")]: {
      height: "calc(100dvh - 56px)",
      maxHeight: "calc(100dvh - 56px)",
    },
    backgroundColor: theme.palette.background.default,
    overflow: "hidden",
  },
  headerBar: {
    backgroundColor: theme.palette.background.paper,
    borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
    padding: theme.spacing(0.45, 1.5),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(0.7),
    zIndex: 10,
    [theme.breakpoints.down("sm")]: {
      flexWrap: "wrap",
      padding: theme.spacing(0.6, 1),
      gap: theme.spacing(0.4),
    },
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.7),
    fontWeight: 600,
    fontSize: "1rem",
    color: theme.palette.text.primary,
    flexShrink: 0,
  },
  headerIcon: {
    color: theme.palette.primary.main,
    fontSize: 21,
  },
  globalSearchContainer: {
    position: "relative",
    flexGrow: 1,
    maxWidth: 420,
    [theme.breakpoints.down("sm")]: {
      order: 3,
      width: "100%",
      maxWidth: "100%",
      marginTop: 2,
    },
  },
  globalSearchField: {
    width: "100%",
    "& .MuiOutlinedInput-root": {
      borderRadius: 30,
      backgroundColor: theme.palette.background.default,
      fontSize: "0.85rem",
      paddingRight: 6,
    },
    "& .MuiOutlinedInput-input": {
      padding: "6px 10px",
    },
  },
  popperPaper: {
    width: 460,
    maxHeight: 380,
    overflowY: "auto",
    borderRadius: 8,
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
    border: "1px solid rgba(0, 0, 0, 0.12)",
    zIndex: 1400,
    marginTop: 4,
    [theme.breakpoints.down("sm")]: {
      width: "calc(100vw - 20px) !important",
      maxWidth: "calc(100vw - 20px) !important",
      position: "relative",
    },
  },
  globalResultItem: {
    padding: theme.spacing(1, 1.5),
    borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
    cursor: "pointer",
    transition: "background 0.15s ease",
    "&:hover": {
      backgroundColor: "rgba(2, 132, 199, 0.08)",
    },
  },
  deviceBadge: {
    backgroundColor: "#e0f2fe",
    color: "#0369a1",
    fontWeight: 700,
    fontSize: "0.72rem",
    padding: "2px 8px",
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  headerStats: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.2),
    flexShrink: 0,
    [theme.breakpoints.down("sm")]: {
      gap: theme.spacing(0.5),
      "& $statBadge": {
        padding: "2px 5px",
        fontSize: "0.68rem",
      },
    },
  },
  statBadge: {
    backgroundColor: theme.palette.background.default,
    border: "1px solid rgba(0, 0, 0, 0.08)",
    borderRadius: 6,
    padding: "2px 8px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: "0.74rem",
    color: theme.palette.text.secondary,
  },
  sectorFilter: {
    backgroundColor: theme.palette.background.paper,
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
    padding: theme.spacing(0.4, 1.5),
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.8),
    overflowX: "auto",
    whiteSpace: "nowrap",
    WebkitOverflowScrolling: "touch",
    flexShrink: 0,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(0.3, 0.8),
      gap: theme.spacing(0.5),
    },
    "&::-webkit-scrollbar": {
      height: 3,
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "#cbd5e1",
      borderRadius: 2,
    },
  },
  deviceRibbon: {
    backgroundColor: theme.palette.background.paper,
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
    padding: theme.spacing(0.45, 1.5),
    display: "flex",
    gap: theme.spacing(0.7),
    overflowX: "auto",
    whiteSpace: "nowrap",
    WebkitOverflowScrolling: "touch",
    flexShrink: 0,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(0.4, 0.8),
      gap: theme.spacing(0.5),
    },
    "&::-webkit-scrollbar": {
      height: 4,
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "#cbd5e1",
      borderRadius: 3,
    },
  },
  deviceCard: {
    minWidth: 150,
    maxWidth: 190,
    flexShrink: 0,
    border: "1px solid rgba(0, 0, 0, 0.08)",
    borderRadius: 6,
    transition: "all 0.2s ease-in-out",
    cursor: "pointer",
    backgroundColor: theme.palette.background.paper,
    [theme.breakpoints.down("sm")]: {
      minWidth: 130,
      maxWidth: 155,
    },
    "&:hover": {
      borderColor: theme.palette.primary.main,
      boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)",
    },
  },
  deviceCardSelected: {
    borderColor: `${theme.palette.primary.main} !important`,
    backgroundColor: "rgba(2, 132, 199, 0.06) !important",
    boxShadow: `0 0 0 1px ${theme.palette.primary.main} !important`,
  },
  deviceCardContent: {
    padding: "6px 10px !important",
    width: "100%",
    boxSizing: "border-box",
    "& svg": {
      flexShrink: 0,
    },
  },
  deviceName: {
    minWidth: 0,
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "block",
    lineHeight: 1.25,
    paddingRight: 6,
  },
  mainContent: {
    display: "flex",
    flexGrow: 1,
    minHeight: 0,
    height: "100%",
    overflow: "hidden",
  },
  // Painel Esquerdo: Lista de Conversas
  chatsPanel: {
    width: 320,
    minWidth: 280,
    borderRight: "1px solid rgba(0, 0, 0, 0.08)",
    backgroundColor: theme.palette.background.paper,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    [theme.breakpoints.down("sm")]: {
      width: "100%",
      minWidth: "100%",
      borderRight: "none",
    },
  },
  chatSearchBox: {
    padding: theme.spacing(0.65),
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
    backgroundColor: theme.palette.background.default,
  },
  chatsList: {
    flexGrow: 1,
    overflowY: "auto",
    "&::-webkit-scrollbar": {
      width: 5,
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "#cbd5e1",
      borderRadius: 3,
    },
  },
  chatItem: {
    padding: theme.spacing(0.85, 1.1),
    borderBottom: "1px solid rgba(0, 0, 0, 0.04)",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.85),
    cursor: "pointer",
    transition: "background 0.15s ease",
    "&:hover": {
      backgroundColor: "rgba(0, 0, 0, 0.02)",
    },
  },
  chatItemSelected: {
    backgroundColor: "rgba(2, 132, 199, 0.08) !important",
    borderLeft: `4px solid ${theme.palette.primary.main}`,
  },
  chatAvatar: {
    backgroundColor: theme.palette.primary.main,
    width: 36,
    height: 36,
    fontSize: "0.88rem",
    fontWeight: 600,
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    "&:hover": {
      transform: "scale(1.08)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    },
  },
  chatInfo: {
    flexGrow: 1,
    overflow: "hidden",
  },
  chatName: {
    fontWeight: 600,
    fontSize: "0.84rem",
    color: theme.palette.text.primary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  chatLastMsg: {
    fontSize: "0.74rem",
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginTop: 2,
  },
  chatDate: {
    fontSize: "0.7rem",
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap",
  },
  // Painel Direito: Timeline de Mensagens & Filtros
  timelinePanel: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: theme.palette.type === "dark" ? "#0b141a" : "#efeae2",
    backgroundImage: theme.palette.type === "dark"
      ? `linear-gradient(rgba(11, 20, 26, 0.88), rgba(11, 20, 26, 0.88)), url(${whatsBackground})`
      : `url(${whatsBackground})`,
    backgroundRepeat: "repeat",
    overflow: "hidden",
    [theme.breakpoints.down("sm")]: {
      width: "100%",
      minWidth: "100%",
    },
  },
  activeChatHeader: {
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(0.75, 1.4),
    borderBottom: `1px solid ${theme.palette.type === "dark" ? "rgba(148, 163, 184, 0.18)" : "rgba(0, 0, 0, 0.08)"}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 6,
    boxShadow: theme.palette.type === "dark" ? "0 1px 2px rgba(0,0,0,0.28)" : "0 1px 2px rgba(0,0,0,0.03)",
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(0.6, 1),
    },
  },
  activeChatAvatar: {
    backgroundColor: theme.palette.primary.main,
    width: 38,
    height: 38,
    fontSize: "0.95rem",
    fontWeight: 700,
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    "&:hover": {
      transform: "scale(1.08)",
      boxShadow: "0 3px 10px rgba(0,0,0,0.2)",
    },
  },
  filterToolbar: {
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(0.45, 1.1),
    borderBottom: `1px solid ${theme.palette.type === "dark" ? "rgba(148, 163, 184, 0.18)" : "rgba(0, 0, 0, 0.08)"}`,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.7),
    flexWrap: "wrap",
    boxShadow: theme.palette.type === "dark" ? "0 1px 3px rgba(0,0,0,0.24)" : "0 1px 3px rgba(0,0,0,0.04)",
    zIndex: 5,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(0.5, 0.8),
      gap: theme.spacing(0.4),
    },
  },
  mobileFilterRow: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    gap: 6,
  },
  filterItem: {
    minWidth: 116,
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
    padding: theme.spacing(2, 2.5),
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1, 0.8),
      gap: theme.spacing(0.7),
    },
    "&::-webkit-scrollbar": {
      width: 6,
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: theme.palette.type === "dark" ? "rgba(148,163,184,0.28)" : "rgba(0,0,0,0.2)",
      borderRadius: 3,
    },
  },
  dailyTimestampContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    margin: "12px 0 8px 0",
    width: "100%",
  },
  dailyTimestampBadge: {
    backgroundColor: "rgba(17, 27, 33, 0.88)",
    color: "#e9edef",
    padding: "4px 12px",
    borderRadius: 8,
    fontSize: "0.75rem",
    fontWeight: 600,
    boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
    display: "inline-block",
    textAlign: "center",
    letterSpacing: "0.3px",
    userSelect: "none",
  },
  messageBubble: {
    maxWidth: "68%",
    minWidth: 140,
    padding: "7px 11px 5px 11px",
    borderRadius: 7.5,
    boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
    position: "relative",
    wordBreak: "break-word",
    fontSize: "0.88rem",
    [theme.breakpoints.down("sm")]: {
      maxWidth: "88%",
      fontSize: "0.84rem",
      padding: "6px 9px 4px 9px",
    },
  },
  messageOperator: {
    alignSelf: "flex-end",
    backgroundColor: theme.palette.type === "dark" ? "#005c4b" : "#dcf8c6",
    color: theme.palette.type === "dark" ? "#e9edef" : "#111827",
    borderTopRightRadius: 0,
  },
  messageClient: {
    alignSelf: "flex-start",
    backgroundColor: theme.palette.type === "dark" ? "#202c33" : "#ffffff",
    color: theme.palette.type === "dark" ? "#e9edef" : "#111827",
    borderTopLeftRadius: 0,
  },
  deletedBanner: {
    backgroundColor: "#fef2f2",
    border: "1px solid #f87171",
    color: "#b91c1c",
    padding: "3px 7px",
    borderRadius: 5,
    fontSize: "0.74rem",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginBottom: 5,
  },
  quotedMsgBox: {
    backgroundColor: theme.palette.type === "dark" ? "rgba(148,163,184,0.12)" : "rgba(0,0,0,0.05)",
    borderLeft: "3px solid #0284c7",
    borderRadius: 4,
    padding: "3px 7px",
    marginBottom: 5,
    fontSize: "0.78rem",
    color: theme.palette.type === "dark" ? "#cbd5db" : "#475569",
  },
  mediaPreview: {
    maxWidth: "100%",
    maxHeight: 260,
    borderRadius: 5,
    cursor: "pointer",
    marginTop: 4,
    marginBottom: 4,
    objectFit: "cover",
  },
  pdfCard: {
    backgroundColor: theme.palette.type === "dark" ? "#1e293b" : "#f8fafc",
    border: `1px solid ${theme.palette.type === "dark" ? "#334155" : "#cbd5e1"}`,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 6,
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
    maxWidth: 320,
    width: "100%",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    "&:hover": {
      borderColor: "#0284c7",
      boxShadow: "0 4px 12px rgba(2, 132, 199, 0.15)",
    },
  },
  pdfCardHeader: {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#ffffff",
    borderBottom: `1px solid ${theme.palette.type === "dark" ? "#334155" : "#e2e8f0"}`,
  },
  docCardActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    backgroundColor: theme.palette.type === "dark" ? "#0f172a" : "#f1f5f9",
    borderTop: `1px solid ${theme.palette.type === "dark" ? "#334155" : "#e2e8f0"}`,
  },
  docActionBtn: {
    textTransform: "none",
    fontSize: "0.72rem",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 6,
  },
  docActionBtnSec: {
    textTransform: "none",
    fontSize: "0.72rem",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 6,
    color: "#0284c7",
    borderColor: "#0284c7",
  },
  pdfPreviewWrapper: {
    position: "relative",
    height: 160,
    width: "100%",
    backgroundColor: "#475569",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pdfMiniIframe: {
    width: "100%",
    height: "100%",
    border: "none",
    pointerEvents: "none",
  },
  pdfOverlayHover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.2s ease",
    "&:hover": {
      backgroundColor: "rgba(0,0,0,0.38)",
    },
  },
  metaFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 3,
    fontSize: "0.7rem",
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

const resolveMediaCategory = (msg) => {
  if (!msg || !msg.mediaUrl) return "none";
  const url = (msg.mediaUrl || "").toLowerCase();
  const type = (msg.mediaType || "").toLowerCase();
  const body = (msg.body || "").toLowerCase();

  if (
    type === "image" ||
    url.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) ||
    body.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) ||
    url.includes("pps.whatsapp.net")
  ) {
    return "image";
  }

  if (
    type.includes("audio") ||
    type === "voice" ||
    type === "ptt" ||
    url.match(/\.(ogg|mp3|wav|m4a|aac)($|\?)/i)
  ) {
    return "audio";
  }

  if (
    type.includes("video") ||
    url.match(/\.(mp4|webm|mkv|mov)($|\?)/i)
  ) {
    return "video";
  }

  return "document";
};

const getCleanMediaName = (msg) => {
  if (!msg) return "Arquivo";
  let name = msg.body && msg.body !== msg.mediaUrl ? msg.body : msg.mediaUrl ? msg.mediaUrl.split("/").pop() : "Arquivo";
  if (name.startsWith(".")) {
    name = name.replace(/^\.+/, "");
  }
  if (name.toLowerCase().includes("comprovante")) {
    if (name.length > 35 && (name.includes("-") || name.includes("_"))) {
      return "Comprovante de Pagamento (Anexo)";
    }
  }
  return name;
};

const OFFICIAL_SECTORS = [
  "Junior",
  "Senior",
  "Pesquisa",
  "Comercial",
  "Juridico",
  "PA FIXA 1",
  "PA FIXA 2",
];

const getSectorColor = (sector) => {
  switch (sector) {
    case "Senior":
      return "#7c3aed";
    case "Junior":
      return "#0284c7";
    case "Pesquisa":
      return "#059669";
    case "Comercial":
      return "#d97706";
    case "Juridico":
      return "#dc2626";
    case "PA FIXA 1":
      return "#4b5563";
    case "PA FIXA 2":
      return "#374151";
    case "Arquivados":
      return "#64748b";
    default:
      return "#6366f1";
  }
};

const Audit = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileFiltersExpanded, setMobileFiltersExpanded] = useState(false);
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const location = useLocation();

  const isManagerHigh = user?.profile === "whatsapp_control_high";
  const canAccessAudit = user?.profile === "admin" || isManagerHigh;
  const isRestrictedUser = user?.profile !== "admin";
  const allowedSectors = useMemo(() => {
    if (!isRestrictedUser) return null;
    const raw = isManagerHigh
      ? (Array.isArray(user?.connectionSectors) && user.connectionSectors.length > 0
        ? user.connectionSectors
        : ["PA FIXA 1", "PA FIXA 2"])
      : [];
    const expanded = [];
    raw.forEach((s) => {
      if (s === "PA FIXA") {
        expanded.push("PA FIXA 1", "PA FIXA 2");
      } else {
        expanded.push(s);
      }
    });
    return Array.from(new Set(expanded));
  }, [isRestrictedUser, isManagerHigh, user?.connectionSectors]);

  useEffect(() => {
    if (user && !canAccessAudit) {
      if (user.profile === "whatsapp_control" || user.profile === "whatsapp_control_high") {
        history.push("/whatsapp-control");
      } else if (user.profile === "operator") {
        history.push("/live");
      } else {
        history.push("/tickets");
      }
    }
  }, [user, canAccessAudit, history]);

  if (user && !canAccessAudit) {
    return null;
  }

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
  const initialDeviceLoadedRef = useRef(false);

  // Setor Selecionado (Sincronizado entre Conexões, CRM e Auditoria via veritas:selectedSector)
  const [selectedSector, setSelectedSectorState] = useState(() => {
    try {
      const saved = localStorage.getItem("veritas:selectedSector");
      return saved || "TODOS";
    } catch (e) {
      return "TODOS";
    }
  });

  const setSelectedSector = useCallback((sector) => {
    setSelectedSectorState(sector);
    try {
      localStorage.setItem("veritas:selectedSector", sector);
    } catch (e) {}
  }, []);

  useEffect(() => {
    const syncSavedSector = () => {
      try {
        const saved = localStorage.getItem("veritas:selectedSector");
        if (saved && saved !== selectedSector) {
          if (!allowedSectors || allowedSectors.includes(saved) || saved === "TODOS") {
            setSelectedSectorState(saved);
          }
        }
      } catch (e) {}
    };
    window.addEventListener("focus", syncSavedSector);
    window.addEventListener("storage", syncSavedSector);
    return () => {
      window.removeEventListener("focus", syncSavedSector);
      window.removeEventListener("storage", syncSavedSector);
    };
  }, [allowedSectors, selectedSector]);

  const sectorsList = useMemo(() => {
    const defaultOrder = OFFICIAL_SECTORS;
    const presentSectors = new Set();
    devices.forEach((d) => {
      if (d.sector) presentSectors.add(d.sector);
    });
    const sectors = Array.from(new Set([...defaultOrder, ...presentSectors]));
    return allowedSectors ? sectors.filter((s) => allowedSectors.includes(s)) : sectors;
  }, [devices, allowedSectors]);

  const sectorCounts = useMemo(() => {
    const visibleDevices = allowedSectors
      ? devices.filter((d) => allowedSectors.includes(d.sector || "Junior"))
      : devices;
    const counts = { TODOS: visibleDevices.length };
    visibleDevices.forEach((d) => {
      const sec = d.sector || "Junior";
      counts[sec] = (counts[sec] || 0) + 1;
    });
    return counts;
  }, [devices, allowedSectors]);

  const handleSelectDevice = (device) => {
    if (!device) return;
    setSelectedDevice(device);
    if (device.id) {
      history.replace(`/audit?whatsappId=${device.id}`);
    }
  };

  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [syncingTunnels, setSyncingTunnels] = useState(false);

  const handleSyncAllTunnels = async () => {
    setSyncingTunnels(true);
    try {
      const { data } = await api.post("/whatsapp-sync-all-audit");
      toast.success(data.message || "Varredura de mensagens dos túneis concluída!");
      await fetchDevices();
      await fetchChats();
      await fetchMessages();
    } catch (err) {
      toastError(err);
    } finally {
      setSyncingTunnels(false);
    }
  };
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatsPage, setChatsPage] = useState(1);
  const [hasMoreChats, setHasMoreChats] = useState(false);
  const [loadingMoreChats, setLoadingMoreChats] = useState(false);

  // Estados de paginação e histórico completo de mensagens
  const [messagesTotalCount, setMessagesTotalCount] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [messagesPage, setMessagesPage] = useState(1);
  const isAppendingOlderRef = useRef(false);

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

  // Modal Visualizador de Mídias (Popup Lightbox)
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [activeMedia, setActiveMedia] = useState({ url: "", type: "", title: "" });

  const handleOpenMediaModal = (url, type, title) => {
    setActiveMedia({ url, type, title });
    setMediaModalOpen(true);
  };

  const handleCloseMediaModal = () => {
    setMediaModalOpen(false);
    setActiveMedia({ url: "", type: "", title: "" });
  };

  // Drawer Lateral de Perfil do Contato (Estilo Digisac)
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);

  // Filtro dinâmico da barra de smartphones por setor e por termo de busca
  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const devSector = device.sector || "Junior";
      if (allowedSectors && !allowedSectors.includes(devSector)) {
        return false;
      }
      if (selectedSector !== "TODOS" && devSector !== selectedSector) {
        return false;
      }
      if (!globalSearchInput || !globalSearchInput.trim()) return true;
      const term = globalSearchInput.trim().toLowerCase();
      const nameMatch = device.name?.toLowerCase().includes(term);
      const idMatch = String(device.id).includes(term);
      return nameMatch || idMatch;
    });
  }, [devices, allowedSectors, selectedSector, globalSearchInput]);

  // Se o aparelho selecionado não pertencer ao setor ativo, auto-seleciona o primeiro do setor
  useEffect(() => {
    if (filteredDevices.length > 0) {
      const stillInList = filteredDevices.some((d) => d.id === selectedDevice?.id);
      if (!stillInList) {
        handleSelectDevice(filteredDevices[0]);
      }
    }
  }, [filteredDevices, selectedDevice]);

  // Auto-seleciona o smartphone se a busca filtrar exatamente 1 aparelho correspondente
  useEffect(() => {
    if (globalSearchInput && globalSearchInput.trim()) {
      const term = globalSearchInput.trim().toLowerCase();
      const matched = devices.filter(
        (d) => d.name?.toLowerCase().includes(term) || String(d.id).includes(term)
      );
      if (matched.length === 1 && selectedDevice?.id !== matched[0].id) {
        handleSelectDevice(matched[0]);
      }
    }
  }, [globalSearchInput, devices]);

  const messagesContainerRef = useRef(null);
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

    const targetChat = {
      ticketId: result.ticketId,
      whatsappId: result.whatsappId,
      contact: result.contact,
      lastMessage: result.lastMessage,
      totalMessages: result.totalMessages,
      deletedMessages: result.deletedMessages,
      updatedAt: result.updatedAt || new Date().toISOString(),
    };

    handleSelectDevice(targetDevice);
    setSelectedChat(targetChat);
    setChats((prev) => [targetChat, ...prev.filter((c) => c.ticketId !== targetChat.ticketId)]);
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
  const fetchDevices = async (isInitial = false) => {
    if (isInitial) setLoadingDevices(true);
    try {
      const { data } = await api.get("/audit/devices");
      setDevices(data);
      if (data.length > 0) {
        if (!initialDeviceLoadedRef.current) {
          initialDeviceLoadedRef.current = true;
          const queryParams = new URLSearchParams(location.search);
          const targetWaId = queryParams.get("whatsappId");
          if (targetWaId) {
            const found = data.find((d) => String(d.id) === String(targetWaId));
            if (found) {
              setSelectedDevice(found);
              return;
            }
          }
          setSelectedDevice(data[0]);
        } else {
          // Em sincronizações em background (polling de 45s / websocket), preserva o aparelho que o operador está auditando
          setSelectedDevice((prev) => {
            if (!prev) return data[0];
            const updated = data.find((d) => d.id === prev.id);
            return updated || prev;
          });
        }
      }
    } catch (err) {
      toastError(err);
    } finally {
      if (isInitial) setLoadingDevices(false);
    }
  };

  // Sincroniza aparelho selecionado caso ocorra navegação externa com query param whatsappId
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const targetWaId = queryParams.get("whatsappId");
    if (targetWaId && devices.length > 0) {
      const found = devices.find((d) => String(d.id) === String(targetWaId));
      if (found) {
        setSelectedDevice((prev) => (prev?.id === found.id ? prev : found));
      }
    }
  }, [location.search]);

  useEffect(() => {
    fetchDevices(true);

    // 1. Polling de sincronização a cada 45s para garantir status real (silencioso, sem sobrecarregar rede)
    const interval = setInterval(() => {
      fetchDevices(false);
    }, 45000);

    // 2. Conexão WebSocket em tempo real para atualizações instantâneas
    const socket = openSocket();

    socket.on("whatsapp", (data) => {
      if (data.action === "update" && data.whatsapp) {
        setDevices((prev) => {
          const index = prev.findIndex((d) => d.id === data.whatsapp.id);
          if (index !== -1) {
            const copy = [...prev];
            copy[index] = { ...copy[index], ...data.whatsapp };
            return copy;
          }
          return prev;
        });
      }
      if (data.action === "delete") {
        setDevices((prev) => prev.filter((d) => d.id !== data.whatsappId));
      }
    });

    socket.on("whatsappSession", (data) => {
      if (data.action === "update" && data.session) {
        setDevices((prev) => {
          const index = prev.findIndex((d) => d.id === data.session.id);
          if (index !== -1) {
            const copy = [...prev];
            copy[index] = {
              ...copy[index],
              status: data.session.status,
              qrcode: data.session.qrcode,
              updatedAt: data.session.updatedAt,
            };
            return copy;
          }
          return prev;
        });
      }
    });

    socket.on("appMessage", (data) => {
      if (data.action === "create") {
        fetchDevices(false);
      }
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  // 2. Carregar conversas do aparelho selecionado com paginação
  const fetchChats = async (isInitial = false, page = 1) => {
    if (!selectedDevice) return;
    if (isInitial) setLoadingChats(true);
    else setLoadingMoreChats(true);

    try {
      const { data } = await api.get(`/audit/devices/${selectedDevice.id}/chats`, {
        params: { search: chatSearch, pageNumber: page, limit: 50 },
      });
      const newChats = data.chats || [];
      setHasMoreChats(data.hasMore || false);
      setChatsPage(page);

      if (page === 1) {
        setSelectedChat((prevChat) => {
          // Se já está selecionada uma conversa deste aparelho, preserva ela!
          if (prevChat && String(prevChat.whatsappId) === String(selectedDevice.id)) {
            const currentStillExists = newChats.find((c) => String(c.ticketId) === String(prevChat.ticketId));
            if (!currentStillExists) {
              setChats([prevChat, ...newChats]);
              return prevChat;
            }
            setChats(newChats);
            return currentStillExists;
          }

          setChats(newChats);
          return newChats.length > 0 ? newChats[0] : null;
        });

        if (newChats.length === 0) {
          setSelectedChat(null);
          setMessages([]);
        }
      } else {
        setChats((prev) => {
          const existingIds = new Set(prev.map((c) => c.ticketId));
          const filtered = newChats.filter((c) => !existingIds.has(c.ticketId));
          return [...prev, ...filtered];
        });
      }
    } catch (err) {
      toastError(err);
    } finally {
      if (isInitial) setLoadingChats(false);
      else setLoadingMoreChats(false);
    }
  };

  useEffect(() => {
    fetchChats(true, 1);
  }, [selectedDevice?.id, chatSearch]);

  // 3. Carregar mensagens da conversa ou filtros (com histórico completo)
  const fetchMessages = async (showLoading = false, page = 1, appendOlder = false, fetchAll = false) => {
    const activeWhatsappId = selectedChat?.whatsappId || selectedDevice?.id;
    if (!activeWhatsappId) return;

    if (showLoading) setLoadingMessages(true);
    if (appendOlder) setLoadingMoreMessages(true);

    try {
      const limitToUse = fetchAll ? 50000 : 2000;
      const params = {
        whatsappId: activeWhatsappId,
        ticketId: selectedChat?.ticketId,
        search: searchTerm || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        onlyDeleted: onlyDeleted || undefined,
        mediaType: mediaType !== "all" ? mediaType : undefined,
        pageNumber: page,
        limit: limitToUse,
      };

      const { data } = await api.get("/audit/messages", { params });
      const newMsgs = data.messages || [];

      setMessagesTotalCount(data.count || newMsgs.length);
      setHasMoreMessages(Boolean(data.hasMore));
      setMessagesPage(page);

      if (appendOlder) {
        isAppendingOlderRef.current = true;
        const container = messagesContainerRef.current;
        const prevScrollHeight = container ? container.scrollHeight : 0;
        const prevScrollTop = container ? container.scrollTop : 0;

        setMessages((prev) => [...newMsgs, ...prev]);

        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
          }
        }, 40);
      } else {
        isAppendingOlderRef.current = false;
        setMessages(newMsgs);
      }
    } catch (err) {
      toastError(err);
    } finally {
      if (showLoading) setLoadingMessages(false);
      if (appendOlder) setLoadingMoreMessages(false);
    }
  };

  const handleLoadOlderMessages = (loadAll = false) => {
    if (loadAll) {
      fetchMessages(false, 1, false, true);
    } else {
      fetchMessages(false, messagesPage + 1, true, false);
    }
  };

  useEffect(() => {
    if (selectedChat || searchTerm || startDate || endDate || onlyDeleted || mediaType !== "all") {
      setMessagesPage(1);
      fetchMessages(true, 1, false, false);
    }
  }, [selectedChat?.ticketId, selectedChat?.whatsappId, searchTerm, startDate, endDate, onlyDeleted, mediaType]);

  // Scroll para última mensagem ao carregar ou trocar conversa
  const scrollToBottom = (behavior = "auto") => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    if (messages && messages.length > 0) {
      if (isAppendingOlderRef.current) {
        isAppendingOlderRef.current = false;
        return;
      }
      scrollToBottom("auto");
      const timer = setTimeout(() => {
        scrollToBottom("auto");
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [messages, selectedChat?.ticketId]);

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

  return (
    <div className={classes.root}>
      {/* 1. Header Bar de Auditoria */}
      <Paper elevation={0} square className={classes.headerBar}>
        <div className={classes.headerTitle}>
          <SecurityIcon className={classes.headerIcon} />
          <Typography variant="h6" style={{ fontWeight: 600, fontSize: "1.15rem" }}>
            Auditoria
          </Typography>
        </div>

        {/* Balão de Busca Global: Localiza o número e em qual celular está */}
        <ClickAwayListener onClickAway={() => setGlobalPopperOpen(false)}>
          <div className={classes.globalSearchContainer} ref={globalSearchRef}>
            <TextField
              size="small"
              variant="outlined"
              placeholder="🔍 Buscar palavra, número ou contato..."
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
              className={classes.globalSearchField}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ color: "#0284c7" }} fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    {globalLoading ? (
                      <CircularProgress size={16} />
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
                    ) : null}
                  </InputAdornment>
                ),
              }}
            />

            <Popper
              open={Boolean(globalPopperOpen && globalSearchInput.trim().length > 0)}
              anchorEl={globalSearchRef.current}
              placement="bottom-start"
              disablePortal
              style={{ zIndex: 1400, width: "100%" }}
            >
              <Paper elevation={6} className={classes.popperPaper}>
                {globalLoading ? (
                  <Box p={2.5} textAlign="center" display="flex" flexDirection="column" alignItems="center" justifyContent="center">
                    <CircularProgress size={22} style={{ color: "#0284c7" }} />
                    <Typography variant="caption" style={{ marginTop: 8, color: "#64748b", fontWeight: 600 }}>
                      Buscando em todos os aparelhos e mensagens...
                    </Typography>
                  </Box>
                ) : globalResults.length === 0 ? (
                  <Box p={2.5} textAlign="center" color="#64748b">
                    <Typography variant="body2" style={{ fontWeight: 600 }}>
                      Nenhum resultado encontrado nos aparelhos.
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Tente outra palavra, número, contato ou nome de aparelho.
                    </Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    <Box px={2} py={1} bgcolor="#f8fafc" borderBottom="1px solid #e2e8f0">
                      <Typography variant="caption" style={{ fontWeight: 700, color: "#64748b" }}>
                        ENCONTRADO EM {globalResults.length} APARELHO(S) - CLIQUE PARA ABRIR:
                      </Typography>
                    </Box>
                    {globalResults.map((res) => (
                      <ListItem
                        key={`${res.whatsappId}-${res.ticketId}`}
                        className={classes.globalResultItem}
                        onClick={() => handleSelectGlobalResult(res)}
                      >
                        <ListItemAvatar style={{ minWidth: 44 }}>
                          <Avatar style={{ width: 34, height: 34, backgroundColor: "#0284c7", fontSize: "0.85rem" }}>
                            {getContactDisplayName(res.contact).charAt(0).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="subtitle2" style={{ fontWeight: 700, color: "#0f172a" }}>
                                {getContactDisplayName(res.contact)}
                              </Typography>
                              <span className={classes.deviceBadge}>
                                📱 {res.deviceName}
                              </span>
                            </Box>
                          }
                          secondary={
                            <Box display="flex" justifyContent="space-between" alignItems="center" mt={0.3}>
                              <Typography variant="caption" style={{ color: "#64748b", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {res.lastMessage || "Conversa iniciada"}
                              </Typography>
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <Typography variant="caption" style={{ color: "#94a3b8", fontSize: "0.7rem" }}>
                                  {res.totalMessages} msgs
                                </Typography>
                                {res.deletedMessages > 0 && (
                                  <Chip
                                    size="small"
                                    label={`🚫 ${res.deletedMessages}`}
                                    style={{
                                      height: 15,
                                      fontSize: "0.6rem",
                                      backgroundColor: "#fee2e2",
                                      color: "#991b1b",
                                      fontWeight: 700,
                                    }}
                                  />
                                )}
                                <ArrowForwardIcon style={{ fontSize: 14, color: "#0284c7" }} />
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

        <div className={classes.headerStats}>
          <div className={classes.statBadge}>
            {!isMobile && <span>Mensagens:</span>}
            <strong style={{ color: "#0284c7" }}>{totalArchived.toLocaleString("pt-BR")}</strong>
          </div>

          <div className={classes.statBadge}>
            <BlockIcon style={{ color: "#ef4444", fontSize: isMobile ? 13 : 15 }} />
            {!isMobile && <span>Apagadas:</span>}
            <strong style={{ color: "#ef4444" }}>{totalDeletedCount.toLocaleString("pt-BR")}</strong>
          </div>

          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<GetAppIcon style={{ fontSize: isMobile ? 15 : 18 }} />}
            onClick={() => setExportModalOpen(true)}
            style={{
              textTransform: "none",
              borderRadius: 6,
              padding: isMobile ? "2px 6px" : "4px 10px",
              minWidth: isMobile ? "auto" : undefined,
              fontSize: isMobile ? "0.72rem" : "0.8125rem",
              height: isMobile ? 26 : undefined,
            }}
          >
            Exportar
          </Button>

          <Tooltip title="Atualizar dados">
            <IconButton
              size="small"
              onClick={() => {
                fetchDevices();
                fetchChats();
                fetchMessages();
              }}
              style={{ padding: isMobile ? 4 : 6 }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      </Paper>

      {/* 2. Barra de Filtro de Setor Sincronizada (Audit <-> Conexões <-> CRM) */}
      <div className={classes.sectorFilter}>
        <Typography
          variant="body2"
          style={{
            fontWeight: 800,
            color: theme.palette.type === "dark" ? "#cbd5e1" : "#334155",
            marginRight: 6,
            textTransform: "uppercase",
            fontSize: "0.68rem",
            letterSpacing: "0.6px",
            flexShrink: 0,
          }}
        >
          Setor:
        </Typography>
        <Chip
          label={`TODOS (${sectorCounts.TODOS || 0})`}
          size="small"
          color={selectedSector === "TODOS" ? "primary" : "default"}
          variant={selectedSector === "TODOS" ? "default" : "outlined"}
          onClick={() => setSelectedSector("TODOS")}
          style={{
            fontWeight: 700,
            cursor: "pointer",
            borderRadius: 6,
            height: 24,
            fontSize: "0.68rem",
            flexShrink: 0,
          }}
        />
        {sectorsList.map((sector) => {
          const count = sectorCounts[sector] || 0;
          const isSelected = selectedSector === sector;
          const sectorColor = getSectorColor(sector);
          return (
            <Chip
              key={sector}
              label={`${sector} (${count})`}
              size="small"
              onClick={() => setSelectedSector(sector)}
              variant={isSelected ? "default" : "outlined"}
              style={{
                fontWeight: 700,
                cursor: "pointer",
                borderRadius: 6,
                height: 24,
                fontSize: "0.68rem",
                flexShrink: 0,
                backgroundColor: isSelected ? sectorColor : "transparent",
                borderColor: sectorColor,
                color: isSelected ? "#fff" : sectorColor,
              }}
            />
          );
        })}
      </div>

      {/* 3. Seletor Visual dos Celulares (Ribbon Superior) */}
      <div className={classes.deviceRibbon}>
        {loadingDevices ? (
          <CircularProgress size={20} style={{ margin: "auto" }} />
        ) : filteredDevices.length === 0 ? (
          <Typography variant="body2" style={{ color: "#64748b", margin: "auto", padding: "10px" }}>
            Nenhum celular encontrado com "{globalSearchInput}"
          </Typography>
        ) : (
          filteredDevices.map((device) => {
            const isSelected = selectedDevice?.id === device.id;
            const normalizedStatus = String(
              device.status || device.sessionStatus || device.connectionStatus || ""
            ).trim().toUpperCase();
            const isDisconnected = [
              "DISCONNECTED",
              "DISCONNECT",
              "OFFLINE",
              "CLOSED",
              "LOGGED_OUT",
              "ERROR",
              "FAILED",
            ].includes(normalizedStatus);
            const isConnected =
              !isDisconnected &&
              !["OPENING", "PAIRING", "CONNECTING", "QRCODE"].includes(normalizedStatus);
            const isOpening = ["OPENING", "PAIRING", "CONNECTING"].includes(normalizedStatus);
            const isQrCode = normalizedStatus === "QRCODE";

            return (
              <Card
                key={device.id}
                className={`${classes.deviceCard} ${isSelected ? classes.deviceCardSelected : ""}`}
                onClick={() => handleSelectDevice(device)}
              >
                <CardActionArea className={classes.deviceCardContent}>
                  <Box display="flex" alignItems="center" width="100%" minWidth={0}>
                    <Tooltip title={device.name || "Dispositivo"} placement="top">
                      <Typography
                        variant="subtitle2"
                        className={classes.deviceName}
                        style={{ fontWeight: 600, color: isSelected ? "#0284c7" : "inherit" }}
                      >
                        📱 {device.name}
                      </Typography>
                    </Tooltip>
                    {isConnected ? (
                      <Tooltip title="Conectado e Operando">
                        <OnlineIcon style={{ color: "#10b981", fontSize: 16 }} />
                      </Tooltip>
                    ) : isOpening ? (
                      <Tooltip title="Conectando / Sincronizando...">
                        <CircularProgress size={13} style={{ color: "#eab308" }} />
                      </Tooltip>
                    ) : isQrCode ? (
                      <Tooltip title="Aguardando Leitura de QR Code">
                        <QrCodeIcon style={{ color: "#0284c7", fontSize: 16 }} />
                      </Tooltip>
                    ) : (
                      <Tooltip title="Desconectado">
                        <OfflineIcon style={{ color: "#ef4444", fontSize: 16 }} />
                      </Tooltip>
                    )}
                  </Box>

                  <Box display="flex" alignItems="center" justifyContent="space-between" mt={0.3}>
                    <Typography variant="caption" color="textSecondary">
                      {device.totalMessages || 0} msgs
                    </Typography>
                    {device.sector && (
                      <span
                        style={{
                          fontSize: "0.62rem",
                          color: getSectorColor(device.sector),
                          fontWeight: 700,
                          backgroundColor: `${getSectorColor(device.sector)}15`,
                          padding: "1px 5px",
                          borderRadius: 4,
                        }}
                      >
                        {device.sector}
                      </span>
                    )}
                    {device.deletedMessages > 0 && (
                      <Chip
                        size="small"
                        label={`🚫 ${device.deletedMessages}`}
                        style={{
                          height: 16,
                          fontSize: "0.65rem",
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
      <div
        className={classes.mainContent}
        id="audit-drawer-container"
        style={{ position: "relative", overflow: "hidden" }}
      >
        {/* Painel Esquerdo: Lista de Conversas do Celular */}
        <div
          className={classes.chatsPanel}
          style={{
            display: isMobile && selectedChat ? "none" : "flex",
          }}
        >
          <div className={classes.chatSearchBox}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar no celular selecionado..."
              variant="outlined"
              value={chatSearchInput}
              onChange={handleChatSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ color: "#94a3b8" }} fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: chatSearchInput && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => { setChatSearchInput(""); setChatSearch(""); }}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </div>

          <div
            className={classes.chatsList}
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
              if (
                scrollHeight - scrollTop - clientHeight < 120 &&
                hasMoreChats &&
                !loadingMoreChats &&
                !loadingChats
              ) {
                fetchChats(false, chatsPage + 1);
              }
            }}
          >
            {loadingChats ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress size={24} />
              </Box>
            ) : chats.length === 0 ? (
              <Box p={3} textAlign="center" color="#64748b">
                <Typography variant="body2">Nenhuma conversa encontrada neste celular.</Typography>
                {chatSearchInput && (
                  <Button size="small" color="primary" onClick={() => { setChatSearchInput(""); setChatSearch(""); }} style={{ marginTop: 8 }}>
                    Limpar Busca
                  </Button>
                )}
              </Box>
            ) : (
              <>
                {chats.map((chat) => {
                  const isSelected = selectedChat?.ticketId === chat.ticketId;
                  return (
                    <div
                      key={chat.ticketId}
                      className={`${classes.chatItem} ${isSelected ? classes.chatItemSelected : ""}`}
                      onClick={() => setSelectedChat(chat)}
                    >
                      <Tooltip
                        title={chat.contact?.profilePicUrl ? "Clique para ampliar a foto do perfil" : ""}
                        placement="right"
                      >
                        <Avatar
                          className={classes.chatAvatar}
                          src={chat.contact?.profilePicUrl}
                          onClick={(e) => {
                            if (chat.contact?.profilePicUrl) {
                              e.stopPropagation();
                              handleOpenMediaModal(
                                chat.contact.profilePicUrl,
                                "image",
                                `${getContactDisplayName(chat.contact)} - Foto de Perfil`
                              );
                            }
                          }}
                          style={{
                            cursor: chat.contact?.profilePicUrl ? "pointer" : "default",
                          }}
                        >
                          {getContactDisplayName(chat.contact).charAt(0).toUpperCase()}
                        </Avatar>
                      </Tooltip>

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

                        <Box display="flex" gap={1} mt={0.3}>
                          {chat.deletedMessages > 0 && (
                            <span
                              style={{
                                backgroundColor: "#fee2e2",
                                color: "#b91c1c",
                                padding: "1px 5px",
                                borderRadius: 6,
                                fontSize: "0.65rem",
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
                })}

                {loadingMoreChats && (
                  <Box display="flex" justifyContent="center" p={2}>
                    <CircularProgress size={20} />
                  </Box>
                )}

                {hasMoreChats && !loadingMoreChats && (
                  <Box textAlign="center" p={1.5}>
                    <Button
                      size="small"
                      color="primary"
                      variant="text"
                      onClick={() => fetchChats(false, chatsPage + 1)}
                      style={{ fontSize: "0.75rem", textTransform: "none", color: "#0284c7" }}
                    >
                      ▼ Carregar mais conversas anteriores...
                    </Button>
                  </Box>
                )}
              </>
            )}
          </div>
        </div>

        {/* Painel Direito: Timeline de Mensagens & Filtros */}
        <div
          className={classes.timelinePanel}
          style={{
            display: isMobile && !selectedChat ? "none" : "flex",
          }}
        >
          {/* Cabeçalho da Conversa Selecionada */}
          {selectedChat && (
            <div className={classes.activeChatHeader}>
              <Box
                display="flex"
                alignItems="center"
                gap={isMobile ? 0.75 : 1.5}
                minWidth={0}
              >
                {isMobile && (
                  <IconButton
                    size="small"
                    onClick={() => setSelectedChat(null)}
                    style={{ marginRight: 2, padding: 4 }}
                    aria-label="Voltar para a lista de conversas"
                  >
                    <ArrowBackIcon fontSize="small" />
                  </IconButton>
                )}
                <Tooltip
                  title={selectedChat.contact?.profilePicUrl ? "Clique para ampliar a foto do perfil" : ""}
                  placement="bottom"
                >
                  <Avatar
                    className={classes.activeChatAvatar}
                    src={selectedChat.contact?.profilePicUrl}
                    onClick={(e) => {
                      if (selectedChat.contact?.profilePicUrl) {
                        e.stopPropagation();
                        handleOpenMediaModal(
                          selectedChat.contact.profilePicUrl,
                          "image",
                          `${getContactDisplayName(selectedChat.contact)} - Foto de Perfil`
                        );
                      } else {
                        setContactDrawerOpen(true);
                      }
                    }}
                    style={{
                      cursor: "pointer",
                      width: isMobile ? 34 : 38,
                      height: isMobile ? 34 : 38,
                    }}
                  >
                    {getContactDisplayName(selectedChat.contact).charAt(0).toUpperCase()}
                  </Avatar>
                </Tooltip>

                <Box
                  onClick={() => setContactDrawerOpen(true)}
                  style={{ cursor: "pointer", minWidth: 0 }}
                >
                  <Typography
                    variant="subtitle1"
                    style={{
                      fontWeight: 700,
                      color: "#0f172a",
                      lineHeight: 1.2,
                      fontSize: isMobile ? "0.85rem" : "0.95rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: isMobile ? 140 : 260,
                    }}
                  >
                    {getContactDisplayName(selectedChat.contact)}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={0.5} mt={0.3}>
                    <Typography variant="caption" style={{ color: "#64748b", fontSize: "0.68rem" }}>
                      📱 <strong>{selectedDevice?.name || "Dispositivo"}</strong>
                    </Typography>
                    {selectedChat.contact?.isGroup && (
                      <Chip
                        label="👥 Grupo"
                        size="small"
                        style={{ height: 16, fontSize: "0.6rem", backgroundColor: "#e2e8f0" }}
                      />
                    )}
                  </Box>
                </Box>
              </Box>

              <Box display="flex" alignItems="center" gap={0.8} flexShrink={0}>
                {!isMobile ? (
                  <Button
                    size="small"
                    variant="outlined"
                    style={{
                      borderColor: "#52658C",
                      color: "#52658C",
                      textTransform: "none",
                      fontWeight: 700,
                      borderRadius: 8,
                      height: 28,
                      fontSize: "0.78rem",
                    }}
                    startIcon={<PersonIcon style={{ fontSize: 16 }} />}
                    onClick={() => setContactDrawerOpen(true)}
                  >
                    Ver Perfil
                  </Button>
                ) : (
                  <IconButton
                    size="small"
                    onClick={() => setContactDrawerOpen(true)}
                    style={{
                      border: "1px solid rgba(82, 101, 140, 0.3)",
                      borderRadius: 6,
                      padding: 4,
                      color: "#52658C",
                    }}
                    title="Ver Perfil"
                  >
                    <PersonIcon fontSize="small" />
                  </IconButton>
                )}
                <Chip
                  label={
                    messagesTotalCount > messages.length
                      ? `${messages.length}/${messagesTotalCount} msgs`
                      : `${messages.length} msgs`
                  }
                  size="small"
                  style={{
                    backgroundColor: messagesTotalCount > messages.length ? "#fef3c7" : "#e0f2fe",
                    color: messagesTotalCount > messages.length ? "#b45309" : "#0369a1",
                    fontWeight: 700,
                    height: 24,
                    fontSize: "0.68rem",
                  }}
                />
              </Box>
            </div>
          )}

          {/* Barra de Filtros e Busca Rápida */}
          <div className={classes.filterToolbar}>
            {isMobile ? (
              <div style={{ width: "100%" }}>
                <div className={classes.mobileFilterRow}>
                  <TextField
                    size="small"
                    placeholder="Buscar termo (PIX, acordo)..."
                    variant="outlined"
                    value={searchTermInput}
                    onChange={handleSearchTermChange}
                    style={{ flex: 1, minWidth: 0 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon style={{ color: "#94a3b8" }} fontSize="small" />
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
                  <IconButton
                    size="small"
                    color={mobileFiltersExpanded || startDate || endDate || onlyDeleted || mediaType !== "all" ? "primary" : "default"}
                    onClick={() => setMobileFiltersExpanded(!mobileFiltersExpanded)}
                    style={{
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 6,
                      padding: 6,
                      backgroundColor: mobileFiltersExpanded ? "rgba(2, 132, 199, 0.1)" : "transparent",
                    }}
                    title="Mais Filtros"
                  >
                    <FilterListIcon fontSize="small" />
                  </IconButton>
                  {(searchTerm || startDate || endDate || onlyDeleted || mediaType !== "all") && (
                    <IconButton
                      size="small"
                      color="secondary"
                      onClick={clearFilters}
                      style={{ border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: 6 }}
                      title="Limpar Filtros"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  )}
                </div>

                <Collapse in={mobileFiltersExpanded}>
                  <Box display="flex" flexDirection="column" gap={0.8} pt={0.8}>
                    <Box display="flex" gap={1}>
                      <TextField
                        size="small"
                        type="date"
                        label="Data Inicial"
                        variant="outlined"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                      <TextField
                        size="small"
                        type="date"
                        label="Data Final"
                        variant="outlined"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </Box>
                    <Box display="flex" gap={1} alignItems="center">
                      <FormControl size="small" variant="outlined" style={{ flex: 1 }}>
                        <InputLabel>Tipo Mídia</InputLabel>
                        <Select
                          value={mediaType}
                          onChange={(e) => setMediaType(e.target.value)}
                          label="Tipo Mídia"
                        >
                          <MenuItem value="all">Todas as Mensagens</MenuItem>
                          <MenuItem value="audio">🎵 Áudios & Voz</MenuItem>
                          <MenuItem value="image">🖼️ Fotos & Imagens</MenuItem>
                          <MenuItem value="document">📄 Documentos & Boletos</MenuItem>
                          <MenuItem value="video">🎥 Vídeos</MenuItem>
                          <MenuItem value="vcard">👤 Contatos (vCard)</MenuItem>
                        </Select>
                      </FormControl>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={onlyDeleted}
                            onChange={(e) => setOnlyDeleted(e.target.checked)}
                            className={classes.deletedSwitch}
                          />
                        }
                        label={
                          <Typography variant="caption" style={{ color: onlyDeleted ? "#dc2626" : "inherit", fontWeight: onlyDeleted ? 700 : 400 }}>
                            🚫 Apagadas
                          </Typography>
                        }
                      />
                    </Box>
                  </Box>
                </Collapse>
              </div>
            ) : (
              <>
                <TextField
                  size="small"
                  placeholder="Buscar termo nesta conversa (ex: PIX, acordo)..."
                  variant="outlined"
                  value={searchTermInput}
                  onChange={handleSearchTermChange}
                  style={{ minWidth: 200, flexGrow: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon style={{ color: "#94a3b8" }} fontSize="small" />
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
                  label="Data Inicial"
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={classes.filterItem}
                />

                <TextField
                  size="small"
                  type="date"
                  label="Data Final"
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={classes.filterItem}
                />

                <FormControl size="small" variant="outlined" className={classes.filterItem}>
                  <InputLabel>Tipo Mídia</InputLabel>
                  <Select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value)}
                    label="Tipo Mídia"
                  >
                    <MenuItem value="all">Todas as Mensagens</MenuItem>
                    <MenuItem value="audio">🎵 Áudios & Voz</MenuItem>
                    <MenuItem value="image">🖼️ Fotos & Imagens</MenuItem>
                    <MenuItem value="document">📄 Documentos & Boletos</MenuItem>
                    <MenuItem value="video">🎥 Vídeos</MenuItem>
                    <MenuItem value="vcard">👤 Contatos (vCard)</MenuItem>
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={onlyDeleted}
                      onChange={(e) => setOnlyDeleted(e.target.checked)}
                      className={classes.deletedSwitch}
                    />
                  }
                  label={
                    <Typography variant="body2" style={{ color: onlyDeleted ? "#dc2626" : "inherit", fontWeight: onlyDeleted ? 700 : 400 }}>
                      🚫 Apenas Apagadas
                    </Typography>
                  }
                />

                {(searchTerm || startDate || endDate || onlyDeleted || mediaType !== "all") && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="secondary"
                    startIcon={<ClearIcon />}
                    onClick={clearFilters}
                  >
                    Limpar
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Área de Mensagens (Timeline) */}
          <div ref={messagesContainerRef} className={classes.messagesScrollArea}>
            {loadingMessages ? (
              <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                <CircularProgress />
              </Box>
            ) : !selectedChat && !searchTerm ? (
              <div className={classes.noChatSelected}>
                <SecurityIcon style={{ fontSize: 48, opacity: 0.3 }} />
                <Typography variant="h6">Selecione uma conversa para auditar</Typography>
                <Typography variant="body2">
                  Você pode usar o balão de busca acima para localizar qualquer número em todos os celulares.
                </Typography>
              </div>
            ) : messages.length === 0 ? (
              <Box textAlign="center" p={4} color="#64748b">
                <Typography variant="body1" style={{ fontWeight: 600 }}>
                  Nenhum registro encontrado para os filtros selecionados.
                </Typography>
              </Box>
            ) : (
              <>
                {hasMoreMessages && (
                  <Box
                    textAlign="center"
                    py={1.5}
                    px={2}
                    my={1.5}
                    mx="auto"
                    style={{
                      maxWidth: 520,
                      backgroundColor: "rgba(255, 255, 255, 0.94)",
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    }}
                  >
                    <Typography variant="caption" style={{ color: "#334155", fontWeight: 700, display: "block", marginBottom: 6 }}>
                      📜 Existem mensagens anteriores neste aparelho ({messagesTotalCount - messages.length} mais antigas gravadas)
                    </Typography>
                    <Box display="flex" justifyContent="center" gap={1}>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        disabled={loadingMoreMessages}
                        onClick={() => handleLoadOlderMessages(false)}
                        style={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 700 }}
                        startIcon={loadingMoreMessages ? <CircularProgress size={14} color="inherit" /> : <HistoryIcon style={{ fontSize: 16 }} />}
                      >
                        ⬆️ Carregar +2.000 mensagens anteriores
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={loadingMoreMessages}
                        onClick={() => handleLoadOlderMessages(true)}
                        style={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 700, borderColor: "#0284c7", color: "#0284c7" }}
                      >
                        Carregar todo o histórico ({messagesTotalCount})
                      </Button>
                    </Box>
                  </Box>
                )}
                {messages.map((message, index) => {
                const isOp = message.fromMe;
                const isGroup = selectedChat?.contact?.isGroup;
                const senderName = isOp
                  ? `📱 ${selectedDevice?.name || "Operador"}`
                  : (message.contact ? getContactDisplayName(message.contact) : "Participante");
                const senderColor = isOp ? "#0284c7" : getParticipantColor(senderName);

                const currentDate = message.createdAt ? format(parseISO(message.createdAt), "dd/MM/yyyy") : null;
                const prevDate = index > 0 && messages[index - 1]?.createdAt ? format(parseISO(messages[index - 1].createdAt), "dd/MM/yyyy") : null;
                const showDateSeparator = currentDate && currentDate !== prevDate;

                return (
                  <React.Fragment key={message.id || index}>
                    {showDateSeparator && (
                      <div className={classes.dailyTimestampContainer}>
                        <span className={classes.dailyTimestampBadge}>
                          {currentDate}
                        </span>
                      </div>
                    )}
                    <div
                      className={`${classes.messageBubble} ${
                        isOp ? classes.messageOperator : classes.messageClient
                      }`}
                    >
                      {/* Header do Remetente em Grupo */}
                      {isGroup && (
                        <Typography
                          variant="caption"
                          style={{
                            fontWeight: 700,
                            color: senderColor,
                            display: "block",
                            marginBottom: 3,
                            fontSize: "0.76rem",
                          }}
                        >
                          {senderName}
                        </Typography>
                      )}

                      {/* Banner de Mensagem Apagada */}
                      {message.isDeleted && (
                        <div className={classes.deletedBanner}>
                          <BlockIcon style={{ fontSize: 14 }} />
                          <span>MENSAGEM APAGADA NO WHATSAPP</span>
                        </div>
                      )}

                      {/* Mensagem Respondida (Quoted) */}
                      {message.quotedMsg && (
                        <div className={classes.quotedMsgBox}>
                          <Typography variant="caption" style={{ fontWeight: 700, color: "#0284c7", display: "block" }}>
                            {message.quotedMsg.fromMe
                              ? `📱 ${selectedDevice?.name || "Operador"}`
                              : (message.quotedMsg.contact ? getContactDisplayName(message.quotedMsg.contact) : "Participante")}
                          </Typography>
                          <Typography variant="caption" style={{ whiteSpace: "pre-wrap", display: "block" }}>
                            {message.quotedMsg.body}
                          </Typography>
                        </div>
                      )}

                      {/* Renderização Inteligente de Mídias e Comprovantes */}
                      {(() => {
                        const mediaCategory = resolveMediaCategory(message);
                        const cleanMediaName = getCleanMediaName(message);

                        if (mediaCategory === "image") {
                          return (
                            <div style={{ marginTop: 6, marginBottom: 6 }}>
                              <img
                                src={message.mediaUrl}
                                alt={cleanMediaName}
                                className={classes.mediaPreview}
                                onClick={() => handleOpenMediaModal(message.mediaUrl, "image", cleanMediaName)}
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  const fallback = e.target.nextElementSibling;
                                  if (fallback) fallback.style.display = "flex";
                                }}
                              />
                              <div
                                style={{
                                  display: "none",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "8px 12px",
                                  backgroundColor: "rgba(2, 132, 199, 0.08)",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  marginTop: 4
                                }}
                                onClick={() => handleOpenMediaModal(message.mediaUrl, "image", cleanMediaName)}
                              >
                                <ImageIcon style={{ color: "#0284c7" }} />
                                <Typography variant="caption" style={{ fontWeight: 600, color: "#0284c7" }}>
                                  {cleanMediaName} • Clique para visualizar foto
                                </Typography>
                              </div>
                            </div>
                          );
                        }

                        if (mediaCategory === "audio") {
                          return (
                            <div style={{ margin: "4px 0" }}>
                              <audio controls style={{ width: "100%", maxWidth: 280, height: 38 }}>
                                <source src={message.mediaUrl} type="audio/ogg" />
                                <source src={message.mediaUrl} type="audio/mp4" />
                                <source src={message.mediaUrl} type="audio/mpeg" />
                                <source src={message.mediaUrl} type="audio/wav" />
                                Seu navegador não suporta áudio.
                              </audio>
                            </div>
                          );
                        }

                        if (mediaCategory === "video") {
                          return (
                            <div style={{ margin: "4px 0" }}>
                              <video
                                src={message.mediaUrl}
                                controls
                                style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8 }}
                                onClick={() => handleOpenMediaModal(message.mediaUrl, "video", cleanMediaName)}
                              />
                            </div>
                          );
                        }

                        if (mediaCategory === "document") {
                          return (
                            <div className={classes.pdfCard}>
                              <div
                                className={classes.pdfCardHeader}
                                onClick={() => handleOpenMediaModal(message.mediaUrl, "application/pdf", cleanMediaName)}
                              >
                                <PictureAsPdfIcon style={{ color: "#ef4444", fontSize: 30, marginRight: 8, flexShrink: 0 }} />
                                <div style={{ overflow: "hidden", flexGrow: 1 }}>
                                  <Typography variant="subtitle2" noWrap style={{ fontWeight: 600, fontSize: "0.83rem" }}>
                                    {cleanMediaName}
                                  </Typography>
                                  <Typography variant="caption" style={{ color: "#64748b", fontSize: "0.72rem", display: "block" }}>
                                    Documento / Comprovante • Clique para expandir
                                  </Typography>
                                </div>
                              </div>
                              <div className={classes.docCardActions}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="primary"
                                  startIcon={<VisibilityIcon style={{ fontSize: 15 }} />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenMediaModal(message.mediaUrl, "application/pdf", cleanMediaName);
                                  }}
                                  className={classes.docActionBtn}
                                >
                                  Visualizar
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<OpenInNewIcon style={{ fontSize: 15 }} />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(message.mediaUrl, "_blank");
                                  }}
                                  className={classes.docActionBtnSec}
                                >
                                  Nova Aba
                                </Button>
                                <IconButton
                                  size="small"
                                  title="Baixar Arquivo"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const link = document.createElement("a");
                                    link.href = message.mediaUrl;
                                    link.download = cleanMediaName;
                                    link.target = "_blank";
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }}
                                  style={{ color: "#475569", marginLeft: "auto" }}
                                >
                                  <GetAppIcon fontSize="small" />
                                </IconButton>
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })()}

                      {/* Texto Principal da Mensagem */}
                      {message.body &&
                        message.body !== message.mediaUrl &&
                        !message.body.endsWith(".pdf") &&
                        !message.body.endsWith(".ogg") &&
                        !message.body.startsWith(".kfKTb") && (
                          <Typography variant="body2" style={{ whiteSpace: "pre-wrap", lineHeight: 1.4, marginTop: 4 }}>
                            {message.body}
                          </Typography>
                        )}

                      {/* Rodapé: Horário & Status */}
                      <div className={classes.metaFooter}>
                        <span>
                          {message.createdAt ? format(parseISO(message.createdAt), "dd/MM/yyyy HH:mm") : ""}
                        </span>
                        {isOp && (
                          <span>
                            {message.ack === 3 ? (
                              <DoneAllIcon style={{ fontSize: 14, color: "#38bdf8" }} />
                            ) : message.ack === 2 ? (
                              <DoneAllIcon style={{ fontSize: 14 }} />
                            ) : (
                              <DoneIcon style={{ fontSize: 14 }} />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </>
          )}
          <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Drawer Lateral de Perfil do Contato (Estilo Digisac no Cofre) */}
        <ContactDrawer
          open={contactDrawerOpen}
          handleDrawerClose={() => setContactDrawerOpen(false)}
          contact={selectedChat?.contact}
          loading={false}
          deviceName={selectedDevice?.name}
          containerId="audit-drawer-container"
        />
      </div>

      {/* Modal de Exportação */}
      <ExportAuditModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        selectedDevice={selectedDevice}
        selectedChat={selectedChat}
        devices={devices}
        startDate={startDate}
        endDate={endDate}
        onlyDeleted={onlyDeleted}
        mediaType={mediaType}
      />
      <MediaViewerModal
        open={mediaModalOpen}
        onClose={handleCloseMediaModal}
        mediaUrl={activeMedia.url}
        mediaType={activeMedia.type}
        title={activeMedia.title}
      />
    </div>
  );
};

export default Audit;
