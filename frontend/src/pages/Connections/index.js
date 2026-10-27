import React, { useState, useCallback, useContext, useEffect } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import clsx from "clsx";

import { makeStyles, alpha, lighten, useTheme } from "@material-ui/core/styles";
import {
	Button,
	IconButton,
	Paper,
	Tooltip,
	Typography,
	CircularProgress,
	InputAdornment,
	Table,
	TableHead,
	TableBody,
	TableRow,
	TableCell,
	Box,
	useMediaQuery,
} from "@material-ui/core";
import Skeleton from "@material-ui/lab/Skeleton";
import {
	Edit,
	DeleteOutline,
	Archive,
	Unarchive,
	Clear as ClearIcon,
	AccessTime,
	Sync as SyncIcon,
	WhatsApp,
	Add,
	Star,
	Schedule,
	CropFree,
	Refresh,
	LinkOff,
	PhoneIphone,
	PhonelinkRing,
	ArchiveOutlined,
	LockOutlined,
	InfoOutlined,
	SearchOutlined,
	ErrorOutline,
	ViewColumn as ViewColumnIcon,
	ViewList as ViewListIcon,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import {
	PageHeader,
	StatusPill,
	EmptyState,
	SearchField,
	toneColor,
} from "../../components/ui";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";
import { sortSectors } from "../../helpers/sectorOrder";

const WHATSAPP_GREEN = "#25D366";
const ARCHIVE_COLOR = "#7C3AED";

const getSectorColor = sector => {
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

// Exibição do número da linha sempre formatado (REGRAS.md §1)
const formatPhoneNumber = raw => {
	const digits = String(raw || "").split("@")[0].split(":")[0].replace(/\D/g, "");
	if (!digits) return "";
	let ddi = "";
	let rest = digits;
	if (digits.startsWith("55") && digits.length >= 12) {
		ddi = "+55 ";
		rest = digits.slice(2);
	}
	if (rest.length === 11) return `${ddi}(${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7)}`;
	if (rest.length === 10) return `${ddi}(${rest.slice(0, 2)}) ${rest.slice(2, 6)}-${rest.slice(6)}`;
	return ddi ? `+${digits}` : digits;
};

const getWhatsAppNumber = whatsApp => {
	if (!whatsApp) return "";
	if (whatsApp.number) return formatPhoneNumber(whatsApp.number);
	if (whatsApp.phone_number) return formatPhoneNumber(whatsApp.phone_number);
	try {
		const sess = typeof whatsApp.session === "string" ? JSON.parse(whatsApp.session) : whatsApp.session;
		if (sess?.me?.id) return formatPhoneNumber(sess.me.id);
	} catch (e) {}
	return "";
};

const VIEW_MODE_STORAGE_KEY = "veritas:connectionsViewMode:v2"; // v2: padrão volta a ser lista para todos

const formatDateTime = dateVal => {
	if (!dateVal) return "-";
	try {
		const str = String(dateVal).trim();
		const cleaned = str.replace(" ", "T").replace(" +", "+").replace(" -", "-");
		const d = new Date(cleaned);
		if (isNaN(d.getTime())) {
			const fallback = new Date(str);
			if (isNaN(fallback.getTime())) return "-";
			const dd = String(fallback.getDate()).padStart(2, "0");
			const mm = String(fallback.getMonth() + 1).padStart(2, "0");
			const yy = String(fallback.getFullYear()).slice(-2);
			const hh = String(fallback.getHours()).padStart(2, "0");
			const min = String(fallback.getMinutes()).padStart(2, "0");
			return `${dd}/${mm}/${yy} ${hh}:${min}`;
		}
		const dd = String(d.getDate()).padStart(2, "0");
		const mm = String(d.getMonth() + 1).padStart(2, "0");
		const yy = String(d.getFullYear()).slice(-2);
		const hh = String(d.getHours()).padStart(2, "0");
		const min = String(d.getMinutes()).padStart(2, "0");
		return `${dd}/${mm}/${yy} ${hh}:${min}`;
	} catch (e) {
		return "-";
	}
};

const useStyles = makeStyles(theme => {
	const c = theme.custom;
	const isDark = theme.palette.type === "dark";
	const archiveColor = isDark ? lighten(ARCHIVE_COLOR, 0.35) : ARCHIVE_COLOR;
	return {
		spin: {
			animation: "$spin 1s linear infinite",
		},
		"@keyframes spin": {
			"0%": {
				transform: "rotate(0deg)",
			},
			"100%": {
				transform: "rotate(360deg)",
			},
		},

		// Header controls
		segmented: {
			display: "inline-flex",
			padding: 3,
			gap: 3,
			borderRadius: 10,
			border: `1px solid ${c.border}`,
			backgroundColor: isDark ? c.surfaceAlt : c.surface,
			flexShrink: 0,
			[theme.breakpoints.down("xs")]: { width: "100%" },
		},
		segment: {
			height: 32,
			padding: "0 12px",
			borderRadius: 8,
			border: "none",
			background: "transparent",
			color: c.textMuted,
			fontFamily: "inherit",
			fontSize: "0.82rem",
			fontWeight: 650,
			cursor: "pointer",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			gap: 6,
			whiteSpace: "nowrap",
			transition: "background-color .15s, color .15s",
			"& svg": { fontSize: 16 },
			"&:hover": { color: c.text, backgroundColor: c.surfaceHover },
			[theme.breakpoints.down("xs")]: { flex: 1 },
		},
		segmentActive: {
			color: theme.palette.primary.main,
			backgroundColor: c.primarySoft,
			"&:hover": { color: theme.palette.primary.main, backgroundColor: c.primarySoft },
		},
		segmentArchivedActive: {
			color: archiveColor,
			backgroundColor: alpha(ARCHIVE_COLOR, isDark ? 0.18 : 0.1),
			"&:hover": { color: archiveColor, backgroundColor: alpha(ARCHIVE_COLOR, isDark ? 0.18 : 0.1) },
		},
		segmentCount: {
			fontSize: "0.72rem",
			fontWeight: 700,
			padding: "0 6px",
			borderRadius: 999,
			backgroundColor: c.surfaceAlt,
			border: `1px solid ${c.border}`,
			lineHeight: "18px",
		},
		// Visualização em colunas (kanban por setor)
		board: {
			flex: 1,
			minHeight: 0,
			display: "flex",
			gap: 10,
			overflowX: "auto",
			overflowY: "hidden",
			paddingBottom: 6,
			...theme.scrollbarStyles,
		},
		boardColumn: {
			flex: "0 0 272px",
			width: 272,
			minHeight: 0,
			display: "flex",
			flexDirection: "column",
			borderRadius: 12,
			backgroundColor: c.surfaceAlt,
			border: `1px solid ${c.border}`,
			overflow: "hidden",
		},
		boardColumnHeader: {
			display: "flex",
			alignItems: "center",
			gap: 8,
			padding: "8px 10px",
			borderBottom: `1px solid ${c.border}`,
			flexShrink: 0,
		},
		boardColumnTitle: {
			fontWeight: 700,
			fontSize: "0.8rem",
			flex: 1,
			minWidth: 0,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		boardColumnBody: {
			flex: 1,
			minHeight: 0,
			overflowY: "auto",
			padding: 8,
			display: "flex",
			flexDirection: "column",
			gap: 8,
			...theme.scrollbarStyles,
		},
		boardCard: {
			flexShrink: 0,
			borderRadius: 10,
			padding: "8px 10px",
			backgroundColor: c.surface,
			border: `1px solid ${c.border}`,
			display: "flex",
			flexDirection: "column",
			gap: 6,
			"& .MuiButton-root": {
				minHeight: 26,
				padding: "2px 8px",
				fontSize: "0.7rem",
				borderRadius: 6,
				textTransform: "none",
			},
		},
		boardCardActions: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 4,
			paddingTop: 6,
			borderTop: `1px solid ${c.border}`,
		},
		boardEmpty: {
			padding: "18px 8px",
			textAlign: "center",
			fontSize: "0.75rem",
			color: c.textMuted,
		},
		search: {
			minWidth: 260,
			[theme.breakpoints.down("xs")]: { width: "100%", minWidth: 0 },
		},
		clearBtn: { padding: 2, "& svg": { color: c.textSubtle } },
		headerBtn: {
			whiteSpace: "nowrap",
			[theme.breakpoints.down("xs")]: { flex: 1 },
		},

		// Sector filter / archive banner
		filterBar: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing(0.75),
			flexWrap: "wrap",
			marginBottom: theme.spacing(2),
			padding: theme.spacing(1.25, 1.5),
			borderRadius: 14,
			[theme.breakpoints.down("sm")]: {
				flexWrap: "nowrap",
				overflowX: "auto",
				WebkitOverflowScrolling: "touch",
				...theme.scrollbarStyles,
			},
		},
		filterLabel: {
			fontSize: "0.7rem",
			fontWeight: 700,
			textTransform: "uppercase",
			letterSpacing: "0.08em",
			color: c.textSubtle,
			marginRight: theme.spacing(0.5),
			whiteSpace: "nowrap",
		},
		filterChip: {
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			height: 28,
			padding: "0 10px",
			borderRadius: 999,
			border: `1px solid ${c.border}`,
			background: "transparent",
			color: c.textMuted,
			fontFamily: "inherit",
			fontSize: "0.76rem",
			fontWeight: 650,
			cursor: "pointer",
			whiteSpace: "nowrap",
			flexShrink: 0,
			transition: "background-color .15s, border-color .15s, color .15s",
			"&:hover": { backgroundColor: c.surfaceHover },
		},
		filterDot: { width: 7, height: 7, borderRadius: "50%", flex: "none" },
		filterCount: { opacity: 0.75, fontWeight: 600 },
		archiveBanner: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing(1.5),
			marginBottom: theme.spacing(2),
			padding: theme.spacing(1.5, 2),
			borderRadius: 14,
			borderColor: alpha(ARCHIVE_COLOR, 0.35),
			backgroundColor: alpha(ARCHIVE_COLOR, isDark ? 0.1 : 0.05),
			[theme.breakpoints.down("xs")]: { flexDirection: "column", alignItems: "stretch" },
		},
		archiveBannerIcon: {
			width: 36,
			height: 36,
			borderRadius: 10,
			flex: "none",
			display: "grid",
			placeItems: "center",
			color: archiveColor,
			backgroundColor: alpha(ARCHIVE_COLOR, isDark ? 0.18 : 0.1),
			"& svg": { fontSize: 19 },
			[theme.breakpoints.down("xs")]: { display: "none" },
		},
		archiveBannerText: { flex: 1, fontSize: "0.84rem", color: c.textMuted, lineHeight: 1.5 },
		archiveBannerStrong: { color: c.text, fontWeight: 700 },
		archiveBtn: {
			flexShrink: 0,
			color: "#fff",
			backgroundColor: ARCHIVE_COLOR,
			"&:hover": { backgroundColor: "#6D28D9" },
		},

		// Cards
		scroll: {
			flex: 1,
			minHeight: 0,
			overflowY: "auto",
			margin: theme.spacing(0, -0.5),
			padding: theme.spacing(0.5, 0.5, 2),
			...theme.scrollbarStyles,
		},
		grid: {
			display: "grid",
			gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
			gap: theme.spacing(2),
			[theme.breakpoints.down("xs")]: { gridTemplateColumns: "1fr" },
		},
		card: {
			borderRadius: 16,
			display: "flex",
			flexDirection: "column",
			overflow: "hidden",
			transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
			"&:hover": {
				transform: "translateY(-2px)",
				boxShadow: c.shadowLg,
				borderColor: c.borderStrong,
			},
		},
		cardArchived: {
			backgroundColor: c.surfaceAlt,
		},
		cardBody: {
			padding: theme.spacing(2, 2, 1.75),
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing(1.5),
			flex: 1,
		},
		cardTop: {
			display: "flex",
			alignItems: "flex-start",
			gap: theme.spacing(1.5),
		},
		iconTile: {
			position: "relative",
			width: 44,
			height: 44,
			borderRadius: 12,
			flex: "none",
			display: "grid",
			placeItems: "center",
			color: WHATSAPP_GREEN,
			backgroundColor: alpha(WHATSAPP_GREEN, isDark ? 0.16 : 0.12),
			"& svg": { fontSize: 24 },
		},
		iconTileArchived: {
			color: archiveColor,
			backgroundColor: alpha(ARCHIVE_COLOR, isDark ? 0.18 : 0.1),
		},
		liveDot: {
			position: "absolute",
			right: -2,
			bottom: -2,
			width: 12,
			height: 12,
			borderRadius: "50%",
			border: `2px solid ${c.surface}`,
		},
		nameBlock: { flex: 1, minWidth: 0 },
		name: {
			fontWeight: 700,
			fontSize: "0.96rem",
			lineHeight: 1.3,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		meta: {
			display: "flex",
			alignItems: "center",
			gap: 4,
			marginTop: 2,
			fontSize: "0.76rem",
			color: c.textSubtle,
			"& svg": { fontSize: 14 },
		},
		topActions: { display: "flex", gap: 2, marginRight: -6, marginTop: -4 },
		iconBtn: { "& svg": { fontSize: 19 } },
		unarchiveBtn: { color: theme.palette.info.main },
		deleteBtn: {
			"&:hover": {
				color: theme.palette.error.main,
				backgroundColor: alpha(theme.palette.error.main, 0.08),
			},
		},
		pills: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: theme.spacing(0.75) },
		iconPill: { "& svg": { fontSize: 13 } },
		archivedPill: {
			color: archiveColor,
			backgroundColor: alpha(ARCHIVE_COLOR, isDark ? 0.18 : 0.1),
		},
		sectorPill: {
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			padding: "3px 10px",
			borderRadius: 999,
			fontSize: "0.74rem",
			fontWeight: 650,
			whiteSpace: "nowrap",
			lineHeight: 1.5,
		},
		infoRow: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: theme.spacing(1),
			padding: theme.spacing(1, 1.25),
			borderRadius: 10,
			backgroundColor: c.surfaceAlt,
			border: `1px solid ${c.border}`,
		},
		infoLabel: {
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			fontSize: "0.72rem",
			fontWeight: 700,
			textTransform: "uppercase",
			letterSpacing: "0.06em",
			color: c.textSubtle,
			cursor: "help",
			"& svg": { fontSize: 14 },
		},
		timerMuted: { color: c.textSubtle, fontSize: "0.82rem", fontWeight: 600 },
		timerPill: {
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
			letterSpacing: "0.02em",
			"& svg": { fontSize: 13 },
		},
		cardFooter: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: theme.spacing(1),
			padding: theme.spacing(1.25, 2),
			borderTop: `1px solid ${c.border}`,
			backgroundColor: c.surfaceAlt,
			minHeight: 56,
		},
		footerLabel: {
			fontSize: "0.72rem",
			fontWeight: 700,
			textTransform: "uppercase",
			letterSpacing: "0.06em",
			color: c.textSubtle,
			marginRight: "auto",
		},
		actionBtn: { "& svg": { fontSize: 17 } },
		dangerBtn: {
			color: theme.palette.error.main,
			"&:hover": {
				borderColor: theme.palette.error.main,
				backgroundColor: alpha(theme.palette.error.main, 0.08),
			},
		},
		auditBtn: {
			color: "#fff",
			backgroundColor: theme.palette.info.main,
			"&:hover": { backgroundColor: theme.palette.info.dark || theme.palette.info.main },
		},
		emptyPaper: { borderRadius: 16 },

		// Table (sober list layout)
		tablePaper: {
			flex: 1,
			minHeight: 0,
			display: "flex",
			flexDirection: "column",
			borderRadius: 12,
			border: `1px solid ${c.border}`,
			boxShadow: "none",
			overflow: "hidden",
			marginBottom: theme.spacing(2),
		},
		tableWrap: {
			flex: 1,
			minHeight: 0,
			overflow: "auto",
			WebkitOverflowScrolling: "touch",
			...theme.scrollbarStyles,
		},
		table: { minWidth: 980 },
		th: {
			position: "sticky",
			top: 0,
			zIndex: 2,
			backgroundColor: c.surfaceAlt,
			color: c.textMuted,
			fontSize: "0.7rem",
			fontWeight: 700,
			textTransform: "uppercase",
			letterSpacing: "0.06em",
			padding: theme.spacing(1, 1.5),
			borderBottom: `1px solid ${c.border}`,
			whiteSpace: "nowrap",
		},
		td: {
			padding: theme.spacing(0.75, 1.5),
			borderBottom: `1px solid ${c.border}`,
			fontSize: "0.84rem",
			verticalAlign: "middle",
		},
		row: {
			"&:hover": { backgroundColor: c.surfaceAlt },
			"&:last-child td": { borderBottom: "none" },
		},
		rowArchived: { opacity: 0.85 },
		nameCell: { display: "flex", alignItems: "center", gap: 8, minWidth: 0, maxWidth: 280 },
		nameText: {
			fontWeight: 600,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		nameIcon: { fontSize: 18, color: c.textMuted, flex: "none" },
		defaultStar: { fontSize: 16, color: theme.palette.primary.main, flex: "none" },
		proxyIcon: { fontSize: 15, color: c.textMuted, flex: "none" },
		statusText: {
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			fontSize: "0.8rem",
			fontWeight: 600,
			color: c.textMuted,
			whiteSpace: "nowrap",
		},
		statusDot: { width: 7, height: 7, borderRadius: "50%", flex: "none" },
		neutralChip: {
			display: "inline-block",
			padding: "1px 8px",
			borderRadius: 6,
			fontSize: "0.74rem",
			fontWeight: 600,
			color: c.textMuted,
			backgroundColor: c.surfaceAlt,
			border: `1px solid ${c.border}`,
			whiteSpace: "nowrap",
		},
		mutedText: { color: c.textMuted, fontSize: "0.8rem", whiteSpace: "nowrap" },
		rowActions: { display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-end" },
		sessionActions: { display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" },

		// Rich tooltip (status explanations)
		tooltip: {
			backgroundColor: c.surface,
			color: c.text,
			fontSize: theme.typography.pxToRem(13),
			border: `1px solid ${c.border}`,
			boxShadow: c.shadowLg,
			borderRadius: 10,
			padding: theme.spacing(1, 1.5),
			maxWidth: 360,
		},
		tooltipArrow: {
			color: c.surface,
			"&::before": { border: `1px solid ${c.border}` },
		},
		tooltipTitle: { fontWeight: 700, fontSize: "0.84rem" },
		tooltipContent: { color: c.textMuted, fontSize: "0.8rem", marginTop: 4, lineHeight: 1.45 },

		// Error boundary fallback
		errorPaper: { borderRadius: 16, padding: theme.spacing(3) },
		errorMessage: {
			color: theme.palette.error.main,
			fontWeight: 700,
			margin: theme.spacing(1.5, 0),
			backgroundColor: alpha(theme.palette.error.main, isDark ? 0.14 : 0.08),
			padding: theme.spacing(1.5),
			borderRadius: 10,
		},
		errorStack: {
			fontSize: "0.75rem",
			backgroundColor: c.surfaceAlt,
			color: c.textMuted,
			border: `1px solid ${c.border}`,
			padding: theme.spacing(1.5),
			borderRadius: 10,
			overflowX: "auto",
			maxHeight: 300,
		},
	};
});

const STATUS_META = {
	CONNECTED: { tone: "success", label: "Conectado", tip: "connected" },
	qrcode: { tone: "warning", label: "Aguardando QR Code", tip: "qrcode" },
	PAIRING: { tone: "warning", label: "Pareando", tip: "timeout" },
	TIMEOUT: { tone: "error", label: "Conexão perdida", tip: "timeout" },
	DISCONNECTED: { tone: "error", label: "Desconectado", tip: "disconnected" },
	OPENING: { tone: "info", label: "Conectando", tip: null },
};

const getStatusMeta = status =>
	STATUS_META[status] || { tone: "neutral", label: status || "-", tip: null };

const CustomToolTip = ({ title, content, children }) => {
	const classes = useStyles();

	return (
		<Tooltip
			arrow
			classes={{
				tooltip: classes.tooltip,
				arrow: classes.tooltipArrow,
			}}
			title={
				<React.Fragment>
					<div className={classes.tooltipTitle}>{title}</div>
					{content && <div className={classes.tooltipContent}>{content}</div>}
				</React.Fragment>
			}
		>
			{children}
		</Tooltip>
	);
};

const Connections = () => {
	const classes = useStyles();
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
	const isDark = theme.palette.type === "dark";

	const { whatsApps, loading, fetchWhatsApps } = useContext(WhatsAppsContext);
	const { user } = useContext(AuthContext);
	const isMaster = user?.profile === "admin_master" ||
		user?.profile === "admin" ||
		String(user?.email || "").toLowerCase().trim() === "vicenzzo.mastronikolis@realess.com.br";
	const isOperational = user?.profile === "admin_operational" || user?.profile === "admin";
	const isManager = user?.profile === "whatsapp_control" || user?.profile === "whatsapp_control_high";
	const allowedSectors = React.useMemo(() => {
		if (isMaster) return null;
		if (isOperational) {
			if (Array.isArray(user?.sectorPermissions)) {
				const permitted = user.sectorPermissions
					.filter(p => p && p.canView)
					.map(p => p.sector);
				return Array.from(new Set(permitted));
			}
			return [];
		}
		let userSectors = [];
		if (Array.isArray(user?.connectionSectors)) {
			userSectors = user.connectionSectors;
		} else if (typeof user?.connectionSectors === "string") {
			try {
				const parsed = JSON.parse(user.connectionSectors);
				userSectors = Array.isArray(parsed) ? parsed : [];
			} catch {
				userSectors = [];
			}
		}
		const raw = (isManager || user?.canAccessConnections)
			? (userSectors.length > 0
				? userSectors
				: (isManager ? ["PA FIXA 1", "PA FIXA 2"] : []))
			: [];
		const expanded = [];
		if (Array.isArray(raw)) {
			raw.forEach(s => {
				if (s === "PA FIXA") {
					expanded.push("PA FIXA 1", "PA FIXA 2");
				} else {
					expanded.push(s);
				}
			});
		}
		return Array.from(new Set(expanded));
	}, [isMaster, isOperational, isManager, user?.canAccessConnections, user?.connectionSectors, user?.sectorPermissions]);
	const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
	const [qrModalOpen, setQrModalOpen] = useState(false);
	const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const confirmationModalInitialState = {
		action: "",
		title: "",
		message: "",
		whatsAppId: "",
		open: false,
	};
	const [confirmModalInfo, setConfirmModalInfo] = useState(
		confirmationModalInitialState
	);

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
				if (Array.isArray(data)) setDynamicSectors(data.map(s => s.name));
			})
			.catch(() => {});
	}, []);

	const [searchParam, setSearchParam] = useState("");
	const [crmChips, setCrmChips] = useState([]);
	const [nowTime, setNowTime] = useState(Date.now());
	const [reconnectingAll, setReconnectingAll] = useState(false);

	const history = useHistory();
	const [connectionTab, setConnectionTab] = useState("active"); // "active" | "archived"

	// Visualização: "columns" (uma coluna por setor) | "list" (tabela). Preferência salva no navegador.
	const [viewMode, setViewModeState] = useState(() => {
		try {
			const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
			return saved === "list" || saved === "columns" ? saved : "list";
		} catch (e) {
			return "list";
		}
	});

	const setViewMode = useCallback(mode => {
		setViewModeState(mode);
		try {
			localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
		} catch (e) {}
	}, []);

	const isArchivedWhatsapp = useCallback(w => {
		if (!w) return false;
		const name = (w.name || "").toUpperCase();
		return w.status === "archived" || name.startsWith("HISTÓRICO") || w.sector === "Arquivados";
	}, []);

	const activeCount = React.useMemo(() => {
		const visible = allowedSectors
			? (whatsApps || []).filter(w => allowedSectors.includes(w.sector || ""))
			: whatsApps || [];
		return visible.filter(w => !isArchivedWhatsapp(w)).length;
	}, [whatsApps, allowedSectors, isArchivedWhatsapp]);

	const archivedCount = React.useMemo(() => {
		const visible = allowedSectors
			? (whatsApps || []).filter(w => allowedSectors.includes(w.sector || ""))
			: whatsApps || [];
		return visible.filter(w => isArchivedWhatsapp(w)).length;
	}, [whatsApps, allowedSectors, isArchivedWhatsapp]);

	const loadCrmChips = useCallback(async () => {
		try {
			const { data } = await api.get("/whatsapp/crm-chips");
			if (data && Array.isArray(data.chips)) {
				setCrmChips(data.chips);
			}
		} catch (err) {
			// silencia falhas transitórias
		}
	}, []);

	useEffect(() => {
		loadCrmChips();
		const interval = setInterval(loadCrmChips, 15000);
		return () => clearInterval(interval);
	}, [loadCrmChips]);

	useEffect(() => {
		const ticker = setInterval(() => {
			setNowTime(Date.now());
		}, 1000);
		return () => clearInterval(ticker);
	}, []);

	const crmChipsIndex = React.useMemo(() => {
		const byPhone = new Map();
		const byLast4 = new Map();
		const byName = new Map();

		(crmChips || []).forEach(chip => {
			if (!chip) return;
			const rawPhone = String(chip.phone_number || "").replace(/\D/g, "");
			if (rawPhone) {
				byPhone.set(rawPhone, chip);
				const clean = rawPhone.startsWith("55") && rawPhone.length >= 12 ? rawPhone.slice(2) : rawPhone;
				byPhone.set(clean, chip);
				if (clean.length >= 8) {
					byPhone.set(clean.slice(-8), chip);
				}
				if (clean.length >= 4) {
					byLast4.set(clean.slice(-4), chip);
				}
			}
			if (chip.name) {
				const norm = String(chip.name).toLowerCase().replace(/[^a-z0-9]/g, "");
				if (norm) byName.set(norm, chip);
			}
		});

		return { byPhone, byLast4, byName };
	}, [crmChips]);

	const getMatchedChip = useCallback(
		whatsApp => {
			if (!whatsApp || !crmChipsIndex) return null;
			try {
				let waPhone = whatsApp.number ? String(whatsApp.number).replace(/\D/g, "") : "";
				if (!waPhone && whatsApp.session) {
					try {
						const sess = typeof whatsApp.session === "string" ? JSON.parse(whatsApp.session) : whatsApp.session;
						if (sess?.me?.id) {
							waPhone = String(sess.me.id).split("@")[0].split(":")[0].replace(/\D/g, "");
						}
					} catch (e) {}
				}

				if (waPhone) {
					const clean = waPhone.startsWith("55") && waPhone.length >= 12 ? waPhone.slice(2) : waPhone;
					const chip =
						crmChipsIndex.byPhone?.get(clean) ||
						crmChipsIndex.byPhone?.get(waPhone) ||
						crmChipsIndex.byPhone?.get(clean.slice(-8));
					if (chip) return chip;
				}

				if (whatsApp.name) {
					const digits = String(whatsApp.name).match(/\d{4,}/g);
					if (digits && digits.length > 0) {
						const last4 = digits[digits.length - 1].slice(-4);
						const chip = crmChipsIndex.byLast4?.get(last4);
						if (chip) return chip;
					}
				}

				if (whatsApp.name) {
					const norm = String(whatsApp.name).toLowerCase().replace(/[^a-z0-9]/g, "");
					if (norm) {
						const chip = crmChipsIndex.byName?.get(norm);
						if (chip) return chip;
					}
				}

				return null;
			} catch (e) {
				return null;
			}
		},
		[crmChipsIndex]
	);

	const sectorsList = React.useMemo(() => {
		const defaultOrder = dynamicSectors.length > 0 ? dynamicSectors : [
			"Junior",
			"Senior",
			"Pesquisa",
			"Comercial",
			"Juridico",
			"PA FIXA 1",
			"PA FIXA 2",
		];
		const presentSectors = new Set();
		whatsApps?.forEach(w => {
			if (!isArchivedWhatsapp(w) && w.sector) presentSectors.add(w.sector);
		});
		const merged = Array.from(new Set([...defaultOrder, ...presentSectors, ...dynamicSectors]));
		if (Array.isArray(allowedSectors) && allowedSectors.length > 0 && !isMaster) {
			return sortSectors(merged.filter(s => allowedSectors.includes(s)));
		}
		return sortSectors(merged);
	}, [whatsApps, allowedSectors, isArchivedWhatsapp, dynamicSectors, isMaster]);

	const sectorCounts = React.useMemo(() => {
		const visibleWhatsApps = allowedSectors
			? (whatsApps || []).filter(w => allowedSectors.includes(w.sector || ""))
			: whatsApps || [];
		const activeList = visibleWhatsApps.filter(w => !isArchivedWhatsapp(w));
		const counts = { TODOS: activeList.length };
		(sectorsList || []).forEach(sec => {
			counts[sec] = 0;
		});
		activeList.forEach(w => {
			const sec = w.sector || "Junior";
			counts[sec] = (counts[sec] || 0) + 1;
		});
		return counts;
	}, [whatsApps, allowedSectors, isArchivedWhatsapp, sectorsList]);

	const getStatusPriority = status => {
		if (status === "qrcode") return 1; // Prioridade Máxima: QR pronto na tela
		if (status === "DISCONNECTED") return 2; // Desconectado (precisa gerar QR/conectar)
		if (status === "OPENING") return 3; // Em abertura
		if (status === "CONNECTED") return 4; // Conectado
		return 5;
	};

	const filteredWhatsApps = React.useMemo(() => {
		let list = allowedSectors
			? (whatsApps || []).filter(w => allowedSectors.includes(w.sector || ""))
			: whatsApps || [];

		// Separação estrita de abas: Ativos vs Chamados Arquivados
		if (connectionTab === "active") {
			list = list.filter(w => !isArchivedWhatsapp(w));
			if (selectedSector !== "TODOS") {
				list = list.filter(w => (w.sector || "Junior") === selectedSector);
			}
		} else {
			list = list.filter(w => isArchivedWhatsapp(w));
		}

		if (searchParam && searchParam.trim() !== "") {
			const term = searchParam.trim().toLowerCase();
			list = list.filter(w => {
				const nameMatch = (w.name || "").toLowerCase().includes(term);
				const numberMatch =
					(w.number && String(w.number).toLowerCase().includes(term)) ||
					(w.phone_number && String(w.phone_number).toLowerCase().includes(term));
				const sectorMatch = (w.sector || "").toLowerCase().includes(term);
				const statusMatch = (w.status || "").toLowerCase().includes(term);
				const proxyMatch = (w.proxyUrl || "").toLowerCase().includes(term);
				const chip = getMatchedChip(w);
				const timerMatch =
					chip &&
					((chip.status && String(chip.status).toLowerCase().includes(term)) ||
						(chip.name && String(chip.name).toLowerCase().includes(term)));
				return nameMatch || numberMatch || sectorMatch || statusMatch || proxyMatch || timerMatch;
			});
		}

		if (connectionTab === "archived") {
			return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
		}

		// Prioridade absoluta: quem necessita de QR Code fica no topo!
		return [...list].sort((a, b) => {
			const pA = getStatusPriority(a.status);
			const pB = getStatusPriority(b.status);
			if (pA !== pB) {
				return pA - pB;
			}
			return (a.name || "").localeCompare(b.name || "");
		});
	}, [whatsApps, selectedSector, searchParam, getMatchedChip, allowedSectors, connectionTab, isArchivedWhatsapp]);

	// Agrupamento por setor para a visualização em colunas (mantém a ordenação de filteredWhatsApps)
	const boardColumns = React.useMemo(() => {
		const groups = new Map();
		(filteredWhatsApps || []).forEach(w => {
			const sec = w.sector || "Junior";
			if (!groups.has(sec)) groups.set(sec, []);
			groups.get(sec).push(w);
		});

		let order;
		if (connectionTab === "archived") {
			order = Array.from(groups.keys());
		} else if (selectedSector !== "TODOS") {
			order = [selectedSector];
		} else {
			order = [...(sectorsList || [])];
			groups.forEach((_, sec) => {
				if (!order.includes(sec)) order.push(sec);
			});
		}

		const hasSearch = searchParam && searchParam.trim() !== "";
		return order
			.map(sec => ({ sector: sec, items: groups.get(sec) || [] }))
			.filter(col => col.items.length > 0 || (!hasSearch && connectionTab === "active"));
	}, [filteredWhatsApps, connectionTab, selectedSector, sectorsList, searchParam]);

	const handleStartWhatsAppSession = async whatsAppId => {
		try {
			await api.post(`/whatsappsession/${whatsAppId}`);
		} catch (err) {
			toastError(err);
		}
	};

	const handleReconnectAll = async () => {
		try {
			setReconnectingAll(true);
			await api.post("/whatsappsession/start-all");
			toast.success("Reconexão iniciada! Aparelhos sem pareamento ativo exibirão o botão de QR Code.");
		} catch (err) {
			toastError(err);
		} finally {
			setTimeout(() => setReconnectingAll(false), 3000);
		}
	};


	const handleRequestNewQrCode = async whatsApp => {
		const whatsAppId = typeof whatsApp === "object" ? whatsApp.id : whatsApp;
		const targetWhatsApp = typeof whatsApp === "object" ? whatsApp : whatsApps?.find(w => w.id === whatsAppId);
		if (targetWhatsApp) {
			setSelectedWhatsApp(targetWhatsApp);
			setQrModalOpen(true);
		}
		try {
			await api.put(`/whatsappsession/${whatsAppId}`);
		} catch (err) {
			toastError(err);
		}
	};

	const handleOpenWhatsAppModal = () => {
		setSelectedWhatsApp(null);
		setWhatsAppModalOpen(true);
	};

	const handleCloseWhatsAppModal = useCallback(() => {
		setWhatsAppModalOpen(false);
		setSelectedWhatsApp(null);
		if (fetchWhatsApps) {
			fetchWhatsApps();
		}
	}, [setSelectedWhatsApp, setWhatsAppModalOpen, fetchWhatsApps]);

	const handleOpenQrModal = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setQrModalOpen(true);
	};

	const handleCloseQrModal = useCallback(() => {
		setSelectedWhatsApp(null);
		setQrModalOpen(false);
	}, [setQrModalOpen, setSelectedWhatsApp]);

	const handleEditWhatsApp = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setWhatsAppModalOpen(true);
	};

	const handleOpenConfirmationModal = (action, whatsAppId) => {
		if (action === "disconnect") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.disconnectTitle"),
				message: i18n.t("connections.confirmationModal.disconnectMessage"),
				whatsAppId: whatsAppId,
			});
		}

		if (action === "delete") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.deleteTitle"),
				message: i18n.t("connections.confirmationModal.deleteMessage"),
				whatsAppId: whatsAppId,
			});
		}
		setConfirmModalOpen(true);
	};

	const handleSubmitConfirmationModal = async () => {
		if (confirmModalInfo.action === "disconnect") {
			try {
				await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
				if (fetchWhatsApps) {
					await fetchWhatsApps();
				}
			} catch (err) {
				toastError(err);
			}
		}

		if (confirmModalInfo.action === "delete") {
			try {
				await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
				toast.success(i18n.t("connections.toasts.deleted"));
				if (fetchWhatsApps) {
					await fetchWhatsApps();
				}
			} catch (err) {
				toastError(err);
			}
		}

		setConfirmModalInfo(confirmationModalInitialState);
	};

	const handleToggleArchive = async whatsApp => {
		const isArch = isArchivedWhatsapp(whatsApp);
		try {
			if (isArch) {
				await api.put(`/whatsapp/${whatsApp.id}`, {
					name: whatsApp.name,
					status: "DISCONNECTED",
					sector: whatsApp.sector === "Arquivados" ? "Junior" : (whatsApp.sector || "Junior"),
					isDefault: whatsApp.isDefault,
					greetingMessage: whatsApp.greetingMessage,
					farewellMessage: whatsApp.farewellMessage,
					proxyUrl: whatsApp.proxyUrl,
					humanDelay: whatsApp.humanDelay
				});
				toast.success("Aparelho desarquivado! Movido para Conexões Ativas.");
			} else {
				await api.put(`/whatsapp/${whatsApp.id}`, {
					name: whatsApp.name,
					status: "archived",
					sector: whatsApp.sector || "Arquivados",
					isDefault: false,
					greetingMessage: whatsApp.greetingMessage,
					farewellMessage: whatsApp.farewellMessage,
					proxyUrl: whatsApp.proxyUrl,
					humanDelay: whatsApp.humanDelay
				});
				toast.success("Aparelho arquivado com sucesso!");
			}
			if (fetchWhatsApps) {
				await fetchWhatsApps();
			}
		} catch (err) {
			toastError(err);
		}
	};

	const renderSectorPill = sector => (
		<span className={classes.neutralChip}>{sector}</span>
	);

	const renderActionButtons = whatsApp => {
		if (isArchivedWhatsapp(whatsApp)) {
			return (
				<Button
					size="small"
					variant="contained"
					disableElevation
					className={clsx(classes.actionBtn, classes.auditBtn)}
					startIcon={<SearchOutlined />}
					onClick={() => history.push(`/audit?whatsappId=${whatsApp.id}`)}
				>
					Ver na Auditoria
				</Button>
			);
		}

		return (
			<>
				{(whatsApp.status === "qrcode" || (whatsApp.status === "OPENING" && whatsApp.qrcode)) && (
					<Button
						size="small"
						variant="contained"
						color="primary"
						className={classes.actionBtn}
						startIcon={<CropFree />}
						onClick={() => handleOpenQrModal(whatsApp)}
					>
						{i18n.t("connections.buttons.qrcode")}
					</Button>
				)}
				{whatsApp.status === "DISCONNECTED" && (
					<>
						<Button
							size="small"
							variant="outlined"
							color="primary"
							className={classes.actionBtn}
							startIcon={<Refresh />}
							onClick={() => handleStartWhatsAppSession(whatsApp.id)}
						>
							{i18n.t("connections.buttons.tryAgain")}
						</Button>
						<Button
							size="small"
							variant="outlined"
							className={classes.actionBtn}
							startIcon={<CropFree />}
							onClick={() => handleRequestNewQrCode(whatsApp)}
						>
							{i18n.t("connections.buttons.newQr")}
						</Button>
					</>
				)}
				{(whatsApp.status === "CONNECTED" ||
					whatsApp.status === "PAIRING" ||
					whatsApp.status === "TIMEOUT") && (
					<Button
						size="small"
						variant="outlined"
						className={clsx(classes.actionBtn, classes.dangerBtn)}
						startIcon={<LinkOff />}
						onClick={() => {
							handleOpenConfirmationModal("disconnect", whatsApp.id);
						}}
					>
						{i18n.t("connections.buttons.disconnect")}
					</Button>
				)}
				{whatsApp.status === "OPENING" && (
					<>
						<Button
							size="small"
							variant="outlined"
							disabled
							color="default"
							startIcon={<CircularProgress size={14} color="inherit" />}
						>
							{i18n.t("connections.buttons.connecting")}
						</Button>
						<Button
							size="small"
							variant="outlined"
							className={clsx(classes.actionBtn, classes.dangerBtn)}
							startIcon={<LinkOff />}
							onClick={() => handleOpenConfirmationModal("disconnect", whatsApp.id)}
						>
							{i18n.t("connections.buttons.disconnect")}
						</Button>
						<Button
							size="small"
							variant="outlined"
							color="primary"
							className={classes.actionBtn}
							startIcon={<CropFree />}
							onClick={() => handleRequestNewQrCode(whatsApp)}
						>
							{i18n.t("connections.buttons.newQr")}
						</Button>
					</>
				)}
			</>
		);
	};

	const renderStatusToolTips = whatsApp => {
		if (isArchivedWhatsapp(whatsApp)) {
			return (
				<CustomToolTip
					title="Linha / Chamado Arquivado"
					content="Histórico permanente importado do Digisac. Disponível para consulta no Cofre de Auditoria."
				>
					<span className={classes.statusText}>
						<span className={classes.statusDot} style={{ backgroundColor: theme.custom.textMuted }} />
						Arquivado
					</span>
				</CustomToolTip>
			);
		}

		const meta = getStatusMeta(whatsApp.status);
		const pill = (
			<span className={classes.statusText}>
				{whatsApp.status === "OPENING" ? (
					<CircularProgress size={9} thickness={6} color="inherit" />
				) : (
					<span className={classes.statusDot} style={{ backgroundColor: toneColor(theme, meta.tone) }} />
				)}
				{meta.label}
			</span>
		);

		if (!meta.tip) return pill;

		return (
			<CustomToolTip
				title={i18n.t(`connections.toolTips.${meta.tip}.title`)}
				content={meta.tip === "connected" ? null : i18n.t(`connections.toolTips.${meta.tip}.content`)}
			>
				<span>{pill}</span>
			</CustomToolTip>
		);
	};

	const renderTimerCell = whatsApp => {
		if (isArchivedWhatsapp(whatsApp)) {
			return (
				<span className={classes.timerMuted}>
					Arquivo Histórico
				</span>
			);
		}

		const muted = <span className={classes.timerMuted}>-</span>;
		const released = chip => (
			<Tooltip title={`WhatsApp Control CRM (Gestão de celulares): Chip liberado da restrição (${chip.status || "Liberado"})`} arrow>
				<span className={classes.statusText}>
					<span className={classes.statusDot} style={{ backgroundColor: toneColor(theme, "success") }} />
					Liberado
				</span>
			</Tooltip>
		);

		try {
			const chip = getMatchedChip(whatsApp);
			if (!chip) {
				return muted;
			}

			if (chip.alarm_active === 1) {
				return released(chip);
			}

			if (chip.restricted_until) {
				let targetTime = 0;
				let targetDate = null;
				try {
					targetDate = new Date(chip.restricted_until);
					targetTime = targetDate.getTime();
				} catch (e) {
					targetTime = NaN;
				}

				if (isNaN(targetTime)) {
					return muted;
				}

				const diff = targetTime - nowTime;

				if (diff <= 0) {
					return released(chip);
				}

				const days = Math.floor(diff / 8.64e7);
				const hrs = Math.floor((diff % 8.64e7) / 3.6e6);
				const mins = Math.floor((diff % 3.6e6) / 6e4);
				const secs = Math.floor((diff % 6e4) / 1000);

				const label =
					days > 0
						? `${days}d ${String(hrs).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m`
						: `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

				let formattedTarget = "";
				if (targetDate && !isNaN(targetDate.getTime())) {
					try {
						const day = String(targetDate.getDate()).padStart(2, "0");
						const month = String(targetDate.getMonth() + 1).padStart(2, "0");
						const hours = String(targetDate.getHours()).padStart(2, "0");
						const minutes = String(targetDate.getMinutes()).padStart(2, "0");
						formattedTarget = `${day}/${month} às ${hours}:${minutes}`;
					} catch (e) {
						formattedTarget = "";
					}
				}

				return (
					<Tooltip
						title={`WhatsApp Control CRM (Gestão de celulares): ${chip.status || "Restrito"}${formattedTarget ? ` • Até ${formattedTarget}` : ""}`}
						arrow
					>
						<span className={clsx(classes.statusText, classes.timerPill)}>
							<AccessTime style={{ fontSize: 14, color: toneColor(theme, "warning") }} />
							{label}
						</span>
					</Tooltip>
				);
			}

			return muted;
		} catch (err) {
			return muted;
		}
	};

	const renderEmptyMessage = () =>
		searchParam ? (
			<>Nenhuma conexão encontrada para "<strong>{searchParam}</strong>"{selectedSector !== "TODOS" ? ` no setor ${selectedSector}` : ""}.</>
		) : (
			<>Nenhum WhatsApp cadastrado no setor <strong>{selectedSector}</strong>.</>
		);

	const renderSkeletons = () =>
		[0, 1, 2, 3, 4, 5].map(i => (
			<TableRow key={i}>
				{[0, 1, 2, 3, 4, 5, 6, 7].map(j => (
					<TableCell key={j} className={classes.td}>
						<Skeleton height={20} />
					</TableCell>
				))}
			</TableRow>
		));

	const renderRow = whatsApp => {
		const archived = isArchivedWhatsapp(whatsApp);
		return (
			<TableRow key={whatsApp.id} className={clsx(classes.row, archived && classes.rowArchived)}>
				<TableCell className={classes.td}>
					<div className={classes.nameCell}>
						{archived ? <ArchiveOutlined className={classes.nameIcon} /> : <WhatsApp className={classes.nameIcon} />}
						<span className={classes.nameText} title={whatsApp.name}>{whatsApp.name}</span>
						{whatsApp.isDefault && (
							<Tooltip title={i18n.t("connections.table.default")} arrow>
								<Star className={classes.defaultStar} />
							</Tooltip>
						)}
						{whatsApp.proxyUrl && (
							<Tooltip title="Proxy dedicado ativo (IP isolado)" arrow>
								<LockOutlined className={classes.proxyIcon} />
							</Tooltip>
						)}
					</div>
				</TableCell>
				<TableCell className={classes.td} style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
					{getWhatsAppNumber(whatsApp) || "—"}
				</TableCell>
				<TableCell className={classes.td}>{renderStatusToolTips(whatsApp)}</TableCell>
				<TableCell className={classes.td}>{renderSectorPill(whatsApp.sector || "Junior")}</TableCell>
				<TableCell className={classes.td}>{renderTimerCell(whatsApp)}</TableCell>
				<TableCell className={classes.td}>
					<span className={classes.mutedText}>{formatDateTime(whatsApp.updatedAt)}</span>
				</TableCell>
				<TableCell className={classes.td}>
					<div className={classes.sessionActions}>{renderActionButtons(whatsApp)}</div>
				</TableCell>
				<TableCell className={classes.td} align="right">
					{renderRowActions(whatsApp, archived)}
				</TableCell>
			</TableRow>
		);
	};

	const renderTable = rows => (
		<Paper className={classes.tablePaper}>
			<div className={classes.tableWrap}>
				<Table size="small" className={classes.table}>
					<TableHead>
						<TableRow>
							<TableCell className={classes.th}>Nome</TableCell>
							<TableCell className={classes.th}>Número</TableCell>
							<TableCell className={classes.th}>Status</TableCell>
							<TableCell className={classes.th}>Setor</TableCell>
							<TableCell className={classes.th}>
								<Tooltip title="Gestão de celulares = Whatsapp control = CRM = Whatsapp Control CRM" arrow>
									<span className={classes.infoLabel}>Timer CRM <InfoOutlined /></span>
								</Tooltip>
							</TableCell>
							<TableCell className={classes.th}>Última atualização</TableCell>
							<TableCell className={classes.th}>Sessão</TableCell>
							<TableCell className={classes.th} align="right">Ações</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>{rows}</TableBody>
				</Table>
			</div>
		</Paper>
	);

	const renderRowActions = (whatsApp, archived) => (
		<div className={classes.rowActions}>
			<Tooltip title="Editar Configurações do Aparelho" arrow>
				<IconButton size="small" className={classes.iconBtn} onClick={() => handleEditWhatsApp(whatsApp)}>
					<Edit />
				</IconButton>
			</Tooltip>
			{archived ? (
				<Tooltip title="Desarquivar Aparelho (Mover para Ativos)" arrow>
					<IconButton size="small" className={classes.iconBtn} onClick={() => handleToggleArchive(whatsApp)}>
						<Unarchive />
					</IconButton>
				</Tooltip>
			) : (
				<Tooltip title="Arquivar Aparelho (Mover para Arquivados)" arrow>
					<IconButton size="small" className={classes.iconBtn} onClick={() => handleToggleArchive(whatsApp)}>
						<Archive />
					</IconButton>
				</Tooltip>
			)}
			<Tooltip title="Excluir Conexão" arrow>
				<IconButton
					size="small"
					className={clsx(classes.iconBtn, classes.deleteBtn)}
					onClick={() => handleOpenConfirmationModal("delete", whatsApp.id)}
				>
					<DeleteOutline />
				</IconButton>
			</Tooltip>
		</div>
	);

	const renderBoard = () => (
		<div className={classes.board}>
			{boardColumns.map(col => {
				const sectorColor = getSectorColor(col.sector);
				const colConnected = col.items.filter(w => w.status === "CONNECTED").length;
				return (
					<div key={col.sector} className={classes.boardColumn} style={{ borderTop: `3px solid ${sectorColor}` }}>
						<div className={classes.boardColumnHeader}>
							<span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: sectorColor, flexShrink: 0 }} />
							<span className={classes.boardColumnTitle}>{col.sector}</span>
							{connectionTab === "active" && col.items.length > 0 && (
								<Tooltip title={`${colConnected} conectado(s) de ${col.items.length}`} arrow>
									<span style={{ fontSize: "0.68rem", fontWeight: 700, color: toneColor(theme, "success") }}>
										{colConnected} on
									</span>
								</Tooltip>
							)}
							<span
								style={{
									fontSize: "0.68rem",
									fontWeight: 800,
									padding: "1px 7px",
									borderRadius: 10,
									backgroundColor: sectorColor,
									color: "#fff",
								}}
							>
								{col.items.length}
							</span>
						</div>
						<div className={classes.boardColumnBody}>
							{col.items.length === 0 ? (
								<div className={classes.boardEmpty}>Nenhuma conexão neste setor.</div>
							) : (
								col.items.map(whatsApp => {
									const archived = isArchivedWhatsapp(whatsApp);
									const phone = getWhatsAppNumber(whatsApp);
									return (
										<div key={whatsApp.id} className={classes.boardCard}>
											<Box display="flex" alignItems="flex-start" justifyContent="space-between" style={{ gap: 6 }}>
												<Box minWidth={0} flex={1}>
													<div className={classes.nameCell}>
														<span className={classes.nameText} title={whatsApp.name}>{whatsApp.name}</span>
														{whatsApp.isDefault && (
															<Tooltip title={i18n.t("connections.table.default")} arrow>
																<Star className={classes.defaultStar} />
															</Tooltip>
														)}
														{whatsApp.proxyUrl && (
															<Tooltip title="Proxy dedicado ativo (IP isolado)" arrow>
																<LockOutlined className={classes.proxyIcon} />
															</Tooltip>
														)}
													</div>
													<span className={classes.mutedText} style={{ display: "block", fontVariantNumeric: "tabular-nums" }}>
														{phone || "—"}
													</span>
												</Box>
												<div style={{ flexShrink: 0 }}>{renderStatusToolTips(whatsApp)}</div>
											</Box>
											<Box display="flex" alignItems="center" justifyContent="space-between" style={{ gap: 6 }}>
												{renderTimerCell(whatsApp)}
												<span className={classes.mutedText} style={{ whiteSpace: "nowrap" }}>
													{formatDateTime(whatsApp.updatedAt)}
												</span>
											</Box>
											<div className={classes.boardCardActions}>
												<div className={classes.sessionActions}>{renderActionButtons(whatsApp)}</div>
												{renderRowActions(whatsApp, archived)}
											</div>
										</div>
									);
								})
							)}
						</div>
					</div>
				);
			})}
		</div>
	);

	const totalVisible = activeCount + archivedCount;
	const connectedCount = (allowedSectors
		? (whatsApps || []).filter(w => allowedSectors.includes(w.sector || ""))
		: whatsApps || []
	).filter(w => !isArchivedWhatsapp(w) && w.status === "CONNECTED").length;

	return (
		<MainContainer>
			<ConfirmationModal
				title={confirmModalInfo.title}
				open={confirmModalOpen}
				onClose={setConfirmModalOpen}
				onConfirm={handleSubmitConfirmationModal}
			>
				{confirmModalInfo.message}
			</ConfirmationModal>
			<QrcodeModal
				open={qrModalOpen}
				onClose={handleCloseQrModal}
				whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
			/>
			<WhatsAppModal
				open={whatsAppModalOpen}
				onClose={handleCloseWhatsAppModal}
				whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
			/>
			<PageHeader
				icon={<WhatsApp />}
				tone="success"
				title={i18n.t("connections.title")}
				subtitle={
					loading
						? " "
						: `${activeCount} ${activeCount === 1 ? "conexão ativa" : "conexões ativas"} · ${connectedCount} ${
								connectedCount === 1 ? "conectada" : "conectadas"
						  }${archivedCount ? ` · ${archivedCount} ${archivedCount === 1 ? "arquivada" : "arquivadas"}` : ""}`
				}
				actions={
					<>
						{/* Alternância: Conexões Ativas vs Chamados Arquivados */}
						<div className={classes.segmented} role="tablist">
							<button
								type="button"
								role="tab"
								aria-selected={connectionTab === "active"}
								className={clsx(classes.segment, connectionTab === "active" && classes.segmentActive)}
								onClick={() => setConnectionTab("active")}
							>
								<PhonelinkRing />
								Ativos
								<span className={classes.segmentCount}>{activeCount}</span>
							</button>
							<button
								type="button"
								role="tab"
								aria-selected={connectionTab === "archived"}
								className={clsx(classes.segment, connectionTab === "archived" && classes.segmentArchivedActive)}
								onClick={() => setConnectionTab("archived")}
							>
								<ArchiveOutlined />
								Arquivados
								<span className={classes.segmentCount}>{archivedCount}</span>
							</button>
						</div>

						{!isMobile && (
							<div className={classes.segmented} role="group" aria-label="Modo de visualização">
								<Tooltip title="Visualizar em colunas por setor" arrow>
									<button
										type="button"
										aria-pressed={viewMode === "columns"}
										className={clsx(classes.segment, viewMode === "columns" && classes.segmentActive)}
										onClick={() => setViewMode("columns")}
									>
										<ViewColumnIcon />
										Colunas
									</button>
								</Tooltip>
								<Tooltip title="Visualizar em lista" arrow>
									<button
										type="button"
										aria-pressed={viewMode === "list"}
										className={clsx(classes.segment, viewMode === "list" && classes.segmentActive)}
										onClick={() => setViewMode("list")}
									>
										<ViewListIcon />
										Lista
									</button>
								</Tooltip>
							</div>
						)}

						<SearchField
							className={classes.search}
							placeholder="Buscar nome, número, setor..."
							type="search"
							value={searchParam}
							onChange={e => setSearchParam(e.target.value)}
							endAdornment={
								searchParam ? (
									<InputAdornment position="end">
										<IconButton
											size="small"
											className={classes.clearBtn}
											onClick={() => setSearchParam("")}
											aria-label="Limpar busca"
										>
											<ClearIcon fontSize="small" />
										</IconButton>
									</InputAdornment>
								) : null
							}
						/>
						{connectionTab === "active" && (
							<Tooltip
								title="Tentar reconectar todos os dispositivos desconectados. Se não conectarem, o botão de QR Code será exibido."
								arrow
							>
								<span>
									<Button
										variant="outlined"
										className={classes.headerBtn}
										disabled={reconnectingAll}
										onClick={handleReconnectAll}
										startIcon={
											<SyncIcon className={reconnectingAll ? classes.spin : ""} />
										}
									>
										{reconnectingAll ? "Tentando..." : "Tentar todos"}
									</Button>
								</span>
							</Tooltip>
						)}
						{connectionTab === "active" && (
							<Button
								variant="contained"
								color="primary"
								className={classes.headerBtn}
								startIcon={<Add />}
								onClick={handleOpenWhatsAppModal}
							>
								{i18n.t("connections.buttons.add")}
							</Button>
						)}
					</>
				}
			/>

			{/* Filtro por Setores (Ativos) OU Faixa Informativa (Arquivados) */}
			{connectionTab === "archived" ? (
				<Paper className={classes.archiveBanner}>
					<div className={classes.archiveBannerIcon}>
						<ArchiveOutlined />
					</div>
					<Typography component="div" className={classes.archiveBannerText}>
						<span className={classes.archiveBannerStrong}>Chamados e Linhas Arquivadas:</span>{" "}
						Todas as conversas e contatos legados importados do Digisac estão salvos nessas linhas e disponíveis no Cofre de Auditoria.
					</Typography>
					<Button
						size="small"
						variant="contained"
						disableElevation
						className={classes.archiveBtn}
						onClick={() => history.push("/audit")}
					>
						Abrir no Cofre de Auditoria
					</Button>
				</Paper>
			) : (
				<Paper className={classes.filterBar}>
					<span className={classes.filterLabel}>Filtrar setor</span>
					<button
						type="button"
						className={classes.filterChip}
						onClick={() => setSelectedSector("TODOS")}
						style={
							selectedSector === "TODOS"
								? {
										color: theme.palette.primary.main,
										backgroundColor: theme.custom.primarySoft,
										borderColor: alpha(theme.palette.primary.main, 0.35),
								  }
								: undefined
						}
					>
						TODOS
						<span className={classes.filterCount}>{sectorCounts.TODOS || 0}</span>
					</button>
					{sectorsList.map(sector => {
						const count = sectorCounts[sector] || 0;
						const isSelected = selectedSector === sector;
						return (
							<button
								type="button"
								key={sector}
								className={classes.filterChip}
								onClick={() => setSelectedSector(sector)}
								style={
									isSelected
										? {
												color: theme.palette.primary.main,
												backgroundColor: theme.custom.primarySoft,
												borderColor: alpha(theme.palette.primary.main, 0.35),
										  }
										: undefined
								}
							>
								{sector}
								<span className={classes.filterCount}>{count}</span>
							</button>
						);
					})}
				</Paper>
			)}

			<div className={classes.scroll} style={{ display: "flex", flexDirection: "column" }}>
				{loading ? (
					renderTable(renderSkeletons())
				) : !isMobile && viewMode === "columns" && boardColumns.length > 0 ? (
					renderBoard()
				) : filteredWhatsApps?.length > 0 ? (
					renderTable(filteredWhatsApps.map(whatsApp => renderRow(whatsApp)))
				) : (
					<Paper className={classes.emptyPaper}>
						<EmptyState
							icon={connectionTab === "archived" ? <ArchiveOutlined /> : <PhoneIphone />}
							title={
								searchParam
									? "Nenhuma conexão encontrada"
									: totalVisible === 0
									? "Nenhuma conexão ainda"
									: "Nada por aqui"
							}
							description={renderEmptyMessage()}
							action={
								connectionTab === "active" && !searchParam ? (
									<Button
										variant="contained"
										color="primary"
										startIcon={<Add />}
										onClick={handleOpenWhatsAppModal}
									>
										{i18n.t("connections.buttons.add")}
									</Button>
								) : null
							}
						/>
					</Paper>
				)}
			</div>
		</MainContainer>
	);
};

const ConnectionsErrorFallback = ({ error, errorInfo }) => {
	const classes = useStyles();
	return (
		<MainContainer>
			<PageHeader
				icon={<ErrorOutline />}
				tone="error"
				title="Conexões"
				subtitle="Ocorreu um erro ao carregar as conexões."
			/>
			<Paper className={classes.errorPaper}>
				<Typography variant="h6" gutterBottom>
					Ocorreu um erro ao carregar as conexões:
				</Typography>
				<Typography variant="body1" className={classes.errorMessage}>
					{String(error?.message || error || "Erro desconhecido")}
				</Typography>
				<pre className={classes.errorStack}>
					{String(error?.stack || "")}
					{"\n\nComponent Stack:\n"}
					{String(errorInfo?.componentStack || "")}
				</pre>
				<Button
					variant="contained"
					color="primary"
					onClick={() => window.location.reload()}
					style={{ marginTop: 16 }}
				>
					Recarregar
				</Button>
			</Paper>
		</MainContainer>
	);
};

class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null, errorInfo: null };
	}
	static getDerivedStateFromError(error) {
		return { hasError: true, error };
	}
	componentDidCatch(error, errorInfo) {
		console.error("ErrorBoundary em Connections:", error, errorInfo);
		this.setState({ errorInfo });
	}
	render() {
		if (this.state.hasError) {
			return (
				<ConnectionsErrorFallback
					error={this.state.error}
					errorInfo={this.state.errorInfo}
				/>
			);
		}
		return this.props.children;
	}
}

const ConnectionsWrapper = props => (
	<ErrorBoundary>
		<Connections {...props} />
	</ErrorBoundary>
);

export default ConnectionsWrapper;
