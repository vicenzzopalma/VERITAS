import React, { useEffect, useState } from "react";
import QRCode from "qrcode.react";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";

import { Dialog, DialogContent, IconButton, Typography, CircularProgress } from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import CloseIcon from "@material-ui/icons/Close";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";

const useStyles = makeStyles(theme => {
	const c = theme.custom;
	return {
		paper: { overflow: "hidden" },
		content: {
			position: "relative",
			display: "flex",
			gap: theme.spacing(4),
			alignItems: "center",
			padding: theme.spacing(4),
			[theme.breakpoints.down("xs")]: {
				flexDirection: "column-reverse",
				padding: theme.spacing(3, 2.5),
				gap: theme.spacing(3),
			},
			"&:first-child": { paddingTop: theme.spacing(4) },
		},
		close: { position: "absolute", top: 10, right: 10 },
		info: { flex: 1, minWidth: 0, maxWidth: 320 },
		badge: {
			width: 44,
			height: 44,
			borderRadius: 12,
			display: "grid",
			placeItems: "center",
			color: "#25D366",
			backgroundColor: alpha("#25D366", theme.palette.type === "dark" ? 0.16 : 0.12),
			marginBottom: theme.spacing(2),
		},
		title: { fontWeight: 750, fontSize: "1.2rem", letterSpacing: "-0.01em", marginBottom: theme.spacing(0.5) },
		subtitle: { color: c.textMuted, fontSize: "0.86rem", marginBottom: theme.spacing(2.5) },
		steps: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: theme.spacing(1.5) },
		step: { display: "flex", gap: theme.spacing(1.5), alignItems: "flex-start", fontSize: "0.86rem", color: c.text, lineHeight: 1.45 },
		stepNum: {
			flex: "none",
			width: 24,
			height: 24,
			borderRadius: "50%",
			display: "grid",
			placeItems: "center",
			fontSize: "0.74rem",
			fontWeight: 700,
			color: theme.palette.primary.main,
			backgroundColor: c.primarySoft,
		},
		qrWrap: {
			flex: "none",
			padding: theme.spacing(1.5),
			borderRadius: 20,
			border: `1px solid ${c.border}`,
			backgroundColor: c.surfaceAlt,
			...c.dotGrid,
		},
		qrTile: {
			width: 280,
			height: 280,
			borderRadius: 14,
			backgroundColor: "#FFFFFF",
			display: "grid",
			placeItems: "center",
			boxShadow: c.shadow,
			border: "1px solid #E6E8F0",
			[theme.breakpoints.down("xs")]: { width: 240, height: 240 },
		},
		qr: { [theme.breakpoints.down("xs")]: { width: "216px !important", height: "216px !important" } },
		waiting: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "#5F6478", fontSize: "0.82rem" },
	};
});

const STEPS = [
	"Abra o WhatsApp no seu celular",
	"Toque em Mais opções ou Configurações e selecione Aparelhos conectados",
	"Toque em Conectar um aparelho",
	"Aponte o celular para esta tela para ler o código",
];

const QrcodeModal = ({ open, onClose, whatsAppId }) => {
	const classes = useStyles();
	const [qrCode, setQrCode] = useState("");

	useEffect(() => {
		const fetchSession = async () => {
			if (!whatsAppId) return;

			try {
				const { data } = await api.get(`/whatsapp/${whatsAppId}`);
				setQrCode(data.qrcode);
			} catch (err) {
				toastError(err);
			}
		};
		fetchSession();
	}, [whatsAppId]);

	useEffect(() => {
		if (!whatsAppId) return;
		const socket = openSocket();

		socket.on("whatsappSession", data => {
			if (data.action === "update" && data.session.id === whatsAppId) {
				setQrCode(data.session.qrcode);
			}

			if (data.action === "update" && data.session.qrcode === "") {
				onClose();
			}
		});

		return () => {
			socket.disconnect();
		};
	}, [whatsAppId, onClose]);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="md"
			scroll="paper"
			classes={{ paper: classes.paper }}
		>
			<DialogContent className={classes.content}>
				<IconButton size="small" className={classes.close} onClick={onClose} aria-label="close">
					<CloseIcon fontSize="small" />
				</IconButton>
				<div className={classes.info}>
					<div className={classes.badge}>
						<WhatsAppIcon />
					</div>
					<Typography className={classes.title}>{i18n.t("qrCode.message")}</Typography>
					<Typography className={classes.subtitle}>
						Vincule este número ao Gisaio em poucos segundos.
					</Typography>
					<ol className={classes.steps}>
						{STEPS.map((step, idx) => (
							<li key={idx} className={classes.step}>
								<span className={classes.stepNum}>{idx + 1}</span>
								<span>{step}</span>
							</li>
						))}
					</ol>
				</div>
				<div className={classes.qrWrap}>
					<div className={classes.qrTile}>
						{qrCode ? (
							<QRCode value={qrCode} size={248} className={classes.qr} />
						) : (
							<div className={classes.waiting}>
								<CircularProgress size={28} />
								<span>Waiting for QR Code</span>
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default React.memo(QrcodeModal);
