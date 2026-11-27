import { EventEmitter } from "events";
import pino from "pino";

jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

// eslint-disable-next-line import/first
import {
  COLECAO_ARQUIVO,
  arquivoAtivo,
  conexoesArquivo,
  decodificarChavesAppState,
  ehFalhaArquivo,
  filtrarArquivo,
  iniciarCicloArquivo,
  loggerArquivoDaConexao,
  registrarChatsUpdate,
  registrarFalhaSync,
  retratoArquivo,
  rodarCicloArquivo,
  sincronizarConexao,
  situacaoArquivo,
  sondarBuffer,
  _resetArquivoParaTestes
} from "../../../helpers/retornoIaArquivo";

// Buffer de eventos com a mesma semântica do whaileys 6.5.1 (Utils/event-buffer.js):
// buffer() só abre se ninguém abriu; emit em buffer retém; flush libera.
const fakeEv = () => {
  const em = new EventEmitter();
  let buffering = false;
  let retidos: [string, any][] = [];
  return {
    on: (e: string, f: any) => em.on(e, f),
    off: (e: string, f: any) => em.off(e, f),
    listenerCount: (e: string) => em.listenerCount(e),
    emit: (e: string, d: any) => {
      if (buffering) retidos.push([e, d]);
      else em.emit(e, d);
    },
    buffer: () => {
      if (buffering) return false;
      buffering = true;
      return true;
    },
    flush: async () => {
      if (!buffering) return;
      buffering = false;
      const lote = retidos;
      retidos = [];
      lote.forEach(([e, d]) => em.emit(e, d));
    }
  };
};

// Socket falso: authState.keys em memória e resyncAppState como createBufferedFunction.
const fakeSock = (opts: {
  versao?: any;
  emitir?: any[];
  falhar?: () => void;
  lancar?: boolean;
  pendurar?: boolean;
  semVersaoDepois?: boolean;
}) => {
  const ev = fakeEv();
  const store: any = {
    [COLECAO_ARQUIVO]: opts.versao === undefined ? { version: 7 } : opts.versao
  };
  const sets: any[] = [];
  const keys = {
    get: jest.fn(async (_t: string, ids: string[]) => ({
      [ids[0]]: store[ids[0]]
    })),
    set: jest.fn(async (data: any) => {
      sets.push(JSON.parse(JSON.stringify(data)));
      Object.assign(store, data["app-state-sync-version"]);
    })
  };
  const sock: any = {
    ev,
    authState: { keys },
    store,
    sets,
    emitir: opts.emitir
  };
  sock.resyncAppState = jest.fn(async () => {
    if (opts.pendurar) return new Promise(() => undefined);
    const comecou = ev.buffer();
    try {
      if (opts.lancar) throw new Error("boom");
      if (opts.falhar) opts.falhar();
      if (!opts.semVersaoDepois) store[COLECAO_ARQUIVO] = { version: 9 };
      ev.emit("chats.update", sock.emitir || []);
    } finally {
      if (comecou) await ev.flush();
    }
    return undefined;
  });
  return sock;
};

const deps = (sock: any, extra: any = {}) => ({
  getWbot: () => sock,
  esperaMs: 0,
  timeoutMs: 50,
  ...extra
});

describe("retornoIaArquivo", () => {
  const envOriginal = { ...process.env };
  beforeEach(() => {
    _resetArquivoParaTestes();
    process.env = { ...envOriginal };
    process.env.RETORNO_IA_CONEXOES = "23,28,161,25,40,53,71,114,142,1,16";
    process.env.RETORNO_IA_ARQUIVO_CONEXOES = "23,1,999";
    delete process.env.RETORNO_IA_ARQUIVO_VALIDADE_S;
  });
  afterAll(() => {
    _resetArquivoParaTestes();
    process.env = envOriginal;
  });

  it("lista vazia por padrão e só conexões também liberadas no retorno_ia", () => {
    delete process.env.RETORNO_IA_ARQUIVO_CONEXOES;
    expect(conexoesArquivo()).toEqual([]);
    expect(arquivoAtivo(23)).toBe(false);
    expect(iniciarCicloArquivo({ getWbot: jest.fn() })).toBe(false);
    process.env.RETORNO_IA_ARQUIVO_CONEXOES = "23, 1,999,abc";
    expect(conexoesArquivo()).toEqual([23, 1]);
  });

  it("decodifica o keyData base64 das app-state-sync-key e preserva o resto", () => {
    const bytes = Buffer.from([1, 2, 3, 250]);
    const data: any = {
      A: {
        keyData: bytes.toString("base64"),
        fingerprint: { rawId: 1 },
        timestamp: 5
      },
      B: { keyData: Buffer.from([9]) },
      C: null
    };
    decodificarChavesAppState(data);
    expect(Buffer.isBuffer(data.A.keyData)).toBe(true);
    expect([...data.A.keyData]).toEqual([1, 2, 3, 250]);
    expect(data.A.fingerprint).toEqual({ rawId: 1 });
    expect([...data.B.keyData]).toEqual([9]);
    expect(data.C).toBeNull();
    expect(decodificarChavesAppState(undefined)).toBeUndefined();
  });

  it("tap do chats.update guarda só archived booleano e ignora grupos", () => {
    const updates = [
      { id: "1@s.whatsapp.net", archived: true, unreadCount: 3, name: "X" },
      { id: "2@lid", archived: false },
      { id: "3@g.us", archived: true },
      { id: "4@s.whatsapp.net", unreadCount: 1 }
    ];
    expect(filtrarArquivo(updates)).toEqual([
      { id: "1@s.whatsapp.net", archived: true },
      { id: "2@lid", archived: false }
    ]);
    registrarChatsUpdate(23, updates);
    registrarChatsUpdate(28, updates); // fora da lista de arquivo
    const [c23, c1] = retratoArquivo();
    expect(c23.arquivadas).toEqual(["1@s.whatsapp.net"]);
    expect(c1.arquivadas).toEqual([]);
  });

  it("primeira sync é snapshot completo: zera só regular_low e renova a idade", async () => {
    const sock = fakeSock({
      emitir: [
        { id: "a@s.whatsapp.net", archived: true },
        { id: "b@lid", archived: true },
        { id: "c@s.whatsapp.net", archived: false },
        { id: "g@g.us", archived: true }
      ]
    });
    const r = await sincronizarConexao(
      23,
      deps(sock, { agora: () => 1_000_000 })
    );
    expect(r).toMatchObject({ ok: true, completo: true, arquivadas: 2 });
    expect(sock.sets[0]).toEqual({
      "app-state-sync-version": { [COLECAO_ARQUIVO]: null }
    });
    expect(sock.resyncAppState).toHaveBeenCalledWith([COLECAO_ARQUIVO], false);
    const [c23] = retratoArquivo(1_000_000 + 30_000);
    expect(c23).toMatchObject({ idade_s: 30, valida: true, ultimo_erro: null });
    expect(c23.arquivadas).toEqual(["a@s.whatsapp.net", "b@lid"]);
    expect(sock.ev.listenerCount("chats.update")).toBe(0);
  });

  it("I1: snapshot com o buffer de eventos já aberto por outro não é aceito", async () => {
    const sock = fakeSock({
      emitir: [{ id: "a@s.whatsapp.net", archived: true }]
    });
    // alguém (ex.: fila offline) segura o buffer durante todo o resync
    expect(sock.ev.buffer()).toBe(true);
    const r = await sincronizarConexao(23, deps(sock, { agora: () => 0 }));
    expect(r).toMatchObject({ ok: false, codigo: "ERR_BUFFER_PENDENTE" });
    expect(retratoArquivo(1000)[0]).toMatchObject({
      valida: false,
      ultima_sync_ok: null,
      ultimo_erro: "ERR_BUFFER_PENDENTE"
    });
    // os eventos retidos chegam depois pelo tap normal e entram no mapa
    const tap = (u: any[]) => registrarChatsUpdate(23, u);
    sock.ev.on("chats.update", tap);
    await sock.ev.flush();
    expect(retratoArquivo(1000)[0].arquivadas).toEqual(["a@s.whatsapp.net"]);
    // com o buffer livre, a próxima sync (completa) é aceita
    const r2 = await sincronizarConexao(23, deps(sock, { agora: () => 2000 }));
    expect(r2).toMatchObject({ ok: true, completo: true });
  });

  it("I1: emissão adiada depois do ouvinte sair não vira lista vazia válida", async () => {
    const sock = fakeSock({});
    // resync termina sem emitir; os eventos só sairiam depois (buffer de terceiro)
    sock.resyncAppState.mockImplementation(async () => {
      sock.store[COLECAO_ARQUIVO] = { version: 9 };
      sock.ev.buffer(); // terceiro abre e não fecha durante a janela
      sock.ev.emit("chats.update", [
        { id: "x@s.whatsapp.net", archived: true }
      ]);
    });
    const r = await sincronizarConexao(23, deps(sock));
    expect(r.ok).toBe(false);
    expect(retratoArquivo()[0].valida).toBe(false);
  });

  it("I1: snapshot completo mescla: 'archived: true' só sai com 'false' explícito", async () => {
    registrarChatsUpdate(23, [
      { id: "velho@s.whatsapp.net", archived: true },
      { id: "volta@s.whatsapp.net", archived: true }
    ]);
    const sock = fakeSock({
      emitir: [
        { id: "volta@s.whatsapp.net", archived: false },
        { id: "novo@s.whatsapp.net", archived: true }
      ]
    });
    const r = await sincronizarConexao(23, deps(sock));
    expect(r).toMatchObject({ ok: true, completo: true });
    expect(retratoArquivo()[0].arquivadas).toEqual([
      "novo@s.whatsapp.net",
      "velho@s.whatsapp.net"
    ]);
  });

  it("depois do snapshot, sync incremental sem zerar a versão e com merge", async () => {
    const sock = fakeSock({
      emitir: [{ id: "a@s.whatsapp.net", archived: true }]
    });
    await sincronizarConexao(23, deps(sock));
    sock.emitir = [
      { id: "a@s.whatsapp.net", archived: false },
      { id: "n@s.whatsapp.net", archived: true }
    ];
    const antesSets = sock.sets.length;
    const r = await sincronizarConexao(23, deps(sock));
    expect(r).toMatchObject({ ok: true, completo: false });
    expect(sock.sets.length).toBe(antesSets);
    expect(retratoArquivo()[0].arquivadas).toEqual(["n@s.whatsapp.net"]);
  });

  it("heartbeat por conexão: válida até 600 s, inválida com 601 s", async () => {
    await sincronizarConexao(23, deps(fakeSock({}), { agora: () => 0 }));
    expect(retratoArquivo(600_000)[0]).toMatchObject({
      conexao: 23,
      idade_s: 600,
      valida: true
    });
    expect(retratoArquivo(601_000)[0]).toMatchObject({
      conexao: 23,
      idade_s: 601,
      valida: false
    });
    expect(retratoArquivo(1)[1]).toMatchObject({
      conexao: 1,
      ultima_sync_ok: null,
      valida: false
    });
    process.env.RETORNO_IA_ARQUIVO_VALIDADE_S = "60";
    expect(retratoArquivo(61_000)[0].valida).toBe(false);
  });

  it("I2: sync que falha depois de um OK dentro de 600 s invalida na hora", async () => {
    const sock = fakeSock({});
    await sincronizarConexao(23, deps(sock, { agora: () => 0 }));
    expect(retratoArquivo(60_000)[0].valida).toBe(true);
    sock.resyncAppState.mockRejectedValueOnce(new Error("Connection Closed"));
    const r = await sincronizarConexao(
      23,
      deps(sock, { agora: () => 120_000 })
    );
    expect(r).toMatchObject({ ok: false, codigo: "ERR_SYNC_FALHOU" });
    expect(retratoArquivo(121_000)[0]).toMatchObject({
      valida: false,
      ultimo_erro: "ERR_SYNC_FALHOU"
    });
    // a sync boa seguinte (completa) volta a validar
    const r2 = await sincronizarConexao(
      23,
      deps(sock, { agora: () => 200_000 })
    );
    expect(r2).toMatchObject({ ok: true, completo: true });
    expect(retratoArquivo(201_000)[0].valida).toBe(true);
  });

  it("I2: falha de regular_low fora do ciclo também invalida na hora", async () => {
    await sincronizarConexao(23, deps(fakeSock({}), { agora: () => 0 }));
    registrarFalhaSync(23);
    expect(retratoArquivo(10_000)[0]).toMatchObject({
      valida: false,
      ultimo_erro: "ERR_FALHA_POSTERIOR"
    });
  });

  it("M3: relógio que volta para antes da sync não deixa a fonte válida", async () => {
    await sincronizarConexao(
      23,
      deps(fakeSock({}), { agora: () => 1_000_000 })
    );
    expect(retratoArquivo(1_000_000 - 3_600_000)[0]).toMatchObject({
      valida: false,
      idade_s: 0
    });
  });

  it("conexão não iniciada não renova a idade (ERR_WAPP_NOT_INITIALIZED)", async () => {
    const r = await sincronizarConexao(23, {
      getWbot: () => {
        throw new Error("ERR_WAPP_NOT_INITIALIZED");
      }
    });
    expect(r).toMatchObject({ ok: false, codigo: "ERR_WAPP_NOT_INITIALIZED" });
    expect(retratoArquivo()[0]).toMatchObject({
      valida: false,
      ultimo_erro: "ERR_WAPP_NOT_INITIALIZED"
    });
  });

  it("I3: só 'failed to sync state' de regular_low conta como falha", () => {
    expect(
      ehFalhaArquivo([
        { name: "regular_low" },
        "failed to sync state from version"
      ])
    ).toBe(true);
    expect(
      ehFalhaArquivo([
        { name: "critical_block" },
        "failed to sync state from version"
      ])
    ).toBe(false);
    expect(ehFalhaArquivo(["resyncing regular_low from v0"])).toBe(false);
    expect(ehFalhaArquivo(["failed to sync state from version"])).toBe(false);
  });

  it("I3: falha no logger filho de outra conexão não invalida esta; a da própria, sim", async () => {
    const base = pino({ level: "silent" });
    const log23 = loggerArquivoDaConexao(base, 23);
    const log1 = loggerArquivoDaConexao(base, 1);
    const sock = fakeSock({
      falhar: () =>
        log1.info(
          { name: COLECAO_ARQUIVO, error: "x" },
          "failed to sync state from version"
        )
    });
    const r = await sincronizarConexao(23, deps(sock));
    expect(r.ok).toBe(true);
    expect(retratoArquivo()[1]).toMatchObject({ conexao: 1, valida: false });

    // coleção diferente na própria conexão: não conta
    log23.info({ name: "regular_high" }, "failed to sync state from version");
    expect(retratoArquivo()[0].valida).toBe(true);

    // regular_low da própria conexão durante a sync: falha
    sock.resyncAppState.mockImplementationOnce(async () => {
      log23.info(
        { name: COLECAO_ARQUIVO },
        "failed to sync state from version"
      );
      sock.store[COLECAO_ARQUIVO] = { version: 10 };
    });
    const r2 = await sincronizarConexao(23, deps(sock));
    expect(r2).toMatchObject({ ok: false, codigo: "ERR_SYNC_FALHOU" });
  });

  it("I3/M4: logger filho repassa ao info atual do logger base (rota da Marcela segue vendo)", () => {
    const base: any = pino({ level: "silent" });
    const filho = loggerArquivoDaConexao(base, 23);
    const vistos: string[] = [];
    const original = base.info;
    base.info = function marcela(this: any, ...args: any[]) {
      vistos.push(String(args[1]));
      return original.apply(this, args);
    };
    filho.info({ name: COLECAO_ARQUIVO }, "failed to sync state from version");
    expect(vistos).toEqual(["failed to sync state from version"]);
    base.info = original;
    expect(() => filho.info("outra coisa")).not.toThrow();
    expect(loggerArquivoDaConexao(undefined, 23)).toBeUndefined();
  });

  it("timeout do resync é falha distinta e o listener é removido", async () => {
    const sock = fakeSock({ pendurar: true });
    const r = await sincronizarConexao(23, deps(sock, { timeoutMs: 20 }));
    expect(r).toMatchObject({ ok: false, codigo: "ERR_SYNC_TIMEOUT" });
    expect(sock.ev.listenerCount("chats.update")).toBe(0);
  });

  it("snapshot sem versão depois devolve a versão anterior (sem perder o estado)", async () => {
    const sock = fakeSock({ semVersaoDepois: true, versao: { version: 7 } });
    const r = await sincronizarConexao(23, deps(sock));
    expect(r.ok).toBe(false);
    expect(r.codigo).toBe("ERR_SEM_VERSAO");
    expect(sock.store[COLECAO_ARQUIVO]).toEqual({ version: 7 });
  });

  it("sondarBuffer: livre fecha na hora; preso ou sem API é falha", async () => {
    const ev = fakeEv();
    expect(await sondarBuffer(ev)).toBeNull();
    expect(ev.buffer()).toBe(true); // ficou fechado pela sonda
    expect(await sondarBuffer(ev)).toBe("ERR_BUFFER_PENDENTE");
    expect(await sondarBuffer({})).toBe("ERR_BUFFER_PENDENTE");
  });

  it("I4: situacaoArquivo só decide com fonte válida", async () => {
    registrarChatsUpdate(23, [{ id: "a@s.whatsapp.net", archived: true }]);
    expect(situacaoArquivo(23, "a@s.whatsapp.net", 0)).toBe("sem_fonte");
    await sincronizarConexao(23, deps(fakeSock({}), { agora: () => 0 }));
    expect(situacaoArquivo(23, "a@s.whatsapp.net", 1000)).toBe("arquivada");
    expect(situacaoArquivo(23, "b@s.whatsapp.net", 1000)).toBe("livre");
    expect(situacaoArquivo(23, "a@s.whatsapp.net", 601_000)).toBe("sem_fonte");
    expect(situacaoArquivo(28, "a@s.whatsapp.net", 1000)).toBe("sem_fonte");
  });

  it("ciclo roda as conexões cobertas uma por vez", async () => {
    const ordem: number[] = [];
    const sock23 = fakeSock({});
    const sock1 = fakeSock({});
    const r = await rodarCicloArquivo({
      getWbot: (id: number) => {
        ordem.push(id);
        return id === 23 ? sock23 : sock1;
      },
      esperaMs: 0,
      timeoutMs: 50
    });
    expect(ordem).toEqual([23, 1]);
    expect(r.map(x => x.ok)).toEqual([true, true]);
  });

  it("ciclo é ligado uma vez só (reconexões não duplicam)", () => {
    process.env.RETORNO_IA_ARQUIVO_INICIO_S = "3600";
    expect(iniciarCicloArquivo({ getWbot: jest.fn() })).toBe(true);
    expect(iniciarCicloArquivo({ getWbot: jest.fn() })).toBe(false);
  });
});
