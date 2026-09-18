import User from "../../models/User";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import { SerializeUser } from "../../helpers/SerializeUser";

const ShowUserService = async (id: string | number): Promise<any> => {
  const user = await User.findByPk(id, {
    attributes: [
      "name",
      "id",
      "email",
      "profile",
      "status",
      "whatsappId",
      "tokenVersion"
    ],
    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name"] }
    ],
    order: [[{ model: Queue, as: "queues" }, "name", "asc"]]
  });
  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  return SerializeUser(user);
};

export default ShowUserService;
