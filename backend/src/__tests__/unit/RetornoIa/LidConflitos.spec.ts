const mockWarn = jest.fn();
jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: (...a: any[]) => mockWarn(...a),
    debug: jest.fn()
  }
}));

// eslint-disable-next-line import/first
import {
  analisarLids,
  conflitosRegistrados,
  lidLimpo,
  mesmoTelefone,
  registrarConflito,
  telefoneCanonico,
  travaConflitoLigada,
  _resetConflitosParaTestes
} from "../../../helpers/lidConflitos";

const L1 = "123456789012345";
const L2 = "998877665544332";

describe("lidConflitos", () => {
  beforeEach(() => {
    _resetConflitosParaTestes();
    mockWarn.mockReset();
    delete process.env.VERITAS_LID_CONFLITO_TRAVA;
  });

  it("trava desligada por padrão", () => {
    expect(travaConflitoLigada()).toBe(false);
    process.env.VERITAS_LID_CONFLITO_TRAVA = "1";
    expect(travaConflitoLigada()).toBe(true);
  });

  it("normaliza LID e telefone; 9º dígito e 55 não viram conflito", () => {
    expect(lidLimpo(`${L1}:12@lid`)).toBe(L1);
    expect(lidLimpo("5547999990000")).toBe("");
    expect(telefoneCanonico("5547999990000")).toBe("554799990000");
    expect(mesmoTelefone("5547999990000", "554799990000")).toBe(true);
    expect(mesmoTelefone("47999990000", "5547999990000")).toBe(true);
    expect(mesmoTelefone("5547999990000", "5547988880000")).toBe(false);
    expect(mesmoTelefone("", "")).toBe(false);
  });

  it("uma fonte ou fontes que concordam resolvem o telefone", () => {
    const [r] = analisarLids(
      [`${L1}@lid`],
      [{ lid: L1, phoneNumber: "5547999990000" }],
      [{ id: 1, number: "554799990000", lid: `${L1}@lid` }]
    );
    expect(r).toMatchObject({
      lid: L1,
      telefone: "5547999990000",
      conflito: false,
      candidatos: [],
      fontes: ["Contacts", "LidMappings"]
    });
  });

  it("LID com dois telefones é conflito e nunca escolhe um", () => {
    const [r] = analisarLids(
      [L1],
      [{ lid: L1, phoneNumber: "5547999990000" }],
      [{ id: 7, number: "5511988887777", lid: L1 }]
    );
    expect(r.conflito).toBe(true);
    expect(r.telefone).toBeNull();
    expect(r.candidatos).toEqual(["5511988887777", "5547999990000"]);
  });

  it("contato cujo number é o próprio LID não conta como telefone; sem fonte = sem telefone", () => {
    const [a, b] = analisarLids(
      [L1, L2],
      [],
      [{ id: 1, number: L1, lid: `${L1}@lid` }]
    );
    expect(a).toMatchObject({ lid: L1, telefone: null, conflito: false });
    expect(b).toMatchObject({ lid: L2, telefone: null, conflito: false });
  });

  it("conflito registrado (fusão) marca o LID mesmo com uma fonte só", () => {
    const reg = registrarConflito({
      lid: `${L1}@lid`,
      telefones: ["5511988887777", "5547999990000", null],
      origem: "lid_de_outro_contato",
      contatos: [3, 4, undefined],
      bloqueado: true
    });
    expect(reg).toMatchObject({
      lid: L1,
      telefones: ["5511988887777", "5547999990000"],
      contatos: [3, 4]
    });
    const [r] = analisarLids(
      [L1],
      [{ lid: L1, phoneNumber: "5547999990000" }],
      [],
      conflitosRegistrados()
    );
    expect(r.conflito).toBe(true);
    expect(r.telefone).toBeNull();
    expect(r.fontes).toContain("conflito:lid_de_outro_contato");
    expect(conflitosRegistrados(L2)).toEqual([]);
  });

  it("o log do conflito não leva telefone", () => {
    registrarConflito({
      lid: L1,
      telefones: ["5547999990000"],
      origem: "mapeamento_divergente",
      bloqueado: false
    });
    expect(JSON.stringify(mockWarn.mock.calls)).not.toContain("5547999990000");
  });

  it("guarda no máximo 500 conflitos", () => {
    for (let i = 0; i < 520; i += 1) {
      registrarConflito({
        lid: L1,
        telefones: [],
        origem: "fusao_contato",
        bloqueado: false
      });
    }
    expect(conflitosRegistrados().length).toBe(500);
  });
});
