/**
 * contactHelper.js
 * 
 * REGRA ABSOLUTA: Todo contato individual exibe SEMPRE E EXCLUSIVAMENTE o número
 * de telefone formatado. NADA DE NOMES. NADA DE LIDs. NADA DE TEXTOS GENÉRICOS.
 * Única exceção: Grupos do WhatsApp (exibem nome do grupo).
 */

export const isLidNumber = (val = "") => {
  if (!val) return false;
  const str = String(val).trim();
  if (str.includes("@lid")) return true;
  const clean = str.replace(/\D/g, "");
  if (clean.length >= 14) return true;
  if (clean.length === 13 && !clean.startsWith("55")) return true;
  return false;
};

export const formatPhoneNumber = (num = "") => {
  if (!num) return "";
  const clean = String(num).replace(/\D/g, "");
  if (!clean) return String(num);

  // Brasil celular: 55 + DDD(2) + 9dígitos = 13
  if (clean.startsWith("55") && clean.length === 13) {
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  // Brasil fixo: 55 + DDD(2) + 8dígitos = 12
  if (clean.startsWith("55") && clean.length === 12) {
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  // Nacional celular: DDD(2) + 9dígitos = 11
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  // Nacional fixo: DDD(2) + 8dígitos = 10
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }

  // Grupo WhatsApp
  if (clean.startsWith("120363") || clean.length >= 18) {
    return "Grupo WhatsApp";
  }

  // Se for LID (14+ dígitos), não prefixar com +
  if (clean.length >= 14) {
    return `⏳ Resolução pendente (${clean.slice(0, 6)}...)`;
  }

  // Número internacional legítimo
  return `+${clean}`;
};

/**
 * Extrai o melhor número de telefone real disponível no contato.
 * Retorna null se não houver número real (apenas LID).
 */
const extractRealPhone = (contact) => {
  if (!contact) return null;

  // 1. Campo phoneNumber resolvido explicitamente
  if (contact.phoneNumber) {
    const clean = String(contact.phoneNumber).replace(/\D/g, "");
    if (clean.length >= 10 && clean.length <= 13) return clean;
  }

  // 2. Campo number
  const rawNumber = String(contact.number || "").replace(/\D/g, "");
  if (rawNumber && rawNumber.length >= 10 && rawNumber.length <= 13) {
    return rawNumber;
  }

  // 3. Campo name (pode conter o número real)
  const rawName = String(contact.name || "").replace(/\D/g, "");
  if (rawName && rawName.length >= 10 && rawName.length <= 13) {
    return rawName;
  }

  // 4. Nenhum número real encontrado
  return null;
};

export const getContactDisplayName = (contact) => {
  if (!contact) return "";

  const numberStr = String(contact.number || "").trim();
  const rawNumber = numberStr.replace(/\D/g, "");

  // 1. Grupo WhatsApp → mostra nome do grupo (ÚNICA EXCEÇÃO)
  const isGroup = Boolean(
    contact.isGroup ||
    numberStr.includes("@g.us") ||
    numberStr.startsWith("120363") ||
    rawNumber.startsWith("120363") ||
    rawNumber.length >= 18
  );

  if (isGroup) {
    const nameStr = String(contact.name || "").trim();
    if (nameStr && !isLidNumber(nameStr)) {
      return nameStr;
    }
    return "Grupo WhatsApp";
  }

  // 2. Para contatos individuais: SEMPRE E EXCLUSIVAMENTE o número de telefone
  const realPhone = extractRealPhone(contact);
  if (realPhone) {
    return formatPhoneNumber(realPhone);
  }

  // 3. Se não houver número real (LID sem resolução), mostrar indicador visual
  return `Nº pendente (?)`;
};

/**
 * Verifica se o display name indica resolução pendente (LID sem telefone real)
 */
export const isPendingResolution = (displayName) => {
  return displayName === "Nº pendente (?)";
};

/**
 * Tooltip explicativo para contatos com resolução pendente
 */
export const PENDING_TOOLTIP = "Assim que o contato responder uma mensagem, o telefone real será capturado automaticamente.";
