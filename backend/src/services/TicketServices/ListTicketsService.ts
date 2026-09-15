import { Op, fn, where, col, Filterable, Includeable } from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import User from "../../models/User";
import ShowUserService from "../UserServices/ShowUserService";
import Whatsapp from "../../models/Whatsapp";
import { getPhoneSearchVariants } from "../../helpers/phoneSearchHelper";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  showAll?: string;
  userId: string;
  withUnreadMessages?: string;
  queueIds: number[];
}

interface Response {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

const ListTicketsService = async ({
  searchParam = "",
  pageNumber = "1",
  queueIds,
  status,
  date,
  showAll,
  userId,
  withUnreadMessages
}: Request): Promise<Response> => {
  const user = await User.findByPk(userId);
  const isOperator = user?.profile === "operator" || Boolean(user?.whatsappId && user?.profile !== "admin");

  let whereCondition: Filterable["where"];

  if (isOperator) {
    whereCondition = {
      whatsappId: user?.whatsappId || -1
    };
  } else {
    whereCondition = {
      [Op.or]: [{ userId }, { status: "pending" }],
      queueId: { [Op.or]: [queueIds, null] }
    };

    if (showAll === "true") {
      whereCondition = { queueId: { [Op.or]: [queueIds, null] } };
    }
  }

  let includeCondition: Includeable[];

  includeCondition = [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "profilePicUrl"]
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
  ];

  if (status) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }


  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();
    const cleanNumbersOnly = searchParam.replace(/\D/g, "");

    includeCondition = [
      ...includeCondition,
      {
        model: Message,
        as: "messages",
        attributes: ["id", "body"],
        where: {
          body: where(
            fn("LOWER", col("messages.body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        required: false,
        duplicating: false
      }
    ];

    const orMatches: any[] = [
      {
        "$contact.name$": where(
          fn("LOWER", col("contact.name")),
          "LIKE",
          `%${sanitizedSearchParam}%`
        )
      },
      {
        lastMessage: where(
          fn("LOWER", col("lastMessage")),
          "LIKE",
          `%${sanitizedSearchParam}%`
        )
      }
    ];

    const phoneVariants = getPhoneSearchVariants(searchParam);
    for (const variant of phoneVariants) {
      orMatches.push({ "$contact.number$": { [Op.like]: `%${variant}%` } });
      orMatches.push({ "$contact.lid$": { [Op.like]: `%${variant}%` } });
    }

    if (/^\d+$/.test(sanitizedSearchParam)) {
      orMatches.push({ id: +sanitizedSearchParam });
    }

    whereCondition = {
      ...whereCondition,
      [Op.or]: orMatches
    };
  }

  if (date) {
    whereCondition = {
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    };
  }

  if (withUnreadMessages === "true") {
    if (isOperator) {
      whereCondition = {
        ...whereCondition,
        unreadMessages: { [Op.gt]: 0 }
      };
    } else {
      const userWithQueues = await ShowUserService(userId);
      const userQueueIds = (userWithQueues.queues || []).map((queue: any) => queue.id);

      whereCondition = {
        [Op.or]: [{ userId }, { status: "pending" }],
        ...(userQueueIds.length > 0
          ? { queueId: { [Op.or]: [userQueueIds, null] } }
          : {}),
        unreadMessages: { [Op.gt]: 0 }
      };
    }
  }

  const limit = 40;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    distinct: true,
    limit,
    offset,
    order: [["updatedAt", "DESC"]]
  });

  const hasMore = count > offset + tickets.length;

  // Resolução ativa sob demanda de contatos com LID via USync
  for (const ticket of tickets) {
    if (!ticket.isGroup && ticket.contact) {
      const cleanNum = (ticket.contact.number || "").replace(/\D/g, "");
      if (cleanNum.length >= 14) {
        try {
          const { getSession } = require("../../providers/WhatsApp/Implementations/whaileys");
          const { resolveLidToPhoneNumber, resolveAndAutoMerge } = require("../WbotServices/LidResolutionService");
          const wbot = getSession(ticket.whatsappId);
          const lid = ticket.contact.lid || `${cleanNum}@lid`;
          const resolved = await resolveLidToPhoneNumber(lid, wbot);
          if (resolved) {
            await resolveAndAutoMerge(lid, resolved);
            ticket.contact.number = resolved;
            ticket.contact.name = resolved;
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  return {
    tickets,
    count,
    hasMore
  };
};

export default ListTicketsService;
