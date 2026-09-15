import React, { useEffect, useState } from "react";
import QRCode from "qrcode.react";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";

import { Dialog, DialogContent, Paper, Typography, CircularProgress, Box, IconButton } from "@material-ui/core";
import { Close } from "@material-ui/icons";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";

const QrcodeModal = ({ open, onClose, whatsAppId }) => {
	const [qrCode, setQrCode] = useState("");

	useEffect(() => {
		if (!open || !whatsAppId) {
			setQrCode("");
			return;
		}

		let isMounted = true;

		const checkSession = async () => {
			try {
				const { data } = await api.get(`/whatsapp/${whatsAppId}`);
				if (!isMounted) return;

				if (data.status === "CONNECTED") {
					onClose();
					return;
				}
				if (data.qrcode) {
					setQrCode(data.qrcode);
				}
			} catch (err) {
				// Silencia falhas transitórias de polling
			}
		};

		// Checagem imediata
		checkSession();

		// Polling ativo a cada 1.5s enquanto o modal estiver aberto
		const pollInterval = setInterval(checkSession, 1500);

		const socket = openSocket();

		socket.on("whatsappSession", data => {
			if (!isMounted) return;
			if (data.action === "update" && data.session && data.session.id === whatsAppId) {
				if (data.session.qrcode) {
					setQrCode(data.session.qrcode);
				}

				if (data.session.status === "CONNECTED") {
					onClose();
				}
			}
		});

		socket.on("whatsapp", data => {
			if (!isMounted) return;
			if (data.action === "update" && data.whatsapp && data.whatsapp.id === whatsAppId) {
				if (data.whatsapp.qrcode) {
					setQrCode(data.whatsapp.qrcode);
				}

				if (data.whatsapp.status === "CONNECTED") {
					onClose();
				}
			}
		});

		return () => {
			isMounted = false;
			clearInterval(pollInterval);
			socket.disconnect();
		};
	}, [open, whatsAppId, onClose]);

	return (
		<Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth scroll="paper">
			<Box display="flex" justifyContent="flex-end" p={1}>
				<IconButton size="small" onClick={onClose}>
					<Close />
				</IconButton>
			</Box>
			<DialogContent style={{ paddingTop: 0, paddingBottom: 24 }}>
				<Paper elevation={0} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
					<Typography color="primary" gutterBottom variant="h6" style={{ fontWeight: 600 }}>
						{i18n.t("qrCode.message")}
					</Typography>
					{qrCode ? (
						<div style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.08)", marginTop: 8 }}>
							<QRCode value={qrCode} size={256} level="M" />
						</div>
					) : (
						<div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", gap: 16 }}>
							<CircularProgress size={40} />
							<Typography variant="body2" color="textSecondary">
								Aguardando geração do QR Code...
							</Typography>
						</div>
					)}
				</Paper>
			</DialogContent>
		</Dialog>
	);
};

export default React.memo(QrcodeModal);
