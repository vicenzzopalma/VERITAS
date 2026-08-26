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
  // Se for identificador LID do WhatsApp (14+ dígitos sem formato de telefone)
  if (clean.length >= 14) {
    return `Contato (${clean.slice(-4)})`;
  }
  return clean;
};

export const getContactDisplayName = (contact) => {
  if (!contact) return "";

  // 1. Se for grupo, exibe o nome do grupo
  if (contact.isGroup) {
    if (contact.name && !/^\d{16,}$/.test(contact.name)) {
      return contact.name;
    }
    return "Grupo WhatsApp";
  }

  // 2. Se tem um nome real de pessoa/empresa (com letras), exibe o nome
  if (contact.name && /[a-zA-ZÀ-ÿ]/.test(contact.name)) {
    return contact.name;
  }

  // 3. Se for número de telefone real (10 a 13 dígitos), formata como telefone
  const rawNumber = String(contact.number || "").replace(/\D/g, "");
  if (rawNumber && rawNumber.length >= 10 && rawNumber.length <= 13) {
    return formatPhoneNumber(rawNumber);
  }

  // 4. Se tiver apenas nome numérico curto (ex: 5541991189892)
  const rawName = String(contact.name || "").replace(/\D/g, "");
  if (rawName && rawName.length >= 10 && rawName.length <= 13) {
    return formatPhoneNumber(rawName);
  }

  // 5. Se for identificador LID (14+ dígitos)
  if (rawNumber.length >= 14 || rawName.length >= 14) {
    const lidDigits = rawNumber.length >= 14 ? rawNumber : rawName;
    return `📱 Contato (${lidDigits.slice(-4)})`;
  }

  return formatPhoneNumber(contact.number || contact.name || "");
};

