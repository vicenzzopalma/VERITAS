import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";

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
}

export const SerializeUser = (user: User): SerializedUser => {
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
    whatsapp: user.whatsapp
  };
};
