import {
  conexoesSessao,
  estadoDoUpdate,
  registrarConexao,
  retratoSessoes,
  sessaoContinua,
  _resetSessoesParaTestes
} from "../../../helpers/retornoIaSessao";

const MIN = 60_000;

describe("retornoIaSessao (tap de connection.update)", () => {
  const envOriginal = { ...process.env };
  beforeEach(() => {
    _resetSessoesParaTestes();
    process.env = { ...envOriginal };
    process.env.RETORNO_IA_CONEXOES = "23,28,1";
    process.env.RETORNO_IA_SESSAO_CONEXOES = "23,1,77";
  });
  afterAll(() => {
    process.env = envOriginal;
  });

  it("lista vazia por padrão (no-op) e interseção com RETORNO_IA_CONEXOES", () => {
    delete process.env.RETORNO_IA_SESSAO_CONEXOES;
    expect(conexoesSessao()).toEqual([]);
    registrarConexao(23, { connection: "open" }, 0);
    expect(retratoSessoes(0)).toEqual([]);
    process.env.RETORNO_IA_SESSAO_CONEXOES = "23,1,77";
    expect(conexoesSessao()).toEqual([23, 1]);
  });

  it("traduz os updates do whaileys", () => {
    expect(estadoDoUpdate({ qr: "x" })).toBe("qrcode");
    expect(estadoDoUpdate({ connection: "open" })).toBe("open");
    expect(estadoDoUpdate({ connection: "close" })).toBe("close");
    expect(estadoDoUpdate({ connection: "connecting" })).toBe("connecting");
    expect(estadoDoUpdate({ receivedPendingNotifications: true })).toBeNull();
    expect(estadoDoUpdate(null)).toBeNull();
  });

  it("conexão sem evento aparece como desconhecida", () => {
    expect(retratoSessoes(0)).toEqual([
      expect.objectContaining({
        conexao: 23,
        estado: "desconhecido",
        conectada_desde: null
      }),
      expect.objectContaining({
        conexao: 1,
        estado: "desconhecido",
        observado_desde: null
      })
    ]);
  });

  it("guarda estado, hora e código de desconexão; qrcode zera a sessão contínua", () => {
    registrarConexao(23, { connection: "connecting" }, 0);
    registrarConexao(23, { connection: "open" }, 1 * MIN);
    registrarConexao(23, { receivedPendingNotifications: true }, 2 * MIN);
    registrarConexao(23, { connection: "open" }, 3 * MIN); // repetido não reinicia
    let [s] = retratoSessoes(10 * MIN);
    expect(s).toMatchObject({
      estado: "open",
      conectada_desde: new Date(MIN).toISOString(),
      conectada_ha_s: 540,
      observado_desde: new Date(0).toISOString()
    });
    registrarConexao(
      23,
      {
        connection: "close",
        lastDisconnect: { error: { output: { statusCode: 428 } } }
      },
      11 * MIN
    );
    registrarConexao(23, { qr: "abc" }, 12 * MIN);
    [s] = retratoSessoes(13 * MIN);
    expect(s).toMatchObject({
      estado: "qrcode",
      conectada_desde: null,
      conectada_ha_s: null
    });
    expect(s.eventos.map(e => e.estado)).toEqual([
      "connecting",
      "open",
      "open",
      "close",
      "qrcode"
    ]);
    expect(s.eventos[3]).toMatchObject({ codigo: 428 });
    expect(JSON.stringify(s)).not.toContain("abc"); // QR nunca sai
  });

  it("sessaoContinua: chip fora 15 min e humano depois de reconectar não dá posse", () => {
    registrarConexao(23, { connection: "open" }, 0);
    expect(sessaoContinua(23, 20 * MIN, 30 * MIN)).toBe(true);
    registrarConexao(23, { connection: "close" }, 31 * MIN);
    expect(sessaoContinua(23, 20 * MIN, 35 * MIN)).toBe(false);
    registrarConexao(23, { connection: "open" }, 46 * MIN);
    // intervalo começando antes de reconectar: não contínuo
    expect(sessaoContinua(23, 20 * MIN, 50 * MIN)).toBe(false);
    // começo menos de 10 min depois de reconectar: ainda não
    expect(sessaoContinua(23, 50 * MIN, 60 * MIN)).toBe(false);
    // 10 min depois de reconectar: volta a valer
    expect(sessaoContinua(23, 56 * MIN, 60 * MIN)).toBe(true);
    expect(sessaoContinua(1, 0, 1)).toBe(false);
  });

  it("guarda no máximo 50 eventos e nunca lança", () => {
    for (let i = 0; i < 60; i += 1)
      registrarConexao(1, { connection: "open" }, i);
    expect(retratoSessoes(100)[1].eventos.length).toBe(50);
    expect(() => registrarConexao(1, undefined, 1)).not.toThrow();
  });
});
