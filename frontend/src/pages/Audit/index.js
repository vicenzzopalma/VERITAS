import React, { useState, useEffect, useRef, useContext, useMemo, useCallback } from "react";
import clsx from "clsx";
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
  InputBase,
  IconButton,
  Chip,
  Avatar,
  CircularProgress,
  Button,
  ButtonBase,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
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
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  Smartphone as PhoneAndroidIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  CropFree as QrCodeIcon,
  Person as PersonIcon,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  OpenInNew as OpenInNewIcon,
  Forum as ForumIcon,
  FindInPage as FindInPageIcon,
  WifiTethering as OnlineDevicesIcon,
  ContactPhone as VcardIcon,
  ChatBubbleOutline as ChatIcon,
  Group as GroupIcon,
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
import { StatCard, StatusPill, EmptyState } from "../../components/ui";

const useStyles = makeStyles((theme) => {
  const c = theme.custom;
  const isDark = theme.palette.type === "dark";
  const err = theme.palette.error.main;
  const sectionLabel = {
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: c.textSubtle,
    flex: "none",
    minWidth: 72,
    [theme.breakpoints.down("xs")]: { display: "none" },
  };

  return {
    root: {
      display: "flex",
      flexDirection: "column",
      flex: 1,
      minHeight: 0,
      height: "100%",
      backgroundColor: theme.palette.background.default,
      padding: theme.spacing(0, 3, 3),
      overflow: "hidden",
      [theme.breakpoints.down("sm")]: {
        height: "auto",
        overflow: "visible",
        padding: theme.spacing(0, 1.5, 1.5),
      },
    },
    pageHeader: {
      flex: "none",
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1),
      padding: theme.spacing(1.5, 0, 1.25),
      [theme.breakpoints.down("sm")]: { padding: theme.spacing(1.25, 0, 1) },
    },
    pageTitle: {
      fontWeight: 700,
      fontSize: "1.02rem",
      letterSpacing: "-0.01em",
      display: "flex",
      alignItems: "center",
      gap: 8,
      flex: 1,
      minWidth: 0,
      "& svg": { fontSize: 19, color: theme.palette.primary.main },
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
    mobileStats: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
    },

    // ---------- Omnisearch / setores / aparelhos ----------
    consoleCard: {
      flex: "none",
      borderRadius: 16,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.5),
      [theme.breakpoints.down("sm")]: {
        padding: theme.spacing(1.25),
        gap: theme.spacing(1),
        marginBottom: theme.spacing(1.5),
      },
    },
    globalSearchContainer: {
      position: "relative",
      width: "100%",
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
      [theme.breakpoints.down("sm")]: { height: 42 },
    },
    omniIcon: { color: theme.palette.primary.main, fontSize: 21 },
    omniInput: { flex: 1, fontSize: "0.95rem", minWidth: 0 },
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
      flex: "none",
      "& svg": { fontSize: 13 },
    },
    popperState: {
      padding: theme.spacing(3, 2),
      textAlign: "center",
      color: c.textMuted,
    },

    ribbonRow: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1.5),
      minWidth: 0,
    },
    ribbonLabel: sectionLabel,
    sectorRibbon: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(0.75),
      overflowX: "auto",
      whiteSpace: "nowrap",
      WebkitOverflowScrolling: "touch",
      paddingBottom: 2,
      minWidth: 0,
      flex: 1,
      ...theme.scrollbarStyles,
    },
    sectorChip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      flex: "none",
      height: 28,
      padding: "0 10px",
      borderRadius: 999,
      border: "1px solid",
      fontSize: "0.74rem",
      fontWeight: 650,
      whiteSpace: "nowrap",
      transition: "background-color .15s, color .15s, border-color .15s",
    },
    sectorCount: {
      fontSize: "0.68rem",
      fontWeight: 700,
      padding: "0 6px",
      borderRadius: 999,
      lineHeight: "16px",
      fontVariantNumeric: "tabular-nums",
    },
    deviceRibbon: {
      display: "flex",
      gap: theme.spacing(1),
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
      paddingBottom: 2,
      minWidth: 0,
      flex: 1,
      ...theme.scrollbarStyles,
    },
    ribbonEmpty: {
      fontSize: "0.82rem",
      color: c.textMuted,
      padding: theme.spacing(1.25, 0.5),
    },
    deviceCard: {
      flex: "none",
      minWidth: 176,
      maxWidth: 230,
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
      [theme.breakpoints.down("sm")]: { minWidth: 150, maxWidth: 180 },
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
      "& > svg": { fontSize: 17 },
    },
    deviceIconSelected: {
      color: theme.palette.primary.main,
      backgroundColor: c.surface,
      borderColor: "transparent",
    },
    statusDot: {
      position: "absolute",
      right: -3,
      bottom: -3,
      width: 11,
      height: 11,
      borderRadius: "50%",
      border: `2px solid ${c.surface}`,
      display: "grid",
      placeItems: "center",
    },
    dotOnline: { backgroundColor: theme.palette.success.main },
    dotOpening: { backgroundColor: theme.palette.warning.main },
    dotQr: { backgroundColor: theme.palette.info.main },
    dotOffline: { backgroundColor: err },
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
      whiteSpace: "nowrap",
    },
    deviceSector: {
      fontSize: "0.62rem",
      fontWeight: 700,
      padding: "0 6px",
      borderRadius: 999,
      lineHeight: "16px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: 80,
    },
    deviceDeleted: { color: err, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 },

    // ---------- Workspace ----------
    workspace: {
      display: "flex",
      flex: 1,
      minHeight: 0,
      borderRadius: 16,
      overflow: "hidden",
      position: "relative",
      [theme.breakpoints.down("sm")]: {
        flex: "none",
        height: "calc(100dvh - 88px)",
        minHeight: 480,
      },
    },
    chatsPanel: {
      width: 340,
      minWidth: 280,
      borderRight: `1px solid ${c.border}`,
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      height: "100%",
      [theme.breakpoints.down("sm")]: {
        width: "100%",
        minWidth: "100%",
        borderRight: 0,
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
      gap: 8,
      padding: theme.spacing(0, 0.5),
    },
    panelTitle: {
      fontWeight: 700,
      fontSize: "0.88rem",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    countBadge: {
      fontSize: "0.72rem",
      fontWeight: 700,
      color: c.textMuted,
      backgroundColor: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      borderRadius: 999,
      padding: "1px 8px",
      flex: "none",
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
      transition: "transform 0.15s ease, box-shadow 0.15s ease",
      "&:hover": { transform: "scale(1.06)", boxShadow: c.shadow },
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
    loadMoreBtn: { fontSize: "0.78rem", borderRadius: 10 },

    // ---------- Timeline ----------
    timelinePanel: {
      flexGrow: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      minHeight: 0,
      height: "100%",
      overflow: "hidden",
      [theme.breakpoints.down("sm")]: { width: "100%", minWidth: "100%" },
    },
    convHeader: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1.5),
      padding: theme.spacing(1.25, 2),
      borderBottom: `1px solid ${c.border}`,
      minHeight: 60,
      [theme.breakpoints.down("sm")]: {
        gap: theme.spacing(1),
        padding: theme.spacing(1, 1.25),
      },
    },
    convIdentity: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1.5),
      minWidth: 0,
      cursor: "pointer",
      [theme.breakpoints.down("sm")]: { gap: theme.spacing(1) },
    },
    convName: {
      fontWeight: 700,
      fontSize: "0.92rem",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    convSub: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: "0.76rem",
      color: c.textMuted,
      whiteSpace: "nowrap",
      "& svg": { fontSize: 13, color: c.textSubtle },
    },
    convActions: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      marginLeft: "auto",
      flex: "none",
    },
    iconOutlined: {
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      padding: 6,
    },
    filterToolbar: {
      padding: theme.spacing(1.25, 2),
      borderBottom: `1px solid ${c.border}`,
      backgroundColor: c.surfaceAlt,
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1),
      flexWrap: "wrap",
      "& .MuiOutlinedInput-root": { backgroundColor: c.surface, borderRadius: 10 },
      [theme.breakpoints.down("sm")]: { padding: theme.spacing(1, 1.25) },
    },
    mobileFilterRow: {
      display: "flex",
      alignItems: "center",
      width: "100%",
      gap: 6,
    },
    filterToggleActive: {
      color: theme.palette.primary.main,
      borderColor: alpha(theme.palette.primary.main, 0.5),
      backgroundColor: c.primarySoft,
    },
    filterSearch: { flex: "1 1 220px", minWidth: 200 },
    filterItem: {
      width: 150,
      [theme.breakpoints.down("xs")]: { width: "calc(50% - 4px)" },
    },
    filterSelect: {
      minWidth: 170,
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
      [theme.breakpoints.down("sm")]: {
        padding: theme.spacing(1.5, 1),
        gap: theme.spacing(0.75),
      },
    },
    loadOlderCard: {
      alignSelf: "center",
      maxWidth: 560,
      width: "100%",
      textAlign: "center",
      padding: theme.spacing(1.5, 2),
      margin: theme.spacing(0.5, 0, 1.5),
      borderRadius: 14,
      border: `1px solid ${c.border}`,
      backgroundColor: c.surface,
      boxShadow: c.shadow,
    },
    loadOlderText: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      fontSize: "0.78rem",
      fontWeight: 650,
      color: c.textMuted,
      marginBottom: theme.spacing(1),
      "& svg": { fontSize: 16, color: c.textSubtle },
    },
    dailyTimestampContainer: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      margin: "12px 0 6px",
      width: "100%",
    },
    dailyTimestampBadge: {
      backgroundColor: c.surface,
      color: c.textMuted,
      border: `1px solid ${c.border}`,
      padding: "3px 12px",
      borderRadius: 999,
      fontSize: "0.72rem",
      fontWeight: 650,
      boxShadow: c.shadow,
      fontVariantNumeric: "tabular-nums",
      userSelect: "none",
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
      [theme.breakpoints.down("sm")]: {
        maxWidth: "88%",
        minWidth: 140,
        fontSize: "0.84rem",
        padding: "6px 10px 5px",
      },
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
    imageFallback: {
      display: "none",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      backgroundColor: c.primarySoft,
      color: theme.palette.primary.main,
      borderRadius: 10,
      cursor: "pointer",
      marginTop: 4,
    },
    pdfCard: {
      backgroundColor: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      overflow: "hidden",
      marginTop: 6,
      marginBottom: 6,
      cursor: "pointer",
      transition: "border-color .15s, box-shadow .15s",
      maxWidth: 320,
      width: "100%",
      "&:hover": {
        borderColor: theme.palette.primary.main,
        boxShadow: `0 0 0 3px ${c.primarySoft}`,
      },
    },
    pdfCardHeader: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
    },
    pdfIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: "grid",
      placeItems: "center",
      flex: "none",
      color: err,
      backgroundColor: alpha(err, isDark ? 0.16 : 0.1),
      "& svg": { fontSize: 20 },
    },
    docCardActions: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 10px",
      backgroundColor: c.surfaceAlt,
      borderTop: `1px solid ${c.border}`,
    },
    docActionBtn: {
      fontSize: "0.72rem",
      fontWeight: 650,
      padding: "2px 10px",
      borderRadius: 8,
    },
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
      <Box key={i} alignSelf={i % 2 ? "flex-end" : "flex-start"} maxWidth="80%">
        <Skeleton variant="rect" width={w} height={i % 3 === 1 ? 72 : 48} className={className} />
      </Box>
    ))}
  </>
);

// Mesmo critério de status usado na faixa de aparelhos (conectado / sincronizando / QR / desconectado)
const getDeviceConnState = (device) => {
  const normalizedStatus = String(
    device?.status || device?.sessionStatus || device?.connectionStatus || ""
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
  return { isConnected, isOpening, isQrCode };
};

const MEDIA_FILTER_OPTIONS = [
  { value: "all", label: "Todas as mensagens", Icon: ChatIcon },
  { value: "audio", label: "Áudios & voz", Icon: AudioIcon },
  { value: "image", label: "Fotos & imagens", Icon: ImageIcon },
  { value: "document", label: "Documentos & boletos", Icon: DocumentIcon },
  { value: "video", label: "Vídeos", Icon: VideoIcon },
  { value: "vcard", label: "Contatos (vCard)", Icon: VcardIcon },
];

const MEDIA_ICONS = {
  image: ImageIcon,
  audio: AudioIcon,
  video: VideoIcon,
  document: DocumentIcon,
};

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
  // Faixa de setores/aparelhos recolhida por padrão: o destaque é a conversa.
  const [showDeviceBar, setShowDeviceBar] = useState(false);
  // Indicadores ficam ocultos por padrão para a conversa ganhar espaço.
  const [showKpis, setShowKpis] = useState(() => {
    try {
      return localStorage.getItem("veritas:audit-kpis") === "1";
    } catch (e) {
      return false;
    }
  });
  const toggleKpis = () => {
    setShowKpis((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("veritas:audit-kpis", next ? "1" : "0");
      } catch (e) {
        // ignore
      }
      return next;
    });
  };
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const location = useLocation();

  const isMaster = user?.profile === "admin_master";
  const isOperational = user?.profile === "admin_operational" || user?.profile === "admin";
  const isManagerHigh = user?.profile === "whatsapp_control_high";
  const canAccessAudit = isMaster || isOperational || isManagerHigh;

  const allowedSectors = useMemo(() => {
    if (isMaster) return null;

    if (isOperational) {
      if (Array.isArray(user?.sectorPermissions)) {
        const permitted = user.sectorPermissions
          .filter((p) => p && p.canView)
          .map((p) => p.sector);
        return Array.from(new Set(permitted));
      }
      return [];
    }

    if (isManagerHigh) {
      let raw = [];
      if (Array.isArray(user?.connectionSectors)) {
        raw = user.connectionSectors;
      } else if (typeof user?.connectionSectors === "string") {
        try {
          const parsed = JSON.parse(user.connectionSectors);
          raw = Array.isArray(parsed) ? parsed : [];
        } catch {
          raw = [];
        }
      }
      if (raw.length === 0) {
        raw = ["PA FIXA 1", "PA FIXA 2"];
      }
      const expanded = [];
      if (Array.isArray(raw)) {
        raw.forEach((s) => {
          if (s === "PA FIXA") {
            expanded.push("PA FIXA 1", "PA FIXA 2");
          } else {
            expanded.push(s);
          }
        });
      }
      return Array.from(new Set(expanded));
    }

    return [];
  }, [isMaster, isOperational, isManagerHigh, user?.sectorPermissions, user?.connectionSectors]);

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

  const [dynamicSectors, setDynamicSectors] = useState([]);
  useEffect(() => {
    api.get("/sectors")
      .then(({ data }) => {
        if (Array.isArray(data)) setDynamicSectors(data.map((s) => s.name));
      })
      .catch(() => {});
  }, []);

  const sectorsList = useMemo(() => {
    if (Array.isArray(allowedSectors)) {
      return allowedSectors;
    }
    const defaultOrder = dynamicSectors.length > 0 ? dynamicSectors : OFFICIAL_SECTORS;
    const presentSectors = new Set();
    const safeDevices = Array.isArray(devices) ? devices : [];
    safeDevices.forEach((d) => {
      if (d && d.sector) presentSectors.add(d.sector);
    });
    return Array.from(new Set([...defaultOrder, ...presentSectors]));
  }, [devices, allowedSectors, dynamicSectors]);

  const sectorCounts = useMemo(() => {
    const safeDevices = Array.isArray(devices) ? devices : [];
    const visibleDevices = allowedSectors
      ? safeDevices.filter((d) => allowedSectors.includes(d.sector || "Junior"))
      : safeDevices;
    const counts = { TODOS: visibleDevices.length };
    (sectorsList || []).forEach((sec) => {
      counts[sec] = 0;
    });
    visibleDevices.forEach((d) => {
      const sec = d.sector || "Junior";
      counts[sec] = (counts[sec] || 0) + 1;
    });
    return counts;
  }, [devices, allowedSectors, sectorsList]);

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
    if (!Array.isArray(devices)) return [];
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
      const list = Array.isArray(data) ? data : [];
      setDevices(list);
      if (list.length > 0) {
        if (!initialDeviceLoadedRef.current) {
          initialDeviceLoadedRef.current = true;
          const queryParams = new URLSearchParams(location.search);
          const targetWaId = queryParams.get("whatsappId");
          if (targetWaId) {
            const found = list.find((d) => String(d.id) === String(targetWaId));
            if (found) {
              setSelectedDevice(found);
              return;
            }
          }
          setSelectedDevice(list[0]);
        } else {
          // Em sincronizações em background (polling de 45s / websocket), preserva o aparelho que o operador está auditando
          setSelectedDevice((prev) => {
            if (!prev) return list[0];
            const updated = list.find((d) => d.id === prev.id);
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
    if (targetWaId && Array.isArray(devices) && devices.length > 0) {
      const found = devices.find((d) => String(d.id) === String(targetWaId));
      if (found) {
        setSelectedDevice((prev) => (prev?.id === found.id ? prev : found));
      }
    }
  }, [location.search, devices]);

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
          const safePrev = Array.isArray(prev) ? prev : [];
          const index = safePrev.findIndex((d) => d.id === data.whatsapp.id);
          if (index !== -1) {
            const copy = [...safePrev];
            copy[index] = { ...copy[index], ...data.whatsapp };
            return copy;
          }
          return [...safePrev, data.whatsapp];
        });
      }
      if (data.action === "delete") {
        setDevices((prev) => (Array.isArray(prev) ? prev.filter((d) => d.id !== data.whatsappId) : []));
      }
    });

    socket.on("whatsappSession", (data) => {
      if (data.action === "update" && data.session) {
        setDevices((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const index = safePrev.findIndex((d) => d.id === data.session.id);
          if (index !== -1) {
            const copy = [...safePrev];
            copy[index] = {
              ...copy[index],
              status: data.session.status,
              qrcode: data.session.qrcode,
              updatedAt: data.session.updatedAt,
            };
            return copy;
          }
          return safePrev;
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
  const safeTotalDevices = Array.isArray(devices) ? devices : [];
  const totalArchived = safeTotalDevices.reduce((acc, d) => acc + (d.totalMessages || 0), 0);
  const totalDeletedCount = safeTotalDevices.reduce((acc, d) => acc + (d.deletedMessages || 0), 0);

  if (user && !canAccessAudit) {
    return null;
  }

  const visibleDevicesForKpi = allowedSectors
    ? safeTotalDevices.filter((d) => allowedSectors.includes(d.sector || "Junior"))
    : safeTotalDevices;
  const onlineDevices = visibleDevicesForKpi.filter((d) => getDeviceConnState(d).isConnected).length;
  const hasActiveFilters = Boolean(searchTerm || startDate || endDate || onlyDeleted || mediaType !== "all");
  const fmtNum = (n) => (n || 0).toLocaleString("pt-BR");

  const sectorChipStyle = (color, isSelected) => ({
    backgroundColor: isSelected ? color : "transparent",
    borderColor: isSelected ? color : alpha(color, 0.45),
    color: isSelected ? "#fff" : color,
  });
  const sectorCountStyle = (color, isSelected) => ({
    backgroundColor: isSelected ? "rgba(255,255,255,0.22)" : alpha(color, 0.12),
  });

  const handleRefreshAll = () => {
    fetchDevices();
    fetchChats();
    fetchMessages();
  };

  const renderMediaSelect = (fullWidth) => (
    <FormControl
      size="small"
      variant="outlined"
      className={fullWidth ? undefined : classes.filterSelect}
      style={fullWidth ? { flex: 1, minWidth: 0 } : undefined}
    >
      <InputLabel>Tipo Mídia</InputLabel>
      <Select value={mediaType} onChange={(e) => setMediaType(e.target.value)} label="Tipo Mídia">
        {MEDIA_FILTER_OPTIONS.map(({ value, label, Icon }) => (
          <MenuItem key={value} value={value}>
            <Icon className={classes.menuIcon} />
            {label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  const renderDeletedChip = (label) => (
    <Chip
      clickable
      icon={<BlockIcon />}
      label={label}
      onClick={() => setOnlyDeleted(!onlyDeleted)}
      onDelete={onlyDeleted ? () => setOnlyDeleted(false) : undefined}
      className={clsx(classes.deletedChip, onlyDeleted && classes.deletedChipActive)}
      aria-pressed={onlyDeleted}
    />
  );

  const renderSearchTermAdornments = {
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
  };

  return (
    <div className={classes.root}>
      {/* 1. Cabeçalho do Cofre */}
      <div className={classes.pageHeader}>
        <div className={classes.pageTitle}>
          <SecurityIcon />
          {isMobile ? "Auditoria" : "Cofre de Auditoria"}
        </div>
        <Button
          size="small"
          variant={showDeviceBar ? "contained" : "outlined"}
          onClick={() => setShowDeviceBar((v) => !v)}
          aria-pressed={showDeviceBar}
          startIcon={<PhoneAndroidIcon style={{ fontSize: 16 }} />}
        >
          {showDeviceBar
            ? "Ocultar aparelhos"
            : `${selectedDevice?.name || "Aparelhos"} · ${selectedSector === "TODOS" ? "Todos" : selectedSector}`}
        </Button>
        {!isMobile && (
          <Button
            size="small"
            variant={showKpis ? "contained" : "outlined"}
            onClick={toggleKpis}
            aria-pressed={showKpis}
          >
            {showKpis ? "Ocultar indicadores" : "Mostrar indicadores"}
          </Button>
        )}
        <Tooltip title="Atualizar dados">
          <IconButton size="small" onClick={handleRefreshAll}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>

      {/* 2. KPIs (só quando o usuário pede) */}
      {!isMobile && showKpis && (
        <Grid container spacing={2} className={classes.kpiRow}>
          <Grid item xs={6} md={3}>
            <StatCard
              className={classes.kpiCard}
              label="Aparelhos"
              value={loadingDevices ? <Skeleton width={48} /> : fmtNum(sectorCounts.TODOS)}
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
      )}

      {/* 3. Omnisearch + setores + seletor de aparelhos */}
      <Paper className={classes.consoleCard}>
        {isMobile && (
          <div className={classes.mobileStats}>
            <StatusPill tone="info" dot={false}>
              <ForumIcon style={{ fontSize: 13 }} /> {fmtNum(totalArchived)} msgs
            </StatusPill>
            <StatusPill tone="error" dot={false}>
              <BlockIcon style={{ fontSize: 13 }} /> {fmtNum(totalDeletedCount)} apagadas
            </StatusPill>
          </div>
        )}

        {/* Balão de Busca Global: Localiza o número e em qual celular está */}
        <ClickAwayListener onClickAway={() => setGlobalPopperOpen(false)}>
          <div className={classes.globalSearchContainer} ref={globalSearchRef}>
            <div className={classes.omniField}>
              <SearchIcon className={classes.omniIcon} />
              <InputBase
                className={classes.omniInput}
                placeholder="Buscar palavra, número ou contato..."
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
                inputProps={{ "aria-label": "Buscar palavra, número ou contato em todos os aparelhos" }}
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
                      Buscando em todos os aparelhos e mensagens...
                    </Typography>
                  </div>
                ) : globalResults.length === 0 ? (
                  <EmptyState
                    icon={<FindInPageIcon />}
                    tone="neutral"
                    title="Nenhum resultado encontrado nos aparelhos"
                    description="Tente outra palavra, número, contato ou nome de aparelho."
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
                              <Typography variant="subtitle2" noWrap style={{ fontWeight: 700, minWidth: 0 }}>
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

        {(showDeviceBar || !selectedDevice) && (
        <>
        {/* Barra de Filtro de Setor Sincronizada (Audit <-> Conexões <-> CRM) */}
        <div className={classes.ribbonRow}>
          <span className={classes.ribbonLabel}>Setor</span>
          <div className={classes.sectorRibbon}>
            {(() => {
              const isSelected = selectedSector === "TODOS";
              const col = theme.palette.primary.main;
              return (
                <ButtonBase
                  className={classes.sectorChip}
                  style={sectorChipStyle(col, isSelected)}
                  onClick={() => setSelectedSector("TODOS")}
                  aria-pressed={isSelected}
                >
                  Todos
                  <span className={classes.sectorCount} style={sectorCountStyle(col, isSelected)}>
                    {sectorCounts.TODOS || 0}
                  </span>
                </ButtonBase>
              );
            })()}
            {sectorsList.map((sector) => {
              const count = sectorCounts[sector] || 0;
              const isSelected = selectedSector === sector;
              const sectorColor = getSectorColor(sector);
              return (
                <ButtonBase
                  key={sector}
                  className={classes.sectorChip}
                  style={sectorChipStyle(sectorColor, isSelected)}
                  onClick={() => setSelectedSector(sector)}
                  aria-pressed={isSelected}
                >
                  {sector}
                  <span className={classes.sectorCount} style={sectorCountStyle(sectorColor, isSelected)}>
                    {count}
                  </span>
                </ButtonBase>
              );
            })}
          </div>
        </div>

        {/* Seletor Visual dos Celulares */}
        <div className={classes.ribbonRow}>
          <span className={classes.ribbonLabel}>Aparelhos</span>
          <div className={classes.deviceRibbon}>
            {loadingDevices ? (
              [0, 1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rect" width={176} height={46} style={{ borderRadius: 12, flex: "none" }} />
              ))
            ) : filteredDevices.length === 0 ? (
              <span className={classes.ribbonEmpty}>
                Nenhum celular encontrado com "{globalSearchInput}"
              </span>
            ) : (
              filteredDevices.map((device) => {
                const isSelected = selectedDevice?.id === device.id;
                const { isConnected, isOpening, isQrCode } = getDeviceConnState(device);
                const statusTitle = isConnected
                  ? "Conectado e Operando"
                  : isOpening
                  ? "Conectando / Sincronizando..."
                  : isQrCode
                  ? "Aguardando Leitura de QR Code"
                  : "Desconectado";
                const dotClass = isConnected
                  ? classes.dotOnline
                  : isOpening
                  ? classes.dotOpening
                  : isQrCode
                  ? classes.dotQr
                  : classes.dotOffline;
                const sectorColor = device.sector ? getSectorColor(device.sector) : null;

                return (
                  <ButtonBase
                    key={device.id}
                    className={clsx(classes.deviceCard, isSelected && classes.deviceCardSelected)}
                    onClick={() => handleSelectDevice(device)}
                  >
                    <div className={clsx(classes.deviceIcon, isSelected && classes.deviceIconSelected)}>
                      {isQrCode ? <QrCodeIcon /> : <PhoneAndroidIcon />}
                      <Tooltip title={statusTitle}>
                        <span className={clsx(classes.statusDot, dotClass)}>
                          {isOpening && <CircularProgress size={7} thickness={7} style={{ color: "#fff" }} />}
                        </span>
                      </Tooltip>
                    </div>
                    <Box minWidth={0} flex={1}>
                      <Tooltip title={device.name || "Dispositivo"} placement="top">
                        <div className={classes.deviceName}>{device.name}</div>
                      </Tooltip>
                      <div className={classes.deviceMeta}>
                        <span>{device.totalMessages || 0} msgs</span>
                        {device.sector && (
                          <span
                            className={classes.deviceSector}
                            style={{ color: sectorColor, backgroundColor: alpha(sectorColor, 0.12) }}
                          >
                            {device.sector}
                          </span>
                        )}
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
              })
            )}
          </div>
        </div>
        </>
        )}
      </Paper>

      {/* 4. Área Principal: conversas + timeline */}
      <Paper className={classes.workspace} id="audit-drawer-container">
        {/* Painel Esquerdo: Lista de Conversas do Celular */}
        <div
          className={classes.chatsPanel}
          style={{
            display: isMobile && selectedChat ? "none" : "flex",
          }}
        >
          <div className={classes.panelHead}>
            <div className={classes.panelTitleRow}>
              <span className={classes.panelTitle}>
                Conversas{selectedDevice?.name ? ` · ${selectedDevice.name}` : ""}
              </span>
              {!loadingChats && (
                <span className={classes.countBadge}>
                  {chats.length}
                  {hasMoreChats ? "+" : ""}
                </span>
              )}
            </div>
            <div className={classes.compactSearch}>
              <SearchIcon />
              <InputBase
                className={classes.compactInput}
                placeholder="Buscar no celular selecionado..."
                value={chatSearchInput}
                onChange={handleChatSearchChange}
                inputProps={{ "aria-label": "Buscar no celular selecionado" }}
              />
              {chatSearchInput && (
                <IconButton size="small" onClick={() => { setChatSearchInput(""); setChatSearch(""); }}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              )}
            </div>
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
              <ListSkeleton />
            ) : chats.length === 0 ? (
              <EmptyState
                icon={<ChatIcon />}
                tone="neutral"
                title="Nenhuma conversa"
                description="Nenhuma conversa encontrada neste celular."
                action={
                  chatSearchInput && (
                    <Button size="small" color="primary" onClick={() => { setChatSearchInput(""); setChatSearch(""); }}>
                      Limpar Busca
                    </Button>
                  )
                }
              />
            ) : (
              <>
                {chats.map((chat) => {
                  const isSelected = selectedChat?.ticketId === chat.ticketId;
                  return (
                    <div
                      key={chat.ticketId}
                      className={clsx(classes.chatItem, isSelected && classes.chatItemSelected)}
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

                        {chat.deletedMessages > 0 && (
                          <span className={classes.miniPill}>
                            <BlockIcon />
                            {chat.deletedMessages} apagadas
                          </span>
                        )}
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
                      variant="outlined"
                      onClick={() => fetchChats(false, chatsPage + 1)}
                      className={classes.loadMoreBtn}
                    >
                      Carregar mais conversas anteriores
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
            <div className={classes.convHeader}>
              {isMobile && (
                <IconButton
                  size="small"
                  onClick={() => setSelectedChat(null)}
                  aria-label="Voltar para a lista de conversas"
                >
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              )}
              <div className={classes.convIdentity}>
                <Tooltip
                  title={selectedChat.contact?.profilePicUrl ? "Clique para ampliar a foto do perfil" : ""}
                  placement="bottom"
                >
                  <Avatar
                    className={classes.chatAvatar}
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
                      width: isMobile ? 34 : 40,
                      height: isMobile ? 34 : 40,
                    }}
                  >
                    {getContactDisplayName(selectedChat.contact).charAt(0).toUpperCase()}
                  </Avatar>
                </Tooltip>

                <Box onClick={() => setContactDrawerOpen(true)} minWidth={0}>
                  <div className={classes.convName} style={{ maxWidth: isMobile ? 140 : 320 }}>
                    {getContactDisplayName(selectedChat.contact)}
                  </div>
                  <div className={classes.convSub}>
                    <PhoneAndroidIcon />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {selectedDevice?.name || "Dispositivo"}
                    </span>
                    {selectedChat.contact?.isGroup && (
                      <StatusPill tone="neutral" dot={false}>
                        <GroupIcon style={{ fontSize: 12 }} /> Grupo
                      </StatusPill>
                    )}
                  </div>
                </Box>
              </div>

              <div className={classes.convActions}>
                {!isMobile ? (
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    startIcon={<GetAppIcon style={{ fontSize: 16 }} />}
                    onClick={() => setExportModalOpen(true)}
                  >
                    Exportar laudo
                  </Button>
                ) : (
                  <IconButton
                    size="small"
                    onClick={() => setExportModalOpen(true)}
                    className={classes.iconOutlined}
                    title="Exportar laudo"
                  >
                    <GetAppIcon fontSize="small" />
                  </IconButton>
                )}
                {!isMobile ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PersonIcon style={{ fontSize: 16 }} />}
                    onClick={() => setContactDrawerOpen(true)}
                  >
                    Ver Perfil
                  </Button>
                ) : (
                  <IconButton
                    size="small"
                    onClick={() => setContactDrawerOpen(true)}
                    className={classes.iconOutlined}
                    title="Ver Perfil"
                  >
                    <PersonIcon fontSize="small" />
                  </IconButton>
                )}
                <StatusPill tone={messagesTotalCount > messages.length ? "warning" : "primary"} dot={false}>
                  {messagesTotalCount > messages.length
                    ? `${messages.length}/${messagesTotalCount} msgs`
                    : `${messages.length} msgs`}
                </StatusPill>
              </div>
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
                    InputProps={renderSearchTermAdornments}
                  />
                  <IconButton
                    size="small"
                    onClick={() => setMobileFiltersExpanded(!mobileFiltersExpanded)}
                    className={clsx(
                      classes.iconOutlined,
                      (mobileFiltersExpanded || startDate || endDate || onlyDeleted || mediaType !== "all") &&
                        classes.filterToggleActive
                    )}
                    title="Mais Filtros"
                  >
                    <FilterListIcon fontSize="small" />
                  </IconButton>
                  {hasActiveFilters && (
                    <IconButton
                      size="small"
                      onClick={clearFilters}
                      className={classes.iconOutlined}
                      title="Limpar Filtros"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  )}
                </div>

                <Collapse in={mobileFiltersExpanded}>
                  <Box display="flex" flexDirection="column" pt={1} style={{ gap: 8 }}>
                    <Box display="flex" style={{ gap: 8 }}>
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
                    <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                      {renderMediaSelect(true)}
                      {renderDeletedChip("Apagadas")}
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
                  className={classes.filterSearch}
                  InputProps={renderSearchTermAdornments}
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

                {renderMediaSelect(false)}

                {renderDeletedChip("Apenas Apagadas")}

                {hasActiveFilters && (
                  <Button
                    size="small"
                    startIcon={<ClearIcon />}
                    onClick={clearFilters}
                    className={classes.clearBtn}
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
              <TimelineSkeleton className={classes.skeletonBubble} />
            ) : !selectedChat && !searchTerm ? (
              <div className={classes.centerState}>
                <Paper className={classes.stateCard}>
                  <EmptyState
                    icon={<SecurityIcon />}
                    title="Selecione uma conversa para auditar"
                    description="Você pode usar o balão de busca acima para localizar qualquer número em todos os celulares."
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
                    description="Nenhum registro encontrado para os filtros selecionados."
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
              <>
                {hasMoreMessages && (
                  <div className={classes.loadOlderCard}>
                    <div className={classes.loadOlderText}>
                      <HistoryIcon />
                      Existem mensagens anteriores neste aparelho ({messagesTotalCount - messages.length} mais antigas gravadas)
                    </div>
                    <Box display="flex" justifyContent="center" flexWrap="wrap" style={{ gap: 8 }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        disabled={loadingMoreMessages}
                        onClick={() => handleLoadOlderMessages(false)}
                        startIcon={loadingMoreMessages ? <CircularProgress size={14} color="inherit" /> : <HistoryIcon style={{ fontSize: 16 }} />}
                      >
                        Carregar +2.000 mensagens anteriores
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        disabled={loadingMoreMessages}
                        onClick={() => handleLoadOlderMessages(true)}
                      >
                        Carregar todo o histórico ({messagesTotalCount})
                      </Button>
                    </Box>
                  </div>
                )}
                {messages.map((message, index) => {
                const isOp = message.fromMe;
                const isGroup = selectedChat?.contact?.isGroup;
                const senderName = isOp
                  ? (selectedDevice?.name || "Operador")
                  : (message.contact ? getContactDisplayName(message.contact) : "Participante");
                const senderColor = isOp ? undefined : getParticipantColor(senderName);

                const currentDate = message.createdAt ? format(parseISO(message.createdAt), "dd/MM/yyyy") : null;
                const prevDate = index > 0 && messages[index - 1]?.createdAt ? format(parseISO(messages[index - 1].createdAt), "dd/MM/yyyy") : null;
                const showDateSeparator = currentDate && currentDate !== prevDate;
                const footerMediaCategory = resolveMediaCategory(message);
                const FooterMediaIcon = MEDIA_ICONS[footerMediaCategory] || null;

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
                          <span>MENSAGEM APAGADA NO WHATSAPP</span>
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
                                className={classes.imageFallback}
                                onClick={() => handleOpenMediaModal(message.mediaUrl, "image", cleanMediaName)}
                              >
                                <ImageIcon />
                                <Typography variant="caption" style={{ fontWeight: 600 }}>
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
                                style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 10 }}
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
                                <div className={classes.pdfIcon}>
                                  <PictureAsPdfIcon />
                                </div>
                                <div style={{ overflow: "hidden", flexGrow: 1 }}>
                                  <Typography variant="subtitle2" noWrap style={{ fontWeight: 650, fontSize: "0.83rem" }}>
                                    {cleanMediaName}
                                  </Typography>
                                  <Typography variant="caption" color="textSecondary" style={{ fontSize: "0.72rem", display: "block" }}>
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
                                  color="primary"
                                  startIcon={<OpenInNewIcon style={{ fontSize: 15 }} />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(message.mediaUrl, "_blank");
                                  }}
                                  className={classes.docActionBtn}
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
                                  style={{ marginLeft: "auto" }}
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
                          <Typography variant="body2" style={{ whiteSpace: "pre-wrap", lineHeight: 1.45, marginTop: 4 }}>
                            {message.body}
                          </Typography>
                        )}

                      {/* Rodapé: direção, mídia, horário & status */}
                      <div className={classes.metaFooter}>
                        <span className={classes.directionTag}>
                          {isOp ? "Enviada" : "Recebida"}
                        </span>
                        {FooterMediaIcon && <FooterMediaIcon />}
                        <span>
                          {message.createdAt ? format(parseISO(message.createdAt), "dd/MM/yyyy HH:mm") : ""}
                        </span>
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
      </Paper>

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
