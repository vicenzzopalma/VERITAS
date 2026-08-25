import { Request, Response } from "express";
import ListAuditDevicesService from "../services/AuditServices/ListAuditDevicesService";
import ListAuditChatsService from "../services/AuditServices/ListAuditChatsService";
import ListAuditMessagesService from "../services/AuditServices/ListAuditMessagesService";
import ExportAuditService from "../services/AuditServices/ExportAuditService";

export const indexDevices = async (req: Request, res: Response): Promise<Response> => {
  const devices = await ListAuditDevicesService();
  return res.json(devices);
};

export const listChats = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { search, pageNumber, limit } = req.query as {
    search?: string;
    pageNumber?: string;
    limit?: string;
  };

  const { chats, count, hasMore } = await ListAuditChatsService({
    whatsappId,
    search,
    pageNumber,
    limit: limit ? Number(limit) : 40
  });

  return res.json({ chats, count, hasMore });
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

  const result = await ListAuditMessagesService({
    whatsappId,
    ticketId,
    search,
    startDate,
    endDate,
    onlyDeleted,
    mediaType,
    pageNumber,
    limit: limit ? Number(limit) : 50
  });

  return res.json(result);
};

export const exportAudit = async (req: Request, res: Response): Promise<void> => {
  const {
    whatsappId,
    ticketId,
    search,
    startDate,
    endDate,
    onlyDeleted,
    mediaType,
    format
  } = req.query as {
    whatsappId?: string;
    ticketId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    onlyDeleted?: string;
    mediaType?: string;
    format?: "csv" | "txt" | "json";
  };

  const { filename, contentType, data } = await ExportAuditService({
    whatsappId,
    ticketId,
    search,
    startDate,
    endDate,
    onlyDeleted,
    mediaType,
    format
  });

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(data);
};
