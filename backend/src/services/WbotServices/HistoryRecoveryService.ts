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
        await wbot.fetchMessageHistory(
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
  helpers: Pick<HistoryHelpers, "parseMessageTimestamp">
): Promise<any> => {
  const waiting = waitOnDemandHistory(wbot, [jid], timeoutMs);
  const requestId = await wbot.fetchMessageHistory(
    count,
    { remoteJid: jid, id: anchor.id, fromMe: anchor.fromMe },
    anchor.timestampMs
  );
  const result = await waiting;
  if (!result) return { requestId, responded: false };
  const ts = result.messages.map(m => helpers.parseMessageTimestamp(m.messageTimestamp));
  return {
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
