import { Op } from "sequelize";
import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { logger } from "../../utils/logger";
import {
  saveLidMapping,
  resolveLidToPhoneNumber,
  extractCleanLid,
  extractCleanPhone
} from "../WbotServices/LidResolutionService";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  lid?: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
}

const extractBaseLid = (val?: string) => {
  if (!val) return "";
  return val.split("@")[0].split(":")[0].replace(/\D/g, "");
};

const isRealName = (name?: string, number?: string, lid?: string): boolean => {
  if (!name || !name.trim()) return false;
  const cleanName = name.trim();
  if (number && cleanName === number) return false;
  if (lid && (cleanName === lid || cleanName === lid.split("@")[0] || cleanName === lid.split(":")[0])) return false;
  if (/^\d{10,}$/.test(cleanName)) return false;
  return true;
};

const isRealPhoneNumber = (num?: string): boolean => {
  if (!num || !num.trim()) return false;
  const clean = num.replace(/\D/g, "");
  if (clean.length >= 10 && clean.length <= 13) return true;
  return false;
};

const emitContact = (action: "update" | "create", contact: Contact) => {
  try {
    const io = getIO();
    io.emit("contact", { action, contact });
  } catch (err) {
    logger.warn("Socket IO not ready to emit contact");
  }
};

const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  lid,
  profilePicUrl,
  isGroup,
  email = "",
  extraInfo = []
}: Request): Promise<Contact> => {
  const isActuallyGroup = Boolean(
    isGroup ||
    rawNumber.includes("@g.us") ||
    rawNumber.startsWith("120363") ||
    rawNumber.replace(/\D/g, "").startsWith("120363") ||
    rawNumber.replace(/\D/g, "").length >= 16
  );

  let number = isActuallyGroup ? rawNumber.replace(/[^0-9]/g, "") : rawNumber.replace(/[^0-9]/g, "");
  if (!number && !lid) throw new Error("Either number or lid must be provided");

  const baseLid = isActuallyGroup ? "" : (extractBaseLid(lid) || (rawNumber && rawNumber.length >= 14 ? rawNumber : ""));

  // Se o número recebido for um LID (>= 14 dígitos e não é grupo), tenta resolver para telefone real
  if (!isActuallyGroup && number && number.length >= 14) {
    const resolvedPhone = await resolveLidToPhoneNumber(baseLid || number);
    if (resolvedPhone) {
      number = resolvedPhone;
    }
  }

  // Se temos LID e telefone real, armazena no mapeamento persistente
  if (!isActuallyGroup && baseLid && isRealPhoneNumber(number)) {
    await saveLidMapping(baseLid, number, 0, name);
  }

  // 1. Busca defensiva por número
  let contactByNumber = isRealPhoneNumber(number)
    ? await Contact.findOne({
        where: {
          number,
          isGroup: isActuallyGroup
        }
      })
    : null;

  // 2. Busca defensiva por LID
  let contactByLid = baseLid
    ? await Contact.findOne({
        where: {
          [Op.or]: [
            { lid: { [Op.like]: `${baseLid}%` } },
            { number: baseLid }
          ],
          isGroup: isActuallyGroup
        }
      })
    : null;

  if (contactByNumber && contactByLid && contactByNumber.id !== contactByLid.id) {
    const targetContact = contactByNumber;
    const sourceContact = contactByLid;

    await Ticket.update(
      { contactId: targetContact.id },
      { where: { contactId: sourceContact.id } }
    );

    await Message.update(
      { contactId: targetContact.id },
      { where: { contactId: sourceContact.id } }
    );

    const bestName = isRealName(name, number, lid)
      ? name
      : isRealName(targetContact.name, targetContact.number, targetContact.lid)
      ? targetContact.name
      : isRealName(sourceContact.name, sourceContact.number, sourceContact.lid)
      ? sourceContact.name
      : targetContact.name || sourceContact.name;

    await sourceContact.destroy();

    await targetContact.update({
      name: bestName,
      lid: sourceContact.lid || (baseLid ? `${baseLid}@lid` : targetContact.lid),
      profilePicUrl: profilePicUrl || targetContact.profilePicUrl || sourceContact.profilePicUrl
    });

    emitContact("update", targetContact);
    return targetContact;
  }

  if (contactByNumber) {
    const updateData: any = {
      lid: (baseLid ? `${baseLid}@lid` : contactByNumber.lid) || contactByNumber.lid,
      profilePicUrl: profilePicUrl || contactByNumber.profilePicUrl
    };

    // Atualiza o number se o existente era um LID e agora temos o número real
    if (isRealPhoneNumber(number) && (!isRealPhoneNumber(contactByNumber.number) || contactByNumber.number.length >= 14)) {
      updateData.number = number;
    }

    if (
      isRealName(name, number, lid) &&
      (!isRealName(contactByNumber.name, contactByNumber.number, contactByNumber.lid) || name.length > contactByNumber.name.length)
    ) {
      updateData.name = name;
    }

    await contactByNumber.update(updateData);
    emitContact("update", contactByNumber);
    return contactByNumber;
  }

  if (contactByLid) {
    const updateData: any = {
      profilePicUrl: profilePicUrl || contactByLid.profilePicUrl
    };

    if (baseLid && !contactByLid.lid) {
      updateData.lid = `${baseLid}@lid`;
    }

    if (isRealPhoneNumber(number) && (!isRealPhoneNumber(contactByLid.number) || contactByLid.number.length >= 14)) {
      updateData.number = number;
    }

    if (
      isRealName(name, number, lid) &&
      (!isRealName(contactByLid.name, contactByLid.number, contactByLid.lid) || name.length > contactByLid.name.length)
    ) {
      updateData.name = name;
    }

    await contactByLid.update(updateData);
    emitContact("update", contactByLid);
    return contactByLid;
  }

  // 3. Inserção blindada com captura de colisão de chave única (UNIQUE constraint fallback)
  try {
    const created = await Contact.create({
      name,
      number,
      lid,
      profilePicUrl,
      email,
      isGroup: isActuallyGroup,
      extraInfo
    });

    emitContact("create", created);
    return created;
  } catch (err: any) {
    if (err.name === "SequelizeUniqueConstraintError" || err.message?.includes("UNIQUE constraint failed")) {
      logger.warn({
        info: "Unique constraint collision caught in CreateOrUpdateContactService, applying update fallback",
        number,
        lid
      });

      // Busca o registro existente que colidiu
      const existing = await Contact.findOne({
        where: {
          [Op.or]: [
            ...(number ? [{ number }] : []),
            ...(lid ? [{ lid }] : [])
          ]
        }
      });

      if (existing) {
        await existing.update({
          name: isRealName(name, number, lid) ? name : existing.name,
          lid: lid || existing.lid,
          profilePicUrl: profilePicUrl || existing.profilePicUrl
        });
        emitContact("update", existing);
        return existing;
      }
    }
    throw err;
  }
};

export default CreateOrUpdateContactService;
