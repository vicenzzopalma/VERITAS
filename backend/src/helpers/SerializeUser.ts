import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import {
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_PROFILE,
  OPERATIONAL_ADMIN_PROFILE,
  SectorPermissionItem
} from "../services/WhatsappService/WhatsappAccessPolicy";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  status: string;
  canAccessConnections: boolean;
  connectionSectors: string[];
  sectorPermissions?: SectorPermissionItem[];
  whatsappId?: number;
  queues: Queue[];
  whatsapp: Whatsapp;
}

export const SerializeUser = (
  user: User,
  sectorPermissions?: SectorPermissionItem[]
): SerializedUser => {
  const email = String(user.email || "").toLowerCase().trim();
  const isMaster = email === MASTER_ADMIN_EMAIL;
  const profile = isMaster
    ? MASTER_ADMIN_PROFILE
    : (user.profile === "admin" ? OPERATIONAL_ADMIN_PROFILE : user.profile);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile,
    status: user.status,
    canAccessConnections: user.canAccessConnections,
    connectionSectors: user.connectionSectors || [],
    sectorPermissions: sectorPermissions || [],
    whatsappId: user.whatsappId,
    queues: user.queues,
    whatsapp: user.whatsapp
  };
};