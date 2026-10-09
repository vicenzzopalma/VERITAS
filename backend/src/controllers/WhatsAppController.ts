import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import { StartAllWhatsAppsSessions } from "../services/WbotServices/StartAllWhatsAppsSessions";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";

import CreateWhatsAppService from "../services/WhatsappService/CreateWhatsAppService";
import DeleteWhatsAppService from "../services/WhatsappService/DeleteWhatsAppService";
import ListWhatsAppsService from "../services/WhatsappService/ListWhatsAppsService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import { whatsappProvider } from "../providers/WhatsApp";
import {
  canAccessWhatsapp, canConfigureSector, isMasterAdmin
} from "../services/WhatsappService/WhatsappAccessPolicy";

interface WhatsappData {
  name: string;
  queueIds: number[];
  greetingMessage?: string;
  farewellMessage?: string;
  status?: string;
  isDefault?: boolean;
  sector?: string;
  proxyUrl?: string;
  humanDelay?: boolean;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const whatsapps = await ListWhatsAppsService(req.user);

  return res.status(200).json(whatsapps);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    name,
    status,
    isDefault,
    greetingMessage,
    farewellMessage,
    queueIds,
    sector,
    proxyUrl,
    humanDelay
  }: WhatsappData = req.body;

  if (!canAccessWhatsapp(req.user, { sector: sector || "" })) {
    return res.status(403).json({ error: "ERR_NO_PERMISSION" });
  }

  const { whatsapp, oldDefaultWhatsapp } = await CreateWhatsAppService({
    name,
    status,
    isDefault,
    greetingMessage,
    farewellMessage,
    queueIds,
    sector,
    proxyUrl,
    humanDelay
  });

  StartWhatsAppSession(whatsapp);

  const io = getIO();
  io.emit("whatsapp", {
    action: "update",
    whatsapp
  });

  if (oldDefaultWhatsapp) {
    io.emit("whatsapp", {
      action: "update",
      whatsapp: oldDefaultWhatsapp
    });
  }

  return res.status(200).json(whatsapp);
};

const startingQrSessions = new Set<number>();

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;

  const whatsapp = await ShowWhatsAppService(whatsappId);
  if (!canAccessWhatsapp(req.user, whatsapp)) {
    return res.status(403).json({ error: "ERR_NO_PERMISSION" });
  }

  // Se o WhatsApp não está conectado, garante que exista uma sessão Baileys viva
  // para gerar um QR code novo e válido quando o modal for aberto no frontend
  if (whatsapp.status !== "CONNECTED") {
    const idNum = Number(whatsappId);
    let isLive = false;
    try {
      const liveness = await whatsappProvider.checkSessionLiveness?.(idNum);
      if (liveness?.healthy || liveness?.status === "OPENING") {
        isLive = true;
      }
    } catch {}

    const qrAgeMs = whatsapp.updatedAt
      ? Date.now() - new Date(whatsapp.updatedAt).getTime()
      : 999999;
    const isQrStale = !whatsapp.qrcode || qrAgeMs > 45000;

    if ((!isLive || isQrStale) && !startingQrSessions.has(idNum)) {
      startingQrSessions.add(idNum);
      (async () => {
        try {
          if (isQrStale && whatsapp.qrcode) {
            await whatsapp.update({ qrcode: "", status: "OPENING" });
          }
          await StartWhatsAppSession(whatsapp);
        } catch (err) {
          // silencia erros transitórios
        } finally {
          setTimeout(() => startingQrSessions.delete(idNum), 5000);
        }
      })();

      if (isQrStale) {
        whatsapp.qrcode = "";
      }
    }
  }

  return res.status(200).json(whatsapp);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsappData = req.body;
  const currentWhatsapp = await ShowWhatsAppService(whatsappId);

  if (!canAccessWhatsapp(req.user, currentWhatsapp)) {
    return res.status(403).json({ error: "ERR_NO_PERMISSION" });
  }

  const { whatsapp, oldDefaultWhatsapp } = await UpdateWhatsAppService({
    whatsappData,
    whatsappId
  });

  const io = getIO();
  io.emit("whatsapp", {
    action: "update",
    whatsapp
  });

  if (oldDefaultWhatsapp) {
    io.emit("whatsapp", {
      action: "update",
      whatsapp: oldDefaultWhatsapp
    });
  }

  return res.status(200).json(whatsapp);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const currentWhatsapp = await ShowWhatsAppService(whatsappId);

  if (!canAccessWhatsapp(req.user, currentWhatsapp)) {
    return res.status(403).json({ error: "ERR_NO_PERMISSION" });
  }

  try {
    await whatsappProvider.removeSession(+whatsappId);
  } catch (err) {
    // ignora falhas ao fechar socket inexistente ou já finalizado
  }

  await DeleteWhatsAppService(whatsappId);

  const io = getIO();
  io.emit("whatsapp", {
    action: "delete",
    whatsappId: +whatsappId
  });

  return res.status(200).json({ message: "Whatsapp deleted." });
};


export const getCrmChips = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { sector } = req.query;
  const sectorParam = sector ? `?sector=${encodeURIComponent(String(sector))}` : "";
  const url = "http://127.0.0.1:3000/api/public/chips" + sectorParam;

  return new Promise((resolve) => {
    const http = require("http");
    http.get(url, (apiRes: any) => {
      let data = "";
      apiRes.on("data", (chunk: any) => {
        data += chunk;
      });
      apiRes.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(res.status(200).json(parsed));
        } catch (e) {
          resolve(res.status(200).json({ success: false, chips: [] }));
        }
      });
    }).on("error", () => {
      resolve(res.status(200).json({ success: false, chips: [] }));
    });
  });
};


export const syncAudit = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;

  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp || !canAccessWhatsapp(req.user, whatsapp)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  if (!canConfigureSector(req.user, whatsapp.sector || "")) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (whatsappProvider.reconcileSessionHistory) {
    const result = await whatsappProvider.reconcileSessionHistory(+whatsappId);
    return res.status(200).json({
      success: true,
      message: `Varredura concluída: ${result.totalRecovered} mensagens faltantes recuperadas.`,
      ...result
    });
  }

  return res.status(200).json({ success: true, message: "Provedor não suporta reconciliação manual" });
};

export const syncAllAudit = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!isMasterAdmin(req.user) && String(req.user?.profile || "").toLowerCase() !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (whatsappProvider.reconcileAllSessionsHistory) {
    const result = await whatsappProvider.reconcileAllSessionsHistory();
    return res.status(200).json({
      success: true,
      message: `Varredura global concluída: ${result.totalRecovered} mensagens faltantes recuperadas em todos os túneis ativos.`,
      ...result
    });
  }

  return res.status(200).json({ success: true, message: "Provedor não suporta reconciliação global" });
};

export const checkLiveness = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (whatsappProvider.reconcileAllSessionsLiveness) {
    const result = await whatsappProvider.reconcileAllSessionsLiveness();
    return res.status(200).json({
      success: true,
      ...result
    });
  }

  return res.status(200).json({ success: true, message: "Provedor não suporta verificação de liveness" });
};

export const startAllSessions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  StartAllWhatsAppsSessions().catch(() => {});
  return res.status(200).json({ message: "Iniciando reconexão de todas as sessões." });
};

