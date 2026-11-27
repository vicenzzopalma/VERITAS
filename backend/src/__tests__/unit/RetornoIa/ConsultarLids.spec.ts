import { EventEmitter } from "events";
import { Op } from "sequelize";

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

const servico = jest.requireActual(
  "../../../services/RetornoIaServices/ConsultarLidsService"
);

const L1 = "123456789012345";
const L2 = "998877665544332";
const L3 = "111122223333444";

const fontes = (over: any = {}) => ({
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
  const res: any = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.writableEnded = false;
  res.status = jest.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = jest.fn((b: any) => {
    res.body = b;
    res.writableEnded = true;
    return res;
  });
  res.setHeader = jest.fn((k: string, v: string) => {
    res.headers[k] = v;
  });
  return res;
};

describe("ConsultarLidsService", () => {
  beforeEach(() => {
    _resetConflitosParaTestes();
  });

  it("filtro de contatos só usa igualdade e faixa (indexáveis), nunca LIKE", () => {
    const w: any = servico.filtroContatosPorLid([L1, L2]);
    const ou = w[Op.or];
    expect(w.isGroup).toBe(false);
    expect(ou[0]).toEqual({
      lid: { [Op.in]: [`${L1}@lid`, L1, `${L2}@lid`, L2] }
    });
    expect(ou[1]).toEqual({ number: { [Op.in]: [L1, L2] } });
    expect(ou[2]).toEqual({ lid: { [Op.gte]: `${L1}:`, [Op.lt]: `${L1};` } });
    expect(ou[3]).toEqual({ lid: { [Op.gte]: `${L2}:`, [Op.lt]: `${L2};` } });
    const texto = JSON.stringify(w, (_k, v) => v);
    expect(texto).not.toMatch(/%/);
    expect(Object.getOwnPropertySymbols(ou[2].lid)).not.toContain(Op.like);
    // a faixa pega o formato com dispositivo e não pega LID vizinho
    const faixa = (lid: string) => lid >= `${L1}:` && lid < `${L1};`;
    expect(faixa(`${L1}:12@lid`)).toBe(true);
    expect(faixa(`${L1}@lid`)).toBe(false);
    expect(faixa(`${L1}9@lid`)).toBe(false);
  });

  it("resolve os pedidos, marca conflito e conta os sem telefone", async () => {
    const f = fontes();
    const r = await servico.default(
      23,
      [L1, `${L2}@lid`, `${L3}:3@lid`, "lixo"],
      f
    );
    expect(f.mapeamentos).toHaveBeenCalledWith([L1, L2, L3], 23);
    expect(f.contatos).toHaveBeenCalledWith([L1, L2, L3]);
    expect(r).toMatchObject({
      total: 3,
      resolvidos: 1,
      conflitos: 1,
      sem_telefone: 1
    });
    expect(r.lids[0]).toMatchObject({
      lid: L3,
      telefone: null,
      conflito: false
    });
    expect(r.lids[1]).toMatchObject({ lid: L1, telefone: "5547999990000" });
    expect(r.lids[2]).toMatchObject({
      lid: L2,
      telefone: null,
      conflito: true,
      candidatos: ["5511900001111", "5511988887777"]
    });
  });

  it("sem LID válido não consulta o banco; nunca passa do teto", async () => {
    const f = fontes();
    expect((await servico.default(23, ["lixo"], f)).total).toBe(0);
    expect(f.mapeamentos).not.toHaveBeenCalled();
    const muitos = Array.from({ length: 80 }, (_, i) => String(10 ** 14 + i));
    await servico.default(23, muitos, f);
    expect(f.mapeamentos.mock.calls[0][0]).toHaveLength(
      servico.MAX_LIDS_PEDIDOS
    );
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

  it("sinal abortado entre as leituras interrompe sem ler o resto", async () => {
    const sinal = { aborted: false };
    const f = fontes({
      mapeamentos: jest.fn(async () => {
        sinal.aborted = true; // cliente desistiu durante a 1ª leitura
        return [];
      })
    });
    await expect(servico.default(23, [L1], f, sinal)).rejects.toBeInstanceOf(
      servico.ConsultaCancelada
    );
    expect(f.contatos).not.toHaveBeenCalled();
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

  const pedir = (query: any) => ({ query } as any);

  it("lids: negada por padrão e fora da lista; liberada passa os LIDs e o sinal", async () => {
    let res = fakeRes();
    await C.lids(pedir({ conexao: "23", lid: L1 }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.codigo).toBe("ERR_CONEXAO_NAO_LIBERADA");

    process.env.RETORNO_IA_LID_CONEXOES = "23,99";
    res = fakeRes();
    await C.lids(pedir({ conexao: "99", lid: L1 }), res);
    expect(res.statusCode).toBe(403);

    mockConsultar.mockResolvedValue({ conexao: 23, total: 0, lids: [] });
    res = fakeRes();
    await C.lids(pedir({ conexao: "23", lid: `${L1}, ${L2}` }), res);
    expect(res.statusCode).toBe(200);
    expect(mockConsultar).toHaveBeenCalledWith(23, [L1, L2], undefined, {
      aborted: false
    });
    expect(res.body).toMatchObject({ ok: true, conexao: 23 });
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(res.listenerCount("close")).toBe(0);
  });

  it("lids: sem lid= é 400 (modo conexão inteira retirado); pedido grande também", async () => {
    process.env.RETORNO_IA_LID_CONEXOES = "23";
    let res = fakeRes();
    await C.lids(pedir({ conexao: "23" }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.codigo).toBe("ERR_LID_OBRIGATORIO");
    res = fakeRes();
    const muitos = Array.from({ length: 51 }, (_, i) =>
      String(10 ** 14 + i)
    ).join(",");
    await C.lids(pedir({ conexao: "23", lid: muitos }), res);
    expect(res.body.codigo).toBe("ERR_PEDIDO_GRANDE");
    expect(mockConsultar).not.toHaveBeenCalled();
  });

  it("lids: tempo do servidor esgotado = 504 e o sinal fica abortado", async () => {
    process.env.RETORNO_IA_LID_CONEXOES = "23";
    process.env.RETORNO_IA_LID_TIMEOUT_MS = "20";
    let sinal: any;
    mockConsultar.mockImplementation((_i: any, _l: any, _f: any, s: any) => {
      sinal = s;
      return new Promise(() => undefined);
    });
    const res = fakeRes();
    await C.lids(pedir({ conexao: "23", lid: L1 }), res);
    expect(res.statusCode).toBe(504);
    expect(res.body.codigo).toBe("ERR_TEMPO_ESGOTADO");
    expect(sinal.aborted).toBe(true);
  });

  it("lids: cliente que fecha a conexão aborta o sinal; consulta cancelada vira 504", async () => {
    process.env.RETORNO_IA_LID_CONEXOES = "23";
    const res = fakeRes();
    mockConsultar.mockImplementation(
      async (_i: any, _l: any, _f: any, s: any) => {
        res.emit("close"); // cliente desistiu antes da resposta
        expect(s.aborted).toBe(true);
        throw new servico.ConsultaCancelada();
      }
    );
    await C.lids(pedir({ conexao: "23", lid: L1 }), res);
    expect(res.statusCode).toBe(504);
  });

  it("lids: falha do banco tem código próprio, sem detalhe", async () => {
    process.env.RETORNO_IA_LID_CONEXOES = "23";
    mockConsultar.mockRejectedValue(new Error("SQLITE_BUSY segredo"));
    const res = fakeRes();
    await C.lids(pedir({ conexao: "23", lid: L1 }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.codigo).toBe("ERR_CONSULTA_FALHOU");
    expect(JSON.stringify(res.body)).not.toContain("segredo");
  });

  it("sessoes: lista as cobertas, filtra e nega fora da lista", () => {
    process.env.RETORNO_IA_SESSAO_CONEXOES = "23";
    registrarConexao(23, { connection: "open" }, Date.now() - 60_000);
    let res = fakeRes();
    C.sessoes(pedir({}), res);
    expect(res.body.conexoes).toEqual([
      expect.objectContaining({ conexao: 23, estado: "open" })
    ]);
    expect(res.headers["Cache-Control"]).toBe("no-store");
    res = fakeRes();
    C.sessoes(pedir({ conexao: "28" }), res);
    expect(res.statusCode).toBe(403);
  });
});
