import { Response } from "express";

export const SendRefreshToken = (res: Response, token: string): void => {
  const isProduction = process.env.NODE_ENV === "production" || process.env.HTTPS === "true";

  res.cookie("jrt", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 24 * 60 * 60 * 1000 // 24h
  });
};
