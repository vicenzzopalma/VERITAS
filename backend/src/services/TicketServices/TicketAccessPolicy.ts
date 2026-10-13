import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import {
  isMasterAdmin,
  isOperationalAdmin,
  isWhatsappControlProfile,
  getEffectiveUserSectors
} from "../WhatsappService/WhatsappAccessPolicy";
import { getUserSectorPermissions } from "../UserServices/SectorPermissionService";

export const getOperationalTicketSectorFilter = async (
  userId?: string | number
): Promise<string[] | null> => {
  if (!userId) return null;
  const user = await User.findByPk(userId);
  if (!user || isMasterAdmin(user)) return null;

  // 1. Gestores WhatsApp Control
  if (isWhatsappControlProfile(user.profile)) {
    const sectors = getEffectiveUserSectors(user);
    return sectors;
  }

  // 2. Usuários com permissões registradas na matriz de setores (Admin Operacional ou outros)
  const permissions = await getUserSectorPermissions(user.id);
  if (permissions && permissions.length > 0) {
    return permissions.filter(p => p.canView).map(p => p.sector);
  }

  // 3. Fallback para Administrador Operacional sem permissões registradas
  if (isOperationalAdmin(user)) {
    return [];
  }

  return null;
};

export const assertTicketAccess = async (
  ticket: Ticket,
  userId?: string | number,
  requireConfigure = false
): Promise<void> => {
  if (!userId) return;
  const user = await User.findByPk(userId);
  if (!user || isMasterAdmin(user)) return;

  const whatsapp = ticket.whatsapp || (ticket.whatsappId ? await Whatsapp.findByPk(ticket.whatsappId) : null);
  const sector = String(whatsapp?.sector || "").trim();

  // 1. Gestores WhatsApp Control
  if (isWhatsappControlProfile(user.profile)) {
    const allowedSectors = getEffectiveUserSectors(user);
    if (!allowedSectors.includes(sector)) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
    return;
  }

  // 2. Permissões setoriais
  const permissions = await getUserSectorPermissions(user.id);
  if (permissions && permissions.length > 0) {
    const perm = permissions.find(p => p.sector === sector);
    if (!perm || !perm.canView) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
    if (requireConfigure && !perm.canConfigure) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  } else if (isOperationalAdmin(user)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};