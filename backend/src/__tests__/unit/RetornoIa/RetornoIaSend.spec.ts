import AppError from "../../../errors/AppError";

const mockGetWbot = jest.fn();
jest.mock("../../../providers/WhatsApp/Implementations/whaileys", () => ({
  getWbot: (id: number) => mockGetWbot(id)
}));
jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

// eslint-disable-next-line import/first
import * as C from "../../../controllers/RetornoIaController";
// eslint-disable-next-line import/first
import {
  registrarChatsUpdate,
  sincronizarConexao,
  _resetArquivoParaTestes
} from "../../../helpers/retornoIaArquivo";

const fakeRes = () => {
  const res: any = {};
  res.statusCode = 200;
  res.status = jest.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = jest.fn((b: any) => {
    res.body = b;
    return res;
  });
  res.headers = {};
  res.setHeader = jest.fn((k: string, v: string) => {
    res.headers[k] = v;
  });
  return res;
};

const fakeWbot = (id = "MSGID123") => ({
  sendPresenceUpdate: jest.fn().mockResolvedValue(undefined),
  sendMessage: jest
    .fn()
    .mockResolvedValue(id === "" ? { key: {} } : { key: { id } })
});

const enviar = async (body: any) => {
  const res = fakeRes();
  await C.send({ body } as any, res);
  return res;
};

const NUM = "5547999990000";
const PDF_B64 = Buffer.from("%PDF-1.4 teste").toString("base64");

describe("RetornoIa /internal/retorno-ia/send", () => {
  const envOriginal = { ...process.env };
  let wbot: ReturnType<typeof fakeWbot>;

  beforeEach(() => {
    process.env = { ...envOriginal };
    process.env.RETORNO_IA_CONEXOES = "23,28,161";
    delete process.env.RETORNO_IA_MAX_MIDIA_BYTES;
    wbot = fakeWbot();
    mockGetWbot.mockReset();
    mockGetWbot.mockReturnValue(wbot);
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  it("pedido antigo, só texto e sem tipo, continua funcionando e devolve mensagem_id", async () => {
    const res = await enviar({
      whatsappId: 23,
      numero: NUM,
      texto: "olá",
      delay: 0
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      mensagem_id: "MSGID123",
      tipo: "texto"
    });
    expect(wbot.sendPresenceUpdate).toHaveBeenCalledWith(
      "composing",
      `${NUM}@s.whatsapp.net`
    );
    expect(wbot.sendMessage).toHaveBeenCalledWith(`${NUM}@s.whatsapp.net`, {
      text: "olá"
    });
  });

  it("conexão fora de RETORNO_IA_CONEXOES é negada sem tocar o socket", async () => {
    const res = await enviar({ whatsappId: 99, numero: NUM, texto: "olá" });
    expect(res.statusCode).toBe(403);
    expect(res.body.codigo).toBe("ERR_CONEXAO_NAO_LIBERADA");
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("devolve 503 ERR_WAPP_NOT_INITIALIZED quando o getWbot falha antes do envio", async () => {
    mockGetWbot.mockImplementation(() => {
      throw new AppError("ERR_WAPP_NOT_INITIALIZED");
    });
    const res = await enviar({ whatsappId: 23, numero: NUM, texto: "olá" });
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      ok: false,
      codigo: "ERR_WAPP_NOT_INITIALIZED",
      erro: "conexão não iniciada"
    });
  });

  it("falha no sendMessage sai como 500 ERR_ENVIO_FALHOU sem vazar o erro interno", async () => {
    wbot.sendMessage.mockRejectedValue(
      new Error("Connection Closed segredo-interno")
    );
    const res = await enviar({ whatsappId: 23, numero: NUM, texto: "olá" });
    expect(res.statusCode).toBe(500);
    expect(res.body.codigo).toBe("ERR_ENVIO_FALHOU");
    expect(JSON.stringify(res.body)).not.toContain("segredo");
  });

  it("envio sem key.id vira 502 ERR_SEM_MENSAGEM_ID (cliente não deve reenviar)", async () => {
    mockGetWbot.mockReturnValue(fakeWbot(""));
    const res = await enviar({ whatsappId: 23, numero: NUM, texto: "olá" });
    expect(res.statusCode).toBe(502);
    expect(res.body.codigo).toBe("ERR_SEM_MENSAGEM_ID");
  });

  it("recusa número, tipo e texto inválidos com códigos distintos", async () => {
    expect(
      (await enviar({ whatsappId: 23, numero: "123", texto: "x" })).body.codigo
    ).toBe("ERR_NUMERO_INVALIDO");
    expect(
      (await enviar({ whatsappId: 23, numero: NUM, tipo: "video", texto: "x" }))
        .body.codigo
    ).toBe("ERR_TIPO_INVALIDO");
    expect(
      (await enviar({ whatsappId: 23, numero: NUM, texto: "  " })).body.codigo
    ).toBe("ERR_TEXTO_INVALIDO");
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("mídia fica desligada sem RETORNO_IA_MAX_MIDIA_BYTES", async () => {
    const res = await enviar({
      whatsappId: 23,
      numero: NUM,
      tipo: "documento",
      base64: PDF_B64,
      mimetype: "application/pdf",
      nome_arquivo: "boleto.pdf"
    });
    expect(res.statusCode).toBe(403);
    expect(res.body.codigo).toBe("ERR_MIDIA_DESLIGADA");
    expect(wbot.sendMessage).not.toHaveBeenCalled();
  });

  describe("com mídia ligada", () => {
    beforeEach(() => {
      process.env.RETORNO_IA_MAX_MIDIA_BYTES = "1024";
    });

    it("documento: buffer, mimetype, nome e legenda", async () => {
      const res = await enviar({
        whatsappId: 28,
        numero: NUM,
        tipo: "documento",
        base64: PDF_B64,
        mimetype: "application/pdf",
        nome_arquivo: "boleto.pdf",
        texto: "segue o boleto"
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.mensagem_id).toBe("MSGID123");
      const [, conteudo] = wbot.sendMessage.mock.calls[0];
      expect(Buffer.isBuffer(conteudo.document)).toBe(true);
      expect(conteudo.document.toString()).toBe("%PDF-1.4 teste");
      expect(conteudo).toMatchObject({
        mimetype: "application/pdf",
        fileName: "boleto.pdf",
        caption: "segue o boleto"
      });
      expect(wbot.sendPresenceUpdate).not.toHaveBeenCalled();
    });

    it("imagem: exige mimetype image/*", async () => {
      const b64 = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
      const ok = await enviar({
        whatsappId: 23,
        numero: NUM,
        tipo: "imagem",
        base64: b64,
        mimetype: "image/png"
      });
      expect(ok.statusCode).toBe(200);
      expect(wbot.sendMessage.mock.calls[0][1]).toMatchObject({
        mimetype: "image/png"
      });
      expect(Buffer.isBuffer(wbot.sendMessage.mock.calls[0][1].image)).toBe(
        true
      );

      const errado = await enviar({
        whatsappId: 23,
        numero: NUM,
        tipo: "imagem",
        base64: b64,
        mimetype: "application/pdf"
      });
      expect(errado.statusCode).toBe(400);
      expect(errado.body.codigo).toBe("ERR_MIMETYPE_INVALIDO");
    });

    it("áudio: mimetype audio/*, ptt opcional e presença recording", async () => {
      const b64 = Buffer.from("OggS....").toString("base64");
      const res = await enviar({
        whatsappId: 161,
        numero: NUM,
        tipo: "audio",
        base64: b64,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      });
      expect(res.statusCode).toBe(200);
      expect(wbot.sendPresenceUpdate).toHaveBeenCalledWith(
        "recording",
        `${NUM}@s.whatsapp.net`
      );
      expect(wbot.sendMessage.mock.calls[0][1]).toMatchObject({
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      });
    });

    it("teto de tamanho: 413 ERR_MIDIA_GRANDE acima de RETORNO_IA_MAX_MIDIA_BYTES, sem enviar", async () => {
      const exato = Buffer.alloc(1024, 1).toString("base64");
      const acima = Buffer.alloc(1025, 1).toString("base64");
      const base = {
        whatsappId: 23,
        numero: NUM,
        tipo: "documento",
        mimetype: "application/pdf",
        nome_arquivo: "a.pdf"
      };
      expect((await enviar({ ...base, base64: exato })).statusCode).toBe(200);
      const res = await enviar({ ...base, base64: acima });
      expect(res.statusCode).toBe(413);
      expect(res.body.codigo).toBe("ERR_MIDIA_GRANDE");
      expect(wbot.sendMessage).toHaveBeenCalledTimes(1);
    });

    it("documento sem nome, base64 quebrado ou nome com barra são recusados", async () => {
      const base = {
        whatsappId: 23,
        numero: NUM,
        tipo: "documento",
        mimetype: "application/pdf"
      };
      expect((await enviar({ ...base, base64: PDF_B64 })).body.codigo).toBe(
        "ERR_NOME_ARQUIVO_INVALIDO"
      );
      expect(
        (await enviar({ ...base, base64: "@@@", nome_arquivo: "a.pdf" })).body
          .codigo
      ).toBe("ERR_MIDIA_INVALIDA");
      expect(
        (await enviar({ ...base, base64: PDF_B64, nome_arquivo: "../a.pdf" }))
          .body.codigo
      ).toBe("ERR_NOME_ARQUIVO_INVALIDO");
      expect(wbot.sendMessage).not.toHaveBeenCalled();
    });
  });
});

describe("RetornoIa autorização", () => {
  const envOriginal = { ...process.env };
  afterEach(() => {
    process.env = { ...envOriginal };
  });

  const chamar = (headers: any, ip = "127.0.0.1") => {
    const res = fakeRes();
    const next = jest.fn();
    C.autorizar({ headers, socket: { remoteAddress: ip } } as any, res, next);
    return { res, next };
  };

  it("sem token no ambiente a rota fica desligada (503)", () => {
    delete process.env.RETORNO_IA_INTERNAL_TOKEN;
    const { res, next } = chamar({ "x-retorno-ia-token": "x" });
    expect(res.statusCode).toBe(503);
    expect(res.body.codigo).toBe("ERR_ROTA_DESLIGADA");
    expect(next).not.toHaveBeenCalled();
  });

  it("exige IP de MARCELA_ALLOWED_IPS e o header x-retorno-ia-token", () => {
    process.env.RETORNO_IA_INTERNAL_TOKEN = "tok-teste";
    process.env.MARCELA_ALLOWED_IPS = "127.0.0.1";
    expect(
      chamar({ "x-retorno-ia-token": "tok-teste" }, "10.0.0.9").res.statusCode
    ).toBe(403);
    expect(chamar({ "x-retorno-ia-token": "errado" }).res.statusCode).toBe(401);
    expect(
      chamar({ "x-retorno-ia-token": "tok-teste" }, "::ffff:127.0.0.1").next
    ).toHaveBeenCalled();
  });
});

describe("RetornoIa /internal/retorno-ia/arquivadas", () => {
  const envOriginal = { ...process.env };
  beforeEach(() => {
    _resetArquivoParaTestes();
    process.env = { ...envOriginal };
    process.env.RETORNO_IA_CONEXOES = "23,28";
    process.env.RETORNO_IA_ARQUIVO_CONEXOES = "23";
  });
  afterAll(() => {
    process.env = envOriginal;
  });

  const ler = (query: any = {}) => {
    const res = fakeRes();
    C.arquivadas({ query } as any, res);
    return res;
  };

  it("lista só as conexões cobertas; sem sync boa a fonte não é válida", () => {
    registrarChatsUpdate(23, [{ id: "a@s.whatsapp.net", archived: true }]);
    const res = ler();
    expect(res.body.ok).toBe(true);
    expect(res.body.validade_s).toBe(600);
    expect(res.body.conexoes).toHaveLength(1);
    expect(res.body.conexoes[0]).toMatchObject({
      conexao: 23,
      ultima_sync_ok: null,
      idade_s: null,
      valida: false,
      arquivadas: ["a@s.whatsapp.net"]
    });
  });

  it("conexão fora da lista de arquivo é negada", () => {
    expect(ler({ conexao: "28" }).statusCode).toBe(403);
    expect(ler({ conexao: "28" }).body.codigo).toBe("ERR_CONEXAO_NAO_LIBERADA");
    expect(ler({ conexao: "23" }).statusCode).toBe(200);
  });

  it("M7: resposta com Cache-Control no-store", () => {
    expect(ler().headers["Cache-Control"]).toBe("no-store");
  });
});

describe("RetornoIa validações extras (revisão M6/M8)", () => {
  const envOriginal = { ...process.env };
  let wbot: ReturnType<typeof fakeWbot>;
  beforeEach(() => {
    process.env = { ...envOriginal };
    process.env.RETORNO_IA_CONEXOES = "23";
    process.env.RETORNO_IA_MAX_MIDIA_BYTES = "1024";
    wbot = fakeWbot();
    mockGetWbot.mockReset();
    mockGetWbot.mockReturnValue(wbot);
  });
  afterAll(() => {
    process.env = envOriginal;
  });
  const b64 = Buffer.from("conteudo").toString("base64");

  it("tipo null vale como texto (pedido antigo)", async () => {
    const res = await enviar({
      whatsappId: 23,
      numero: NUM,
      tipo: null,
      texto: "oi"
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.tipo).toBe("texto");
  });

  it("mimetype fora da lista branca é recusado (svg, html, exe)", async () => {
    const base = { whatsappId: 23, numero: NUM, base64: b64 };
    expect(
      (await enviar({ ...base, tipo: "imagem", mimetype: "image/svg+xml" }))
        .body.codigo
    ).toBe("ERR_MIMETYPE_INVALIDO");
    expect(
      (
        await enviar({
          ...base,
          tipo: "documento",
          mimetype: "text/html",
          nome_arquivo: "a.pdf"
        })
      ).body.codigo
    ).toBe("ERR_MIMETYPE_INVALIDO");
    expect(
      (
        await enviar({
          ...base,
          tipo: "documento",
          mimetype: "application/x-msdownload",
          nome_arquivo: "a.pdf"
        })
      ).body.codigo
    ).toBe("ERR_MIMETYPE_INVALIDO");
    expect(wbot.sendMessage).not.toHaveBeenCalled();
  });

  it("nome com caractere de controle ou extensão perigosa é recusado", async () => {
    const base = {
      whatsappId: 23,
      numero: NUM,
      base64: b64,
      tipo: "documento",
      mimetype: "application/pdf"
    };
    expect(
      (
        await enviar({
          ...base,
          nome_arquivo: `a${String.fromCharCode(10)}b.pdf`
        })
      ).body.codigo
    ).toBe("ERR_NOME_ARQUIVO_INVALIDO");
    expect(
      (await enviar({ ...base, nome_arquivo: "x.html" })).body.codigo
    ).toBe("ERR_NOME_ARQUIVO_INVALIDO");
    expect((await enviar({ ...base, nome_arquivo: "boleto" })).statusCode).toBe(
      200
    );
  });
});

describe("RetornoIa trava server-side de arquivadas (revisão I4)", () => {
  const envOriginal = { ...process.env };
  let wbot: ReturnType<typeof fakeWbot>;
  const JID = `${NUM}@s.whatsapp.net`;

  const sockOk = () => ({
    ev: {
      on: jest.fn(),
      off: jest.fn(),
      buffer: () => true,
      flush: async () => undefined
    },
    authState: {
      keys: {
        get: async () => ({ regular_low: { version: 3 } }),
        set: async () => undefined
      }
    },
    resyncAppState: async () => undefined
  });
  const fonteValida = () =>
    sincronizarConexao(23, {
      getWbot: () => sockOk(),
      esperaMs: 0,
      timeoutMs: 50
    });

  beforeEach(() => {
    _resetArquivoParaTestes();
    process.env = { ...envOriginal };
    process.env.RETORNO_IA_CONEXOES = "23,28";
    process.env.RETORNO_IA_ARQUIVO_CONEXOES = "23";
    process.env.RETORNO_IA_TRAVA_ARQUIVADAS = "1";
    wbot = fakeWbot();
    mockGetWbot.mockReset();
    mockGetWbot.mockReturnValue(wbot);
  });
  afterAll(() => {
    process.env = envOriginal;
  });

  it("fonte válida e jid arquivado: 409 ERR_ARQUIVADA sem tocar o socket", async () => {
    registrarChatsUpdate(23, [{ id: JID, archived: true }]);
    await fonteValida();
    const res = await enviar({ whatsappId: 23, numero: NUM, texto: "oi" });
    expect(res.statusCode).toBe(409);
    expect(res.body.codigo).toBe("ERR_ARQUIVADA");
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("fonte válida e jid não arquivado: envia", async () => {
    registrarChatsUpdate(23, [{ id: JID, archived: false }]);
    await fonteValida();
    expect(
      (await enviar({ whatsappId: 23, numero: NUM, texto: "oi" })).statusCode
    ).toBe(200);
  });

  it("sem fonte válida a rota não decide (envia; a porta final é do robô)", async () => {
    registrarChatsUpdate(23, [{ id: JID, archived: true }]);
    expect(
      (await enviar({ whatsappId: 23, numero: NUM, texto: "oi" })).statusCode
    ).toBe(200);
  });

  it("trava desligada (padrão) ou conexão não coberta: comportamento antigo", async () => {
    registrarChatsUpdate(23, [{ id: JID, archived: true }]);
    await fonteValida();
    delete process.env.RETORNO_IA_TRAVA_ARQUIVADAS;
    expect(
      (await enviar({ whatsappId: 23, numero: NUM, texto: "oi" })).statusCode
    ).toBe(200);
    process.env.RETORNO_IA_TRAVA_ARQUIVADAS = "1";
    expect(
      (await enviar({ whatsappId: 28, numero: NUM, texto: "oi" })).statusCode
    ).toBe(200);
  });
});
