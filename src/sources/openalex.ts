import { throttledFetch } from "./http";
import type { RawRecord, SearchResult, SourceAdapter } from "./types";

const BASE = "https://api.openalex.org/works";
const PER_PAGE = 50;

function mailto(): string {
  const m = process.env.CONTACT_MAILTO;
  return m ? `&mailto=${encodeURIComponent(m)}` : "";
}

/** Rebuild abstract text from OpenAlex's inverted index. */
export function reconstructAbstract(
  inverted: Record<string, number[]> | null | undefined,
): string | undefined {
  if (!inverted) return undefined;
  const positions: [number, string][] = [];
  for (const [word, idxs] of Object.entries(inverted)) {
    for (const i of idxs) positions.push([i, word]);
  }
  if (positions.length === 0) return undefined;
  positions.sort((a, b) => a[0] - b[0]);
  return positions.map(([, w]) => w).join(" ");
}

function stripUrlId(id: string | null | undefined, prefix: string): string | undefined {
  if (!id) return undefined;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

interface OpenAlexWork {
  id?: string;
  doi?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  primary_location?: { source?: { display_name?: string | null } | null } | null;
  authorships?: { author?: { display_name?: string | null } | null }[] | null;
  type?: string | null;
  cited_by_count?: number | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  ids?: { pmid?: string | null; pmcid?: string | null } | null;
}

export function parseOpenAlexResponse(json: string): { records: RawRecord[]; totalCount: number } {
  const doc = JSON.parse(json);
  const works: OpenAlexWork[] = doc?.results ?? [];
  const records: RawRecord[] = [];
  for (const w of works) {
    const openalexId = stripUrlId(w.id, "https://openalex.org/");
    const title = (w.display_name ?? "").trim();
    if (!openalexId || !title) continue;
    records.push({
      source: "openalex",
      sourceId: openalexId,
      openalexId,
      doi: stripUrlId(w.doi ?? undefined, "https://doi.org/"),
      pmid: stripUrlId(w.ids?.pmid ?? undefined, "https://pubmed.ncbi.nlm.nih.gov/"),
      pmcid: stripUrlId(w.ids?.pmcid ?? undefined, "https://www.ncbi.nlm.nih.gov/pmc/articles/"),
      title,
      abstract: reconstructAbstract(w.abstract_inverted_index),
      year: w.publication_year ?? undefined,
      journal: w.primary_location?.source?.display_name ?? undefined,
      authors: (w.authorships ?? []).map((a) => ({ name: a.author?.display_name ?? undefined })),
      publicationTypes: w.type ? [w.type] : [],
      citedByCount: w.cited_by_count ?? undefined,
      raw: w,
    });
  }
  return { records, totalCount: Number(doc?.meta?.count ?? records.length) };
}

export const openalexAdapter: SourceAdapter = {
  name: "openalex",
  available: () => true,
  async search(query, { maxResults }): Promise<SearchResult> {
    const records: RawRecord[] = [];
    let totalCount = 0;
    let cursor = "*";
    let rateLimitHeaders: Record<string, string> = {};
    while (records.length < maxResults && cursor) {
      const perPage = Math.min(PER_PAGE, maxResults - records.length);
      const url =
        `${BASE}?search=${encodeURIComponent(query)}&per-page=${perPage}` +
        `&cursor=${encodeURIComponent(cursor)}${mailto()}`;
      const res = await throttledFetch(url, { endpoint: "openalex", rps: 8 });
      rateLimitHeaders = { ...rateLimitHeaders, ...res.rateLimitHeaders };
      const parsed = parseOpenAlexResponse(res.body);
      totalCount = parsed.totalCount;
      records.push(...parsed.records);
      const doc = JSON.parse(res.body);
      cursor = doc?.meta?.next_cursor ?? "";
      if (parsed.records.length === 0) break;
    }
    return { records, totalCount, rateLimitHeaders };
  },
};
