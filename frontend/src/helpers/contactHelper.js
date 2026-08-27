export const formatPhoneNumber = (num = "") => {
  if (!num) return "";
  const clean = String(num).replace(/\D/g, "");
  if (!clean) return String(num);

  // Formato Brasil com DDI (+55) - 12 dígitos (fixo/móvel antigo) ou 13 dígitos (celular)
  if (clean.startsWith("55") && clean.length === 12) {
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  if (clean.startsWith("55") && clean.length === 13) {
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  // Formato nacional sem DDI - 10 dígitos (DDD + 8) ou 11 dígitos (DDD + 9)
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  // Número internacional padrão (8 a 13 dígitos)
  if (clean.length >= 8 && clean.length <= 13) {
    return `+${clean}`;
  }

  // Grupos WhatsApp (IDs com prefixo 120363 ou >= 16 dígitos)
  if (clean.startsWith("120363") || clean.length >= 16) {
    return "Grupo WhatsApp";
  }

  // Contatos de privacidade WhatsApp (LIDs: 14 ou 15 dígitos)
  if (clean.length >= 14) {
    return "Contato WhatsApp";
  }

  return clean;
};

export const getContactDisplayName = (contact) => {
  if (!contact) return "";

  const nameStr = String(contact.name || "").trim();
  const numberStr = String(contact.number || "").trim();
  const rawNumber = numberStr.replace(/\D/g, "");
  const rawName = nameStr.replace(/\D/g, "");

  // 1. Verificação de Grupo WhatsApp (isGroup, prefixo 120363, @g.us ou ID de grupo longo)
  const isGroup = Boolean(
    contact.isGroup ||
    numberStr.includes("@g.us") ||
    numberStr.startsWith("120363") ||
    rawNumber.startsWith("120363") ||
    rawNumber.length >= 16
  );

  if (isGroup) {
    // Se tiver um nome real e legível de grupo (que não seja o ID numérico longo)
    if (nameStr && nameStr !== rawNumber && !/^\d{14,}$/.test(nameStr)) {
      return nameStr;
    }
    return "Grupo WhatsApp";
  }

  // 2. Se o número for um telefone válido padrão (10 a 13 dígitos, ex: 5541991189892)
  // Regra: prioriza formatar o número do cliente
  if (rawNumber && rawNumber.length >= 10 && rawNumber.length <= 13) {
    return formatPhoneNumber(rawNumber);
  }

  // 3. Se o número veio no campo name (10 a 13 dígitos)
  if (rawName && rawName.length >= 10 && rawName.length <= 13) {
    return formatPhoneNumber(rawName);
  }

  // 4. Se o contato tiver um nome real legível (ex: Caroline Azevedo, Adilson, Paloma Alves)
  // Especialmente importante para contatos identificados por LID (> 13 dígitos)
  if (nameStr && !/^\d{14,}$/.test(nameStr)) {
    return nameStr;
  }

  // 5. Se for um identificador extenso (LID de 14 ou 15 dígitos) sem nome legível
  if (rawNumber.length >= 14 || rawName.length >= 14) {
    return "Contato WhatsApp";
  }

  if (contact.number) {
    return formatPhoneNumber(contact.number);
  }

  return formatPhoneNumber(contact.name || "");
};
