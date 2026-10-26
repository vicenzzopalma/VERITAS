import React, { useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import CircularProgress from "@material-ui/core/CircularProgress";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ColorPicker from "../ColorPicker";
import { IconButton, InputAdornment, Tooltip } from "@material-ui/core";
import { Colorize, Close, AccountTreeOutlined } from "@material-ui/icons";

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
		transition: "background-color .2s, color .2s",
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
		gap: theme.spacing(2),
	},
	row: {
		display: "flex",
		gap: theme.spacing(1.5),
		[theme.breakpoints.down("xs")]: { flexDirection: "column" },
	},
	field: {
		margin: 0,
		flex: 1,
	},
	colorField: {
		margin: 0,
		width: 190,
		[theme.breakpoints.down("xs")]: { width: "100%" },
		"& input": { cursor: "pointer", fontFamily: "monospace" },
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
	colorAdorment: {
		width: 20,
		height: 20,
		borderRadius: "50%",
		border: `1px solid ${theme.custom.border}`,
		backgroundColor: theme.custom.surfaceAlt,
	},
}));

const QueueSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(50, "Too Long!")
		.required("Required"),
	color: Yup.string().min(3, "Too Short!").max(9, "Too Long!").required(),
	greetingMessage: Yup.string(),
});

const QueueModal = ({ open, onClose, queueId }) => {
	const classes = useStyles();

	const initialState = {
		name: "",
		color: "",
		greetingMessage: "",
	};

	const [colorPickerModalOpen, setColorPickerModalOpen] = useState(false);
	const [queue, setQueue] = useState(initialState);
	const greetingRef = useRef();

	useEffect(() => {
		(async () => {
			if (!queueId) return;
			try {
				const { data } = await api.get(`/queue/${queueId}`);
				setQueue(prevState => {
					return { ...prevState, ...data };
				});
			} catch (err) {
				toastError(err);
			}
		})();

		return () => {
			setQueue({
				name: "",
				color: "",
				greetingMessage: "",
			});
		};
	}, [queueId, open]);

	const handleClose = () => {
		onClose();
		setQueue(initialState);
	};

	const handleSaveQueue = async values => {
		try {
			if (queueId) {
				await api.put(`/queue/${queueId}`, values);
			} else {
				await api.post("/queue", values);
			}
			toast.success("Queue saved successfully");
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
				scroll="paper"
				maxWidth="sm"
				fullWidth
			>
				<Formik
					initialValues={queue}
					enableReinitialize={true}
					validationSchema={QueueSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveQueue(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ touched, errors, isSubmitting, values }) => (
						<Form
							style={{ display: "flex", flexDirection: "column", minHeight: 0 }}
						>
							<div className={classes.header}>
								<div
									className={classes.headerIcon}
									style={
										values.color
											? { backgroundColor: values.color, color: "#fff" }
											: undefined
									}
								>
									<AccountTreeOutlined />
								</div>
								<div className={classes.headerText}>
									<Typography component="h2" className={classes.title}>
										{queueId
											? `${i18n.t("queueModal.title.edit")}`
											: `${i18n.t("queueModal.title.add")}`}
									</Typography>
									<Typography className={classes.subtitle}>
										Defina nome, cor e a mensagem de saudação enviada ao cliente.
									</Typography>
								</div>
								<IconButton size="small" onClick={handleClose} aria-label="Fechar">
									<Close fontSize="small" />
								</IconButton>
							</div>
							<DialogContent className={classes.content}>
								<div className={classes.row}>
									<Field
										as={TextField}
										label={i18n.t("queueModal.form.name")}
										autoFocus
										name="name"
										error={touched.name && Boolean(errors.name)}
										helperText={touched.name && errors.name}
										variant="outlined"
										margin="dense"
										className={classes.field}
									/>
									<Field
										as={TextField}
										label={i18n.t("queueModal.form.color")}
										name="color"
										id="color"
										onFocus={() => {
											setColorPickerModalOpen(true);
											greetingRef.current.focus();
										}}
										error={touched.color && Boolean(errors.color)}
										helperText={touched.color && errors.color}
										InputProps={{
											startAdornment: (
												<InputAdornment position="start">
													<div
														style={
															values.color
																? { backgroundColor: values.color }
																: undefined
														}
														className={classes.colorAdorment}
													></div>
												</InputAdornment>
											),
											endAdornment: (
												<Tooltip title="Escolher cor">
													<IconButton
														size="small"
														color="default"
														onClick={() => setColorPickerModalOpen(true)}
													>
														<Colorize fontSize="small" />
													</IconButton>
												</Tooltip>
											),
										}}
										variant="outlined"
										margin="dense"
										className={classes.colorField}
									/>
								</div>
								<ColorPicker
									open={colorPickerModalOpen}
									currentColor={values.color}
									handleClose={() => setColorPickerModalOpen(false)}
									onChange={color => {
										values.color = color;
										setQueue(() => {
											return { ...values, color };
										});
									}}
								/>
								<Field
									as={TextField}
									label={i18n.t("queueModal.form.greetingMessage")}
									type="greetingMessage"
									multiline
									inputRef={greetingRef}
									rows={5}
									fullWidth
									name="greetingMessage"
									error={
										touched.greetingMessage && Boolean(errors.greetingMessage)
									}
									helperText={
										(touched.greetingMessage && errors.greetingMessage) ||
										"Enviada automaticamente quando o cliente entra nesta fila."
									}
									variant="outlined"
									margin="dense"
									className={classes.field}
								/>
							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									disabled={isSubmitting}
									variant="outlined"
								>
									{i18n.t("queueModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{queueId
										? `${i18n.t("queueModal.buttons.okEdit")}`
										: `${i18n.t("queueModal.buttons.okAdd")}`}
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

export default QueueModal;
