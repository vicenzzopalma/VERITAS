import React, { useEffect, useState } from "react";
import QRCode from "qrcode.react";
import toastError from "../../errors/toastError";

import { Dialog, DialogContent, Paper, Typography } from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import openSocket from "../../services/socket-io";

const QrcodeModal = ({ open, onClose, whatsAppId }) => {
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
			if (data.action === "update" && data.session && data.session.id === whatsAppId) {
				if (data.session.qrcode !== undefined) {
					setQrCode(data.session.qrcode);
				}
				if (data.session.status === "CONNECTED") {
					onClose();
				}
			}
		});

		socket.on("whatsapp", data => {
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
			socket.disconnect();
		};
	}, [whatsAppId, onClose]);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="lg"
			scroll="paper"
			PaperProps={{
				style: {
					backgroundColor: "#ffffff",
					color: "#000000",
				}
			}}
		>
			<DialogContent style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "24px", backgroundColor: "#ffffff" }}>
				<Paper elevation={0} style={{ display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#ffffff", color: "#000000" }}>
					<Typography style={{ color: "#075e54", marginBottom: "8px", fontWeight: 600 }} gutterBottom>
						{i18n.t("qrCode.message")}
					</Typography>
					{qrCode ? (
						<QRCode value={qrCode} size={480} bgColor="#ffffff" fgColor="#000000" />
					) : (
						<span style={{ color: "#000000" }}>Aguardando QR Code...</span>
					)}
				</Paper>
			</DialogContent>
		</Dialog>
	);
};

export default React.memo(QrcodeModal);
