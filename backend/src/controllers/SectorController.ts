import { Request, Response } from "express";
import { createSector, listSectors } from "../services/SectorService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const sectors = await listSectors(req.user);
  return res.status(200).json(sectors);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, minimumProfile } = req.body;
  const sector = await createSector({ name, minimumProfile, user: req.user });
  return res.status(200).json(sector);
};