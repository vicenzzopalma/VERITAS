import React, { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode.react";
import toastError from "../../errors/toastError";

import { Dialog, DialogContent, IconButton, Typography, CircularProgress, Tooltip, InputBase } from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import CloseIcon from "@material-ui/icons/Close";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import FileCopyOutlinedIcon from "@material-ui/icons/FileCopyOutlined";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import openSocket from "../../services/socket-io";

const useStyles = makeStyles(theme => {
	const c = theme.custom;
	return {
		paper: { overflow: "hidden" },
		content: {
			position: "relative",
			display: "flex",
			gap: theme.spacing(4),
			alignItems: "center",
			padding: theme.spacing(3, 4),
			[theme.breakpoints.down("xs")]: {
				flexDirection: "column-reverse",
				padding: theme.spacing(3, 2.5),
				gap: theme.spacing(3),
			},
			"&:first-child": { paddingTop: theme.spacing(3) },
		},
		close: { position: "absolute", top: 10, right: 10 },
		info: { flex: 1, minWidth: 220, maxWidth: 300 },
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
			...c.dotGrid,
		},
		// The QR tile is always white with black modules (scanners need contrast,
		// also in dark mode).
		// QR grande (480px, como antes do redesign); só encolhe se a tela não tiver altura.
		qrTile: {
			width: "min(512px, calc(100vh - 190px))",
			height: "min(512px, calc(100vh - 190px))",
			borderRadius: 14,
			backgroundColor: "#FFFFFF",
			display: "grid",
			placeItems: "center",
			boxShadow: c.shadow,
			border: "1px solid #E6E8F0",
			[theme.breakpoints.down("xs")]: { width: 260, height: 260 },
		},
		qr: {
			width: "calc(100% - 32px) !important",
			height: "calc(100% - 32px) !important",
			[theme.breakpoints.down("xs")]: { width: "232px !important", height: "232px !important" },
		},
		waiting: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "#5F6478", fontSize: "0.82rem" },
		// item 81: código de pareamento, uma linha discreta embaixo do QR.
		pairing: { marginTop: theme.spacing(1.25), textAlign: "center", fontSize: "0.9rem", color: c.text },
		pairingLine: { display: "inline-flex", alignItems: "center", gap: 4, minHeight: 28 },
		pairingCode: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", letterSpacing: "0.06em", fontWeight: 600 },
		pairingMuted: { color: c.textMuted },
		pairingHint: { color: c.textMuted, fontSize: "0.74rem", opacity: 0.85, marginTop: 2 },
		pairingInput: {
			fontSize: "0.86rem",
			width: 170,
			padding: "1px 8px",
			border: `1px solid ${c.border}`,
			borderRadius: 8,
		},
		pairingBtn: {
			border: "none",
			background: "none",
			color: theme.palette.primary.main,
			cursor: "pointer",
			fontSize: "0.84rem",
			fontWeight: 600,
			padding: "2px 6px",
		},
	};
});

const STEPS = [
	"Abra o WhatsApp no seu celular",
	"Toque em Mais opções ou Configurações e selecione Aparelhos conectados",
	"Toque em Conectar um aparelho",
	"Aponte o celular para esta tela para ler o código",
];

const PAIRING_HINT = "WhatsApp > Aparelhos conectados > Conectar com número de telefone";

// item 81: código para conectar sem ler o QR. Singelo: "Código: XXXX-XXXX" + copiar.
const PairingCodeLine = ({ classes, whatsAppId, pairing, onPairing }) => {
	const [number, setNumber] = useState("");
	const [sending, setSending] = useState(false);
	const [copied, setCopied] = useState(false);
	const status = pairing?.status;

	const handleCopy = async () => {
		if (!pairing?.code) return;
		try {
			await navigator.clipboard.writeText(pairing.code);
		} catch (e) {
			const el = document.createElement("textarea");
			el.value = pairing.code;
			document.body.appendChild(el);
			el.select();
			document.execCommand("copy");
			document.body.removeChild(el);
		}
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	const handleRequest = async e => {
		e.preventDefault();
		if (!number.trim() || sending) return;
		setSending(true);
		try {
			const { data } = await api.post(`/whatsappsession/${whatsAppId}/pairing-code`, { number });
			onPairing(data);
		} catch (err) {
			toastError(err);
		} finally {
			setSending(false);
		}
	};

	let line;
	if (status === "OK" && pairing.code) {
		line = (
			<span className={classes.pairingLine}>
				<span>Código:</span>
				<span className={classes.pairingCode}>{pairing.code}</span>
				<Tooltip title={copied ? "Copiado" : "Copiar"}>
					<IconButton size="small" onClick={handleCopy} aria-label="copiar código">
						<FileCopyOutlinedIcon style={{ fontSize: 15 }} />
					</IconButton>
				</Tooltip>
			</span>
		);
	} else if (status === "GERANDO" || sending) {
		line = <span className={`${classes.pairingLine} ${classes.pairingMuted}`}>Código: gerando...</span>;
	} else {
		line = (
			<form className={classes.pairingLine} onSubmit={handleRequest}>
				<InputBase
					className={classes.pairingInput}
					placeholder="Número do chip p/ código"
					value={number}
					onChange={e => setNumber(e.target.value)}
					inputProps={{ inputMode: "tel", "aria-label": "número do chip" }}
				/>
				<button type="submit" className={classes.pairingBtn}>
					Gerar código
				</button>
			</form>
		);
	}

	return (
		<div className={classes.pairing}>
			{line}
			<div className={classes.pairingHint}>
				{status === "ERRO" ? pairing.error || "Não foi possível gerar o código agora." : PAIRING_HINT}
			</div>
		</div>
	);
};

const QrcodeModal = ({ open, onClose, whatsAppId }) => {
	const classes = useStyles();
	const [qrCode, setQrCode] = useState("");
	const [pairing, setPairing] = useState(null);
	const lastRenewRef = useRef(0);

	// Renova o QR automaticamente enquanto o modal está aberto. O WhatsApp entrega poucos QRs
	// por sessão; quando acabam, a sessão é encerrada e pedimos um novo (igual ao botão "Novo QR").
	const renewQr = useCallback(async () => {
		if (!open || !whatsAppId) return;
		const now = Date.now();
		if (now - lastRenewRef.current < 10000) return;
		lastRenewRef.current = now;
		try {
			await api.put(`/whatsappsession/${whatsAppId}`);
		} catch (err) {
			// silencioso: tenta de novo no próximo ciclo
		}
	}, [open, whatsAppId]);

	const handleSessionUpdate = useCallback(
		session => {
			if (!session || session.id !== whatsAppId) return;
			if (session.status === "CONNECTED") {
				onClose();
				return;
			}
			if (session.qrcode) {
				setQrCode(session.qrcode);
			} else if (session.status === "DISCONNECTED") {
				// QR expirou e a sessão foi encerrada: gerar outro
				setQrCode("");
				setPairing(null);
				renewQr();
			}
		},
		[whatsAppId, onClose, renewQr]
	);

	useEffect(() => {
		const fetchSession = async () => {
			if (!whatsAppId) return;

			try {
				const { data } = await api.get(`/whatsapp/${whatsAppId}`);
				setQrCode(data.qrcode);
				if (!data.qrcode && data.status === "DISCONNECTED") renewQr();
			} catch (err) {
				toastError(err);
			}
		};
		fetchSession();
	}, [whatsAppId, renewQr]);

	useEffect(() => {
		if (!whatsAppId) return;
		const socket = openSocket();

		socket.on("whatsappSession", data => {
			if (data.action === "update") handleSessionUpdate(data.session);
		});

		socket.on("whatsapp", data => {
			if (data.action === "update") handleSessionUpdate(data.whatsapp);
		});

		socket.on("whatsappPairingCode", data => {
			if (data.action === "update" && data.pairing?.whatsappId === whatsAppId) {
				setPairing(data.pairing);
			}
		});

		return () => {
			socket.disconnect();
		};
	}, [whatsAppId, handleSessionUpdate]);

	// O modal pode abrir depois do evento do código: busca o estado atual a cada QR novo.
	useEffect(() => {
		setPairing(null);
	}, [whatsAppId]);

	useEffect(() => {
		if (!open || !whatsAppId || !qrCode) return;
		let alive = true;
		api
			.get(`/whatsappsession/${whatsAppId}/pairing-code`)
			.then(({ data }) => {
				if (alive && data) setPairing(prev => (prev?.status === "OK" && data.status !== "OK" ? prev : data));
			})
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, [open, whatsAppId, qrCode]);

	// Rede de segurança: se ficar sem QR por 30s com o modal aberto, pede um novo.
	useEffect(() => {
		if (!open || !whatsAppId || qrCode) return;
		const timer = setTimeout(renewQr, 30000);
		return () => clearTimeout(timer);
	}, [open, whatsAppId, qrCode, renewQr]);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="lg"
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
						Vincule este número à plataforma em poucos segundos.
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
							<QRCode
								value={qrCode}
								size={480}
								bgColor="#ffffff"
								fgColor="#000000"
								className={classes.qr}
							/>
						) : (
							<div className={classes.waiting}>
								<CircularProgress size={28} />
								<span>Aguardando QR Code...</span>
							</div>
						)}
					</div>
					{qrCode && (
						<PairingCodeLine
							classes={classes}
							whatsAppId={whatsAppId}
							pairing={pairing}
							onPairing={setPairing}
						/>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default React.memo(QrcodeModal);
