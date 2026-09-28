export const getSearchTerms = (search: string): string[] => {
  const raw = (search || "").trim();
  if (!raw) return [];

  const normalized = raw.toLowerCase().replace(/\s+/g, " ");
  const terms = normalized
    .split(" ")
    .map((term) => term.trim())
    .filter(Boolean);

  if (!terms.length) return [];

  return Array.from(new Set(terms));
};
