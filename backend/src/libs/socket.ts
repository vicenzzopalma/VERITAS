import { Server as SocketIO } from "socket.io";
import { Server } from "http";
import { verify } from "jsonwebtoken";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import authConfig from "../config/auth";

let io: SocketIO;

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || true
    }
  });

  io.on("connection", socket => {
    const { token } = socket.handshake.query;
    let tokenData = null;

    if (!token || token === "null" || token === "undefined") {
      socket.disconnect(true);
      return io;
    }

    try {
      tokenData = verify(token as string, authConfig.secret);
    } catch (error) {
      // Desconecta silenciosamente sockets com token expirado/inválido sem spammar stack traces
      socket.disconnect(true);
      return io;
    }

    socket.on("joinChatBox", (ticketId: string) => {
      socket.join(ticketId);
    });

    socket.on("joinNotification", () => {
      socket.join("notification");
    });

    socket.on("joinTickets", (status: string) => {
      socket.join(status);
    });

    return socket;
  });

  return io;
};

export const getIO = (): SocketIO => {
  if (!io) {
    throw new AppError("Socket IO not initialized");
  }
  return io;
};
