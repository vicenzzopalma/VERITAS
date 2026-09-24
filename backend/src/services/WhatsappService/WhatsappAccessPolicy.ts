import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";

export const WHATSAPP_CONTROL_SECTORS = ["PA FIXA 1", "PA FIXA 2"];

export type WhatsappAccessUser = {
  profile?: string;
  canAccessConnections?: boolean;
  connectionSectors?: string[];
};

export const isWhatsappControlUser = (user?: WhatsappAccessUser): boolean =>
  String(user?.profile || "").toLowerCase() === "whatsapp_control";

export const canAccessWhatsapp = (
  user: WhatsappAccessUser | undefined,
  whatsapp: Pick<Whatsapp, "sector">
): boolean =>
  !isWhatsappControlUser(user) ||
  (user?.canAccessConnections === true &&
    (user.connectionSectors || []).includes(whatsapp.sector || ""));

export const getWhatsappAccessWhere = (user?: WhatsappAccessUser) =>
  isWhatsappControlUser(user) && user?.canAccessConnections
    ? { sector: { [Op.in]: user.connectionSectors || [] } }
    : isWhatsappControlUser(user)
      ? { sector: { [Op.in]: [] } }
    : undefined;
