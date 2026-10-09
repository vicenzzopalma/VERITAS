import { sign } from "jsonwebtoken";
import authConfig from "../config/auth";
import User from "../models/User";
import {
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

  return sign(
    {
      usarname: user.name,
      username: user.name,
      email: user.email,
      profile: user.profile,
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
