import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";

const toastError = err => {
	const errorMsg = err?.response?.data?.message || err?.response?.data?.error;
	const toastConfig = {
		autoClose: 6000,
		hideProgressBar: false,
		closeOnClick: true,
		pauseOnHover: true,
	};

	if (errorMsg) {
		if (i18n.exists(`backendErrors.${errorMsg}`)) {
			toast.error(i18n.t(`backendErrors.${errorMsg}`), {
				...toastConfig,
				toastId: String(errorMsg),
			});
		} else {
			toast.error(String(errorMsg), {
				...toastConfig,
				toastId: String(errorMsg),
			});
		}
	} else if (err?.message) {
		toast.error(String(err.message), {
			...toastConfig,
			toastId: String(err.message),
		});
	} else {
		toast.error("Ocorreu um erro no sistema!", toastConfig);
	}
};

export default toastError;
