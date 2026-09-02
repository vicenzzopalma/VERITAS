import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import LidMapping from "../../models/LidMapping";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

// In-memory cache de resolução ultra-rápida (LID -> Phone)
const lidPhoneCache = new Map<string, string>();
const phoneLidCache = new Map<string, string>();

export const extractCleanLid = (val?: string): string => {
  if (!val) return "";
  const beforeAt = val.split("@")[0].split(":")[0];
  const digits = beforeAt.replace(/\D/g, "");
  return digits.length >= 14 ? digits : "";
};

export const extractCleanPhone = (val?: string): string => {
  if (!val) return "";
  const beforeAt = val.split("@")[0].split(":")[0];
  const digits = beforeAt.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13 ? digits : "";
};

export const saveLidMapping = async (
  rawLid: string,
  rawPhone: string,
  whatsappId?: number,
  name?: string
): Promise<void> => {
  const cleanLid = extractCleanLid(rawLid);
  const cleanPhone = extractCleanPhone(rawPhone);

  if (!cleanLid || !cleanPhone || cleanLid === cleanPhone) return;

  lidPhoneCache.set(cleanLid, cleanPhone);
  phoneLidCache.set(cleanPhone, cleanLid);

  try {
    await LidMapping.upsert({
      lid: cleanLid,
      phoneNumber: cleanPhone,
      whatsappId: whatsappId || 0,
      name: name || ""
    });
  } catch (err) {
    logger.debug({ info: "Error saving LidMapping in DB", cleanLid, cleanPhone, err });
  }
};

/**
 * Consulta ativa via USync Interactive Query (Stanza XMPP)
 * Bypassa a privacidade do LID requisitando o nó <contact> oficial no servidor do WhatsApp
 */
export const isSocketReady = (s: any): boolean => {
  return Boolean(s && (s.user || s.ws?.readyState === 1));
};

export const queryUsyncLidToPhone = async (
  cleanLid: string,
  wbot: any
): Promise<string | null> => {
  if (!wbot || !wbot.query || !isSocketReady(wbot)) return null;

  try {
    const lidJid = `${cleanLid}@lid`;
    const generateTag = typeof wbot.generateMessageTag === "function"
      ? wbot.generateMessageTag()
      : `usync_${Date.now()}`;

    const result = await wbot.query({
      tag: "iq",
      attrs: {
        to: "s.whatsapp.net",
        type: "get",
        xmlns: "usync"
      },
      content: [
        {
          tag: "usync",
          attrs: {
            sid: generateTag,
            mode: "query",
            last: "true",
            index: "0",
            context: "interactive"
          },
          content: [
            {
              tag: "query",
              attrs: {},
              content: [
                { tag: "contact", attrs: {} },
                { tag: "lid", attrs: {} }
              ]
            },
            {
              tag: "list",
              attrs: {},
              content: [
                {
                  tag: "user",
                  attrs: { jid: lidJid }
                }
              ]
            }
          ]
        }
      ]
    });

    if (result) {
      // Parser recursivo da resposta XML binária do WhatsApp
      const findNode = (node: any, tag: string): any => {
        if (!node) return null;
        if (node.tag === tag) return node;
        if (Array.isArray(node.content)) {
          for (const child of node.content) {
            const found = findNode(child, tag);
            if (found) return found;
          }
        }
        return null;
      };

      const userNode = findNode(result, "user");
      if (userNode) {
        // 1. Tenta pegar do atributo jid ou phone do user
        const userJid = userNode.attrs?.jid || userNode.attrs?.phone || "";
        const cleanFromUser = extractCleanPhone(userJid);
        if (cleanFromUser) return cleanFromUser;

        // 2. Tenta pegar do nó filho <contact>
        const contactNode = findNode(userNode, "contact");
        if (contactNode) {
          let textVal = "";
          if (typeof contactNode.content === "string") {
            textVal = contactNode.content;
          } else if (Buffer.isBuffer(contactNode.content)) {
            textVal = contactNode.content.toString();
          } else if (contactNode.attrs?.jid) {
            textVal = contactNode.attrs.jid;
          } else if (contactNode.attrs?.phone) {
            textVal = contactNode.attrs.phone;
          }

          const cleanFromContact = extractCleanPhone(textVal);
          if (cleanFromContact) return cleanFromContact;
        }
      }
    }

    // Fallback: tentar onWhatsApp
    if (typeof wbot.onWhatsApp === "function") {
      try {
        const [onWa] = await wbot.onWhatsApp(lidJid);
        if (onWa && onWa.jid) {
          const cleanOnWa = extractCleanPhone(onWa.jid);
          if (cleanOnWa) return cleanOnWa;
        }
      } catch {
        /* ignore */
      }
    }
  } catch (err: any) {
    logger.debug({ info: "USync query failed or unresolvable for LID", cleanLid, error: err.message });
  }

  return null;
};

/**
 * Resolução com 5 camadas hierárquicas (Arquitetura Digisac):
 * 1. Cache RAM (O(1))
 * 2. Tabela LidMapping no SQLite
 * 3. Base de Contatos já cadastrados no SQLite
 * 4. Catálogo de Contatos em RAM sincronizado pelo celular (wbot.store.contacts)
 * 5. Query Ativa USync via WebSocket ao servidor do WhatsApp
 */
export const resolveLidToPhoneNumber = async (
  rawLid?: string,
  wbot?: any
): Promise<string | null> => {
  const cleanLid = extractCleanLid(rawLid);
  if (!cleanLid) return null;

  // 1. Cache de Memória
  const cached = lidPhoneCache.get(cleanLid);
  if (cached) return cached;

  // 2. Tabela de Mapeamento Persistente LidMapping
  try {
    const mapping = await LidMapping.findByPk(cleanLid);
    if (mapping && mapping.phoneNumber) {
      const cleanPhone = extractCleanPhone(mapping.phoneNumber);
      if (cleanPhone) {
        lidPhoneCache.set(cleanLid, cleanPhone);
        return cleanPhone;
      }
    }
  } catch {
    /* ignore */
  }

  // 3. Busca em Contacts (registro que tenha o LID e um número válido de 10-13 dígitos)
  try {
    const dbContact = await Contact.findOne({
      where: {
        lid: { [Op.like]: `${cleanLid}%` },
        number: {
          [Op.ne]: cleanLid
        }
      }
    });

    if (dbContact && dbContact.number) {
      const clean = extractCleanPhone(dbContact.number);
      if (clean) {
        await saveLidMapping(cleanLid, clean, 0, dbContact.name);
        return clean;
      }
    }
  } catch {
    /* ignore */
  }

  // 4. Busca Reversa no store.contacts do Baileys
  if (wbot?.store?.contacts) {
    try {
      const lidJid = `${cleanLid}@lid`;
      const allContacts = Object.values(wbot.store.contacts) as any[];
      const found = allContacts.find(
        c =>
          c?.lid === lidJid ||
          c?.lid === cleanLid ||
          c?.id === lidJid ||
          (c?.lid && extractCleanLid(c.lid) === cleanLid)
      );

      if (found) {
        const candidatePn =
          extractCleanPhone(found.id) ||
          extractCleanPhone(found.phoneNumber) ||
          extractCleanPhone(found.pn);

        if (candidatePn) {
          await saveLidMapping(cleanLid, candidatePn, wbot.id, found.name || found.notify);
          return candidatePn;
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 5. Query Ativa USync via WhatsApp WebSocket
  let activeWbot = wbot;
  if (!isSocketReady(activeWbot)) {
    try {
      const { getAllSessions } = require("../../providers/WhatsApp/Implementations/whaileys");
      const sessionsMap = getAllSessions();
      for (const [id, s] of sessionsMap.entries()) {
        if (isSocketReady(s)) {
          activeWbot = s;
          break;
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (activeWbot) {
    const usyncPhone = await queryUsyncLidToPhone(cleanLid, activeWbot);
    if (usyncPhone) {
      await saveLidMapping(cleanLid, usyncPhone, activeWbot.id);
      return usyncPhone;
    }
  }

  return null;
};

/**
 * Auto-merge e desduplicação imediata de contatos com LID
 */
export const resolveAndAutoMerge = async (
  rawLid: string,
  rawPhone: string
): Promise<Contact | null> => {
  const cleanLid = extractCleanLid(rawLid);
  const cleanPhone = extractCleanPhone(rawPhone);

  if (!cleanLid || !cleanPhone) return null;

  await saveLidMapping(cleanLid, cleanPhone);

  // Procura contato que ficou registrado erroneamente com o LID no campo number
  const corruptedContact = await Contact.findOne({
    where: {
      number: cleanLid,
      isGroup: false
    }
  });

  // Procura contato com o número de telefone real
  const realContact = await Contact.findOne({
    where: {
      number: cleanPhone,
      isGroup: false
    }
  });

  if (corruptedContact && realContact && corruptedContact.id !== realContact.id) {
    logger.info({
      info: "[Auto-Merge] Fundindo contato com LID para contato com telefone real",
      corruptedId: corruptedContact.id,
      realId: realContact.id,
      cleanLid,
      cleanPhone
    });

    // Migra Tickets
    await Ticket.update(
      { contactId: realContact.id },
      { where: { contactId: corruptedContact.id } }
    );

    // Migra Mensagens
    await Message.update(
      { contactId: realContact.id },
      { where: { contactId: corruptedContact.id } }
    );

    // Atualiza LID no contato real
    await realContact.update({
      lid: `${cleanLid}@lid`
    });

    // Remove contato corrompido duplicado
    await corruptedContact.destroy();

    try {
      getIO().emit("contact", { action: "update", contact: realContact });
    } catch {
      /* ignore */
    }

    return realContact;
  }

  if (corruptedContact && !realContact) {
    logger.info({
      info: "[Auto-Repair] Corrigindo número no contato existente de LID",
      contactId: corruptedContact.id,
      oldNumber: cleanLid,
      newNumber: cleanPhone
    });

    await corruptedContact.update({
      number: cleanPhone,
      lid: `${cleanLid}@lid`
    });

    try {
      getIO().emit("contact", { action: "update", contact: corruptedContact });
    } catch {
      /* ignore */
    }

    return corruptedContact;
  }

  return realContact;
};

/**
 * Resolução assíncrona em segundo plano de tickets com LID via USync
 */
export const resolvePendingLidTickets = async (wbot: any): Promise<number> => {
  if (!wbot || !wbot.id) return 0;
  let resolvedCount = 0;
  try {
    const pendingTickets = await Ticket.findAll({
      where: {
        whatsappId: wbot.id
      },
      include: [
        {
          model: Contact,
          as: "contact",
          where: {
            isGroup: false
          }
        }
      ],
      limit: 60
    });

    for (const t of pendingTickets) {
      const currentNumber = (t.contact?.number || "").replace(/\D/g, "");
      if (currentNumber.length >= 14) {
        const lid = t.contact.lid || `${currentNumber}@lid`;
        const resolved = await resolveLidToPhoneNumber(lid, wbot);
        if (resolved) {
          await resolveAndAutoMerge(lid, resolved);
          resolvedCount++;
          logger.info(`[LidWorker] Ticket #${t.id} resolvido de LID ${lid} -> Telefone ${resolved}`);
        }
        await new Promise(r => setTimeout(r, 200));
      }
    }
  } catch (err: any) {
    logger.debug({ info: "Error in resolvePendingLidTickets", error: err.message });
  }
  return resolvedCount;
};

