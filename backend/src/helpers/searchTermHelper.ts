import { Op, literal, where } from "sequelize";

/** Remove acentos e baixa a caixa: "João" -> "joao". */
export const normalizeSearchText = (value: string): string =>
  (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Palavras da busca, já normalizadas (sem acento, minúsculas, sem % e _ que
 * seriam curingas no LIKE). Todas precisam aparecer (busca AND).
 */
export const getSearchTerms = (search: string): string[] => {
  const normalized = normalizeSearchText((search || "").trim())
    .replace(/[%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  return Array.from(new Set(normalized.split(" ").filter(Boolean)));
};

/** Comportamento antigo (mantém acentos); usado pela lista de tickets do atendimento. */
export const getLegacySearchTerms = (search: string): string[] => {
  const raw = (search || "").trim();
  if (!raw) return [];
  const terms = raw.toLowerCase().replace(/\s+/g, " ").split(" ").filter(Boolean);
  return Array.from(new Set(terms));
};

// SQLite não sabe tirar acento nem baixar caixa de letras acentuadas,
// então dobramos a coluna com REPLACE aninhado antes do LIKE.
const ACCENT_FOLDS: Array<[string, string]> = [
  ["á", "a"], ["à", "a"], ["â", "a"], ["ã", "a"], ["ä", "a"],
  ["Á", "a"], ["À", "a"], ["Â", "a"], ["Ã", "a"], ["Ä", "a"],
  ["é", "e"], ["è", "e"], ["ê", "e"], ["ë", "e"],
  ["É", "e"], ["È", "e"], ["Ê", "e"], ["Ë", "e"],
  ["í", "i"], ["ì", "i"], ["î", "i"], ["ï", "i"],
  ["Í", "i"], ["Ì", "i"], ["Î", "i"], ["Ï", "i"],
  ["ó", "o"], ["ò", "o"], ["ô", "o"], ["õ", "o"], ["ö", "o"],
  ["Ó", "o"], ["Ò", "o"], ["Ô", "o"], ["Õ", "o"], ["Ö", "o"],
  ["ú", "u"], ["ù", "u"], ["û", "u"], ["ü", "u"],
  ["Ú", "u"], ["Ù", "u"], ["Û", "u"], ["Ü", "u"],
  ["ç", "c"], ["Ç", "c"], ["ñ", "n"], ["Ñ", "n"]
];

/** Expressão SQL da coluna sem acento e em minúsculas. `column` é SQL cru e confiável. */
export const foldedColumnSql = (column: string): string =>
  ACCENT_FOLDS.reduce(
    (expr, [from, to]) => `REPLACE(${expr}, '${from}', '${to}')`,
    `LOWER(COALESCE(${column}, ''))`
  );

/**
 * Pré-filtro barato: letras que podem ter acento viram "_" (1 caractere qualquer)
 * e o LIKE nativo (já sem caixa para ASCII) descarta quase tudo antes do REPLACE
 * aninhado, que é caro. Toda linha que casa com o termo dobrado casa com este padrão.
 */
const accentWildcardPattern = (term: string): string =>
  `%${term.replace(/[aeioucn]/g, "_")}%`;

/** Condição "coluna contém o termo", ignorando acento e caixa. */
export const foldedContains = (column: string, term: string): any => ({
  [Op.and]: [
    where(literal(column), { [Op.like]: accentWildcardPattern(term) }),
    where(literal(foldedColumnSql(column)), { [Op.like]: `%${term}%` })
  ]
});

/**
 * Condição "coluna contém TODAS as palavras" (AND).
 * Ordem importa no SQLite: primeiro todos os pré-filtros baratos, começando pela
 * palavra mais seletiva (mais letras fixas), e só depois os REPLACE caros.
 */
export const foldedContainsAll = (column: string, terms: string[]): any => {
  const fixedChars = (term: string) => term.replace(/[aeioucn]/g, "").length;
  const ordered = [...terms].sort((a, b) => fixedChars(b) - fixedChars(a));
  return {
    [Op.and]: [
      ...ordered.map((term) =>
        where(literal(column), { [Op.like]: accentWildcardPattern(term) })
      ),
      ...ordered.map((term) =>
        where(literal(foldedColumnSql(column)), { [Op.like]: `%${term}%` })
      )
    ]
  };
};
