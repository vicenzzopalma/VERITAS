import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";

import CreateWhatsAppService from "../services/WhatsappService/CreateWhatsAppService";
import DeleteWhatsAppService from "../services/WhatsappService/DeleteWhatsAppService";
import ListWhatsAppsService from "../services/WhatsappService/ListWhatsAppsService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import { whatsappProvider } from "../providers/WhatsApp";
import {
  canAccessWhatsapp
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

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;

  const whatsapp = await ShowWhatsAppService(whatsappId);
  if (!canAccessWhatsapp(req.user, whatsapp)) {
    return res.status(403).json({ error: "ERR_NO_PERMISSION" });
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

  await DeleteWhatsAppService(whatsappId);
  whatsappProvider.removeSession(+whatsappId);

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
