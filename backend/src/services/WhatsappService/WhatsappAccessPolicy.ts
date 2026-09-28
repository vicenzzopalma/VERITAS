import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";

export const WHATSAPP_CONTROL_SECTORS = ["PA FIXA 1", "PA FIXA 2"];

export type WhatsappAccessUser = {
  profile?: string;
  canAccessConnections?: boolean;
  connectionSectors?: string[];
};

export const normalizeConnectionSectors = (sectors: unknown): string[] => {
  if (Array.isArray(sectors)) {
    return sectors.map(sector => String(sector).trim()).filter(Boolean);
  }

  if (typeof sectors === "string") {
    try {
      return normalizeConnectionSectors(JSON.parse(sectors));
    } catch (_err) {
      return [];
    }
  }

  return [];
};

export const isWhatsappControlProfile = (profile?: string): boolean => {
  const p = String(profile || "").toLowerCase();
  return p === "whatsapp_control" || p === "whatsapp_control_high";
};

export const canAccessWhatsapp = (
  user: WhatsappAccessUser | undefined,
  whatsapp: Pick<Whatsapp, "sector">
): boolean => {
  const profile = String(user?.profile || "").toLowerCase();
  if (profile === "admin") return true;

  const isManager = isWhatsappControlProfile(profile);
  const hasAccess = isManager || user?.canAccessConnections === true;
  return hasAccess && normalizeConnectionSectors(user?.connectionSectors).includes(whatsapp.sector || "");
};

export const getWhatsappAccessWhere = (user?: WhatsappAccessUser) => {
  const profile = String(user?.profile || "").toLowerCase();
  if (profile === "admin") return undefined;

  const isManager = isWhatsappControlProfile(profile);
  const hasAccess = isManager || user?.canAccessConnections === true;
  return hasAccess
    ? { sector: { [Op.in]: normalizeConnectionSectors(user?.connectionSectors) } }
    : { sector: { [Op.in]: [] } };
};
