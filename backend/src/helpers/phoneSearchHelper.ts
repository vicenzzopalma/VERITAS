import { Op, fn, where, col } from "sequelize";

/**
 * Gera todas as variações possíveis de um número digitado pelo usuário
 * para garantir que o número seja encontrado no banco independentemente de:
 * 1. Ter ou não o 9º dígito (ex: 4191189892 vs 41991189892)
 * 2. Ter ou não o DDI 55 (ex: 554191189892 vs 4191189892)
 * 3. Busca parcial por DDD + pedaço do número (ex: 419118, 4199118, 47996, etc.)
 * 4. Busca parcial apenas pelo final do número (ex: 91189892, 991189892, 1189892)
 * 5. Formatações com caracteres especiais (+, -, (, ), espaços)
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

  variants.add(digits);

  // Se o número começa com 55 (DDI Brasil)
  if (digits.startsWith("55") && digits.length >= 4) {
    const withoutDDI = digits.slice(2);
    variants.add(withoutDDI);

    const ddd = withoutDDI.slice(0, 2);
    const rest = withoutDDI.slice(2);

    if (rest.length > 0) {
      // Variação COM 9º dígito
      const with9 = ddd + "9" + rest;
      variants.add(with9);
      variants.add("55" + with9);

      // Variação SEM 9º dígito (se rest começar com 9)
      if (rest.startsWith("9") && rest.length >= 2) {
        const without9 = ddd + rest.slice(1);
        variants.add(without9);
        variants.add("55" + without9);
      }

      // Variação da parte após o DDD
      variants.add(rest);
      if (rest.startsWith("9") && rest.length >= 2) {
        variants.add(rest.slice(1));
      }
      variants.add("9" + rest);
    }
  } else {
    // NÃO começa com 55 (ex: digitou 419118, 4199118, 91189892, etc.)
    variants.add("55" + digits);

    // Se tem pelo menos DDD (2 dígitos) + parte do número
    if (digits.length >= 3) {
      const ddd = digits.slice(0, 2);
      const rest = digits.slice(2);

      // Variação adicionando o 9º dígito: ddd + '9' + rest
      const with9 = ddd + "9" + rest;
      variants.add(with9);
      variants.add("55" + with9);

      // Variação removendo o 9 (se rest começar com 9)
      if (rest.startsWith("9") && rest.length >= 2) {
        const without9 = ddd + rest.slice(1);
        variants.add(without9);
        variants.add("55" + without9);
      }

      // Variação da parte após o DDD
      variants.add(rest);
      if (rest.startsWith("9") && rest.length >= 2) {
        variants.add(rest.slice(1));
      }
      variants.add("9" + rest);
    }

    // Se for busca de número local (sem DDD)
    if (digits.length >= 4) {
      if (digits.startsWith("9") && digits.length >= 5) {
        variants.add(digits.slice(1));
      }
      variants.add("9" + digits);
    }
  }

  // Filtrar variantes vazias ou menores que 2 dígitos
  return Array.from(variants).filter(v => v.length >= 2);
};

export default getPhoneSearchVariants;
