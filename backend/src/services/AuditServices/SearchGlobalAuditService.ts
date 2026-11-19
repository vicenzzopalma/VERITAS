import { Op } from "sequelize";
import sequelize from "../../database";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import Message from "../../models/Message";
import { getPhoneSearchVariants } from "../../helpers/phoneSearchHelper";
import {
  foldedContainsAll,
  getSearchTerms,
  normalizeSearchText
} from "../../helpers/searchTermHelper";
import {
  getWhatsappAccessWhere,
  WhatsappAccessUser
} from "../WhatsappService/WhatsappAccessPolicy";

export type GlobalSearchMode = "contact" | "message";

interface Request {
  search: string;
  mode?: GlobalSearchMode;
  whatsappId?: number | string;
  limit?: number;
  user?: WhatsappAccessUser;
}

export interface GlobalSearchResult {
  type: "contact";
  /** "contact" = nome/número do contato bateu; "device" = nome do celular bateu */
  matchedBy: "contact" | "device";
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

export interface GlobalMessageSearchResult {
  type: "message";
  messageId: string;
  ticketId: number;
  whatsappId: number;
  deviceName: string;
  deviceStatus: string;
  contact: Contact;
  body: string;
  fromMe: boolean;
  isDeleted: boolean;
  createdAt: Date;
}

/** Restringe aos aparelhos que o usuário pode ver (e ao aparelho pedido, se houver). */
const resolveWhatsappScope = async (
  user: WhatsappAccessUser | undefined,
  whatsappId?: number | string
): Promise<number[] | null | "none"> => {
  let allowed: number[] | null = null;
  const accessWhere = getWhatsappAccessWhere(user);
  if (accessWhere) {
    const rows = await Whatsapp.findAll({ where: accessWhere, attributes: ["id"] });
    allowed = rows.map((w) => w.id);
  }

  if (whatsappId !== undefined && whatsappId !== null && String(whatsappId) !== "") {
    const id = Number(whatsappId);
    if (!Number.isFinite(id)) return "none";
    if (allowed && !allowed.includes(id)) return "none";
    return [id];
  }

  if (allowed && allowed.length === 0) return "none";
  return allowed;
};

const getMessageStats = async (
  ticketIds: number[]
): Promise<Map<number, { total: number; deleted: number }>> => {
  const stats = new Map<number, { total: number; deleted: number }>();
  if (ticketIds.length === 0) return stats;
  const [rows]: any = await sequelize.query(
    `SELECT ticketId, COUNT(*) AS total, SUM(CASE WHEN isDeleted = 1 THEN 1 ELSE 0 END) AS deleted
       FROM Messages WHERE ticketId IN (${ticketIds.map(Number).join(",")})
       GROUP BY ticketId`
  );
  for (const row of rows || []) {
    stats.set(Number(row.ticketId), {
      total: Number(row.total) || 0,
      deleted: Number(row.deleted) || 0
    });
  }
  return stats;
};

const toContactResults = async (
  tickets: Ticket[],
  matchedBy: "contact" | "device"
): Promise<GlobalSearchResult[]> => {
  const stats = await getMessageStats(tickets.map((t) => t.id));
  return tickets.map((ticket) => {
    const s = stats.get(ticket.id) || { total: 0, deleted: 0 };
    return {
      type: "contact" as const,
      matchedBy,
      ticketId: ticket.id,
      whatsappId: ticket.whatsappId,
      deviceName: ticket.whatsapp?.name || `Celular #${ticket.whatsappId}`,
      deviceStatus: ticket.whatsapp?.status || "DISCONNECTED",
      contact: ticket.contact,
      lastMessage: ticket.lastMessage || "",
      totalMessages: s.total,
      deletedMessages: s.deleted,
      updatedAt: ticket.updatedAt
    };
  });
};

/** Mantém só o ticket mais recente de cada contato em cada celular. */
const uniquePerDeviceContact = (tickets: Ticket[], skip = new Set<string>()): Ticket[] => {
  const seen = new Set<string>(skip);
  return tickets.filter((ticket) => {
    const key = `${ticket.whatsappId}-${ticket.contactId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const searchContacts = async (
  search: string,
  scope: number[] | null,
  limit: number
): Promise<GlobalSearchResult[]> => {
  const terms = getSearchTerms(search);
  const digits = search.replace(/\D/g, "");

  // 1) Contatos cujo nome ou número bate
  const orConditions: any[] = [];
  if (terms.length > 0) {
    // Nome precisa conter TODAS as palavras, sem ligar para acento/caixa
    orConditions.push(foldedContainsAll("`contact`.`name`", terms));
  }
  if (digits.length >= 3) {
    const variants = getPhoneSearchVariants(search).filter((v) => /^\d+$/.test(v));
    for (const variant of variants) {
      orConditions.push({ "$contact.number$": { [Op.like]: `%${variant}%` } });
    }
  }

  let contactMatches: Ticket[] = [];
  if (orConditions.length > 0) {
    const ticketWhere: any = { [Op.or]: orConditions };
    if (scope) ticketWhere.whatsappId = { [Op.in]: scope };
    const tickets = await Ticket.findAll({
      where: ticketWhere,
      include: [
        { model: Contact, as: "contact", required: true },
        { model: Whatsapp, as: "whatsapp", attributes: ["id", "name", "status"] }
      ],
      // Busca folgada para depois agrupar 1 linha por contato+aparelho
      limit: Math.max(limit * 6, 200),
      order: [["updatedAt", "DESC"]]
    });
    contactMatches = uniquePerDeviceContact(tickets).slice(0, limit);
  }

  // 2) Celulares cujo nome bate (ex.: "vicenzzo" ou "1722" em "VICENZZO 1722"):
  //    lista os números que conversaram com esse celular
  let deviceMatches: Ticket[] = [];
  if (terms.length > 0) {
    const devices = await Whatsapp.findAll({
      where: scope ? { id: { [Op.in]: scope } } : undefined,
      attributes: ["id", "name"]
    });
    const matchedDeviceIds = devices
      .filter((d) => {
        const name = normalizeSearchText(d.name || "");
        return terms.every((term) => name.includes(term));
      })
      .map((d) => d.id);

    if (matchedDeviceIds.length > 0) {
      const tickets = await Ticket.findAll({
        where: { whatsappId: { [Op.in]: matchedDeviceIds } },
        include: [
          { model: Contact, as: "contact", required: true },
          { model: Whatsapp, as: "whatsapp", attributes: ["id", "name", "status"] }
        ],
        limit: 1500,
        order: [["updatedAt", "DESC"]]
      });
      const already = new Set(contactMatches.map((t) => `${t.whatsappId}-${t.contactId}`));
      deviceMatches = uniquePerDeviceContact(tickets, already).slice(0, 150);
    }
  }

  return [
    ...(await toContactResults(contactMatches, "contact")),
    ...(await toContactResults(deviceMatches, "device"))
  ];
};

const searchMessages = async (
  search: string,
  scope: number[] | null,
  limit: number
): Promise<GlobalMessageSearchResult[]> => {
  const terms = getSearchTerms(search);
  if (terms.length === 0) return [];

  const messages = await Message.findAll({
    // Mensagem precisa conter TODAS as palavras, sem ligar para acento/caixa
    where: foldedContainsAll("`Message`.`body`", terms),
    attributes: ["id", "ticketId", "body", "fromMe", "isDeleted", "createdAt"],
    include: [
      {
        model: Ticket,
        as: "ticket",
        required: true,
        where: scope ? { whatsappId: { [Op.in]: scope } } : undefined,
        attributes: ["id", "whatsappId", "contactId"],
        include: [
          { model: Contact, as: "contact" },
          { model: Whatsapp, as: "whatsapp", attributes: ["id", "name", "status"] }
        ]
      }
    ],
    limit,
    order: [["createdAt", "DESC"]]
  });

  return messages.map((message) => {
    const { ticket } = message;
    return {
      type: "message" as const,
      messageId: message.id,
      ticketId: message.ticketId,
      whatsappId: ticket.whatsappId,
      deviceName: ticket.whatsapp?.name || `Celular #${ticket.whatsappId}`,
      deviceStatus: ticket.whatsapp?.status || "DISCONNECTED",
      contact: ticket.contact,
      body: message.body || "",
      fromMe: Boolean(message.fromMe),
      isDeleted: Boolean(message.isDeleted),
      createdAt: message.createdAt
    };
  });
};

const SearchGlobalAuditService = async ({
  search = "",
  mode = "contact",
  whatsappId,
  limit = 30,
  user
}: Request): Promise<Array<GlobalSearchResult | GlobalMessageSearchResult>> => {
  const cleanSearch = (search || "").trim();
  if (!cleanSearch) return [];

  const scope = await resolveWhatsappScope(user, whatsappId);
  if (scope === "none") return [];

  const safeLimit = Math.min(Math.max(1, Number(limit) || 30), 200);

  if (mode === "message") {
    return searchMessages(cleanSearch, scope, safeLimit);
  }
  return searchContacts(cleanSearch, scope, safeLimit);
};

export default SearchGlobalAuditService;
