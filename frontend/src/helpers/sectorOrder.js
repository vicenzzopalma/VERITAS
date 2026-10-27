// Ordem oficial dos setores (a mesma do CRM). Setores fora da lista vão para o fim, em ordem alfabética.
export const SECTOR_ORDER = [
  "Junior",
  "Senior",
  "PA FIXA 1",
  "PA FIXA 2",
  "Pesquisa",
  "Juridico",
  "Comercial",
  "RH",
  "ADM",
  "Financeiro",
];

const normalize = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const RANK = new Map(SECTOR_ORDER.map((s, i) => [normalize(s), i]));

export const sortSectors = (list) =>
  [...(list || [])].sort((a, b) => {
    const ra = RANK.has(normalize(a)) ? RANK.get(normalize(a)) : Infinity;
    const rb = RANK.has(normalize(b)) ? RANK.get(normalize(b)) : Infinity;
    if (ra !== rb) return ra - rb;
    return String(a).localeCompare(String(b), "pt-BR");
  });
