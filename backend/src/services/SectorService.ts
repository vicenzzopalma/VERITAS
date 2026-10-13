import { Op } from "sequelize";
import AppError from "../errors/AppError";
import Sector from "../models/Sector";
import {
  isMasterAdmin,
  MASTER_ADMIN_PROFILE,
  DEFAULT_OPERATIONAL_SECTORS
} from "./WhatsappService/WhatsappAccessPolicy";

export const listSectors = async (user?: any) => {
  try {
    const isMaster = isMasterAdmin(user);
    let sectors = await Sector.findAll({
      where: { active: true },
      order: [["name", "ASC"]],
      attributes: ["id", "name", "minimumProfile"]
    });

    if (!isMaster && user && user.id) {
      const UserSectorPermission = require("../models/UserSectorPermission").default;
      const userPermissions = await UserSectorPermission.findAll({
        where: { userId: user.id, canView: true },
        attributes: ["sector"]
      }).catch(() => []);
      const explicitlyAllowedSectors = new Set((userPermissions || []).map((p: any) => p.sector));

      if (explicitlyAllowedSectors.size > 0) {
        sectors = sectors.filter((s: any) => explicitlyAllowedSectors.has(s.name));
      } else {
        sectors = sectors.filter((s: any) => s.minimumProfile !== MASTER_ADMIN_PROFILE);
      }
    }

    if (sectors && sectors.length > 0) {
      return sectors.map((s: any) => ({
        id: s.id,
        name: s.name,
        minimumProfile: s.minimumProfile || "admin_operational"
      }));
    }
  } catch (err) {
    console.error("[SECTORS] Erro ao listar setores do banco:", err);
  }

  // Fallback seguro inquebrável
  return DEFAULT_OPERATIONAL_SECTORS.map((name, idx) => ({
    id: idx + 1,
    name,
    minimumProfile: "admin_operational"
  }));
};

export const createSector = async ({
  name,
  minimumProfile,
  user
}: {
  name: string;
  minimumProfile?: string;
  user?: any;
}) => {
  if (!isMasterAdmin(user)) {
    throw new AppError("Apenas o Administrador Master pode criar setores.", 403);
  }

  const cleanName = String(name || "").trim();
  if (!cleanName) {
    throw new AppError("ERR_INVALID_SECTOR", 400);
  }

  const profile = minimumProfile === "admin_master" ? "admin_master" : "admin_operational";

  const allSectors = await listSectors(user);
  const exists = allSectors.some(
    (s: any) => s.name.trim().toLowerCase() === cleanName.toLowerCase()
  );

  if (exists) {
    throw new AppError("ERR_SECTOR_ALREADY_EXISTS", 409);
  }

  const created = await Sector.create({
    name: cleanName,
    minimumProfile: profile,
    active: true
  });

  if (user && user.id) {
    try {
      const UserSectorPermission = require("../models/UserSectorPermission").default;
      await UserSectorPermission.create({
        userId: user.id,
        sector: cleanName,
        canView: true,
        canConfigure: true
      });
    } catch (_e) {}
  }

  try {
    const { getIO } = require("../libs/socket");
    const io = getIO();
    io.emit("sector", {
      action: "create",
      sector: {
        id: created.id,
        name: created.name,
        minimumProfile: created.minimumProfile
      }
    });
  } catch (_e) {}

  return {
    id: created.id,
    name: created.name,
    minimumProfile: created.minimumProfile
  };
};