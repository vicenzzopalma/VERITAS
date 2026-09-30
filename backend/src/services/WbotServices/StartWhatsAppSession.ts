import Whatsapp from "../../models/Whatsapp";
import { whatsappProvider } from "../../providers/WhatsApp";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp
): Promise<void> => {
  if (
    whatsapp.status === "archived" ||
    (whatsapp.name && whatsapp.name.toUpperCase().startsWith("HISTÓRICO"))
  ) {
    logger.info(`Skipping StartWhatsAppSession for archived/historical whatsapp: ${whatsapp.name}`);
    return;
  }

  await whatsapp.update({ status: "OPENING" });

  const io = getIO();
  io.emit("whatsappSession", {
    action: "update",
    session: whatsapp
  });
  io.emit("whatsapp", {
    action: "update",
    whatsapp
  });

  try {
    console.log("VAI!");
    await whatsappProvider.init(whatsapp);
  } catch (err) {
    logger.error(err);
  }
};
