jest.mock("../../../models/Contact", () => ({}));
jest.mock("../../../models/LidMapping", () => ({}));
jest.mock("../../../models/Ticket", () => ({}));
jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

const mockConsultar = jest.fn();
jest.mock("../../../services/RetornoIaServices/ConsultarLidsService", () => {
  const real = jest.requireActual(
    "../../../services/RetornoIaServices/ConsultarLidsService"
  );
  return {
    __esModule: true,
    ...real,
    default: (...a: any[]) => mockConsultar(...a)
  };
});
jest.mock("../../../providers/WhatsApp/Implementations/whaileys", () => ({
  getWbot: jest.fn()
}));

// eslint-disable-next-line import/first
import * as C from "../../../controllers/RetornoIaController";
// eslint-disable-next-line import/first
import {
  registrarConexao,
  _resetSessoesParaTestes
} from "../../../helpers/retornoIaSessao";
// eslint-disable-next-line import/first
import {
  registrarConflito,
  _resetConflitosParaTestes
} from "../../../helpers/lidConflitos";
// eslint-disable-next-line import/first
import {
  registrarChatsUpdate,
  _resetArquivoParaTestes
} from "../../../helpers/retornoIaArquivo";

const servico = jest.requireActual(
  "../../../services/RetornoIaServices/ConsultarLidsService"
);

const L1 = "123456789012345";
const L2 = "998877665544332";
const L3 = "111122223333444";

const fontes = (over: any = {}) => ({
  lidsDaConexao: jest.fn(async () => [L1, `${L2}@lid`]),
  mapeamentos: jest.fn(async () => [
    { lid: L1, phoneNumber: "5547999990000", whatsappId: 23 },
    { lid: L2, phoneNumber: "5511988887777", whatsappId: 0 }
  ]),
  contatos: jest.fn(async () => [
    { id: 5, number: "5511900001111", lid: `${L2}@lid` },
    { id: 6, number: L3, lid: `${L3}@lid` }
  ]),
  ...over
});

const fakeRes = () => {
  const res: any = { statusCode: 200, headers: {} };
  res.status = jest.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = jest.fn((b: any) => {
    res.body = b;
    return res;
  });
  res.setHeader = jest.fn((k: string, v: string) => {
    res.headers[k] = v;
  });
  return res;
};

describe("ConsultarLidsService", () => {
  const envOriginal = { ...process.env };
  beforeEach(() => {
    _resetConflitosParaTestes();
    _resetArquivoParaTestes();
    process.env = { ...envOriginal };
  });
  afterAll(() => {
    process.env = envOriginal;
  });

  it("resolve por conexão, marca conflito e conta os sem telefone", async () => {
    const f = fontes();
    const r = await servico.default(23, [], f);
    expect(f.lidsDaConexao).toHaveBeenCalledWith(23);
    expect(r).toMatchObject({
      conexao: 23,
      total: 2,
      resolvidos: 1,
      conflitos: 1,
      sem_telefone: 0
    });
    expect(r.lids[0]).toMatchObject({
      lid: L1,
      telefone: "5547999990000",
      conflito: false
    });
    expect(r.lids[1]).toMatchObject({
      lid: L2,
      telefone: null,
      conflito: true,
      candidatos: ["5511900001111", "5511988887777"]
    });
  });

  it("lids pedidos restringem a consulta e não varrem a conexão", async () => {
    const f = fontes({ mapeamentos: jest.fn(async () => []) });
    const r = await servico.default(23, [`${L3}@lid`, "lixo"], f);
    expect(f.lidsDaConexao).not.toHaveBeenCalled();
    expect(r.lids).toEqual([
      expect.objectContaining({ lid: L3, telefone: null, conflito: false })
    ]);
    expect(r.sem_telefone).toBe(1);
  });

  it("inclui as arquivadas em @lid da conexão", async () => {
    process.env.RETORNO_IA_CONEXOES = "23";
    process.env.RETORNO_IA_ARQUIVO_CONEXOES = "23";
    registrarChatsUpdate(23, [{ id: `${L3}@lid`, archived: true }]);
    const f = fontes({ lidsDaConexao: jest.fn(async () => []) });
    const r = await servico.default(23, [], f);
    expect(f.mapeamentos).toHaveBeenCalledWith([L3], 23);
    expect(r.total).toBe(1);
  });

  it("conflito registrado por fusão aparece na consulta", async () => {
    registrarConflito({
      lid: L1,
      telefones: ["5547999990000", "5521977776666"],
      origem: "lid_de_outro_contato",
      bloqueado: false
    });
    const r = await servico.default(23, [L1], fontes());
    expect(r.lids[0]).toMatchObject({
      lid: L1,
      telefone: null,
      conflito: true
    });
  });

  it("sem LID nenhum devolve lista vazia sem consultar o banco", async () => {
    const f = fontes({ lidsDaConexao: jest.fn(async () => []) });
    const r = await servico.default(23, [], f);
    expect(r).toMatchObject({ total: 0, lids: [] });
    expect(f.mapeamentos).not.toHaveBeenCalled();
  });
});

describe("rotas /internal/retorno-ia/lids e /sessoes", () => {
  const envOriginal = { ...process.env };
  beforeEach(() => {
    _resetSessoesParaTestes();
    mockConsultar.mockReset();
    process.env = { ...envOriginal };
    process.env.RETORNO_IA_CONEXOES = "23,28";
  });
  afterAll(() => {
    process.env = envOriginal;
  });

  it("lids: negada por padrão e fora da lista; liberada devolve o serviço com no-store", async () => {
    let res = fakeRes();
    await C.lids({ query: { conexao: "23" } } as any, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.codigo).toBe("ERR_CONEXAO_NAO_LIBERADA");

    process.env.RETORNO_IA_LID_CONEXOES = "23,99";
    res = fakeRes();
    await C.lids({ query: { conexao: "99" } } as any, res);
    expect(res.statusCode).toBe(403);

    mockConsultar.mockResolvedValue({ conexao: 23, total: 0, lids: [] });
    res = fakeRes();
    await C.lids({ query: { conexao: "23", lid: `${L1}, ${L2}` } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(mockConsultar).toHaveBeenCalledWith(23, [L1, L2]);
    expect(res.body).toMatchObject({ ok: true, conexao: 23 });
    expect(res.headers["Cache-Control"]).toBe("no-store");
  });

  it("lids: pedido grande e falha do banco têm códigos próprios, sem detalhe", async () => {
    process.env.RETORNO_IA_LID_CONEXOES = "23";
    let res = fakeRes();
    const muitos = Array.from({ length: 501 }, (_, i) =>
      String(10 ** 14 + i)
    ).join(",");
    await C.lids({ query: { conexao: "23", lid: muitos } } as any, res);
    expect(res.body.codigo).toBe("ERR_PEDIDO_GRANDE");

    mockConsultar.mockRejectedValue(new Error("SQLITE_BUSY segredo"));
    res = fakeRes();
    await C.lids({ query: { conexao: "23" } } as any, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.codigo).toBe("ERR_CONSULTA_FALHOU");
    expect(JSON.stringify(res.body)).not.toContain("segredo");
  });

  it("sessoes: lista as cobertas, filtra e nega fora da lista", () => {
    process.env.RETORNO_IA_SESSAO_CONEXOES = "23";
    registrarConexao(23, { connection: "open" }, Date.now() - 60_000);
    let res = fakeRes();
    C.sessoes({ query: {} } as any, res);
    expect(res.body.conexoes).toEqual([
      expect.objectContaining({ conexao: 23, estado: "open" })
    ]);
    expect(res.headers["Cache-Control"]).toBe("no-store");
    res = fakeRes();
    C.sessoes({ query: { conexao: "28" } } as any, res);
    expect(res.statusCode).toBe(403);
  });
});
