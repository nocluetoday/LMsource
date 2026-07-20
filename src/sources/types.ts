import type { SourceName } from "@/db/types";

export interface RawAuthor {
  family?: string;
  given?: string;
  /** Collective/corporate author or preformatted display name. */
  name?: string;
}

/** Normalized intermediate record produced by every adapter. `raw` keeps the
 * exact source payload for retrieval_events.raw_payload. */
export interface RawRecord {
  source: SourceName;
  sourceId: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  scopusEid?: string;
  openalexId?: string;
  title: string;
  abstract?: string;
  year?: number;
  journal?: string;
  authors: RawAuthor[];
  publicationTypes: string[];
  citedByCount?: number;
  raw: unknown;
}

export interface SearchResult {
  records: RawRecord[];
  /** Total matches reported by the source (may exceed records fetched). */
  totalCount: number;
  rateLimitHeaders?: Record<string, string>;
}

export interface SourceAdapter {
  name: SourceName;
  /** False when required credentials are missing (e.g. Scopus without a key). */
  available(): boolean;
  /** `query` is already in this source's native syntax. */
  search(query: string, opts: { maxResults: number }): Promise<SearchResult>;
}
