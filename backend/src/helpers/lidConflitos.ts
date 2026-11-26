import { logger } from "../utils/logger";

// Fase 0a do negociador (FMEA 25/11, "fusão de contato LID e LID resolvido para outro
// contato"): quando o mesmo LID aponta para dois telefones, ou um telefone já preso a outro
// LID recebe um LID novo, o VERITAS não escolhe um lado sozinho. O conflito é registrado
// sempre (memória + log, sem efeito no CRM). Com VERITAS_LID_CONFLITO_TRAVA=1 a fusão
// automática e a troca de LID/telefone ficam suspensas para aquele par.

const MAX_CONFLITOS = 500;

export const travaConflitoLigada = (): boolean =>
  process.env.VERITAS_LID_CONFLITO_TRAVA === "1";

export const digitos = (v?: string | null): string =>
  String(v || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");

export const lidLimpo = (v?: string | null): string => {
  const d = digitos(v);
  return d.length >= 14 ? d : "";
};

export const telefoneReal = (v?: string | null): string => {
  const d = digitos(v);
  return d.length >= 10 && d.length <= 13 ? d : "";
};

// Mesmo telefone com ou sem o 9º dígito (55 + DDD + 9 + 8 dígitos) e com ou sem o 55.
export const telefoneCanonico = (v?: string | null): string => {
  let d = telefoneReal(v);
  if (!d) return "";
  if (d.length <= 11) d = `55${d}`;
  if (d.length === 13 && d.startsWith("55") && d[4] === "9") {
    d = d.slice(0, 4) + d.slice(5);
  }
  return d;
};

export const mesmoTelefone = (
  a?: string | null,
  b?: string | null
): boolean => {
  const ca = telefoneCanonico(a);
  return !!ca && ca === telefoneCanonico(b);
};

export type OrigemConflito =
  | "fusao_contato"
  | "lid_de_outro_contato"
  | "telefone_com_outro_lid"
  | "mapeamento_divergente";

export interface ConflitoLid {
  lid: string;
  telefones: string[];
  origem: OrigemConflito;
  contatos: number[];
  bloqueado: boolean;
  em: string;
}

const conflitos: ConflitoLid[] = [];

export const registrarConflito = (c: {
  lid: string;
  telefones: (string | null | undefined)[];
  origem: OrigemConflito;
  contatos?: (number | null | undefined)[];
  bloqueado: boolean;
}): ConflitoLid => {
  const registro: ConflitoLid = {
    lid: lidLimpo(c.lid) || digitos(c.lid),
    telefones: [
      ...new Set(c.telefones.map(t => telefoneReal(t)).filter(Boolean))
    ],
    origem: c.origem,
    contatos: (c.contatos || []).filter((x): x is number =>
      Number.isInteger(x)
    ),
    bloqueado: c.bloqueado,
    em: new Date().toISOString()
  };
  conflitos.push(registro);
  if (conflitos.length > MAX_CONFLITOS)
    conflitos.splice(0, conflitos.length - MAX_CONFLITOS);
  // Sem telefone no log: só o LID, a origem e os ids dos contatos.
  logger.warn({
    info: "lid conflito",
    lid: registro.lid,
    origem: registro.origem,
    contatos: registro.contatos,
    bloqueado: registro.bloqueado
  });
  return registro;
};

export const conflitosRegistrados = (lid?: string): ConflitoLid[] => {
  const alvo = lid ? lidLimpo(lid) : "";
  return conflitos.filter(c => !alvo || c.lid === alvo);
};

export interface MapeamentoLid {
  lid: string;
  phoneNumber: string;
  whatsappId?: number | null;
}

export interface ContatoLid {
  id: number;
  number: string;
  lid?: string | null;
}

export interface ResolucaoLid {
  lid: string;
  telefone: string | null;
  conflito: boolean;
  candidatos: string[];
  fontes: string[];
}

// Junta as fontes (LidMappings, Contacts e conflitos registrados) por LID. Um único
// telefone (canônico) = resolvido. Dois ou mais = conflito, telefone nulo: quem consulta
// trata como desconhecido. Nenhum = telefone nulo sem conflito.
export const analisarLids = (
  lids: string[],
  mapeamentos: MapeamentoLid[],
  contatos: ContatoLid[],
  registrados: ConflitoLid[] = []
): ResolucaoLid[] => {
  const alvo = [...new Set(lids.map(l => lidLimpo(l)).filter(Boolean))].sort();
  return alvo.map(lid => {
    const porCanonico = new Map<string, string>();
    const fontes = new Set<string>();
    const somar = (tel: string, fonte: string): void => {
      const c = telefoneCanonico(tel);
      if (!c) return;
      if (!porCanonico.has(c)) porCanonico.set(c, telefoneReal(tel));
      fontes.add(fonte);
    };
    mapeamentos
      .filter(m => lidLimpo(m.lid) === lid)
      .forEach(m => somar(m.phoneNumber, "LidMappings"));
    contatos
      .filter(c => lidLimpo(c.lid) === lid)
      .forEach(c => somar(c.number, "Contacts"));
    const marcado = registrados.filter(r => r.lid === lid);
    marcado.forEach(r =>
      r.telefones.forEach(t => somar(t, `conflito:${r.origem}`))
    );
    const candidatos = [...porCanonico.values()].sort();
    const conflito = candidatos.length > 1 || marcado.length > 0;
    return {
      lid,
      telefone: !conflito && candidatos.length === 1 ? candidatos[0] : null,
      conflito,
      candidatos: conflito ? candidatos : [],
      fontes: [...fontes].sort()
    };
  });
};

// eslint-disable-next-line no-underscore-dangle
export const _resetConflitosParaTestes = (): void => {
  conflitos.splice(0, conflitos.length);
};
