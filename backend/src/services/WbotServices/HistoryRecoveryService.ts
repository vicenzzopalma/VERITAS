import fs from "fs";
import os from "os";
import path from "path";
import { Op, QueryTypes } from "sequelize";

import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";

/**
 * Recuperação de mensagens perdidas pelo histórico sob demanda do WhatsApp.
 *
 * Para cada conversa candidata de uma conexão, pede ao celular principal
 * (fetchMessageHistory / HISTORY_SYNC_ON_DEMAND) as mensagens anteriores a uma
 * âncora, em lotes, até cobrir a janela pedida. O celular responde com um
 * evento messaging-history.set do tipo ON_DEMAND.
 *
 * A gravação é deliberadamente "muda": não reabre nem move ticket, não mexe em
 * status, unreadMessages, lastMessage nem updatedAt do ticket, grava como lida,
 * não emite socket, não dispara fila/chatbot nem envia nada ao cliente.
 * Duplicatas são ignoradas (Messages.id é o id da mensagem no WhatsApp).
 */

export const ON_DEMAND_SYNC_TYPE = 6; // proto.HistorySync.HistorySyncType.ON_DEMAND

export interface RecoveryOptions {
  /** início da janela (ms). Mensagens mais antigas são ignoradas. */
  fromMs: number;
  /** fim da janela (ms). Padrão: agora. */
  toMs?: number;
  /** só conta, não grava. */
  dryRun?: boolean;
  /** pausa entre pedidos ao celular. */
  pauseMs?: number;
  /** espera máxima pela resposta de cada pedido. */
  timeoutMs?: number;
  /** mensagens pedidas por lote (o WhatsApp Web usa 50). */
  batchSize?: number;
  /** máximo de lotes por conversa. */
  maxRounds?: number;
  /** limita a quantidade de conversas (piloto). */
  maxChats?: number;
  /** restringe a estes contatos. */
  contactIds?: number[];
  /** conversas com atividade a partir desta data (ms) entram como candidatas. */
  candidatesSinceMs?: number;
  /** estratégia de âncora: "newest" (última mensagem conhecida) ou "now" (âncora sintética agora). */
  anchor?: "newest" | "now";
  /** baixar mídia (pede reupload ao celular quando expirada). */
  downloadMedia?: boolean;
}

export interface ChatCandidate {
  contactId: number;
  number: string;
  lid?: string | null;
  lastAt?: string | null;
}

export interface Anchor {
  id: string;
  fromMe: boolean;
  timestampMs: number;
}

export interface RecoveryStatus {
  sessionId: number;
  state: "queued" | "running" | "done" | "failed" | "cancelled";
  dryRun: boolean;
  fromMs: number;
  toMs: number;
  startedAt?: string;
  finishedAt?: string;
  chatsTotal: number;
  chatsDone: number;
  chatsWithResponse: number;
  chatsWithImports: number;
  requests: number;
  responses: number;
  timeouts: number;
  received: number;
  inWindow: number;
  imported: number;
  alreadyInDb: number;
  ignoredType: number;
  mediaFailed: number;
  ticketsCreated: number;
  errors: number;
  lastError?: string;
  reportFile?: string;
}

export interface HistoryHelpers {
  shouldHandleMessage: (msg: any) => boolean;
  convertToMessagePayload: (msg: any) => any;
  convertToMediaPayload: (msg: any, wbot: any) => Promise<any>;
  parseMessageTimestamp: (ts: any) => number;
  hasMedia: (msg: any) => boolean;
}

export interface RecoveryDeps {
  getWbot: (sessionId: number) => any;
  helpers: HistoryHelpers;
  saveMediaFile: (media: any) => Promise<string>;
}

const statuses = new Map<number, RecoveryStatus>();
const cancelled = new Set<number>();

export const getRecoveryStatus = (sessionId?: number): RecoveryStatus[] =>
  sessionId
    ? [statuses.get(sessionId)].filter(Boolean) as RecoveryStatus[]
    : [...statuses.values()];

export const cancelRecovery = (sessionId: number): void => {
  cancelled.add(sessionId);
};

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const reportDir = (): string =>
  process.env.HISTORY_RECOVERY_DIR ||
  path.join(os.tmpdir(), "veritas-history-recovery");

const appendReport = (file: string | undefined, row: any): void => {
  if (!file) return;
  try {
    fs.appendFileSync(file, `${JSON.stringify(row)}\n`);
  } catch {
    /* relatório é auxiliar */
  }
};

export const toDbDate = (ms: number): string =>
  `${new Date(ms).toISOString().replace("T", " ").replace("Z", "")} +00:00`;

export const parseDbDate = (value: any): number => {
  if (!value) return NaN;
  if (value instanceof Date) return value.getTime();
  const s = String(value).trim();
  const iso = s.replace(" +00:00", "Z").replace(" ", "T");
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Date.parse(s) : t;
};

/** JIDs possíveis da conversa no celular: LID primeiro, depois número. */
export const chatJidsFor = (c: ChatCandidate): string[] => {
  const jids: string[] = [];
  if (c.lid) jids.push(c.lid.includes("@") ? c.lid : `${c.lid}@lid`);
  const digits = String(c.number || "").replace(/\D/g, "");
  if (digits && digits.length <= 15) jids.push(`${digits}@s.whatsapp.net`);
  return [...new Set(jids)];
};

/**
 * Filtra mensagens recebidas do histórico: só conversa individual, tipos que o
 * CRM grava, dentro da janela. Devolve também a mais antiga (próxima âncora).
 */
export const selectHistoryMessages = (
  messages: any[],
  chatJids: string[],
  fromMs: number,
  toMs: number,
  helpers: Pick<HistoryHelpers, "shouldHandleMessage" | "parseMessageTimestamp">
): { inWindow: any[]; ignoredType: number; oldest?: Anchor; forChat: number } => {
  const jidSet = new Set(chatJids);
  const forChat = messages.filter(
    m => m?.key?.remoteJid && jidSet.has(m.key.remoteJid)
  );
  let oldest: Anchor | undefined;
  let ignoredType = 0;
  const inWindow: any[] = [];
  for (const m of forChat) {
    const ts = helpers.parseMessageTimestamp(m.messageTimestamp);
    if (m.key?.id && (!oldest || ts < oldest.timestampMs)) {
      oldest = { id: m.key.id, fromMe: Boolean(m.key.fromMe), timestampMs: ts };
    }
    if (!m.message || !helpers.shouldHandleMessage(m)) {
      ignoredType += 1;
      continue;
    }
    if (ts >= fromMs && ts <= toMs) inWindow.push(m);
  }
  inWindow.sort(
    (a, b) =>
      helpers.parseMessageTimestamp(a.messageTimestamp) -
      helpers.parseMessageTimestamp(b.messageTimestamp)
  );
  return { inWindow, ignoredType, oldest, forChat: forChat.length };
};

/** Próximo passo do laço de lotes: continua enquanto o lote veio cheio e não passou do início da janela. */
export const shouldFetchMore = (
  receivedForChat: number,
  oldest: Anchor | undefined,
  previousAnchor: Anchor,
  fromMs: number,
  batchSize: number
): boolean => {
  if (!oldest || receivedForChat === 0) return false;
  if (oldest.timestampMs < fromMs) return false;
  if (oldest.id === previousAnchor.id) return false;
  return receivedForChat >= Math.max(1, Math.floor(batchSize / 2));
};

const mediaTypeFromMime = (mimetype: string, fallback: string): string => {
  const mimeLower = (mimetype || "").toLowerCase();
  if (mimeLower.includes("image")) return "image";
  if (mimeLower.includes("audio") || mimeLower.includes("ogg")) return "audio";
  if (mimeLower.includes("video")) return "video";
  if (
    mimeLower.includes("pdf") ||
    mimeLower.includes("document") ||
    mimeLower.includes("application") ||
    mimeLower.includes("sheet") ||
    mimeLower.includes("excel")
  )
    return "document";
  return mimeLower.split("/")[0] || fallback;
};

/** Ticket ao qual a mensagem recuperada se liga: o mais recente do contato nesta conexão. */
const findTicketFor = async (
  contactId: number,
  sessionId: number
): Promise<Ticket | null> =>
  Ticket.findOne({
    where: { contactId, whatsappId: sessionId, isGroup: false },
    order: [["id", "DESC"]]
  });

interface ImportContext {
  sessionId: number;
  wbot: any;
  deps: RecoveryDeps;
  status: RecoveryStatus;
  dryRun: boolean;
  downloadMedia: boolean;
  reportFile?: string;
}

/**
 * Grava uma mensagem recuperada sem efeitos colaterais.
 * Retorna "imported" | "exists" | "skipped".
 */
export const importRecoveredMessage = async (
  msg: any,
  candidate: ChatCandidate,
  ticketRef: { ticket: Ticket | null },
  ctx: ImportContext
): Promise<"imported" | "exists" | "skipped"> => {
  const { helpers } = ctx.deps;
  const waId: string | undefined = msg?.key?.id;
  if (!waId) return "skipped";

  const candidatesIds = [waId, `${ctx.sessionId}_${waId}`];
  if (ticketRef.ticket) candidatesIds.push(`${ticketRef.ticket.id}_${waId}`);
  const existing = await Message.findAll({
    where: { id: { [Op.in]: candidatesIds } },
    attributes: ["id", "ticketId"]
  });

  let finalId = waId;
  if (existing.length) {
    // Já existe nesta conexão? então nada a fazer.
    const ticketIds = existing.map(e => e.ticketId);
    const sameSession = await Ticket.count({
      where: { id: { [Op.in]: ticketIds }, whatsappId: ctx.sessionId }
    });
    if (sameSession > 0) return "exists";
    // Existe em outra conexão (conversa entre dois chips do CRM): mesma regra do CreateMessageService.
    if (!ticketRef.ticket) return "exists";
    finalId = `${ticketRef.ticket.id}_${waId}`;
    if (existing.some(e => e.id === finalId)) return "exists";
  }

  if (ctx.dryRun) return "imported";

  const payload = helpers.convertToMessagePayload(msg);
  const ts = helpers.parseMessageTimestamp(msg.messageTimestamp);
  const createdAt = new Date(ts);

  if (!ticketRef.ticket) {
    // Contato sem ticket nesta conexão: cria um ticket já fechado, sem não lidas,
    // para a conversa ficar no histórico sem entrar na fila de ninguém.
    ticketRef.ticket = await Ticket.create({
      contactId: candidate.contactId,
      whatsappId: ctx.sessionId,
      status: "closed",
      unreadMessages: 0,
      isGroup: false,
      lastMessage: (payload.body || "").slice(0, 255),
      createdAt,
      updatedAt: createdAt
    } as any);
    ctx.status.ticketsCreated += 1;
    if (existing.length) finalId = `${ticketRef.ticket.id}_${waId}`;
  }

  let body: string = payload.body || "";
  let mediaType: string = payload.type || "chat";
  let mediaUrl: string | undefined;

  if (payload.hasMedia) {
    let media: any;
    if (ctx.downloadMedia) {
      try {
        media = await helpers.convertToMediaPayload(msg, ctx.wbot);
      } catch {
        media = undefined;
      }
    }
    if (media && media.data) {
      try {
        mediaUrl = await ctx.deps.saveMediaFile(media);
        body = body || mediaUrl;
        mediaType = mediaTypeFromMime(media.mimetype, mediaType);
      } catch {
        mediaUrl = undefined;
      }
    }
    if (!mediaUrl) {
      ctx.status.mediaFailed += 1;
      body = `${body ? `${body}\n` : ""}[mídia recuperada do histórico sem arquivo: ${mediaType}]`;
      mediaType = "chat";
    }
  }

  let quotedMsgId: string | undefined = payload.quotedMsgId;
  if (quotedMsgId) {
    const quoted = await Message.findByPk(quotedMsgId, { attributes: ["id"] });
    if (!quoted) quotedMsgId = undefined;
  }

  const fromMe = Boolean(payload.fromMe);
  try {
    await Message.create(
      {
      id: finalId,
      ticketId: ticketRef.ticket.id,
      contactId: fromMe ? null : candidate.contactId,
      body,
      fromMe,
      read: true,
      mediaType,
      mediaUrl,
      quotedMsgId,
      ack: fromMe ? 3 : 0,
      createdAt,
      updatedAt: createdAt
      } as any,
      { silent: true }
    );
  } catch (err: any) {
    if (err?.name === "SequelizeUniqueConstraintError") return "exists";
    throw err;
  }

  appendReport(ctx.reportFile, {
    kind: "imported",
    sessionId: ctx.sessionId,
    id: finalId,
    ticketId: ticketRef.ticket.id,
    contactId: candidate.contactId,
    fromMe,
    ts: createdAt.toISOString(),
    mediaType,
    media: Boolean(mediaUrl)
  });
  return "imported";
};

/**
 * O celular responde ao pedido pela identidade LID, mas a whaileys 6.5.1 só
 * mantém atualizada a sessão Signal do endereço PN do próprio aparelho; a
 * resposta falha com "No matching sessions found for message". Como PN e LID
 * são o mesmo aparelho (mesma identidade), copia a sessão PN para o endereço
 * LID antes do pedido, como o Baileys v7 faz na migração de sessões.
 */
export const syncOwnLidSession = async (wbot: any): Promise<boolean> => {
  const keys = wbot?.authState?.keys;
  const me = wbot?.authState?.creds?.me || wbot?.user || {};
  if (!keys?.get || !keys?.set || !me.id || !me.lid) return false;
  const pnAddr = `${String(me.id).split(":")[0].split("@")[0]}.0`;
  const lidAddr = `${String(me.lid).split(":")[0].split("@")[0]}.0`;
  const found = await keys.get("session", [pnAddr]);
  const record = found?.[pnAddr];
  if (!record) return false;
  await keys.set({ session: { [lidAddr]: record } });
  return true;
};

/**
 * Envia o pedido de histórico ao celular principal.
 * A whaileys 6.5.1 endereça o pedido ao LID da própria conta e o servidor
 * responde ack 479; "pn" endereça ao número (device 0), como o WhatsApp Web.
 */
export const sendHistoryRequest = async (
  wbot: any,
  count: number,
  key: { remoteJid: string; id: string; fromMe: boolean },
  timestampMs: number,
  target: "pn" | "lid" | "lib" = (process.env.HISTORY_RECOVERY_TARGET as any) || "pn"
): Promise<string> => {
  // o handler genérico de messaging-history.set ignora o histórico enquanto isso
  // eslint-disable-next-line no-param-reassign
  wbot.onDemandHistoryUntil = Date.now() + 120000;
  if (target === "lib") {
    return wbot.fetchMessageHistory(count, key, timestampMs);
  }
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const { proto, jidNormalizedUser } = require("whaileys");
  const me = wbot?.authState?.creds?.me || wbot?.user || {};
  if (target === "pn" && process.env.HISTORY_RECOVERY_SYNC_LID_SESSION !== "0") {
    await syncOwnLidSession(wbot);
  }
  const dest = jidNormalizedUser(target === "lid" ? me.lid : me.id);
  const accountLid = me.lid ? jidNormalizedUser(me.lid) : undefined;
  const pdoMessage: any = {
    historySyncOnDemandRequest: {
      chatJid: key.remoteJid,
      oldestMsgFromMe: key.fromMe,
      oldestMsgId: key.id,
      oldestMsgTimestampMs: timestampMs,
      onDemandMsgCount: count,
      ...(accountLid ? { accountLid } : {})
    },
    peerDataOperationRequestType:
      proto.Message.PeerDataOperationRequestType.HISTORY_SYNC_ON_DEMAND
  };
  return wbot.relayMessage(
    dest,
    {
      protocolMessage: {
        peerDataOperationRequestMessage: pdoMessage,
        type: proto.Message.ProtocolMessage.Type.PEER_DATA_OPERATION_REQUEST_MESSAGE
      }
    },
    { additionalAttributes: { category: "peer", push_priority: "high_force" } }
  );
};

/** Espera o próximo messaging-history.set ON_DEMAND desta conversa. */
export const waitOnDemandHistory = (
  wbot: any,
  chatJids: string[],
  timeoutMs: number
): Promise<{ messages: any[] } | null> =>
  new Promise(resolve => {
    const jidSet = new Set(chatJids);
    let done = false;
    const finish = (value: { messages: any[] } | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        wbot.ev.off("messaging-history.set", listener);
      } catch {
        /* ignore */
      }
      resolve(value);
    };
    const listener = (data: any) => {
      if (data?.syncType !== ON_DEMAND_SYNC_TYPE) return;
      const messages: any[] = data?.messages || [];
      const chats: any[] = data?.chats || [];
      const related =
        messages.some(m => jidSet.has(m?.key?.remoteJid)) ||
        chats.some(c => jidSet.has(c?.id)) ||
        (messages.length === 0 && chats.length === 0);
      if (related) finish({ messages });
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    wbot.ev.on("messaging-history.set", listener);
  });

/** Conversas candidatas: contatos com ticket individual nesta conexão e atividade recente. */
export const loadCandidates = async (
  sessionId: number,
  sinceMs: number,
  contactIds?: number[]
): Promise<ChatCandidate[]> => {
  const sequelize = (Ticket as any).sequelize;
  const filterContacts =
    contactIds && contactIds.length
      ? `AND c.id IN (${contactIds.map(n => Number(n)).filter(Number.isFinite).join(",")})`
      : "";
  const rows: any[] = await sequelize.query(
    `SELECT c.id AS contactId, c.number AS number, c.lid AS lid,
            MAX(t.updatedAt) AS lastAt
       FROM Tickets t
       JOIN Contacts c ON c.id = t.contactId
      WHERE t.whatsappId = :sessionId
        AND (t.isGroup = 0 OR t.isGroup IS NULL)
        AND (c.isGroup = 0 OR c.isGroup IS NULL)
        AND t.updatedAt >= :since
        ${filterContacts}
      GROUP BY c.id
      ORDER BY lastAt DESC`,
    {
      replacements: { sessionId, since: toDbDate(sinceMs) },
      type: QueryTypes.SELECT
    }
  );
  return rows.filter(r => !String(r.number || "").includes("@g.us"));
};

/** Âncora: a mensagem mais recente que já temos desta conversa nesta conexão. */
export const loadNewestAnchor = async (
  sessionId: number,
  contactId: number
): Promise<Anchor | null> => {
  const sequelize = (Ticket as any).sequelize;
  const rows: any[] = await sequelize.query(
    `SELECT m.id AS id, m.fromMe AS fromMe, m.createdAt AS createdAt
       FROM Messages m
       JOIN Tickets t ON t.id = m.ticketId
      WHERE t.whatsappId = :sessionId AND t.contactId = :contactId
      ORDER BY m.createdAt DESC
      LIMIT 1`,
    { replacements: { sessionId, contactId }, type: QueryTypes.SELECT }
  );
  if (!rows.length) return null;
  const rawId = String(rows[0].id);
  // ids compostos (<ticket>_<id> ou <sessão>_<id>) guardam o id real depois do "_"
  const id = rawId.includes("_") ? rawId.split("_").pop() || rawId : rawId;
  return {
    id,
    fromMe: Boolean(rows[0].fromMe),
    timestampMs: parseDbDate(rows[0].createdAt)
  };
};

const randomAnchorId = (): string =>
  `3EB0${Array.from({ length: 18 }, () =>
    "0123456789ABCDEF"[Math.floor(Math.random() * 16)]
  ).join("")}`;

/** Recupera uma conversa. Retorna quantas mensagens novas gravou. */
export const recoverChat = async (
  candidate: ChatCandidate,
  ctx: ImportContext,
  opts: Required<
    Pick<
      RecoveryOptions,
      "fromMs" | "toMs" | "pauseMs" | "timeoutMs" | "batchSize" | "maxRounds" | "anchor"
    >
  >
): Promise<{ imported: number; responded: boolean; jid?: string }> => {
  const { status, wbot, deps } = ctx;
  const jids = chatJidsFor(candidate);
  if (!jids.length) return { imported: 0, responded: false };

  const newest = await loadNewestAnchor(ctx.sessionId, candidate.contactId);
  let anchor: Anchor =
    opts.anchor === "now" || !newest
      ? { id: randomAnchorId(), fromMe: true, timestampMs: Math.min(Date.now(), opts.toMs) }
      : newest;

  const ticketRef = { ticket: await findTicketFor(candidate.contactId, ctx.sessionId) };
  let imported = 0;
  let responded = false;
  let workingJid: string | undefined;

  for (let round = 0; round < opts.maxRounds; round += 1) {
    if (cancelled.has(ctx.sessionId)) break;
    const tryJids = workingJid ? [workingJid] : jids;
    let result: { messages: any[] } | null = null;
    for (const jid of tryJids) {
      status.requests += 1;
      const waiting = waitOnDemandHistory(wbot, jids, opts.timeoutMs);
      try {
        await sendHistoryRequest(
          wbot,
          opts.batchSize,
          { remoteJid: jid, id: anchor.id, fromMe: anchor.fromMe },
          anchor.timestampMs
        );
      } catch (err: any) {
        status.errors += 1;
        status.lastError = `fetchMessageHistory: ${err?.message || err}`;
      }
      result = await waiting;
      if (result) {
        status.responses += 1;
        const got = result.messages.filter(m => m?.key?.remoteJid && jids.includes(m.key.remoteJid));
        if (got.length) {
          workingJid = got[0].key.remoteJid;
          break;
        }
        if (!workingJid && tryJids.length > 1) {
          // resposta vazia para este jid: tenta o outro formato antes de desistir
          await sleep(opts.pauseMs);
          continue;
        }
        break;
      }
      status.timeouts += 1;
      await sleep(opts.pauseMs);
    }
    if (!result) break;
    responded = true;

    const sel = selectHistoryMessages(
      result.messages,
      jids,
      opts.fromMs,
      opts.toMs,
      deps.helpers
    );
    status.received += sel.forChat;
    status.inWindow += sel.inWindow.length;
    status.ignoredType += sel.ignoredType;

    for (const m of sel.inWindow) {
      try {
        const r = await importRecoveredMessage(m, candidate, ticketRef, ctx);
        if (r === "imported") {
          imported += 1;
          status.imported += 1;
        } else if (r === "exists") {
          status.alreadyInDb += 1;
        }
      } catch (err: any) {
        status.errors += 1;
        status.lastError = `import ${m?.key?.id}: ${err?.message || err}`;
      }
    }

    if (!shouldFetchMore(sel.forChat, sel.oldest, anchor, opts.fromMs, opts.batchSize)) break;
    anchor = sel.oldest as Anchor;
    await sleep(opts.pauseMs);
  }

  return { imported, responded, jid: workingJid };
};

/** Recupera todas as conversas candidatas de uma conexão. */
export const recoverSessionHistory = async (
  sessionId: number,
  options: RecoveryOptions,
  deps: RecoveryDeps
): Promise<RecoveryStatus> => {
  const toMs = options.toMs || Date.now();
  const opts = {
    fromMs: options.fromMs,
    toMs,
    pauseMs: options.pauseMs ?? 2500,
    timeoutMs: options.timeoutMs ?? 25000,
    batchSize: options.batchSize ?? 50,
    maxRounds: options.maxRounds ?? 8,
    anchor: options.anchor || "newest"
  } as const;

  const status: RecoveryStatus = {
    sessionId,
    state: "running",
    dryRun: Boolean(options.dryRun),
    fromMs: opts.fromMs,
    toMs,
    startedAt: new Date().toISOString(),
    chatsTotal: 0,
    chatsDone: 0,
    chatsWithResponse: 0,
    chatsWithImports: 0,
    requests: 0,
    responses: 0,
    timeouts: 0,
    received: 0,
    inWindow: 0,
    imported: 0,
    alreadyInDb: 0,
    ignoredType: 0,
    mediaFailed: 0,
    ticketsCreated: 0,
    errors: 0
  };
  statuses.set(sessionId, status);
  cancelled.delete(sessionId);

  try {
    fs.mkdirSync(reportDir(), { recursive: true });
    status.reportFile = path.join(
      reportDir(),
      `sessao-${sessionId}-${Date.now()}${status.dryRun ? "-dry" : ""}.jsonl`
    );
  } catch {
    status.reportFile = undefined;
  }

  try {
    const wbot = deps.getWbot(sessionId);
    if (!wbot?.user?.id) throw new Error("sessão não conectada");
    if (typeof wbot.fetchMessageHistory !== "function") {
      throw new Error("fetchMessageHistory indisponível nesta versão");
    }

    const since = options.candidatesSinceMs ?? opts.fromMs - 45 * 24 * 3600 * 1000;
    let candidates = await loadCandidates(sessionId, since, options.contactIds);
    if (options.maxChats && options.maxChats > 0) {
      candidates = candidates.slice(0, options.maxChats);
    }
    status.chatsTotal = candidates.length;

    const ctx: ImportContext = {
      sessionId,
      wbot,
      deps,
      status,
      dryRun: status.dryRun,
      downloadMedia: options.downloadMedia !== false,
      reportFile: status.reportFile
    };

    for (const candidate of candidates) {
      if (cancelled.has(sessionId)) {
        status.state = "cancelled";
        break;
      }
      const liveWbot = deps.getWbot(sessionId);
      if (!liveWbot?.user?.id || liveWbot !== ctx.wbot) {
        // socket trocou (reconexão): segue com o novo, se estiver conectado
        if (!liveWbot?.user?.id) throw new Error("sessão desconectou durante a recuperação");
        ctx.wbot = liveWbot;
      }
      try {
        const r = await recoverChat(candidate, ctx, opts);
        if (r.responded) status.chatsWithResponse += 1;
        if (r.imported) status.chatsWithImports += 1;
        appendReport(status.reportFile, {
          kind: "chat",
          sessionId,
          contactId: candidate.contactId,
          jid: r.jid,
          responded: r.responded,
          imported: r.imported
        });
      } catch (err: any) {
        status.errors += 1;
        status.lastError = `chat ${candidate.contactId}: ${err?.message || err}`;
      }
      status.chatsDone += 1;
      await sleep(opts.pauseMs);
    }
    if (status.state === "running") status.state = "done";
  } catch (err: any) {
    status.state = "failed";
    status.lastError = err?.message || String(err);
  }

  status.finishedAt = new Date().toISOString();
  appendReport(status.reportFile, { kind: "summary", ...status });
  logger.info({ info: "[History Recovery] concluída", ...status });
  return status;
};

/** Diagnóstico: um único pedido ao celular, sem gravar nada. */
export const probeChatHistory = async (
  wbot: any,
  jid: string,
  anchor: Anchor,
  count: number,
  timeoutMs: number,
  helpers: Pick<HistoryHelpers, "parseMessageTimestamp">,
  target?: "pn" | "lid" | "lib"
): Promise<any> => {
  // captura de diagnóstico: o que chega do próprio aparelho durante a espera
  const seen: any[] = [];
  const rawTasks: Promise<void>[] = [];
  const meUsers = [wbot?.user?.id, wbot?.user?.lid, wbot?.authState?.creds?.me?.lid]
    .filter(Boolean)
    .map((j: string) => j.split(":")[0].split("@")[0]);

  const onUpsert = (u: any) => {
    for (const m of u?.messages || []) {
      const ru = String(m?.key?.remoteJid || "").split(":")[0].split("@")[0];
      if (meUsers.includes(ru) || m?.messageStubType) {
        seen.push({
          ev: "upsert-any",
          type: u?.type,
          id: m?.key?.id,
          remoteJid: m?.key?.remoteJid,
          stub: m?.messageStubType,
          params: m?.messageStubParameters,
          keys: Object.keys(m?.message || {})
        });
      }
      const pm = m?.message?.protocolMessage;
      if (pm?.historySyncNotification) {
        rawTasks.push(
          (async () => {
            try {
              // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
              const { downloadContentFromMessage, proto: P } = require("whaileys");
              const n = pm.historySyncNotification;
              let buf: Buffer;
              if (n.initialHistBootstrapInlinePayload) {
                buf = require("zlib").inflateSync(n.initialHistBootstrapInlinePayload);
              } else {
                const stream = await downloadContentFromMessage(n, "md-msg-hist", { options: {} });
                const parts: Buffer[] = [];
                for await (const chunk of stream) parts.push(chunk as Buffer);
                buf = require("zlib").inflateSync(Buffer.concat(parts));
              }
              const h = P.HistorySync.decode(buf);
              seen.push({
                ev: "raw-bytes",
                fileLength: String(n.fileLength || ""),
                inflated: buf.length,
                hex: buf.slice(0, 400).toString("hex")
              });
              seen.push({
                ev: "raw-history",
                syncType: h.syncType,
                chunkOrder: h.chunkOrder,
                progress: h.progress,
                conversations: (h.conversations || []).map((c: any) => ({
                  id: c.id,
                  msgs: (c.messages || []).length,
                  endOfHistoryTransfer: c.endOfHistoryTransfer,
                  endType: c.endOfHistoryTransferType,
                  first: c.messages?.[0]?.message?.key?.id,
                  firstTs: String(c.messages?.[0]?.message?.messageTimestamp || ""),
                  last: c.messages?.[c.messages.length - 1]?.message?.key?.id,
                  lastTs: String(c.messages?.[c.messages.length - 1]?.message?.messageTimestamp || "")
                })),
                keys: Object.keys(h.toJSON ? h.toJSON() : h)
              });
            } catch (err: any) {
              seen.push({ ev: "raw-history-error", err: err?.message });
            }
          })()
        );
      }
      if (pm) {
        seen.push({
          ev: "upsert",
          type: pm.type,
          hist: pm.historySyncNotification
            ? {
                syncType: pm.historySyncNotification.syncType,
                chunk: pm.historySyncNotification.chunkOrder,
                peerDataRequestSessionId: pm.historySyncNotification.peerDataRequestSessionId
              }
            : undefined,
          pdo: pm.peerDataOperationRequestResponseMessage
            ? JSON.stringify(pm.peerDataOperationRequestResponseMessage).slice(0, 600)
            : undefined
        });
      }
    }
  };
  const onPdo = (d: any) => seen.push({ ev: "pdo-response", n: d?.messages?.length });
  const onHist = (d: any) =>
    seen.push({
      ev: "history.set",
      keys: Object.keys(d || {}),
      syncType: String(d?.syncType),
      progress: d?.progress,
      n: d?.messages?.length,
      chats: (d?.chats || []).map((c: any) => JSON.stringify(c).slice(0, 400)),
      contacts: (d?.contacts || []).length
    });
  let reqId = "";
  const onFrame = (node: any) => {
    const attrs = node?.attrs || {};
    const fromUser = String(attrs.from || "").split(":")[0].split("@")[0];
    if ((reqId && attrs.id === reqId) || (fromUser && meUsers.includes(fromUser) && node.tag !== "iq")) {
      seen.push({
        ev: "frame",
        tag: node.tag,
        attrs,
        children: Array.isArray(node.content) ? node.content.map((c: any) => c?.tag) : typeof node.content
      });
    }
  };
  wbot.ws?.on?.("frame", onFrame);
  wbot.ev.on("messages.upsert", onUpsert);
  wbot.ev.on("messages.pdo-response", onPdo);
  wbot.ev.on("messaging-history.set", onHist);
  const cleanup = () => {
    wbot.ws?.off?.("frame", onFrame);
    wbot.ev.off("messages.upsert", onUpsert);
    wbot.ev.off("messages.pdo-response", onPdo);
    wbot.ev.off("messaging-history.set", onHist);
  };
  const waiting = waitOnDemandHistory(wbot, [jid], timeoutMs);
  let requestId: string;
  try {
    requestId = await sendHistoryRequest(
      wbot,
      count,
      { remoteJid: jid, id: anchor.id, fromMe: anchor.fromMe },
      anchor.timestampMs,
      target
    );
    reqId = requestId;
  } catch (err: any) {
    cleanup();
    return { error: err?.message || String(err), seen };
  }
  const result = await waiting;
  await Promise.all(rawTasks);
  cleanup();
  if (!result) return { requestId, responded: false, seen };
  const ts = result.messages.map(m => helpers.parseMessageTimestamp(m.messageTimestamp));
  return {
    seen,
    requestId,
    responded: true,
    total: result.messages.length,
    jids: [...new Set(result.messages.map(m => m?.key?.remoteJid))],
    oldest: ts.length ? new Date(Math.min(...ts)).toISOString() : null,
    newest: ts.length ? new Date(Math.max(...ts)).toISOString() : null,
    sample: result.messages.slice(0, 5).map(m => ({
      id: m?.key?.id,
      fromMe: m?.key?.fromMe,
      ts: new Date(helpers.parseMessageTimestamp(m.messageTimestamp)).toISOString(),
      type: Object.keys(m?.message || {})[0]
    }))
  };
};

/* ------------------------------------------------------------------------ */
/* Importação a partir de arquivo (outra cópia da mesma conta WhatsApp,      */
/* ex.: instância Evolution vinculada ao mesmo número).                      */
/* ------------------------------------------------------------------------ */

export interface FileImportOptions {
  fromMs: number;
  toMs?: number;
  dryRun?: boolean;
  downloadMedia?: boolean;
  pauseEvery?: number;
  pauseMs?: number;
}

const digitsOf = (jid?: string | null): string =>
  String(jid || "").split("@")[0].split(":")[0].replace(/\D/g, "");

/** LID e número (PN) de um key do WhatsApp, inclusive com remoteJidAlt (Evolution/Baileys v7). */
export const jidPair = (key: any): { lid?: string; pn?: string } => {
  const jids: string[] = [key?.remoteJid, key?.remoteJidAlt, key?.senderPn, key?.senderLid].filter(
    Boolean
  );
  const lidJid = jids.find(j => j.endsWith("@lid"));
  const pnJid = jids.find(j => j.endsWith("@s.whatsapp.net"));
  return {
    lid: lidJid ? `${digitsOf(lidJid)}@lid` : undefined,
    pn: pnJid ? digitsOf(pnJid) : undefined
  };
};

/** Acha o contato pelo LID ou número; cria sem emitir eventos se não existir. */
export const findOrCreateContactSilently = async (
  key: any,
  pushName: string | undefined,
  dryRun: boolean
): Promise<Contact | null> => {
  const { lid, pn } = jidPair(key);
  if (!lid && !pn) return null;
  const or: any[] = [];
  if (lid) or.push({ lid }, { lid: lid.replace("@lid", "") }, { number: digitsOf(lid) });
  if (pn) or.push({ number: pn });
  const found = await Contact.findAll({ where: { [Op.or]: or } });
  // preferência: mesmo LID, depois número real, depois o que houver
  const byLid = lid
    ? found.find(c => c.lid === lid || c.lid === lid.replace("@lid", ""))
    : undefined;
  const byPn = pn ? found.find(c => c.number === pn) : undefined;
  const existing = byLid || byPn || found[0];
  if (existing) return existing;
  if (dryRun) return null;
  const name = (!key?.fromMe && pushName) || pn || digitsOf(lid);
  return Contact.create({
    name,
    number: pn || digitsOf(lid),
    lid: lid || null,
    isGroup: false,
    email: ""
  } as any);
};

export const importMessagesFromFile = async (
  sessionId: number,
  file: string,
  options: FileImportOptions,
  deps: RecoveryDeps
): Promise<RecoveryStatus> => importMessages(sessionId, { file }, options, deps);

/**
 * Grava, sem efeitos colaterais, mensagens de um messaging-history.set comum
 * (pareamento novo / RECENT). Substitui o handleMessage nesse caminho, que
 * reabria/criava tickets pendentes e trocava o lastMessage por texto antigo.
 */
export const importHistorySet = async (
  sessionId: number,
  messages: any[],
  options: FileImportOptions,
  deps: RecoveryDeps
): Promise<RecoveryStatus> =>
  importMessages(sessionId, { messages, label: "historico" }, options, deps);

export const importMessages = async (
  sessionId: number,
  source: { file?: string; messages?: any[]; label?: string },
  options: FileImportOptions,
  deps: RecoveryDeps
): Promise<RecoveryStatus> => {
  const toMs = options.toMs || Date.now();
  const status: RecoveryStatus = {
    sessionId,
    state: "running",
    dryRun: Boolean(options.dryRun),
    fromMs: options.fromMs,
    toMs,
    startedAt: new Date().toISOString(),
    chatsTotal: 0,
    chatsDone: 0,
    chatsWithResponse: 0,
    chatsWithImports: 0,
    requests: 0,
    responses: 0,
    timeouts: 0,
    received: 0,
    inWindow: 0,
    imported: 0,
    alreadyInDb: 0,
    ignoredType: 0,
    mediaFailed: 0,
    ticketsCreated: 0,
    errors: 0
  };
  statuses.set(sessionId, status);
  cancelled.delete(sessionId);
  try {
    fs.mkdirSync(reportDir(), { recursive: true });
    status.reportFile = path.join(
      reportDir(),
      `${source.label || "arquivo"}-sessao-${sessionId}-${Date.now()}${status.dryRun ? "-dry" : ""}.jsonl`
    );
  } catch {
    status.reportFile = undefined;
  }

  try {
    const { helpers } = deps;
    const raw: any[] = source.messages
      ? source.messages
      : fs
          .readFileSync(source.file as string, "utf8")
          .split("\n")
          .filter(Boolean)
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              status.errors += 1;
              return null;
            }
          })
          .filter(Boolean);
    const seenIds = new Set<string>();
    const msgs: any[] = [];
    for (const m of raw) {
      status.received += 1;
      const id = m?.key?.id;
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      if (!m.message || !helpers.shouldHandleMessage(m)) {
        status.ignoredType += 1;
        continue;
      }
      const ts = helpers.parseMessageTimestamp(m.messageTimestamp);
      if (ts < options.fromMs || ts > toMs) continue;
      msgs.push(m);
    }
    status.inWindow = msgs.length;

    // agrupa por conversa para reaproveitar contato/ticket
    const byChat = new Map<string, any[]>();
    msgs.forEach(m => {
      const { lid, pn } = jidPair(m.key);
      const k = lid || pn || m.key.remoteJid;
      if (!byChat.has(k)) byChat.set(k, []);
      (byChat.get(k) as any[]).push(m);
    });
    status.chatsTotal = byChat.size;

    const live = deps.getWbot(sessionId);
    const wbot = live?.user?.id
      ? live
      : {
          updateMediaMessage: async () => {
            throw new Error("sessão desconectada: sem reupload");
          }
        };
    const ctx: ImportContext = {
      sessionId,
      wbot,
      deps,
      status,
      dryRun: status.dryRun,
      downloadMedia: options.downloadMedia !== false,
      reportFile: status.reportFile
    };

    let n = 0;
    for (const [chatKey, chatMsgs] of byChat.entries()) {
      if (cancelled.has(sessionId)) {
        status.state = "cancelled";
        break;
      }
      chatMsgs.sort(
        (a, b) =>
          helpers.parseMessageTimestamp(a.messageTimestamp) -
          helpers.parseMessageTimestamp(b.messageTimestamp)
      );
      try {
        const incoming = chatMsgs.find(m => !m.key.fromMe);
        const contact = await findOrCreateContactSilently(
          chatMsgs[0].key,
          incoming?.pushName,
          status.dryRun
        );
        const candidate: ChatCandidate = {
          contactId: contact ? contact.id : -1,
          number: contact ? contact.number : "",
          lid: contact ? contact.lid : null
        };
        const ticketRef = {
          ticket: contact ? await findTicketFor(contact.id, sessionId) : null
        };
        let importedHere = 0;
        for (const m of chatMsgs) {
          try {
            if (!contact && !status.dryRun) {
              status.errors += 1;
              status.lastError = `sem contato para ${chatKey}`;
            } else {
              const r = await importRecoveredMessage(m, candidate, ticketRef, ctx);
              if (r === "imported") {
                importedHere += 1;
                status.imported += 1;
              } else if (r === "exists") {
                status.alreadyInDb += 1;
              }
            }
          } catch (err: any) {
            status.errors += 1;
            status.lastError = `import ${m?.key?.id}: ${err?.message || err}`;
          }
          n += 1;
          if (options.pauseEvery && n % options.pauseEvery === 0) {
            await sleep(options.pauseMs ?? 200);
          }
        }
        if (importedHere) status.chatsWithImports += 1;
        appendReport(status.reportFile, {
          kind: "chat",
          sessionId,
          chat: chatKey,
          contactId: candidate.contactId,
          imported: importedHere,
          total: chatMsgs.length
        });
      } catch (err: any) {
        status.errors += 1;
        status.lastError = `chat ${chatKey}: ${err?.message || err}`;
      }
      status.chatsDone += 1;
    }
    if (status.state === "running") status.state = "done";
  } catch (err: any) {
    status.state = "failed";
    status.lastError = err?.message || String(err);
  }
  status.finishedAt = new Date().toISOString();
  appendReport(status.reportFile, { kind: "summary", ...status });
  logger.info({ info: "[History Recovery] importação de arquivo concluída", ...status });
  return status;
};

/** Importa o que já está no store em memória da sessão (ex.: histórico de um re-pareamento). */
export const importFromStore = async (
  sessionId: number,
  options: FileImportOptions,
  deps: RecoveryDeps
): Promise<RecoveryStatus> => {
  const wbot = deps.getWbot(sessionId);
  const all: any[] = [];
  Object.values(wbot?.store?.messages || {}).forEach((list: any) => {
    (list?.array || []).forEach((m: any) => all.push(m));
  });
  return importMessages(sessionId, { messages: all, label: "store" }, options, deps);
};
