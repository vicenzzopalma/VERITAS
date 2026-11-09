import { useEffect, useRef } from "react";
import api from "../services/api";

const POLL_MS = 20000;

const phoneLabel = raw => {
	const d = String(raw || "").replace(/\D/g, "");
	const s = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
	if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`;
	if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
	return raw || "";
};

// Setores cujos chips o usuário acompanha. null = todos.
const getWatchedSectors = user => {
	const profile = user?.profile;
	const isMaster =
		profile === "admin_master" ||
		profile === "admin" ||
		String(user?.email || "").toLowerCase().trim() === "vicenzzo.mastronikolis@realess.com.br";
	if (isMaster) return null;

	let sectors = [];
	if (profile === "admin_operational") {
		sectors = (user?.sectorPermissions || []).filter(p => p && p.canView).map(p => p.sector);
	} else {
		let raw = user?.connectionSectors;
		if (typeof raw === "string") {
			try {
				raw = JSON.parse(raw);
			} catch (e) {
				raw = [];
			}
		}
		sectors = Array.isArray(raw) ? raw : [];
		if (sectors.length === 0 && (profile === "whatsapp_control" || profile === "whatsapp_control_high")) {
			sectors = ["PA FIXA 1", "PA FIXA 2"];
		}
	}
	const expanded = [];
	sectors.forEach(s => (s === "PA FIXA" ? expanded.push("PA FIXA 1", "PA FIXA 2") : expanded.push(s)));
	return expanded;
};

// Notificação do navegador quando um chip do CRM sai do bloqueio (o "despertador" do CRM dispara).
// Roda em qualquer tela do VERITAS. Usa a mesma tag da notificação do próprio CRM, então não duplica.
const useCrmReleaseNotifications = (user, onOpen) => {
	const alarmedRef = useRef(null); // ids com alarme ativo na última consulta (null = ainda sem base)
	const onOpenRef = useRef(onOpen);
	onOpenRef.current = onOpen;

	const enabled = Boolean(user?.id) && user?.profile !== "operator";
	const sectorsKey = JSON.stringify(enabled ? getWatchedSectors(user) : []);

	// Pede permissão no primeiro clique (navegadores ignoram pedidos sem interação).
	useEffect(() => {
		if (!enabled || !("Notification" in window) || Notification.permission !== "default") return;
		const ask = () => {
			try {
				Notification.requestPermission();
			} catch (e) {}
		};
		window.addEventListener("click", ask, { once: true });
		return () => window.removeEventListener("click", ask);
	}, [enabled]);

	useEffect(() => {
		if (!enabled) return;
		const watched = JSON.parse(sectorsKey);
		let cancelled = false;
		alarmedRef.current = null;

		const notify = chip => {
			if (!("Notification" in window) || Notification.permission !== "granted") return;
			try {
				const n = new Notification("⏰ Chip Liberado no CRM!", {
					body: `O chip "${chip.name || "Chip"}" (${phoneLabel(chip.phone_number)}) no aparelho "${chip.device_name || "?"}" foi liberado da restrição.`,
					tag: `alarm-${chip.id}`,
					icon: "/favicon.ico",
				});
				n.onclick = () => {
					window.focus();
					if (onOpenRef.current) onOpenRef.current();
					n.close();
				};
			} catch (e) {}
		};

		const poll = async () => {
			try {
				const { data } = await api.get("/whatsapp/crm-chips");
				if (cancelled || !data || !Array.isArray(data.chips)) return;
				const chips = data.chips.filter(c => !watched || watched.includes(c.sector));
				const alarmed = new Set(chips.filter(c => Number(c.alarm_active) === 1).map(c => c.id));
				const previous = alarmedRef.current;
				// Na primeira consulta só registra a base: avisa apenas o que liberar daqui pra frente.
				if (previous) {
					chips.forEach(c => {
						if (alarmed.has(c.id) && !previous.has(c.id)) notify(c);
					});
				}
				alarmedRef.current = alarmed;
			} catch (e) {
				// falha transitória: tenta na próxima
			}
		};

		poll();
		const timer = setInterval(poll, POLL_MS);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [enabled, sectorsKey]);
};

export default useCrmReleaseNotifications;
