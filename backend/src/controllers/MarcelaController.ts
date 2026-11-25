import { Request, Response } from "express";
import { AnyMessageContent, MiscMessageGenerationOptions } from "whaileys";

import { getWbot, loggerWhaileys } from "../providers/WhatsApp/Implementations/whaileys"; // Item #21
import { marcelaConexoes } from "../helpers/marcelaTap";
import { logger } from "../utils/logger";

// Envio pela conexão da Marcela (MARCELA_WHATSAPP_ID) direto no socket do
// Baileys. Não cria Contact/Ticket/Message: o CRM continua ignorando essa
// conversa, que é tratada pelo robô.

type Tipo = "texto" | "documento" | "reagir";

interface SendBody {
  tipo?: Tipo;
  numero?: string;
  texto?: string;
  delay?: number | string;
  base64?: string;
  nome_arquivo?: string;
  mensagem_id?: string;
  participante?: string;
  texto_citado?: string;
  emoji?: string;
  instancia?: string;
}

const TIPOS: Tipo[] = ["texto", "documento", "reagir"];
const MAX_DELAY_MS = 8000;

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const toJid = (numero: string): string =>
  numero.includes("@")
    ? numero
    : `${numero.replace(/\D/g, "")}@s.whatsapp.net`;

const validate = (body: SendBody): string | null => {
  if (!body.numero || typeof body.numero !== "string") {
    return "numero obrigatório";
  }
  if (!body.tipo || !TIPOS.includes(body.tipo)) {
    return "tipo deve ser texto, documento ou reagir";
  }
  if (body.tipo === "texto" && typeof body.texto !== "string") {
    return "texto obrigatório";
  }
  if (body.tipo === "documento" && (!body.base64 || !body.nome_arquivo)) {
    return "base64 e nome_arquivo obrigatórios";
  }
  if (body.tipo === "reagir" && (!body.mensagem_id || body.emoji === undefined)) {
    return "mensagem_id e emoji obrigatórios";
  }
  return null;
};

// Sem instância, a conexão principal. Instância desconhecida nunca sai por outro número.
const conexaoDoEnvio = (instancia?: string): number | null => {
  if (!instancia) return Number(process.env.MARCELA_WHATSAPP_ID || 2);
  const achada = [...marcelaConexoes().entries()].find(([, nome]) => nome === instancia);
  return achada ? achada[0] : null;
};

export const send = async (req: Request, res: Response): Promise<Response> => {
  const body = (req.body || {}) as SendBody;

  const erro = validate(body);
  if (erro) {
    return res.status(400).json({ ok: false, erro });
  }

  const tipo = body.tipo as Tipo;
  const jid = toJid(body.numero as string);
  const id = conexaoDoEnvio(body.instancia);
  if (id === null) {
    return res.status(400).json({ ok: false, erro: "instância desconhecida" });
  }

  try {
    const wbot = getWbot(id);

    const quotedKey = body.mensagem_id
      ? {
          remoteJid: jid,
          id: body.mensagem_id,
          fromMe: false,
          participant: body.participante || undefined
        }
      : undefined;

    const quotedOpt: MiscMessageGenerationOptions | undefined =
      quotedKey && tipo !== "reagir"
        ? {
            quoted: {
              key: quotedKey,
              message: { conversation: body.texto_citado || "" }
            }
          }
        : undefined;

    let content: AnyMessageContent;

    if (tipo === "texto") {
      await wbot.sendPresenceUpdate("composing", jid);
      const delay = Math.min(Number(body.delay) || 0, MAX_DELAY_MS);
      if (delay > 0) await sleep(delay);
      content = { text: body.texto as string };
    } else if (tipo === "documento") {
      content = {
        document: Buffer.from(body.base64 as string, "base64"),
        mimetype: "application/pdf",
        fileName: body.nome_arquivo as string,
        caption: body.texto || undefined
      };
    } else {
      content = {
        react: {
          text: body.emoji as string,
          key: quotedKey
        }
      };
    }

    const sent = await wbot.sendMessage(jid, content, quotedOpt);

    return res.json({ ok: true, mensagem_id: sent?.key?.id });
  } catch (err) {
    logger.warn({
      info: "marcela send falhou",
      tipo,
      jid,
      err: String(err?.message || err)
    });
    return res.status(500).json({ ok: false, erro: String(err?.message || err) });
  }
};

// Item #21 (24/11): o WhatsApp só manda o "archived" das conversas JÁ arquivadas no snapshot do app-state
// (coleção regular_low). Zera só a versão regular_low da conexão e pede o snapshot (resyncAppState, isInitialSync
// false = chats.update sem condicional). O tap de chats.update leva cada conversa ao robô. Sem logout, sem QR, sem
// mensagem. Se o snapshot falhar, a versão de antes volta.
const COLECAO_ARQUIVO = "regular_low";

export const resyncArquivadas = async (req: Request, res: Response): Promise<Response> => {
  const id = Number((req.body && req.body.conexao) || req.query.conexao);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, erro: "conexao obrigatória" });
  }
  let wbot: any;
  try {
    wbot = getWbot(id);
  } catch (err) {
    return res.status(404).json({ ok: false, erro: "conexão não iniciada" });
  }
  const chaves = wbot.authState && wbot.authState.keys;
  if (!chaves || typeof wbot.resyncAppState !== "function") {
    return res.status(500).json({ ok: false, erro: "socket sem resyncAppState/authState" });
  }
  const versao = async (): Promise<any> =>
    (await chaves.get("app-state-sync-version", [COLECAO_ARQUIVO]))[COLECAO_ARQUIVO] || null;
  const vistos = new Map<string, boolean>();
  const ouvir = (updates: any[]): void => {
    (updates || []).forEach((u: any) => {
      if (u && typeof u.id === "string" && !u.id.endsWith("@g.us") && typeof u.archived === "boolean") {
        vistos.set(u.id, u.archived);
      }
    });
  };
  const antes = await versao();
  const falhas: string[] = [];
  const loggerSocket: any = loggerWhaileys();
  const infoOriginal = loggerSocket && loggerSocket.info;
  wbot.ev.on("chats.update", ouvir);
  try {
    if (loggerSocket && typeof infoOriginal === "function") {
      loggerSocket.info = (...args: any[]) => {
        const texto = args.map(a => (typeof a === "string" ? a : "")).join(" ");
        if (/failed to sync state/.test(texto)) {
          const erro = args.find(a => a && typeof a === "object" && a.error);
          falhas.push(String((erro && erro.error) || texto).split("\n")[0].slice(0, 300));
        }
        return infoOriginal.apply(loggerSocket, args);
      };
    }
    await chaves.set({ "app-state-sync-version": { [COLECAO_ARQUIVO]: null } });
    await wbot.resyncAppState([COLECAO_ARQUIVO], false);
    await sleep(3000);
  } catch (err) {
    falhas.push(String(err?.message || err).slice(0, 300));
  } finally {
    wbot.ev.off("chats.update", ouvir);
    if (loggerSocket && typeof infoOriginal === "function") loggerSocket.info = infoOriginal;
  }
  let depois = await versao();
  let restaurada = false;
  if (!depois && antes) {
    await chaves.set({ "app-state-sync-version": { [COLECAO_ARQUIVO]: antes } });
    depois = await versao();
    restaurada = true;
  }
  const arquivadas = [...vistos.values()].filter(Boolean).length;
  logger.info({
    info: "marcela resync-arquivadas",
    conexao: id,
    versaoAntes: antes ? antes.version : null,
    versaoDepois: depois ? depois.version : null,
    arquivadas,
    desarquivadas: vistos.size - arquivadas,
    falhas: falhas.length
  });
  return res.json({
    ok: !!depois && !restaurada,
    conexao: id,
    versao_antes: antes ? antes.version : null,
    versao_depois: depois ? depois.version : null,
    versao_restaurada: restaurada,
    chats_com_estado: vistos.size,
    arquivadas,
    desarquivadas: vistos.size - arquivadas,
    falhas
  });
};
