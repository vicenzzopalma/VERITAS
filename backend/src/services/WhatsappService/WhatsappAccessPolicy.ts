import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";

export const MASTER_ADMIN_EMAIL = "vicenzzo.mastronikolis@realess.com.br";
export const MASTER_ADMIN_PROFILE = "admin_master";
export const OPERATIONAL_ADMIN_PROFILE = "admin_operational";

export const DEFAULT_OPERATIONAL_SECTORS = [
  "Junior",
  "Senior",
  "Pesquisa",
  "Comercial",
  "Jurídico",
  "PA FIXA 1",
  "PA FIXA 2"
];

export const WHATSAPP_CONTROL_SECTORS = ["PA FIXA 1", "PA FIXA 2"];

export type SectorPermissionItem = {
  sector: string;
  canView: boolean;
  canConfigure: boolean;
};

export type WhatsappAccessUser = {
  id?: number | string;
  email?: string;
  profile?: string;
  canAccessConnections?: boolean;
  connectionSectors?: string[];
  sectorPermissions?: SectorPermissionItem[];
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

export const isMasterAdmin = (user?: WhatsappAccessUser): boolean => {
  if (!user) return false;
  const email = String(user.email || "").trim().toLowerCase();
  const profile = String(user.profile || "").trim().toLowerCase();
  return email === MASTER_ADMIN_EMAIL || profile === MASTER_ADMIN_PROFILE;
};

export const isOperationalAdmin = (user?: WhatsappAccessUser): boolean => {
  if (!user) return false;
  if (isMasterAdmin(user)) return false;
  const profile = String(user.profile || "").trim().toLowerCase();
  return profile === OPERATIONAL_ADMIN_PROFILE || profile === "admin";
};

export const isAnyAdmin = (user?: WhatsappAccessUser): boolean => {
  return isMasterAdmin(user) || isOperationalAdmin(user);
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
  if (isMasterAdmin(user)) return true;

  if (isOperationalAdmin(user)) {
    if (user && Array.isArray(user.sectorPermissions) && user.sectorPermissions.length > 0) {
      const perms = user.sectorPermissions;
      const perm = perms.find((p: SectorPermissionItem) => p.sector === (whatsapp.sector || ""));
      return perm ? perm.canView === true : false;
    }
    return true; // Retrocompatibilidade: sem restrições explícitas, acesso total
  }

  const profile = String(user?.profile || "").toLowerCase();
  const isManager = isWhatsappControlProfile(profile);
  const hasAccess = isManager || user?.canAccessConnections === true;
  return hasAccess && getEffectiveUserSectors(user).includes(whatsapp.sector || "");
};

export const getWhatsappAccessWhere = (user?: WhatsappAccessUser) => {
  if (isMasterAdmin(user)) return undefined; // Master vê tudo sem filtro

  if (isOperationalAdmin(user)) {
    if (user && Array.isArray(user.sectorPermissions) && user.sectorPermissions.length > 0) {
      const perms = user.sectorPermissions;
      const allowed = perms
        .filter((p: SectorPermissionItem) => p.canView)
        .map((p: SectorPermissionItem) => p.sector);
      return { sector: { [Op.in]: allowed } };
    }
    return undefined; // Retrocompatibilidade: vê todos os setores
  }

  const profile = String(user?.profile || "").toLowerCase();
  const isManager = isWhatsappControlProfile(profile);
  const hasAccess = isManager || user?.canAccessConnections === true;
  return hasAccess
    ? { sector: { [Op.in]: getEffectiveUserSectors(user) } }
    : { sector: { [Op.in]: [] } };
};

export const canConfigureSector = (user: WhatsappAccessUser | undefined, sector: string): boolean => {
  if (isMasterAdmin(user)) return true;

  if (isOperationalAdmin(user)) {
    if (user && Array.isArray(user.sectorPermissions) && user.sectorPermissions.length > 0) {
      const perms = user.sectorPermissions;
      const perm = perms.find((p: SectorPermissionItem) => p.sector === sector);
      return perm ? perm.canConfigure === true : false;
    }
    return true; // Sem restrições explícitas, permite edição
  }

  return false;
};