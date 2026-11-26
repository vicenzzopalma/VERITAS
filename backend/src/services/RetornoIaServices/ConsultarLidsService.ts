import { Op } from "sequelize";

import Contact from "../../models/Contact";
import LidMapping from "../../models/LidMapping";
import Ticket from "../../models/Ticket";
import {
  analisarLids,
  conflitosRegistrados,
  ContatoLid,
  lidLimpo,
  MapeamentoLid,
  ResolucaoLid
} from "../../helpers/lidConflitos";
import { retratoArquivo } from "../../helpers/retornoIaArquivo";

// Fase 0a do negociador: LID → telefone por conexão, para a porta resolver as conversas
// em @lid (arquivadas, SAIR, posse). Só SELECT; não grava nada, não chama o WhatsApp
// (ao contrário do resolveLidToPhoneNumber, que pode consultar via USync e gravar).
//
// LIDs da conexão = LIDs dos contatos com ticket nela + LidMappings gravados por ela +
// os pedidos explicitamente (`extras`, por exemplo as arquivadas em @lid).

const LOTE = 100;
export const MAX_LIDS_PEDIDOS = 500;

const emLotes = <T>(itens: T[], tamanho = LOTE): T[][] => {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho)
    lotes.push(itens.slice(i, i + tamanho));
  return lotes;
};

export interface FontesLid {
  lidsDaConexao: (conexao: number) => Promise<string[]>;
  mapeamentos: (lids: string[], conexao: number) => Promise<MapeamentoLid[]>;
  contatos: (lids: string[]) => Promise<ContatoLid[]>;
}

export const fontesBanco: FontesLid = {
  lidsDaConexao: async conexao => {
    const tickets = (await Ticket.findAll({
      where: { whatsappId: conexao },
      attributes: ["contactId"],
      raw: true
    })) as unknown as { contactId: number }[];
    const ids = [...new Set(tickets.map(t => t.contactId).filter(Boolean))];
    const lids: string[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const lote of emLotes(ids, 500)) {
      // eslint-disable-next-line no-await-in-loop
      const contatos = (await Contact.findAll({
        where: { id: lote, isGroup: false },
        attributes: ["lid", "number"],
        raw: true
      })) as unknown as { lid: string | null; number: string }[];
      contatos.forEach(c => {
        const l = lidLimpo(c.lid) || lidLimpo(c.number);
        if (l) lids.push(l);
      });
    }
    const gravados = (await LidMapping.findAll({
      where: { whatsappId: conexao },
      attributes: ["lid"],
      raw: true
    })) as unknown as { lid: string }[];
    gravados.forEach(g => lids.push(g.lid));
    return lids;
  },
  mapeamentos: async lids => {
    const saida: MapeamentoLid[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const lote of emLotes(lids)) {
      // eslint-disable-next-line no-await-in-loop
      const linhas = (await LidMapping.findAll({
        where: { lid: lote },
        attributes: ["lid", "phoneNumber", "whatsappId"],
        raw: true
      })) as unknown as MapeamentoLid[];
      saida.push(...linhas);
    }
    return saida;
  },
  contatos: async lids => {
    const saida: ContatoLid[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const lote of emLotes(lids)) {
      // eslint-disable-next-line no-await-in-loop
      const linhas = (await Contact.findAll({
        where: {
          isGroup: false,
          [Op.or]: lote.reduce(
            (acc: any[], l: string) =>
              acc.concat([{ lid: { [Op.like]: `${l}%` } }, { number: l }]),
            []
          )
        },
        attributes: ["id", "number", "lid"],
        raw: true
      })) as unknown as ContatoLid[];
      saida.push(...linhas);
    }
    return saida;
  }
};

export interface ResultadoLids {
  conexao: number;
  total: number;
  resolvidos: number;
  conflitos: number;
  sem_telefone: number;
  lids: ResolucaoLid[];
}

const ConsultarLidsService = async (
  conexao: number,
  extras: string[] = [],
  fontes: FontesLid = fontesBanco
): Promise<ResultadoLids> => {
  const pedidos = extras.map(l => lidLimpo(l)).filter(Boolean);
  const arquivadasLid = (
    retratoArquivo().find(r => r.conexao === conexao)?.arquivadas || []
  )
    .filter(j => j.endsWith("@lid"))
    .map(j => lidLimpo(j))
    .filter(Boolean);
  const daConexao = pedidos.length
    ? []
    : [...(await fontes.lidsDaConexao(conexao)), ...arquivadasLid]
        .map(l => lidLimpo(l))
        .filter(Boolean);
  const lids = [...new Set([...pedidos, ...daConexao])];
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
  const [mapeamentos, contatos] = await Promise.all([
    fontes.mapeamentos(lids, conexao),
    fontes.contatos(lids)
  ]);
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
