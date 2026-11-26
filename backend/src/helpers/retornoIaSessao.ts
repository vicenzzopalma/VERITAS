import { listaConexoes } from "./retornoIaArquivo";

// Fase 0a do negociador (FMEA 25/11, "chip em qrcode esconde o humano"): estado da sessão
// por conexão coberta, com a hora de cada transição, para a posse depender de sessão
// contínua. Só leitura de eventos do socket; nada muda na sessão.
//
// No-op com RETORNO_IA_SESSAO_CONEXOES vazia (padrão). Só entram conexões que também estão
// em RETORNO_IA_CONEXOES. Estado só em memória: depois de um restart, `observado_desde`
// marca o início da observação e nada antes dele conta como contínuo.

export type EstadoSessao =
  | "open"
  | "connecting"
  | "close"
  | "qrcode"
  | "desconhecido";

const MAX_EVENTOS = 50;

interface EventoSessao {
  estado: EstadoSessao;
  em: number;
  codigo?: number;
}

interface Sessao {
  conexao: number;
  observadoDesde: number;
  estado: EstadoSessao;
  desde: number;
  conectadaDesde: number | null;
  ultimoEvento: number;
  eventos: EventoSessao[];
}

const sessoes = new Map<number, Sessao>();

export const conexoesSessao = (): number[] => {
  const liberadas = new Set(listaConexoes(process.env.RETORNO_IA_CONEXOES));
  return listaConexoes(process.env.RETORNO_IA_SESSAO_CONEXOES).filter(id =>
    liberadas.has(id)
  );
};

export const sessaoAtiva = (id: number): boolean =>
  conexoesSessao().includes(id);

// Traduz um connection.update do whaileys. O QR chega sem `connection`; os outros
// campos (isNewLogin, receivedPendingNotifications...) são ignorados.
export const estadoDoUpdate = (update: any): EstadoSessao | null => {
  if (!update || typeof update !== "object") return null;
  if (update.qr) return "qrcode";
  if (update.connection === "open") return "open";
  if (update.connection === "connecting") return "connecting";
  if (update.connection === "close") return "close";
  return null;
};

// Nunca lança. `agora` injetável para testes.
export const registrarConexao = (
  sessionId: number,
  update: any,
  agora: number = Date.now()
): void => {
  try {
    if (!sessaoAtiva(sessionId)) return;
    const estado = estadoDoUpdate(update);
    if (!estado) return;
    let s = sessoes.get(sessionId);
    if (!s) {
      s = {
        conexao: sessionId,
        observadoDesde: agora,
        estado: "desconhecido",
        desde: agora,
        conectadaDesde: null,
        ultimoEvento: agora,
        eventos: []
      };
      sessoes.set(sessionId, s);
    }
    const codigo = Number(update?.lastDisconnect?.error?.output?.statusCode);
    s.eventos.push({
      estado,
      em: agora,
      ...(Number.isFinite(codigo) ? { codigo } : {})
    });
    if (s.eventos.length > MAX_EVENTOS)
      s.eventos.splice(0, s.eventos.length - MAX_EVENTOS);
    s.ultimoEvento = agora;
    if (estado !== s.estado) {
      s.estado = estado;
      s.desde = agora;
    }
    if (estado === "open") {
      if (s.conectadaDesde === null) s.conectadaDesde = agora;
    } else {
      s.conectadaDesde = null;
    }
  } catch {
    /* nunca atrapalha o fluxo da conexão */
  }
};

export interface RetratoSessao {
  conexao: number;
  estado: EstadoSessao;
  desde: string | null;
  conectada_desde: string | null;
  conectada_ha_s: number | null;
  observado_desde: string | null;
  eventos: { estado: EstadoSessao; em: string; codigo?: number }[];
}

const iso = (ms: number | null): string | null =>
  ms === null ? null : new Date(ms).toISOString();

// Saída consultável. Conexão coberta sem evento desde o início do processo aparece como
// "desconhecido": quem consulta trata como sessão não contínua.
export const retratoSessoes = (agora: number = Date.now()): RetratoSessao[] =>
  conexoesSessao().map(conexao => {
    const s = sessoes.get(conexao);
    if (!s) {
      return {
        conexao,
        estado: "desconhecido" as EstadoSessao,
        desde: null,
        conectada_desde: null,
        conectada_ha_s: null,
        observado_desde: null,
        eventos: []
      };
    }
    const ha =
      s.conectadaDesde === null || agora < s.conectadaDesde
        ? null
        : Math.floor((agora - s.conectadaDesde) / 1000);
    return {
      conexao,
      estado: s.estado,
      desde: iso(s.desde),
      conectada_desde: iso(s.conectadaDesde),
      conectada_ha_s: ha,
      observado_desde: iso(s.observadoDesde),
      eventos: s.eventos.map(e => ({
        estado: e.estado,
        em: new Date(e.em).toISOString(),
        ...(e.codigo !== undefined ? { codigo: e.codigo } : {})
      }))
    };
  });

// Ajuda para a porta: a sessão ficou "open" sem interrupção de `inicio` até `agora`
// e já estava "open" há pelo menos `folgaS` segundos em `inicio`?
export const sessaoContinua = (
  conexao: number,
  inicio: number,
  agora: number = Date.now(),
  folgaS = 600
): boolean => {
  const s = sessoes.get(conexao);
  if (!s || s.estado !== "open" || s.conectadaDesde === null) return false;
  if (agora < s.conectadaDesde || inicio > agora) return false;
  return s.conectadaDesde + folgaS * 1000 <= inicio;
};

// eslint-disable-next-line no-underscore-dangle
export const _resetSessoesParaTestes = (): void => {
  sessoes.clear();
};
