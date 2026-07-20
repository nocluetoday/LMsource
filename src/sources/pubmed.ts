import { XMLParser } from "fast-xml-parser";
import { throttledFetch } from "./http";
import type { RawAuthor, RawRecord, SearchResult, SourceAdapter } from "./types";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const EFETCH_BATCH = 200;

function rps(): number {
  // 10 rps with an NCBI key, 3 without; stay under both.
  return process.env.NCBI_API_KEY ? 8 : 2;
}

function keyParam(): string {
  const key = process.env.NCBI_API_KEY;
  return key ? `&api_key=${encodeURIComponent(key)}` : "";
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Abstract sections keep their Label attribute; text nodes under mixed
  // content land in "#text".
  textNodeName: "#text",
});

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    // Mixed content (italics etc.): join all string-ish leaves in order.
    return Object.entries(o)
      .filter(([k]) => !k.startsWith("@_"))
      .map(([, v]) => textOf(v))
      .join("");
  }
  return "";
}

interface PubmedArticleNode {
  MedlineCitation?: {
    PMID?: unknown;
    Article?: {
      ArticleTitle?: unknown;
      Abstract?: { AbstractText?: unknown };
      Journal?: { Title?: unknown; JournalIssue?: { PubDate?: { Year?: unknown; MedlineDate?: unknown } } };
      AuthorList?: { Author?: unknown };
      PublicationTypeList?: { PublicationType?: unknown };
    };
  };
  PubmedData?: { ArticleIdList?: { ArticleId?: unknown } };
}

export function parsePubmedEfetch(xml: string): RawRecord[] {
  const doc = parser.parse(xml);
  const articles = asArray<PubmedArticleNode>(doc?.PubmedArticleSet?.PubmedArticle);
  const records: RawRecord[] = [];
  for (const art of articles) {
    const citation = art.MedlineCitation;
    const a = citation?.Article;
    if (!citation || !a) continue;
    const pmid = textOf(citation.PMID);
    const title = textOf(a.ArticleTitle).trim();
    if (!pmid || !title) continue;

    const abstractSections = asArray(a.Abstract?.AbstractText);
    const abstract = abstractSections
      .map((s) => {
        const label = typeof s === "object" && s !== null ? (s as Record<string, unknown>)["@_Label"] : undefined;
        const text = textOf(s).trim();
        return label ? `${label}: ${text}` : text;
      })
      .filter(Boolean)
      .join("\n") || undefined;

    const yearRaw = textOf(a.Journal?.JournalIssue?.PubDate?.Year) ||
      textOf(a.Journal?.JournalIssue?.PubDate?.MedlineDate).slice(0, 4);
    const year = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : undefined;

    const authors: RawAuthor[] = asArray(a.AuthorList?.Author).map((au) => {
      const o = au as Record<string, unknown>;
      if (o.CollectiveName) return { name: textOf(o.CollectiveName) };
      return { family: textOf(o.LastName) || undefined, given: textOf(o.ForeName) || undefined };
    });

    const publicationTypes = asArray(a.PublicationTypeList?.PublicationType).map((t) => textOf(t));

    let doi: string | undefined;
    let pmcid: string | undefined;
    for (const id of asArray(art.PubmedData?.ArticleIdList?.ArticleId)) {
      const o = id as Record<string, unknown>;
      const idType = String(o["@_IdType"] ?? "");
      if (idType === "doi") doi = textOf(id) || undefined;
      if (idType === "pmc") pmcid = textOf(id) || undefined;
    }

    records.push({
      source: "pubmed",
      sourceId: pmid,
      pmid,
      doi,
      pmcid,
      title,
      abstract,
      year,
      journal: textOf(a.Journal?.Title) || undefined,
      authors,
      publicationTypes,
      raw: art,
    });
  }
  return records;
}

export const pubmedAdapter: SourceAdapter = {
  name: "pubmed",
  available: () => true,
  async search(query, { maxResults }): Promise<SearchResult> {
    const esearchUrl =
      `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=${maxResults}` +
      `&term=${encodeURIComponent(query)}${keyParam()}`;
    const es = await throttledFetch(esearchUrl, { endpoint: "pubmed", rps: rps() });
    const esJson = JSON.parse(es.body);
    const ids: string[] = esJson?.esearchresult?.idlist ?? [];
    const totalCount = Number(esJson?.esearchresult?.count ?? ids.length);

    const records: RawRecord[] = [];
    let rateLimitHeaders = es.rateLimitHeaders;
    for (let i = 0; i < ids.length; i += EFETCH_BATCH) {
      const batch = ids.slice(i, i + EFETCH_BATCH);
      const efetchUrl =
        `${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&id=${batch.join(",")}${keyParam()}`;
      const ef = await throttledFetch(efetchUrl, { endpoint: "pubmed", rps: rps() });
      rateLimitHeaders = { ...rateLimitHeaders, ...ef.rateLimitHeaders };
      records.push(...parsePubmedEfetch(ef.body));
    }
    return { records, totalCount, rateLimitHeaders };
  },
};
