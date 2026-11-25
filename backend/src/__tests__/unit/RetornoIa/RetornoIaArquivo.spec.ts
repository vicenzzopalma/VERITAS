import { EventEmitter } from "events";

jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

// eslint-disable-next-line import/first
import {
  COLECAO_ARQUIVO,
  arquivoAtivo,
  conexoesArquivo,
  decodificarChavesAppState,
  filtrarArquivo,
  iniciarCicloArquivo,
  registrarChatsUpdate,
  retratoArquivo,
  rodarCicloArquivo,
  sincronizarConexao,
  _resetArquivoParaTestes
} from "../../../helpers/retornoIaArquivo";

// Socket falso: authState.keys em memória e resyncAppState que emite chats.update.
const fakeSock = (opts: {
  versao?: any;
  emitir?: any[];
  falharLog?: boolean;
  lancar?: boolean;
  pendurar?: boolean;
  semVersaoDepois?: boolean;
  logger?: any;
}) => {
  const ev = new EventEmitter();
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
  const resyncAppState = jest.fn(async () => {
    if (opts.pendurar) return new Promise(() => undefined);
    if (opts.lancar) throw new Error("boom");
    if (opts.falharLog && opts.logger)
      opts.logger.info(
        { name: COLECAO_ARQUIVO },
        "failed to sync state from version"
      );
    if (!opts.semVersaoDepois) store[COLECAO_ARQUIVO] = { version: 9 };
    ev.emit("chats.update", opts.emitir || []);
    return undefined;
  });
  return { ev, authState: { keys }, resyncAppState, store, sets };
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
    registrarChatsUpdate(23, [{ id: "velho@s.whatsapp.net", archived: true }]);
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
    // snapshot completo substitui o que havia antes
    expect(c23).toMatchObject({ idade_s: 30, valida: true, ultimo_erro: null });
    expect(c23.arquivadas).toEqual(["a@s.whatsapp.net", "b@lid"]);
    expect(sock.ev.listenerCount("chats.update")).toBe(0);
  });

  it("depois do snapshot, sync incremental sem zerar a versão e com merge", async () => {
    const sock = fakeSock({
      emitir: [{ id: "a@s.whatsapp.net", archived: true }]
    });
    await sincronizarConexao(23, deps(sock));
    (sock as any).resyncAppState.mockImplementation(async () => {
      sock.ev.emit("chats.update", [
        { id: "a@s.whatsapp.net", archived: false },
        { id: "n@s.whatsapp.net", archived: true }
      ]);
    });
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
    // a outra conexão nunca sincronizou: sem fonte
    expect(retratoArquivo(1)[1]).toMatchObject({
      conexao: 1,
      ultima_sync_ok: null,
      valida: false
    });
    process.env.RETORNO_IA_ARQUIVO_VALIDADE_S = "60";
    expect(retratoArquivo(61_000)[0].valida).toBe(false);
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

  it("'failed to sync state' no logger invalida a sync e força snapshot na próxima", async () => {
    const loggerSocket = { info: jest.fn() };
    const sock = fakeSock({ falharLog: true, logger: loggerSocket });
    const r = await sincronizarConexao(
      23,
      deps(sock, { loggerSocket, agora: () => 5 })
    );
    expect(r).toMatchObject({ ok: false, codigo: "ERR_SYNC_FALHOU" });
    expect(retratoArquivo(10)[0]).toMatchObject({
      ultima_sync_ok: null,
      valida: false
    });
    // o log original continua sendo chamado
    expect((loggerSocket as any).info).toBeDefined();
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
});
