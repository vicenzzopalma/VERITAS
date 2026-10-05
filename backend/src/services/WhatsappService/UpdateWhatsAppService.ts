import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import ShowWhatsAppService from "./ShowWhatsAppService";
import AssociateWhatsappQueue from "./AssociateWhatsappQueue";
import { whatsappProvider } from "../../providers/WhatsApp";

interface WhatsappData {
  name?: string;
  status?: string;
  session?: string;
  isDefault?: boolean;
  greetingMessage?: string;
  farewellMessage?: string;
  queueIds?: number[];
  proxyUrl?: string;
  humanDelay?: boolean;
  sector?: string;
}

interface Request {
  whatsappData: WhatsappData;
  whatsappId: string;
}

interface Response {
  whatsapp: Whatsapp;
  oldDefaultWhatsapp: Whatsapp | null;
}

const UpdateWhatsAppService = async ({
  whatsappData,
  whatsappId
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    status: Yup.string(),
    isDefault: Yup.boolean(),
    sector: Yup.string()
  });

  const {
    name,
    status,
    isDefault,
    session,
    greetingMessage,
    farewellMessage,
    queueIds = [],
    proxyUrl,
    humanDelay,
    sector
  } = whatsappData;

  try {
    await schema.validate({ name, status, isDefault, sector });
  } catch (err) {
    throw new AppError(err.message);
  }

  if (queueIds.length > 1 && !greetingMessage) {
    throw new AppError("ERR_WAPP_GREETING_REQUIRED");
  }

  let oldDefaultWhatsapp: Whatsapp | null = null;

  if (isDefault) {
    oldDefaultWhatsapp = await Whatsapp.findOne({
      where: { isDefault: true, id: { [Op.not]: whatsappId } }
    });
    if (oldDefaultWhatsapp) {
      await oldDefaultWhatsapp.update({ isDefault: false });
    }
  }

  const whatsapp = await ShowWhatsAppService(whatsappId);

  // Se o aparelho foi arquivado, encerra a sessão ativa do Baileys para não manter conexões abertas
  if (status === "archived") {
    try {
      await whatsappProvider.removeSession(+whatsappId);
    } catch (e) {
      // ignora caso já esteja desconectado
    }
  }

  await whatsapp.update({
    name: name !== undefined ? name : whatsapp.name,
    status: status !== undefined ? status : whatsapp.status,
    session: session !== undefined ? session : whatsapp.session,
    greetingMessage: greetingMessage !== undefined ? greetingMessage : whatsapp.greetingMessage,
    farewellMessage: farewellMessage !== undefined ? farewellMessage : whatsapp.farewellMessage,
    isDefault: isDefault !== undefined ? isDefault : whatsapp.isDefault,
    proxyUrl: proxyUrl !== undefined ? proxyUrl : whatsapp.proxyUrl,
    humanDelay: humanDelay !== undefined ? humanDelay : whatsapp.humanDelay,
    sector: sector !== undefined ? sector : whatsapp.sector
  });

  await AssociateWhatsappQueue(whatsapp, queueIds);

  return { whatsapp, oldDefaultWhatsapp };
};

export default UpdateWhatsAppService;
