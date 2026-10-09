import { sign } from "jsonwebtoken";
import authConfig from "../config/auth";
import User from "../models/User";
import {
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_PROFILE,
  OPERATIONAL_ADMIN_PROFILE,
  normalizeConnectionSectors,
  isWhatsappControlProfile,
  getEffectiveUserSectors
} from "../services/WhatsappService/WhatsappAccessPolicy";

export const createAccessToken = (user: User): string => {
  const { secret, expiresIn } = authConfig;
  const isManager = isWhatsappControlProfile(user.profile);
  const effectiveSectors = getEffectiveUserSectors({
    profile: user.profile,
    connectionSectors: user.connectionSectors
  });

  const email = String(user.email || "").toLowerCase().trim();
  const isMaster = email === MASTER_ADMIN_EMAIL;
  const profile = isMaster
    ? MASTER_ADMIN_PROFILE
    : (user.profile === "admin" ? OPERATIONAL_ADMIN_PROFILE : user.profile);

  return sign(
    {
      usarname: user.name,
      username: user.name,
      email: user.email,
      profile,
      id: user.id,
      canAccessConnections: isManager ? true : Boolean(user.canAccessConnections),
      connectionSectors: effectiveSectors
    },
    secret,
    {
      expiresIn
    }
  );
};

export const createRefreshToken = (user: User): string => {
  const { refreshSecret, refreshExpiresIn } = authConfig;

  return sign({ id: user.id, tokenVersion: user.tokenVersion }, refreshSecret, {
    expiresIn: refreshExpiresIn
  });
};