import { verify } from "jsonwebtoken";
import { Response as Res } from "express";

import User from "../../models/User";
import AppError from "../../errors/AppError";
import ShowUserService from "../UserServices/ShowUserService";
import authConfig from "../../config/auth";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";

import { SerializeUser } from "../../helpers/SerializeUser";

interface RefreshTokenPayload {
  id: string;
  tokenVersion: number;
}

interface Response {
  user: any;
  newToken: string;
  refreshToken: string;
}

export const RefreshTokenService = async (
  res: Res,
  token: string
): Promise<Response> => {
  try {
    const decoded = verify(token, authConfig.refreshSecret);
    const { id, tokenVersion } = decoded as RefreshTokenPayload;

    const user = await User.findByPk(id, {
      include: ["queues", "whatsapp"]
    });

    if (!user) {
      res.clearCookie("jrt");
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    if (user.tokenVersion !== tokenVersion) {
      res.clearCookie("jrt");
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    if (user.status === "pending") {
      res.clearCookie("jrt");
      throw new AppError("ERR_USER_PENDING_APPROVAL", 403);
    }

    const newToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    const serializedUser = SerializeUser(user);

    return { user: serializedUser, newToken, refreshToken };
  } catch (err) {
    res.clearCookie("jrt");
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
};
