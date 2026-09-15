import { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import openSocket from "../../services/socket-io";

import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const getStoredToken = () => {
	try {
		const raw = localStorage.getItem("token");
		if (!raw || raw === "null" || raw === "undefined") return null;
		const parsed = JSON.parse(raw);
		return typeof parsed === "string" ? parsed : raw;
	} catch {
		return localStorage.getItem("token");
	}
};

const getStoredRefreshToken = () => {
	try {
		const raw = localStorage.getItem("refreshToken");
		if (!raw || raw === "null" || raw === "undefined") return null;
		const parsed = JSON.parse(raw);
		return typeof parsed === "string" ? parsed : raw;
	} catch {
		return localStorage.getItem("refreshToken");
	}
};

const getStoredUser = () => {
	try {
		const raw = localStorage.getItem("user");
		if (!raw || raw === "null" || raw === "undefined") return {};
		const parsed = JSON.parse(raw);
		return typeof parsed === "object" && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
};

const useAuth = () => {
	const history = useHistory();
	const initialToken = getStoredToken();
	const [isAuth, setIsAuth] = useState(() => Boolean(initialToken));
	const [loading, setLoading] = useState(() => Boolean(initialToken));
	const [user, setUser] = useState(() => getStoredUser());

	api.interceptors.request.use(
		config => {
			const token = getStoredToken();
			if (token) {
				config.headers["Authorization"] = `Bearer ${token}`;
				setIsAuth(true);
			}
			return config;
		},
		error => {
			Promise.reject(error);
		}
	);

	api.interceptors.response.use(
		response => {
			return response;
		},
		async error => {
			const originalRequest = error.config;
			if (error?.response?.status === 403 && !originalRequest._retry) {
				originalRequest._retry = true;

				try {
					const refreshToken = getStoredRefreshToken();
					const { data } = await api.post("/auth/refresh_token", { refreshToken });
					if (data) {
						localStorage.setItem("token", JSON.stringify(data.token));
						if (data.refreshToken) {
							localStorage.setItem("refreshToken", JSON.stringify(data.refreshToken));
						}
						api.defaults.headers.Authorization = `Bearer ${data.token}`;
						originalRequest.headers["Authorization"] = `Bearer ${data.token}`;
						return api(originalRequest);
					}
				} catch (refreshErr) {
					localStorage.removeItem("token");
					localStorage.removeItem("refreshToken");
					localStorage.removeItem("user");
					api.defaults.headers.Authorization = undefined;
					setIsAuth(false);
					setUser({});
					return Promise.reject(refreshErr);
				}
			}
			if (error?.response?.status === 401 && !originalRequest.url?.includes("/auth/login") && !originalRequest.url?.includes("/auth/refresh_token")) {
				localStorage.removeItem("token");
				localStorage.removeItem("refreshToken");
				localStorage.removeItem("user");
				api.defaults.headers.Authorization = undefined;
				setIsAuth(false);
				setUser({});
			}
			return Promise.reject(error);
		}
	);

	useEffect(() => {
		const token = getStoredToken();
		(async () => {
			if (token) {
				api.defaults.headers.Authorization = `Bearer ${token}`;
				try {
					const refreshToken = getStoredRefreshToken();
					const { data } = await api.post("/auth/refresh_token", { refreshToken });
					localStorage.setItem("token", JSON.stringify(data.token));
					if (data.refreshToken) {
						localStorage.setItem("refreshToken", JSON.stringify(data.refreshToken));
					}
					if (data.user) {
						localStorage.setItem("user", JSON.stringify(data.user));
						setUser(data.user);
					}
					api.defaults.headers.Authorization = `Bearer ${data.token}`;
					setIsAuth(true);
				} catch (err) {
					console.warn("Falha ao atualizar token na inicialização:", err);
					// Só desloga se o servidor responder explicitamente 401 ou 403 (sessão expirada)
					if (err?.response?.status === 401 || err?.response?.status === 403) {
						localStorage.removeItem("token");
						localStorage.removeItem("refreshToken");
						localStorage.removeItem("user");
						api.defaults.headers.Authorization = undefined;
						setIsAuth(false);
						setUser({});
					}
				}
			}
			setLoading(false);
		})();
	}, []);

	useEffect(() => {
		const socket = openSocket();

		socket.on("user", data => {
			if (data.action === "update" && data.user.id === user.id) {
				setUser(data.user);
				localStorage.setItem("user", JSON.stringify(data.user));
			}
		});

		return () => {
			socket.disconnect();
		};
	}, [user]);

	const handleLogin = async userData => {
		setLoading(true);

		try {
			const { data } = await api.post("/auth/login", userData);
			localStorage.setItem("token", JSON.stringify(data.token));
			if (data.refreshToken) {
				localStorage.setItem("refreshToken", JSON.stringify(data.refreshToken));
			}
			if (data.user) {
				localStorage.setItem("user", JSON.stringify(data.user));
			}
			api.defaults.headers.Authorization = `Bearer ${data.token}`;
			setUser(data.user);
			setIsAuth(true);
			toast.success(i18n.t("auth.toasts.success"));
			if (data.user?.profile === "operator") {
				history.push("/live");
			} else if (data.user?.profile === "whatsapp_control") {
				history.push("/whatsapp-control");} else {
				history.push("/tickets");
			}
			setLoading(false);
		} catch (err) {
			toastError(err);
			setLoading(false);
		}
	};

	const handleLogout = async () => {
		setLoading(true);

		try {
			await api.delete("/auth/logout");
		} catch (err) {
			// Ignora erro de rede no logout
		} finally {
			setIsAuth(false);
			setUser({});
			localStorage.removeItem("token");
			localStorage.removeItem("refreshToken");
			localStorage.removeItem("user");
			api.defaults.headers.Authorization = undefined;
			setLoading(false);
			history.push("/login");
		}
	};

	return { isAuth, user, loading, handleLogin, handleLogout };
};

export default useAuth;
