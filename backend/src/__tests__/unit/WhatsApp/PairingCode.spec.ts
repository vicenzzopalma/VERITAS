import {
  __resetPairingState,
  credsParaPersistir,
  ensurePairingCode,
  formatPairingCode,
  getPairingPayload,
  clearPairingCode,
  nameEnd4,
  normalizePairingNumber,
  pickCrmNumber,
  resolvePairingNumber,
  setTypedNumber,
  isPairingInProgress,
  isPairingProgressUpdate,
  markPairingInProgress,
  clearPairingInProgress,
  markWatching,
  isWatching
} from "../../../helpers/pairingCode";

// CRM inexistente: nada de leitura de arquivo real nos testes.
process.env.CRM_DB_PATH = "/caminho/que/nao/existe.sqlite";

const makeSocket = (codes: string[] = ["ABCD1234"], creds: any = {}) => {
  const calls: string[] = [];
  return {
    calls,
    authState: { creds },
    requestPairingCode: jest.fn(async (phone: string) => {
      calls.push(phone);
      const c = codes.shift();
      if (!c) throw new Error("falhou");
      return c;
    })
  };
};

describe("pairingCode helpers", () => {
  beforeEach(() => __resetPairingState());

  it("normaliza número: só dígitos, com DDI 55 quando faltar", () => {
    expect(normalizePairingNumber("(47) 99999-1234")).toBe("5547999991234");
    expect(normalizePairingNumber("+55 47 99999-1234")).toBe("5547999991234");
    expect(normalizePairingNumber("4733331234")).toBe("554733331234");
    expect(normalizePairingNumber("12345")).toBeNull();
    expect(normalizePairingNumber("55479999912345")).toBeNull();
    expect(normalizePairingNumber(undefined)).toBeNull();
  });

  it("formata o código como XXXX-XXXX", () => {
    expect(formatPairingCode("abcd1234")).toBe("ABCD-1234");
    expect(formatPairingCode("ABCD-1234")).toBe("ABCD-1234");
  });

  it("final do nome e escolha do CRM só com candidato único e DDI 55", () => {
    expect(nameEnd4("Disparo 1234")).toBe("1234");
    expect(nameEnd4("Disparo sem numero")).toBeNull();
    expect(pickCrmNumber("Disparo 1234", ["47999991234", "47988885678"])).toBe("5547999991234");
    // dois números com o mesmo final => dúvida => null
    expect(pickCrmNumber("Disparo 1234", ["47999991234", "11977771234"])).toBeNull();
    // mesmo número escrito de dois jeitos conta como um só
    expect(pickCrmNumber("Disparo 1234", ["47999991234", "+55 (47) 99999-1234"])).toBe("5547999991234");
    // número estrangeiro não vira automático
    expect(pickCrmNumber("Disparo 1234", ["351912341234"])).toBeNull();
  });

  it("resolve: digitado vence; final repetido entre conexões => null", async () => {
    expect(await resolvePairingNumber({ id: 1, name: "Disparo 1234" }, async () => 2)).toBeNull();
    setTypedNumber(1, "5547999991234");
    expect(await resolvePairingNumber({ id: 1, name: "Disparo 1234" }, async () => 2)).toBe("5547999991234");
  });

  it("credsParaPersistir tira pairingCode e o creds.me provisório", () => {
    const pendente = { pairingCode: "ABCD1234", me: { id: "55479@s.whatsapp.net", name: "~" }, x: 1 };
    const out: any = credsParaPersistir(pendente);
    expect(out.pairingCode).toBeUndefined();
    expect(out.me).toBeUndefined();
    expect(out.x).toBe(1);
    // o objeto em memória (usado pelo socket) fica intacto
    expect(pendente.pairingCode).toBe("ABCD1234");

    const pareado: any = credsParaPersistir({ pairingCode: "ABCD1234", me: { id: "a" }, account: {} });
    expect(pareado.pairingCode).toBeUndefined();
    expect(pareado.me).toEqual({ id: "a" });

    const normal = { me: { id: "a" } };
    expect(credsParaPersistir(normal)).toBe(normal);
  });
});

describe("ensurePairingCode", () => {
  beforeEach(() => __resetPairingState());

  const wa = { id: 7, name: "Disparo 1234", status: "qrcode" };

  it("sem número conhecido: SEM_NUMERO e não chama a biblioteca", async () => {
    const socket = makeSocket();
    const emitted: any[] = [];
    const p = await ensurePairingCode({ whatsapp: wa, socket, emit: e => emitted.push(e) });
    expect(p.status).toBe("SEM_NUMERO");
    expect(socket.requestPairingCode).not.toHaveBeenCalled();
    expect(emitted[emitted.length - 1].status).toBe("SEM_NUMERO");
  });

  it("com número: gera, formata e reaproveita no mesmo socket (QR girando)", async () => {
    setTypedNumber(7, "5547999991234");
    const socket = makeSocket(["ABCD1234", "ZZZZ9999"]);
    const emit = jest.fn();
    const p1 = await ensurePairingCode({ whatsapp: wa, socket, emit });
    expect(p1).toMatchObject({ status: "OK", code: "ABCD-1234", numberEnd: "1234" });
    expect(socket.calls).toEqual(["5547999991234"]);

    const p2 = await ensurePairingCode({ whatsapp: wa, socket, emit });
    expect(p2.code).toBe("ABCD-1234");
    expect(socket.requestPairingCode).toHaveBeenCalledTimes(1);
  });

  it("socket novo (QR novo) => código novo", async () => {
    setTypedNumber(7, "5547999991234");
    const emit = jest.fn();
    await ensurePairingCode({ whatsapp: wa, socket: makeSocket(["AAAA1111"]), emit });
    const p = await ensurePairingCode({ whatsapp: wa, socket: makeSocket(["BBBB2222"]), emit });
    expect(p.code).toBe("BBBB-2222");
  });

  it("nunca pede código em conexão CONNECTED ou já pareada", async () => {
    setTypedNumber(7, "5547999991234");
    const s1 = makeSocket();
    await ensurePairingCode({ whatsapp: { ...wa, status: "CONNECTED" }, socket: s1, emit: jest.fn() });
    const s2 = makeSocket(["X"], { registered: true });
    await ensurePairingCode({ whatsapp: wa, socket: s2, emit: jest.fn() });
    const s3 = makeSocket(["X"], { account: {} });
    await ensurePairingCode({ whatsapp: wa, socket: s3, emit: jest.fn() });
    expect(s1.requestPairingCode).not.toHaveBeenCalled();
    expect(s2.requestPairingCode).not.toHaveBeenCalled();
    expect(s3.requestPairingCode).not.toHaveBeenCalled();
  });

  it("falha vira ERRO sem repetir sozinha; pedido da tela (force) tenta de novo", async () => {
    setTypedNumber(7, "5547999991234");
    const socket = makeSocket([]);
    const onError = jest.fn();
    const p = await ensurePairingCode({ whatsapp: wa, socket, emit: jest.fn(), onError });
    expect(p.status).toBe("ERRO");
    expect(p.code).toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    await ensurePairingCode({ whatsapp: wa, socket, emit: jest.fn() });
    expect(socket.requestPairingCode).toHaveBeenCalledTimes(1);
    await ensurePairingCode({ whatsapp: wa, socket, emit: jest.fn(), force: true });
    expect(socket.requestPairingCode).toHaveBeenCalledTimes(2);
  });

  it("chamadas simultâneas pedem um código só", async () => {
    setTypedNumber(7, "5547999991234");
    const socket = makeSocket(["ABCD1234", "ZZZZ9999"]);
    const [a, b] = await Promise.all([
      ensurePairingCode({ whatsapp: wa, socket, emit: jest.fn() }),
      ensurePairingCode({ whatsapp: wa, socket, emit: jest.fn() })
    ]);
    expect(socket.requestPairingCode).toHaveBeenCalledTimes(1);
    expect(a.code).toBe("ABCD-1234");
    expect(b.code).toBe("ABCD-1234");
  });

  it("clearPairingCode apaga o código ao conectar", async () => {
    setTypedNumber(7, "5547999991234");
    await ensurePairingCode({ whatsapp: wa, socket: makeSocket(), emit: jest.fn() });
    clearPairingCode(7);
    expect(getPairingPayload(7).code).toBeUndefined();
  });
});

describe("fluxo do pareamento por código (item 81, correção do 515)", () => {
  beforeEach(() => __resetPairingState());

  const wa = { id: 9, name: "Disparo 1234", status: "qrcode" };

  it("companion_finish (registered sem account) ainda não grava o creds.me provisório", () => {
    const creds: any = {
      noiseKey: { k: 1 },
      pairingCode: "ABCD1234",
      me: { id: "5547999991234@s.whatsapp.net", name: "~" },
      registered: true,
      advSecretKey: "segredo"
    };
    const out: any = credsParaPersistir(creds);
    expect(out.me).toBeUndefined();
    expect(out.pairingCode).toBeUndefined();
    expect(out.registered).toBe(true);
    expect(out.advSecretKey).toBe("segredo");
    expect(out.noiseKey).toEqual({ k: 1 });
  });

  it("depois do pair-success grava tudo (me definitivo e account) para reconectar no 515", () => {
    const creds: any = {
      pairingCode: "ABCD1234",
      me: { id: "5547999991234:23@s.whatsapp.net", lid: "1@lid" },
      account: { details: "x" },
      registered: true,
      signalIdentities: [{ id: 1 }],
      platform: "android"
    };
    const out: any = credsParaPersistir(creds);
    expect(out.me).toEqual({ id: "5547999991234:23@s.whatsapp.net", lid: "1@lid" });
    expect(out.account).toEqual({ details: "x" });
    expect(out.signalIdentities).toEqual([{ id: 1 }]);
    expect(out.pairingCode).toBeUndefined();
  });

  it("detecta o pareamento em andamento pelos creds.update da biblioteca", () => {
    // requestPairingCode: só me provisório => não é andamento
    expect(isPairingProgressUpdate({ me: { id: "a" }, pairingCode: "X" }, {}, false)).toBe(false);
    // companion_finish
    expect(isPairingProgressUpdate({ registered: true }, {}, false)).toBe(true);
    // pair-success
    expect(isPairingProgressUpdate({ me: { id: "a:1" }, account: {} }, {}, false)).toBe(true);
    // login normal (CB:success) de sessão já pareada
    expect(isPairingProgressUpdate({ me: { id: "a:1", lid: "l" } }, { account: {} }, false)).toBe(false);
    expect(isPairingProgressUpdate({ registered: true }, { account: {} }, false)).toBe(false);
  });

  it("com pareamento em andamento não gera código novo, mesmo com QR girando ou pedido da tela", async () => {
    setTypedNumber(9, "5547999991234");
    const socket = makeSocket(["ABCD1234", "ZZZZ9999"]);
    await ensurePairingCode({ whatsapp: wa, socket, emit: jest.fn() });
    expect(socket.requestPairingCode).toHaveBeenCalledTimes(1);

    markPairingInProgress(9);
    expect(isPairingInProgress(9)).toBe(true);
    await ensurePairingCode({ whatsapp: wa, socket, emit: jest.fn() });
    await ensurePairingCode({ whatsapp: wa, socket: makeSocket(["Q"]), emit: jest.fn() });
    await ensurePairingCode({ whatsapp: wa, socket, emit: jest.fn(), force: true });
    expect(socket.requestPairingCode).toHaveBeenCalledTimes(1);

    // 515 => removeSession limpa o código, mas não o andamento
    clearPairingCode(9);
    expect(isPairingInProgress(9)).toBe(true);

    // conexão aberta depois do 515 encerra o andamento
    clearPairingInProgress(9);
    expect(isPairingInProgress(9)).toBe(false);
  });

  it("andamento expira sozinho depois do TTL", () => {
    const real = Date.now;
    markPairingInProgress(9);
    Date.now = () => real() + 4 * 60 * 1000;
    try {
      expect(isPairingInProgress(9)).toBe(false);
    } finally {
      Date.now = real;
    }
  });

  it("código automático só com o modal aberto (watching)", () => {
    expect(isWatching(9)).toBe(false);
    markWatching(9);
    expect(isWatching(9)).toBe(true);
    const real = Date.now;
    Date.now = () => real() + 4 * 60 * 1000;
    try {
      expect(isWatching(9)).toBe(false);
    } finally {
      Date.now = real;
    }
  });
});
