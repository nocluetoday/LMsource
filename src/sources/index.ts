import { crossrefAdapter } from "./crossref";
import { openalexAdapter } from "./openalex";
import { pubmedAdapter } from "./pubmed";
import type { SourceAdapter } from "./types";

// Scopus joins this list in its own module once the Elsevier key exists.
export function getAdapters(): SourceAdapter[] {
  const adapters: SourceAdapter[] = [pubmedAdapter, openalexAdapter, crossrefAdapter];
  return adapters.filter((a) => a.available());
}
