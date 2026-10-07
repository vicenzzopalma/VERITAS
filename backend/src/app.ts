import "./bootstrap";
import "reflect-metadata";
import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import * as Sentry from "@sentry/node";

import "./database";
import uploadConfig from "./config/upload";
import AppError from "./errors/AppError";
import routes from "./routes";
import { logger } from "./utils/logger";
import { globalLimiter } from "./middleware/rateLimiter";
import { publicMediaHandler } from "./utils/publicMediaHandler";

Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();
app.set("trust proxy", true);
const configuredOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([
  "https://veritas.realess.com.br",
  "http://veritas.realess.com.br",
  "http://localhost:3000",
  "http://localhost:6001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:6001",
  ...configuredOrigins
]));

// 1. Security Headers com Helmet e Content Security Policy (CSP) sob medida
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "ws:", "https:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        mediaSrc: ["'self'", "data:", "blob:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        frameSrc: ["'self'"],
        frameAncestors: ["'self'"]
      }
    },
    frameguard: { action: "sameorigin" },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true
  })
);

// 2. CORS Restritivo
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origin is not allowed by CORS"));
      }
    }
  })
);

// Health check para monitoramento de disponibilidade e tela de manutenção
app.get("/health", (_req: Request, res: Response) => {
  return res.status(200).json({ status: "ok" });
});

// 3. Rate Limiter Global com Detecção de IP Real
app.use(globalLimiter);

// 4. Middlewares de Parser
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(Sentry.Handlers.requestHandler());

// 5. Servir Arquivos Estáticos e Mídias com Detecção Inteligente e Headers de Segurança
app.use("/public", publicMediaHandler);
app.use("/public", express.static(uploadConfig.directory, {
  maxAge: "1d",
  dotfiles: "allow",
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  }
}));

// 6. Rotas da Aplicação
app.use(routes);

app.use(Sentry.Handlers.errorHandler());

// 7. Tratamento Centralizado de Erros com Sanitização Rigorosa
app.use(async (err: any, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError || (err && typeof err.statusCode === "number" && err.statusCode < 500)) {
    const statusCode = err.statusCode || 400;
    logger.warn(`[AppError ${statusCode}]: ${err.message}`);
    return res.status(statusCode).json({ error: err.message });
  }

  logger.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
