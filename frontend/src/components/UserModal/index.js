import React, { useState, useEffect, useContext } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
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
	FormHelperText
} from '@material-ui/core';

import { Visibility, VisibilityOff } from '@material-ui/icons';

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

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
	multFieldLine: {
		display: "flex",
		"& > *:not(:last-child)": {
			marginRight: theme.spacing(1),
		},
	},

	btnWrapper: {
		position: "relative",
	},

	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},
	formControl: {
		margin: theme.spacing(1),
		minWidth: 120,
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
	const isMaster = loggedInUser?.profile === "admin_master" || String(loggedInUser?.email || "").toLowerCase().trim() === "vicenzzo.mastronikolis@realess.com.br";

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
				<DialogTitle id="form-dialog-title">
					{userId
						? `${i18n.t("userModal.title.edit")}`
						: `${i18n.t("userModal.title.add")}`}
				</DialogTitle>
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
						<Form>
							<DialogContent dividers>
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
													<FormControl variant="outlined" margin="dense" fullWidth style={{ marginTop: 10 }}>
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
														<FormHelperText style={{ color: "#6366f1", fontWeight: 500 }}>
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

								{/* Matriz de Permissões por Setor exclusiva para Master configurando Administrador Operacional */}
								{isMaster && (values.profile === "admin_operational" || values.profile === "admin") && String(values.email || "").toLowerCase().trim() !== "vicenzzo.mastronikolis@realess.com.br" && (
									<div style={{ marginTop: 16, padding: 14, border: "1px solid #c7d2fe", borderRadius: 8, background: "rgba(99,102,241,0.03)" }}>
										<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
											<div>
												<strong style={{ color: "#312e81", fontSize: "0.95rem" }}>
													Permissões por setor (Auditoria, Tickets e CRM)
												</strong>
												<FormHelperText style={{ color: "#475569", margin: 0 }}>
													Defina os setores que este administrador operacional poderá ver e editar.
												</FormHelperText>
											</div>
											<div style={{ display: "flex", gap: 6, alignItems: "center" }}>
												<Button
													size="small"
													variant="text"
													color="primary"
													style={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 700 }}
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
													style={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 700 }}
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
													style={{ textTransform: "none", fontWeight: 700, borderRadius: 6 }}
													onClick={() => setNewSectorOpen(true)}
												>
													+ Novo setor
												</Button>
											</div>
										</div>

										<div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
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
													<div
														key={sector}
														style={{
															display: "flex",
															alignItems: "center",
															justifyContent: "space-between",
															padding: "6px 12px",
															background: "#fff",
															borderRadius: 6,
															border: "1px solid #e2e8f0"
														}}
													>
														<span style={{ fontWeight: 600, color: "#1e293b", minWidth: 140 }}>
															{sector}
															{secItem.minimumProfile === "admin_master" && (
																<Chip
																	size="small"
																	label="Apenas Master"
																	style={{
																		marginLeft: 8,
																		height: 20,
																		fontSize: "0.65rem",
																		background: "#fef3c7",
																		color: "#92400e"
																	}}
																/>
															)}
														</span>
														<div style={{ display: "flex", gap: 16 }}>
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
									color="secondary"
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
				<DialogTitle>Novo Setor</DialogTitle>
				<DialogContent>
					<TextField
						autoFocus
						fullWidth
						label="Nome do Setor"
						variant="outlined"
						margin="dense"
						value={newSectorName}
						onChange={e => setNewSectorName(e.target.value)}
						style={{ marginBottom: 14 }}
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
					<Button onClick={() => setNewSectorOpen(false)} color="secondary">
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
