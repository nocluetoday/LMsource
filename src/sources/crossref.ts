import { throttledFetch } from "./http";
import type { RawRecord, SearchResult, SourceAdapter } from "./types";

const BASE = "https://api.crossref.org/works";
const ROWS = 50;

function userAgent(): string {
  const m = process.env.CONTACT_MAILTO;
  return `LMSource/0.1 (literature review tool${m ? `; mailto:${m}` : ""})`;
}

/** Crossref abstracts are JATS XML fragments; strip tags to plain text. */
export function stripJats(abstract: string | undefined | null): string | undefined {
  if (!abstract) return undefined;
  const text = abstract
    .replace(/<jats:title[^>]*>([\s\S]*?)<\/jats:title>/g, "$1: ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

interface CrossrefItem {
  DOI?: string;
  title?: string[];
  abstract?: string;
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  author?: { family?: string; given?: string; name?: string }[];
  type?: string;
  "is-referenced-by-count"?: number;
}

export function parseCrossrefResponse(json: string): { records: RawRecord[]; totalCount: number } {
  const doc = JSON.parse(json);
  const items: CrossrefItem[] = doc?.message?.items ?? [];
  const records: RawRecord[] = [];
  for (const item of items) {
    const doi = item.DOI?.toLowerCase();
    const title = item.title?.[0]?.trim();
    if (!doi || !title) continue;
    records.push({
      source: "crossref",
      sourceId: doi,
      doi,
      title,
      abstract: stripJats(item.abstract),
      year: item.issued?.["date-parts"]?.[0]?.[0] ?? undefined,
      journal: item["container-title"]?.[0] ?? undefined,
      authors: (item.author ?? []).map((a) => ({
        family: a.family,
        given: a.given,
        name: a.name,
      })),
      publicationTypes: item.type ? [item.type] : [],
      citedByCount: item["is-referenced-by-count"] ?? undefined,
      raw: item,
    });
  }
  return { records, totalCount: Number(doc?.message?.["total-results"] ?? records.length) };
}

export const crossrefAdapter: SourceAdapter = {
  name: "crossref",
  available: () => true,
  async search(query, { maxResults }): Promise<SearchResult> {
    const rows = Math.min(ROWS, maxResults);
    const url = `${BASE}?query.bibliographic=${encodeURIComponent(query)}&rows=${rows}`;
    const res = await throttledFetch(url, {
      endpoint: "crossref",
      rps: 2,
      headers: { "User-Agent": userAgent() },
    });
    const parsed = parseCrossrefResponse(res.body);
    return { ...parsed, rateLimitHeaders: res.rateLimitHeaders };
  },
};
