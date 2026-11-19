import React from "react";

// Mesma regra do backend: sem acento, minúsculas, palavras separadas (busca AND).
const foldChar = (ch) => {
  const folded = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return folded.length === 1 ? folded : ch.toLowerCase();
};

export const getSearchWords = (query) =>
  Array.from(
    new Set(
      (query || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
    )
  );

// Intervalos [início, fim) de cada palavra encontrada, em índices de caractere.
const findRanges = (chars, words) => {
  const folded = chars.map(foldChar).join("");
  const ranges = [];
  words.forEach((word) => {
    let from = 0;
    let idx = folded.indexOf(word, from);
    while (idx !== -1 && word.length > 0) {
      ranges.push([idx, idx + word.length]);
      from = idx + word.length;
      idx = folded.indexOf(word, from);
    }
  });
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  ranges.forEach((r) => {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  });
  return merged;
};

const markStyle = {
  backgroundColor: "rgba(255, 196, 0, 0.45)",
  color: "inherit",
  borderRadius: 3,
  padding: "0 1px",
};

/**
 * Destaca as palavras buscadas no texto (ignora acento/caixa).
 * Com `maxContext`, corta o texto em volta da primeira ocorrência (trecho).
 */
export const highlightText = (text, query, { maxContext } = {}) => {
  const value = text || "";
  const words = getSearchWords(query);
  // Array.from mantém emojis inteiros (pares surrogate)
  let chars = Array.from(maxContext ? value.replace(/\s+/g, " ") : value);
  if (!words.length) return chars.join("");

  let ranges = findRanges(chars, words);
  let prefix = "";
  let suffix = "";

  if (maxContext && chars.length > maxContext * 2) {
    const first = ranges.length ? ranges[0][0] : 0;
    const start = Math.max(0, first - maxContext);
    const end = Math.min(chars.length, first + maxContext * 2);
    prefix = start > 0 ? "…" : "";
    suffix = end < chars.length ? "…" : "";
    chars = chars.slice(start, end);
    ranges = findRanges(chars, words);
  }

  const parts = [];
  let cursor = 0;
  ranges.forEach(([s, e], i) => {
    if (s > cursor) parts.push(chars.slice(cursor, s).join(""));
    parts.push(
      <mark key={i} style={markStyle}>
        {chars.slice(s, e).join("")}
      </mark>
    );
    cursor = e;
  });
  if (cursor < chars.length) parts.push(chars.slice(cursor).join(""));

  return (
    <>
      {prefix}
      {parts}
      {suffix}
    </>
  );
};
