import { Op, fn, where, col } from "sequelize";

const BRAZIL_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99"
]);

/**
 * Gera variações PRECISAS de pesquisa telefônica.
 * NUNCA fatia o número em pedaços pequenos (ex: nunca transforma 1722 em 22).
 * Mantém a integridade da sequência digitada pelo usuário, aplicando apenas
 * regras válidas de telefonia móvel brasileira (9º dígito e DDI 55).
 */
export const getPhoneSearchVariants = (search: string): string[] => {
  if (!search) return [];

  const clean = search.trim().toLowerCase();
  const digits = search.replace(/\D/g, "");
  const variants = new Set<string>();

  if (clean) {
    variants.add(clean);
  }

  if (!digits || digits.length < 2) {
    return Array.from(variants);
  }

  // 1. Sequência exata dos dígitos digitados
  variants.add(digits);

  // 2. Se começa com 55 (DDI Brasil)
  if (digits.startsWith("55") && digits.length >= 4) {
    const withoutDDI = digits.slice(2);
    variants.add(withoutDDI);

    // Se tem DDD válido + pelo menos 3 dígitos do número (ex: 554199118 -> 4199118)
    if (withoutDDI.length >= 5) {
      const ddd = withoutDDI.slice(0, 2);
      if (BRAZIL_DDDS.has(ddd)) {
        const rest = withoutDDI.slice(2);
        // Variação sem o 9 (se rest começar com 9)
        if (rest.startsWith("9") && rest.length >= 2) {
          const without9 = ddd + rest.slice(1);
          variants.add(without9);
          variants.add("55" + without9);
        }
        // Variação com o 9
        const with9 = ddd + "9" + rest;
        variants.add(with9);
        variants.add("55" + with9);
      }
    }
  } else {
    // NÃO começa com 55 (ex: digitou 419118, 4199118, 1722, etc.)
    variants.add("55" + digits);

    // Se tem DDD válido + pelo menos 3 dígitos do número (ex: 419118 -> DDD 41 + 9118)
    if (digits.length >= 5) {
      const ddd = digits.slice(0, 2);
      if (BRAZIL_DDDS.has(ddd)) {
        const rest = digits.slice(2);
        // Variação removendo o 9 (se rest começar com 9)
        if (rest.startsWith("9") && rest.length >= 2) {
          const without9 = ddd + rest.slice(1);
          variants.add(without9);
          variants.add("55" + without9);
        }
        // Variação adicionando o 9
        const with9 = ddd + "9" + rest;
        variants.add(with9);
        variants.add("55" + with9);
      }
    }

    // Se for número local completo (8 dígitos ou 9 dígitos móvel)
    if (digits.length === 8) {
      variants.add("9" + digits);
    } else if (digits.length === 9 && digits.startsWith("9")) {
      variants.add(digits.slice(1));
    }
  }

  // Cada variante DEVE ter tamanho compatível com a busca original
  const minLength = Math.min(digits.length, 3);
  return Array.from(variants).filter((v) => v.length >= minLength);
};

export default getPhoneSearchVariants;
