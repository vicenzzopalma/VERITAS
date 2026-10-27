import React, { useEffect, useState, useRef, useCallback } from "react";
import { CircularProgress } from "@material-ui/core";
import BuildOutlined from "@material-ui/icons/BuildOutlined";
import api from "../../services/api";

// Rendered outside the app ThemeProvider (see App.js), so colors are
// hard-coded to match the light theme tokens in src/theme.
const C = {
	bg: "#F4F5FA",
	dot: "rgba(15,18,34,0.09)",
	surface: "#FFFFFF",
	border: "#E6E8F0",
	text: "#0F1222",
	textMuted: "#5F6478",
	primary: "#5B4CF0",
	primarySoft: "#EEECFF",
	shadowLg: "0 12px 32px -8px rgba(16,24,40,0.14), 0 4px 8px -4px rgba(16,24,40,0.06)",
	font: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

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
		<div
			role="alert"
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 2147483647,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 16,
				backgroundColor: C.bg,
				backgroundImage: `radial-gradient(${C.dot} 1px, transparent 1px)`,
				backgroundSize: "18px 18px",
				color: C.text,
				fontFamily: C.font,
				textAlign: "center",
			}}
		>
			<div
				style={{
					width: "100%",
					maxWidth: 440,
					background: C.surface,
					border: `1px solid ${C.border}`,
					borderRadius: 16,
					boxShadow: C.shadowLg,
					padding: "32px 28px",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 12,
				}}
			>
				<div
					style={{
						width: 56,
						height: 56,
						borderRadius: 16,
						display: "grid",
						placeItems: "center",
						color: C.primary,
						backgroundColor: C.primarySoft,
						marginBottom: 4,
					}}
				>
					<BuildOutlined style={{ fontSize: 28 }} />
				</div>
				<h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 750, letterSpacing: "-0.02em" }}>
					Estamos em manutenção
				</h1>
				<p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: C.textMuted }}>
					O sistema está sincronizando serviços. Tentaremos reconectar automaticamente.
				</p>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginTop: 4,
						fontSize: "0.8rem",
						color: C.textMuted,
					}}
				>
					<CircularProgress size={16} thickness={5} style={{ color: C.primary }} />
					Reconectando...
				</div>
				<button
					type="button"
					onClick={() => checkBackend()}
					style={{
						marginTop: 8,
						height: 38,
						padding: "0 16px",
						borderRadius: 10,
						border: `1px solid ${C.border}`,
						background: C.surface,
						color: C.primary,
						fontFamily: C.font,
						fontSize: "0.85rem",
						fontWeight: 650,
						cursor: "pointer",
					}}
				>
					Verificar Conexão Agora
				</button>
			</div>
		</div>
	);
};

export default MaintenanceScreen;
