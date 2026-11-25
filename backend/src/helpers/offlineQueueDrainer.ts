/**
 * Drenagem da fila offline do WhatsApp.
 *
 * Ao conectar, o servidor do WhatsApp avisa quantos itens ficaram pendentes
 * (`<ib><offline_preview count="N"/></ib>`) e só entrega esses itens quando o
 * cliente pede lotes com `<ib><offline_batch count="100"/></ib>`, um pedido
 * por lote. O whaileys 6.5.1 não faz esse pedido. Enquanto a fila não esvazia:
 *  - o servidor não entrega nem as mensagens novas da conexão;
 *  - o whaileys fica em modo "buffering" (só libera eventos ao receber
 *    `<ib><offline/></ib>`), então nenhum `messages.upsert` chega ao VERITAS.
 * Uma conexão que acumulou mais itens do que o servidor entrega sem pedido
 * ficava muda para sempre (ex.: ARTHUR 1827, parada desde 06/11/2026 com 9037
 * itens na fila). Este helper pede os lotes em sequência até o servidor
 * sinalizar o fim da fila, liberando os eventos a cada lote.
 */

export interface DrainLogger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}

export interface DrainableSocket {
  ws: {
    on: (event: string, listener: (node: any) => void) => unknown;
    readyState: number;
  };
  sendNode: (node: any) => Promise<void>;
  ev: { flush: () => unknown };
}

export interface DrainOptions {
  sessionId: number;
  logger: DrainLogger;
  /** itens pedidos por lote (o WhatsApp Web usa 100) */
  batchSize?: number;
  /** silêncio no socket que indica o fim da entrega de um lote */
  idleMs?: number;
  /** espera máxima por lote, mesmo com tráfego ao vivo no socket */
  maxWaitMs?: number;
}

const WS_OPEN = 1;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const buildOfflineBatchNode = (count: number): any => ({
  tag: "ib",
  attrs: {},
  content: [{ tag: "offline_batch", attrs: { count: String(count) } }]
});

const previewCount = (node: any): number => {
  const child = Array.isArray(node?.content)
    ? node.content.find((c: any) => c?.tag === "offline_preview")
    : undefined;
  const n = Number(child?.attrs?.count);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const attachOfflineQueueDrainer = (
  sock: DrainableSocket,
  {
    sessionId,
    logger,
    batchSize = 100,
    idleMs = 1500,
    maxWaitMs = 15000
  }: DrainOptions
): void => {
  let finished = false;
  let draining = false;
  let lastFrameAt = Date.now();

  sock.ws.on("frame", () => {
    lastFrameAt = Date.now();
  });

  // fim da fila offline: o próprio whaileys libera o buffer nesse momento
  sock.ws.on("CB:ib,,offline", () => {
    finished = true;
  });

  const waitBatch = async () => {
    const started = Date.now();
    // dá tempo do servidor começar a responder antes de medir o silêncio
    await wait(Math.min(idleMs, 500));
    while (
      !finished &&
      sock.ws.readyState === WS_OPEN &&
      Date.now() - lastFrameAt < idleMs &&
      Date.now() - started < maxWaitMs
    ) {
      await wait(Math.min(idleMs, 250));
    }
  };

  const drain = async (count: number) => {
    draining = true;
    const maxBatches = Math.ceil(count / batchSize) + 50;
    let batches = 0;
    try {
      while (
        !finished &&
        sock.ws.readyState === WS_OPEN &&
        batches < maxBatches
      ) {
        await sock.sendNode(buildOfflineBatchNode(batchSize));
        batches += 1;
        await waitBatch();
        // libera ao VERITAS o que já chegou, sem esperar a fila inteira
        await sock.ev.flush();
      }
      logger.info({
        info: "[Offline Queue] Fila offline drenada",
        sessionId,
        pending: count,
        batches,
        finished
      });
    } catch (err) {
      logger.warn({
        info: "[Offline Queue] Falha ao drenar a fila offline",
        sessionId,
        batches,
        err
      });
    } finally {
      draining = false;
    }
  };

  sock.ws.on("CB:ib,,offline_preview", (node: any) => {
    if (draining || finished) return;
    const count = previewCount(node);
    logger.info({
      info: "[Offline Queue] offline_preview recebido, pedindo lotes",
      sessionId,
      pending: count
    });
    drain(Math.max(count, batchSize)).catch(() => undefined);
  });
};

/** Limita quantas tarefas rodam ao mesmo tempo (fila FIFO). */
export const createLimiter = (concurrency: number) => {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= concurrency) return;
    const run = queue.shift();
    if (run) run();
  };

  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        active += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            next();
          });
      });
      next();
    });
};
