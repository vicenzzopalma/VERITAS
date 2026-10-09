import AppError from "../errors/AppError";
import Sector from "../models/Sector";
import { isMasterAdmin, MASTER_ADMIN_PROFILE } from "./WhatsappService/WhatsappAccessPolicy";

export const listSectors = async (user?: any) => {
  const where: any = { active: true };
  if (!isMasterAdmin(user)) where.minimumProfile = { [Op.ne]: MASTER_ADMIN_PROFILE };
  return Sector.findAll({ where, order: [["name", "ASC"]], attributes: ["id", "name", "minimumProfile"] });
};

export const createSector = async ({ name, minimumProfile }: { name: string; minimumProfile: string }) => {
  const cleanName = String(name || "").trim();
  if (!cleanName) throw new AppError("ERR_INVALID_SECTOR", 400);
  if (!["admin_master", "admin_operational"].includes(minimumProfile)) {
    throw new AppError("ERR_INVALID_SECTOR_PROFILE", 400);
  }
  const existingSectors = await Sector.findAll({ where: { active: true }, attributes: ["name"] });
  const existing = existingSectors.find(sector => sector.name.trim().toLowerCase() === cleanName.toLowerCase());
  if (existing) throw new AppError("ERR_SECTOR_ALREADY_EXISTS", 409);
  return Sector.create({ name: cleanName, minimumProfile, active: true });
};
