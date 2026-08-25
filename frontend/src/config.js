function getConfig(name, defaultValue = null) {
  if (window.ENV !== undefined && window.ENV[name]) {
    return window.ENV[name];
  }
  return import.meta.env[name] || defaultValue;
}

export function getBackendUrl() {
  const envUrl = getConfig("VITE_BACKEND_URL");
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }
  // Retorna a mesma origem (protocolo + host + porta do navegador)
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin;
  }
  return "http://localhost:6001";
}

export function getHoursCloseTicketsAuto() {
  return getConfig("VITE_HOURS_CLOSE_TICKETS_AUTO");
}
