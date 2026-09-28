import axios from "axios";
import { getBackendUrl } from "../config";

const api = axios.create({
	baseURL: getBackendUrl(),
	withCredentials: true,
	timeout: 30000,
});

const isBackendUnavailable = error => {
	if (axios.isCancel(error) || error?.code === "ERR_CANCELED" || error?.name === "CanceledError") {
		return false;
	}

	if (!error.response) {
		const isNetworkDown = error.message?.includes("Network Error") || error.code === "ECONNREFUSED";
		return isNetworkDown;
	}

	return [502, 503, 504].includes(error.response?.status);
};

api.interceptors.response.use(
	response => response,
	error => {
		if (isBackendUnavailable(error)) {
			window.dispatchEvent(new CustomEvent("veritas:backend-unavailable"));
		}

		return Promise.reject(error);
	}
);

export default api;
