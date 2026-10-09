import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import User from "../../models/User";
import UserSectorPermission from "../../models/UserSectorPermission";
import Whatsapp from "../../models/Whatsapp";
import { syncUserToCrm } from "./SyncUserToCrmService";

export const getUserSectorPermissions = async (userId: string | number) => {
  return UserSectorPermission.findAll({
    where: { userId },
    attributes: ["sector", "canView", "canConfigure"],
    order: [["sector", "ASC"]]
  });
};

export const updateUserSectorPermissions = async ({ userId, permissions }: {
  userId: string | number;
  permissions: Array<{ sector: string; canView?: boolean; canConfigure?: boolean }>;
}) => {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError("ERR_NO_USER_FOUND", 404);

  const knownSectors = await Whatsapp.findAll({
    attributes: ["sector"],
    where: { sector: { [Op.ne]: null } as any },
    group: ["sector"]
  });
  const allowedSectors = new Set([
    "PA FIXA 1", "PA FIXA 2", "Junior", "Senior", "Pesquisa", "Comercial", "Jurídico",
    ...knownSectors.map(item => item.sector).filter(Boolean)
  ]);
  const normalized = new Map<string, { sector: string; canView: boolean; canConfigure: boolean }>();

  for (const permission of permissions || []) {
    const sector = String(permission.sector || "").trim();
    if (!sector || !allowedSectors.has(sector)) continue;
    const canConfigure = Boolean(permission.canConfigure);
    normalized.set(sector, { sector, canView: Boolean(permission.canView) || canConfigure, canConfigure });
  }

  await UserSectorPermission.destroy({ where: { userId } });
  if (normalized.size > 0) {
    await UserSectorPermission.bulkCreate(
      Array.from(normalized.values()).map(permission => ({ userId: Number(userId), ...permission }))
    );
  }
  await syncUserToCrm({
    email: user.email,
    name: user.name,
    profile: user.profile,
    connectionSectors: user.connectionSectors,
    sectorPermissions: Array.from(normalized.values())
  });
  return getUserSectorPermissions(userId);
};
