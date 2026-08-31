import rateLimit from "express-rate-limit";
import { Request } from "express";

/**
 * Obtém o IP real do cliente mesmo atrás do Cloudflare Edge Tunnel, Nginx ou proxies reversos.
 */
const getClientIp = (req: Request): string => {
  const cfIp = req.headers["cf-connecting-ip"] as string;
  if (cfIp) return cfIp;

  const forwarded = req.headers["x-forwarded-for"] as string;
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = req.headers["x-real-ip"] as string;
  if (realIp) return realIp;

  return req.ip || "127.0.0.1";
};

// Rate Limiter Global para a API: 600 requisições por minuto por IP real
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => getClientIp(req),
  message: {
    error: "Muitas requisições originadas deste IP. Por favor, tente novamente em instantes."
  }
});

// Rate Limiter Estrito Anti-Brute Force para Login: 15 tentativas a cada 15 minutos por IP real
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => getClientIp(req),
  message: {
    error: "Muitas tentativas de autenticação falhas. Por motivos de segurança, tente novamente em 15 minutos."
  }
});
