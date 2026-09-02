import { readFileSync } from "fs";

import pino from "pino";
import makeWASocket, {
  UserFacingSocketConfig,
  DisconnectReason,
  WASocket,
  AuthenticationCreds,
  initAuthCreds,
  isJidUser,
  isLidUser,
  isJidGroup,
  isJidBroadcast,
  makeCacheableSignalKeyStore,
  BufferJSON,
  WAMessage,
  WAMessageKey,
  downloadMediaMessage,
  getContentType,
  jidNormalizedUser,
  jidDecode,
  makeInMemoryStore,
  SignalDataSet,
  AnyMessageContent,
  proto,
  Browsers,
  fetchLatestWaWebVersion,
  WAVersion,
  MessageRetryMap
} from "whaileys";
import { LRUCache } from "lru-cache";
import { Boom } from "@hapi/boom";
import { HttpsProxyAgent } from "https-proxy-agent";
import NodeCache from "node-cache";

import Whatsapp from "../../../models/Whatsapp";
import Contact from "../../../models/Contact";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import { Op } from "sequelize";
import CreateOrUpdateContactService from "../../../services/ContactServices/CreateOrUpdateContactService";
import { getIO } from "../../../libs/socket";
import { logger } from "../../../utils/logger";
import AppError from "../../../errors/AppError";
import StoreWppSessionKeys from "../../../services/WppKeyServices/StoreWppSessionKeys";
import GetWppSessionKeys from "../../../services/WppKeyServices/GetWppSessionKeys";
import { getRedisClient } from "../../../libs/redisStore";
import {
  SendMessageOptions,
  ProviderMessage,
  ProviderMediaInput,
  SendMediaOptions,
  ProviderContact,
  MessageType,
  MessageAck
} from "../types";
import { WhatsappProvider } from "../whatsappProvider";
import { sleep } from "../../../utils/sleep";
import {
  handleMessage,
  handleMessageAck,
  ContactPayload,
  MessagePayload,
  MediaPayload,
  WhatsappContextPayload
} from "../../../handlers/handleWhatsappEvents";
import {
  saveLidMapping,
  resolveLidToPhoneNumber,
  resolvePendingLidTickets
} from "../../../services/WbotServices/LidResolutionService";

type WALogger = NonNullable<Parameters<typeof makeInMemoryStore>[0]["logger"]>;

const whaileyLogger = pino({
  level: process.env.WHAILEYS_LOG_LEVEL || "silent"
}) as unknown as WALogger;

type Store = ReturnType<typeof makeInMemoryStore>;

interface Session extends WASocket {
  id: number;
  store?: Store;
}

const sessions = new Map<number, Session>();
const stores = new Map<number, Store>();

export const getSessionStatus = (whatsappId: number): string | undefined => {
  const session = sessions.get(whatsappId);
  if (!session) return undefined;
  if (session.user) return "CONNECTED";
  return undefined;
};

export const getSession = (whatsappId: number | string): Session | undefined => {
  return sessions.get(Number(whatsappId));
};

export const getAllSessions = (): Map<number, Session> => {
  return sessions;
};

const msgRetryCounterLRU = new LRUCache<string, number>({
  max: 5000,
  ttl: 600 * 1000,
  allowStale: false,
  updateAgeOnGet: true
});

const msgRetryCounterMap = new Proxy<MessageRetryMap>({} as MessageRetryMap, {
  get(target, prop) {
    if (typeof prop === "string") {
      return msgRetryCounterLRU.get(prop);
    }
    return Reflect.get(target, prop);
  },
  set(target, prop, value) {
    if (typeof prop === "string" && typeof value === "number") {
      msgRetryCounterLRU.set(prop, value);
      return true;
    }
    return Reflect.set(target, prop, value);
  },
  deleteProperty(target, prop) {
    if (typeof prop === "string") {
      msgRetryCounterLRU.delete(prop);
      return true;
    }
    return Reflect.deleteProperty(target, prop);
  },
  has(target, prop) {
    if (typeof prop === "string") {
      return msgRetryCounterLRU.has(prop);
    }
    return Reflect.has(target, prop);
  },
  ownKeys() {
    return Array.from(msgRetryCounterLRU.keys());
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop === "string" && msgRetryCounterLRU.has(prop)) {
      return {
        configurable: true,
        enumerable: true,
        value: msgRetryCounterLRU.get(prop)
      };
    }
    return undefined;
  }
});

const msgCacheLRU = new LRUCache<string, string>({
  max: 5000,
  ttl: 600 * 1000,
  allowStale: false,
  updateAgeOnGet: true
});

const sentMessagesCache = new NodeCache({
  stdTTL: 60,
  useClones: false
});

const normalizeJid = (jid: string): string => {
  if (!jid) return jid;
  if (!jid.includes("@")) return `${jid}@s.whatsapp.net`;
  return jid.replace(/@c\.us$/i, "@s.whatsapp.net");
};

const msgCache = {
  get: (key: WAMessageKey): proto.IMessage | undefined => {
    const { id } = key;
    if (!id) return undefined;
    const data = msgCacheLRU.get(id);
    if (data) {
      try {
        const msg = JSON.parse(data);
        return msg?.message;
      } catch {
        return undefined;
      }
    }
    return undefined;
  },
  save: (msg: WAMessage) => {
    const { id } = msg.key;
    if (!id) return;
    try {
      msgCacheLRU.set(id, JSON.stringify(msg));
    } catch (e) {
      logger.debug({ info: "Error caching message", messageId: id, err: e });
    }
  }
};

const clearSessionKeys = async (sessionId: number): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;

  try {
    const match = `wpp:${sessionId}:*`;

    const scanAndDelete = async (cursor: string): Promise<void> => {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        match,
        "COUNT",
        100
      );

      if (keys.length > 0) {
        await client.del(keys);
      }

      if (nextCursor !== "0") {
        await scanAndDelete(nextCursor);
      }
    };

    await scanAndDelete("0");

    logger.info({ info: "Cleared Redis session keys", sessionId });
  } catch (err) {
    logger.error({ info: "Error clearing Redis session keys", sessionId, err });
  }
};

const assertUnique = (sessionId: number) => {
  const wbot = sessions.get(sessionId);

  if (wbot) {
    wbot.ev.removeAllListeners("connection.update");
    sessions.delete(sessionId);
    stores.delete(sessionId);

    wbot.end(undefined);
  }
};

const saveSessionCreds = async (
  whatsapp: Whatsapp,
  creds: AuthenticationCreds
) => {
  try {
    await whatsapp.update({
      session: JSON.stringify(creds, BufferJSON.replacer),
      status: "CONNECTED",
      qrcode: ""
    });

    logger.debug({
      info: "Creds saved to database",
      whatsappId: whatsapp.id
    });
  } catch (err) {
    logger.error({
      info: "Error saving creds to database",
      whatsappId: whatsapp.id,
      err
    });
  }
};

const credsDebounceTimers = new Map<number, NodeJS.Timeout>();
const pendingCredsSaves = new Map<
  number,
  { whatsapp: Whatsapp; creds: AuthenticationCreds }
>();

const flushPendingCredsSave = async (sessionId: number): Promise<void> => {
  const existingTimer = credsDebounceTimers.get(sessionId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    credsDebounceTimers.delete(sessionId);
  }

  const pending = pendingCredsSaves.get(sessionId);
  if (pending) {
    pendingCredsSaves.delete(sessionId);
    await saveSessionCreds(pending.whatsapp, pending.creds);
  }
};

const debouncedSaveCreds = (
  whatsapp: Whatsapp,
  creds: AuthenticationCreds,
  delayMs = 1000
) => {
  const sessionId = whatsapp.id;

  const existingTimer = credsDebounceTimers.get(sessionId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  pendingCredsSaves.set(sessionId, { whatsapp, creds });

  const timer = setTimeout(() => {
    credsDebounceTimers.delete(sessionId);
    pendingCredsSaves.delete(sessionId);
    saveSessionCreds(whatsapp, creds);
  }, delayMs);

  credsDebounceTimers.set(sessionId, timer);
};

const useSessionAuthState = async (whatsapp: Whatsapp) => {
  const sessionId = whatsapp.id;

  const creds = whatsapp.session
    ? JSON.parse(whatsapp.session, BufferJSON.reviver)
    : initAuthCreds();

  return {
    state: {
      creds: creds as AuthenticationCreds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const deviceId = jidDecode(creds?.me?.id)?.device || 1;

          const data = await GetWppSessionKeys({
            connectionId: sessionId,
            deviceId,
            type,
            ids
          });

          return data;
        },
        set: async (data: SignalDataSet) => {
          const deviceId = jidDecode(creds?.me?.id)?.device || 1;

          try {
            const promises: Promise<void>[] = [];

            Object.entries(data).forEach(([category, categoryData]) => {
              if (!categoryData) return;
              Object.entries(categoryData).forEach(([id, value]) => {
                promises.push(
                  StoreWppSessionKeys({
                    connectionId: sessionId,
                    deviceId,
                    type: category,
                    id,
                    value
                  })
                );
              });
            });

            await Promise.all(promises);
          } catch (err) {
            logger.error({
              info: "Error setting keys",
              sessionId,
              err
            });
          }
        }
      }
    }
  };
};

const mapMessageType = (msg: WAMessage): MessageType => {
  const messageType = getContentType(msg.message || undefined);

  if (messageType === "audioMessage" && msg.message?.audioMessage?.ptt) {
    return "ptt";
  }

  const typeMap: Record<string, MessageType> = {
    conversation: "chat",
    extendedTextMessage: "chat",
    imageMessage: "image",
    videoMessage: "video",
    audioMessage: "audio",
    documentMessage: "document",
    stickerMessage: "sticker",
    locationMessage: "location",
    contactMessage: "vcard",
    contactsArrayMessage: "vcard"
  };

  return typeMap[messageType || ""] || "chat";
};

const getMessageBody = (msg: WAMessage): string => {
  try {
    const messageType = getContentType(msg.message || undefined);

    if (messageType === "conversation") {
      return msg.message?.conversation || "";
    }

    if (messageType === "extendedTextMessage") {
      return msg.message?.extendedTextMessage?.text || "";
    }

    if (messageType === "imageMessage") {
      return msg.message?.imageMessage?.caption || "";
    }

    if (messageType === "videoMessage") {
      return msg.message?.videoMessage?.caption || "";
    }

    if (messageType === "documentMessage") {
      return msg.message?.documentMessage?.caption || "";
    }

    if (messageType === "contactMessage") {
      return msg.message?.contactMessage?.vcard || "";
    }

    if (messageType === "contactsArrayMessage") {
      const contacts = msg.message?.contactsArrayMessage?.contacts || [];
      return contacts.map(c => c.vcard).join("\n");
    }

    if (messageType === "locationMessage") {
      const location = msg.message?.locationMessage;
      if (!location) return "";

      const gmapsUrl = `https://maps.google.com/maps?q=${location.degreesLatitude}%2C${location.degreesLongitude}&z=17&hl=pt-BR`;
      const description =
        location.name ||
        `${location.degreesLatitude}, ${location.degreesLongitude}`;

      return `${gmapsUrl}|${description}`;
    }

    return "";
  } catch (err) {
    logger.error({ info: "Error getting message body", err });
    return "";
  }
};

const getQuotedMessageId = (msg: WAMessage): string | undefined => {
  const quotedMessageId =
    msg.message?.extendedTextMessage?.contextInfo?.stanzaId ||
    msg.message?.imageMessage?.contextInfo?.stanzaId ||
    msg.message?.videoMessage?.contextInfo?.stanzaId ||
    msg.message?.documentMessage?.contextInfo?.stanzaId ||
    undefined;

  return quotedMessageId;
};

const hasMedia = (msg: WAMessage): boolean => {
  const messageType = getContentType(msg.message || undefined);
  return [
    "imageMessage",
    "videoMessage",
    "audioMessage",
    "documentMessage",
    "stickerMessage"
  ].includes(messageType || "");
};

const mapMessageAck = (status: number | null | undefined): MessageAck => {
  if (status === null || status === undefined) return 0;
  if (status >= 4) return 4;
  if (status >= 3) return 3;
  if (status >= 2) return 2;
  if (status >= 1) return 1;
  return 0;
};

const shouldHandleMessage = (msg: WAMessage): boolean => {
  const remoteJid = msg.key?.remoteJid || "";
  const participant = msg.key?.participant || "";

  // REGRA CRÍTICA: MENSAGENS DE GRUPOS E BROADCASTS NÃO DEVEM SER ARMAZENADAS NO CRM
  if (
    !remoteJid ||
    remoteJid.endsWith("@g.us") ||
    remoteJid.includes("@g.us") ||
    remoteJid === "status@broadcast" ||
    remoteJid.includes("@broadcast") ||
    participant.endsWith("@g.us") ||
    participant.includes("@g.us")
  ) {
    return false;
  }

  const messageType = getContentType(msg.message || undefined);
  const validTypes = [
    "conversation",
    "extendedTextMessage",
    "imageMessage",
    "videoMessage",
    "audioMessage",
    "documentMessage",
    "stickerMessage",
    "locationMessage",
    "contactMessage",
    "contactsArrayMessage"
  ];

  if (!validTypes.includes(messageType || "")) return false;

  const body = getMessageBody(msg);
  if (/\u200e/.test(body[0])) return false;

  if (!msg.key.fromMe) return true;

  const allowedFromMeTypes = [
    "locationMessage",
    "conversation",
    "extendedTextMessage",
    "contactMessage"
  ];

  return hasMedia(msg) || allowedFromMeTypes.includes(messageType || "");
};

const convertToMessagePayload = (msg: WAMessage): MessagePayload => {
  const fromJid = msg.key.remoteJid || "";
  const toJid = msg.key.fromMe ? fromJid : msg.key.participant || fromJid;
  const fromMe = msg.key.fromMe || false;

  return {
    id: msg.key.id || "",
    body: getMessageBody(msg),
    fromMe,
    hasMedia: hasMedia(msg),
    type: mapMessageType(msg),
    timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) : Date.now(),
    from: fromJid,
    to: toJid,
    hasQuotedMsg: Boolean(getQuotedMessageId(msg)),
    quotedMsgId: getQuotedMessageId(msg),
    ack: fromMe ? 1 : 0
  };
};

type ExtendedKey = WAMessageKey &
  Partial<{
    senderPn: string;
    sender_pn: string;
    participantPn: string;
    participant_pn: string;
    peerRecipientPn: string;
    peer_recipient_pn: string;
    senderLid: string;
    sender_lid: string;
    participantLid: string;
    participant_lid: string;
    recipientLid: string;
    recipient_lid: string;
  }>;

type ExtendedContext = proto.IContextInfo &
  Partial<{
    senderLid: string;
    sender_lid: string;
    participantLid: string;
    participant_lid: string;
    recipientLid: string;
    recipient_lid: string;
    senderPn: string;
    sender_pn: string;
    participantPn: string;
    participant_pn: string;
    peerRecipientPn: string;
    peer_recipient_pn: string;
  }>;

const convertToContactPayload = async (
  jid: string,
  msg: WAMessage,
  wbot: Session
): Promise<ContactPayload> => {
  const keyExt = (msg.key || {}) as ExtendedKey;
  const content = msg.message || {};
  const ctx = (content?.extendedTextMessage?.contextInfo ||
    content?.imageMessage?.contextInfo ||
    content?.videoMessage?.contextInfo ||
    content?.documentMessage?.contextInfo ||
    content?.audioMessage?.contextInfo ||
    content?.stickerMessage?.contextInfo ||
    undefined) as ExtendedContext | undefined;

  let resolvedJid = jid || "";

  const lidCandidates: (string | undefined)[] = [
    keyExt.senderLid,
    keyExt.participantLid,
    keyExt.recipientLid,
    ctx?.senderLid,
    ctx?.participantLid,
    ctx?.recipientLid,
    keyExt.sender_lid,
    keyExt.participant_lid,
    keyExt.recipient_lid,
    ctx?.sender_lid,
    ctx?.participant_lid,
    ctx?.recipient_lid,
    (keyExt.senderPn || keyExt.sender_pn)?.includes("@lid")
      ? keyExt.senderPn || keyExt.sender_pn
      : undefined,
    (keyExt.participantPn || keyExt.participant_pn)?.includes("@lid")
      ? keyExt.participantPn || keyExt.participant_pn
      : undefined,
    (keyExt.peerRecipientPn || keyExt.peer_recipient_pn)?.includes("@lid")
      ? keyExt.peerRecipientPn || keyExt.peer_recipient_pn
      : undefined
  ];

  const lid = lidCandidates.find(
    cand => typeof cand === "string" && cand.includes("@lid")
  );

  const kAny = keyExt as any;
  const cAny = ctx as any;

  const pnCandidates: (string | undefined)[] = [
    kAny?.senderPn || kAny?.sender_pn,
    kAny?.participantPn || kAny?.participant_pn,
    kAny?.recipientPn || kAny?.recipient_pn || kAny?.peerRecipientPn || kAny?.peer_recipient_pn,
    cAny?.senderPn || cAny?.sender_pn,
    cAny?.participantPn || cAny?.participant_pn,
    cAny?.recipientPn || cAny?.recipient_pn || cAny?.peerRecipientPn || cAny?.peer_recipient_pn
  ];

  const preferPn = pnCandidates.find(
    v => typeof v === "string" && /@s\.whatsapp\.net$/i.test(v)
  );

  if (lid && preferPn) {
    saveLidMapping(lid, preferPn, wbot.id);
  }

  if (resolvedJid.endsWith("@lid") && preferPn) {
    resolvedJid = preferPn;
  } else if (
    resolvedJid &&
    !resolvedJid.endsWith("@s.whatsapp.net") &&
    !resolvedJid.endsWith("@g.us") &&
    preferPn
  ) {
    resolvedJid = preferPn;
  } else if (resolvedJid.endsWith("@lid") && !preferPn) {
    const resolved = await resolveLidToPhoneNumber(resolvedJid, wbot);
    if (resolved) {
      resolvedJid = `${resolved}@s.whatsapp.net`;
    }
  }

  const safeNormalized = (value?: string) => {
    if (!value) return "";
    try {
      return jidNormalizedUser(value);
    } catch {
      return value;
    }
  };

  const normalizedJid = safeNormalized(resolvedJid);

  let contactInfo =
    wbot.store?.contacts?.[resolvedJid] ||
    wbot.store?.contacts?.[normalizedJid];

  // Busca reversa em store.contacts por LID ou ID caso ainda não tenha sido encontrado
  if (!contactInfo && wbot.store?.contacts) {
    const allContacts = Object.values(wbot.store.contacts);
    contactInfo = allContacts.find(
      (c: any) =>
        c?.lid === resolvedJid ||
        c?.lid === normalizedJid ||
        (lid && c?.lid === lid) ||
        c?.id === resolvedJid ||
        c?.id === normalizedJid
    );
  }

  // Se o contato da store tem ID no formato telefone (@s.whatsapp.net), usar como PN
  if (contactInfo?.id && /@s\.whatsapp\.net$/i.test(contactInfo.id)) {
    resolvedJid = contactInfo.id;
    if (contactInfo?.lid) {
      saveLidMapping(contactInfo.lid, contactInfo.id, wbot.id);
    }
  }

  const chatInfo =
    wbot.store?.chats?.get?.(resolvedJid) ||
    wbot.store?.chats?.get?.(normalizedJid);

  let profilePicUrl: string | undefined;

  if (normalizedJid) {
    try {
      const url = await wbot.profilePictureUrl(normalizedJid, "image");
      profilePicUrl = url || undefined;
    } catch (err) {
      logger.debug({
        info: "Could not get profile picture",
        jid: normalizedJid,
        err
      });
    }
  }

  if (isJidGroup(resolvedJid)) {
    const groupNumber = normalizedJid.split("@")[0];
    let groupName =
      contactInfo?.name ||
      contactInfo?.notify ||
      (contactInfo as any)?.verifiedName ||
      chatInfo?.name ||
      (chatInfo as { subject?: string } | undefined)?.subject;

    // Se o nome for apenas números ou o próprio groupNumber, buscar subject dos metadados
    if (!groupName || groupName === groupNumber || /^\d+$/.test(groupName)) {
      try {
        const meta = await wbot.groupMetadata(normalizedJid);
        if (meta?.subject) {
          groupName = meta.subject;
        }
      } catch {
        /* ignore */
      }
    }

    return {
      name: groupName || `Grupo ${groupNumber}`,
      number: groupNumber,
      isGroup: true,
      profilePicUrl
    };
  }

  const decoded = jidDecode(resolvedJid);

  const sessionPushName = wbot.user?.name?.trim().toLowerCase();
  const incomingPushName = msg.pushName?.trim();
  const pushName =
    incomingPushName &&
    sessionPushName &&
    incomingPushName.toLowerCase() === sessionPushName
      ? undefined
      : incomingPushName;

  let number =
    (isJidUser(resolvedJid) && decoded?.user) ||
    jidDecode(preferPn || "")?.user ||
    normalizedJid.split("@")[0];

  const isLid =
    isLidUser(resolvedJid) ||
    resolvedJid.endsWith("@lid") ||
    (lid && number === lid.split("@")[0]);

  const lidValue = isLid
    ? resolvedJid.endsWith("@lid")
      ? resolvedJid
      : lid || `${number}@lid`
    : lid;

  // IMPORTANTE: declarar 'name' ANTES do bloco LID que pode atribuí-la
  let name =
    contactInfo?.name ||
    contactInfo?.notify ||
    (contactInfo as any)?.verifiedName ||
    pushName ||
    "";

  // Se o number for um LID de 14+ dígitos, tentar checar no banco de dados e via USync se já conhecemos o número real
  if (isLid && lidValue) {
    try {
      const baseLid = lidValue.split("@")[0].split(":")[0].replace(/\D/g, "");
      if (baseLid) {
        const resolved = await resolveLidToPhoneNumber(baseLid, wbot);
        if (resolved) {
          number = resolved;
        } else {
          // Buscar contato que tenha o mesmo LID mas com número real (<=13 dígitos)
          const dbContact = await Contact.findOne({
            where: {
              [Op.and]: [
                {
                  [Op.or]: [
                    { lid: { [Op.like]: `${baseLid}%` } },
                    { number: baseLid }
                  ]
                },
                {
                  number: {
                    [Op.and]: [
                      { [Op.ne]: baseLid },
                      { [Op.not]: null }
                    ]
                  }
                }
              ]
            }
          });
          if (dbContact && dbContact.number && dbContact.number.replace(/\D/g, "").length <= 13) {
            number = dbContact.number;
            if (dbContact.name && !/^\d{10,}$/.test(dbContact.name)) {
              name = dbContact.name;
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Se o nome ainda for apenas números ou o próprio LID, preferir pushName ou número real
  if (!name || name === number || /^\d{10,}$/.test(name)) {
    if (pushName) {
      name = pushName;
    } else if (!isLid && number) {
      name = number;
    } else {
      name = pushName || number || lidValue || "";
    }
  }

  return {
    name,
    number,
    lid: lidValue,
    isGroup: false,
    profilePicUrl
  };
};

const convertToMediaPayload = async (
  msg: WAMessage,
  wbot: Session
): Promise<MediaPayload | undefined> => {
  if (!hasMedia(msg)) return undefined;

  // TODO save direct to disc using stream
  try {
    const buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      {
        logger: whaileyLogger,
        reuploadRequest: wbot.updateMediaMessage
      }
    );

    const messageType = getContentType(msg.message || undefined);
    const getExtension = (mimetype: string, fallback: string): string =>
      mimetype.split("/")[1]?.split(";")[0] || fallback;

    if (messageType === "imageMessage") {
      const mimetype = msg.message?.imageMessage?.mimetype || "image/jpeg";
      return {
        filename: `image-${Date.now()}.${getExtension(mimetype, "jpg")}`,
        mimetype,
        data: buffer.toString("base64")
      };
    }

    if (messageType === "videoMessage") {
      const mimetype = msg.message?.videoMessage?.mimetype || "video/mp4";
      return {
        filename: `video-${Date.now()}.${getExtension(mimetype, "mp4")}`,
        mimetype,
        data: buffer.toString("base64")
      };
    }

    if (messageType === "audioMessage") {
      const mimetype =
        msg.message?.audioMessage?.mimetype || "audio/ogg; codecs=opus";
      return {
        filename: `audio-${Date.now()}.ogg`,
        mimetype,
        data: buffer.toString("base64")
      };
    }

    if (messageType === "documentMessage") {
      const docMsg = msg.message?.documentMessage;
      const mimetype = docMsg?.mimetype || "application/octet-stream";
      const ext = getExtension(mimetype, "bin");
      return {
        filename: docMsg?.title || `document-${Date.now()}.${ext}`,
        mimetype,
        data: buffer.toString("base64")
      };
    }

    if (messageType === "stickerMessage") {
      const mimetype = msg.message?.stickerMessage?.mimetype || "image/webp";
      return {
        filename: `sticker-${Date.now()}.webp`,
        mimetype,
        data: buffer.toString("base64")
      };
    }

    return {
      filename: "",
      mimetype: "",
      data: buffer.toString("base64")
    };
  } catch (err) {
    logger.error({
      info: "Error downloading media",
      err,
      messageId: msg.key.id
    });

    return undefined;
  }
};

const getMessageData = async (
  msg: WAMessage,
  wbot: Session
): Promise<{
  messagePayload: MessagePayload;
  contactPayload: ContactPayload;
  contextPayload: WhatsappContextPayload;
  mediaPayload: MediaPayload | undefined;
}> => {
  const remoteJid = msg.key.remoteJid || "";
  const isGroup = isJidGroup(remoteJid);

  let contactJid = remoteJid;
  let groupContact;

  if (!msg.key.fromMe && isGroup && msg.key.participant) {
    contactJid = msg.key.participant;
    groupContact = await convertToContactPayload(remoteJid, msg, wbot);
  }

  const contactPayload = await convertToContactPayload(contactJid, msg, wbot);
  const messagePayload = convertToMessagePayload(msg);
  const mediaPayload = await convertToMediaPayload(msg, wbot);

  const contextPayload: WhatsappContextPayload = {
    whatsappId: wbot.id,
    unreadMessages: 0,
    groupContact
  };

  return {
    messagePayload,
    contactPayload,
    contextPayload,
    mediaPayload
  };
};

export const getWbot = (sessionId: number): Session => {
  const wbot = sessions.get(sessionId);

  if (!wbot) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }

  return wbot;
};

const removeSession = async (whatsappId: number): Promise<void> => {
  await flushPendingCredsSave(whatsappId);

  const wbot = sessions.get(whatsappId);
  if (wbot) {
    wbot.ev.removeAllListeners("connection.update");
    wbot.ev.removeAllListeners("creds.update");
    wbot.ev.removeAllListeners("messages.upsert");
    wbot.ev.removeAllListeners("messages.update");
    wbot.ev.removeAllListeners("message-receipt.update");
    wbot.ev.removeAllListeners("presence.update");
    wbot.ev.removeAllListeners("groups.upsert");
    wbot.ev.removeAllListeners("groups.update");
    wbot.ev.removeAllListeners("group-participants.update");
    wbot.ev.removeAllListeners("contacts.upsert");
    wbot.ev.removeAllListeners("contacts.update");
    wbot.ev.removeAllListeners("chats.upsert");
    wbot.ev.removeAllListeners("chats.update");
    wbot.ev.removeAllListeners("chats.delete");
    wbot.ev.removeAllListeners("blocklist.set");
    wbot.ev.removeAllListeners("blocklist.update");

    try {
      wbot.end(undefined);
    } catch (e) {
      logger.debug({ info: "Error ending wbot", err: e });
    }

    try {
      wbot.ws?.removeAllListeners?.();
      await wbot.ws?.close?.();
    } catch (e) {
      logger.debug({ info: "Error closing websocket", err: e });
    }
  }

  sessions.delete(whatsappId);
  stores.delete(whatsappId);
};

const init = async (whatsapp: Whatsapp): Promise<void> => {
  const sessionId = whatsapp.id;
  const io = getIO();

  const { state } = await useSessionAuthState(whatsapp);
  const store = makeInMemoryStore({ logger: whaileyLogger });
  stores.set(sessionId, store);

  let waVersionToUse: WAVersion | undefined;

  if (process.env.WA_SOCKET_VERSION) {
    try {
      const parsed = JSON.parse(process.env.WA_SOCKET_VERSION) as number[];
      if (Array.isArray(parsed) && parsed.length >= 3) {
        waVersionToUse = parsed as WAVersion;
        logger.info({
          info: "Using WA_SOCKET_VERSION from env",
          version: waVersionToUse.join(".")
        });
      }
    } catch {
      logger.warn({
        info: "Failed to parse WA_SOCKET_VERSION, fetching latest"
      });
    }
  }

  if (!waVersionToUse) {
    try {
      const fetchedVersionData = await fetchLatestWaWebVersion({});
      if (fetchedVersionData?.version) {
        waVersionToUse = fetchedVersionData.version;
        logger.info({
          info: "Using latest WA Web version",
          version: waVersionToUse.join(".")
        });
      }
    } catch (e) {
      logger.warn({ info: "Failed to fetch latest WA version, using default" });
    }
  }

  const proxyUrl = whatsapp.proxyUrl || process.env.PROXY_ADDRESS;
  let agent: any = undefined;
  let fetchAgent: any = undefined;
  if (proxyUrl && typeof proxyUrl === "string" && proxyUrl.trim() !== "") {
    try {
      agent = new HttpsProxyAgent(proxyUrl.trim());
      fetchAgent = new HttpsProxyAgent(proxyUrl.trim());
      logger.info({
        info: "Using dedicated proxy for session",
        sessionId,
        proxy: proxyUrl.replace(/:[^:]*@/, ":***@")
      });
    } catch (err) {
      logger.error({
        info: "Invalid proxy URL configured, falling back to direct connection",
        sessionId,
        err
      });
    }
  }

  const connOptions: UserFacingSocketConfig = {
    logger: whaileyLogger,
    browser: Browsers.ubuntu(process.env.WHATSAPP_BROWSER_NAME || "Chrome"),
    agent,
    fetchAgent,
    emitOwnEvents: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(
        state.keys,
        whaileyLogger,
        new NodeCache({
          useClones: false,
          stdTTL: 60 * 60,
          checkperiod: 60 * 5
        })
      )
    },
    shouldSyncHistoryMessage: (msg: proto.Message.IHistorySyncNotification) => {
      return true;
    },
    shouldIgnoreJid: jid => {
      if (typeof jid !== "string") return false;
      return (
        isJidBroadcast(jid) ||
        jid?.endsWith("newsletter") ||
        jid === "status@broadcast"
      );
    },
    syncFullHistory: true,
    version: waVersionToUse,
    msgRetryCounterMap,
    markOnlineOnConnect: false,
    fireInitQueries: true,
    generateHighQualityLinkPreview: true,
    linkPreviewImageThumbnailWidth: 192,
    defaultQueryTimeoutMs: 60_000,
    connectTimeoutMs: 25_000,
    retryRequestDelayMs: 500,
    transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
    sentMessagesCache,
    getMessage: async (key: WAMessageKey) => {
      const cached = msgCache.get(key);
      if (cached) return cached;

      const msg = store.messages[key.remoteJid!]?.get(key.id!);
      if (msg?.message) return msg.message;

      return undefined;
    }
  };

  const proxyAddress = process.env.PROXY_ADDRESS || "";
  if (proxyAddress) {
    const proxyAuth = process.env.PROXY_AUTH || "";
    const proxyUrl = proxyAuth
      ? `http://${proxyAuth}@${proxyAddress}`
      : `http://${proxyAddress}`;

    connOptions.agent = new HttpsProxyAgent(proxyUrl);
    connOptions.fetchAgent = new HttpsProxyAgent(proxyUrl);
  }

  assertUnique(sessionId);

  const wbot = makeWASocket(connOptions) as Session;
  wbot.id = sessionId;
  wbot.store = store;

  store.bind(wbot.ev);

  sessions.set(sessionId, wbot);

  wbot.ev.on("creds.update", () => {
    debouncedSaveCreds(whatsapp, state.creds);
  });

  // Fila sequencial de sincronização de histórico retroativo (1 conversa por vez - últimas 24h)
  wbot.ev.on("messaging-history.set", async ({ chats, contacts, messages, isLatest, syncType }) => {
    try {
      logger.info({
        info: "messaging-history.set event received",
        sessionId,
        chatsCount: chats?.length || 0,
        contactsCount: contacts?.length || 0,
        messagesCount: messages?.length || 0,
        syncType
      });

      // 1. Processar contatos do histórico
      if (contacts && contacts.length > 0) {
        for (const c of contacts) {
          try {
            const jid = c.id || "";
            const lid = (c as any).lid || (jid.endsWith("@lid") ? jid : undefined);
            const pn = jid.endsWith("@s.whatsapp.net") ? jid.split("@")[0] : undefined;
            const name = c.name || c.notify || (c as any).verifiedName;

            if (pn || lid) {
              await CreateOrUpdateContactService({
                name: name || pn || lid?.split("@")[0] || "",
                number: pn || lid?.split("@")[0] || "",
                lid,
                isGroup: false
              });
            }
          } catch {
            /* ignore */
          }
        }
      }

      // 2. Processar grupos do histórico
      if (chats && chats.length > 0) {
        for (const chat of chats) {
          try {
            if (isJidGroup(chat.id)) {
              const groupNumber = chat.id.split("@")[0];
              const groupName = (chat as any).name || (chat as any).subject || groupNumber;
              if (groupName && groupName !== groupNumber) {
                await CreateOrUpdateContactService({
                  name: groupName,
                  number: groupNumber,
                  isGroup: true
                });
              }
            }
          } catch {
            /* ignore */
          }
        }
      }

      if (!messages || messages.length === 0) return;

      // 3. Filtrar estritamente mensagens das últimas 24 horas
      const now = Date.now();
      const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

      const validHistoryMessages = messages.filter(msg => {
        if (!msg.message || !shouldHandleMessage(msg)) return false;
        const ts = Number(msg.messageTimestamp || 0) * 1000;
        return ts >= twentyFourHoursAgo;
      });

      logger.info({
        info: "Filtered 24h history messages",
        total: messages.length,
        valid24h: validHistoryMessages.length,
        sessionId
      });

      if (validHistoryMessages.length === 0) return;

      // 4. Agrupar mensagens por conversa (Chat JID)
      const chatsMap = new Map<string, WAMessage[]>();
      for (const msg of validHistoryMessages) {
        const chatJid = msg.key?.remoteJid || "";
        if (!chatJid) continue;
        if (!chatsMap.has(chatJid)) {
          chatsMap.set(chatJid, []);
        }
        chatsMap.get(chatJid)!.push(msg);
      }

      // 5. Processamento SEQUENCIAL: 1 CONVERSA DE CADA VEZ
      const totalChats = chatsMap.size;
      let chatIndex = 0;

      for (const [chatJid, chatMsgs] of chatsMap.entries()) {
        chatIndex++;
        logger.info({
          info: `[History Sync] Processando conversa (${chatIndex}/${totalChats})`,
          chatJid,
          messagesCount: chatMsgs.length,
          sessionId
        });

        // Ordenar mensagens da conversa em ordem cronológica (mais antiga para mais recente)
        chatMsgs.sort((a, b) => Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0));

        let lastMsgText = "";

        for (const msg of chatMsgs) {
          try {
            if (!msg.key.id) continue;

            // Checar se a mensagem já existe no banco de dados para evitar duplicidade
            const existing = await Message.findByPk(msg.key.id);
            if (existing) continue;

            const msgTs = new Date(Number(msg.messageTimestamp || 0) * 1000);

            const {
              messagePayload,
              contactPayload,
              contextPayload,
              mediaPayload
            } = await getMessageData(msg, wbot);

            await handleMessage(
              messagePayload,
              contactPayload,
              contextPayload,
              mediaPayload,
              true, // isHistoricalSync (não dispara bots/chatbots)
              msgTs // Timestamp original exato do WhatsApp
            );

            lastMsgText = messagePayload.body || mediaPayload?.filename || "";

            // Micro-pausa de 30ms para manter a CPU e event loop 100% livres
            await sleep(30);
          } catch (err) {
            logger.debug({
              info: "Error processing individual history message",
              err,
              msgId: msg.key.id
            });
          }
        }

        // Atualizar o lastMessage do ticket correspondente à conversa
        try {
          if (chatMsgs.length > 0 && lastMsgText) {
            const lastMsg = chatMsgs[chatMsgs.length - 1];
            const contactPayload = await convertToContactPayload(chatJid, lastMsg, wbot);
            const contact = await Contact.findOne({ where: { number: contactPayload.number } });
            if (contact) {
              const ticket = await Ticket.findOne({
                where: { contactId: contact.id, whatsappId: sessionId }
              });
              if (ticket) {
                await ticket.update({ lastMessage: lastMsgText });
              }
            }
          }
        } catch {
          /* ignore */
        }

        // Pausa suave de 100ms entre conversas para não sobrecarregar
        await sleep(100);
      }

      logger.info({
        info: `[History Sync] Sincronização retroativa concluída com sucesso (${totalChats} conversas processadas)`,
        sessionId
      });
    } catch (err) {
      logger.error({
        info: "Error in messaging-history.set queue",
        sessionId,
        err
      });
    }
  });

  wbot.ev.on("messages.upsert", async ({ messages, type }) => {
    messages.forEach(msg => {
      msgCache.save(msg);
      logger.debug({
        info: "[RAW] Message received",
        sessionId,
        type,
        key: msg.key,
        messageTimestamp: msg.messageTimestamp,
        pushName: msg.pushName,
        status: msg.status,
        messageType: Object.keys(msg.message || {}),
        rawMessage: JSON.stringify(msg, null, 2)
      });
    });

    const validMessages = messages.filter(msg => {
      if (!msg.message || !shouldHandleMessage(msg)) return false;

      if (type === "notify") return true;

      if (type === "append" && msg.key.fromMe) return true;

      return false;
    });

    if (validMessages.length === 0) return;

    await Promise.all(
      validMessages.map(async msg => {
        try {
          const {
            messagePayload,
            contactPayload,
            contextPayload,
            mediaPayload
          } = await getMessageData(msg, wbot);

          await handleMessage(
            messagePayload,
            contactPayload,
            contextPayload,
            mediaPayload
          );
        } catch (err) {
          logger.error(err, "Error handling message upsert");
        }
      })
    );
  });

  wbot.ev.on("contacts.upsert", async contacts => {
    for (const c of contacts) {
      try {
        const jid = c.id || "";
        const lid = (c as any).lid || (jid.endsWith("@lid") ? jid : undefined);
        let pn = jid.endsWith("@s.whatsapp.net") ? jid.split("@")[0] : (c as any).phoneNumber?.split("@")[0];
        const name = c.name || c.notify || (c as any).verifiedName;

        if (lid && pn) {
          await saveLidMapping(lid, pn, sessionId, name);
        } else if (lid && !pn) {
          const resolved = await resolveLidToPhoneNumber(lid, wbot);
          if (resolved) pn = resolved;
        }

        if (pn || lid) {
          await CreateOrUpdateContactService({
            name: name || pn || "",
            number: pn || "",
            lid: lid ? (lid.endsWith("@lid") ? lid : `${lid}@lid`) : undefined,
            isGroup: isJidGroup(jid)
          });
        }
      } catch {
        /* ignore */
      }
    }
  });

  wbot.ev.on("contacts.update", async updates => {
    for (const c of updates) {
      try {
        const jid = c.id || "";
        const lid = (c as any).lid || (jid.endsWith("@lid") ? jid : undefined);
        let pn = jid.endsWith("@s.whatsapp.net") ? jid.split("@")[0] : (c as any).phoneNumber?.split("@")[0];
        const name = c.name || c.notify || (c as any).verifiedName;

        if (lid && pn) {
          await saveLidMapping(lid, pn, sessionId, name);
        } else if (lid && !pn) {
          const resolved = await resolveLidToPhoneNumber(lid, wbot);
          if (resolved) pn = resolved;
        }

        if (pn || lid) {
          await CreateOrUpdateContactService({
            name: name || pn || "",
            number: pn || "",
            lid: lid ? (lid.endsWith("@lid") ? lid : `${lid}@lid`) : undefined,
            isGroup: isJidGroup(jid)
          });
        }
      } catch {
        /* ignore */
      }
    }
  });

  wbot.ev.on("connection.update", async update => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const errorMessage =
        (lastDisconnect?.error as Boom)?.output?.payload?.message ||
        (lastDisconnect?.error as Error)?.message ||
        "";

      if (errorMessage === "Intentional Logout") {
        await whatsapp.update({
          status: "DISCONNECTED",
          qrcode: "",
          retries: 0
        });

        const updatedWhatsapp = await Whatsapp.findByPk(sessionId);
        if (updatedWhatsapp) {
          io.emit("whatsappSession", {
            action: "update",
            session: updatedWhatsapp
          });
        }

        logger.info({ info: "Session intentionally logged out", sessionId });

        await clearSessionKeys(sessionId);

        await removeSession(sessionId);
        return;
      }

      if (statusCode === DisconnectReason.loggedOut) {
        await whatsapp.update({
          status: "DISCONNECTED",
          qrcode: "",
          retries: 0
        });

        const updatedWhatsapp = await Whatsapp.findByPk(sessionId);
        if (updatedWhatsapp) {
          io.emit("whatsappSession", {
            action: "update",
            session: updatedWhatsapp
          });
        }

        await removeSession(sessionId);

        return;
      }

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut; // TODO handle other cases

      if (shouldReconnect) {
        await flushPendingCredsSave(sessionId);

        await whatsapp.update({ status: "OPENING" });
        io.emit("whatsappSession", {
          action: "update",
          session: whatsapp
        });
        logger.info({
          info: "Connection closed, reconnecting...",
          sessionId,
          statusCode
        });

        await sleep(3000);
        init(whatsapp);
      }
    }

    if (connection === "open") {
      await flushPendingCredsSave(sessionId);

      await whatsapp.update({
        status: "CONNECTED",
        qrcode: "",
        retries: 0
      });

      const updatedWhatsapp = await Whatsapp.findByPk(sessionId);
      if (updatedWhatsapp) {
        io.emit("whatsappSession", {
          action: "update",
          session: updatedWhatsapp
        });
      }

      logger.info({ info: "Session connected", sessionId });

      // Auto-sync de todos os grupos do WhatsApp para garantir nomes reais
      setTimeout(async () => {
        try {
          const groups = await wbot.groupFetchAllParticipating();
          for (const [groupId, meta] of Object.entries(groups)) {
            const groupNumber = groupId.split("@")[0];
            const subject = meta.subject || groupNumber;
            if (subject && subject !== groupNumber) {
              await CreateOrUpdateContactService({
                name: subject,
                number: groupNumber,
                isGroup: true
              });
            }
          }
          logger.info({ info: "Synced participating groups", count: Object.keys(groups).length, sessionId });
        } catch (err) {
          logger.debug({ info: "Could not fetch participating groups on open", sessionId, err });
        }

        // Varredura AGRESSIVA de resolução de LIDs contra o store.contacts
        try {
          const allStoreContacts = Object.entries(wbot.store?.contacts || {});
          
          // 1. Construir mapa reverso LID → número real a partir do store
          const lidToPhoneMap = new Map<string, { pn: string; name: string }>();
          
          for (const [key, c] of allStoreContacts) {
            const contact = c as any;
            if (!contact) continue;
            
            const jid = contact.id || key || "";
            const lid = contact.lid || (jid.endsWith("@lid") ? jid : undefined);
            const pn = jid.endsWith("@s.whatsapp.net") ? jid.split("@")[0] : undefined;
            const name = contact.name || contact.notify || contact.verifiedName || "";
            
            // Se tem PN real (telefone@s.whatsapp.net) e LID, mapear
            if (pn && lid) {
              const baseLid = lid.split("@")[0].split(":")[0].replace(/\D/g, "");
              if (baseLid) {
                lidToPhoneMap.set(baseLid, { pn, name });
              }
              
              // Atualizar contato no banco com o número real
              await CreateOrUpdateContactService({
                name: name || pn,
                number: pn,
                lid,
                isGroup: false
              });
            }
          }
          
          logger.info({
            info: "Store contacts LID→PN map built",
            totalStoreContacts: allStoreContacts.length,
            lidMappingsFound: lidToPhoneMap.size,
            sessionId
          });
          
          // 2. Buscar contatos no banco que TEM LID como número (>13 dígitos) e resolver
          if (lidToPhoneMap.size > 0) {
            const { Op } = require("sequelize");
            const dbLidContacts = await Contact.findAll({
              where: {
                isGroup: false,
                lid: { [Op.ne]: null, [Op.ne]: "" }
              },
              attributes: ["id", "name", "number", "lid"]
            });
            
            let resolved = 0;
            for (const dbContact of dbLidContacts) {
              const currentNumber = (dbContact.number || "").replace(/\D/g, "");
              // Se o número atual é real (<=13 dígitos), pular
              if (currentNumber.length >= 10 && currentNumber.length <= 13) continue;
              
              // Extrair baseLid
              const baseLid = (dbContact.lid || "").split("@")[0].split(":")[0].replace(/\D/g, "");
              if (!baseLid) continue;
              
              const mapping = lidToPhoneMap.get(baseLid);
              if (mapping && mapping.pn) {
                await dbContact.update({
                  number: mapping.pn,
                  ...(mapping.name && !/^\d{10,}$/.test(mapping.name) ? { name: mapping.name } : {})
                });
                resolved++;
              }
            }
            
            logger.info({
              info: "LID→PN resolution pass completed",
              totalLidContacts: dbLidContacts.length,
              resolved,
              sessionId
            });

            resolvePendingLidTickets(wbot);
          }
        } catch (err) {
          logger.debug({ info: "Error in store contacts resolution pass", sessionId, err });
        }
      }, 5000);
    }

    if (qr !== undefined) {
      await whatsapp.update({
        qrcode: qr,
        status: "qrcode"
      });

      io.emit("whatsappSession", {
        action: "update",
        session: whatsapp
      });

      logger.info({ info: "QR Code generated", sessionId });
    }
  });



  wbot.ev.on("groups.upsert", async groups => {
    for (const g of groups) {
      try {
        const groupNumber = g.id.split("@")[0];
        const groupName = g.subject || groupNumber;
        await CreateOrUpdateContactService({
          name: groupName,
          number: groupNumber,
          isGroup: true
        });
      } catch (err) {
        logger.debug({ info: "Error in groups.upsert", err });
      }
    }
  });

  wbot.ev.on("groups.update", async updates => {
    for (const u of updates) {
      try {
        if (u.id && u.subject) {
          const groupNumber = u.id.split("@")[0];
          const contact = await Contact.findOne({
            where: { number: groupNumber, isGroup: true }
          });
          if (contact) {
            await contact.update({ name: u.subject });
            getIO().emit("contact", { action: "update", contact });
          }
        }
      } catch (err) {
        logger.debug({ info: "Error in groups.update", err });
      }
    }
  });

  wbot.ev.on("chats.upsert", async chats => {
    for (const chat of chats) {
      try {
        if (chat.name && chat.id) {
          const number = chat.id.split("@")[0];
          const contact = await Contact.findOne({
            where: { number }
          });
          if (contact && (!contact.name || contact.name === number || /^\d+$/.test(contact.name))) {
            await contact.update({ name: chat.name });
            getIO().emit("contact", { action: "update", contact });
          }
        }
      } catch (err) {
        logger.debug({ info: "Error in chats.upsert", err });
      }
    }
  });

  wbot.ev.on("messages.update", async updates => {
    await Promise.all(
      updates.map(async event => {
        try {
          if (!event.update.status || !event.key.id) return;

          const ack = (event.update.status as MessageAck) || 0;
          await handleMessageAck(event.key.id, ack);
        } catch (err) {
          logger.error({
            info: "Error handling message update",
            err,
            messageId: event.key.id
          });
        }
      })
    );
  });

  wbot.ev.on("message-receipt.update", async updates => {
    await Promise.all(
      updates.map(async ({ key, receipt }) => {
        try {
          if (!key.id) return;

          let ack: MessageAck = 2;
          if (receipt.playedTimestamp) {
            ack = 4;
          } else if (receipt.readTimestamp) {
            ack = 3;
          } else if (receipt.receiptTimestamp) {
            ack = 2;
          }

          await handleMessageAck(key.id, ack);

          logger.debug({
            info: "Message receipt update processed",
            messageId: key.id,
            ack,
            sessionId
          });
        } catch (err) {
          logger.error({
            info: "Error processing message receipt",
            err,
            messageId: key.id
          });
        }
      })
    );
  });
};

const logout = async (sessionId: number): Promise<void> => {
  await flushPendingCredsSave(sessionId);

  const wbot = sessions.get(sessionId);

  if (wbot) {
    await wbot
      .logout()
      .catch(err => logger.error({ info: "Error on logout", sessionId, err }));
  }

  await removeSession(sessionId);

  const whatsapp = await Whatsapp.findByPk(sessionId);

  if (whatsapp) {
    await whatsapp.update({
      status: "DISCONNECTED",
      qrcode: "",
      session: "",
      retries: 0
    });

    const updatedWhatsapp = await Whatsapp.findByPk(sessionId);
    if (updatedWhatsapp) {
      getIO().emit("whatsappSession", {
        action: "update",
        session: updatedWhatsapp
      });
    }

    logger.info({ info: "Session logged out", sessionId });
  }

  await clearSessionKeys(sessionId);
};

const simulateHumanTyping = async (
  sessionId: number,
  toJid: string,
  textLength: number,
  isMedia: boolean = false
): Promise<void> => {
  try {
    const whatsapp = await Whatsapp.findByPk(sessionId, {
      attributes: ["humanDelay"]
    });
    if (whatsapp && (whatsapp as any).humanDelay === false) {
      return;
    }
    const wbot = sessions.get(sessionId);
    if (!wbot) return;

    const presenceType = isMedia ? "recording" : "composing";
    await wbot.sendPresenceUpdate(presenceType, toJid).catch(() => {});

    const baseDelay = Math.min(Math.max(textLength * 35, 750), 3000);
    const jitter = Math.floor(Math.random() * 400);
    await sleep(baseDelay + jitter);

    await wbot.sendPresenceUpdate("paused", toJid).catch(() => {});
  } catch (err) {
    logger.debug({ info: "Presence simulation skipped", sessionId, err });
  }
};

const sendMessage = async (
  sessionId: number,
  to: string,
  body: string,
  options?: SendMessageOptions
): Promise<ProviderMessage> => {
  const wbot = getWbot(sessionId);
  const toJid = normalizeJid(to);

  await simulateHumanTyping(sessionId, toJid, body.length, false);

  const messageContent: AnyMessageContent = options?.quotedMessageId
    ? {
        text: body,
        contextInfo: {
          stanzaId: options.quotedMessageId,
          participant: options.quotedMessageFromMe ? wbot.user?.id : toJid
        }
      }
    : { text: body };

  const sentMsg = await wbot.sendMessage(toJid, messageContent);

  if (!sentMsg?.key.id) {
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }

  logger.debug({
    info: "[RAW] Message sent",
    sessionId,
    to: toJid,
    key: sentMsg.key,
    messageTimestamp: sentMsg.messageTimestamp,
    status: sentMsg.status,
    rawMessage: JSON.stringify(sentMsg, null, 2)
  });

  msgCache.save(sentMsg);

  return {
    id: sentMsg.key.id,
    body,
    fromMe: true,
    hasMedia: false,
    type: "chat",
    timestamp: sentMsg.messageTimestamp
      ? Number(sentMsg.messageTimestamp)
      : Date.now(),
    from: wbot.user?.id || "",
    to,
    ack: 1
  };
};

const sendMedia = async (
  sessionId: number,
  to: string,
  media: ProviderMediaInput,
  options?: SendMediaOptions
): Promise<ProviderMessage> => {
  const wbot = getWbot(sessionId);
  const toJid = normalizeJid(to);

  await simulateHumanTyping(sessionId, toJid, 50, true);

  const mediaBuffer = media.path ? readFileSync(media.path) : media.data;
  if (!mediaBuffer) throw new AppError("ERR_NO_MEDIA_DATA");

  const contextInfo = options?.quotedMessageId
    ? { stanzaId: options.quotedMessageId, participant: toJid }
    : undefined;

  const buildPayload = () => {
    const base = {
      caption: options?.caption,
      mimetype: media.mimetype,
      contextInfo
    };

    if (media.mimetype.startsWith("image/")) {
      return {
        message: { image: mediaBuffer, ...base },
        type: "image" as MessageType
      };
    }

    if (media.mimetype.startsWith("video/")) {
      return {
        message: { video: mediaBuffer, ...base },
        type: "video" as MessageType
      };
    }

    if (media.mimetype.startsWith("audio/")) {
      const ptt = Boolean(options?.sendAudioAsVoice);
      return {
        message: {
          audio: mediaBuffer,
          mimetype: media.mimetype,
          ptt,
          contextInfo
        },
        type: ptt ? "ptt" : ("audio" as MessageType)
      };
    }

    return {
      message: {
        document: mediaBuffer,
        caption: options?.caption,
        mimetype: media.mimetype,
        fileName: media.filename,
        contextInfo
      },
      type: "document" as MessageType
    };
  };

  const { message, type } = buildPayload();

  const sent = await wbot.sendMessage(toJid, message);
  if (!sent?.key?.id) throw new AppError("ERR_SENDING_WAPP_MEDIA_MSG");

  logger.debug({
    info: "[RAW] Media sent",
    sessionId,
    to: toJid,
    mediaType: type,
    mimetype: media.mimetype,
    filename: media.filename,
    key: sent.key,
    messageTimestamp: sent.messageTimestamp,
    status: sent.status,
    rawMessage: JSON.stringify(sent, null, 2)
  });

  msgCache.save(sent);

  return {
    id: sent.key.id,
    body: options?.caption || media.filename,
    fromMe: true,
    hasMedia: true,
    type,
    timestamp: sent.messageTimestamp
      ? Number(sent.messageTimestamp)
      : Date.now(),
    from: wbot.user?.id || "",
    to,
    ack: 1
  };
};

const deleteMessage = async (
  sessionId: number,
  chatId: string,
  messageId: string,
  fromMe: boolean
): Promise<void> => {
  const wbot = getWbot(sessionId);

  const normalizedChatId = normalizeJid(chatId);

  const key = {
    remoteJid: normalizedChatId,
    id: messageId,
    fromMe
  };

  await wbot.sendMessage(normalizedChatId, { delete: key });
};

const checkNumber = async (
  sessionId: number,
  number: string
): Promise<string> => {
  const wbot = getWbot(sessionId);

  const cleanNumber = number.replace(/\D/g, "");

  const [result] = await wbot.onWhatsApp(cleanNumber);

  if (!result?.exists) {
    throw new AppError("ERR_NUMBER_NOT_ON_WHATSAPP", 404);
  }

  // REGRA CRÍTICA: Se o WhatsApp retornou um JID LID, PRESERVAR o número original
  // e salvar o mapeamento LID→telefone real para resolução futura.
  const returnedJid = result.jid || "";
  if (returnedJid.endsWith("@lid") || isLidUser(returnedJid)) {
    const lidClean = returnedJid.split("@")[0].replace(/\D/g, "");
    if (lidClean && cleanNumber.length >= 10 && cleanNumber.length <= 13) {
      // Salvar mapeamento LID → telefone real
      saveLidMapping(returnedJid, `${cleanNumber}@s.whatsapp.net`, wbot.id || sessionId);
      logger.info({
        info: "[checkNumber] WhatsApp retornou LID, preservando número real original",
        originalNumber: cleanNumber,
        returnedLid: returnedJid,
        sessionId
      });
    }
    // Retorna o número real original ao invés do LID
    return cleanNumber;
  }

  return result.jid;
};

const getProfilePicUrl = async (
  sessionId: number,
  number: string
): Promise<string> => {
  const wbot = getWbot(sessionId);

  const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;

  try {
    const url = await wbot.profilePictureUrl(jid, "image");
    return url || "";
  } catch (err) {
    logger.debug({
      info: "Could not get profile picture",
      number,
      err
    });
    return "";
  }
};

const getContacts = async (sessionId: number): Promise<ProviderContact[]> => {
  const wbot = getWbot(sessionId);

  const contacts: ProviderContact[] = [];

  if (wbot.store?.contacts) {
    Object.values(wbot.store.contacts).forEach(contact => {
      if (contact.id && isJidUser(contact.id)) {
        contacts.push({
          id: contact.id,
          number: jidNormalizedUser(contact.id).replace("@s.whatsapp.net", ""),
          name: contact.name || contact.notify || "",
          pushname: contact.notify || "",
          isGroup: false
        });
      }
    });
  }

  return contacts;
};

const sendSeen = async (sessionId: number, chatId: string): Promise<void> => {
  const wbot = getWbot(sessionId);

  const normalizedChatId = normalizeJid(chatId);

  const lastMessages =
    wbot.store?.messages?.[normalizedChatId]?.array?.slice(-5) || [];

  if (lastMessages.length === 0) {
    return;
  }

  const keys = lastMessages
    .filter(msg => !msg.key.fromMe && msg.key.id)
    .map(msg => ({
      remoteJid: normalizedChatId,
      id: msg.key.id!,
      participant: msg.key.participant
    }));

  if (keys.length > 0) {
    await wbot.readMessages(keys);
  }
};

const fetchChatMessages = async (
  sessionId: number,
  chatId: string,
  limit = 100
): Promise<ProviderMessage[]> => {
  const wbot = getWbot(sessionId);

  const normalizedChatId = normalizeJid(chatId);

  const messagesFromStore =
    wbot.store?.messages?.[normalizedChatId]?.array || [];

  const messages = messagesFromStore.slice(-limit);

  return messages.map(msg => ({
    id: msg.key.id || "",
    body: getMessageBody(msg),
    fromMe: msg.key.fromMe || false,
    hasMedia: hasMedia(msg),
    type: mapMessageType(msg),
    timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) : Date.now(),
    from: msg.key.participant || msg.key.remoteJid || "",
    to: normalizedChatId,
    ack: mapMessageAck(msg.status)
  }));
};

export const WhaileysProvider: WhatsappProvider = {
  init,
  removeSession,
  logout,
  sendMessage,
  sendMedia,
  deleteMessage,
  checkNumber,
  getProfilePicUrl,
  getContacts,
  sendSeen,
  fetchChatMessages
};
