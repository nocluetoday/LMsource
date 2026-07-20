// Deterministic identifier + title normalization. Pure functions, no I/O.

/** Lowercase, strip resolver prefixes and stray punctuation. Returns undefined
 * for values that don't look like a DOI at all. */
export function normalizeDoi(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  let v = value.trim().toLowerCase();
  v = v.replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
  v = v.replace(/^doi:\s*/, "");
  v = v.replace(/[.,;)\]]+$/, "");
  if (!/^10\.\d{4,9}\//.test(v)) return undefined;
  return v;
}

export function normalizePmid(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const m = value.trim().match(/^(?:pmid:?\s*)?(\d{1,9})$/i);
  return m ? m[1] : undefined;
}

export function normalizePmcid(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const m = value.trim().toUpperCase().match(/^(?:PMC)?(\d{1,9})\/?$/);
  return m ? `PMC${m[1]}` : undefined;
}

export function normalizeScopusEid(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  return /^2-s2\.0-\d+$/.test(v) ? v : undefined;
}

/** Aggressive title normalization for last-resort matching: lowercase, strip
 * diacritics, punctuation, and whitespace runs. */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Surname of the first author, normalized like titles. */
export function firstAuthorSurname(
  authors: { family?: string; given?: string; name?: string }[],
): string | undefined {
  const first = authors[0];
  if (!first) return undefined;
  const surname = first.family ?? first.name?.split(/\s+/).pop();
  if (!surname) return undefined;
  const norm = normalizeTitle(surname);
  return norm || undefined;
}

const NON_MATCHABLE_TYPES = [
  "erratum",
  "published erratum",
  "correction",
  "corrigendum",
  "comment",
  "editorial comment",
  "retraction",
  "retraction of publication",
];

/** Errata/comments/corrections must never merge with their parent article via
 * title matching (identifier matches still apply). */
export function isTitleMatchable(publicationTypes: string[]): boolean {
  return !publicationTypes.some((t) => NON_MATCHABLE_TYPES.includes(t.trim().toLowerCase()));
}
