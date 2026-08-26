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

  // 2. REGRA ABSOLUTA: EXIBIR EXCLUSIVAMENTE O NÚMERO DE TELEFONE DO CONTATO
  // Ignora nomes de pessoas (ex: "Sandro Marcelo Grun") e exibe sempre o número (+55 55 9991-6869)
  const rawNumber = String(contact.number || "").replace(/\D/g, "");
  if (rawNumber && rawNumber.length >= 10 && rawNumber.length <= 13) {
    return formatPhoneNumber(rawNumber);
  }

  // Se o número com DDD foi salvo no campo name
  const rawName = String(contact.name || "").replace(/\D/g, "");
  if (rawName && rawName.length >= 10 && rawName.length <= 13) {
    return formatPhoneNumber(rawName);
  }

  // Se for qualquer outro número ou identificador
  if (contact.number) {
    return formatPhoneNumber(contact.number);
  }

  return formatPhoneNumber(contact.name || "");
};
