import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCrossrefResponse, stripJats } from "@/sources/crossref";
import { parseOpenAlexResponse, reconstructAbstract } from "@/sources/openalex";
import { parsePubmedEfetch } from "@/sources/pubmed";

const fixture = (name: string) => readFileSync(join(__dirname, "..", "fixtures", name), "utf8");

describe("parsePubmedEfetch", () => {
  const records = parsePubmedEfetch(fixture("pubmed-efetch.xml"));

  it("parses all articles in the batch", () => {
    expect(records.length).toBeGreaterThanOrEqual(20);
  });

  it("produces pmid, title, and source on every record", () => {
    for (const r of records) {
      expect(r.source).toBe("pubmed");
      expect(r.pmid).toMatch(/^\d+$/);
      expect(r.title.length).toBeGreaterThan(5);
      expect(r.sourceId).toBe(r.pmid);
    }
  });

  it("extracts DOIs where present", () => {
    const withDoi = records.filter((r) => r.doi);
    expect(withDoi.length).toBeGreaterThan(0);
    for (const r of withDoi) expect(r.doi).toMatch(/^10\./);
  });

  it("extracts abstracts with labeled sections joined", () => {
    const withAbstract = records.filter((r) => r.abstract);
    expect(withAbstract.length).toBeGreaterThan(0);
    for (const r of withAbstract) expect(r.abstract!.length).toBeGreaterThan(50);
  });

  it("extracts years as 4-digit numbers", () => {
    const withYear = records.filter((r) => r.year);
    expect(withYear.length).toBeGreaterThan(0);
    for (const r of withYear) {
      expect(r.year).toBeGreaterThan(1900);
      expect(r.year).toBeLessThan(2100);
    }
  });

  it("extracts authors including structured names", () => {
    const withAuthors = records.filter((r) => r.authors.length > 0);
    expect(withAuthors.length).toBeGreaterThan(0);
    const structured = withAuthors.flatMap((r) => r.authors).filter((a) => a.family);
    expect(structured.length).toBeGreaterThan(0);
  });

  it("handles empty input", () => {
    expect(parsePubmedEfetch("<PubmedArticleSet></PubmedArticleSet>")).toEqual([]);
  });
});

describe("parseOpenAlexResponse", () => {
  const { records, totalCount } = parseOpenAlexResponse(fixture("openalex-works.json"));

  it("parses records and total count", () => {
    expect(records.length).toBeGreaterThanOrEqual(20);
    expect(totalCount).toBeGreaterThanOrEqual(records.length);
  });

  it("strips URL prefixes from identifiers", () => {
    for (const r of records) {
      expect(r.openalexId).toMatch(/^W\d+$/);
      if (r.doi) expect(r.doi).toMatch(/^10\./);
      if (r.pmid) expect(r.pmid).toMatch(/^\d+$/);
    }
  });

  it("reconstructs abstracts from inverted index", () => {
    const withAbstract = records.filter((r) => r.abstract);
    expect(withAbstract.length).toBeGreaterThan(0);
  });
});

describe("reconstructAbstract", () => {
  it("orders words by position", () => {
    expect(
      reconstructAbstract({ world: [1], hello: [0], again: [2] }),
    ).toBe("hello world again");
  });

  it("handles repeated words", () => {
    expect(reconstructAbstract({ the: [0, 2], cat: [1, 3] })).toBe("the cat the cat");
  });

  it("returns undefined for missing input", () => {
    expect(reconstructAbstract(null)).toBeUndefined();
    expect(reconstructAbstract({})).toBeUndefined();
  });
});

describe("parseCrossrefResponse", () => {
  const { records, totalCount } = parseCrossrefResponse(fixture("crossref-works.json"));

  it("parses records with lowercase DOIs", () => {
    expect(records.length).toBeGreaterThanOrEqual(20);
    expect(totalCount).toBeGreaterThanOrEqual(records.length);
    for (const r of records) {
      expect(r.doi).toMatch(/^10\./);
      expect(r.doi).toBe(r.doi!.toLowerCase());
    }
  });

  it("extracts years from issued date-parts", () => {
    const withYear = records.filter((r) => r.year);
    expect(withYear.length).toBeGreaterThan(0);
  });
});

describe("stripJats", () => {
  it("strips JATS tags and keeps section titles", () => {
    const jats =
      "<jats:sec><jats:title>Background</jats:title><jats:p>UTIs are common.</jats:p></jats:sec>";
    expect(stripJats(jats)).toBe("Background: UTIs are common.");
  });

  it("decodes entities", () => {
    expect(stripJats("<jats:p>a &amp; b</jats:p>")).toBe("a & b");
  });

  it("returns undefined for empty input", () => {
    expect(stripJats("")).toBeUndefined();
    expect(stripJats(undefined)).toBeUndefined();
  });
});
