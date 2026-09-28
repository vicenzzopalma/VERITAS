import { Op, fn, where, col } from "sequelize";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import Message from "../../models/Message";
import { getPhoneSearchVariants } from "../../helpers/phoneSearchHelper";
import { getSearchTerms } from "../../helpers/searchTermHelper";
import {
  getWhatsappAccessWhere,
  WhatsappAccessUser
} from "../WhatsappService/WhatsappAccessPolicy";

interface Request {
  search: string;
  limit?: number;
  user?: WhatsappAccessUser;
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
  limit = 50,
  user
}: Request): Promise<GlobalSearchResult[]> => {
  const cleanSearch = (search || "").trim().toLowerCase();

  if (!cleanSearch) {
    return [];
  }

  const whatsappWhere = getWhatsappAccessWhere(user);
  let allowedWhatsappIds: number[] | null = null;
  if (whatsappWhere) {
    const allowedWhats = await Whatsapp.findAll({
      where: whatsappWhere,
      attributes: ["id"]
    });
    allowedWhatsappIds = allowedWhats.map((w) => w.id);
    if (allowedWhatsappIds.length === 0) {
      return [];
    }
  }

  const searchTerms = getSearchTerms(search);
  const isShortDigits = /^\d{1,5}$/.test(cleanSearch);

  const orConditions: any[] = [];
  const messageConditions = searchTerms.map((term) => ({
    body: { [Op.like]: `%${term}%` }
  }));

  const matchingMessages = messageConditions.length > 0
    ? await Message.findAll({
        where: { [Op.or]: messageConditions },
        attributes: ["ticketId"],
        include: allowedWhatsappIds
          ? [
              {
                model: Ticket,
                as: "ticket",
                where: { whatsappId: { [Op.in]: allowedWhatsappIds } },
                attributes: []
              }
            ]
          : undefined,
        raw: true
      })
    : [];

  const matchingTicketIds = Array.from(
    new Set(
      matchingMessages
        .map((message: { ticketId?: number }) => Number(message.ticketId))
        .filter((ticketId) => Number.isFinite(ticketId))
    )
  );

  if (searchTerms.length > 0) {
    for (const term of searchTerms) {
      orConditions.push({
        [Op.and]: [
          where(fn("LOWER", col("contact.name")), "LIKE", `%${term}%`),
          where(fn("LENGTH", col("contact.name")), { [Op.lte]: 13 })
        ]
      });

      orConditions.push(where(fn("LOWER", col("whatsapp.name")), "LIKE", `%${term}%`));

      if (!isShortDigits) {
        orConditions.push(
          where(fn("LOWER", col("lastMessage")), "LIKE", `%${term}%`)
        );
      }
    }
  } else {
    orConditions.push({
      [Op.and]: [
        where(fn("LOWER", col("contact.name")), "LIKE", `%${cleanSearch}%`),
        where(fn("LENGTH", col("contact.name")), { [Op.lte]: 13 })
      ]
    });
    orConditions.push(where(fn("LOWER", col("whatsapp.name")), "LIKE", `%${cleanSearch}%`));

    if (!isShortDigits) {
      orConditions.push(
        where(fn("LOWER", col("lastMessage")), "LIKE", `%${cleanSearch}%`)
      );
    }
  }

  const phoneVariants = getPhoneSearchVariants(search);
  for (const variant of phoneVariants) {
    orConditions.push({
      [Op.and]: [
        { "$contact.number$": { [Op.like]: `%${variant}%` } },
        where(fn("LENGTH", col("contact.number")), { [Op.lte]: 13 })
      ]
    });
  }

  if (matchingTicketIds.length > 0) {
    orConditions.push({ id: { [Op.in]: matchingTicketIds } });
  }

  const ticketWhere: any = {
    [Op.or]: orConditions
  };
  if (allowedWhatsappIds) {
    ticketWhere.whatsappId = { [Op.in]: allowedWhatsappIds };
  }

  const tickets = await Ticket.findAll({
    where: ticketWhere,
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
      },
    ],
    distinct: true,
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
