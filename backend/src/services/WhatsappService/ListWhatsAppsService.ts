import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import { getWhatsappAccessWhere, WhatsappAccessUser } from "./WhatsappAccessPolicy";
import extractWhatsappNumber from "../../helpers/whatsappNumberHelper";

const ListWhatsAppsService = async (user?: WhatsappAccessUser): Promise<any[]> => {
  const whatsapps = await Whatsapp.findAll({
    where: getWhatsappAccessWhere(user),
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "name", "color", "greetingMessage"]
      }
    ]
  });

  return whatsapps.map((whatsapp) => ({
    ...whatsapp.toJSON(),
    number: extractWhatsappNumber(whatsapp.session),
  }));
};

export default ListWhatsAppsService;

