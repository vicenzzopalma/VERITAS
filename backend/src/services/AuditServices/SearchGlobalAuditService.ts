import { Op, fn, where, col } from "sequelize";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import Message from "../../models/Message";
import { getPhoneSearchVariants } from "../../helpers/phoneSearchHelper";

interface Request {
  search: string;
  limit?: number;
}

export interface GlobalSearchResult {
  ticketId: number;
  whatsappId: number;
  deviceName: string;
  deviceStatus: string;
  contact: Contact;
  lastMessage: string;
  totalMessages: number;
  deletedMessages: number;
  updatedAt: Date;
}

const SearchGlobalAuditService = async ({
  search = "",
  limit = 50
}: Request): Promise<GlobalSearchResult[]> => {
  const cleanSearch = (search || "").trim().toLowerCase();

  if (!cleanSearch) {
    return [];
  }

  const isShortDigits = /^\d{1,5}$/.test(cleanSearch);

  const orConditions: any[] = [
    where(fn("LOWER", col("contact.name")), "LIKE", `%${cleanSearch}%`)
  ];

  if (!isShortDigits) {
    orConditions.push(
      where(fn("LOWER", col("lastMessage")), "LIKE", `%${cleanSearch}%`)
    );
  }

  const phoneVariants = getPhoneSearchVariants(search);
  for (const variant of phoneVariants) {
    orConditions.push(
      { "$contact.number$": { [Op.like]: `%${variant}%` } },
      { "$contact.lid$": { [Op.like]: `%${variant}%` } }
    );
  }

  const tickets = await Ticket.findAll({
    where: {
      [Op.or]: orConditions
    },
    include: [
      {
        model: Contact,
        as: "contact",
        required: true
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "status"]
      }
    ],
    limit,
    order: [["updatedAt", "DESC"]]
  });

  const results: GlobalSearchResult[] = await Promise.all(
    tickets.map(async (ticket) => {
      const totalMessages = await Message.count({
        where: { ticketId: ticket.id }
      });
      const deletedMessages = await Message.count({
        where: { ticketId: ticket.id, isDeleted: true }
      });

      return {
        ticketId: ticket.id,
        whatsappId: ticket.whatsappId,
        deviceName: ticket.whatsapp?.name || `Celular #${ticket.whatsappId}`,
        deviceStatus: ticket.whatsapp?.status || "DISCONNECTED",
        contact: ticket.contact,
        lastMessage: ticket.lastMessage || "",
        totalMessages,
        deletedMessages,
        updatedAt: ticket.updatedAt
      };
    })
  );

  return results;
};

export default SearchGlobalAuditService;
