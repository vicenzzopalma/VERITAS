import { Op, fn, where, col } from "sequelize";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import { getPhoneSearchVariants } from "../../helpers/phoneSearchHelper";

interface Request {
  whatsappId: number | string;
  search?: string;
  pageNumber?: string | number;
  limit?: number;
}

export interface AuditChatResponse {
  ticketId: number;
  whatsappId: number;
  contact: Contact;
  lastMessage: string;
  unreadMessages: number;
  totalMessages: number;
  deletedMessages: number;
  updatedAt: Date;
  createdAt: Date;
}

interface Response {
  chats: AuditChatResponse[];
  count: number;
  hasMore: boolean;
}

const ListAuditChatsService = async ({
  whatsappId,
  search = "",
  pageNumber = 1,
  limit = 40
}: Request): Promise<Response> => {
  const page = Math.max(1, Number(pageNumber));
  const offset = limit * (page - 1);

  const cleanSearch = (search || "").trim().toLowerCase();

  let ticketWhere: any = {
    whatsappId: Number(whatsappId)
  };

  const contactOrConditions: any[] = [];
  if (cleanSearch) {
    contactOrConditions.push({
      [Op.and]: [
        where(fn("LOWER", col("contact.name")), "LIKE", `%${cleanSearch}%`),
        where(fn("LENGTH", col("contact.name")), "<=", 13)
      ]
    });

    const phoneVariants = getPhoneSearchVariants(search);
    for (const variant of phoneVariants) {
      contactOrConditions.push({
        [Op.and]: [
          { "$contact.number$": { [Op.like]: `%${variant}%` } },
          where(fn("LENGTH", col("contact.number")), "<=", 13)
        ]
      });
    }

    const isShortDigits = /^\d{1,5}$/.test(cleanSearch);
    if (!isShortDigits) {
      contactOrConditions.push(
        where(fn("LOWER", col("lastMessage")), "LIKE", `%${cleanSearch}%`)
      );
    }

    ticketWhere = {
      ...ticketWhere,
      [Op.or]: contactOrConditions
    };
  }

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: ticketWhere,
    include: [
      {
        model: Contact,
        as: "contact",
        required: true
      }
    ],
    limit,
    offset,
    order: [["updatedAt", "DESC"]]
  });

  const chats: AuditChatResponse[] = await Promise.all(
    tickets.map(async (ticket) => {
      const totalMessages = await Message.count({
        where: { ticketId: ticket.id }
      });

      const deletedMessages = await Message.count({
        where: {
          ticketId: ticket.id,
          isDeleted: true
        }
      });

      return {
        ticketId: ticket.id,
        whatsappId: ticket.whatsappId,
        contact: ticket.contact,
        lastMessage: ticket.lastMessage || "",
        unreadMessages: ticket.unreadMessages || 0,
        totalMessages,
        deletedMessages,
        updatedAt: ticket.updatedAt,
        createdAt: ticket.createdAt
      };
    })
  );

  const hasMore = count > offset + tickets.length;

  return {
    chats,
    count,
    hasMore
  };
};

export default ListAuditChatsService;
