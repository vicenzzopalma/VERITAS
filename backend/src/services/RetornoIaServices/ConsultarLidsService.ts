import { Op, WhereOptions } from "sequelize";

import Contact from "../../models/Contact";
import LidMapping from "../../models/LidMapping";
import {
  analisarLids,
  conflitosRegistrados,
  ContatoLid,
  lidLimpo,
  MapeamentoLid,
  ResolucaoLid
} from "../../helpers/lidConflitos";

// Fase 0a do negociador: LID → telefone para a porta resolver conversas em @lid
// (arquivadas, SAIR, posse). Só SELECT; não grava nada, não chama o WhatsApp
// (ao contrário do resolveLidToPhoneNumber, que pode consultar via USync e gravar).
//
// Revisão final A1 (26/11): só por LID pedido (poucos por chamada). O modo "conexão inteira"
// saiu: varria todos os tickets da conexão e fazia `lid LIKE 'X%'`, que no SQLite não usa
// o idx_contacts_lid (LIKE não distingue maiúsculas) e virava SCAN em 182 mil contatos.
// Agora tudo é igualdade ou faixa sobre índice (EXPLAIN QUERY PLAN no relatório):
//   lid IN ('X@lid','X')            -> idx_contacts_lid (lid=?)
//   lid >= 'X:' AND lid < 'X;'      -> idx_contacts_lid (faixa; formato 'X:dispositivo@lid')
//   number IN ('X')                 -> idx_contacts_number (contato com o LID no number)
//   LidMappings.lid IN (...)        -> chave primária

export const MAX_LIDS_PEDIDOS = 50;

export class ConsultaCancelada extends Error {
  constructor() {
    super("ERR_CONSULTA_CANCELADA");
  }
}

export interface Sinal {
  aborted: boolean;
}

export const filtroContatosPorLid = (lids: string[]): WhereOptions => ({
  isGroup: false,
  [Op.or]: [
    {
      lid: {
        [Op.in]: lids.reduce(
          (acc: string[], l) => acc.concat([`${l}@lid`, l]),
          []
        )
      }
    },
    { number: { [Op.in]: lids } },
    ...lids.map(l => ({ lid: { [Op.gte]: `${l}:`, [Op.lt]: `${l};` } }))
  ]
});

export interface FontesLid {
  mapeamentos: (lids: string[], conexao: number) => Promise<MapeamentoLid[]>;
  contatos: (lids: string[]) => Promise<ContatoLid[]>;
}

export const fontesBanco: FontesLid = {
  mapeamentos: async lids =>
    (await LidMapping.findAll({
      where: { lid: { [Op.in]: lids } },
      attributes: ["lid", "phoneNumber", "whatsappId"],
      raw: true
    })) as unknown as MapeamentoLid[],
  contatos: async lids =>
    (await Contact.findAll({
      where: filtroContatosPorLid(lids),
      attributes: ["id", "number", "lid"],
      raw: true
    })) as unknown as ContatoLid[]
};

export interface ResultadoLids {
  conexao: number;
  total: number;
  resolvidos: number;
  conflitos: number;
  sem_telefone: number;
  lids: ResolucaoLid[];
}

const conferir = (sinal?: Sinal): void => {
  if (sinal && sinal.aborted) throw new ConsultaCancelada();
};

// `sinal.aborted` verdadeiro (cliente desistiu ou tempo do servidor esgotou) interrompe
// antes de cada consulta; cada consulta é por índice e leva poucos ms.
const ConsultarLidsService = async (
  conexao: number,
  pedidos: string[],
  fontes: FontesLid = fontesBanco,
  sinal?: Sinal
): Promise<ResultadoLids> => {
  const lids = [
    ...new Set(pedidos.map(l => lidLimpo(l)).filter(Boolean))
  ].slice(0, MAX_LIDS_PEDIDOS);
  if (!lids.length) {
    return {
      conexao,
      total: 0,
      resolvidos: 0,
      conflitos: 0,
      sem_telefone: 0,
      lids: []
    };
  }
  conferir(sinal);
  const mapeamentos = await fontes.mapeamentos(lids, conexao);
  conferir(sinal);
  const contatos = await fontes.contatos(lids);
  conferir(sinal);
  // Contato cujo "number" é o próprio LID não é telefone; analisarLids já ignora.
  const resolucao = analisarLids(
    lids,
    mapeamentos,
    contatos,
    conflitosRegistrados()
  );
  return {
    conexao,
    total: resolucao.length,
    resolvidos: resolucao.filter(r => r.telefone).length,
    conflitos: resolucao.filter(r => r.conflito).length,
    sem_telefone: resolucao.filter(r => !r.telefone && !r.conflito).length,
    lids: resolucao
  };
};

export default ConsultarLidsService;
