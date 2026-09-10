import React, { useState, useCallback, useContext } from "react";
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
} from "@material-ui/core";
import {
	Edit,
	CheckCircle,
	SignalCellularConnectedNoInternet2Bar,
	SignalCellularConnectedNoInternet0Bar,
	SignalCellular4Bar,
	CropFree,
	DeleteOutline,
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
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
	mainPaper: {
		flex: 1,
		padding: theme.spacing(1),
		overflowY: "scroll",
		...theme.scrollbarStyles,
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

	const { whatsApps, loading } = useContext(WhatsAppsContext);
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

	const [selectedSector, setSelectedSector] = useState("TODOS");

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
		return Array.from(new Set([...defaultOrder, ...presentSectors]));
	}, [whatsApps]);

	const sectorCounts = React.useMemo(() => {
		const counts = { TODOS: whatsApps?.length || 0 };
		whatsApps?.forEach(w => {
			const sec = w.sector || "Junior";
			counts[sec] = (counts[sec] || 0) + 1;
		});
		return counts;
	}, [whatsApps]);

	const getStatusPriority = status => {
		if (status === "qrcode") return 1; // Prioridade Máxima: QR pronto na tela
		if (status === "DISCONNECTED") return 2; // Desconectado (precisa gerar QR/conectar)
		if (status === "OPENING") return 3; // Em abertura
		if (status === "CONNECTED") return 4; // Conectado
		return 5;
	};

	const filteredWhatsApps = React.useMemo(() => {
		let list = whatsApps || [];
		if (selectedSector !== "TODOS") {
			list = list.filter(w => (w.sector || "Junior") === selectedSector);
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
	}, [whatsApps, selectedSector]);

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
	}, [setSelectedWhatsApp, setWhatsAppModalOpen]);

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
			<MainHeader>
				<Title>{i18n.t("connections.title")}</Title>
				<MainHeaderButtonsWrapper>
					<Button
						variant="contained"
						color="primary"
						onClick={handleOpenWhatsAppModal}
					>
						{i18n.t("connections.buttons.add")}
					</Button>
				</MainHeaderButtonsWrapper>
			</MainHeader>

			{/* Mini Filtro por Setores (Tema VERITAS) */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					flexWrap: "wrap",
					marginBottom: 12,
					padding: "10px 16px",
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
						fontSize: "0.72rem",
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
						height: 28,
						fontSize: "0.75rem",
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
								height: 28,
								fontSize: "0.75rem",
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
												{renderActionButtons(whatsApp)}
											</TableCell>
											<TableCell align="center">
												{format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm")}
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
										<TableCell colSpan={7} align="center">
											<Typography variant="body2" style={{ padding: "24px 0", color: "#64748b", fontWeight: 500 }}>
												Nenhum WhatsApp cadastrado no setor <strong>{selectedSector}</strong>.
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

export default Connections;
