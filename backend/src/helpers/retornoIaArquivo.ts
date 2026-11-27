import { logger } from "../utils/logger";

// Fase 0a do negociador: fonte de conversas arquivadas para as conexões do retorno_ia.
// Mesmo desenho dos Itens #20 e #21 da Marcela: só o booleano "archived" do chats.update,
// sem grupos, e o snapshot regular_low do app-state lido com o keyData base64 decodificado.
// Só leitura: nenhuma sessão é deslogada, nenhuma mensagem sai.
//
// Tudo é no-op com RETORNO_IA_ARQUIVO_CONEXOES vazia (padrão). Só entram conexões que
// também estão em RETORNO_IA_CONEXOES.
//
// O estado fica em memória do processo. Depois de um restart a conexão volta sem
// sincronização boa e o robô não envia por ela até o próximo snapshot completo.
//
// Revisão independente (26/11): a fonte só é válida com sync confirmada dentro da validade
// E sem falha depois dela (I2); o buffer de eventos do socket é sondado antes de aceitar a
// sync (I1); o mapa nunca perde um "archived: true" sem um "false" explícito (I1); a falha
// de sync é atribuída à conexão por um logger filho e só conta a coleção regular_low (I3).

export const COLECAO_ARQUIVO = "regular_low";

const PADRAO_VALIDADE_S = 600;
const PADRAO_INTERVALO_S = 300;
const PADRAO_INICIO_S = 90;
const PADRAO_TIMEOUT_MS = 45000;
const PADRAO_ESPERA_MS = 3000;

export type CodigoFalhaArquivo =
  | "ERR_WAPP_NOT_INITIALIZED"
  | "ERR_SEM_AUTHSTATE"
  | "ERR_SYNC_FALHOU"
  | "ERR_SYNC_TIMEOUT"
  | "ERR_SEM_VERSAO"
  | "ERR_BUFFER_PENDENTE"
  | "ERR_FALHA_POSTERIOR";

export interface EstadoArquivo {
  conexao: number;
  ultimaSyncOk: number | null;
  ultimaTentativa: number | null;
  ultimoErro: CodigoFalhaArquivo | null;
  snapshotCompleto: boolean;
  falhasSync: number;
  arquivadas: Map<string, boolean>;
}

const estados = new Map<number, EstadoArquivo>();

const numeroEnv = (nome: string, padrao: number): number => {
  const v = Number(process.env[nome]);
  return Number.isFinite(v) && v > 0 ? v : padrao;
};

export const listaConexoes = (valor?: string): number[] => [
  ...new Set(
    (valor || "")
      .split(",")
      .map(x => Number(x.trim()))
      .filter(x => Number.isInteger(x) && x > 0)
  )
];

// Interseção de RETORNO_IA_ARQUIVO_CONEXOES com RETORNO_IA_CONEXOES.
export const conexoesArquivo = (): number[] => {
  const liberadas = new Set(listaConexoes(process.env.RETORNO_IA_CONEXOES));
  return listaConexoes(process.env.RETORNO_IA_ARQUIVO_CONEXOES).filter(id =>
    liberadas.has(id)
  );
};

export const arquivoAtivo = (sessionId: number): boolean =>
  conexoesArquivo().includes(sessionId);

export const validadeArquivoS = (): number =>
  numeroEnv("RETORNO_IA_ARQUIVO_VALIDADE_S", PADRAO_VALIDADE_S);

// O keyData das app-state-sync-key volta do banco (WppKeys) como texto base64; o
// whaileys precisa de bytes, senão o snapshot falha com "HMAC content verification failed".
export const decodificarChavesAppState = (data: any): any => {
  Object.keys(data || {}).forEach(id => {
    const v: any = data[id];
    if (v && typeof v.keyData === "string") {
      data[id] = { ...v, keyData: Buffer.from(v.keyData, "base64") };
    }
  });
  return data;
};

// Só o que importa: conversa (sem grupo) com archived booleano.
export const filtrarArquivo = (
  updates: any[]
): { id: string; archived: boolean }[] =>
  (Array.isArray(updates) ? updates : [])
    .filter(
      (u: any) =>
        u &&
        typeof u.id === "string" &&
        !u.id.endsWith("@g.us") &&
        typeof u.archived === "boolean"
    )
    .map((u: any) => ({ id: u.id, archived: u.archived }));

const estadoDe = (conexao: number): EstadoArquivo => {
  let estado = estados.get(conexao);
  if (!estado) {
    estado = {
      conexao,
      ultimaSyncOk: null,
      ultimaTentativa: null,
      ultimoErro: null,
      snapshotCompleto: false,
      falhasSync: 0,
      arquivadas: new Map()
    };
    estados.set(conexao, estado);
  }
  return estado;
};

// Tap do chats.update (whaileys.ts). Nunca lança. Não conta como sincronização boa:
// só o resync confirmado renova a idade da fonte.
export const registrarChatsUpdate = (
  sessionId: number,
  updates: any[]
): void => {
  try {
    if (!arquivoAtivo(sessionId)) return;
    const arquivo = filtrarArquivo(updates);
    if (!arquivo.length) return;
    const estado = estadoDe(sessionId);
    arquivo.forEach(u => estado.arquivadas.set(u.id, u.archived));
  } catch (err) {
    logger.debug({
      info: "retorno_ia arquivo: chats.update ignorado",
      err: err?.message
    });
  }
};

// Falhas de sync que o whaileys só manda ao logger:
//   logger.info({ name, error }, "failed to sync state from version...")
// Cada conexão coberta usa um logger filho (só ela), então a falha é atribuída à conexão
// certa (I3). Só conta a coleção regular_low. Falha a qualquer hora, dentro ou fora do
// ciclo, invalida a fonte na hora (I2) e força snapshot completo no próximo ciclo.
// O filho repassa ao `info` atual do logger base, então quem embrulha o logger base
// (rota de resync da Marcela, Item #21) continua vendo as falhas desta conexão.
export const ehFalhaArquivo = (args: any[]): boolean => {
  const texto = args.map(a => (typeof a === "string" ? a : "")).join(" ");
  if (!/failed to sync state/.test(texto)) return false;
  const meta = args[0];
  return !!meta && typeof meta === "object" && meta.name === COLECAO_ARQUIVO;
};

export const registrarFalhaSync = (conexao: number): void => {
  const estado = estadoDe(conexao);
  estado.falhasSync += 1;
  estado.ultimoErro = estado.ultimoErro || "ERR_FALHA_POSTERIOR";
  estado.snapshotCompleto = false;
};

export const loggerArquivoDaConexao = (base: any, conexao: number): any => {
  if (!base || typeof base.child !== "function") return base;
  const filho = base.child({});
  filho.info = function infoArquivo(this: any, ...args: any[]) {
    try {
      if (ehFalhaArquivo(args)) registrarFalhaSync(conexao);
    } catch {
      /* nunca atrapalha o log */
    }
    return base.info.apply(this, args);
  };
  return filho;
};

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const comTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("ERR_SYNC_TIMEOUT")), ms);
    p.then(
      v => {
        clearTimeout(t);
        resolve(v);
      },
      e => {
        clearTimeout(t);
        reject(e);
      }
    );
  });

// I1: true = buffer livre (abrimos e fechamos na hora); false = alguém o segura.
export const sondarBuffer = async (
  ev: any
): Promise<CodigoFalhaArquivo | null> => {
  if (
    !ev ||
    typeof ev.buffer !== "function" ||
    typeof ev.flush !== "function"
  ) {
    return "ERR_BUFFER_PENDENTE";
  }
  if (!ev.buffer()) return "ERR_BUFFER_PENDENTE";
  try {
    await comTimeout(Promise.resolve(ev.flush()), 5000);
    return null;
  } catch {
    return "ERR_BUFFER_PENDENTE";
  }
};

export interface DepsArquivo {
  getWbot: (id: number) => any;
  agora?: () => number;
  esperaMs?: number;
  timeoutMs?: number;
}

export interface ResultadoSync {
  conexao: number;
  ok: boolean;
  completo: boolean;
  codigo: CodigoFalhaArquivo | null;
  arquivadas: number;
}

// Uma sincronização de uma conexão. Primeira vez no processo (ou depois de uma falha):
// snapshot completo (zera só a versão regular_low, como o Item #21, e devolve a versão
// anterior se o snapshot não vier). Depois: incremental a partir da versão salva.
export const sincronizarConexao = async (
  conexao: number,
  deps: DepsArquivo
): Promise<ResultadoSync> => {
  const agora = deps.agora || Date.now;
  const estado = estadoDe(conexao);
  estado.ultimaTentativa = agora();

  const falhar = (
    codigo: CodigoFalhaArquivo,
    completo: boolean
  ): ResultadoSync => {
    estado.ultimoErro = codigo;
    estado.snapshotCompleto = false;
    return { conexao, ok: false, completo, codigo, arquivadas: 0 };
  };

  let wbot: any;
  try {
    wbot = deps.getWbot(conexao);
  } catch {
    return falhar("ERR_WAPP_NOT_INITIALIZED", false);
  }
  const chaves = wbot && wbot.authState && wbot.authState.keys;
  if (!chaves || typeof wbot.resyncAppState !== "function" || !wbot.ev) {
    return falhar("ERR_SEM_AUTHSTATE", false);
  }

  const versao = async (): Promise<any> =>
    (await chaves.get("app-state-sync-version", [COLECAO_ARQUIVO]))[
      COLECAO_ARQUIVO
    ] || null;

  const antes = await versao();
  const completo = !estado.snapshotCompleto || !antes;
  const vistos = new Map<string, boolean>();
  const ouvir = (updates: any[]): void => {
    filtrarArquivo(updates).forEach(u => vistos.set(u.id, u.archived));
  };
  const falhasAntes = estado.falhasSync;

  let codigo: CodigoFalhaArquivo | null = null;
  wbot.ev.on("chats.update", ouvir);
  try {
    if (completo) {
      await chaves.set({
        "app-state-sync-version": { [COLECAO_ARQUIVO]: null }
      });
    }
    await comTimeout(
      Promise.resolve(wbot.resyncAppState([COLECAO_ARQUIVO], false)),
      deps.timeoutMs ??
        numeroEnv("RETORNO_IA_ARQUIVO_TIMEOUT_MS", PADRAO_TIMEOUT_MS)
    );
    const espera = deps.esperaMs ?? PADRAO_ESPERA_MS;
    if (espera > 0) await sleep(espera);
    // I1: se alguém mantém o buffer de eventos aberto, os chats.update do resync ficam
    // retidos e "vistos" pode estar vazio ou incompleto. Abrir o buffer aqui só dá certo
    // se ninguém o segura; nesse caso fechamos na hora (com o ouvinte ainda ligado).
    codigo = await sondarBuffer(wbot.ev);
  } catch (err) {
    codigo =
      String(err?.message) === "ERR_SYNC_TIMEOUT"
        ? "ERR_SYNC_TIMEOUT"
        : "ERR_SYNC_FALHOU";
  } finally {
    wbot.ev.off("chats.update", ouvir);
  }

  let depois = await versao();
  if (!depois && antes) {
    await chaves.set({
      "app-state-sync-version": { [COLECAO_ARQUIVO]: antes }
    });
    depois = await versao();
    codigo = codigo || "ERR_SEM_VERSAO";
  }
  if (!codigo && estado.falhasSync !== falhasAntes) codigo = "ERR_SYNC_FALHOU";
  if (!codigo && !depois) codigo = "ERR_SEM_VERSAO";

  if (codigo) {
    // O que chegou continua sendo verdade e fica no mapa, mas a fonte não renova a idade.
    vistos.forEach((v, k) => estado.arquivadas.set(k, v));
    logger.warn({
      info: "retorno_ia arquivo: sync falhou",
      conexao,
      codigo,
      completo
    });
    return falhar(codigo, completo);
  }

  // I1: snapshot completo também mescla. Um "archived: true" só sai com um "false"
  // explícito; conversa que sumiu do snapshot continua travada (fail-closed).
  vistos.forEach((v, k) => estado.arquivadas.set(k, v));
  estado.snapshotCompleto = true;
  estado.ultimoErro = null;
  estado.ultimaSyncOk = agora();
  const arquivadas = [...estado.arquivadas.values()].filter(Boolean).length;
  logger.info({
    info: "retorno_ia arquivo: sync ok",
    conexao,
    completo,
    arquivadas
  });
  return { conexao, ok: true, completo, codigo: null, arquivadas };
};

// Uma conexão por vez, para não segurar o buffer de várias conexões ao mesmo tempo.
let rodando = false;
export const rodarCicloArquivo = async (
  deps: DepsArquivo
): Promise<ResultadoSync[]> => {
  if (rodando) return [];
  rodando = true;
  const resultados: ResultadoSync[] = [];
  try {
    // eslint-disable-next-line no-restricted-syntax
    for (const conexao of conexoesArquivo()) {
      try {
        // serial de propósito: uma conexão por vez
        // eslint-disable-next-line no-await-in-loop
        resultados.push(await sincronizarConexao(conexao, deps));
      } catch (err) {
        logger.warn({
          info: "retorno_ia arquivo: erro inesperado",
          conexao,
          err: err?.message
        });
        const estado = estadoDe(conexao);
        estado.ultimoErro = "ERR_SYNC_FALHOU";
        estado.snapshotCompleto = false;
      }
    }
  } finally {
    rodando = false;
  }
  return resultados;
};

let ciclo: NodeJS.Timeout | null = null;

// Idempotente. Chamado no connection "open" de uma conexão da lista.
export const iniciarCicloArquivo = (deps: DepsArquivo): boolean => {
  if (ciclo || !conexoesArquivo().length) return false;
  const intervaloMs =
    numeroEnv("RETORNO_IA_ARQUIVO_INTERVALO_S", PADRAO_INTERVALO_S) * 1000;
  const inicioMs =
    numeroEnv("RETORNO_IA_ARQUIVO_INICIO_S", PADRAO_INICIO_S) * 1000;
  const tick = (): void => {
    rodarCicloArquivo(deps).catch(() => undefined);
  };
  const primeiro = setTimeout(tick, inicioMs);
  if (typeof primeiro.unref === "function") primeiro.unref();
  ciclo = setInterval(tick, intervaloMs);
  if (typeof ciclo.unref === "function") ciclo.unref();
  logger.info({
    info: "retorno_ia arquivo: ciclo ligado",
    conexoes: conexoesArquivo(),
    intervaloMs
  });
  return true;
};

export interface RetratoConexao {
  conexao: number;
  ultima_sync_ok: string | null;
  idade_s: number | null;
  valida: boolean;
  ultimo_erro: CodigoFalhaArquivo | null;
  arquivadas: string[];
}

// Saída consultável: por conexão, a última sincronização boa, a idade e os jids arquivados.
export const retratoArquivo = (
  agora: number = Date.now()
): RetratoConexao[] => {
  const validade = validadeArquivoS();
  return conexoesArquivo().map(conexao => {
    const estado = estados.get(conexao);
    const ok = estado ? estado.ultimaSyncOk : null;
    const bruta = ok === null ? null : Math.floor((agora - ok) / 1000);
    // I2: falha depois da última sync boa invalida na hora. M3: relógio que voltou
    // (agora antes da sync) também invalida.
    const valida =
      bruta !== null &&
      bruta >= 0 &&
      bruta <= validade &&
      !!estado &&
      estado.ultimoErro === null;
    return {
      conexao,
      ultima_sync_ok: ok === null ? null : new Date(ok).toISOString(),
      idade_s: bruta === null ? null : Math.max(0, bruta),
      valida,
      ultimo_erro: estado ? estado.ultimoErro : null,
      arquivadas: estado
        ? [...estado.arquivadas.entries()]
            .filter(([, a]) => a)
            .map(([jid]) => jid)
            .sort()
        : []
    };
  });
};

export type SituacaoArquivo = "arquivada" | "livre" | "sem_fonte";

// I4: consulta pontual para a trava da rota de envio. Sem fonte válida, não decide.
export const situacaoArquivo = (
  conexao: number,
  jid: string,
  agora: number = Date.now()
): SituacaoArquivo => {
  const retrato = retratoArquivo(agora).find(r => r.conexao === conexao);
  if (!retrato || !retrato.valida) return "sem_fonte";
  const estado = estados.get(conexao);
  return estado && estado.arquivadas.get(jid) === true ? "arquivada" : "livre";
};

// eslint-disable-next-line no-underscore-dangle
export const _resetArquivoParaTestes = (): void => {
  estados.clear();
  rodando = false;
  if (ciclo) clearInterval(ciclo);
  ciclo = null;
};
