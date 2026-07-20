import type { SourceName } from "@/db/types";
import type { RawAuthor, RawRecord } from "@/sources/types";
import {
  firstAuthorSurname,
  isTitleMatchable,
  normalizeDoi,
  normalizePmcid,
  normalizePmid,
  normalizeScopusEid,
  normalizeTitle,
} from "./identifiers";

// Identity resolution: group RawRecords that refer to the same article using
// the cascade DOI → PMID → Scopus EID → normalized title + first author + year,
// then merge fields into one canonical article per group. Deterministic; no LLM.

export interface CanonicalIdentifiers {
  doi?: string;
  pmid?: string;
  pmcid?: string;
  scopus_eid?: string;
  openalex?: string;
}

export interface CanonicalArticle {
  title: string;
  title_normalized: string;
  abstract?: string;
  abstract_source?: SourceName;
  year?: number;
  journal?: string;
  authors: RawAuthor[];
  publicationTypes: string[];
  citedByCount?: number;
  source_of_truth: SourceName;
  identifiers: CanonicalIdentifiers;
  /** Every raw record that resolved into this article (for retrieval_events). */
  members: RawRecord[];
}

/** Priority when picking title/journal/author metadata: curated biomedical
 * sources first. */
const METADATA_PRIORITY: SourceName[] = ["pubmed", "scopus", "openalex", "crossref"];

function identityKeys(r: RawRecord): string[] {
  const keys: string[] = [];
  const doi = normalizeDoi(r.doi);
  const pmid = normalizePmid(r.pmid);
  const eid = normalizeScopusEid(r.scopusEid);
  if (doi) keys.push(`doi:${doi}`);
  if (pmid) keys.push(`pmid:${pmid}`);
  if (eid) keys.push(`eid:${eid}`);
  if (isTitleMatchable(r.publicationTypes)) {
    const title = normalizeTitle(r.title);
    const surname = firstAuthorSurname(r.authors);
    if (title && surname && r.year) keys.push(`title:${title}|${surname}|${r.year}`);
  }
  return keys;
}

function bySourcePriority(a: RawRecord, b: RawRecord): number {
  return METADATA_PRIORITY.indexOf(a.source) - METADATA_PRIORITY.indexOf(b.source);
}

function mergeGroup(members: RawRecord[]): CanonicalArticle {
  const ordered = [...members].sort(bySourcePriority);
  const primary = ordered[0];

  // Longest abstract wins; ties go to source priority (ordered is stable).
  const withAbstract = ordered.filter((r) => r.abstract);
  const abstractRecord = withAbstract.sort(
    (a, b) => (b.abstract?.length ?? 0) - (a.abstract?.length ?? 0),
  )[0];

  const structuredAuthors = ordered.find((r) => r.authors.some((a) => a.family));
  const authors = (structuredAuthors ?? ordered.find((r) => r.authors.length > 0))?.authors ?? [];

  const identifiers: CanonicalIdentifiers = {};
  for (const r of members) {
    identifiers.doi ??= normalizeDoi(r.doi);
    identifiers.pmid ??= normalizePmid(r.pmid);
    identifiers.pmcid ??= normalizePmcid(r.pmcid);
    identifiers.scopus_eid ??= normalizeScopusEid(r.scopusEid);
    identifiers.openalex ??= r.openalexId;
  }

  const citedCounts = members.map((r) => r.citedByCount).filter((c): c is number => c != null);

  return {
    title: primary.title,
    title_normalized: normalizeTitle(primary.title),
    abstract: abstractRecord?.abstract,
    abstract_source: abstractRecord?.source,
    year: ordered.find((r) => r.year != null)?.year,
    journal: ordered.find((r) => r.journal)?.journal,
    authors,
    publicationTypes: [...new Set(members.flatMap((r) => r.publicationTypes))],
    citedByCount: citedCounts.length ? Math.max(...citedCounts) : undefined,
    source_of_truth: primary.source,
    identifiers,
    members,
  };
}

/** Union-find over identity keys: records sharing ANY key join one group. */
export function resolveIdentities(records: RawRecord[]): CanonicalArticle[] {
  const parent = new Map<number, number>();
  const find = (i: number): number => {
    let root = i;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = i;
    while (parent.get(cur) !== cur) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    parent.set(find(a), find(b));
  };

  const keyOwner = new Map<string, number>();
  records.forEach((r, i) => {
    parent.set(i, i);
    for (const key of identityKeys(r)) {
      const owner = keyOwner.get(key);
      if (owner === undefined) keyOwner.set(key, i);
      else union(i, owner);
    }
  });

  const groups = new Map<number, RawRecord[]>();
  records.forEach((r, i) => {
    const root = find(i);
    const group = groups.get(root) ?? [];
    group.push(r);
    groups.set(root, group);
  });

  return [...groups.values()].map(mergeGroup);
}
