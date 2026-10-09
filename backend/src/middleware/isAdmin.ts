import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import { isMasterAdmin, isOperationalAdmin } from "../services/WhatsappService/WhatsappAccessPolicy";

const isAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || (!isMasterAdmin(req.user) && !isOperationalAdmin(req.user) && req.user.profile !== "admin")) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return next();
};

export default isAdmin;
