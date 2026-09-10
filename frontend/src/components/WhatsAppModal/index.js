import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import {
	Dialog,
	DialogContent,
	DialogTitle,
	Button,
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
} from "@material-ui/core";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";

const OFFICIAL_SECTORS = [
	"Junior",
	"Senior",
	"Pesquisa",
	"Comercial",
	"Juridico",
	"PA FIXA 1",
	"PA FIXA 2",
];

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
}));

const SessionSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Muito curto!")
		.max(50, "Muito longo!")
		.required("O nome é obrigatório"),
	sector: Yup.string()
		.required("O setor é obrigatório"),
});

const WhatsAppModal = ({ open, onClose, whatsAppId }) => {
	const classes = useStyles();
	const initialState = {
		name: "",
		greetingMessage: "",
		farewellMessage: "",
		isDefault: false,
		proxyUrl: "",
		humanDelay: true,
		sector: "Junior",
	};
	const [whatsApp, setWhatsApp] = useState(initialState);
	const [selectedQueueIds, setSelectedQueueIds] = useState([]);
	const [customSector, setCustomSector] = useState(false);

	useEffect(() => {
		const fetchSession = async () => {
			if (!whatsAppId) return;

			try {
				const { data } = await api.get(`whatsapp/${whatsAppId}`);
				setWhatsApp({
					...data,
					proxyUrl: data.proxyUrl || "",
					humanDelay: data.humanDelay !== false,
					sector: data.sector || "Junior",
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

		try {
			if (whatsAppId) {
				await api.put(`/whatsapp/${whatsAppId}`, whatsappData);
			} else {
				await api.post("/whatsapp", whatsappData);
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
				<DialogTitle>
					{whatsAppId
						? i18n.t("whatsappModal.title.edit")
						: i18n.t("whatsappModal.title.add")}
				</DialogTitle>
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
					{({ values, touched, errors, isSubmitting }) => (
						<Form>
							<DialogContent dividers>
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
									/>
								</div>
								<div style={{ marginTop: 8, marginBottom: 8 }}>
									{!customSector ? (
										<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
											<FormControl
												variant="outlined"
												margin="dense"
												fullWidth
												error={touched.sector && Boolean(errors.sector)}
											>
												<InputLabel id="sector-select-label">Setor do Aparelho *</InputLabel>
												<Field
													as={Select}
													labelId="sector-select-label"
													id="sector"
													name="sector"
													label="Setor do Aparelho *"
													value={values.sector || "Junior"}
												>
													{OFFICIAL_SECTORS.map(s => (
														<MenuItem key={s} value={s}>
															{s}
														</MenuItem>
													))}
													{!OFFICIAL_SECTORS.includes(values.sector) && values.sector && (
														<MenuItem key={values.sector} value={values.sector}>
															{values.sector} (Personalizado)
														</MenuItem>
													)}
												</Field>
												{touched.sector && errors.sector && (
													<FormHelperText>{errors.sector}</FormHelperText>
												)}
											</FormControl>
											<Button
												variant="outlined"
												size="small"
												color="primary"
												style={{ height: 40, whiteSpace: "nowrap" }}
												onClick={() => setCustomSector(true)}
											>
												+ Novo
											</Button>
										</div>
									) : (
										<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
												style={{ height: 40, whiteSpace: "nowrap" }}
												onClick={() => setCustomSector(false)}
											>
												Lista
											</Button>
										</div>
									)}
								</div>
								<div style={{ marginTop: 8, marginBottom: 8 }}>
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
								<div style={{ marginBottom: 8 }}>
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
									/>
								</div>
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
									color="secondary"
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
