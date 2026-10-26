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
	Typography,
	Select,
	InputLabel,
	MenuItem,
	FormControl,
	TextField,
	InputAdornment,
	IconButton
  } from '@material-ui/core';

import { Visibility, VisibilityOff, Close, PersonAddOutlined, PersonOutline } from '@material-ui/icons';

import { makeStyles } from "@material-ui/core/styles";

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

const UserModal = ({ open, onClose, userId }) => {
	const classes = useStyles();

	const initialState = {
		name: "",
		email: "",
		password: "",
		profile: "user"
	};

	const { user: loggedInUser } = useContext(AuthContext);

	const [user, setUser] = useState(initialState);
	const [selectedQueueIds, setSelectedQueueIds] = useState([]);
	const [showPassword, setShowPassword] = useState(false);
	const [whatsappId, setWhatsappId] = useState(false);
	const {loading, whatsApps} = useWhatsApps();

	useEffect(() => {
		const fetchUser = async () => {
			if (!userId) return;
			try {
				const { data } = await api.get(`/users/${userId}`);
				setUser(prevState => {
					return { ...prevState, ...data };
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

	const handleSaveUser = async values => {
		const userData = { ...values, whatsappId, queueIds: selectedQueueIds };
		try {
			if (userId) {
				await api.put(`/users/${userId}`, userData);
			} else {
				await api.post("/users", userData);
			}
			toast.success(i18n.t("userModal.success"));
		} catch (err) {
			toastError(err);
		}
		handleClose();
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
							Dados de acesso, perfil e filas de atendimento do usuário.
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
					{({ touched, errors, isSubmitting }) => (
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
										variant="outlined"
										margin="dense"
										label={i18n.t("userModal.form.password")}
										error={touched.password && Boolean(errors.password)}
										helperText={touched.password && errors.password}
										type={showPassword ? 'text' : 'password'}
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
														<MenuItem value="admin">Admin</MenuItem>
														<MenuItem value="master">Master</MenuItem>
														<MenuItem value="user">User</MenuItem>
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
		</div>
	);
};

export default UserModal;
