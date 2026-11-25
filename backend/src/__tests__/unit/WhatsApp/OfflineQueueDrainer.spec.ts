import { EventEmitter } from "events";
import {
  attachOfflineQueueDrainer,
  buildOfflineBatchNode,
  createLimiter
} from "../../../helpers/offlineQueueDrainer";

const silentLogger = { info: jest.fn(), warn: jest.fn() };

const previewNode = (count: number) => ({
  tag: "ib",
  attrs: { from: "s.whatsapp.net" },
  content: [{ tag: "offline_preview", attrs: { count: String(count) } }]
});

/**
 * Simula o servidor: cada offline_batch entrega até `batch` itens da fila
 * (frames) e, quando a fila acaba, manda <ib><offline/></ib>.
 */
const makeFakeSocket = (pending: number) => {
  const ws = new EventEmitter() as EventEmitter & { readyState: number };
  ws.readyState = 1;
  let left = pending;
  const sent: any[] = [];
  const flush = jest.fn();
  const sock = {
    ws,
    ev: { flush },
    sendNode: jest.fn(async (node: any) => {
      sent.push(node);
      const batch = Number(node.content[0].attrs.count);
      setTimeout(() => {
        const n = Math.min(batch, left);
        left -= n;
        for (let i = 0; i < n; i += 1) ws.emit("frame", { tag: "message" });
        if (left === 0) ws.emit("CB:ib,,offline", { tag: "ib" });
      }, 5);
    })
  };
  return { sock, sent, flush, left: () => left };
};

const waitFor = async (cond: () => boolean, timeoutMs = 5000) => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("timeout");
    await new Promise(r => setTimeout(r, 10));
  }
};

describe("attachOfflineQueueDrainer", () => {
  it("pede lotes até o servidor esvaziar a fila offline", async () => {
    const { sock, sent, flush, left } = makeFakeSocket(350);
    attachOfflineQueueDrainer(sock, {
      sessionId: 8,
      logger: silentLogger,
      idleMs: 30,
      maxWaitMs: 500
    });

    sock.ws.emit("CB:ib,,offline_preview", previewNode(350));

    await waitFor(() => left() === 0 && flush.mock.calls.length >= 4);
    expect(sent).toHaveLength(4);
    expect(sent[0]).toEqual(buildOfflineBatchNode(100));
    // eventos liberados a cada lote, não só no fim da fila
    expect(flush.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it("não dispara uma segunda drenagem em paralelo", async () => {
    const { sock, sent, left } = makeFakeSocket(150);
    attachOfflineQueueDrainer(sock, {
      sessionId: 8,
      logger: silentLogger,
      idleMs: 30,
      maxWaitMs: 500
    });

    sock.ws.emit("CB:ib,,offline_preview", previewNode(150));
    sock.ws.emit("CB:ib,,offline_preview", previewNode(150));

    await waitFor(() => left() === 0);
    await new Promise(r => setTimeout(r, 100));
    expect(sent).toHaveLength(2);
  });

  it("para quando o socket fecha", async () => {
    const { sock, sent } = makeFakeSocket(10000);
    attachOfflineQueueDrainer(sock, {
      sessionId: 8,
      logger: silentLogger,
      idleMs: 30,
      maxWaitMs: 500
    });

    sock.ws.emit("CB:ib,,offline_preview", previewNode(10000));
    await waitFor(() => sent.length >= 2);
    sock.ws.readyState = 3;
    const sentAtClose = sent.length;
    await new Promise(r => setTimeout(r, 300));
    expect(sent.length).toBeLessThanOrEqual(sentAtClose + 1);
  });
});

describe("createLimiter", () => {
  it("respeita a concorrência máxima e conclui todas as tarefas", async () => {
    const limit = createLimiter(3);
    let active = 0;
    let peak = 0;
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        limit(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise(r => setTimeout(r, 5));
          active -= 1;
          return i;
        })
      )
    );
    expect(peak).toBeLessThanOrEqual(3);
    expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("propaga erro sem travar a fila", async () => {
    const limit = createLimiter(1);
    await expect(
      limit(async () => {
        throw new Error("x");
      })
    ).rejects.toThrow("x");
    await expect(limit(async () => 42)).resolves.toBe(42);
  });
});
