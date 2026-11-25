import { EventEmitter } from "events";
import {
  chatJidsFor,
  parseDbDate,
  selectHistoryMessages,
  shouldFetchMore,
  toDbDate,
  waitOnDemandHistory,
  ON_DEMAND_SYNC_TYPE
} from "../../../services/WbotServices/HistoryRecoveryService";

const helpers = {
  shouldHandleMessage: (m: any) => Boolean(m.message?.conversation),
  parseMessageTimestamp: (ts: any) => Number(ts) * 1000
};

const msg = (id: string, jid: string, tsSec: number, text = "oi") => ({
  key: { id, remoteJid: jid, fromMe: false },
  messageTimestamp: tsSec,
  message: text ? { conversation: text } : { reactionMessage: {} }
});

const LID = "123@lid";
const PN = "5547999999999@s.whatsapp.net";

describe("HistoryRecoveryService", () => {
  it("monta os JIDs da conversa: LID primeiro, depois número", () => {
    expect(chatJidsFor({ contactId: 1, number: "5547999999999", lid: "123@lid" })).toEqual([LID, PN]);
    expect(chatJidsFor({ contactId: 1, number: "5547999999999", lid: "123" })).toEqual([LID, PN]);
    expect(chatJidsFor({ contactId: 1, number: "5547999999999" })).toEqual([PN]);
  });

  it("converte datas do SQLite nos dois sentidos", () => {
    const ms = Date.UTC(2026, 10, 7, 12, 30, 0);
    expect(toDbDate(ms)).toBe("2026-11-07 12:30:00.000 +00:00");
    expect(parseDbDate("2026-11-07 12:30:00.000 +00:00")).toBe(ms);
  });

  it("seleciona só mensagens da conversa, tratáveis e dentro da janela", () => {
    const from = 1000 * 1000;
    const to = 2000 * 1000;
    const sel = selectHistoryMessages(
      [
        msg("A", LID, 900), // antes da janela
        msg("B", LID, 1500),
        msg("C", PN, 1200),
        msg("D", "999@lid", 1500), // outra conversa
        msg("E", LID, 1600, ""), // tipo ignorado
        msg("F", LID, 2500) // depois da janela
      ],
      [LID, PN],
      from,
      to,
      helpers
    );
    expect(sel.inWindow.map(m => m.key.id)).toEqual(["C", "B"]);
    expect(sel.forChat).toBe(5);
    expect(sel.ignoredType).toBe(1);
    expect(sel.oldest).toEqual({ id: "A", fromMe: false, timestampMs: 900000 });
  });

  it("continua buscando só enquanto o lote vem cheio e não passou do início", () => {
    const prev = { id: "X", fromMe: false, timestampMs: 5000 };
    const oldest = { id: "Y", fromMe: false, timestampMs: 3000 };
    expect(shouldFetchMore(50, oldest, prev, 1000, 50)).toBe(true);
    expect(shouldFetchMore(10, oldest, prev, 1000, 50)).toBe(false); // lote curto: acabou
    expect(shouldFetchMore(50, oldest, prev, 4000, 50)).toBe(false); // já passou do início
    expect(shouldFetchMore(50, prev, prev, 1000, 50)).toBe(false); // âncora não andou
    expect(shouldFetchMore(0, undefined, prev, 1000, 50)).toBe(false);
  });

  it("espera a resposta ON_DEMAND da conversa e ignora outras", async () => {
    const ee = new EventEmitter();
    const wbot = { ev: ee };
    const p = waitOnDemandHistory(wbot, [LID, PN], 500);
    ee.emit("messaging-history.set", { syncType: 2, messages: [msg("Z", LID, 1)] }); // não é ON_DEMAND
    ee.emit("messaging-history.set", { syncType: ON_DEMAND_SYNC_TYPE, messages: [msg("W", "999@lid", 1)], chats: [{ id: "999@lid" }] });
    ee.emit("messaging-history.set", { syncType: ON_DEMAND_SYNC_TYPE, messages: [msg("B", LID, 1)], chats: [] });
    const r = await p;
    expect(r?.messages.map(m => m.key.id)).toEqual(["B"]);
    expect(ee.listenerCount("messaging-history.set")).toBe(0);
  });

  it("devolve null no timeout e remove o listener", async () => {
    const ee = new EventEmitter();
    const r = await waitOnDemandHistory({ ev: ee }, [LID], 20);
    expect(r).toBeNull();
    expect(ee.listenerCount("messaging-history.set")).toBe(0);
  });
});
