import React, { useContext, useState, useEffect, useCallback } from "react";

import Paper from "@material-ui/core/Paper";
import Container from "@material-ui/core/Container";
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
import Chip from "@material-ui/core/Chip";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import RefreshIcon from "@material-ui/icons/Refresh";
import StorageIcon from "@material-ui/icons/Storage";
import PermMediaIcon from "@material-ui/icons/PermMedia";
import AllInboxIcon from "@material-ui/icons/AllInbox";
import SmartphoneIcon from "@material-ui/icons/Smartphone";

import useTickets from "../../hooks/useTickets";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import Chart from "./Chart";

const useStyles = makeStyles(theme => ({
	container: {
		paddingTop: theme.spacing(3),
		paddingBottom: theme.spacing(4),
	},
	fixedHeightPaper: {
		padding: theme.spacing(2),
		display: "flex",
		overflow: "auto",
		flexDirection: "column",
		height: 240,
	},
	customFixedHeightPaper: {
		padding: theme.spacing(2),
		display: "flex",
		overflow: "hidden",
		flexDirection: "column",
		height: 110,
		borderRadius: 10,
		boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
		border: "1px solid rgba(0,0,0,0.06)",
	},
	storageCard: {
		padding: theme.spacing(2),
		display: "flex",
		flexDirection: "column",
		borderRadius: 10,
		height: "100%",
		boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
		border: "1px solid rgba(0,0,0,0.06)",
		position: "relative",
		background: theme.palette.type === "dark" ? theme.palette.background.paper : "#ffffff",
	},
	storageHeader: {
		display: "flex",
		alignItems: "center",
		marginBottom: theme.spacing(1),
	},
	storageIconWrapper: {
		width: 36,
		height: 36,
		borderRadius: 8,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		marginRight: theme.spacing(1.5),
	},
	tablePaper: {
		padding: theme.spacing(2.5),
		borderRadius: 10,
		boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
		border: "1px solid rgba(0,0,0,0.06)",
		marginTop: theme.spacing(1),
	},
	tableTitleWrapper: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: theme.spacing(2),
	},
	progressBar: {
		height: 8,
		borderRadius: 4,
		backgroundColor: theme.palette.type === "dark" ? "rgba(255,255,255,0.1)" : "#e2e8f0",
	},
	statusChipConnected: {
		backgroundColor: "rgba(22, 163, 74, 0.12)",
		color: "#16a34a",
		fontWeight: 700,
		fontSize: "0.72rem",
		height: 22,
	},
	statusChipDisconnected: {
		backgroundColor: "rgba(220, 38, 38, 0.12)",
		color: "#dc2626",
		fontWeight: 700,
		fontSize: "0.72rem",
		height: 22,
	},
}));

const Dashboard = () => {
	const classes = useStyles();
	const { user } = useContext(AuthContext);

	const [storageData, setStorageData] = useState(null);
	const [loadingStorage, setLoadingStorage] = useState(false);

	let userQueueIds = [];
	if (user.queues && user.queues.length > 0) {
		userQueueIds = user.queues.map(q => q.id);
	}

	const GetTickets = (status, showAll, withUnreadMessages) => {
		const { count } = useTickets({
			status,
			showAll,
			withUnreadMessages,
			queueIds: JSON.stringify(userQueueIds),
		});
		return count;
	};

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

	return (
		<div>
			<Container maxWidth="lg" className={classes.container}>
				<Grid container spacing={3}>
					{/* 1. CARDS DE ATENDIMENTO TRADICIONAIS */}
					<Grid item xs={12} sm={4}>
						<Paper className={classes.customFixedHeightPaper}>
							<Typography component="h3" variant="subtitle2" color="primary">
								{i18n.t("dashboard.messages.inAttendance.title")}
							</Typography>
							<Typography component="h1" variant="h4" style={{ fontWeight: 700, marginTop: 4 }}>
								{GetTickets("open", "true", "false")}
							</Typography>
						</Paper>
					</Grid>
					<Grid item xs={12} sm={4}>
						<Paper className={classes.customFixedHeightPaper}>
							<Typography component="h3" variant="subtitle2" color="primary">
								{i18n.t("dashboard.messages.waiting.title")}
							</Typography>
							<Typography component="h1" variant="h4" style={{ fontWeight: 700, marginTop: 4 }}>
								{GetTickets("pending", "true", "false")}
							</Typography>
						</Paper>
					</Grid>
					<Grid item xs={12} sm={4}>
						<Paper className={classes.customFixedHeightPaper}>
							<Typography component="h3" variant="subtitle2" color="primary">
								{i18n.t("dashboard.messages.closed.title")}
							</Typography>
							<Typography component="h1" variant="h4" style={{ fontWeight: 700, marginTop: 4 }}>
								{GetTickets("closed", "true", "false")}
							</Typography>
						</Paper>
					</Grid>

					{/* 2. CARDS DE ARMAZENAMENTO DO BANCO DE DADOS E DISCO */}
					<Grid item xs={12} md={4}>
						<Paper className={classes.storageCard}>
							<div className={classes.storageHeader}>
								<div
									className={classes.storageIconWrapper}
									style={{ backgroundColor: "rgba(14, 165, 233, 0.12)", color: "#0284c7" }}
								>
									<StorageIcon fontSize="small" />
								</div>
								<div>
									<Typography variant="caption" color="textSecondary" style={{ fontWeight: 600 }}>
										BANCO DE DADOS (SQLITE)
									</Typography>
									<Typography variant="h5" style={{ fontWeight: 700, color: "#0f172a" }}>
										{storageData ? storageData.database.fileSizeFormatted : "..."}
									</Typography>
								</div>
							</div>
							<Typography variant="caption" color="textSecondary" style={{ marginTop: "auto" }}>
								Arquivo: <code>whaticket.sqlite</code> ({storageData?.overview.totalMessages?.toLocaleString() || 0} mensagens)
							</Typography>
						</Paper>
					</Grid>

					<Grid item xs={12} md={4}>
						<Paper className={classes.storageCard}>
							<div className={classes.storageHeader}>
								<div
									className={classes.storageIconWrapper}
									style={{ backgroundColor: "rgba(245, 158, 11, 0.12)", color: "#d97706" }}
								>
									<PermMediaIcon fontSize="small" />
								</div>
								<div>
									<Typography variant="caption" color="textSecondary" style={{ fontWeight: 600 }}>
										MÍDIAS & ANEXOS EM DISCO
									</Typography>
									<Typography variant="h5" style={{ fontWeight: 700, color: "#0f172a" }}>
										{storageData ? storageData.media.totalSizeFormatted : "..."}
									</Typography>
								</div>
							</div>
							<Typography variant="caption" color="textSecondary" style={{ marginTop: "auto" }}>
								Pasta <code>/public</code> ({storageData?.media.totalFilesCount?.toLocaleString() || 0} arquivos de áudio/foto/doc)
							</Typography>
						</Paper>
					</Grid>

					<Grid item xs={12} md={4}>
						<Paper className={classes.storageCard}>
							<div className={classes.storageHeader}>
								<div
									className={classes.storageIconWrapper}
									style={{ backgroundColor: "rgba(16, 185, 129, 0.12)", color: "#059669" }}
								>
									<AllInboxIcon fontSize="small" />
								</div>
								<div>
									<Typography variant="caption" color="textSecondary" style={{ fontWeight: 600 }}>
										ARMAZENAMENTO TOTAL
									</Typography>
									<Typography variant="h5" style={{ fontWeight: 700, color: "#0f172a" }}>
										{storageData ? storageData.overview.totalStorageFormatted : "..."}
									</Typography>
								</div>
							</div>
							<Typography variant="caption" color="textSecondary" style={{ marginTop: "auto" }}>
								{storageData?.overview.totalContacts?.toLocaleString() || 0} contatos • {storageData?.overview.totalWhatsapps || 0} canais
							</Typography>
						</Paper>
					</Grid>

					{/* 3. TABELA DE CONSUMO DE ESPAÇO POR NÚMERO DE WHATSAPP */}
					<Grid item xs={12}>
						<Paper className={classes.tablePaper}>
							<div className={classes.tableTitleWrapper}>
								<div style={{ display: "flex", alignItems: "center" }}>
									<SmartphoneIcon color="primary" style={{ marginRight: 8 }} />
									<div>
										<Typography variant="h6" style={{ fontWeight: 700, fontSize: "1.05rem" }}>
											Consumo de Armazenamento por Número de WhatsApp
										</Typography>
										<Typography variant="caption" color="textSecondary">
											Detalhamento de espaço ocupado no banco de dados e arquivos de mídia em disco por conexão
										</Typography>
									</div>
								</div>
								<Tooltip title="Atualizar Métricas de Armazenamento">
									<IconButton
										size="small"
										onClick={fetchStorageStats}
										disabled={loadingStorage}
										style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8 }}
									>
										{loadingStorage ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
									</IconButton>
								</Tooltip>
							</div>

							<TableContainer>
								<Table size="small">
									<TableHead>
										<TableRow style={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
											<TableCell style={{ fontWeight: 700 }}>Aparelho / WhatsApp</TableCell>
											<TableCell align="center" style={{ fontWeight: 700 }}>Status</TableCell>
											<TableCell align="center" style={{ fontWeight: 700 }}>Mensagens / Conversas</TableCell>
											<TableCell align="right" style={{ fontWeight: 700 }}>Espaço no Banco</TableCell>
											<TableCell align="right" style={{ fontWeight: 700 }}>Espaço de Mídias</TableCell>
											<TableCell align="right" style={{ fontWeight: 700 }}>Consumo Total</TableCell>
											<TableCell style={{ fontWeight: 700, width: 140 }}>% do Sistema</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{storageData?.usageByNumber?.length > 0 ? (
											storageData.usageByNumber.map(wpp => (
												<TableRow key={wpp.id} hover>
													<TableCell style={{ fontWeight: 600 }}>
														{wpp.name}
													</TableCell>
													<TableCell align="center">
														<Chip
															label={wpp.status === "CONNECTED" ? "Conectado" : "Desconectado"}
															size="small"
															className={
																wpp.status === "CONNECTED"
																	? classes.statusChipConnected
																	: classes.statusChipDisconnected
															}
														/>
													</TableCell>
													<TableCell align="center">
														<Typography variant="body2" style={{ fontWeight: 600 }}>
															{wpp.messagesCount.toLocaleString()} msgs
														</Typography>
														<Typography variant="caption" color="textSecondary">
															{wpp.ticketsCount} conversas
														</Typography>
													</TableCell>
													<TableCell align="right">
														<Typography variant="body2" style={{ fontWeight: 500 }}>
															{wpp.dbSizeFormatted}
														</Typography>
													</TableCell>
													<TableCell align="right">
														<Typography variant="body2" style={{ fontWeight: 500 }}>
															{wpp.mediaSizeFormatted}
														</Typography>
													</TableCell>
													<TableCell align="right">
														<Typography variant="body2" style={{ fontWeight: 700, color: "#0284c7" }}>
															{wpp.totalSizeFormatted}
														</Typography>
													</TableCell>
													<TableCell>
														<div style={{ display: "flex", alignItems: "center" }}>
															<div style={{ width: "100%", marginRight: 8 }}>
																<LinearProgress
																	variant="determinate"
																	value={Math.min(100, wpp.percentage * 5)} // visual boost for progress bar
																	className={classes.progressBar}
																	color="primary"
																/>
															</div>
															<Typography variant="caption" style={{ fontWeight: 700, minWidth: 35 }}>
																{wpp.percentage}%
															</Typography>
														</div>
													</TableCell>
												</TableRow>
											))
										) : (
											<TableRow>
												<TableCell colSpan={7} align="center" style={{ padding: 24 }}>
													{loadingStorage ? "Carregando métricas..." : "Nenhum aparelho registrado."}
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</TableContainer>
						</Paper>
					</Grid>

					{/* 4. GRÁFICO DE EVOLUÇÃO */}
					<Grid item xs={12}>
						<Paper className={classes.fixedHeightPaper}>
							<Chart />
						</Paper>
					</Grid>
				</Grid>
			</Container>
		</div>
	);
};

export default Dashboard;