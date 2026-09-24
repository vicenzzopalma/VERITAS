import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";

export const WHATSAPP_CONTROL_SECTORS = ["PA FIXA 1", "PA FIXA 2"];

export type WhatsappAccessUser = {
  profile?: string;
  canAccessConnections?: boolean;
  connectionSectors?: string[];
};

export const canAccessWhatsapp = (
  user: WhatsappAccessUser | undefined,
  whatsapp: Pick<Whatsapp, "sector">
): boolean =>
  String(user?.profile || "").toLowerCase() === "admin" ||
  (user?.canAccessConnections === true &&
    (user.connectionSectors || []).includes(whatsapp.sector || ""));

export const getWhatsappAccessWhere = (user?: WhatsappAccessUser) =>
  String(user?.profile || "").toLowerCase() === "admin"
    ? undefined
    : user?.canAccessConnections
    ? { sector: { [Op.in]: user.connectionSectors || [] } }
    : { sector: { [Op.in]: [] } };
