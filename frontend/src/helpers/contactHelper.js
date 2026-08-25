export const formatPhoneNumber = (num = "") => {
  if (!num) return "";
  const clean = String(num).replace(/\D/g, "");
  // LIDs do WhatsApp têm 14 ou mais dígitos -> não são telefones válidos
  if (clean.length >= 14) return "";
  // Formato Brasil com DDI (+55)
  if (clean.startsWith("55") && clean.length === 12) {
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  if (clean.startsWith("55") && clean.length === 13) {
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  // Formato nacional sem DDI
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length >= 8 && clean.length <= 13) {
    return `+${clean}`;
  }
  return "";
};

export const getContactDisplayName = (contact) => {
  if (!contact) return "Contato";
  if (contact.isGroup) {
    if (contact.name && !/^\d{14,}$/.test(contact.name)) {
      return contact.name;
    }
    return "Grupo WhatsApp";
  }

  const formattedPhone = formatPhoneNumber(contact.number);

  // Se o nome não for uma sequência crua de números de 10+ dígitos
  if (contact.name && !/^\d{10,}$/.test(contact.name.trim())) {
    return contact.name;
  }

  // Se o nome for uma sequência de números, mas temos o telefone real
  if (formattedPhone) {
    return formattedPhone;
  }

  return "Contato WhatsApp";
};
