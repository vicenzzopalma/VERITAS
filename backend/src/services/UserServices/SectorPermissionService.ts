import AppError from "../../errors/AppError";
import User from "../../models/User";
import UserSectorPermission from "../../models/UserSectorPermission";
import {
  isMasterAdmin,
  DEFAULT_OPERATIONAL_SECTORS,
  SectorPermissionItem
} from "../WhatsappService/WhatsappAccessPolicy";
import { listSectors } from "../SectorService";
import { syncUserToCrm } from "./SyncUserToCrmService";

export const getUserSectorPermissions = async (
  userId: number | string
): Promise<SectorPermissionItem[]> => {
  try {
    const user = await User.findByPk(userId);
    if (!user) return [];

    if (isMasterAdmin(user)) {
      const allSectors = await listSectors(user);
      return allSectors.map((s: any) => ({
        sector: s.name,
        canView: true,
        canConfigure: true
      }));
    }

    const saved = await UserSectorPermission.findAll({
      where: { userId }
    });

    if (saved && saved.length > 0) {
      return saved.map((p: any) => ({
        sector: p.sector,
        canView: Boolean(p.canView),
        canConfigure: Boolean(p.canConfigure)
      }));
    }

    // Se o usuário for Administrador Operacional ou Admin antigo e não tiver registros salvos,
    // concede acesso padrão a todos os setores operacionais para não perder acessos!
    const profile = String(user.profile || "").toLowerCase();
    if (profile === "admin" || profile === "admin_operational") {
      const operationalSectors = await listSectors();
      return operationalSectors.map((s: any) => ({
        sector: s.name,
        canView: true,
        canConfigure: true
      }));
    }

    return [];
  } catch (err) {
    console.error("[PERMISSIONS] Erro ao carregar permissões setoriais:", err);
    return DEFAULT_OPERATIONAL_SECTORS.map(sector => ({
      sector,
      canView: true,
      canConfigure: true
    }));
  }
};

export const updateUserSectorPermissions = async (
  userId: number | string,
  permissions: SectorPermissionItem[],
  requesterUser?: any
): Promise<SectorPermissionItem[]> => {
  if (!isMasterAdmin(requesterUser)) {
    throw new AppError("Apenas o Administrador Master pode configurar permissões por setor.", 403);
  }

  const targetUser = await User.findByPk(userId);
  if (!targetUser) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  if (isMasterAdmin(targetUser)) {
    throw new AppError("O Administrador Master possui acesso irrestrito e não pode ter permissões limitadas.", 400);
  }

  // Deleta permissões anteriores e recria
  await UserSectorPermission.destroy({ where: { userId } }).catch(() => {});

  if (Array.isArray(permissions) && permissions.length > 0) {
    for (const p of permissions) {
      if (p.sector) {
        await UserSectorPermission.create({
          userId: Number(userId),
          sector: p.sector,
          canView: Boolean(p.canView),
          canConfigure: Boolean(p.canConfigure)
        }).catch(() => {});
      }
    }
  }

  const updated = await getUserSectorPermissions(userId);

  // Sincroniza com CRM
  try {
    await syncUserToCrm({
      email: targetUser.email,
      name: targetUser.name,
      profile: targetUser.profile,
      connectionSectors: targetUser.connectionSectors,
      sectorPermissions: updated
    });
  } catch (_e) {}

  return updated;
};