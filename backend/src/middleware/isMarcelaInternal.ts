import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// Rota interna usada apenas pelo robô da Marcela (container na mesma VPS).
// Sem MARCELA_INTERNAL_TOKEN no ambiente a rota fica desligada (503).

const DEFAULT_ALLOWED_IPS = "127.0.0.1,172.16.1.";

export const normalizeRemoteIp = (raw: string | undefined): string => {
  const ip = (raw || "").trim();
  return ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
};

export const allowedIpPrefixes = (envValue: string | undefined): string[] =>
  (envValue && envValue.trim() ? envValue : DEFAULT_ALLOWED_IPS)
    .split(",")
    .map(p => p.trim())
    .filter(Boolean);

export const isIpAllowed = (
  ip: string,
  envValue: string | undefined
): boolean => {
  if (!ip) return false;
  return allowedIpPrefixes(envValue).some(prefix => ip.startsWith(prefix));
};

export const tokenMatches = (
  received: unknown,
  expected: string
): boolean => {
  if (typeof received !== "string" || !received || !expected) return false;
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const isMarcelaInternal = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const expected = process.env.MARCELA_INTERNAL_TOKEN || "";

  if (!expected) {
    res.status(503).json({ ok: false, erro: "rota desligada" });
    return;
  }

  const ip = normalizeRemoteIp(req.socket?.remoteAddress);
  if (!isIpAllowed(ip, process.env.MARCELA_ALLOWED_IPS)) {
    res.status(403).json({ ok: false, erro: "origem não permitida" });
    return;
  }

  if (!tokenMatches(req.headers["x-marcela-token"], expected)) {
    res.status(401).json({ ok: false, erro: "token inválido" });
    return;
  }

  next();
};

export default isMarcelaInternal;
