import { describe, expect, it } from "vitest";
import {
  firstAuthorSurname,
  isTitleMatchable,
  normalizeDoi,
  normalizePmcid,
  normalizePmid,
  normalizeScopusEid,
  normalizeTitle,
} from "@/dedupe/identifiers";
import { resolveIdentities } from "@/dedupe/merge";
import type { RawRecord } from "@/sources/types";

function record(overrides: Partial<RawRecord>): RawRecord {
  return {
    source: "pubmed",
    sourceId: "x",
    title: "A study",
    authors: [],
    publicationTypes: [],
    raw: {},
    ...overrides,
  };
}

describe("normalizeDoi", () => {
  it("lowercases and strips resolver prefixes", () => {
    expect(normalizeDoi("https://doi.org/10.1001/JAMA.2022.123")).toBe("10.1001/jama.2022.123");
    expect(normalizeDoi("http://dx.doi.org/10.1001/x")).toBe("10.1001/x");
    expect(normalizeDoi("doi: 10.1001/x")).toBe("10.1001/x");
  });

  it("strips trailing punctuation", () => {
    expect(normalizeDoi("10.1001/x.")).toBe("10.1001/x");
    expect(normalizeDoi("10.1001/x;")).toBe("10.1001/x");
  });

  it("rejects non-DOIs", () => {
    expect(normalizeDoi("not-a-doi")).toBeUndefined();
    expect(normalizeDoi("")).toBeUndefined();
    expect(normalizeDoi(undefined)).toBeUndefined();
  });
});

describe("normalizePmid / normalizePmcid / normalizeScopusEid", () => {
  it("normalizes pmid formats", () => {
    expect(normalizePmid("12345678")).toBe("12345678");
    expect(normalizePmid("PMID: 12345678")).toBe("12345678");
    expect(normalizePmid("abc")).toBeUndefined();
  });

  it("normalizes pmcid formats", () => {
    expect(normalizePmcid("PMC123456")).toBe("PMC123456");
    expect(normalizePmcid("123456")).toBe("PMC123456");
    expect(normalizePmcid("123456/")).toBe("PMC123456");
  });

  it("validates scopus eids", () => {
    expect(normalizeScopusEid("2-s2.0-85123456789")).toBe("2-s2.0-85123456789");
    expect(normalizeScopusEid("85123456789")).toBeUndefined();
  });
});

describe("normalizeTitle", () => {
  it("strips punctuation, case, diacritics, and tags", () => {
    expect(normalizeTitle("Méthenamine <i>Hippurate</i>: A Re-Appraisal!")).toBe(
      "methenamine hippurate a re appraisal",
    );
  });
});

describe("firstAuthorSurname", () => {
  it("uses family name when structured", () => {
    expect(firstAuthorSurname([{ family: "Botros", given: "C" }])).toBe("botros");
  });
  it("falls back to last token of display name", () => {
    expect(firstAuthorSurname([{ name: "Carine Botros" }])).toBe("botros");
  });
  it("returns undefined without authors", () => {
    expect(firstAuthorSurname([])).toBeUndefined();
  });
});

describe("isTitleMatchable", () => {
  it("excludes errata, comments, corrections, retractions", () => {
    expect(isTitleMatchable(["Published Erratum"])).toBe(false);
    expect(isTitleMatchable(["Comment"])).toBe(false);
    expect(isTitleMatchable(["Corrigendum"])).toBe(false);
    expect(isTitleMatchable(["Journal Article"])).toBe(true);
  });
});

describe("resolveIdentities", () => {
  it("merges records sharing a DOI despite case and prefix differences", () => {
    const merged = resolveIdentities([
      record({ source: "crossref", doi: "10.1001/jama.2022.123", title: "Trial of X" }),
      record({ source: "openalex", doi: "https://doi.org/10.1001/JAMA.2022.123", title: "Trial of X." }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].identifiers.doi).toBe("10.1001/jama.2022.123");
    expect(merged[0].members).toHaveLength(2);
  });

  it("merges a PMID-only record with a DOI-only record via a bridging record", () => {
    const merged = resolveIdentities([
      record({ source: "pubmed", pmid: "111", title: "Bridge study" }),
      record({ source: "pubmed", pmid: "111", doi: "10.1000/abc", title: "Bridge study" }),
      record({ source: "crossref", doi: "10.1000/abc", title: "Bridge study" }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].identifiers.pmid).toBe("111");
    expect(merged[0].identifiers.doi).toBe("10.1000/abc");
  });

  it("merges by title + first author + year when no identifiers overlap", () => {
    const merged = resolveIdentities([
      record({
        source: "pubmed",
        pmid: "222",
        title: "Methenamine for recurrent UTI",
        year: 2020,
        authors: [{ family: "Smith", given: "A" }],
      }),
      record({
        source: "crossref",
        doi: "10.2000/xyz",
        title: "Methenamine for Recurrent UTI.",
        year: 2020,
        authors: [{ name: "Alice Smith" }],
      }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].identifiers.pmid).toBe("222");
    expect(merged[0].identifiers.doi).toBe("10.2000/xyz");
  });

  it("does NOT merge same title with different year", () => {
    const merged = resolveIdentities([
      record({ source: "pubmed", pmid: "1", title: "Annual report", year: 2019, authors: [{ family: "Lee" }] }),
      record({ source: "pubmed", pmid: "2", title: "Annual report", year: 2020, authors: [{ family: "Lee" }] }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("does NOT merge same title/year with different first author", () => {
    const merged = resolveIdentities([
      record({ source: "pubmed", pmid: "1", title: "UTI prophylaxis", year: 2021, authors: [{ family: "Lee" }] }),
      record({ source: "pubmed", pmid: "2", title: "UTI prophylaxis", year: 2021, authors: [{ family: "Chen" }] }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("does NOT title-merge an erratum with its parent article", () => {
    const merged = resolveIdentities([
      record({
        source: "pubmed",
        pmid: "1",
        title: "Trial of methenamine",
        year: 2022,
        authors: [{ family: "Harding" }],
      }),
      record({
        source: "pubmed",
        pmid: "2",
        title: "Trial of methenamine",
        year: 2022,
        authors: [{ family: "Harding" }],
        publicationTypes: ["Published Erratum"],
      }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("does NOT merge records lacking any shared key", () => {
    const merged = resolveIdentities([
      record({ source: "pubmed", pmid: "1", title: "Study A", year: 2020 }),
      record({ source: "crossref", doi: "10.3000/b", title: "Study B", year: 2021 }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("prefers pubmed metadata, longest abstract, and max citation count", () => {
    const merged = resolveIdentities([
      record({
        source: "crossref",
        doi: "10.4000/c",
        title: "Trial of Y [Crossref]",
        abstract: "short",
        citedByCount: 10,
      }),
      record({
        source: "openalex",
        doi: "10.4000/c",
        title: "Trial of Y [OpenAlex]",
        abstract: "a much longer abstract with real substance in it",
        citedByCount: 42,
      }),
      record({
        source: "pubmed",
        pmid: "444",
        doi: "10.4000/c",
        title: "Trial of Y",
        year: 2021,
      }),
    ]);
    expect(merged).toHaveLength(1);
    const m = merged[0];
    expect(m.title).toBe("Trial of Y");
    expect(m.source_of_truth).toBe("pubmed");
    expect(m.abstract).toContain("much longer");
    expect(m.abstract_source).toBe("openalex");
    expect(m.citedByCount).toBe(42);
    expect(m.year).toBe(2021);
  });
});
