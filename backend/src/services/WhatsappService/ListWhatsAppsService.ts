import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import { getWhatsappAccessWhere, WhatsappAccessUser } from "./WhatsappAccessPolicy";

const ListWhatsAppsService = async (user?: WhatsappAccessUser): Promise<Whatsapp[]> => {
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

  return whatsapps;
};

export default ListWhatsAppsService;
