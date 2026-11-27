/**
 * Código de pareamento ("Conectar com número de telefone") exibido embaixo do QR.
 *
 * Regras (item 81):
 *  - O código NUNCA vai para log nem para banco. Fica só na memória do processo
 *    e segue ao frontend pelo socket.io (mesmo canal do QR).
 *  - requestPairingCode da whaileys grava creds.pairingCode e um creds.me provisório;
 *    credsParaPersistir() tira os dois antes de salvar a sessão, senão o próximo
 *    init tentaria LOGIN com um número que ainda não foi pareado.
 *  - Um código por socket (ciclo de QR): os QRs do mesmo socket giram a cada ~20 s,
 *    e pedir outro código a cada giro invalidaria o que a pessoa está digitando.
 *    Socket novo (QR novo depois de expirar) => código novo.
 */
import fs from "fs";
import path from "path";

export type PairingStatus = "GERANDO" | "OK" | "SEM_NUMERO" | "ERRO";

export interface PairingPayload {
  whatsappId: number;
  status: PairingStatus;
  /** Código no formato XXXX-XXXX (só com status OK). */
  code?: string;
  /** Só os 4 últimos dígitos do número, para conferência na tela. */
  numberEnd?: string;
  generatedAt?: number;
  error?: string;
}

interface PairingState {
  socket?: unknown;
  code?: string;
  generatedAt?: number;
  numberEnd?: string;
  status?: PairingStatus;
  error?: string;
}

/** Número digitado na tela por conexão (memória; sobrevive aos ciclos de QR). */
const typedNumbers = new Map<number, string>();
const states = new Map<number, PairingState>();
const inFlights = new Map<number, Promise<void>>();

export const PAIRING_CODE_TTL_MS = Number(
  process.env.PAIRING_CODE_TTL_MS || 3 * 60 * 1000
);

export const pairingCodeEnabled = (): boolean =>
  process.env.PAIRING_CODE_DISABLED !== "true";

/**
 * Só dígitos, com DDI. Número brasileiro sem DDI (10 ou 11 dígitos) ganha 55.
 * Retorna null se não parecer um telefone.
 */
export const normalizePairingNumber = (raw: unknown): string | null => {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 12 || d.length > 15) return null;
  if (d.startsWith("55") && d.length !== 12 && d.length !== 13) return null;
  return d;
};

export const formatPairingCode = (code: unknown): string => {
  const c = String(code ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
};

/**
 * Cópia das creds para gravar no banco: nunca leva o código de pareamento, e não leva o
 * creds.me provisório que requestPairingCode cria antes do pareamento terminar.
 */
export const credsParaPersistir = <T extends Record<string, any>>(creds: T): T => {
  if (!creds || typeof creds !== "object" || !("pairingCode" in creds)) {
    return creds;
  }
  const { pairingCode, ...rest } = creds as any;
  if (!rest.account && !rest.registered) {
    delete rest.me;
  }
  return rest as T;
};

export const setTypedNumber = (whatsappId: number, number: string): void => {
  typedNumbers.set(whatsappId, number);
};

export const getTypedNumber = (whatsappId: number): string | undefined =>
  typedNumbers.get(whatsappId);

/** Últimos 4 dígitos do nome da conexão ("Disparo 1234" -> "1234"). */
export const nameEnd4 = (name: unknown): string | null => {
  const m = String(name ?? "").match(/(\d{4})\D*$/);
  return m ? m[1] : null;
};

/**
 * Escolhe o número do CRM cujo final bate com o final do nome da conexão. Só aceita
 * se houver exatamente um candidato (mesma regra do CRM para ligar chip e conexão).
 */
export const pickCrmNumber = (
  name: unknown,
  phones: Array<string | null | undefined>
): string | null => {
  const end = nameEnd4(name);
  if (!end) return null;
  const found = new Set<string>();
  for (const p of phones) {
    const n = normalizePairingNumber(p);
    // Só automático com DDI 55 (chips do disparo); qualquer dúvida vira campo na tela.
    if (n && n.startsWith("55") && n.endsWith(end)) found.add(n);
  }
  return found.size === 1 ? [...found][0] : null;
};

let crmCache: { at: number; phones: string[] } | null = null;
const CRM_CACHE_MS = 60 * 1000;

const crmDbPath = (): string =>
  process.env.CRM_DB_PATH ||
  path.resolve(process.cwd(), "..", "Gestão de celulares", "database.sqlite");

/** Telefones ativos do CRM (leitura somente). Falha silenciosa: retorna []. */
export const loadCrmPhones = async (): Promise<string[]> => {
  if (crmCache && Date.now() - crmCache.at < CRM_CACHE_MS) return crmCache.phones;
  const file = crmDbPath();
  if (!fs.existsSync(file)) return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const sqlite3 = require("sqlite3");
    const phones: string[] = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(file, sqlite3.OPEN_READONLY, (err: Error) => {
        if (err) return reject(err);
        db.all(
          "SELECT phone_number FROM numbers WHERE excluido_em IS NULL",
          (e: Error, rows: Array<{ phone_number: string }>) => {
            db.close();
            if (e) return reject(e);
            return resolve(rows.map(r => r.phone_number));
          }
        );
        return undefined;
      });
    });
    crmCache = { at: Date.now(), phones };
    return phones;
  } catch {
    return [];
  }
};

/**
 * Número conhecido da conexão: o digitado na tela vence; senão, o do CRM, e só se o
 * final do nome for único também entre as conexões (countSameEnd = quantas conexões
 * terminam com os mesmos 4 dígitos). Número errado faz o WhatsApp de outra pessoa
 * mostrar aviso de pareamento, então na dúvida retorna null e a tela pede o número.
 */
export const resolvePairingNumber = async (
  whatsapp: { id: number; name?: string },
  countSameEnd?: (end4: string) => Promise<number>
): Promise<string | null> => {
  const typed = typedNumbers.get(whatsapp.id);
  if (typed) return typed;
  const end = nameEnd4(whatsapp.name);
  if (!end) return null;
  if (countSameEnd) {
    try {
      if ((await countSameEnd(end)) !== 1) return null;
    } catch {
      return null;
    }
  }
  return pickCrmNumber(whatsapp.name, await loadCrmPhones());
};

const toPayload = (whatsappId: number, s?: PairingState): PairingPayload => {
  if (!s || !s.status) return { whatsappId, status: "SEM_NUMERO" };
  const payload: PairingPayload = { whatsappId, status: s.status };
  if (s.status === "OK" && s.code) {
    payload.code = s.code;
    payload.generatedAt = s.generatedAt;
  }
  if (s.numberEnd) payload.numberEnd = s.numberEnd;
  if (s.error) payload.error = s.error;
  return payload;
};

export const getPairingPayload = (whatsappId: number): PairingPayload =>
  toPayload(whatsappId, states.get(whatsappId));

/** Conexão abriu, caiu ou foi removida: o código deixa de valer. O número digitado fica. */
export const clearPairingCode = (whatsappId: number): void => {
  states.delete(whatsappId);
};

export interface PairingSocket {
  authState?: { creds?: { registered?: boolean; account?: unknown } };
  requestPairingCode: (phone: string) => Promise<string>;
}

interface EnsureOptions {
  whatsapp: { id: number; name?: string; status?: string };
  socket: PairingSocket;
  emit: (payload: PairingPayload) => void;
  /** Número já validado (vindo da tela). Sem ele, usa resolvePairingNumber. */
  number?: string;
  /** Força código novo mesmo dentro do TTL (pedido explícito da tela). */
  force?: boolean;
  onError?: (err: unknown) => void;
  countSameEnd?: (end4: string) => Promise<number>;
}

/**
 * Garante um código válido para o socket atual e emite o estado. Nunca lança e
 * nunca coloca o código em log (onError recebe só o erro da biblioteca).
 */
export const ensurePairingCode = async (opts: EnsureOptions): Promise<PairingPayload> => {
  const { whatsapp, socket, emit, force } = opts;
  const id = whatsapp.id;
  const current = states.get(id) || {};

  const pending = inFlights.get(id);
  if (pending) {
    await pending;
    return getPairingPayload(id);
  }

  // Nunca em conexão conectada ou já pareada.
  const creds = socket?.authState?.creds;
  if (whatsapp.status === "CONNECTED" || creds?.registered || creds?.account) {
    return getPairingPayload(id);
  }

  const fresh =
    current.socket === socket &&
    current.status === "OK" &&
    current.code &&
    Date.now() - (current.generatedAt || 0) < PAIRING_CODE_TTL_MS;

  // Falha no mesmo socket não repete sozinha a cada giro do QR (só por pedido da tela).
  const failedHere = current.socket === socket && current.status === "ERRO";

  if ((fresh || failedHere) && !force) {
    const p = getPairingPayload(id);
    emit(p);
    return p;
  }

  const run = async () => {
    const number =
      opts.number || (await resolvePairingNumber(whatsapp, opts.countSameEnd));
    if (!number) {
      states.set(id, { socket, status: "SEM_NUMERO" });
      return;
    }
    const numberEnd = number.slice(-4);
    states.set(id, { socket, status: "GERANDO", numberEnd });
    emit(getPairingPayload(id));
    try {
      const raw = await socket.requestPairingCode(number);
      // Socket trocou enquanto pedia: o código é do socket antigo, descarta.
      if (states.get(id)?.socket !== socket) return;
      states.set(id, {
        socket,
        status: "OK",
        code: formatPairingCode(raw),
        generatedAt: Date.now(),
        numberEnd
      });
    } catch (err) {
      if (states.get(id)?.socket !== socket) return;
      states.set(id, {
        socket,
        status: "ERRO",
        numberEnd,
        error: "Não foi possível gerar o código agora. Use o QR ou tente de novo."
      });
      if (opts.onError) opts.onError(err);
    }
  };

  const inFlight = run();
  inFlights.set(id, inFlight);
  try {
    await inFlight;
  } finally {
    if (inFlights.get(id) === inFlight) inFlights.delete(id);
  }
  const payload = getPairingPayload(id);
  emit(payload);
  return payload;
};

/** Só para testes. */
export const __resetPairingState = (): void => {
  states.clear();
  inFlights.clear();
  typedNumbers.clear();
  crmCache = null;
};
