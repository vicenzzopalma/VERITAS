import { Request, Response } from "express";
import { whatsappProvider } from "../providers/WhatsApp";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import ClearWppSessionKeys from "../services/WppKeyServices/ClearWppSessionKeys";
import { getIO } from "../libs/socket";
import { canAccessWhatsapp } from "../services/WhatsappService/WhatsappAccessPolicy";

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsapp = await ShowWhatsAppService(whatsappId);
  if (!canAccessWhatsapp(req.user, whatsapp)) {
    return res.status(403).json({ error: "ERR_NO_PERMISSION" });
  }

  StartWhatsAppSession(whatsapp);

  return res.status(200).json({ message: "Starting session." });
};

const update = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const idNumber = Number(whatsappId);
  const currentWhatsapp = await ShowWhatsAppService(whatsappId);
  if (!canAccessWhatsapp(req.user, currentWhatsapp)) {
    return res.status(403).json({ error: "ERR_NO_PERMISSION" });
  }

  // Remove sessao ativa em memoria e limpa qualquer listener
  try {
    await whatsappProvider.removeSession(idNumber);
  } catch (err) {
    // ignora se nao houver sessao ativa
  }

  // Limpa todas as chaves criptograficas antigas (WppKeys no SQLite e Redis)
  await ClearWppSessionKeys(idNumber);

  const { whatsapp } = await UpdateWhatsAppService({
    whatsappId,
    whatsappData: { session: "", qrcode: "", retries: 0 }
  });

  StartWhatsAppSession(whatsapp);

  return res.status(200).json({ message: "Starting session." });
};

const remove = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const idNumber = Number(whatsappId);
  const whatsapp = await ShowWhatsAppService(whatsappId);
  if (!canAccessWhatsapp(req.user, whatsapp)) {
    return res.status(403).json({ error: "ERR_NO_PERMISSION" });
  }

  try {
    await whatsappProvider.logout(whatsapp.id);
  } catch (err) {
    try {
      await whatsappProvider.removeSession(idNumber);
    } catch {}
  }

  // Limpa todas as chaves no banco e redis
  await ClearWppSessionKeys(idNumber);

  await whatsapp.update({
    status: "DISCONNECTED",
    session: "",
    qrcode: "",
    retries: 0
  });

  const io = getIO();
  io.emit("whatsappSession", {
    action: "update",
    session: whatsapp
  });

  return res.status(200).json({ message: "Session disconnected." });
};

export default { store, remove, update };
