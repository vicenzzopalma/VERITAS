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
  // Se for qualquer outro identificador/número (ex: LIDs de 14+ dígitos), exibir o número diretamente!
  return clean;
};

export const getContactDisplayName = (contact) => {
  if (!contact) return "";

  // Se for grupo, exibe o nome do grupo
  if (contact.isGroup) {
    if (contact.name && !/^\d{16,}$/.test(contact.name)) {
      return contact.name;
    }
    return "Grupo WhatsApp";
  }

  // REGRA ABSOLUTA: O NOME DO CONTATO SEMPRE É O PRÓPRIO NÚMERO DE TELEFONE
  const phone = contact.number || contact.name || "";
  return formatPhoneNumber(phone);
};
