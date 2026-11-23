import http from "http";
import { URL } from "url";

import { logger } from "../utils/logger";

// Repasse ("tap") das mensagens cruas da conexão da Marcela ao robô dela.
// Tudo é no-op sem MARCELA_BOT_URL / MARCELA_WHATSAPP_ID no ambiente.
// Nunca lança, nunca é aguardado: o fluxo do CRM segue igual.

const TAP_TIMEOUT_MS = 10000;

export const marcelaTapId = (): number =>
  Number(process.env.MARCELA_WHATSAPP_ID || 0);

// Conexões atendidas pelo robô: a principal (MARCELA_WHATSAPP_ID + MARCELA_INSTANCE)
// e as de MARCELA_CONEXOES_EXTRAS, JSON {"<id da conexão>": "<instância>"}.
let conexoesMemo: { chave: string; mapa: Map<number, string> } | null = null;

export const marcelaConexoes = (): Map<number, string> => {
  const principal = marcelaTapId();
  const instancia = process.env.MARCELA_INSTANCE || "veritas2";
  const extras = process.env.MARCELA_CONEXOES_EXTRAS || "";
  const chave = `${principal}|${instancia}|${extras}`;
  if (conexoesMemo?.chave === chave) return conexoesMemo.mapa;

  const mapa = new Map<number, string>();
  if (principal) mapa.set(principal, instancia);
  if (extras.trim()) {
    try {
      Object.entries(JSON.parse(extras)).forEach(([id, nome]) => {
        const conexao = Number(id);
        const valido =
          Number.isInteger(conexao) &&
          conexao > 0 &&
          typeof nome === "string" &&
          nome.trim() !== "" &&
          !mapa.has(conexao) &&
          ![...mapa.values()].includes(nome.trim());
        if (valido) mapa.set(conexao, (nome as string).trim());
      });
    } catch (err) {
      logger.warn({ info: "MARCELA_CONEXOES_EXTRAS inválido", err: err?.message });
    }
  }
  conexoesMemo = { chave, mapa };
  return mapa;
};

export function shouldTap(sessionId: number, msg: any): boolean {
  if (!process.env.MARCELA_BOT_URL) return false;
  if (!marcelaConexoes().has(sessionId)) return false;

  const remoteJid: string | undefined = msg?.key?.remoteJid;
  if (!remoteJid || typeof remoteJid !== "string") return false;

  const groupJid = process.env.MARCELA_GROUP_JID;
  // O grupo entra só pela conexão principal, para não chegar duas vezes ao robô.
  if (groupJid && remoteJid === groupJid) return sessionId === marcelaTapId();
  if (remoteJid.endsWith("@s.whatsapp.net")) return true;
  if (remoteJid.endsWith("@lid")) return true;

  // outros grupos, broadcast, newsletter, status
  return false;
}

const isLongLike = (value: any): boolean =>
  value &&
  typeof value === "object" &&
  (typeof value.toNumber === "function" ||
    (typeof value.low === "number" &&
      typeof value.high === "number" &&
      typeof value.unsigned === "boolean"));

const longToNumber = (value: any): number => {
  if (typeof value.toNumber === "function") return value.toNumber();
  const { low, high, unsigned } = value;
  const lowUnsigned = low >>> 0;
  if (unsigned) return (high >>> 0) * 4294967296 + lowUnsigned;
  return high * 4294967296 + lowUnsigned;
};

// Deixa a mensagem crua do Baileys segura para JSON:
// Buffer/Uint8Array -> base64, Long -> number.
export const jsonReplacer = (_key: string, value: any): any => {
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  if (
    value &&
    typeof value === "object" &&
    value.type === "Buffer" &&
    Array.isArray(value.data)
  ) {
    return Buffer.from(value.data).toString("base64");
  }
  if (isLongLike(value)) return longToNumber(value);
  return value;
};

export function tapMarcela(event: string, data: any, sessionId: number): void {
  try {
    const botUrl = process.env.MARCELA_BOT_URL;
    if (!botUrl) return;
    const instance = marcelaConexoes().get(sessionId);
    if (!instance) return;

    let url: URL;
    try {
      url = new URL(botUrl);
    } catch {
      logger.warn({ info: "marcela tap falhou", event, err: "MARCELA_BOT_URL inválida" });
      return;
    }
    if (url.protocol !== "http:") {
      logger.warn({ info: "marcela tap falhou", event, err: "só http é suportado" });
      return;
    }

    const payload = JSON.stringify(
      {
        event,
        instance,
        data
      },
      jsonReplacer
    );

    const headers: http.OutgoingHttpHeaders = {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload)
    };
    if (process.env.MARCELA_BOT_TOKEN) {
      headers["x-marcela-token"] = process.env.MARCELA_BOT_TOKEN;
    }

    const req = http.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port || 80,
        path: `${url.pathname}${url.search}`,
        headers,
        timeout: TAP_TIMEOUT_MS
      },
      res => {
        // consome a resposta para liberar o socket
        res.on("data", () => undefined);
        res.on("end", () => undefined);
        res.on("error", () => undefined);
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (err: any) => {
      logger.warn({ info: "marcela tap falhou", event, err: err?.message });
    });

    req.end(payload);
  } catch (err) {
    logger.warn({ info: "marcela tap falhou", event, err: err?.message });
  }
}
