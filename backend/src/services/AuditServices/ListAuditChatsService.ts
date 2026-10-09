import { Op, fn, where, col, Sequelize } from "sequelize";
import sequelize from "../../database";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import { getPhoneSearchVariants } from "../../helpers/phoneSearchHelper";
import { getSearchTerms } from "../../helpers/searchTermHelper";

interface Request {
  whatsappId: number | string;
  search?: string;
  ticketId?: string | number;
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
  ticketId,
  pageNumber = 1,
  limit = 40
}: Request): Promise<Response> => {
  const page = Math.max(1, Number(pageNumber));
  const offset = limit * (page - 1);

  const cleanSearch = (search || "").trim().toLowerCase();
  const searchTerms = getSearchTerms(search || "");
  const hasPhoneSearch = cleanSearch.replace(/\D/g, "").length >= 2;

  let ticketWhere: any = {
    whatsappId: Number(whatsappId),
    id: {
      [Op.in]: Sequelize.literal(`(SELECT MAX(id) FROM Tickets WHERE whatsappId = ${Number(whatsappId)} GROUP BY contactId)`)
    }
  };

  const contactOrConditions: any[] = [];
  if (cleanSearch) {
    const searchPatterns = searchTerms.length > 0 ? searchTerms : [cleanSearch];
    const termGroups = searchPatterns.map((term) => ({
      [Op.or]: [
        where(fn("LOWER", col("contact.name")), "LIKE", `%${term}%`),
        where(fn("LOWER", col("lastMessage")), "LIKE", `%${term}%`),
        { "$contact.lid$": { [Op.like]: `%${term}%` } },
      ],
    }));

    contactOrConditions.push({ [Op.and]: termGroups });

    if (hasPhoneSearch) {
      const phoneVariants = getPhoneSearchVariants(search);
      if (phoneVariants.length > 0) {
        contactOrConditions.push({
          [Op.or]: phoneVariants.reduce((conditions: any[], variant: string) => conditions.concat([
            { "$contact.number$": { [Op.like]: `%${variant}%` } },
            { "$contact.lid$": { [Op.like]: `%${variant}%` } },
          ]), []),
        });
      }
    }

    ticketWhere = {
      ...ticketWhere,
      [Op.or]: contactOrConditions
    };
  }

  const result = await Ticket.findAndCountAll({
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

  let tickets = result.rows;
  let count = result.count;

  if (ticketId) {
    const target = await Ticket.findOne({
      where: { id: Number(ticketId), whatsappId: Number(whatsappId) },
      include: [{ model: Contact, as: "contact", required: true }],
    });
    if (target && !tickets.some((ticket) => String(ticket.id) === String(target.id))) {
      tickets = [target, ...tickets];
    }
  }

  const ticketIds = tickets.map((t) => t.id);
  const msgStatsMap = new Map<number, { total: number; deleted: number }>();

  if (ticketIds.length > 0) {
    const [stats]: any = await sequelize.query(`
      SELECT 
        ticketId,
        count(*) as totalMessages,
        sum(case when isDeleted = 1 then 1 else 0 end) as deletedMessages
      FROM Messages
      WHERE ticketId IN (${ticketIds.join(",")})
      GROUP BY ticketId;
    `);

    if (Array.isArray(stats)) {
      for (const s of stats) {
        msgStatsMap.set(Number(s.ticketId), {
          total: Number(s.totalMessages) || 0,
          deleted: Number(s.deletedMessages) || 0
        });
      }
    }
  }

  const chats: AuditChatResponse[] = tickets.map((ticket) => {
    const stats = msgStatsMap.get(ticket.id) || { total: 0, deleted: 0 };
    return {
      ticketId: ticket.id,
      whatsappId: ticket.whatsappId,
      contact: ticket.contact,
      lastMessage: ticket.lastMessage || "",
      unreadMessages: ticket.unreadMessages || 0,
      totalMessages: stats.total,
      deletedMessages: stats.deleted,
      updatedAt: ticket.updatedAt,
      createdAt: ticket.createdAt
    };
  });

  // Resolução de LID em background sem travar o retorno das conversas
  setImmediate(() => {
    (async () => {
      for (const chat of chats) {
        if (!chat.contact?.isGroup && chat.contact) {
          const cleanNum = (chat.contact.number || "").replace(/\D/g, "");
          if (cleanNum.length >= 14) {
            try {
              const { getSession } = require("../../providers/WhatsApp/Implementations/whaileys");
              const { resolveLidToPhoneNumber, resolveAndAutoMerge } = require("../WbotServices/LidResolutionService");
              const wbot = getSession(chat.whatsappId);
              const lid = chat.contact.lid || `${cleanNum}@lid`;
              const resolved = await resolveLidToPhoneNumber(lid, wbot);
              if (resolved) {
                await resolveAndAutoMerge(lid, resolved);
              }
            } catch {
              /* ignore */
            }
          }
        }
      }
    })().catch(() => {});
  });

  const hasMore = count > offset + result.rows.length;

  return {
    chats,
    count,
    hasMore
  };
};

export default ListAuditChatsService;
