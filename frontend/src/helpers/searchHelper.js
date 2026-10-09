export const normalizeSearchText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

export const digitsOnly = (value = "") => String(value).replace(/\D/g, "");

export const getLocalPhoneVariants = (value = "") => {
  const digits = digitsOnly(value);
  if (digits.length < 2) return [];

  const variants = new Set([digits]);
  const addBrazilVariants = (national) => {
    if (!national) return;
    variants.add(national);
    variants.add(`55${national}`);

    if (national.length >= 3) {
      const ddd = national.slice(0, 2);
      const rest = national.slice(2);
      if (rest.startsWith("9")) variants.add(`${ddd}${rest.slice(1)}`);
      else if (rest.length >= 8) variants.add(`${ddd}9${rest}`);
    }
  };

  if (digits.startsWith("55") && digits.length > 2) {
    addBrazilVariants(digits.slice(2));
  } else {
    addBrazilVariants(digits);
  }

  return Array.from(variants);
};

export const matchesPhoneSearch = (query, candidate) => {
  const queryDigits = digitsOnly(query);
  const candidateDigits = digitsOnly(candidate);
  if (!queryDigits || !candidateDigits) return false;

  return getLocalPhoneVariants(query).some(
    (variant) => candidateDigits.includes(variant) || variant.includes(candidateDigits)
  );
};

export default normalizeSearchText;
