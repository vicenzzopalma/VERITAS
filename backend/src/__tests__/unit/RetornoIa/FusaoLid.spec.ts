const mockContactFindOne = jest.fn();
const mockTicketUpdate = jest.fn();
const mockMessageUpdate = jest.fn();
const mockUpsert = jest.fn();
const mockFindByPk = jest.fn();

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: {
    findOne: (...a: any[]) => mockContactFindOne(...a),
    create: jest.fn()
  }
}));
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { update: (...a: any[]) => mockTicketUpdate(...a) }
}));
jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { update: (...a: any[]) => mockMessageUpdate(...a) }
}));
jest.mock("../../../models/LidMapping", () => ({
  __esModule: true,
  default: {
    upsert: (...a: any[]) => mockUpsert(...a),
    findByPk: (...a: any[]) => mockFindByPk(...a)
  }
}));
jest.mock("../../../libs/socket", () => ({
  getIO: () => ({ emit: jest.fn() })
}));
jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

// eslint-disable-next-line import/first
import CreateOrUpdateContactService from "../../../services/ContactServices/CreateOrUpdateContactService";
// eslint-disable-next-line import/first
import {
  resolveAndAutoMerge,
  saveLidMapping
} from "../../../services/WbotServices/LidResolutionService";
// eslint-disable-next-line import/first
import {
  conflitosRegistrados,
  _resetConflitosParaTestes
} from "../../../helpers/lidConflitos";

const contato = (dados: any) => {
  const c: any = { ...dados };
  c.update = jest.fn(async (u: any) => Object.assign(c, u));
  c.destroy = jest.fn(async () => undefined);
  return c;
};

const LID = "123456789012345";
const TEL = "5547999990000";
const OUTRO = "5511988887777";

describe("Fusão de contato LID (FMEA, Fase 0a)", () => {
  beforeEach(() => {
    _resetConflitosParaTestes();
    [
      mockContactFindOne,
      mockTicketUpdate,
      mockMessageUpdate,
      mockUpsert,
      mockFindByPk
    ].forEach(m => m.mockReset());
    mockFindByPk.mockResolvedValue(null);
    delete process.env.VERITAS_LID_CONFLITO_TRAVA;
  });

  const preparar = (porNumero: any, porLid: any) => {
    mockContactFindOne.mockImplementation(async ({ where }: any) =>
      where.number === TEL ? porNumero : porLid
    );
  };

  it("fusão legítima (contato do LID sem telefone) segue igual e não marca conflito", async () => {
    const alvo = contato({ id: 1, number: TEL, name: "Ana", lid: null });
    const origem = contato({
      id: 2,
      number: LID,
      name: LID,
      lid: `${LID}@lid`
    });
    preparar(alvo, origem);
    const r = await CreateOrUpdateContactService({
      name: "Ana",
      number: TEL,
      lid: `${LID}@lid`,
      isGroup: false
    });
    expect(r.id).toBe(1);
    expect(mockTicketUpdate).toHaveBeenCalled();
    expect(origem.destroy).toHaveBeenCalled();
    expect(conflitosRegistrados()).toEqual([]);
  });

  it("LID resolvido para outro contato: sem trava funde como antes e marca o conflito", async () => {
    const alvo = contato({ id: 1, number: TEL, name: "Ana", lid: null });
    const origem = contato({
      id: 2,
      number: OUTRO,
      name: "Bia",
      lid: `${LID}@lid`
    });
    preparar(alvo, origem);
    await CreateOrUpdateContactService({
      name: "Ana",
      number: TEL,
      lid: `${LID}@lid`,
      isGroup: false
    });
    expect(origem.destroy).toHaveBeenCalled();
    expect(conflitosRegistrados()).toEqual([
      expect.objectContaining({
        lid: LID,
        origem: "lid_de_outro_contato",
        contatos: [1, 2],
        bloqueado: false
      })
    ]);
    expect(conflitosRegistrados()[0].telefones.sort()).toEqual(
      [OUTRO, TEL].sort()
    );
  });

  it("LID resolvido para outro contato: com trava não funde, não move ticket nem mensagem", async () => {
    process.env.VERITAS_LID_CONFLITO_TRAVA = "1";
    const alvo = contato({ id: 1, number: TEL, name: "Ana", lid: null });
    const origem = contato({
      id: 2,
      number: OUTRO,
      name: "Bia",
      lid: `${LID}@lid`
    });
    preparar(alvo, origem);
    const r = await CreateOrUpdateContactService({
      name: "Ana",
      number: TEL,
      lid: `${LID}@lid`,
      isGroup: false
    });
    expect(r.id).toBe(1);
    expect(mockTicketUpdate).not.toHaveBeenCalled();
    expect(mockMessageUpdate).not.toHaveBeenCalled();
    expect(origem.destroy).not.toHaveBeenCalled();
    expect(alvo.update).not.toHaveBeenCalled();
    expect(conflitosRegistrados()[0]).toMatchObject({ bloqueado: true });
  });

  it("9º dígito não é conflito", async () => {
    const alvo = contato({ id: 1, number: TEL, name: "Ana", lid: null });
    const origem = contato({
      id: 2,
      number: "554799990000",
      name: "Ana",
      lid: `${LID}@lid`
    });
    preparar(alvo, origem);
    await CreateOrUpdateContactService({
      name: "Ana",
      number: TEL,
      lid: `${LID}@lid`,
      isGroup: false
    });
    expect(conflitosRegistrados()).toEqual([]);
  });

  it("telefone que já tem outro LID: com trava mantém o LID antigo", async () => {
    process.env.VERITAS_LID_CONFLITO_TRAVA = "1";
    const alvo = contato({
      id: 1,
      number: TEL,
      name: "Ana",
      lid: "998877665544332@lid"
    });
    preparar(alvo, null);
    await CreateOrUpdateContactService({
      name: "Ana",
      number: TEL,
      lid: `${LID}@lid`,
      isGroup: false
    });
    expect(alvo.lid).toBe("998877665544332@lid");
    expect(conflitosRegistrados()[0]).toMatchObject({
      origem: "telefone_com_outro_lid",
      bloqueado: true
    });
  });

  it("telefone que já tem outro LID: sem trava troca como antes e marca", async () => {
    const alvo = contato({
      id: 1,
      number: TEL,
      name: "Ana",
      lid: "998877665544332@lid"
    });
    preparar(alvo, null);
    await CreateOrUpdateContactService({
      name: "Ana",
      number: TEL,
      lid: `${LID}@lid`,
      isGroup: false
    });
    expect(alvo.lid).toBe(`${LID}@lid`);
    expect(conflitosRegistrados()[0]).toMatchObject({ bloqueado: false });
  });

  it("saveLidMapping: LID que já aponta para outro telefone; trava mantém o antigo", async () => {
    const lid = "555566667777888";
    await saveLidMapping(lid, TEL);
    await saveLidMapping(lid, "554799990000"); // mesmo telefone sem o 9
    expect(conflitosRegistrados()).toEqual([]);
    await saveLidMapping(lid, OUTRO);
    expect(mockUpsert).toHaveBeenCalledTimes(3);
    expect(conflitosRegistrados()[0]).toMatchObject({
      origem: "mapeamento_divergente",
      bloqueado: false
    });

    process.env.VERITAS_LID_CONFLITO_TRAVA = "1";
    const lid2 = "555566667777999";
    mockFindByPk.mockResolvedValueOnce({ phoneNumber: TEL });
    await saveLidMapping(lid2, OUTRO);
    expect(mockUpsert).toHaveBeenCalledTimes(3);
    expect(conflitosRegistrados()[1]).toMatchObject({
      lid: lid2,
      bloqueado: true
    });
  });

  it("resolveAndAutoMerge: contato real com outro LID; com trava não funde", async () => {
    process.env.VERITAS_LID_CONFLITO_TRAVA = "1";
    const lid = "444455556666777";
    const corrompido = contato({ id: 9, number: lid, lid: null });
    const real = contato({ id: 8, number: TEL, lid: "998877665544332@lid" });
    mockContactFindOne.mockImplementation(async ({ where }: any) =>
      where.number === lid ? corrompido : real
    );
    const r = await resolveAndAutoMerge(lid, TEL);
    expect(r && r.id).toBe(8);
    expect(corrompido.destroy).not.toHaveBeenCalled();
    expect(mockTicketUpdate).not.toHaveBeenCalled();
    expect(
      conflitosRegistrados().some(c => c.origem === "telefone_com_outro_lid")
    ).toBe(true);
  });
});
