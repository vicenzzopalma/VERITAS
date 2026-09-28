import React, { useEffect, useState, useRef, useCallback } from "react";
import { Box, CircularProgress, Typography, Button } from "@material-ui/core";
import api from "../../services/api";

const MaintenanceScreen = () => {
	const [visible, setVisible] = useState(false);
	const consecutiveFailuresRef = useRef(0);
	const checkingRef = useRef(false);

	const checkBackend = useCallback(async () => {
		if (checkingRef.current) return;
		checkingRef.current = true;

		try {
			const res = await api.get("/health", { timeout: 4000 });
			if (res?.data?.status === "ok" || res?.status === 200) {
				consecutiveFailuresRef.current = 0;
				setVisible(false);
			}
		} catch (error) {
			const status = error.response?.status;
			if (!status || [502, 503, 504].includes(status)) {
				consecutiveFailuresRef.current += 1;
				if (consecutiveFailuresRef.current >= 4) {
					setVisible(true);
				}
			} else {
				consecutiveFailuresRef.current = 0;
				setVisible(false);
			}
		} finally {
			checkingRef.current = false;
		}
	}, []);

	useEffect(() => {
		const handleBackendUnavailable = () => {
			checkBackend();
		};
		window.addEventListener("veritas:backend-unavailable", handleBackendUnavailable);

		return () => {
			window.removeEventListener("veritas:backend-unavailable", handleBackendUnavailable);
		};
	}, [checkBackend]);

	useEffect(() => {
		const intervalMs = visible ? 3000 : 30000;
		const interval = window.setInterval(checkBackend, intervalMs);

		return () => {
			window.clearInterval(interval);
		};
	}, [visible, checkBackend]);

	if (!visible) return null;

	return (
		<Box
			role="alert"
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 2147483647,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				flexDirection: "column",
				gap: 16,
				background: "#f5f7fb",
				color: "#172033",
				textAlign: "center",
				padding: 24,
			}}
		>
			<CircularProgress color="primary" size={34} />
			<Typography variant="h4" style={{ fontWeight: 800 }}>
				Estamos em manutenção
			</Typography>
			<Typography variant="body1" color="textSecondary">
				O sistema está sincronizando serviços. Tentaremos reconectar automaticamente.
			</Typography>
			<Button
				variant="outlined"
				color="primary"
				size="small"
				onClick={() => checkBackend()}
				style={{ marginTop: 8 }}
			>
				Verificar Conexão Agora
			</Button>
		</Box>
	);
};

export default MaintenanceScreen;
