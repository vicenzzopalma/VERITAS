import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import { isMasterAdmin, isOperationalAdmin } from "../services/WhatsappService/WhatsappAccessPolicy";

const canAccessAudit = (req: Request, res: Response, next: NextFunction): void => {
  const profile = String(req.user?.profile || "").toLowerCase();
  if (!req.user || (!isMasterAdmin(req.user) && !isOperationalAdmin(req.user) && profile !== "admin" && profile !== "whatsapp_control_high")) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return next();
};

export default canAccessAudit;
