import React, { useState, useEffect, useContext } from "react";
import openSocket from "../../services/socket-io";

import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";
import SettingsOutlined from "@material-ui/icons/SettingsOutlined";
import PersonAddOutlined from "@material-ui/icons/PersonAddOutlined";
import VpnKeyOutlined from "@material-ui/icons/VpnKeyOutlined";
import FileCopyOutlined from "@material-ui/icons/FileCopyOutlined";
import Tune from "@material-ui/icons/Tune";
import { toast } from "react-toastify";

import api from "../../services/api";
import { i18n } from "../../translate/i18n.js";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import BackupPanel from "../../components/BackupPanel";
import { PageHeader, SectionCard } from "../../components/ui";

const useStyles = makeStyles(theme => {
	const c = theme.custom;
	return {
		root: {
			padding: theme.spacing(0, 3, 4),
			[theme.breakpoints.down("xs")]: { padding: theme.spacing(0, 1.5, 3) },
		},
		container: {
			padding: 0,
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing(2.5),
		},
		sectionIcon: {
			width: 32,
			height: 32,
			borderRadius: 9,
			display: "grid",
			placeItems: "center",
			flex: "none",
			color: theme.palette.primary.main,
			backgroundColor: c.primarySoft,
			marginRight: theme.spacing(0.5),
			"& svg": { fontSize: 18 },
		},
		row: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing(3),
			padding: theme.spacing(2.25, 2.5),
			"&:not(:last-child)": { borderBottom: `1px solid ${c.border}` },
			[theme.breakpoints.down("xs")]: {
				flexDirection: "column",
				alignItems: "stretch",
				gap: theme.spacing(1.5),
			},
		},
		rowIcon: {
			width: 36,
			height: 36,
			borderRadius: 10,
			display: "grid",
			placeItems: "center",
			flex: "none",
			color: c.textMuted,
			backgroundColor: c.surfaceAlt,
			border: `1px solid ${c.border}`,
			"& svg": { fontSize: 18 },
			[theme.breakpoints.down("xs")]: { display: "none" },
		},
		rowText: { flex: 1, minWidth: 0 },
		rowLabel: { fontWeight: 650, fontSize: "0.9rem", color: c.text },
		rowHelp: { fontSize: "0.8rem", color: c.textMuted, marginTop: 2, lineHeight: 1.45 },
		rowControl: {
			flex: "none",
			display: "flex",
			justifyContent: "flex-end",
			[theme.breakpoints.down("xs")]: { justifyContent: "stretch" },
		},
		settingOption: {
			minWidth: 180,
			[theme.breakpoints.down("xs")]: { width: "100%" },
		},
		tokenControl: {
			flex: "0 1 380px",
			[theme.breakpoints.down("xs")]: { flex: "1 1 auto" },
		},
		tokenInput: {
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
			fontSize: "0.82rem",
		},
		margin: {
			margin: theme.spacing(1),
		},
	};
});

const SettingRow = ({ classes, icon, label, help, children, controlClassName }) => (
	<div className={classes.row}>
		{icon && <div className={classes.rowIcon}>{icon}</div>}
		<div className={classes.rowText}>
			<div className={classes.rowLabel}>{label}</div>
			{help && <div className={classes.rowHelp}>{help}</div>}
		</div>
		<div className={`${classes.rowControl} ${controlClassName || ""}`}>{children}</div>
	</div>
);

const Settings = () => {
	const classes = useStyles();
	const { user } = useContext(AuthContext);

	const [settings, setSettings] = useState([]);

	const isMaster =
		user?.profile === "master" ||
		(user?.profile === "admin" && Number(user?.id) === 1);

	useEffect(() => {
		const fetchSession = async () => {
			try {
				const { data } = await api.get("/settings");
				setSettings(data);
			} catch (err) {
				toastError(err);
			}
		};
		fetchSession();
	}, []);

	useEffect(() => {
		const socket = openSocket();

		socket.on("settings", data => {
			if (data.action === "update") {
				setSettings(prevState => {
					const aux = [...prevState];
					const settingIndex = aux.findIndex(s => s.key === data.setting.key);
					aux[settingIndex].value = data.setting.value;
					return aux;
				});
			}
		});

		return () => {
			socket.disconnect();
		};
	}, []);

	const handleChangeSetting = async e => {
		const selectedValue = e.target.value;
		const settingKey = e.target.name;

		try {
			await api.put(`/settings/${settingKey}`, {
				value: selectedValue,
			});
			toast.success(i18n.t("settings.success"));
		} catch (err) {
			toastError(err);
		}
	};

	const getSettingValue = key => {
		const setting = settings.find(s => s.key === key);
		return setting ? setting.value : "";
	};

	const apiToken =
		settings && settings.length > 0 ? getSettingValue("userApiToken") : "";

	const handleCopyToken = async () => {
		if (!apiToken) return;
		try {
			await navigator.clipboard.writeText(apiToken);
			toast.success("Token copiado para a área de transferência.");
		} catch (err) {
			toast.error("Não foi possível copiar o token.");
		}
	};

	return (
		<div className={classes.root}>
			<Container className={classes.container} maxWidth="md">
				<PageHeader
					icon={<SettingsOutlined />}
					title={i18n.t("settings.title")}
					subtitle="Preferências gerais, integrações e manutenção do sistema."
				/>

				<SectionCard
					flush
					title="Geral"
					subtitle="Controle de acesso e comportamento padrão da plataforma."
					icon={
						<div className={classes.sectionIcon}>
							<Tune />
						</div>
					}
				>
					<SettingRow
						classes={classes}
						icon={<PersonAddOutlined />}
						label={i18n.t("settings.settings.userCreation.name")}
						help="Permite que novos usuários se cadastrem pela tela de login."
					>
						<Select
							margin="dense"
							variant="outlined"
							native
							id="userCreation-setting"
							name="userCreation"
							value={
								settings && settings.length > 0 ? getSettingValue("userCreation") : ""
							}
							className={classes.settingOption}
							onChange={handleChangeSetting}
						>
							<option value="enabled">
								{i18n.t("settings.settings.userCreation.options.enabled")}
							</option>
							<option value="disabled">
								{i18n.t("settings.settings.userCreation.options.disabled")}
							</option>
						</Select>
					</SettingRow>
				</SectionCard>

				<SectionCard
					flush
					title="Integrações"
					subtitle="Credenciais para conectar sistemas externos via API."
					icon={
						<div className={classes.sectionIcon}>
							<VpnKeyOutlined />
						</div>
					}
				>
					<SettingRow
						classes={classes}
						icon={<VpnKeyOutlined />}
						label="Token Api"
						help="Use este token no cabeçalho Authorization das requisições à API."
						controlClassName={classes.tokenControl}
					>
						<TextField
							id="api-token-setting"
							InputProps={{
								readOnly: true,
								classes: { input: classes.tokenInput },
								endAdornment: (
									<InputAdornment position="end">
										<Tooltip title="Copiar">
											<span>
												<IconButton
													size="small"
													onClick={handleCopyToken}
													disabled={!apiToken}
													aria-label="Copiar token"
												>
													<FileCopyOutlined fontSize="small" />
												</IconButton>
											</span>
										</Tooltip>
									</InputAdornment>
								),
							}}
							inputProps={{ "aria-label": "Token Api" }}
							margin="dense"
							variant="outlined"
							fullWidth
							value={apiToken}
						/>
					</SettingRow>
				</SectionCard>

				{/* Painel Exclusivo Master */}
				{isMaster && <BackupPanel />}
			</Container>
		</div>
	);
};

export default Settings;
