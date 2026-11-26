import { NextFunction, Request, Response } from "express";
import { AnyMessageContent } from "whaileys";

import {
  isIpAllowed,
  normalizeRemoteIp,
  tokenMatches
} from "../middleware/isMarcelaInternal";
import { getWbot } from "../providers/WhatsApp/Implementations/whaileys";
import {
  arquivoAtivo,
  conexoesArquivo,
  retratoArquivo,
  situacaoArquivo,
  validadeArquivoS
} from "../helpers/retornoIaArquivo";
import { logger } from "../utils/logger";

// Envio do retorno_ia (PA FIXA) pelos chips autorizados, direto no socket: não
// marca o ticket como lido. O eco da mensagem entra no CRM como qualquer envio
// do aparelho. Fica desligada (503) sem RETORNO_IA_INTERNAL_TOKEN.
//
// Fase 0a do negociador: além de texto, aceita documento, imagem e áudio (base64),
// só com RETORNO_IA_MAX_MIDIA_BYTES > 0 (teto em bytes do arquivo decodificado;
// sem ele, mídia é recusada). Todo erro sai com `codigo` estável e sem detalhe interno.
// Pedido antigo, sem `tipo`, continua sendo texto.

type Tipo = "texto" | "documento" | "imagem" | "audio";

interface SendBody {
  whatsappId?: number;
  numero?: string;
  tipo?: Tipo;
  texto?: string;
  delay?: number | string;
  base64?: string;
  mimetype?: string;
  nome_arquivo?: string;
  ptt?: boolean;
}

const TIPOS: Tipo[] = ["texto", "documento", "imagem", "audio"];
const MAX_DELAY_MS = 8000;
const MAX_TEXTO = 3500;
const MAX_LEGENDA = 1000;
const MAX_NOME_ARQUIVO = 200;
const MIMETYPE_RE =
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(;\s*[a-z0-9_.+-]+=[a-z0-9_.+-]+)*$/i;
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

// Revisão M6: lista branca por tipo (o mimetype só sintático aceitava text/html, svg, .exe).
const MIMETYPES: Record<Tipo, string[]> = {
  texto: [],
  documento: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ],
  imagem: ["image/jpeg", "image/png", "image/webp"],
  audio: [
    "audio/ogg",
    "audio/opus",
    "audio/mpeg",
    "audio/mp4",
    "audio/aac",
    "audio/amr"
  ]
};
const EXTENSOES = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "txt",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ogg",
  "opus",
  "mp3",
  "m4a",
  "aac",
  "amr"
];

// Revisão I4: trava server-side de arquivadas, desligada por padrão.
export const travaArquivadasLigada = (): boolean =>
  process.env.RETORNO_IA_TRAVA_ARQUIVADAS === "1";

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export const conexoesLiberadas = (valor?: string): Set<number> =>
  new Set(
    (valor || "")
      .split(",")
      .map(x => Number(x.trim()))
      .filter(x => Number.isInteger(x) && x > 0)
  );

export const maxMidiaBytes = (): number => {
  const v = Number(process.env.RETORNO_IA_MAX_MIDIA_BYTES);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
};

type Codigo =
  | "ERR_ROTA_DESLIGADA"
  | "ERR_ORIGEM_NAO_PERMITIDA"
  | "ERR_TOKEN_INVALIDO"
  | "ERR_CONEXAO_NAO_LIBERADA"
  | "ERR_NUMERO_INVALIDO"
  | "ERR_TIPO_INVALIDO"
  | "ERR_TEXTO_INVALIDO"
  | "ERR_MIDIA_DESLIGADA"
  | "ERR_MIDIA_INVALIDA"
  | "ERR_MIMETYPE_INVALIDO"
  | "ERR_NOME_ARQUIVO_INVALIDO"
  | "ERR_MIDIA_GRANDE"
  | "ERR_ARQUIVADA"
  | "ERR_WAPP_NOT_INITIALIZED"
  | "ERR_ENVIO_FALHOU"
  | "ERR_SEM_MENSAGEM_ID";

// `erro` continua existindo para o cliente atual; `codigo` é o contrato novo.
const falha = (
  res: Response,
  status: number,
  codigo: Codigo,
  erro: string
): Response => res.status(status).json({ ok: false, codigo, erro });

export const autorizar = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const esperado = process.env.RETORNO_IA_INTERNAL_TOKEN || "";
  if (!esperado) {
    falha(res, 503, "ERR_ROTA_DESLIGADA", "rota desligada");
    return;
  }
  const ip = normalizeRemoteIp(req.socket?.remoteAddress);
  if (!isIpAllowed(ip, process.env.MARCELA_ALLOWED_IPS)) {
    falha(res, 403, "ERR_ORIGEM_NAO_PERMITIDA", "origem não permitida");
    return;
  }
  if (!tokenMatches(req.headers["x-retorno-ia-token"], esperado)) {
    falha(res, 401, "ERR_TOKEN_INVALIDO", "token inválido");
    return;
  }
  next();
};

// Tamanho decodificado sem decodificar (base64 sem quebras).
const bytesDoBase64 = (b64: string): number => {
  const pad = (b64.match(/=+$/) || [""])[0].length;
  return Math.floor((b64.length * 3) / 4) - pad;
};

interface Validado {
  tipo: Tipo;
  conteudo?: AnyMessageContent;
}

type Recusa = { status: number; codigo: Codigo; erro: string };

const validarMidia = (body: SendBody, tipo: Tipo): Validado | Recusa => {
  const teto = maxMidiaBytes();
  if (!teto) {
    return {
      status: 403,
      codigo: "ERR_MIDIA_DESLIGADA",
      erro: "envio de mídia desligado"
    };
  }
  const b64 =
    typeof body.base64 === "string" ? body.base64.replace(/\s+/g, "") : "";
  if (!b64 || b64.length % 4 !== 0 || !BASE64_RE.test(b64)) {
    return {
      status: 400,
      codigo: "ERR_MIDIA_INVALIDA",
      erro: "base64 inválido"
    };
  }
  // Recusa antes de alocar o buffer.
  if (bytesDoBase64(b64) > teto) {
    return {
      status: 413,
      codigo: "ERR_MIDIA_GRANDE",
      erro: "arquivo acima do teto"
    };
  }
  const mimetype =
    typeof body.mimetype === "string" ? body.mimetype.trim() : "";
  const base = mimetype.split(";")[0].trim().toLowerCase();
  if (
    !mimetype ||
    mimetype.length > 100 ||
    !MIMETYPE_RE.test(mimetype) ||
    !MIMETYPES[tipo].includes(base)
  ) {
    return {
      status: 400,
      codigo: "ERR_MIMETYPE_INVALIDO",
      erro: "mimetype inválido"
    };
  }
  const nome =
    typeof body.nome_arquivo === "string" ? body.nome_arquivo.trim() : "";
  if (
    (tipo === "documento" && !nome) ||
    nome.length > MAX_NOME_ARQUIVO ||
    // eslint-disable-next-line no-control-regex
    /[\\/\u0000-\u001f\u007f]/.test(nome) ||
    (nome.includes(".") &&
      !EXTENSOES.includes((nome.split(".").pop() || "").toLowerCase()))
  ) {
    return {
      status: 400,
      codigo: "ERR_NOME_ARQUIVO_INVALIDO",
      erro: "nome_arquivo inválido"
    };
  }
  const legenda =
    typeof body.texto === "string" && body.texto.trim()
      ? body.texto
      : undefined;
  if (legenda && legenda.length > MAX_LEGENDA) {
    return {
      status: 400,
      codigo: "ERR_TEXTO_INVALIDO",
      erro: "legenda inválida"
    };
  }
  const dados = Buffer.from(b64, "base64");
  if (!dados.length) {
    return {
      status: 400,
      codigo: "ERR_MIDIA_INVALIDA",
      erro: "base64 inválido"
    };
  }

  let conteudo: AnyMessageContent;
  if (tipo === "documento") {
    conteudo = { document: dados, mimetype, fileName: nome, caption: legenda };
  } else if (tipo === "imagem") {
    conteudo = { image: dados, mimetype, caption: legenda };
  } else {
    conteudo = { audio: dados, mimetype, ptt: body.ptt === true };
  }
  return { tipo, conteudo };
};

export const validarPedido = (body: SendBody): Validado | Recusa => {
  const tipo = (
    body.tipo === undefined || body.tipo === null ? "texto" : body.tipo
  ) as Tipo;
  if (!TIPOS.includes(tipo)) {
    return {
      status: 400,
      codigo: "ERR_TIPO_INVALIDO",
      erro: "tipo deve ser texto, documento, imagem ou audio"
    };
  }
  if (tipo === "texto") {
    const { texto } = body;
    if (
      typeof texto !== "string" ||
      !texto.trim() ||
      texto.length > MAX_TEXTO
    ) {
      return {
        status: 400,
        codigo: "ERR_TEXTO_INVALIDO",
        erro: "texto inválido"
      };
    }
    return { tipo, conteudo: { text: texto } };
  }
  return validarMidia(body, tipo);
};

export const send = async (req: Request, res: Response): Promise<Response> => {
  const body = (req.body || {}) as SendBody;
  const id = Number(body.whatsappId);

  if (!conexoesLiberadas(process.env.RETORNO_IA_CONEXOES).has(id)) {
    return falha(res, 403, "ERR_CONEXAO_NAO_LIBERADA", "conexão não liberada");
  }
  if (typeof body.numero !== "string" || !/^\d{12,13}$/.test(body.numero)) {
    return falha(res, 400, "ERR_NUMERO_INVALIDO", "numero inválido");
  }
  const validado = validarPedido(body);
  if ("codigo" in validado) {
    return falha(res, validado.status, validado.codigo, validado.erro);
  }

  const jid = `${body.numero}@s.whatsapp.net`;

  // Revisão I4 (defesa em profundidade, atrás de RETORNO_IA_TRAVA_ARQUIVADAS=1): conexão
  // coberta, fonte válida e jid arquivado = recusa. Sem fonte válida a rota não decide
  // (a porta final continua no robô). Só vê o jid por número; conversa em @lid fica
  // com o robô, que resolve pelo LidMappings.
  if (
    travaArquivadasLigada() &&
    arquivoAtivo(id) &&
    situacaoArquivo(id, jid) === "arquivada"
  ) {
    logger.info({
      info: "retorno_ia send recusado: arquivada",
      whatsappId: id
    });
    return falha(res, 409, "ERR_ARQUIVADA", "conversa arquivada");
  }

  // Sem sessão no processo: nada saiu, o cliente pode tentar de novo.
  let wbot: ReturnType<typeof getWbot>;
  try {
    wbot = getWbot(id);
  } catch (err) {
    return falha(res, 503, "ERR_WAPP_NOT_INITIALIZED", "conexão não iniciada");
  }

  try {
    if (validado.tipo === "texto" || validado.tipo === "audio") {
      await wbot.sendPresenceUpdate(
        validado.tipo === "audio" ? "recording" : "composing",
        jid
      );
      const espera = Math.min(
        Math.max(Number(body.delay) || 0, 0),
        MAX_DELAY_MS
      );
      if (espera > 0) await sleep(espera);
    }
    const sent = await wbot.sendMessage(
      jid,
      validado.conteudo as AnyMessageContent
    );
    const mensagemId = sent?.key?.id;
    if (!mensagemId) {
      // Pode ter saído: o cliente NÃO deve reenviar com este código.
      logger.warn({
        info: "retorno_ia send sem mensagem_id",
        whatsappId: id,
        tipo: validado.tipo
      });
      return falha(res, 502, "ERR_SEM_MENSAGEM_ID", "envio sem confirmação");
    }
    return res.json({ ok: true, mensagem_id: mensagemId, tipo: validado.tipo });
  } catch (err) {
    logger.warn({
      info: "retorno_ia send falhou",
      whatsappId: id,
      tipo: validado.tipo,
      err: String(err?.message || err).slice(0, 300)
    });
    return falha(res, 500, "ERR_ENVIO_FALHOU", "falha no envio");
  }
};

// Fonte de arquivadas por conexão (só leitura). Conexão fora de RETORNO_IA_ARQUIVO_CONEXOES
// (ou de RETORNO_IA_CONEXOES) é negada. A decisão de enviar é do robô: `valida` falso
// (sem sincronização boa dentro de RETORNO_IA_ARQUIVO_VALIDADE_S) = não enviar.
export const arquivadas = (req: Request, res: Response): Response => {
  if (typeof res.setHeader === "function")
    res.setHeader("Cache-Control", "no-store");
  const pedida = req.query.conexao;
  const cobertas = conexoesArquivo();
  let retrato = retratoArquivo(Date.now());
  if (pedida !== undefined) {
    const id = Number(pedida);
    if (!Number.isInteger(id) || !cobertas.includes(id)) {
      return falha(
        res,
        403,
        "ERR_CONEXAO_NAO_LIBERADA",
        "conexão não liberada"
      );
    }
    retrato = retrato.filter(r => r.conexao === id);
  }
  return res.json({
    ok: true,
    agora: new Date().toISOString(),
    validade_s: validadeArquivoS(),
    conexoes: retrato
  });
};
