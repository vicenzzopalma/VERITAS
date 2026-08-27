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
  // Se for apenas dígitos e tiver mais de 10 dígitos (típico de LID ou grupo)
  if (/^\d{10,}$/.test(cleanName)) return false;
  return true;
};

const isRealPhoneNumber = (num?: string): boolean => {
  if (!num || !num.trim()) return false;
  const clean = num.replace(/\D/g, "");
  // Número real no Brasil ou internacional: 10 a 13 dígitos
  // LIDs do WhatsApp têm tipicamente 14 a 16 dígitos e começam com 2... ou 93... ou 10... etc.
  if (clean.length >= 10 && clean.length <= 13) return true;
  return false;
};

const emitContact = (action: "update" | "create", contact: Contact) => {
  const io = getIO();
  io.emit("contact", { action, contact });
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

  let contactByNumber = isRealPhoneNumber(number)
    ? await Contact.findOne({ where: { number } })
    : null;

  let contactByLid = baseLid
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

    logger.info({
      info: "Merged contacts by number and lid",
      primaryContactId: contactByNumber.id,
      mergedContactId: contactByLid.id,
      resolvedName: bestName
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
};

export default CreateOrUpdateContactService;
