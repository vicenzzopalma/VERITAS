import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import UserSectorPermission from "../models/UserSectorPermission";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  status: string;
  canAccessConnections: boolean;
  connectionSectors: string[];
  whatsappId?: number;
  queues: Queue[];
  whatsapp: Whatsapp;
  sectorPermissions: Array<{ sector: string; canView: boolean; canConfigure: boolean }>;
}

export const SerializeUser = (user: User, sectorPermissions: UserSectorPermission[] = []): SerializedUser => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    status: user.status,
    canAccessConnections: user.canAccessConnections,
    connectionSectors: user.connectionSectors || [],
    whatsappId: user.whatsappId,
    queues: user.queues,
    whatsapp: user.whatsapp,
    sectorPermissions: sectorPermissions.map(permission => ({
      sector: permission.sector,
      canView: Boolean(permission.canView),
      canConfigure: Boolean(permission.canConfigure)
    }))
  };
};
