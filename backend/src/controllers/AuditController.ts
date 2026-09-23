import { Request, Response } from "express";
import ListAuditDevicesService from "../services/AuditServices/ListAuditDevicesService";
import ListAuditChatsService from "../services/AuditServices/ListAuditChatsService";
import ListAuditMessagesService from "../services/AuditServices/ListAuditMessagesService";
import ExportAuditService from "../services/AuditServices/ExportAuditService";
import SearchGlobalAuditService from "../services/AuditServices/SearchGlobalAuditService";

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

export const searchGlobal = async (req: Request, res: Response): Promise<Response> => {
  const { search, limit } = req.query as {
    search?: string;
    limit?: string;
  };

  const results = await SearchGlobalAuditService({
    search: search || "",
    limit: limit ? Number(limit) : 20
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

  const result = await ListAuditMessagesService({
    whatsappId,
    ticketId,
    search,
    startDate,
    endDate,
    onlyDeleted,
    mediaType,
    pageNumber,
    limit: limit ? Number(limit) : 2000
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

