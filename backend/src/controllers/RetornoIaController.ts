import { NextFunction, Request, Response } from "express";

import {
  isIpAllowed,
  normalizeRemoteIp,
  tokenMatches
} from "../middleware/isMarcelaInternal";
import { getWbot } from "../providers/WhatsApp/Implementations/whaileys";
import { logger } from "../utils/logger";

// Envio do retorno_ia (PA FIXA) pelos chips autorizados, direto no socket: não
// marca o ticket como lido. O eco da mensagem entra no CRM como qualquer envio
// do aparelho. Fica desligada (503) sem RETORNO_IA_INTERNAL_TOKEN.

interface SendBody {
  whatsappId?: number;
  numero?: string;
  texto?: string;
  delay?: number | string;
}

const MAX_DELAY_MS = 8000;
const MAX_TEXTO = 3500;

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export const conexoesLiberadas = (valor?: string): Set<number> =>
  new Set(
    (valor || "")
      .split(",")
      .map(x => Number(x.trim()))
      .filter(x => Number.isInteger(x) && x > 0)
  );

export const autorizar = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const esperado = process.env.RETORNO_IA_INTERNAL_TOKEN || "";
  if (!esperado) {
    res.status(503).json({ ok: false, erro: "rota desligada" });
    return;
  }
  const ip = normalizeRemoteIp(req.socket?.remoteAddress);
  if (!isIpAllowed(ip, process.env.MARCELA_ALLOWED_IPS)) {
    res.status(403).json({ ok: false, erro: "origem não permitida" });
    return;
  }
  if (!tokenMatches(req.headers["x-retorno-ia-token"], esperado)) {
    res.status(401).json({ ok: false, erro: "token inválido" });
    return;
  }
  next();
};

export const send = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId, numero, texto, delay } = (req.body || {}) as SendBody;
  const id = Number(whatsappId);

  if (!conexoesLiberadas(process.env.RETORNO_IA_CONEXOES).has(id)) {
    return res.status(403).json({ ok: false, erro: "conexão não liberada" });
  }
  if (typeof numero !== "string" || !/^\d{12,13}$/.test(numero)) {
    return res.status(400).json({ ok: false, erro: "numero inválido" });
  }
  if (typeof texto !== "string" || !texto.trim() || texto.length > MAX_TEXTO) {
    return res.status(400).json({ ok: false, erro: "texto inválido" });
  }

  const jid = `${numero}@s.whatsapp.net`;
  try {
    const wbot = getWbot(id);
    await wbot.sendPresenceUpdate("composing", jid);
    const espera = Math.min(Math.max(Number(delay) || 0, 0), MAX_DELAY_MS);
    if (espera > 0) await sleep(espera);
    const sent = await wbot.sendMessage(jid, { text: texto });
    return res.json({ ok: true, mensagem_id: sent?.key?.id });
  } catch (err) {
    logger.warn({
      info: "retorno_ia send falhou",
      whatsappId: id,
      err: String(err?.message || err)
    });
    return res.status(500).json({ ok: false, erro: "falha no envio" });
  }
};
