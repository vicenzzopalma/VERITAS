import { NextFunction, Request, Response } from "express";

import {
  isIpAllowed,
  normalizeRemoteIp,
  tokenMatches
} from "../middleware/isMarcelaInternal";
import { logger } from "../utils/logger";

// Rota interna (só localhost + token) para recuperar mensagens perdidas pelo
// histórico sob demanda do WhatsApp. Desligada (503) sem HISTORY_RECOVERY_TOKEN.
// Ver services/WbotServices/HistoryRecoveryService.ts.

type ServiceModule = typeof import("../services/WbotServices/HistoryRecoveryService");

const SERVICE_PATH = "../services/WbotServices/HistoryRecoveryService";

let running = false;
const queue: number[] = [];

// reload=true relê o serviço do disco (ajuste sem reiniciar o backend).
const loadService = (reload = false): ServiceModule => {
  if (reload) {
    try {
      delete require.cache[require.resolve(SERVICE_PATH)];
    } catch {
      /* ignore */
    }
  }
  // eslint-disable-next-line global-require, import/no-dynamic-require, @typescript-eslint/no-var-requires
  return require(SERVICE_PATH);
};

const loadDeps = () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const whaileys = require("../providers/WhatsApp/Implementations/whaileys");
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const events = require("../handlers/handleWhatsappEvents");
  return {
    getWbot: (id: number) => whaileys.getSession(id),
    helpers: whaileys.historyHelpers,
    saveMediaFile: events.saveMediaFile
  };
};

export const autorizar = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const esperado = process.env.HISTORY_RECOVERY_TOKEN || "";
  if (!esperado) {
    res.status(503).json({ ok: false, erro: "rota desligada" });
    return;
  }
  const ip = normalizeRemoteIp(req.socket?.remoteAddress);
  if (!isIpAllowed(ip, process.env.HISTORY_RECOVERY_ALLOWED_IPS || "127.0.0.1")) {
    res.status(403).json({ ok: false, erro: "origem não permitida" });
    return;
  }
  if (!tokenMatches(req.headers["x-history-recovery-token"], esperado)) {
    res.status(401).json({ ok: false, erro: "token inválido" });
    return;
  }
  next();
};

const toMs = (v: any): number | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Date.parse(String(v));
  return Number.isNaN(n) ? undefined : n;
};

const num = (v: any): number | undefined =>
  v === undefined || v === null || v === "" ? undefined : Number(v);

export const start = async (req: Request, res: Response): Promise<Response> => {
  const body = req.body || {};
  const ids: number[] = (Array.isArray(body.whatsappIds) ? body.whatsappIds : [body.whatsappId])
    .map((x: any) => Number(x))
    .filter((x: number) => Number.isInteger(x) && x > 0);
  const fromMs = toMs(body.from);
  if (!ids.length || !fromMs) {
    return res.status(400).json({ ok: false, erro: "whatsappIds e from são obrigatórios" });
  }
  if (running && body.reload) {
    return res.status(409).json({ ok: false, erro: "recuperação em andamento; reload só parado" });
  }
  const service = loadService(Boolean(body.reload));
  const options = {
    fromMs,
    toMs: toMs(body.to),
    dryRun: Boolean(body.dryRun),
    pauseMs: num(body.pauseMs),
    timeoutMs: num(body.timeoutMs),
    batchSize: num(body.batchSize),
    maxRounds: num(body.maxRounds),
    maxChats: num(body.maxChats),
    contactIds: Array.isArray(body.contactIds) ? body.contactIds.map(Number) : undefined,
    candidatesSinceMs: toMs(body.candidatesSince),
    anchor: body.anchor === "now" ? ("now" as const) : ("newest" as const),
    downloadMedia: body.downloadMedia !== false
  };
  const concurrency = Math.max(1, Math.min(3, Number(body.concurrency) || 1));

  ids.forEach(id => {
    if (!queue.includes(id)) queue.push(id);
  });
  if (!running) {
    running = true;
    const deps = loadDeps();
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift() as number;
        try {
          await service.recoverSessionHistory(id, options, deps);
        } catch (err: any) {
          logger.error({ info: "[History Recovery] falha", sessionId: id, err: err?.message });
        }
      }
    };
    Promise.all(Array.from({ length: concurrency }, worker)).finally(() => {
      running = false;
    });
  }
  return res.status(202).json({ ok: true, queued: ids, queue: [...queue] });
};

export const status = async (req: Request, res: Response): Promise<Response> => {
  const service = loadService(false);
  const id = Number(req.query.whatsappId) || undefined;
  return res.json({ ok: true, running, queue: [...queue], sessions: service.getRecoveryStatus(id) });
};

export const cancel = async (req: Request, res: Response): Promise<Response> => {
  const service = loadService(false);
  const id = Number((req.body || {}).whatsappId);
  if (!id) {
    queue.splice(0, queue.length);
    service.getRecoveryStatus().forEach(s => service.cancelRecovery(s.sessionId));
  } else {
    const i = queue.indexOf(id);
    if (i >= 0) queue.splice(i, 1);
    service.cancelRecovery(id);
  }
  return res.json({ ok: true, queue: [...queue] });
};

export const probe = async (req: Request, res: Response): Promise<Response> => {
  const body = req.body || {};
  const service = loadService(Boolean(body.reload) && !running);
  const deps = loadDeps();
  const wbot = deps.getWbot(Number(body.whatsappId));
  if (!wbot?.user?.id) return res.status(409).json({ ok: false, erro: "sessão não conectada" });
  try {
    const result = await service.probeChatHistory(
      wbot,
      String(body.jid),
      {
        id: String(body.anchorId),
        fromMe: Boolean(body.anchorFromMe),
        timestampMs: toMs(body.anchorTs) || Date.now()
      },
      Number(body.count) || 50,
      Number(body.timeoutMs) || 30000,
      deps.helpers
    );
    return res.json({ ok: true, result });
  } catch (err: any) {
    return res.status(500).json({ ok: false, erro: err?.message || String(err) });
  }
};
