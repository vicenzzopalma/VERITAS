/**
 * contactHelper.js
 * 
 * Exibição Clara e Imediata do WhatsApp:
 * - Prioridade Máxima: Número de telefone real formatado (+55 (XX) 9XXXX-XXXX).
 * - Se houver nome salvo e telefone real, ambos ficam acessíveis.
 * - Se for grupo WhatsApp, exibe o nome do grupo.
 * - Se for um ID/LID do WhatsApp (14+ dígitos), exibe o identificador real do WhatsApp
 *   junto com o nome (se houver), NUNCA ocultando por "Nº pendente".
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

  // Se for LID (14+ dígitos), exibir diretamente o ID WhatsApp sem enrolação
  if (clean.length >= 14) {
    return `WhatsApp ID: ${clean}`;
  }

  // Número internacional legítimo
  return `+${clean}`;
};

/**
 * Extrai o melhor número de telefone real disponível no contato.
 * Retorna null se não houver número real.
 */
export const extractRealPhone = (contact) => {
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

  // 3. Campo name (se foi salvo como número de telefone)
  const rawName = String(contact.name || "").replace(/\D/g, "");
  if (rawName && rawName.length >= 10 && rawName.length <= 13) {
    return rawName;
  }

  return null;
};

export const getContactDisplayName = (contact) => {
  if (!contact) return "";

  const numberStr = String(contact.number || "").trim();
  const rawNumber = numberStr.replace(/\D/g, "");

  // 1. Grupo WhatsApp → mostra nome do grupo
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

  // 2. Contato com telefone real disponível
  const realPhone = extractRealPhone(contact);
  if (realPhone) {
    const formatted = formatPhoneNumber(realPhone);
    const nameStr = String(contact.name || "").trim();
    // Se o contato tiver um nome real cadastrado (e não for apenas números), exibir Nome com o Telefone
    if (nameStr && nameStr !== realPhone && !isLidNumber(nameStr) && !/^\d+$/.test(nameStr)) {
      return `${formatted} (${nameStr})`;
    }
    return formatted;
  }

  // 3. Contato com identificador LID (14+ dígitos)
  const nameStr = String(contact.name || "").trim();
  if (nameStr && !isLidNumber(nameStr) && !/^\d+$/.test(nameStr)) {
    return `${nameStr} [${rawNumber.slice(0, 6)}...]`;
  }

  if (rawNumber) {
    return `WhatsApp ID: ${rawNumber}`;
  }

  return "Contato WhatsApp";
};

/**
 * Função mantida para retrocompatibilidade: agora NUNCA bloqueia a exibição.
 */
export const isPendingResolution = (displayName) => {
  return false;
};

export const PENDING_TOOLTIP = "";
