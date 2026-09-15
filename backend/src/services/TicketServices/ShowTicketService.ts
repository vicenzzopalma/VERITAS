import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";

const ShowTicketService = async (
  id: string | number,
  userId?: string | number
): Promise<Ticket> => {
  const ticket = await Ticket.findByPk(id, {
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "profilePicUrl"],
        include: ["extraInfo"]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["name"]
      }
    ]
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  if (userId) {
    const user = await User.findByPk(userId);
    const isOperator =
      user?.profile === "operator" ||
      Boolean(user?.whatsappId && user?.profile !== "admin");

    if (isOperator && ticket.whatsappId !== user?.whatsappId) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

  return ticket;
};

export default ShowTicketService;

