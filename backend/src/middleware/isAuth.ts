import { verify } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import authConfig from "../config/auth";

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  iat: number;
  exp: number;
}

const isAuth = (req: Request, res: Response, next: NextFunction): void => {
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

    req.user = {
      id,
      profile
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
