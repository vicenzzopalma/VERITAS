const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;

if (isProduction && (!jwtSecret || !refreshSecret)) {
  throw new Error(
    "JWT_SECRET and JWT_REFRESH_SECRET must be configured in production"
  );
}

export default {
  secret: jwtSecret || "development-only-jwt-secret",
  expiresIn: "7d",
  refreshSecret: refreshSecret || "development-only-refresh-secret",
  refreshExpiresIn: "30d"
};
