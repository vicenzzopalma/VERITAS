import { verify } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import authConfig from "../config/auth";
import User from "../models/User";

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  iat: number;
  exp: number;
}

const isAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  let token = "";

  if (authHeader) {
    const [, rawToken] = authHeader.split(" ");
    token = rawToken;
  } else if (req.query && req.query.token) {
    token = String(req.query.token);
  } else if (req.cookies && (req.cookies.token || req.cookies.jwt)) {
    token = String(req.cookies.token || req.cookies.jwt);
  }

  if (!token) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  try {
    const decoded = verify(token, authConfig.secret);
    const { id, profile } = decoded as TokenPayload;
    const user = await User.findByPk(id, {
      attributes: ["id", "profile", "canAccessConnections", "connectionSectors"]
    });

    if (!user) {
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    req.user = {
      id,
      profile,
      canAccessConnections: user.canAccessConnections,
      connectionSectors: user.connectionSectors || []
    };
  } catch (err) {
    throw new AppError(
      "Invalid token. We'll try to assign a new one on next request",
      403
    );
  }

  return next();
};

export default isAuth;
