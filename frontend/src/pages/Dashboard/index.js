import React, { useContext, useState, useEffect, useCallback } from "react";
import { Link as RouterLink } from "react-router-dom";

import Grid from "@material-ui/core/Grid";
import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import LinearProgress from "@material-ui/core/LinearProgress";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import RefreshIcon from "@material-ui/icons/Refresh";
import StorageIcon from "@material-ui/icons/Storage";
import PermMediaIcon from "@material-ui/icons/PermMedia";
import AllInboxIcon from "@material-ui/icons/AllInbox";
import SmartphoneIcon from "@material-ui/icons/Smartphone";
import HeadsetMicOutlined from "@material-ui/icons/HeadsetMicOutlined";
import HourglassEmptyOutlined from "@material-ui/icons/HourglassEmptyOutlined";
import CheckCircleOutline from "@material-ui/icons/CheckCircleOutline";
import WifiTethering from "@material-ui/icons/WifiTethering";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import SecurityOutlined from "@material-ui/icons/SecurityOutlined";
import SyncAlt from "@material-ui/icons/SyncAlt";
import QuestionAnswerOutlined from "@material-ui/icons/QuestionAnswerOutlined";
import PhoneAndroidOutlined from "@material-ui/icons/PhoneAndroidOutlined";
import ArrowForward from "@material-ui/icons/ArrowForward";

import { AuthContext } from "../../context/Auth/AuthContext";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import rules from "../../rules";
import { PageHeader, StatCard, SectionCard, StatusPill, EmptyState } from "../../components/ui";
import Chart from "./Chart";

const STATUS_TONE = {
	CONNECTED: ["success", "Conectado"],
	qrcode: ["warning", "Aguardando QR"],
	PAIRING: ["warning", "Pareando"],
	OPENING: ["info", "Abrindo"],
	DISCONNECTED: ["error", "Desconectado"],
	TIMEOUT: ["error", "Tempo esgotado"],
};

// Atalhos do fluxo. `perform` segue as mesmas regras de permissão (rules.js)
// usadas no menu lateral: quem não tem a permissão não vê o atalho.
// Operadores e perfis whatsapp_control nunca chegam ao Dashboard (Route.js
// os redireciona para /live e /whatsapp-control).
const FLOW = [
	{
		to: "/connections",
		title: "Conectar WhatsApp",
		desc: "Pareie números e monitore o status de cada sessão.",
		icon: <SyncAlt />,
		color: "#0EA5E9",
	},
	{
		to: "/whatsapp-control",
		title: "CRM",
		desc: "Acompanhe os aparelhos e conversas monitoradas.",
		icon: <PhoneAndroidOutlined />,
		color: "#14B8A6",
	},
	{
		to: "/tickets",
		title: "Atender tickets",
		desc: "Responda conversas, transfira e finalize atendimentos.",
		icon: <WhatsAppIcon />,
		color: "#22C55E",
	},
	{
		to: "/quickAnswers",
		title: "Respostas rápidas",
		desc: "Padronize mensagens com atalhos reutilizáveis.",
		icon: <QuestionAnswerOutlined />,
		color: "#F59E0B",
	},
	{
		to: "/audit",
		perform: "audit:view",
		title: "Auditar e exportar",
		desc: "Busque no histórico completo e gere evidências.",
		icon: <SecurityOutlined />,
		color: "#5B4CF0",
	},
];

const can = (role, action) => {
	const permissions = rules[role];
	return Boolean(permissions && permissions.static && permissions.static.includes(action));
};

const useStyles = makeStyles(theme => {
	const c = theme.custom;
	return {
		page: {
			width: "100%",
			maxWidth: 1440,
			margin: "0 auto",
			padding: theme.spacing(0, 3, 4),
			[theme.breakpoints.down("xs")]: { padding: theme.spacing(0, 1.5, 3) },
		},
		fill: { height: "100%" },
		code: {
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
			fontSize: "0.92em",
			padding: "1px 5px",
			borderRadius: 6,
			backgroundColor: c.surfaceAlt,
			border: `1px solid ${c.border}`,
		},
		refreshBtn: { border: `1px solid ${c.border}` },
		connRow: {
			display: "flex",
			alignItems: "center",
			gap: 12,
			padding: "11px 0",
			"& + &": { borderTop: `1px solid ${c.border}` },
		},
		connIcon: {
			width: 36,
			height: 36,
			borderRadius: 10,
			display: "grid",
			placeItems: "center",
			backgroundColor: "rgba(37,211,102,0.12)",
			color: "#1FAF55",
			flex: "none",
			"& svg": { fontSize: 19 },
		},
		connName: {
			flex: 1,
			minWidth: 0,
			fontWeight: 600,
			fontSize: "0.88rem",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		link: {
			fontSize: "0.8rem",
			fontWeight: 650,
			textDecoration: "none",
			color: theme.palette.primary.main,
		},
		strong: { fontWeight: 600 },
		total: { fontWeight: 700, color: theme.palette.primary.main },
		progressWrap: { display: "flex", alignItems: "center", gap: 8, minWidth: 130 },
		progressBar: { flex: 1 },
		emptyCell: { padding: 24, color: c.textMuted },
		flow: {
			display: "grid",
			gridTemplateColumns: "repeat(var(--flow-cols, 4), minmax(0, 1fr))",
			gap: theme.spacing(3),
			padding: theme.spacing(3),
			borderRadius: "0 0 16px 16px",
			...c.dotGrid,
			[theme.breakpoints.down("sm")]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
			[theme.breakpoints.down("xs")]: { gridTemplateColumns: "1fr" },
		},
		node: {
			position: "relative",
			display: "flex",
			flexDirection: "column",
			gap: 8,
			padding: 16,
			borderRadius: 14,
			backgroundColor: c.surface,
			border: `1px solid ${c.border}`,
			boxShadow: c.shadow,
			color: "inherit",
			textDecoration: "none",
			transition: "transform .18s, box-shadow .18s, border-color .18s",
			"&:hover": {
				transform: "translateY(-2px)",
				boxShadow: c.shadowLg,
				borderColor: theme.palette.primary.main,
			},
			"&:hover $nodeArrow": { opacity: 1, transform: "none" },
			[theme.breakpoints.up("md")]: {
				"&:not(:last-child)::after": {
					content: '""',
					position: "absolute",
					top: "50%",
					right: -theme.spacing(3) - 1,
					width: theme.spacing(3),
					borderTop: `2px dashed ${c.borderStrong}`,
				},
			},
		},
		nodeHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 2 },
		nodeIcon: {
			width: 32,
			height: 32,
			borderRadius: 9,
			display: "grid",
			placeItems: "center",
			color: "#fff",
			"& svg": { fontSize: 18 },
		},
		nodeStep: {
			fontSize: "0.68rem",
			fontWeight: 700,
			letterSpacing: "0.08em",
			textTransform: "uppercase",
			color: c.textSubtle,
		},
		nodeTitle: { fontWeight: 700, fontSize: "0.92rem" },
		nodeDesc: { fontSize: "0.8rem", color: c.textMuted, lineHeight: 1.45 },
		nodeArrow: {
			marginLeft: "auto",
			fontSize: 18,
			color: theme.palette.primary.main,
			opacity: 0,
			transform: "translateX(-4px)",
			transition: "all .18s",
		},
	};
});

const greeting = () => {
	const h = new Date().getHours();
	if (h < 12) return "Bom dia";
	if (h < 18) return "Boa tarde";
	return "Boa noite";
};

const Dashboard = () => {
	const classes = useStyles();
	const { user } = useContext(AuthContext);
	// Lista já carregada globalmente pelo WhatsAppsProvider (sem requisição extra).
	const { whatsApps = [] } = useContext(WhatsAppsContext) || {};

	const [storageData, setStorageData] = useState(null);
	const [loadingStorage, setLoadingStorage] = useState(false);

	const fetchStorageStats = useCallback(async () => {
		setLoadingStorage(true);
		try {
			const { data } = await api.get("/dashboard/storage-stats");
			setStorageData(data);
		} catch (err) {
			toastError(err);
		} finally {
			setLoadingStorage(false);
		}
	}, []);

	useEffect(() => {
		fetchStorageStats();
	}, [fetchStorageStats]);

	const openCount = storageData?.overview?.openTickets ?? 0;
	const pendingCount = storageData?.overview?.pendingTickets ?? 0;
	const closedCount = storageData?.overview?.closedTickets ?? 0;
	const initialLoading = loadingStorage && !storageData;
	const countValue = value => (initialLoading ? <CircularProgress size={24} /> : value);

	const connected = whatsApps.filter(w => w.status === "CONNECTED").length;
	const allOnline = whatsApps.length > 0 && connected === whatsApps.length;
	const firstName = (user?.name || "").split(" ")[0];
	const today = new Date().toLocaleDateString("pt-BR", {
		weekday: "long",
		day: "numeric",
		month: "long",
	});

	const flow = FLOW.filter(n => !n.perform || can(user?.profile, n.perform));

	const refreshButton = (
		<Tooltip title="Atualizar Métricas de Armazenamento">
			<span>
				<IconButton
					size="small"
					onClick={fetchStorageStats}
					disabled={loadingStorage}
					className={classes.refreshBtn}
				>
					{loadingStorage ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
				</IconButton>
			</span>
		</Tooltip>
	);

	return (
		<div className={`${classes.page} gisaio-page-enter`}>
			<PageHeader
				title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
				subtitle={`Resumo da operação · ${today}`}
			/>

			<Grid container spacing={2}>
				{/* 1. CARDS DE ATENDIMENTO */}
				<Grid item xs={12} sm={6} md={3}>
					<StatCard
						label={i18n.t("dashboard.messages.inAttendance.title")}
						value={countValue(openCount)}
						icon={<HeadsetMicOutlined />}
						tone="primary"
						footer="Tickets abertos agora"
					/>
				</Grid>
				<Grid item xs={12} sm={6} md={3}>
					<StatCard
						label={i18n.t("dashboard.messages.waiting.title")}
						value={countValue(pendingCount)}
						icon={<HourglassEmptyOutlined />}
						tone="warning"
						footer="Na fila aguardando atendente"
					/>
				</Grid>
				<Grid item xs={12} sm={6} md={3}>
					<StatCard
						label={i18n.t("dashboard.messages.closed.title")}
						value={countValue(closedCount)}
						icon={<CheckCircleOutline />}
						tone="success"
						footer="Atendimentos concluídos"
					/>
				</Grid>
				<Grid item xs={12} sm={6} md={3}>
					<StatCard
						label="Conexões ativas"
						value={
							<span>
								{connected}
								<span style={{ fontSize: "1rem", opacity: 0.45, fontWeight: 600 }}>
									{" "}
									/ {whatsApps.length}
								</span>
							</span>
						}
						icon={<WifiTethering />}
						tone={allOnline ? "accent" : "error"}
						footer={allOnline ? "Todas as sessões online" : "Há sessões que precisam de atenção"}
					/>
				</Grid>

				{/* 2. GRÁFICO + SAÚDE DAS CONEXÕES */}
				<Grid item xs={12} md={8}>
					<SectionCard
						title="Volume de tickets hoje"
						subtitle="Tickets criados por hora"
						className={classes.fill}
					>
						<div style={{ height: 280 }}>
							<Chart />
						</div>
					</SectionCard>
				</Grid>
				<Grid item xs={12} md={4}>
					<SectionCard
						title="Saúde das conexões"
						subtitle="Status em tempo real"
						className={classes.fill}
						actions={
							<RouterLink to="/connections" className={classes.link}>
								Gerenciar
							</RouterLink>
						}
					>
						{whatsApps.length === 0 ? (
							<EmptyState
								icon={<SyncAlt />}
								title="Nenhuma conexão"
								description="Adicione um número de WhatsApp para começar."
							/>
						) : (
							whatsApps.slice(0, 6).map(w => {
								const [tone, label] = STATUS_TONE[w.status] || ["neutral", w.status];
								return (
									<div className={classes.connRow} key={w.id}>
										<div className={classes.connIcon}>
											<WhatsAppIcon />
										</div>
										<div className={classes.connName}>{w.name}</div>
										<StatusPill tone={tone}>{label}</StatusPill>
									</div>
								);
							})
						)}
					</SectionCard>
				</Grid>

				{/* 3. ARMAZENAMENTO DO BANCO DE DADOS E DISCO */}
				<Grid item xs={12} md={4}>
					<StatCard
						label="Banco de dados (SQLite)"
						value={storageData ? storageData.database.fileSizeFormatted : "..."}
						icon={<StorageIcon />}
						tone="info"
						footer={
							<>
								Arquivo: <code className={classes.code}>whaticket.sqlite</code> (
								{storageData?.overview.totalMessages?.toLocaleString() || 0} mensagens)
							</>
						}
					/>
				</Grid>
				<Grid item xs={12} md={4}>
					<StatCard
						label="Mídias & anexos em disco"
						value={storageData ? storageData.media.totalSizeFormatted : "..."}
						icon={<PermMediaIcon />}
						tone="warning"
						footer={
							<>
								Pasta <code className={classes.code}>/public</code> (
								{storageData?.media.totalFilesCount?.toLocaleString() || 0} arquivos de áudio/foto/doc)
							</>
						}
					/>
				</Grid>
				<Grid item xs={12} md={4}>
					<StatCard
						label="Armazenamento total"
						value={storageData ? storageData.overview.totalStorageFormatted : "..."}
						icon={<AllInboxIcon />}
						tone="success"
						footer={`${storageData?.overview.totalContacts?.toLocaleString() || 0} contatos • ${storageData?.overview.totalWhatsapps || 0} canais`}
					/>
				</Grid>

				{/* 4. CONSUMO DE ESPAÇO POR NÚMERO DE WHATSAPP */}
				<Grid item xs={12}>
					<SectionCard
						icon={<SmartphoneIcon color="primary" />}
						title="Consumo de Armazenamento por Número de WhatsApp"
						subtitle="Detalhamento de espaço ocupado no banco de dados e arquivos de mídia em disco por conexão"
						actions={refreshButton}
						flush
					>
						<TableContainer>
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>Aparelho / WhatsApp</TableCell>
										<TableCell align="center">Status</TableCell>
										<TableCell align="center">Mensagens / Conversas</TableCell>
										<TableCell align="right">Espaço no Banco</TableCell>
										<TableCell align="right">Espaço de Mídias</TableCell>
										<TableCell align="right">Consumo Total</TableCell>
										<TableCell style={{ width: 160 }}>% do Sistema</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{storageData?.usageByNumber?.length > 0 ? (
										storageData.usageByNumber.map(wpp => (
											<TableRow key={wpp.id} hover>
												<TableCell className={classes.strong}>{wpp.name}</TableCell>
												<TableCell align="center">
													<StatusPill tone={wpp.status === "CONNECTED" ? "success" : "error"}>
														{wpp.status === "CONNECTED" ? "Conectado" : "Desconectado"}
													</StatusPill>
												</TableCell>
												<TableCell align="center">
													<Typography variant="body2" className={classes.strong}>
														{wpp.messagesCount.toLocaleString()} msgs
													</Typography>
													<Typography variant="caption" color="textSecondary">
														{wpp.ticketsCount} conversas
													</Typography>
												</TableCell>
												<TableCell align="right">{wpp.dbSizeFormatted}</TableCell>
												<TableCell align="right">{wpp.mediaSizeFormatted}</TableCell>
												<TableCell align="right" className={classes.total}>
													{wpp.totalSizeFormatted}
												</TableCell>
												<TableCell>
													<div className={classes.progressWrap}>
														<LinearProgress
															variant="determinate"
															value={Math.min(100, wpp.percentage * 5)} // visual boost for progress bar
															className={classes.progressBar}
															color="primary"
														/>
														<Typography variant="caption" style={{ fontWeight: 700, minWidth: 35 }}>
															{wpp.percentage}%
														</Typography>
													</div>
												</TableCell>
											</TableRow>
										))
									) : (
										<TableRow>
											<TableCell colSpan={7} align="center" className={classes.emptyCell}>
												{loadingStorage ? "Carregando métricas..." : "Nenhum aparelho registrado."}
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</TableContainer>
					</SectionCard>
				</Grid>

				{/* 5. FLUXO DE TRABALHO */}
				<Grid item xs={12}>
					<SectionCard
						title="Fluxo de trabalho"
						subtitle="Atalhos para as etapas principais do atendimento"
						flush
					>
						<div className={classes.flow} style={{ "--flow-cols": flow.length }}>
							{flow.map((n, i) => (
								<RouterLink to={n.to} key={n.to} className={classes.node}>
									<div className={classes.nodeHead}>
										<div className={classes.nodeIcon} style={{ backgroundColor: n.color }}>
											{n.icon}
										</div>
										<span className={classes.nodeStep}>Passo {i + 1}</span>
										<ArrowForward className={classes.nodeArrow} />
									</div>
									<div className={classes.nodeTitle}>{n.title}</div>
									<div className={classes.nodeDesc}>{n.desc}</div>
								</RouterLink>
							))}
						</div>
					</SectionCard>
				</Grid>
			</Grid>
		</div>
	);
};

export default Dashboard;
