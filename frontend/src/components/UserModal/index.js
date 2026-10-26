import React, { useState, useEffect, useContext } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	CircularProgress,
	Select,
	InputLabel,
	MenuItem,
	FormControl,
	FormControlLabel,
	Checkbox,
	TextField,
	InputAdornment,
	IconButton,
	Chip,
	FormHelperText,
	Typography
} from '@material-ui/core';

import { Visibility, VisibilityOff, Close, PersonAddOutlined, PersonOutline, Add, CategoryOutlined } from '@material-ui/icons';

import { makeStyles, alpha } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import useWhatsApps from "../../hooks/useWhatsApps";

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
		color: theme.palette.primary.main,
		backgroundColor: theme.custom.primarySoft,
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
		padding: theme.spacing(2.5, 3),
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing(1.5),
		"& .MuiFormControl-marginDense": { marginTop: 0, marginBottom: 0 },
	},
	sectionLabel: {
		fontSize: "0.7rem",
		fontWeight: 700,
		textTransform: "uppercase",
		letterSpacing: "0.08em",
		color: theme.palette.text.secondary,
	},
	sectionSpacer: {
		marginTop: theme.spacing(1.5),
		paddingTop: theme.spacing(2),
		borderTop: `1px dashed ${theme.custom.border}`,
	},
	managerHelp: {
		color: theme.palette.primary.main,
		fontWeight: 500,
	},
	permBox: {
		marginTop: theme.spacing(1),
		padding: theme.spacing(2),
		border: `1px solid ${theme.custom.border}`,
		borderRadius: 12,
		backgroundColor: theme.custom.surfaceAlt,
	},
	permHead: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		flexWrap: "wrap",
		gap: theme.spacing(1),
		marginBottom: theme.spacing(0.5),
	},
	permTitle: { fontWeight: 700, fontSize: "0.92rem", color: theme.palette.text.primary },
	permHelp: { color: theme.palette.text.secondary, margin: 0 },
	permActions: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
	permTextBtn: { textTransform: "none", fontSize: "0.75rem", fontWeight: 700 },
	permList: { display: "flex", flexDirection: "column", gap: 6, marginTop: theme.spacing(1.25) },
	permRow: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		flexWrap: "wrap",
		padding: theme.spacing(0.5, 1.5),
		backgroundColor: theme.palette.background.paper,
		borderRadius: 10,
		border: `1px solid ${theme.custom.border}`,
	},
	permSector: { fontWeight: 600, color: theme.palette.text.primary, minWidth: 140 },
	permChecks: { display: "flex", gap: theme.spacing(2) },
	masterOnlyChip: {
		marginLeft: 8,
		height: 20,
		fontSize: "0.65rem",
		fontWeight: 650,
		color: theme.palette.warning.main,
		backgroundColor: alpha(theme.palette.warning.main, theme.palette.type === "dark" ? 0.16 : 0.12),
	},
	multFieldLine: {
		display: "flex",
		gap: theme.spacing(1.5),
		[theme.breakpoints.down("xs")]: { flexDirection: "column" },
	},

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
	formControl: {
		margin: 0,
		minWidth: 160,
		[theme.breakpoints.down("xs")]: { width: "100%" },
	},
}));

const UserSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(50, "Too Long!")
		.required("Required"),
	password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
	email: Yup.string().email("Invalid email").required("Required"),
});

const DEFAULT_CONNECTION_SECTORS = [
	"PA FIXA 1",
	"PA FIXA 2",
	"Junior",
	"Senior",
	"Pesquisa",
	"Comercial",
	"Jurídico"
];

const UserModal = ({ open, onClose, userId }) => {
	const classes = useStyles();

	const initialState = {
		name: "",
		email: "",
		password: "",
		profile: "user",
		status: "active",
		canAccessConnections: false,
		connectionSectors: [],
		sectorPermissions: []
	};

	const { user: loggedInUser } = useContext(AuthContext);
	const isMaster = loggedInUser?.profile === "admin_master" || loggedInUser?.profile === "admin" || String(loggedInUser?.email || "").toLowerCase().trim() === "vicenzzo.mastronikolis@realess.com.br";

	const [user, setUser] = useState(initialState);
	const [selectedQueueIds, setSelectedQueueIds] = useState([]);
	const [showPassword, setShowPassword] = useState(false);
	const [whatsappId, setWhatsappId] = useState(false);
	const [availableSectors, setAvailableSectors] = useState(
		DEFAULT_CONNECTION_SECTORS.map(name => ({ name, minimumProfile: "admin_operational" }))
	);

	const [newSectorOpen, setNewSectorOpen] = useState(false);
	const [newSectorName, setNewSectorName] = useState("");
	const [newSectorMinimumProfile, setNewSectorMinimumProfile] = useState("admin_operational");

	const { loading, whatsApps } = useWhatsApps();

	const loadSectors = async () => {
		try {
			const { data } = await api.get("/sectors");
			if (Array.isArray(data) && data.length) {
				setAvailableSectors(data);
			}
		} catch (_e) {}
	};

	useEffect(() => {
		if (!open) return;
		loadSectors();
	}, [open]);

	useEffect(() => {
		const fetchUser = async () => {
			if (!userId) return;
			try {
				const { data } = await api.get(`/users/${userId}`);
				let sectors = data.connectionSectors;
				if (typeof sectors === "string") {
					try {
						sectors = JSON.parse(sectors);
					} catch {
						sectors = [];
					}
				}
				if (!Array.isArray(sectors)) {
					sectors = [];
				}
				setUser(prevState => {
					return {
						...prevState,
						...data,
						canAccessConnections: Boolean(data.canAccessConnections),
						connectionSectors: sectors,
						sectorPermissions: Array.isArray(data.sectorPermissions) ? data.sectorPermissions : []
					};
				});
				const userQueueIds = data.queues?.map(queue => queue.id);
				setSelectedQueueIds(userQueueIds);
				setWhatsappId(data.whatsappId ? data.whatsappId : '');
			} catch (err) {
				toastError(err);
			}
		};

		fetchUser();
	}, [userId, open]);

	const handleClose = () => {
		onClose();
		setUser(initialState);
	};

	const handleCreateNewSector = async () => {
		try {
			await api.post("/sectors", { name: newSectorName, minimumProfile: newSectorMinimumProfile });
			toast.success("Setor criado com sucesso!");
			setNewSectorName("");
			setNewSectorMinimumProfile("admin_operational");
			setNewSectorOpen(false);
			await loadSectors();
		} catch (err) {
			toastError(err);
		}
	};

	const handleSaveUser = async values => {
		if (values.profile === "operator" && !whatsappId) {
			toast.error("Selecione a conexão do WhatsApp para o Operador.");
			return;
		}

		const isManager = values.profile === "whatsapp_control" || values.profile === "whatsapp_control_high";
		let connectionSectors = values.connectionSectors;
		if (typeof connectionSectors === "string") {
			try {
				connectionSectors = JSON.parse(connectionSectors);
			} catch {
				connectionSectors = [connectionSectors];
			}
		}
		if (!Array.isArray(connectionSectors)) {
			connectionSectors = [];
		}

		if (isManager && connectionSectors.length === 0) {
			toast.error("Selecione pelo menos um setor de responsabilidade para o Gestor.");
			return;
		}

		let finalSectorPermissions = values.sectorPermissions || [];
		if (values.profile === "admin_operational" || values.profile === "admin") {
			finalSectorPermissions = availableSectors.map(secItem => {
				const sector = secItem.name;
				const found = (values.sectorPermissions || []).find(p => p.sector === sector);
				if (found) {
					return {
						sector,
						canView: Boolean(found.canView),
						canConfigure: Boolean(found.canConfigure)
					};
				}
				return {
					sector,
					canView: Boolean(userId),
					canConfigure: Boolean(userId)
				};
			});
		}

		const userData = {
			...values,
			canAccessConnections: isManager ? true : Boolean(values.canAccessConnections),
			connectionSectors,
			sectorPermissions: finalSectorPermissions,
			whatsappId: whatsappId || null,
			queueIds: selectedQueueIds
		};

		try {
			if (userId) {
				await api.put(`/users/${userId}`, userData);
			} else {
				await api.post("/users", userData);
			}
			toast.success(i18n.t("userModal.success"));
			handleClose();
		} catch (err) {
			toastError(err);
		}
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
						{userId ? <PersonOutline /> : <PersonAddOutlined />}
					</div>
					<div className={classes.headerText}>
						<Typography id="form-dialog-title" component="h2" className={classes.title}>
							{userId
								? `${i18n.t("userModal.title.edit")}`
								: `${i18n.t("userModal.title.add")}`}
						</Typography>
						<Typography className={classes.subtitle}>
							Dados de acesso, perfil, setores e filas de atendimento do usuário.
						</Typography>
					</div>
					<IconButton size="small" onClick={handleClose} aria-label="Fechar">
						<Close fontSize="small" />
					</IconButton>
				</div>
				<Formik
					initialValues={user}
					enableReinitialize={true}
					validationSchema={UserSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveUser(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ touched, errors, isSubmitting, values, setFieldValue }) => (
						<Form style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
							<DialogContent className={classes.content}>
								<Typography className={classes.sectionLabel}>
									Dados de acesso
								</Typography>
								<div className={classes.multFieldLine}>
									<Field
										as={TextField}
										label={i18n.t("userModal.form.name")}
										autoFocus
										name="name"
										error={touched.name && Boolean(errors.name)}
										helperText={touched.name && errors.name}
										variant="outlined"
										margin="dense"
										fullWidth
									/>
									<Field
										as={TextField}
										name="password"
										type={showPassword ? 'text' : 'password'}
										label={i18n.t("userModal.form.password")}
										error={touched.password && Boolean(errors.password)}
										helperText={touched.password && errors.password}
										variant="outlined"
										margin="dense"
										InputProps={{
										endAdornment: (
											<InputAdornment position="end">
											<IconButton
												size="small"
												aria-label="toggle password visibility"
												onClick={() => setShowPassword((e) => !e)}
											>
												{showPassword ? <VisibilityOff /> : <Visibility />}
											</IconButton>
											</InputAdornment>
										)
										}}
										fullWidth
									/>
								</div>
								<div className={classes.multFieldLine}>
									<Field
										as={TextField}
										label={i18n.t("userModal.form.email")}
										name="email"
										error={touched.email && Boolean(errors.email)}
										helperText={touched.email && errors.email}
										variant="outlined"
										margin="dense"
										fullWidth
									/>
									<FormControl
										variant="outlined"
										className={classes.formControl}
										margin="dense"
									>
										<Can
											role={loggedInUser.profile}
											perform="user-modal:editProfile"
											yes={() => (
												<>
													<InputLabel id="profile-selection-input-label">
														{i18n.t("userModal.form.profile")}
													</InputLabel>

													<Field
														as={Select}
														label={i18n.t("userModal.form.profile")}
														name="profile"
														labelId="profile-selection-label"
														id="profile-selection"
														required
													>
														{String(values.email || "").toLowerCase().trim() === "vicenzzo.mastronikolis@realess.com.br" ? (
															<MenuItem value="admin_master">Administrador Master</MenuItem>
														) : (
															[
																<MenuItem key="admin_operational" value="admin_operational">Administrador Operacional</MenuItem>,
																<MenuItem key="admin" value="admin">Admin</MenuItem>,
																<MenuItem key="user" value="user">User</MenuItem>,
																<MenuItem key="operator" value="operator">Operador WhatsApp (Tela Dedicada)</MenuItem>,
																<MenuItem key="whatsapp_control" value="whatsapp_control">Gestor WhatsApp Control (Baixo)</MenuItem>,
																<MenuItem key="whatsapp_control_high" value="whatsapp_control_high">Gestor WhatsApp Control (Alto)</MenuItem>
															]
														)}
													</Field>
												</>
											)}
										/>
									</FormControl>
									<FormControl
										variant="outlined"
										className={classes.formControl}
										margin="dense"
									>
										<Can
											role={loggedInUser.profile}
											perform="user-modal:editProfile"
											yes={() => (
												<>
													<InputLabel id="status-selection-input-label">
														Status
													</InputLabel>

													<Field
														as={Select}
														label="Status"
														name="status"
														labelId="status-selection-label"
														id="status-selection"
														required
													>
														<MenuItem value="active">Ativo</MenuItem>
														<MenuItem value="pending">Pendente</MenuItem>
													</Field>
												</>
											)}
										/>
									</FormControl>
								</div>
								<Can
									role={loggedInUser.profile}
									perform="user-modal:editQueues"
									yes={() => (
										<Typography
											className={`${classes.sectionLabel} ${classes.sectionSpacer}`}
										>
											Atendimento
										</Typography>
									)}
								/>
								<Can
									role={loggedInUser.profile}
									perform="user-modal:editQueues"
									yes={() => (
										<QueueSelect
											selectedQueueIds={selectedQueueIds}
											onChange={values => setSelectedQueueIds(values)}
										/>
									)}
								/>
								{values.profile !== "admin" && values.profile !== "admin_master" && values.profile !== "admin_operational" && (
									<Can
										role={loggedInUser.profile}
										perform="user-modal:editProfile"
										yes={() => {
											const isManager = values.profile === "whatsapp_control" || values.profile === "whatsapp_control_high";
											if (isManager) {
												return (
													<FormControl variant="outlined" margin="dense" fullWidth>
														<InputLabel id="connection-sectors-label">
															Setor(es) sob responsabilidade
														</InputLabel>
														<Field
															as={Select}
															multiple
															name="connectionSectors"
															label="Setor(es) sob responsabilidade"
															labelId="connection-sectors-label"
															renderValue={(selected) => (
																<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
																	{(Array.isArray(selected) ? selected : []).map((val) => (
																		<Chip key={val} label={val} size="small" color="primary" />
																	))}
																</div>
															)}
														>
															{availableSectors.map(secItem => (
																<MenuItem key={secItem.name} value={secItem.name}>
																	{secItem.name}
																</MenuItem>
															))}
														</Field>
														<FormHelperText className={classes.managerHelp}>
															{values.profile === "whatsapp_control_high"
																? "Gestor Alto: terá acesso às Conexões e Auditoria apenas dos celulares destes setores."
																: "Gestor Baixo: terá acesso às Conexões apenas dos celulares destes setores."}
														</FormHelperText>
													</FormControl>
												);
											}

											return (
												<>
													<FormControlLabel
														control={
															<Field
																as={Checkbox}
																color="primary"
																name="canAccessConnections"
															/>
														}
														label="Permitir acesso à aba Conexões"
													/>
													{values.canAccessConnections && (
														<FormControl variant="outlined" margin="dense" fullWidth>
															<InputLabel id="connection-sectors-label">
																Setores permitidos
															</InputLabel>
															<Field
																as={Select}
																multiple
																name="connectionSectors"
																label="Setores permitidos"
																labelId="connection-sectors-label"
																renderValue={(selected) => (
																	<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
																		{(Array.isArray(selected) ? selected : []).map((val) => (
																			<Chip key={val} label={val} size="small" />
																		))}
																	</div>
																)}
															>
																{availableSectors.map(secItem => (
																	<MenuItem key={secItem.name} value={secItem.name}>
																		{secItem.name}
																	</MenuItem>
																))}
															</Field>
														</FormControl>
													)}
												</>
											);
										}}
									/>
								)}

								{/* Matriz de Permissões por Setor para Master configurando permissões do usuário */}
								{isMaster && String(values.email || "").toLowerCase().trim() !== "vicenzzo.mastronikolis@realess.com.br" && (
									<div className={classes.permBox}>
										<div className={classes.permHead}>
											<div>
												<div className={classes.permTitle}>
													Permissões por setor (Auditoria, Tickets e CRM)
												</div>
												<FormHelperText className={classes.permHelp}>
													Defina os setores que este usuário poderá ver e editar.
												</FormHelperText>
											</div>
											<div className={classes.permActions}>
												<Button
													size="small"
													variant="text"
													color="primary"
													className={classes.permTextBtn}
													onClick={() => {
														const allPerms = availableSectors.map(s => ({
															sector: s.name,
															canView: true,
															canConfigure: true
														}));
														setFieldValue("sectorPermissions", allPerms);
													}}
												>
													Marcar Todos
												</Button>
												<Button
													size="small"
													variant="text"
													color="secondary"
													className={classes.permTextBtn}
													onClick={() => {
														const nonePerms = availableSectors.map(s => ({
															sector: s.name,
															canView: false,
															canConfigure: false
														}));
														setFieldValue("sectorPermissions", nonePerms);
													}}
												>
													Desmarcar Todos
												</Button>
												<Button
													size="small"
													variant="outlined"
													color="primary"
													startIcon={<Add fontSize="small" />}
													style={{ textTransform: "none", fontWeight: 700 }}
													onClick={() => setNewSectorOpen(true)}
												>
													Novo setor
												</Button>
											</div>
										</div>

										<div className={classes.permList}>
											{availableSectors.map(secItem => {
												const sector = secItem.name;
												const current = (values.sectorPermissions || []).find(p => p.sector === sector) || {
													sector,
													canView: false,
													canConfigure: false
												};

												const updatePerm = (field, checked) => {
													const permsMap = new Map();
													availableSectors.forEach(s => {
														const existing = (values.sectorPermissions || []).find(p => p.sector === s.name);
														permsMap.set(s.name, existing ? { ...existing } : {
															sector: s.name,
															canView: false,
															canConfigure: false
														});
													});
													const target = permsMap.get(sector) || { sector, canView: false, canConfigure: false };
													target[field] = checked;
													if (field === "canView" && !checked) {
														target.canConfigure = false;
													}
													if (field === "canConfigure" && checked) {
														target.canView = true;
													}
													permsMap.set(sector, target);
													setFieldValue("sectorPermissions", Array.from(permsMap.values()));
												};

												return (
													<div key={sector} className={classes.permRow}>
														<span className={classes.permSector}>
															{sector}
															{secItem.minimumProfile === "admin_master" && (
																<Chip
																	size="small"
																	label="Apenas Master"
																	className={classes.masterOnlyChip}
																/>
															)}
														</span>
														<div className={classes.permChecks}>
															<FormControlLabel
																control={
																	<Checkbox
																		color="primary"
																		size="small"
																		checked={Boolean(current.canView)}
																		onChange={e => updatePerm("canView", e.target.checked)}
																	/>
																}
																label={<span style={{ fontSize: "0.85rem" }}>Ver</span>}
															/>
															<FormControlLabel
																control={
																	<Checkbox
																		color="primary"
																		size="small"
																		checked={Boolean(current.canConfigure)}
																		onChange={e => updatePerm("canConfigure", e.target.checked)}
																	/>
																}
																label={<span style={{ fontSize: "0.85rem" }}>Editar</span>}
															/>
														</div>
													</div>
												);
											})}
										</div>
									</div>
								)}

								<Can
									role={loggedInUser.profile}
									perform="user-modal:editQueues"
									yes={() => (!loading &&
										<FormControl variant="outlined" margin="dense" className={classes.maxWidth} fullWidth>
											<InputLabel>{i18n.t("userModal.form.whatsapp")}</InputLabel>
											<Field
												as={Select}
												value={whatsappId}
												onChange={(e) => setWhatsappId(e.target.value)}
												label={i18n.t("userModal.form.whatsapp")}
											>
												<MenuItem value={''}>&nbsp;</MenuItem>
												{whatsApps.map((whatsapp) => (
													<MenuItem key={whatsapp.id} value={whatsapp.id}>{whatsapp.name}</MenuItem>
												))}
											</Field>
										</FormControl>
									)}
								/>
							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									disabled={isSubmitting}
									variant="outlined"
								>
									{i18n.t("userModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{userId
										? `${i18n.t("userModal.buttons.okEdit")}`
										: `${i18n.t("userModal.buttons.okAdd")}`}
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

			{/* Popup para Adicionar Novo Setor */}
			<Dialog open={newSectorOpen} onClose={() => setNewSectorOpen(false)} maxWidth="xs" fullWidth>
				<div className={classes.header}>
					<div className={classes.headerIcon}>
						<CategoryOutlined />
					</div>
					<div className={classes.headerText}>
						<Typography component="h2" className={classes.title}>
							Novo Setor
						</Typography>
						<Typography className={classes.subtitle}>
							Crie um setor e defina o nível mínimo de acesso.
						</Typography>
					</div>
					<IconButton size="small" onClick={() => setNewSectorOpen(false)} aria-label="Fechar">
						<Close fontSize="small" />
					</IconButton>
				</div>
				<DialogContent className={classes.content}>
					<TextField
						autoFocus
						fullWidth
						label="Nome do Setor"
						variant="outlined"
						margin="dense"
						value={newSectorName}
						onChange={e => setNewSectorName(e.target.value)}
					/>
					<FormControl fullWidth variant="outlined" margin="dense">
						<InputLabel id="min-profile-label">Nível mínimo que pode ver</InputLabel>
						<Select
							labelId="min-profile-label"
							label="Nível mínimo que pode ver"
							value={newSectorMinimumProfile}
							onChange={e => setNewSectorMinimumProfile(e.target.value)}
						>
							<MenuItem value="admin_operational">Administrador Operacional</MenuItem>
							<MenuItem value="admin_master">Apenas Administrador Master</MenuItem>
						</Select>
						<FormHelperText>
							Setores operacionais podem ser distribuídos para administradores operacionais.
						</FormHelperText>
					</FormControl>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setNewSectorOpen(false)} variant="outlined">
						Cancelar
					</Button>
					<Button
						onClick={handleCreateNewSector}
						color="primary"
						variant="contained"
						disabled={!newSectorName.trim()}
					>
						Criar Setor
					</Button>
				</DialogActions>
			</Dialog>
		</div>
	);
};

export default UserModal;
