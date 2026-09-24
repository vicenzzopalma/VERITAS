import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { initRedis } from "./libs/redisStore";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import sequelize from "./database";
import User from "./models/User";
import Setting from "./models/Setting";
import bcrypt from "bcryptjs";

const PORT = process.env.PORT || 8080;

async function start() {
  try {
    await sequelize.sync();
    logger.info("Database synced successfully");

    // Garantir usuário admin padrão
    const adminCount = await User.count({ where: { email: "admin@whaticket.com" } });
    if (adminCount === 0) {
      const defaultAdminPassword =
        process.env.DEFAULT_ADMIN_PASSWORD ||
        (process.env.NODE_ENV === "production" ? undefined : "admin");
      if (!defaultAdminPassword) {
        throw new Error(
          "DEFAULT_ADMIN_PASSWORD must be configured before creating the default admin"
        );
      }

      const passwordHash = await bcrypt.hash(defaultAdminPassword, 12);
      await User.create({
        name: "Administrador",
        email: "admin@whaticket.com",
        passwordHash,
        profile: "admin",
        tokenVersion: 0
      });
      logger.info("Default admin user created from configured credentials");
    }

    // Configurações padrão
    const settings = [
      { key: "userCreation", value: "enabled" },
      { key: "allTicket", value: "enabled" },
      { key: "CheckMsgIsGroup", value: "enabled" },
      { key: "call", value: "disabled" },
      { key: "sideMenu", value: "disabled" },
      { key: "quickMessages", value: "enabled" }
    ];
    for (const s of settings) {
      const exists = await Setting.count({ where: { key: s.key } });
      if (exists === 0) {
        await Setting.create({ key: s.key, value: s.value });
      }
    }
  } catch (err) {
    logger.error({ info: "Database sync error", err });
    throw err;
  }

  const server = app.listen(PORT, () => {
    logger.info(`Server started on port: ${PORT}`);
  });

  initIO(server);
  initRedis();
  await StartAllWhatsAppsSessions();
  gracefulShutdown(server);
}

start();

process.on("uncaughtException", err => {
  logger.error({ info: "Global uncaught exception", err });
});

process.on("unhandledRejection", err => {
  if (err) logger.error({ info: "Global unhandled rejection", err });
});
