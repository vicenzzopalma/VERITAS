import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { createSector, listSectors } from "../services/SectorService";
import { isMasterAdmin } from "../services/WhatsappService/WhatsappAccessPolicy";

export const index = async (req: Request, res: Response): Promise<Response> =>
  res.json(await listSectors(req.user));

export const store = async (req: Request, res: Response): Promise<Response> => {
  if (!isMasterAdmin(req.user)) throw new AppError("ERR_NO_PERMISSION", 403);
  const sector = await createSector({ name: req.body.name, minimumProfile: req.body.minimumProfile });
  return res.status(201).json(sector);
};
