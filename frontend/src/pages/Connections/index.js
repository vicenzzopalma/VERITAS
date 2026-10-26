import React, { useState, useCallback, useContext } from "react";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";

import { makeStyles, alpha, useTheme } from "@material-ui/core/styles";
import { Button, IconButton, Paper, Tooltip, CircularProgress } from "@material-ui/core";
import Skeleton from "@material-ui/lab/Skeleton";
import {
	Edit,
	DeleteOutline,
	WhatsApp,
	Add,
	Star,
	Schedule,
	CropFree,
	Refresh,
	LinkOff,
	PhoneIphone,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import { PageHeader, StatusPill, EmptyState, toneColor } from "../../components/ui";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";

const WHATSAPP_GREEN = "#25D366";

const useStyles = makeStyles(theme => {
	const c = theme.custom;
	return {
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
			gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
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
		cardBody: {
			padding: theme.spacing(2.25, 2.25, 2),
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing(1.75),
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
			backgroundColor: alpha(WHATSAPP_GREEN, theme.palette.type === "dark" ? 0.16 : 0.12),
			"& svg": { fontSize: 24 },
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
			fontSize: "0.98rem",
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
		deleteBtn: {
			"&:hover": {
				color: theme.palette.error.main,
				backgroundColor: alpha(theme.palette.error.main, 0.08),
			},
		},
		pills: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: theme.spacing(0.75) },
		defaultPill: { "& svg": { fontSize: 13 } },
		statusHint: {
			fontSize: "0.8rem",
			lineHeight: 1.45,
			color: c.textMuted,
			padding: theme.spacing(1.25, 1.5),
			borderRadius: 10,
			backgroundColor: c.surfaceAlt,
			border: `1px solid ${c.border}`,
		},
		cardFooter: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: theme.spacing(1),
			padding: theme.spacing(1.5, 2.25),
			borderTop: `1px solid ${c.border}`,
			backgroundColor: c.surfaceAlt,
			minHeight: 58,
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
		emptyPaper: { borderRadius: 16 },
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

const safeFormatDate = value => {
	try {
		return format(parseISO(value), "dd/MM/yy HH:mm");
	} catch (e) {
		return "-";
	}
};

const Connections = () => {
	const classes = useStyles();
	const theme = useTheme();

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

	const handleStartWhatsAppSession = async whatsAppId => {
		try {
			await api.post(`/whatsappsession/${whatsAppId}`);
		} catch (err) {
			toastError(err);
		}
	};

	const handleRequestNewQrCode = async whatsAppId => {
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
				{whatsApp.status === "qrcode" && (
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
							onClick={() => handleRequestNewQrCode(whatsApp.id)}
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
						className={`${classes.actionBtn} ${classes.dangerBtn}`}
						startIcon={<LinkOff />}
						onClick={() => {
							handleOpenConfirmationModal("disconnect", whatsApp.id);
						}}
					>
						{i18n.t("connections.buttons.disconnect")}
					</Button>
				)}
				{whatsApp.status === "OPENING" && (
					<Button
						size="small"
						variant="outlined"
						disabled
						color="default"
						startIcon={<CircularProgress size={14} color="inherit" />}
					>
						{i18n.t("connections.buttons.connecting")}
					</Button>
				)}
			</>
		);
	};

	const renderStatus = whatsApp => {
		const meta = getStatusMeta(whatsApp.status);
		const tipTitle = meta.tip
			? i18n.t(`connections.toolTips.${meta.tip}.title`)
			: null;
		const pill = (
			<StatusPill tone={meta.tone}>
				{i18n.t(`connections.status.${whatsApp.status}`, {
					defaultValue: meta.label,
				})}
			</StatusPill>
		);
		return tipTitle ? (
			<Tooltip title={tipTitle}>
				<span>{pill}</span>
			</Tooltip>
		) : (
			pill
		);
	};

	const renderStatusHint = whatsApp => {
		const meta = getStatusMeta(whatsApp.status);
		if (!meta.tip || meta.tip === "connected") return null;
		return (
			<div className={classes.statusHint}>
				{i18n.t(`connections.toolTips.${meta.tip}.content`)}
			</div>
		);
	};

	const renderSkeletons = () =>
		[0, 1, 2].map(i => (
			<Paper key={i} className={classes.card}>
				<div className={classes.cardBody}>
					<div className={classes.cardTop}>
						<Skeleton variant="rect" width={44} height={44} style={{ borderRadius: 12 }} />
						<div className={classes.nameBlock}>
							<Skeleton width="60%" height={22} />
							<Skeleton width="40%" height={16} />
						</div>
					</div>
					<Skeleton width={110} height={26} style={{ borderRadius: 999 }} />
				</div>
				<div className={classes.cardFooter}>
					<Skeleton width={120} height={32} />
				</div>
			</Paper>
		));

	const total = whatsApps?.length || 0;
	const connectedCount = (whatsApps || []).filter(w => w.status === "CONNECTED").length;

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
						: `${total} ${total === 1 ? "conexão" : "conexões"} · ${connectedCount} ${
								connectedCount === 1 ? "ativa" : "ativas"
						  }`
				}
				actions={
					<Button
						variant="contained"
						color="primary"
						startIcon={<Add />}
						onClick={handleOpenWhatsAppModal}
					>
						{i18n.t("connections.buttons.add")}
					</Button>
				}
			/>
			<div className={classes.scroll}>
				{loading ? (
					<div className={classes.grid}>{renderSkeletons()}</div>
				) : total === 0 ? (
					<Paper className={classes.emptyPaper}>
						<EmptyState
							icon={<PhoneIphone />}
							title="Nenhuma conexão ainda"
							description="Adicione um número de WhatsApp para começar a receber e responder atendimentos."
							action={
								<Button
									variant="contained"
									color="primary"
									startIcon={<Add />}
									onClick={handleOpenWhatsAppModal}
								>
									{i18n.t("connections.buttons.add")}
								</Button>
							}
						/>
					</Paper>
				) : (
					<div className={classes.grid}>
						{whatsApps.map(whatsApp => {
							const meta = getStatusMeta(whatsApp.status);
							return (
								<Paper key={whatsApp.id} className={classes.card}>
									<div className={classes.cardBody}>
										<div className={classes.cardTop}>
											<div className={classes.iconTile}>
												<WhatsApp />
												<span
													className={classes.liveDot}
													style={{ backgroundColor: toneColor(theme, meta.tone) }}
												/>
											</div>
											<div className={classes.nameBlock}>
												<div className={classes.name} title={whatsApp.name}>
													{whatsApp.name}
												</div>
												<div className={classes.meta}>
													<Schedule />
													<span>
														{i18n.t("connections.table.lastUpdate")}:{" "}
														{safeFormatDate(whatsApp.updatedAt)}
													</span>
												</div>
											</div>
											<div className={classes.topActions}>
												<Tooltip title={i18n.t("whatsappModal.title.edit")}>
													<IconButton
														size="small"
														className={classes.iconBtn}
														onClick={() => handleEditWhatsApp(whatsApp)}
													>
														<Edit />
													</IconButton>
												</Tooltip>
												<Tooltip title={i18n.t("connections.confirmationModal.deleteTitle")}>
													<IconButton
														size="small"
														className={`${classes.iconBtn} ${classes.deleteBtn}`}
														onClick={e => {
															handleOpenConfirmationModal("delete", whatsApp.id);
														}}
													>
														<DeleteOutline />
													</IconButton>
												</Tooltip>
											</div>
										</div>
										<div className={classes.pills}>
											{renderStatus(whatsApp)}
											{whatsApp.isDefault && (
												<StatusPill tone="primary" dot={false} className={classes.defaultPill}>
													<Star />
													{i18n.t("connections.table.default")}
												</StatusPill>
											)}
										</div>
										{renderStatusHint(whatsApp)}
									</div>
									<div className={classes.cardFooter}>
										<span className={classes.footerLabel}>
											{i18n.t("connections.table.session")}
										</span>
										{renderActionButtons(whatsApp)}
									</div>
								</Paper>
							);
						})}
					</div>
				)}
			</div>
		</MainContainer>
	);
};

export default Connections;
