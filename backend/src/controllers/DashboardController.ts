import { Request, Response } from "express";
import { GetStorageStatsService } from "../services/DashboardServices/GetStorageStatsService";

export const getStorageStats = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const stats = await GetStorageStatsService();
  return res.status(200).json(stats);
};
