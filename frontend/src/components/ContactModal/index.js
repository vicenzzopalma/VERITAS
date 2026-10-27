import React, { useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, FieldArray, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CloseIcon from "@material-ui/icons/Close";
import AddIcon from "@material-ui/icons/Add";
import PersonOutlineIcon from "@material-ui/icons/PersonOutline";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";

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
	row: {
		display: "flex",
		gap: theme.spacing(1.5),
		[theme.breakpoints.down("xs")]: { flexDirection: "column" },
	},
	textField: {
		margin: 0,
		flex: 1,
	},

	extraAttr: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
		padding: theme.spacing(1),
		borderRadius: 12,
		border: `1px solid ${theme.custom.border}`,
		backgroundColor: theme.custom.surfaceAlt,
	},
	extraEmpty: {
		fontSize: "0.82rem",
		color: theme.palette.text.secondary,
	},
	addExtra: {
		alignSelf: "flex-start",
	},
	deleteBtn: {
		"&:hover": { color: theme.palette.error.main },
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
}));

const ContactSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(50, "Too Long!")
		.required("Required"),
	number: Yup.string().min(8, "Too Short!").max(50, "Too Long!"),
	email: Yup.string().email("Invalid email"),
});

const ContactModal = ({ open, onClose, contactId, initialValues, onSave }) => {
	const classes = useStyles();
	const isMounted = useRef(true);

	const initialState = {
		name: "",
		number: "",
		email: "",
	};

	const [contact, setContact] = useState(initialState);

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	useEffect(() => {
		const fetchContact = async () => {
			if (initialValues) {
				setContact(prevState => {
					return { ...prevState, ...initialValues };
				});
			}

			if (!contactId) return;

			try {
				const { data } = await api.get(`/contacts/${contactId}`);
				if (isMounted.current) {
					setContact(data);
				}
			} catch (err) {
				toastError(err);
			}
		};

		fetchContact();
	}, [contactId, open, initialValues]);

	const handleClose = () => {
		onClose();
		setContact(initialState);
	};

	const handleSaveContact = async values => {
		try {
			if (contactId) {
				await api.put(`/contacts/${contactId}`, values);
				handleClose();
			} else {
				const { data } = await api.post("/contacts", values);
				if (onSave) {
					onSave(data);
				}
				handleClose();
			}
			toast.success(i18n.t("contactModal.success"));
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
						<PersonOutlineIcon />
					</div>
					<div className={classes.headerText}>
						<Typography
							id="form-dialog-title"
							component="h2"
							className={classes.title}
						>
							{contactId
								? `${i18n.t("contactModal.title.edit")}`
								: `${i18n.t("contactModal.title.add")}`}
						</Typography>
						<Typography className={classes.subtitle}>
							Dados de contato e informações adicionais do cliente.
						</Typography>
					</div>
					<IconButton size="small" onClick={handleClose} aria-label="Fechar">
						<CloseIcon fontSize="small" />
					</IconButton>
				</div>
				<Formik
					initialValues={contact}
					enableReinitialize={true}
					validationSchema={ContactSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveContact(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ values, errors, touched, isSubmitting }) => (
						<Form
							style={{ display: "flex", flexDirection: "column", minHeight: 0 }}
						>
							<DialogContent className={classes.content}>
								<Typography className={classes.sectionLabel}>
									{i18n.t("contactModal.form.mainInfo")}
								</Typography>
								<div className={classes.row}>
									<Field
										as={TextField}
										label={i18n.t("contactModal.form.name")}
										name="name"
										autoFocus
										error={touched.name && Boolean(errors.name)}
										helperText={touched.name && errors.name}
										variant="outlined"
										margin="dense"
										className={classes.textField}
									/>
									<Field
										as={TextField}
										label={i18n.t("contactModal.form.number")}
										name="number"
										error={touched.number && Boolean(errors.number)}
										helperText={touched.number && errors.number}
										placeholder="5513912344321"
										variant="outlined"
										margin="dense"
										className={classes.textField}
									/>
								</div>
								<Field
									as={TextField}
									label={i18n.t("contactModal.form.email")}
									name="email"
									error={touched.email && Boolean(errors.email)}
									helperText={touched.email && errors.email}
									placeholder="Email address"
									fullWidth
									margin="dense"
									variant="outlined"
									className={classes.textField}
								/>

								<Typography
									className={`${classes.sectionLabel} ${classes.sectionSpacer}`}
								>
									{i18n.t("contactModal.form.extraInfo")}
								</Typography>

								<FieldArray name="extraInfo">
									{({ push, remove }) => (
										<>
											{!(values.extraInfo && values.extraInfo.length > 0) && (
												<Typography className={classes.extraEmpty}>
													Nenhuma informação adicional. Adicione campos como
													empresa, CPF ou observações.
												</Typography>
											)}
											{values.extraInfo &&
												values.extraInfo.length > 0 &&
												values.extraInfo.map((info, index) => (
													<div
														className={classes.extraAttr}
														key={`${index}-info`}
													>
														<Field
															as={TextField}
															label={i18n.t("contactModal.form.extraName")}
															name={`extraInfo[${index}].name`}
															variant="outlined"
															margin="dense"
															className={classes.textField}
														/>
														<Field
															as={TextField}
															label={i18n.t("contactModal.form.extraValue")}
															name={`extraInfo[${index}].value`}
															variant="outlined"
															margin="dense"
															className={classes.textField}
														/>
														<Tooltip title="Remover">
															<IconButton
																size="small"
																className={classes.deleteBtn}
																onClick={() => remove(index)}
															>
																<DeleteOutlineIcon fontSize="small" />
															</IconButton>
														</Tooltip>
													</div>
												))}
											<Button
												className={classes.addExtra}
												variant="outlined"
												color="primary"
												size="small"
												startIcon={<AddIcon />}
												onClick={() => push({ name: "", value: "" })}
											>
												{i18n.t("contactModal.buttons.addExtraInfo")}
											</Button>
										</>
									)}
								</FieldArray>
							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									disabled={isSubmitting}
									variant="outlined"
								>
									{i18n.t("contactModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{contactId
										? `${i18n.t("contactModal.buttons.okEdit")}`
										: `${i18n.t("contactModal.buttons.okAdd")}`}
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

export default ContactModal;
