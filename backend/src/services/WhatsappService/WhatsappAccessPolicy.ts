import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";

export const WHATSAPP_CONTROL_SECTORS = ["PA FIXA 1", "PA FIXA 2"];

export type WhatsappAccessUser = {
  profile?: string;
  email?: string;
  isMasterAdmin?: boolean;
  canAccessConnections?: boolean;
  connectionSectors?: string[];
  sectorPermissions?: Array<{ sector: string; canView: boolean; canConfigure: boolean }>;
};

export const MASTER_ADMIN_EMAIL = "vicenzzo.mastronikolis@realess.com.br";
export const OPERATIONAL_ADMIN_PROFILE = "admin_operational";
export const MASTER_ADMIN_PROFILE = "admin_master";

export const isMasterAdmin = (user?: WhatsappAccessUser): boolean => {
  return Boolean(user && (
    user.isMasterAdmin === true ||
    (String(user.email || "").trim().toLowerCase() === MASTER_ADMIN_EMAIL && String(user.profile || "").toLowerCase() === MASTER_ADMIN_PROFILE)
  ));
};

export const isOperationalAdmin = (user?: WhatsappAccessUser): boolean => {
  return String(user?.profile || "").toLowerCase() === OPERATIONAL_ADMIN_PROFILE;
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

export const getEffectiveUserSectors = (user?: WhatsappAccessUser): string[] => {
  const profile = String(user?.profile || "").toLowerCase();
  const raw = normalizeConnectionSectors(user?.connectionSectors);
  let sectors = raw;
  if (sectors.length === 0 && isWhatsappControlProfile(profile)) {
    sectors = WHATSAPP_CONTROL_SECTORS;
  }
  const expanded: string[] = [];
  for (const s of sectors) {
    if (s === "PA FIXA") {
      expanded.push("PA FIXA 1", "PA FIXA 2");
    } else {
      expanded.push(s);
    }
  }
  return Array.from(new Set(expanded));
};

export const canAccessWhatsapp = (
  user: WhatsappAccessUser | undefined,
  whatsapp: Pick<Whatsapp, "sector">
): boolean => {
  const profile = String(user?.profile || "").toLowerCase();
  if (isMasterAdmin(user) || (profile === "admin" && !user?.sectorPermissions)) return true;
  if (isOperationalAdmin(user)) {
    return getSectorPermission(user, whatsapp.sector || "")?.canView === true;
  }

  const isManager = isWhatsappControlProfile(profile);
  const hasAccess = isManager || user?.canAccessConnections === true;
  return hasAccess && getEffectiveUserSectors(user).includes(whatsapp.sector || "");
};

export const getWhatsappAccessWhere = (user?: WhatsappAccessUser) => {
  const profile = String(user?.profile || "").toLowerCase();
  if (isMasterAdmin(user) || (profile === "admin" && !user?.sectorPermissions)) return undefined;
  if (isOperationalAdmin(user)) {
    const allowed = (user?.sectorPermissions || []).filter(permission => permission.canView).map(permission => permission.sector);
    return { sector: { [Op.in]: allowed } };
  }

  const isManager = isWhatsappControlProfile(profile);
  const hasAccess = isManager || user?.canAccessConnections === true;
  return hasAccess
    ? { sector: { [Op.in]: getEffectiveUserSectors(user) } }
    : { sector: { [Op.in]: [] } };
};

export const getSectorPermission = (user: WhatsappAccessUser | undefined, sector: string) => {
  if (isMasterAdmin(user)) return { sector, canView: true, canConfigure: true };
  return (user?.sectorPermissions || []).find(permission => permission.sector === sector);
};

export const canViewSector = (user: WhatsappAccessUser | undefined, sector: string): boolean => {
  if (isMasterAdmin(user)) return true;
  if (!isOperationalAdmin(user)) return true;
  return getSectorPermission(user, sector)?.canView === true;
};

export const canConfigureSector = (user: WhatsappAccessUser | undefined, sector: string): boolean => {
  if (isMasterAdmin(user)) return true;
  if (!isOperationalAdmin(user)) return true;
  return getSectorPermission(user, sector)?.canConfigure === true;
};
