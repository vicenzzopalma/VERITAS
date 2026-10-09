import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import {
  isMasterAdmin,
  isOperationalAdmin
} from "../WhatsappService/WhatsappAccessPolicy";
import { getUserSectorPermissions } from "../UserServices/SectorPermissionService";

export const getOperationalTicketSectorFilter = async (
  userId?: string | number
): Promise<string[] | null> => {
  if (!userId) return null;
  const user = await User.findByPk(userId);
  if (!user || isMasterAdmin(user)) return null;

  if (isOperationalAdmin(user)) {
    const permissions = await getUserSectorPermissions(user.id);
    if (permissions && permissions.length > 0) {
      return permissions.filter(p => p.canView).map(p => p.sector);
    }
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

  if (isOperationalAdmin(user)) {
    const whatsapp = ticket.whatsapp || (ticket.whatsappId ? await Whatsapp.findByPk(ticket.whatsappId) : null);
    const sector = whatsapp?.sector || "";

    const permissions = await getUserSectorPermissions(user.id);
    if (permissions && permissions.length > 0) {
      const perm = permissions.find(p => p.sector === sector);
      if (!perm || !perm.canView) {
        throw new AppError("ERR_NO_PERMISSION", 403);
      }
      if (requireConfigure && !perm.canConfigure) {
        throw new AppError("ERR_NO_PERMISSION", 403);
      }
    }
  }
};