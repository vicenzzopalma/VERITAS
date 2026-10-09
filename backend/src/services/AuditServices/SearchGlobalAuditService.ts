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
  const hasPhoneSearch = cleanSearch.replace(/\D/g, "").length >= 2;

  let matchingTicketIds: number[] = [];
  for (const term of searchTerms) {
    const matchingMessages = await Message.findAll({
      where: { body: { [Op.like]: `%${term}%` } },
      attributes: ["ticketId"],
      include: allowedWhatsappIds
        ? [{
            model: Ticket,
            as: "ticket",
            where: { whatsappId: { [Op.in]: allowedWhatsappIds } },
            attributes: []
          }]
        : undefined,
      raw: true
    });

    const idsForTerm = new Set(
      matchingMessages
        .map((message: { ticketId?: number }) => Number(message.ticketId))
        .filter((ticketId) => Number.isFinite(ticketId))
    );

    if (matchingTicketIds.length === 0 && searchTerms.indexOf(term) === 0) {
      matchingTicketIds = Array.from(idsForTerm);
    } else {
      matchingTicketIds = matchingTicketIds.filter((ticketId) => idsForTerm.has(ticketId));
    }
  }

  const termGroups = (searchTerms.length > 0 ? searchTerms : [cleanSearch]).map((term) => ({
    [Op.or]: [
      where(fn("LOWER", col("contact.name")), "LIKE", `%${term}%`),
      where(fn("LOWER", col("whatsapp.name")), "LIKE", `%${term}%`),
      { "$contact.lid$": { [Op.like]: `%${term}%` } },
      ...(!isShortDigits
        ? [where(fn("LOWER", col("lastMessage")), "LIKE", `%${term}%`)]
        : []),
    ],
  }));

  const allSearchMatches: any[] = [{ [Op.and]: termGroups }];

  const phoneVariants = hasPhoneSearch ? getPhoneSearchVariants(search) : [];
  if (phoneVariants.length > 0) {
    allSearchMatches.push({
      [Op.or]: phoneVariants.reduce((conditions: any[], variant: string) => conditions.concat([
        { "$contact.number$": { [Op.like]: `%${variant}%` } },
        { "$contact.lid$": { [Op.like]: `%${variant}%` } },
      ]), []),
    });
  }

  if (matchingTicketIds.length > 0) {
    allSearchMatches.push({ id: { [Op.in]: matchingTicketIds } });
  }

  const ticketWhere: any = {
    [Op.or]: allSearchMatches
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
