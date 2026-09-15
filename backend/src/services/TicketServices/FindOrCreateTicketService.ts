import { subHours } from "date-fns";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";

// Mutex in-memory para serializar a criação/busca de tickets concorrentes do mesmo contato
const ticketLocks = new Map<string, Promise<void>>();

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  groupContact?: Contact
): Promise<Ticket> => {
  const targetContactId = groupContact ? groupContact.id : contact.id;
  const lockKey = `${whatsappId}:${targetContactId}`;

  while (ticketLocks.has(lockKey)) {
    try {
      await ticketLocks.get(lockKey);
    } catch {
      break;
    }
  }

  let releaseLock: () => void = () => {};
  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  ticketLocks.set(lockKey, currentLock);

  try {
    let ticket = await Ticket.findOne({
      where: {
        status: {
          [Op.or]: ["open", "pending"]
        },
        contactId: targetContactId,
        whatsappId: whatsappId
      },
      order: [["id", "DESC"]]
    });

    if (ticket) {
      await ticket.update({ unreadMessages });
    }

    if (!ticket && groupContact) {
      ticket = await Ticket.findOne({
        where: {
          contactId: groupContact.id,
          whatsappId: whatsappId
        },
        order: [["updatedAt", "DESC"]]
      });

      if (ticket) {
        await ticket.update({
          status: "pending",
          userId: null,
          unreadMessages
        });
      }
    }

    if (!ticket && !groupContact) {
      ticket = await Ticket.findOne({
        where: {
          updatedAt: {
            [Op.between]: [+subHours(new Date(), 2), +new Date()]
          },
          contactId: contact.id,
          whatsappId: whatsappId
        },
        order: [["updatedAt", "DESC"]]
      });

      if (ticket) {
        await ticket.update({
          status: "pending",
          userId: null,
          unreadMessages
        });
      }
    }

    if (!ticket) {
      ticket = await Ticket.create({
        contactId: targetContactId,
        status: "pending",
        isGroup: !!groupContact,
        unreadMessages,
        whatsappId
      });
    }

    ticket = await ShowTicketService(ticket.id);

    return ticket;
  } finally {
    ticketLocks.delete(lockKey);
    releaseLock();
  }
};

export default FindOrCreateTicketService;
