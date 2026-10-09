import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import UserSectorPermission from "../../models/UserSectorPermission";
import { canConfigureSector, canViewSector, isMasterAdmin, isOperationalAdmin } from "../WhatsappService/WhatsappAccessPolicy";

const getAccessUser = async (userId: string | number) => {
  const user = await User.findByPk(userId, { attributes: ["id", "email", "profile"] });
  if (!user) return undefined;
  const permissions = await UserSectorPermission.findAll({ where: { userId }, attributes: ["sector", "canView", "canConfigure"] });
  return {
    id: user.id.toString(),
    email: user.email,
    profile: user.profile,
    isMasterAdmin: isMasterAdmin({ email: user.email, profile: user.profile }),
    sectorPermissions: permissions.map(permission => ({ sector: permission.sector, canView: Boolean(permission.canView), canConfigure: Boolean(permission.canConfigure) }))
  };
};

export const assertTicketAccess = async (ticket: Ticket, userId: string | number, configure = false) => {
  const user = await getAccessUser(userId);
  if (!user) throw new AppError("ERR_NO_PERMISSION", 403);
  if (isMasterAdmin(user) || user.profile === "admin") return;
  if (!isOperationalAdmin(user)) return;
  const allowed = configure
    ? canConfigureSector(user, ticket.whatsapp?.sector || "")
    : canViewSector(user, ticket.whatsapp?.sector || "");
  if (!allowed) throw new AppError("ERR_NO_PERMISSION", 403);
};

export const getOperationalTicketSectorFilter = async (userId: string | number) => {
  const user = await getAccessUser(userId);
  if (!user || !isOperationalAdmin(user) || isMasterAdmin(user)) return undefined;
  return user.sectorPermissions.filter(permission => permission.canView).map(permission => permission.sector);
};
