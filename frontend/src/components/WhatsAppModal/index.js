import React, { useState, useEffect, useContext } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";

import { makeStyles, alpha } from "@material-ui/core/styles";
import Close from "@material-ui/icons/Close";
import WhatsApp from "@material-ui/icons/WhatsApp";
import Add from "@material-ui/icons/Add";
import ListAlt from "@material-ui/icons/ListAlt";
import ArchiveOutlined from "@material-ui/icons/ArchiveOutlined";

import {
	Dialog,
	DialogContent,
	Button,
	IconButton,
	DialogActions,
	CircularProgress,
	TextField,
	Switch,
	FormControlLabel,
	Select,
	MenuItem,
	FormControl,
	InputLabel,
	FormHelperText,
	Typography,
} from "@material-ui/core";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";

const OFFICIAL_SECTORS = [
	"Junior",
	"Senior",
	"Pesquisa",
	"Comercial",
	"Juridico",
	"PA FIXA 1",
	"PA FIXA 2",
	"Arquivados",
];

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},

	header: {
		display: "flex",
		alignItems: "flex-start",
		gap: theme.spacing(1.5),
		padding: theme.spacing(2.5, 2, 2, 3),
		borderBottom: `1px solid ${theme.custom.border}`,
	},
	headerIcon: {
		flex: "none",
		width: 40,
		height: 40,
		borderRadius: 12,
		display: "grid",
		placeItems: "center",
		color: "#25D366",
		backgroundColor: alpha("#25D366", theme.palette.type === "dark" ? 0.16 : 0.12),
		"& svg": { fontSize: 20 },
	},
	headerText: { flex: 1, minWidth: 0 },
	title: { fontWeight: 700, fontSize: "1.08rem", lineHeight: 1.3 },
	subtitle: {
		color: theme.palette.text.secondary,
		fontSize: "0.83rem",
		marginTop: 2,
	},

	content: {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing(0.5),
		padding: theme.spacing(2.5, 3),
	},

	sectionLabel: {
		fontSize: "0.7rem",
		fontWeight: 700,
		textTransform: "uppercase",
		letterSpacing: "0.08em",
		color: theme.palette.text.secondary,
		marginBottom: theme.spacing(0.5),
	},
	sectionSpacer: {
		marginTop: theme.spacing(1.5),
		paddingTop: theme.spacing(2),
		borderTop: `1px dashed ${theme.custom.border}`,
	},

	multFieldLine: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: theme.spacing(2),
		marginBottom: theme.spacing(0.5),
	},

	textField: {
		flex: "1 1 240px",
	},

	toggle: {
		margin: 0,
		padding: theme.spacing(0.5, 1.5, 0.5, 0.5),
		borderRadius: 10,
		border: `1px solid ${theme.custom.border}`,
		backgroundColor: theme.custom.surfaceAlt,
		marginTop: 4,
		"& .MuiFormControlLabel-label": { fontWeight: 600, fontSize: "0.86rem" },
	},

	sectorRow: {
		display: "flex",
		gap: theme.spacing(1),
		alignItems: "center",
	},
	sectorBtn: {
		height: 40,
		whiteSpace: "nowrap",
		flex: "none",
		marginTop: 4,
	},
	placeholder: { color: theme.custom.textSubtle },

	archiveBox: {
		marginTop: theme.spacing(1),
		marginBottom: theme.spacing(1),
		padding: theme.spacing(1.5, 2),
		borderRadius: 12,
		border: `1px solid ${theme.custom.border}`,
		backgroundColor: theme.custom.surfaceAlt,
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1.5),
		transition: "all 0.2s ease",
	},
	archiveBoxActive: {
		borderColor: theme.palette.secondary.main,
		backgroundColor: alpha(theme.palette.secondary.main, theme.palette.type === "dark" ? 0.12 : 0.08),
	},
	archiveIcon: {
		flex: "none",
		width: 36,
		height: 36,
		borderRadius: 10,
		display: "grid",
		placeItems: "center",
		color: theme.palette.text.secondary,
		backgroundColor: theme.palette.background.paper,
		border: `1px solid ${theme.custom.border}`,
		"& svg": { fontSize: 18 },
	},
	archiveIconActive: {
		color: theme.palette.secondary.main,
		borderColor: alpha(theme.palette.secondary.main, 0.4),
	},
	archiveText: { flex: 1, minWidth: 0 },
	archiveTitle: { fontWeight: 700, fontSize: "0.88rem" },
	archiveTitleActive: { color: theme.palette.secondary.main },
	archiveHelp: { color: theme.palette.text.secondary, display: "block", marginTop: 2, lineHeight: 1.45 },

	chipName: { fontWeight: 600 },
	chipPhone: { marginLeft: 8, color: theme.palette.text.secondary },
	chipHolder: { marginLeft: 8, fontSize: "0.85em", color: theme.palette.info.main },
	chipDevice: { marginLeft: 8, fontSize: "0.8em", color: theme.palette.success.main },

	btnWrapper: {
		position: "relative",
	},

	buttonProgress: {
		color: theme.palette.primary.main,
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},
}));

const SessionSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Muito curto!")
		.max(50, "Muito longo!")
		.required("O nome é obrigatório"),
	sector: Yup.string()
		.required("O setor é obrigatório"),
});


const CrmChipSelector = ({ sector, setFieldValue }) => {
	const classes = useStyles();
	const [crmChips, setCrmChips] = useState([]);
	const [loading, setLoading] = useState(false);
	const [selectedPhone, setSelectedPhone] = useState("");

	useEffect(() => {
		if (!sector) {
			setCrmChips([]);
			setSelectedPhone("");
			return;
		}

		let isMounted = true;
		setLoading(true);
		api.get("/whatsapp/crm-chips", { params: { sector } })
			.then(res => {
				if (isMounted) {
					if (res.data && Array.isArray(res.data.chips)) {
						setCrmChips(res.data.chips);
					} else {
						setCrmChips([]);
					}
					setLoading(false);
				}
			})
			.catch(err => {
				console.error("Erro ao carregar chips do CRM:", err);
				if (isMounted) {
					setCrmChips([]);
					setLoading(false);
				}
			});

		return () => {
			isMounted = false;
		};
	}, [sector]);

	const handleChipChange = (e) => {
		const phone = e.target.value;
		setSelectedPhone(phone);
		if (!phone) return;

		const chip = crmChips.find(c => c.phone_number === phone);
		if (chip) {
			const suffix = chip.phone_number ? chip.phone_number.slice(-4) : "";
			const suggestedName = chip.name
				? (suffix ? `${chip.name.toUpperCase()} ${suffix}` : chip.name.toUpperCase())
				: `CHIP ${suffix}`;
			setFieldValue("name", suggestedName);
		}
	};

	if (!sector) return null;

	return (
		<div>
			<FormControl variant="outlined" margin="dense" fullWidth>
				<InputLabel id="crm-chip-select-label" shrink>
					WhatsApp do CRM ({sector}) - Opcional
				</InputLabel>
				<Select
					labelId="crm-chip-select-label"
					id="crm-chip-select"
					label={`WhatsApp do CRM (${sector}) - Opcional`}
					displayEmpty
					value={selectedPhone}
					onChange={handleChipChange}
					disabled={loading}
					renderValue={selected => {
						if (!selected) {
							return <span className={classes.placeholder}>Nenhum / Manual (Não vincular)</span>;
						}
						const chip = crmChips.find(c => c.phone_number === selected);
						if (chip) {
							return `${chip.name || "Sem Nome"} - (${chip.phone_number})`;
						}
						return selected;
					}}
				>
					<MenuItem value="">
						<em>Nenhum / Manual (Não vincular)</em>
					</MenuItem>
					{crmChips.map(chip => (
						<MenuItem key={chip.id || chip.phone_number} value={chip.phone_number}>
							<span className={classes.chipName}>{chip.name || "Sem Nome"}</span>
							<span className={classes.chipPhone}>({chip.phone_number})</span>
							{chip.holder ? (
								<span className={classes.chipHolder}>
									[{chip.holder}]
								</span>
							) : null}
							{chip.device_name ? (
								<span className={classes.chipDevice}>
									[Celular {chip.device_name}]
								</span>
							) : null}
						</MenuItem>
					))}
				</Select>
				<FormHelperText>
					{loading
						? "Buscando números no CRM WhatsApp Control..."
						: crmChips.length === 0
						? `Nenhum WhatsApp cadastrado no CRM para a equipe ${sector}.`
						: `${crmChips.length} WhatsApp(s) disponível(is) na equipe ${sector}. Ao selecionar, o nome é preenchido automaticamente.`}
				</FormHelperText>
			</FormControl>
		</div>
	);
};

const WhatsAppModal = ({ open, onClose, whatsAppId }) => {
	const classes = useStyles();
	const { fetchWhatsApps } = useContext(WhatsAppsContext);
	const { user } = useContext(AuthContext);
	const isManager = user?.profile === "whatsapp_control" || user?.profile === "whatsapp_control_high";
	const isRestrictedUser = !["admin", "admin_master", "admin_operational"].includes(user?.profile);
	const [dynamicSectors, setDynamicSectors] = useState([]);

	const loadSectors = async () => {
		try {
			const { data } = await api.get("/sectors");
			if (Array.isArray(data) && data.length) {
				setDynamicSectors(data.map(s => s.name));
			}
		} catch (_err) {}
	};

	useEffect(() => {
		loadSectors();
	}, [whatsAppId]);

	const allKnownSectors = React.useMemo(() => {
		return Array.from(new Set([...(dynamicSectors || []), ...OFFICIAL_SECTORS]));
	}, [dynamicSectors]);

	const availableSectors = React.useMemo(() => {
		const isMaster = user?.profile === "admin_master" || 
			user?.profile === "admin" || 
			String(user?.email || "").toLowerCase().trim() === "vicenzzo.mastronikolis@realess.com.br";

		if (isMaster) return allKnownSectors;

		if (user?.profile === "admin_operational") {
			if (Array.isArray(user?.sectorPermissions) && user.sectorPermissions.length > 0) {
				const permitted = user.sectorPermissions
					.filter(p => p && (p.canConfigure || p.canView))
					.map(p => p.sector);
				return Array.from(new Set([...permitted, ...(dynamicSectors || [])]));
			}
			return allKnownSectors;
		}

		if (isRestrictedUser && (isManager || user?.canAccessConnections)) {
			const raw = Array.isArray(user?.connectionSectors) ? user.connectionSectors : [];
			return raw.length > 0 ? raw : allKnownSectors;
		}
		return allKnownSectors;
	}, [user, allKnownSectors, dynamicSectors, isRestrictedUser, isManager]);
	const initialState = {
		name: "",
		greetingMessage: "",
		farewellMessage: "",
		isDefault: false,
		proxyUrl: "",
		humanDelay: true,
		sector: "",
		isArchived: false,
	};
	const [whatsApp, setWhatsApp] = useState(initialState);
	const [selectedQueueIds, setSelectedQueueIds] = useState([]);
	const [customSector, setCustomSector] = useState(false);

	useEffect(() => {
		const fetchSession = async () => {
			if (!whatsAppId) return;

			try {
				const { data } = await api.get(`whatsapp/${whatsAppId}`);
				const isArch =
					data.status === "archived" ||
					data.sector === "Arquivados" ||
					(data.name || "").toUpperCase().startsWith("HISTÓRICO");

				setWhatsApp({
					...data,
					proxyUrl: data.proxyUrl || "",
					humanDelay: data.humanDelay !== false,
					sector: data.sector || "",
					isArchived: isArch,
				});

				const whatsQueueIds = Array.isArray(data.queues)
					? data.queues.map(queue => queue.id)
					: [];
				setSelectedQueueIds(whatsQueueIds);
			} catch (err) {
				toastError(err);
				setSelectedQueueIds([]);
			}
		};
		fetchSession();
	}, [whatsAppId]);

	const handleSaveWhatsApp = async values => {
		const whatsappData = { ...values, queueIds: selectedQueueIds };

		if (values.isArchived) {
			whatsappData.status = "archived";
			if (!whatsappData.sector || whatsappData.sector === "") {
				whatsappData.sector = "Arquivados";
			}
		} else if (values.status === "archived" || values.sector === "Arquivados") {
			// Se o aparelho estava arquivado e o operador o desarquivou
			whatsappData.status = "DISCONNECTED";
			if (whatsappData.sector === "Arquivados") {
				whatsappData.sector = "Junior";
			}
		}

		delete whatsappData.isArchived;

		try {
			if (whatsAppId) {
				await api.put(`/whatsapp/${whatsAppId}`, whatsappData);
			} else {
				await api.post("/whatsapp", whatsappData);
			}
			if (fetchWhatsApps) {
				await fetchWhatsApps();
			}
			toast.success(i18n.t("whatsappModal.success"));
			handleClose();
		} catch (err) {
			toastError(err);
		}
	};

	const handleClose = () => {
		onClose();
		setWhatsApp(initialState);
		setSelectedQueueIds([]);
		setCustomSector(false);
	};

	return (
		<div className={classes.root}>
			<Dialog
				open={open}
				onClose={handleClose}
				maxWidth="sm"
				fullWidth
				scroll="paper"
			>
				<div className={classes.header}>
					<div className={classes.headerIcon}>
						<WhatsApp />
					</div>
					<div className={classes.headerText}>
						<Typography component="h2" className={classes.title}>
							{whatsAppId
								? i18n.t("whatsappModal.title.edit")
								: i18n.t("whatsappModal.title.add")}
						</Typography>
						<Typography className={classes.subtitle}>
							Identificação, setor, proteção anti-ban e mensagens automáticas da conexão.
						</Typography>
					</div>
					<IconButton size="small" onClick={handleClose} aria-label="Fechar">
						<Close fontSize="small" />
					</IconButton>
				</div>
				<Formik
					initialValues={whatsApp}
					enableReinitialize={true}
					validationSchema={SessionSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveWhatsApp(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ values, touched, errors, isSubmitting, setFieldValue }) => (
						<Form style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
							<DialogContent className={classes.content}>
								<Typography className={classes.sectionLabel}>
									Identificação
								</Typography>
								<div className={classes.multFieldLine}>
									<Field
										as={TextField}
										label={i18n.t("whatsappModal.form.name")}
										autoFocus
										name="name"
										error={touched.name && Boolean(errors.name)}
										helperText={touched.name && errors.name}
										variant="outlined"
										margin="dense"
										className={classes.textField}
									/>
									<FormControlLabel
										control={
											<Field
												as={Switch}
												color="primary"
												name="isDefault"
												checked={values.isDefault}
											/>
										}
										label={i18n.t("whatsappModal.form.default")}
										className={classes.toggle}
									/>
								</div>
								<div>
									{!customSector ? (
										<div className={classes.sectorRow}>
											<FormControl
												variant="outlined"
												margin="dense"
												fullWidth
												error={touched.sector && Boolean(errors.sector)}
											>
												<InputLabel id="sector-select-label" shrink>Setor do Aparelho *</InputLabel>
												<Field
													as={Select}
													labelId="sector-select-label"
													id="sector"
													name="sector"
													label="Setor do Aparelho *"
													displayEmpty
													value={values.sector || ""}
													onChange={e => {
														const val = e.target.value;
														setFieldValue("sector", val);
														if (val === "Arquivados") {
															setFieldValue("isArchived", true);
														} else if (values.isArchived && val !== "Arquivados") {
															setFieldValue("isArchived", false);
														}
													}}
													renderValue={selected => {
														if (!selected) {
															return <span className={classes.placeholder}>Selecione o setor...</span>;
														}
														return selected;
													}}
												>
													<MenuItem value="" disabled>
														<em>Selecione o setor...</em>
													</MenuItem>
													{availableSectors.map(s => (
														<MenuItem key={s} value={s}>
															{s}
														</MenuItem>
													))}
													{!availableSectors.includes(values.sector) && values.sector && (
														<MenuItem key={values.sector} value={values.sector}>
															{values.sector} (Personalizado)
														</MenuItem>
													)}
												</Field>
												{touched.sector && errors.sector && (
													<FormHelperText>{errors.sector}</FormHelperText>
												)}
											</FormControl>
											{!isManager && (
											<Button
												variant="outlined"
												size="small"
												color="primary"
												startIcon={<Add fontSize="small" />}
												className={classes.sectorBtn}
												onClick={() => setCustomSector(true)}
											>
												Novo
											</Button>
											)}
										</div>
									) : (
										<div className={classes.sectorRow}>
											<Field
												as={TextField}
												label="Digite o Nome do Novo Setor *"
												name="sector"
												variant="outlined"
												margin="dense"
												fullWidth
												autoFocus
												error={touched.sector && Boolean(errors.sector)}
												helperText={touched.sector && errors.sector}
											/>
											<Button
												variant="outlined"
												size="small"
												startIcon={<ListAlt fontSize="small" />}
												className={classes.sectorBtn}
												onClick={() => setCustomSector(false)}
											>
												Lista
											</Button>
										</div>
									)}
								</div>

								{/* Controle de Arquivamento do Aparelho */}
								<div
									className={`${classes.archiveBox} ${values.isArchived ? classes.archiveBoxActive : ""}`}
								>
									<div
										className={`${classes.archiveIcon} ${values.isArchived ? classes.archiveIconActive : ""}`}
									>
										<ArchiveOutlined />
									</div>
									<div className={classes.archiveText}>
										<Typography
											variant="subtitle2"
											className={`${classes.archiveTitle} ${values.isArchived ? classes.archiveTitleActive : ""}`}
										>
											Colocar no Arquivados
										</Typography>
										<Typography variant="caption" className={classes.archiveHelp}>
											{values.isArchived
												? "Aparelho ARQUIVADO: Exibido na aba 'Arquivados' e preservado no cofre de auditoria sem tentar reconectar."
												: "Mover este aparelho para a aba 'Arquivados' caso esteja fora de uso, preservando o histórico intacto."}
										</Typography>
									</div>
									<FormControlLabel
										control={
											<Switch
												color="secondary"
												name="isArchived"
												checked={Boolean(values.isArchived)}
												onChange={e => {
													const checked = e.target.checked;
													setFieldValue("isArchived", checked);
													if (checked && (!values.sector || values.sector === "")) {
														setFieldValue("sector", "Arquivados");
													} else if (!checked && values.sector === "Arquivados") {
														setFieldValue("sector", "Junior");
													}
												}}
											/>
										}
										label=""
										style={{ margin: 0 }}
									/>
								</div>

								<CrmChipSelector sector={values.sector} setFieldValue={setFieldValue} />

								<Typography className={`${classes.sectionLabel} ${classes.sectionSpacer}`}>
									Proteção anti-ban
								</Typography>
								<div>
									<Field
										as={TextField}
										label="Proxy Dedicado (HTTP / SOCKS5)"
										name="proxyUrl"
										placeholder="http://usuario:senha@ip:porta ou http://ip:porta"
										fullWidth
										variant="outlined"
										margin="dense"
										helperText="Opcional: Isola o IP desta conexão para proteção anti-ban"
									/>
								</div>
								<div>
									<FormControlLabel
										control={
											<Field
												as={Switch}
												color="primary"
												name="humanDelay"
												checked={values.humanDelay !== false}
											/>
										}
										label="Simulação de Digitação Humana (Human Flow Anti-Ban)"
										className={classes.toggle}
									/>
								</div>

								<Typography className={`${classes.sectionLabel} ${classes.sectionSpacer}`}>
									Mensagens e filas
								</Typography>
								<div>
									<Field
										as={TextField}
										label={i18n.t("queueModal.form.greetingMessage")}
										type="greetingMessage"
										multiline
										rows={5}
										fullWidth
										name="greetingMessage"
										error={
											touched.greetingMessage && Boolean(errors.greetingMessage)
										}
										helperText={
											touched.greetingMessage && errors.greetingMessage
										}
										variant="outlined"
										margin="dense"
									/>
								</div>
								<div>
									<Field
										as={TextField}
										label={i18n.t("whatsappModal.form.farewellMessage")}
										type="farewellMessage"
										multiline
										rows={5}
										fullWidth
										name="farewellMessage"
										error={
											touched.farewellMessage && Boolean(errors.farewellMessage)
										}
										helperText={
											touched.farewellMessage && errors.farewellMessage
										}
										variant="outlined"
										margin="dense"
									/>
								</div>
								<QueueSelect
									selectedQueueIds={selectedQueueIds}
									onChange={selectedIds => setSelectedQueueIds(selectedIds)}
								/>
							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									disabled={isSubmitting}
									variant="outlined"
								>
									{i18n.t("whatsappModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{whatsAppId
										? i18n.t("whatsappModal.buttons.okEdit")
										: i18n.t("whatsappModal.buttons.okAdd")}
									{isSubmitting && (
										<CircularProgress
											size={24}
											className={classes.buttonProgress}
										/>
									)}
								</Button>
							</DialogActions>
						</Form>
					)}
				</Formik>
			</Dialog>
		</div>
	);
};

export default React.memo(WhatsAppModal);
