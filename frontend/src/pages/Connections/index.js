import React, { useState, useCallback, useContext, useEffect } from "react";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
	Button,
	TableBody,
	TableRow,
	TableCell,
	IconButton,
	Table,
	TableHead,
	Paper,
	Tooltip,
	Typography,
	CircularProgress,
	Chip,
	TextField,
	InputAdornment,
} from "@material-ui/core";
import {
	Edit,
	CheckCircle,
	SignalCellularConnectedNoInternet2Bar,
	SignalCellularConnectedNoInternet0Bar,
	SignalCellular4Bar,
	CropFree,
	DeleteOutline,
	Search as SearchIcon,
	Clear as ClearIcon,
	AccessTime,
} from "@material-ui/icons";

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
		default:
			return "#6366f1";
	}
};

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

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
	mainPaper: {
		flex: 1,
		padding: theme.spacing(0.5),
		overflowY: "scroll",
		...theme.scrollbarStyles,
		"& .MuiTableCell-root": {
			padding: "5px 8px",
			fontSize: "0.78rem",
			lineHeight: 1.2,
		},
		"& .MuiTableHead-root .MuiTableCell-root": {
			padding: "7px 8px",
			fontSize: "0.72rem",
			fontWeight: 800,
		},
		"& .MuiButton-root": {
			minHeight: 34,
			padding: "4px 9px",
			fontSize: "0.72rem",
			borderRadius: 8,
		},
		"& .MuiIconButton-root": {
			padding: 5,
		},
	},
	pageHeader: {
		padding: "0 4px 4px",
		"& h1, & h2, & h3, & h4, & h5, & h6": {
			fontSize: "1rem",
			fontWeight: 800,
		},
	},
	sectorFilter: {
		display: "flex",
		alignItems: "center",
		gap: 6,
		flexWrap: "wrap",
		marginBottom: 8,
		padding: "6px 10px",
		backgroundColor: "#fff",
		borderRadius: 8,
		border: "1px solid rgba(0, 0, 0, 0.08)",
		boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
	},
	customTableCell: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	tooltip: {
		backgroundColor: "#f5f5f9",
		color: "rgba(0, 0, 0, 0.87)",
		fontSize: theme.typography.pxToRem(14),
		border: "1px solid #dadde9",
		maxWidth: 450,
	},
	tooltipPopper: {
		textAlign: "center",
	},
	buttonProgress: {
		color: green[500],
	},
}));

const CustomToolTip = ({ title, content, children }) => {
	const classes = useStyles();

	return (
		<Tooltip
			arrow
			classes={{
				tooltip: classes.tooltip,
				popper: classes.tooltipPopper,
			}}
			title={
				<React.Fragment>
					<Typography gutterBottom color="inherit">
						{title}
					</Typography>
					{content && <Typography>{content}</Typography>}
				</React.Fragment>
			}
		>
			{children}
		</Tooltip>
	);
};

const Connections = () => {
	const classes = useStyles();

	const { whatsApps, loading, fetchWhatsApps } = useContext(WhatsAppsContext);
	const { user } = useContext(AuthContext);
	const isRestrictedUser = user?.profile !== "admin";
	const allowedSectors = isRestrictedUser && user?.canAccessConnections
		? user.connectionSectors || []
		: isRestrictedUser
			? []
			: null;
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

	const [selectedSector, setSelectedSector] = useState(isWhatsappControl ? "TODOS" : "TODOS");
	const [searchParam, setSearchParam] = useState("");
	const [crmChips, setCrmChips] = useState([]);
	const [nowTime, setNowTime] = useState(Date.now());

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
		const defaultOrder = [
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
			if (w.sector) presentSectors.add(w.sector);
		});
		const sectors = Array.from(new Set([...defaultOrder, ...presentSectors]));
		return allowedSectors ? sectors.filter(sector => allowedSectors.includes(sector)) : sectors;
	}, [whatsApps, allowedSectors]);

	const sectorCounts = React.useMemo(() => {
		const visibleWhatsApps = allowedSectors
			? (whatsApps || []).filter(w => allowedSectors.includes(w.sector || ""))
			: whatsApps || [];
		const counts = { TODOS: visibleWhatsApps.length };
		visibleWhatsApps.forEach(w => {
			const sec = w.sector || "Junior";
			counts[sec] = (counts[sec] || 0) + 1;
		});
		return counts;
	}, [whatsApps, allowedSectors]);

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
		if (selectedSector !== "TODOS") {
			list = list.filter(w => (w.sector || "Junior") === selectedSector);
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

		// Prioridade absoluta: quem necessita de QR Code fica no topo!
		return [...list].sort((a, b) => {
			const pA = getStatusPriority(a.status);
			const pB = getStatusPriority(b.status);
			if (pA !== pB) {
				return pA - pB;
			}
			return (a.name || "").localeCompare(b.name || "");
		});
	}, [whatsApps, selectedSector, searchParam, getMatchedChip, allowedSectors]);

	const handleStartWhatsAppSession = async whatsAppId => {
		try {
			await api.post(`/whatsappsession/${whatsAppId}`);
		} catch (err) {
			toastError(err);
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
			} catch (err) {
				toastError(err);
			}
		}

		if (confirmModalInfo.action === "delete") {
			try {
				await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
				toast.success(i18n.t("connections.toasts.deleted"));
			} catch (err) {
				toastError(err);
			}
		}

		setConfirmModalInfo(confirmationModalInitialState);
	};

	const renderActionButtons = whatsApp => {
		return (
			<>
				{(whatsApp.status === "qrcode" || (whatsApp.status === "OPENING" && whatsApp.qrcode)) && (
					<Button
						size="small"
						variant="contained"
						color="primary"
						onClick={() => handleOpenQrModal(whatsApp)}
						style={{ marginRight: 6 }}
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
							onClick={() => handleStartWhatsAppSession(whatsApp.id)}
						>
							{i18n.t("connections.buttons.tryAgain")}
						</Button>{" "}
						<Button
							size="small"
							variant="outlined"
							color="secondary"
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
						color="secondary"
						onClick={() => {
							handleOpenConfirmationModal("disconnect", whatsApp.id);
						}}
					>
						{i18n.t("connections.buttons.disconnect")}
					</Button>
				)}
				{whatsApp.status === "OPENING" && (
					<>
						<Button size="small" variant="outlined" disabled color="default" style={{ marginRight: 6 }}>
							{i18n.t("connections.buttons.connecting")}
						</Button>
						<Button
							size="small"
							variant="outlined"
							color="secondary"
							onClick={() => handleOpenConfirmationModal("disconnect", whatsApp.id)}
							style={{ marginRight: 6 }}
						>
							{i18n.t("connections.buttons.disconnect")}
						</Button>
						<Button
							size="small"
							variant="outlined"
							color="primary"
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
		return (
			<div className={classes.customTableCell}>
				{whatsApp.status === "DISCONNECTED" && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.disconnected.title")}
						content={i18n.t("connections.toolTips.disconnected.content")}
					>
						<SignalCellularConnectedNoInternet0Bar color="secondary" />
					</CustomToolTip>
				)}
				{whatsApp.status === "OPENING" && (
					<CircularProgress size={24} className={classes.buttonProgress} />
				)}
				{whatsApp.status === "qrcode" && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.qrcode.title")}
						content={i18n.t("connections.toolTips.qrcode.content")}
					>
						<CropFree />
					</CustomToolTip>
				)}
				{whatsApp.status === "CONNECTED" && (
					<CustomToolTip title={i18n.t("connections.toolTips.connected.title")}>
						<SignalCellular4Bar style={{ color: green[500] }} />
					</CustomToolTip>
				)}
				{(whatsApp.status === "TIMEOUT" || whatsApp.status === "PAIRING") && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.timeout.title")}
						content={i18n.t("connections.toolTips.timeout.content")}
					>
						<SignalCellularConnectedNoInternet2Bar color="secondary" />
					</CustomToolTip>
				)}
			</div>
		);
	};

	const renderTimerCell = whatsApp => {
		try {
			const chip = getMatchedChip(whatsApp);
			if (!chip) {
				return (
					<Typography variant="body2" style={{ color: "#cbd5e1", fontSize: "0.85rem", fontWeight: 600 }}>
						-
					</Typography>
				);
			}

			if (chip.alarm_active === 1) {
				return (
					<Tooltip title={`WhatsApp Control: Chip liberado da restrição (${chip.status || "Liberado"})`} arrow>
						<span
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 4,
								padding: "3px 8px",
								borderRadius: 12,
								backgroundColor: "#f0fdf4",
								border: "1px solid #bbf7d0",
								color: "#15803d",
								fontWeight: 700,
								fontSize: "0.74rem",
								letterSpacing: "0.2px",
							}}
						>
							<span style={{ fontSize: "0.75rem" }}>⏰</span>
							Liberado
						</span>
					</Tooltip>
				);
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
					return (
						<Typography variant="body2" style={{ color: "#cbd5e1", fontSize: "0.85rem", fontWeight: 600 }}>
							-
						</Typography>
					);
				}

				const diff = targetTime - nowTime;

				if (diff <= 0) {
					return (
						<Tooltip title={`WhatsApp Control: Chip liberado da restrição (${chip.status || "Liberado"})`} arrow>
							<span
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 4,
									padding: "3px 8px",
									borderRadius: 12,
									backgroundColor: "#f0fdf4",
									border: "1px solid #bbf7d0",
									color: "#15803d",
									fontWeight: 700,
									fontSize: "0.74rem",
									letterSpacing: "0.2px",
								}}
							>
								<span style={{ fontSize: "0.75rem" }}>⏰</span>
								Liberado
							</span>
						</Tooltip>
					);
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
						title={`WhatsApp Control: ${chip.status || "Restrito"}${formattedTarget ? ` • Até ${formattedTarget}` : ""}`}
						arrow
					>
						<span
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 4,
								padding: "3px 8px",
								borderRadius: 12,
								backgroundColor: "#fffbeb",
								border: "1px solid #fef3c7",
								boxShadow: "0 1px 2px rgba(217, 119, 6, 0.08)",
								color: "#b45309",
								fontWeight: 700,
								fontFamily: "monospace",
								fontSize: "0.78rem",
								letterSpacing: "0.4px",
							}}
						>
							<AccessTime style={{ fontSize: 13, color: "#d97706" }} />
							{label}
						</span>
					</Tooltip>
				);
			}

			return (
				<Typography variant="body2" style={{ color: "#cbd5e1", fontSize: "0.85rem", fontWeight: 600 }}>
					-
				</Typography>
			);
		} catch (err) {
			return (
				<Typography variant="body2" style={{ color: "#cbd5e1", fontSize: "0.85rem", fontWeight: 600 }}>
					-
				</Typography>
			);
		}
	};

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
			<div className={classes.pageHeader}>
			<MainHeader>
				<Title>{i18n.t("connections.title")}</Title>
				<MainHeaderButtonsWrapper>
					<TextField
						placeholder="Buscar por nome, número, setor ou status..."
						type="search"
						variant="outlined"
						size="small"
						value={searchParam}
						onChange={e => setSearchParam(e.target.value)}
						InputProps={{
							startAdornment: (
								<InputAdornment position="start">
									<SearchIcon style={{ color: "#64748b", fontSize: 20 }} />
								</InputAdornment>
							),
							endAdornment: searchParam ? (
								<InputAdornment position="end">
									<IconButton
										size="small"
										onClick={() => setSearchParam("")}
										style={{ padding: 2 }}
									>
										<ClearIcon fontSize="small" style={{ color: "#94a3b8" }} />
									</IconButton>
								</InputAdornment>
							) : null,
							style: {
								borderRadius: 8,
								backgroundColor: "#fff",
								fontSize: "0.85rem",
								height: 38,
							},
						}}
						style={{ minWidth: 260 }}
					/>
					<Button
						variant="contained"
						color="primary"
						onClick={handleOpenWhatsAppModal}
						style={{
							height: 34,
							borderRadius: 8,
							fontWeight: 700,
						}}
					>
						{i18n.t("connections.buttons.add")}
					</Button>
				</MainHeaderButtonsWrapper>
			</MainHeader>
			</div>

			{/* Mini Filtro por Setores (Tema VERITAS) */}
			<div
				className={classes.sectorFilter}
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					flexWrap: "wrap",
					marginBottom: 8,
					padding: "6px 10px",
					backgroundColor: "#fff",
					borderRadius: 8,
					border: "1px solid rgba(0, 0, 0, 0.08)",
					boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
				}}
			>
				<Typography
					variant="body2"
					style={{
						fontWeight: 800,
						color: "#334155",
						marginRight: 6,
						textTransform: "uppercase",
						fontSize: "0.68rem",
						letterSpacing: "0.6px",
					}}
				>
					Filtrar Setor:
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
					}}
				/>
				{sectorsList.map(sector => {
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
								backgroundColor: isSelected ? sectorColor : "transparent",
								borderColor: sectorColor,
								color: isSelected ? "#fff" : sectorColor,
							}}
						/>
					);
				})}
			</div>

			<Paper className={classes.mainPaper} variant="outlined">
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell align="center">
								{i18n.t("connections.table.name")}
							</TableCell>
							<TableCell align="center">
								Setor
							</TableCell>
							<TableCell align="center">
								{i18n.t("connections.table.status")}
							</TableCell>
							<TableCell align="center">
								Timer
							</TableCell>
							<TableCell align="center">
								{i18n.t("connections.table.session")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("connections.table.lastUpdate")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("connections.table.default")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("connections.table.actions")}
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{loading ? (
							<TableRowSkeleton />
						) : (
							<>
								{filteredWhatsApps?.length > 0 &&
									filteredWhatsApps.map(whatsApp => (
										<TableRow key={whatsApp.id}>
											<TableCell align="center">
												<div style={{ fontWeight: 600 }}>{whatsApp.name}</div>
												{whatsApp.proxyUrl && (
													<Typography
														variant="caption"
														style={{
															color: "#16a34a",
															fontWeight: 600,
															display: "block",
															fontSize: "0.72rem"
														}}
													>
														🔒 Proxy Ativo
													</Typography>
												)}
											</TableCell>
											<TableCell align="center">
												<Chip
													label={whatsApp.sector || "Junior"}
													size="small"
													style={{
														backgroundColor: getSectorColor(whatsApp.sector || "Junior"),
														color: "#fff",
														fontWeight: 700,
														fontSize: "0.72rem",
														borderRadius: 4,
														height: 22,
													}}
												/>
											</TableCell>
											<TableCell align="center">
												{renderStatusToolTips(whatsApp)}
											</TableCell>
											<TableCell align="center">
												{renderTimerCell(whatsApp)}
											</TableCell>
											<TableCell align="center">
												{renderActionButtons(whatsApp)}
											</TableCell>
											<TableCell align="center">
												{formatDateTime(whatsApp.updatedAt)}
											</TableCell>
											<TableCell align="center">
												{whatsApp.isDefault && (
													<div className={classes.customTableCell}>
														<CheckCircle style={{ color: green[500] }} />
													</div>
												)}
											</TableCell>
											<TableCell align="center">
												<IconButton
													size="small"
													onClick={() => handleEditWhatsApp(whatsApp)}
												>
													<Edit />
												</IconButton>

												<IconButton
													size="small"
													onClick={e => {
														handleOpenConfirmationModal("delete", whatsApp.id);
													}}
												>
													<DeleteOutline />
												</IconButton>
											</TableCell>
										</TableRow>
									))}
								{filteredWhatsApps?.length === 0 && (
									<TableRow>
										<TableCell colSpan={8} align="center">
											<Typography variant="body2" style={{ padding: "28px 0", color: "#64748b", fontWeight: 500 }}>
												{searchParam ? (
													<>Nenhuma conexão encontrada para "<strong>{searchParam}</strong>"{selectedSector !== "TODOS" ? ` no setor ${selectedSector}` : ""}.</>
												) : (
													<>Nenhum WhatsApp cadastrado no setor <strong>{selectedSector}</strong>.</>
												)}
											</Typography>
										</TableCell>
									</TableRow>
								)}
							</>
						)}
					</TableBody>
				</Table>
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
				<MainContainer>
					<MainHeader>
						<Title>Conexões</Title>
					</MainHeader>
					<Paper style={{ padding: 24, margin: 16 }}>
						<Typography variant="h6" color="secondary" gutterBottom>
							Ocorreu um erro ao carregar as conexões:
						</Typography>
						<Typography variant="body1" style={{ color: "#b91c1c", fontWeight: 700, margin: "12px 0", background: "#fef2f2", padding: 12, borderRadius: 6 }}>
							{String(this.state.error?.message || this.state.error || "Erro desconhecido")}
						</Typography>
						<pre style={{ fontSize: "0.75rem", background: "#f8fafc", color: "#334155", padding: 12, borderRadius: 6, overflowX: "auto", maxHeight: 300 }}>
							{String(this.state.error?.stack || "")}
							{"\n\nComponent Stack:\n"}
							{String(this.state.errorInfo?.componentStack || "")}
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
