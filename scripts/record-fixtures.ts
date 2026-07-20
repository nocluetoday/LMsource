// Captures live API responses into tests/fixtures/ so adapter parsing is
// testable offline. Run: npx tsx --env-file-if-exists=.env scripts/record-fixtures.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES = join(process.cwd(), "tests", "fixtures");
const QUERY_BOOLEAN = 'methenamine AND ("urinary tract infection" OR UTI)';
const QUERY_PLAIN = "methenamine urinary tract infection";

async function main() {
  mkdirSync(FIXTURES, { recursive: true });

  // PubMed: esearch then efetch
  const esearch = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=25&term=${encodeURIComponent(QUERY_BOOLEAN)}`,
  );
  const esJson = await esearch.json();
  writeFileSync(join(FIXTURES, "pubmed-esearch.json"), JSON.stringify(esJson, null, 2));
  const ids: string[] = esJson.esearchresult.idlist;
  const efetch = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(",")}`,
  );
  writeFileSync(join(FIXTURES, "pubmed-efetch.xml"), await efetch.text());
  console.log(`pubmed: ${ids.length} ids`);

  // OpenAlex
  const mailto = process.env.CONTACT_MAILTO ? `&mailto=${encodeURIComponent(process.env.CONTACT_MAILTO)}` : "";
  const oa = await fetch(
    `https://api.openalex.org/works?search=${encodeURIComponent(QUERY_PLAIN)}&per-page=25${mailto}`,
  );
  writeFileSync(join(FIXTURES, "openalex-works.json"), await oa.text());
  console.log("openalex: saved");

  // Crossref
  const cr = await fetch(
    `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(QUERY_PLAIN)}&rows=25`,
    { headers: { "User-Agent": "LMSource/0.1 (fixture recording)" } },
  );
  writeFileSync(join(FIXTURES, "crossref-works.json"), await cr.text());
  console.log("crossref: saved");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
