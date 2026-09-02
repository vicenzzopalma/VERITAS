import sequelize from "../database";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Message from "../models/Message";
import LidMapping from "../models/LidMapping";
import { logger } from "../utils/logger";
import { extractCleanLid, extractCleanPhone, saveLidMapping } from "../services/WbotServices/LidResolutionService";
import { Op } from "sequelize";

export const runSanitization = async () => {
  logger.info("[Sanitize] Iniciando saneamento de LIDs e unificação de contatos...");

  // 1. Garantir que a tabela LidMappings exista
  await sequelize.sync();

  // 2. Popular LidMappings a partir dos contatos que já possuem número real e LID
  const validContactsWithLid = await Contact.findAll({
    where: {
      isGroup: false,
      lid: { [Op.not]: null },
      number: { [Op.not]: null }
    }
  });

  let indexedCount = 0;
  for (const c of validContactsWithLid) {
    const cleanLid = extractCleanLid(c.lid);
    const cleanPhone = extractCleanPhone(c.number);
    if (cleanLid && cleanPhone && cleanLid !== cleanPhone) {
      await saveLidMapping(cleanLid, cleanPhone, 0, c.name);
      indexedCount++;
    }
  }
  logger.info(`[Sanitize] ${indexedCount} mapeamentos LID <-> Telefone indexados com sucesso.`);

  // 3. Cruzar contatos que possuem o mesmo LID: um com número real e outro com LID gravado como número
  const corruptedContacts = await Contact.findAll({
    where: {
      isGroup: false,
      number: { [Op.not]: null }
    }
  });

  let mergedCount = 0;
  let repairedCount = 0;

  for (const corrupted of corruptedContacts) {
    const cleanNum = corrupted.number.replace(/\D/g, "");
    // Se number tem 14+ dígitos, é um LID!
    if (cleanNum.length >= 14) {
      const cleanLid = extractCleanLid(corrupted.lid) || cleanNum;

      // Busca se temos o telefone mapeado
      let realPhone = "";
      const mapping = await LidMapping.findByPk(cleanLid);
      if (mapping?.phoneNumber) {
        realPhone = mapping.phoneNumber;
      }

      // Se não encontrou no mapping, tenta buscar outro contato que tenha esse LID
      if (!realPhone) {
        const matchingReal = await Contact.findOne({
          where: {
            id: { [Op.ne]: corrupted.id },
            isGroup: false,
            lid: { [Op.like]: `${cleanLid}%` }
          }
        });
        if (matchingReal && extractCleanPhone(matchingReal.number)) {
          realPhone = extractCleanPhone(matchingReal.number);
        }
      }

      if (realPhone) {
        // Verifica se já existe contato com esse número real
        const existingReal = await Contact.findOne({
          where: {
            number: realPhone,
            isGroup: false
          }
        });

        if (existingReal && existingReal.id !== corrupted.id) {
          // Migra tickets e mensagens
          await Ticket.update(
            { contactId: existingReal.id },
            { where: { contactId: corrupted.id } }
          );
          await Message.update(
            { contactId: existingReal.id },
            { where: { contactId: corrupted.id } }
          );

          if (!existingReal.lid) {
            await existingReal.update({ lid: `${cleanLid}@lid` });
          }

          await corrupted.destroy();
          mergedCount++;
        } else {
          // Apenas repara o contato atual
          await corrupted.update({
            number: realPhone,
            lid: `${cleanLid}@lid`
          });
          repairedCount++;
        }
      }
    }
  }

  logger.info(`[Sanitize] Concluído! Contatos fundidos: ${mergedCount}, Contatos reparados: ${repairedCount}`);
};

if (require.main === module) {
  runSanitization()
    .then(() => {
      console.log("Sanitização concluída.");
      process.exit(0);
    })
    .catch(err => {
      console.error("Erro na sanitização:", err);
      process.exit(1);
    });
}
