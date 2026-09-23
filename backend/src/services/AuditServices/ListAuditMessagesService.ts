import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  whatsappId?: string | number;
  ticketId?: string | number;
  search?: string;
  startDate?: string;
  endDate?: string;
  onlyDeleted?: string | boolean;
  mediaType?: string;
  pageNumber?: string | number;
  limit?: number;
}

interface Response {
  messages: Message[];
  count: number;
  hasMore: boolean;
  totalDeleted: number;
}

const ListAuditMessagesService = async ({
  whatsappId,
  ticketId,
  search = "",
  startDate,
  endDate,
  onlyDeleted,
  mediaType,
  pageNumber = 1,
  limit = 2000
}: Request): Promise<Response> => {
  const isFetchAll = limit === -1 || limit >= 50000;
  const actualLimit = isFetchAll ? 50000 : Math.max(1, Number(limit));
  const page = Math.max(1, Number(pageNumber));
  const offset = isFetchAll ? 0 : actualLimit * (page - 1);

  const whereConditions: any = {};
  const ticketWhereConditions: any = {};

  if (ticketId) {
    const currentTicket = await Ticket.findByPk(Number(ticketId));
    if (currentTicket) {
      if (!whatsappId) {
        ticketWhereConditions.whatsappId = currentTicket.whatsappId;
      }
      ticketWhereConditions.contactId = currentTicket.contactId;
    } else {
      whereConditions.ticketId = Number(ticketId);
    }
  }

  if (whatsappId) {
    ticketWhereConditions.whatsappId = Number(whatsappId);
  }

  if (onlyDeleted === true || onlyDeleted === "true") {
    whereConditions.isDeleted = true;
  }

  if (search && search.trim()) {
    whereConditions.body = {
      [Op.like]: `%${search.trim()}%`
    };
  }

  const parseDateFilter = (val: string, isEnd: boolean): Date => {
    if (val.length === 10 && val.includes("-")) {
      const [y, m, d] = val.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      if (isEnd) {
        date.setHours(23, 59, 59, 999);
      } else {
        date.setHours(0, 0, 0, 0);
      }
      return date;
    }
    const date = new Date(val);
    if (isEnd && !val.includes("T")) {
      date.setHours(23, 59, 59, 999);
    }
    return date;
  };

  if (startDate || endDate) {
    const dateFilter: any = {};
    if (startDate) {
      dateFilter[Op.gte] = parseDateFilter(startDate, false);
    }
    if (endDate) {
      dateFilter[Op.lte] = parseDateFilter(endDate, true);
    }
    whereConditions.createdAt = dateFilter;
  }

  if (mediaType && mediaType !== "all") {
    if (mediaType === "audio") {
      whereConditions[Op.or] = [
        { mediaType: { [Op.like]: "%audio%" } },
        { mediaType: "voice" },
        { mediaType: "ptt" }
      ];
    } else if (mediaType === "image") {
      whereConditions[Op.or] = [
        { mediaType: { [Op.like]: "%image%" } }
      ];
    } else if (mediaType === "video") {
      whereConditions[Op.or] = [
        { mediaType: { [Op.like]: "%video%" } }
      ];
    } else if (mediaType === "document") {
      whereConditions[Op.or] = [
        { mediaType: { [Op.like]: "%document%" } },
        { mediaType: { [Op.like]: "%pdf%" } }
      ];
    } else if (mediaType === "vcard") {
      whereConditions.mediaType = "vcard";
    }
  }

  const { count, rows: messages } = await Message.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: Contact,
        as: "contact"
      },
      {
        model: Ticket,
        as: "ticket",
        where: Object.keys(ticketWhereConditions).length > 0 ? ticketWhereConditions : undefined,
        required: Object.keys(ticketWhereConditions).length > 0,
        include: [
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["id", "name"]
          },
          {
            model: Contact,
            as: "contact"
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: [
          {
            model: Contact,
            as: "contact"
          }
        ]
      }
    ],
    limit: actualLimit,
    offset,
    order: [["createdAt", "DESC"]]
  });

  const totalDeleted = await Message.count({
    where: {
      ...whereConditions,
      isDeleted: true
    },
    include: Object.keys(ticketWhereConditions).length > 0
      ? [
          {
            model: Ticket,
            as: "ticket",
            where: ticketWhereConditions,
            required: true
          }
        ]
      : undefined
  });

  const hasMore = isFetchAll ? false : count > offset + messages.length;

  return {
    messages: messages.reverse(),
    count,
    hasMore,
    totalDeleted
  };
};

export default ListAuditMessagesService;
