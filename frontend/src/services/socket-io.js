import openSocket from "socket.io-client";
import { getBackendUrl } from "../config";

function getCleanToken() {
  const rawToken = localStorage.getItem("token");
  if (!rawToken || rawToken === "null" || rawToken === "undefined") {
    return "";
  }
  try {
    const parsed = JSON.parse(rawToken);
    return typeof parsed === "string" ? parsed : rawToken;
  } catch {
    return rawToken;
  }
}

function connectToSocket() {
  const token = getCleanToken();
  return openSocket(getBackendUrl(), {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 5000,
    query: {
      token,
    },
  });
}

export default connectToSocket;