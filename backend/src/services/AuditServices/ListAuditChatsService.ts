import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";

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

  const contactWhere: any = {};
  if (search && search.trim()) {
    const cleanSearch = search.trim();
    contactWhere[Op.or] = [
      { name: { [Op.like]: `%${cleanSearch}%` } },
      { number: { [Op.like]: `%${cleanSearch}%` } }
    ];
  }

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: {
      whatsappId: Number(whatsappId)
    },
    include: [
      {
        model: Contact,
        as: "contact",
        where: Object.keys(contactWhere).length > 0 ? contactWhere : undefined,
        required: Object.keys(contactWhere).length > 0
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
