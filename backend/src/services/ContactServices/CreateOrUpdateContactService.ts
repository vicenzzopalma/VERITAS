import { Op } from "sequelize";
import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";

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

  const number = isActuallyGroup ? rawNumber.replace(/[^0-9]/g, "") : rawNumber.replace(/[^0-9]/g, "");
  if (!number && !lid) throw new Error("Either number or lid must be provided");

  const baseLid = isActuallyGroup ? "" : (extractBaseLid(lid) || (rawNumber && rawNumber.length >= 14 ? rawNumber : ""));

  // 1. Busca defensiva por número
  let contactByNumber = number
    ? await Contact.findOne({
        where: {
          [Op.or]: [
            { number },
            ...(lid ? [{ lid }] : [])
          ]
        }
      })
    : null;

  // 2. Busca defensiva por LID
  let contactByLid = baseLid && (!contactByNumber || contactByNumber.lid !== lid)
    ? await Contact.findOne({
        where: {
          [Op.or]: [
            { lid: { [Op.like]: `${baseLid}%` } },
            { number: baseLid }
          ]
        }
      })
    : null;

  const shouldMerge =
    contactByNumber && contactByLid && contactByNumber.id !== contactByLid.id;

  if (shouldMerge) {
    await Ticket.update(
      { contactId: contactByNumber.id },
      { where: { contactId: contactByLid.id } }
    );

    const bestName = isRealName(name, number, lid)
      ? name
      : isRealName(contactByNumber.name, contactByNumber.number, contactByNumber.lid)
      ? contactByNumber.name
      : isRealName(contactByLid.name, contactByLid.number, contactByLid.lid)
      ? contactByLid.name
      : contactByNumber.name || contactByLid.name;

    await contactByLid.destroy();

    await contactByNumber.update({
      name: bestName,
      lid: contactByLid.lid || lid,
      profilePicUrl: profilePicUrl || contactByNumber.profilePicUrl || contactByLid.profilePicUrl
    });

    emitContact("update", contactByNumber);
    return contactByNumber;
  }

  if (contactByNumber) {
    const updateData: any = {
      lid: lid || contactByNumber.lid,
      profilePicUrl: profilePicUrl || contactByNumber.profilePicUrl
    };

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

    if (isRealPhoneNumber(number) && (!isRealPhoneNumber(contactByLid.number) || contactByLid.number.length > 13)) {
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
