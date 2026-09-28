import { sign } from "jsonwebtoken";
import authConfig from "../config/auth";
import User from "../models/User";
import {
  normalizeConnectionSectors,
  isWhatsappControlProfile
} from "../services/WhatsappService/WhatsappAccessPolicy";

export const createAccessToken = (user: User): string => {
  const { secret, expiresIn } = authConfig;
  const isManager = isWhatsappControlProfile(user.profile);

  return sign(
    {
      usarname: user.name,
      username: user.name,
      email: user.email,
      profile: user.profile,
      id: user.id,
      canAccessConnections: isManager ? true : Boolean(user.canAccessConnections),
      connectionSectors: normalizeConnectionSectors(user.connectionSectors)
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
