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

Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();

// 1. Security Headers com Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
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
      // Permite localhost, túneis Cloudflare e requisições sem origin (ex: server-side proxy)
      callback(null, origin || process.env.FRONTEND_URL);
    }
  })
);

// 3. Rate Limiter Global
app.use(globalLimiter);

// 4. Middlewares de Parser
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(Sentry.Handlers.requestHandler());

// 5. Servir Arquivos Estáticos com Cache Seguro
app.use("/public", express.static(uploadConfig.directory, {
  maxAge: "1d",
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
}));

// 6. Rotas da Aplicação
app.use(routes);

app.use(Sentry.Handlers.errorHandler());

// 7. Tratamento Centralizado de Erros com Sanitização
app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(`[AppError ${err.statusCode}]: ${err.message}`);
    return res.status(err.statusCode).json({ error: err.message });
  }

  logger.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
