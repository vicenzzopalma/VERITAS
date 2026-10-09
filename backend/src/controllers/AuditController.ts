import { Request, Response } from "express";
import ListAuditDevicesService from "../services/AuditServices/ListAuditDevicesService";
import ListAuditChatsService from "../services/AuditServices/ListAuditChatsService";
import ListAuditMessagesService from "../services/AuditServices/ListAuditMessagesService";
import ExportAuditService from "../services/AuditServices/ExportAuditService";
import SearchGlobalAuditService from "../services/AuditServices/SearchGlobalAuditService";
import { canAccessWhatsapp } from "../services/WhatsappService/WhatsappAccessPolicy";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";

export const indexDevices = async (req: Request, res: Response): Promise<Response> => {
  const devices = await ListAuditDevicesService({ user: req.user });
  return res.json(devices);
};

export const listChats = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;

  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp || !canAccessWhatsapp(req.user, whatsapp)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { search, pageNumber, limit, ticketId } = req.query as {
    search?: string;
    pageNumber?: string;
    limit?: string;
    ticketId?: string;
  };

  const { chats, count, hasMore } = await ListAuditChatsService({
    whatsappId,
    search,
    ticketId,
    pageNumber,
    limit: limit ? Number(limit) : 40
  });

  return res.json({ chats, count, hasMore });
};

export const searchGlobal = async (req: Request, res: Response): Promise<Response> => {
  const { search, limit } = req.query as {
    search?: string;
    limit?: string;
  };

  const results = await SearchGlobalAuditService({
    search: search || "",
    limit: limit ? Number(limit) : 20,
    user: req.user
  });

  return res.json(results);
};

export const listMessages = async (req: Request, res: Response): Promise<Response> => {
  const {
    whatsappId,
    ticketId,
    search,
    startDate,
    endDate,
    onlyDeleted,
    mediaType,
    pageNumber,
    limit
  } = req.query as {
    whatsappId?: string;
    ticketId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    onlyDeleted?: string;
    mediaType?: string;
    pageNumber?: string;
    limit?: string;
  };

  if (whatsappId) {
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp || !canAccessWhatsapp(req.user, whatsapp)) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

  if (ticketId) {
    const ticket = await Ticket.findByPk(ticketId, {
      include: [{ model: Whatsapp, as: "whatsapp" }]
    });
    if (!ticket || !ticket.whatsapp || !canAccessWhatsapp(req.user, ticket.whatsapp)) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

  const result = await ListAuditMessagesService({
    whatsappId,
    ticketId,
    search,
    startDate,
    endDate,
    onlyDeleted,
    mediaType,
    pageNumber,
    limit: limit ? Number(limit) : 2000,
    user: req.user
  });

  return res.json(result);
};

export const exportAudit = async (req: Request, res: Response): Promise<void> => {
  const {
    whatsappId,
    ticketId,
    contactId,
    contactNumber,
    search,
    startDate,
    endDate,
    onlyDeleted,
    mediaType,
    format,
    imageLimit,
    part,
    download
  } = req.query as {
    whatsappId?: string;
    ticketId?: string;
    contactId?: string;
    contactNumber?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    onlyDeleted?: string;
    mediaType?: string;
    format?: "csv" | "txt" | "json" | "html" | "pdf";
    imageLimit?: string;
    part?: string;
    download?: string;
  };

  if (whatsappId) {
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp || !canAccessWhatsapp(req.user, whatsapp)) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  } else if (ticketId) {
    const ticket = await Ticket.findByPk(ticketId, {
      include: [{ model: Whatsapp, as: "whatsapp" }]
    });
    if (!ticket || !ticket.whatsapp || !canAccessWhatsapp(req.user, ticket.whatsapp)) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  } else if (String(req.user?.profile || "").toLowerCase() !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { filename, contentType, data } = await ExportAuditService({
    whatsappId,
    ticketId,
    contactId,
    contactNumber,
    search,
    startDate,
    endDate,
    onlyDeleted,
    mediaType,
    format: (format as any) || "html",
    imageLimit,
    part
  });

  const isDownload = download === "true" || format === "csv" || format === "txt" || format === "json";
  const disposition = isDownload ? "attachment" : "inline";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
  res.setHeader(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; script-src-attr * 'unsafe-inline'; style-src * 'unsafe-inline' https:; img-src * data: blob:;"
  );
  res.send(data);
};
