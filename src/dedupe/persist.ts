import type { Kysely } from "kysely";
import type { Database, IdScheme } from "@/db/types";
import type { RawRecord } from "@/sources/types";
import type { CanonicalArticle } from "./merge";
import { firstAuthorSurname } from "./identifiers";

// Persists canonical articles: reuses existing article rows (matched by any
// identifier, then by normalized title + year + first author), records
// identifiers, and — when run context is given — retrieval_events and
// run_articles provenance rows.

const SCHEME_PRIORITY: IdScheme[] = ["doi", "pmid", "scopus_eid", "openalex", "pmcid"];

export interface RunContext {
  runId: string;
  /** search_run id + result position for a raw record, for provenance. */
  provenanceFor: (record: RawRecord) => { searchRunId: string | null; position: number | null };
}

export interface PersistResult {
  articleIds: string[];
  inserted: number;
  reused: number;
}

async function findExisting(
  db: Kysely<Database>,
  article: CanonicalArticle,
): Promise<string | undefined> {
  for (const scheme of SCHEME_PRIORITY) {
    const value = article.identifiers[scheme as keyof typeof article.identifiers];
    if (!value) continue;
    const row = await db
      .selectFrom("article_identifiers")
      .select("article_id")
      .where("scheme", "=", scheme)
      .where("value", "=", value)
      .executeTakeFirst();
    if (row) return row.article_id;
  }
  if (article.year != null) {
    const candidates = await db
      .selectFrom("articles")
      .select(["id", "authors", "year"])
      .where("title_normalized", "=", article.title_normalized)
      .where("year", "=", article.year)
      .execute();
    const surname = firstAuthorSurname(article.authors);
    for (const c of candidates) {
      const storedSurname = firstAuthorSurname(
        (c.authors as { family?: string; name?: string }[]) ?? [],
      );
      if (surname && storedSurname && surname !== storedSurname) continue;
      return c.id;
    }
  }
  return undefined;
}

export async function persistCanonicalArticles(
  db: Kysely<Database>,
  articles: CanonicalArticle[],
  run?: RunContext,
): Promise<PersistResult> {
  const articleIds: string[] = [];
  let inserted = 0;
  let reused = 0;

  for (const article of articles) {
    const existingId = await findExisting(db, article);
    let articleId: string;
    if (existingId) {
      reused++;
      articleId = existingId;
      // Enrich the stored row where the new data is strictly better.
      const stored = await db
        .selectFrom("articles")
        .select(["abstract", "cited_by_count"])
        .where("id", "=", existingId)
        .executeTakeFirstOrThrow();
      const updates: Record<string, unknown> = {};
      if (!stored.abstract && article.abstract) {
        updates.abstract = article.abstract;
        updates.abstract_source = article.abstract_source ?? null;
      }
      if (article.citedByCount != null && (stored.cited_by_count ?? -1) < article.citedByCount) {
        updates.cited_by_count = article.citedByCount;
      }
      if (Object.keys(updates).length > 0) {
        await db
          .updateTable("articles")
          .set({ ...updates, updated_at: new Date() })
          .where("id", "=", existingId)
          .execute();
      }
    } else {
      inserted++;
      const row = await db
        .insertInto("articles")
        .values({
          title: article.title,
          title_normalized: article.title_normalized,
          abstract: article.abstract ?? null,
          abstract_source: article.abstract_source ?? null,
          year: article.year ?? null,
          journal: article.journal ?? null,
          authors: JSON.stringify(article.authors),
          publication_types: JSON.stringify(article.publicationTypes),
          cited_by_count: article.citedByCount ?? null,
          source_of_truth: article.source_of_truth,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      articleId = row.id;
    }
    articleIds.push(articleId);

    const identifierRows = (Object.entries(article.identifiers) as [IdScheme, string][])
      .filter(([, value]) => value)
      .map(([scheme, value]) => ({ article_id: articleId, scheme, value }));
    if (identifierRows.length > 0) {
      await db
        .insertInto("article_identifiers")
        .values(identifierRows)
        .onConflict((oc) => oc.columns(["scheme", "value"]).doNothing())
        .execute();
    }

    if (run) {
      for (const member of article.members) {
        const { searchRunId, position } = run.provenanceFor(member);
        await db
          .insertInto("retrieval_events")
          .values({
            article_id: articleId,
            run_id: run.runId,
            search_run_id: searchRunId,
            source: member.source,
            position,
            raw_payload: JSON.stringify(member.raw),
          })
          .execute();
      }
      await db
        .insertInto("run_articles")
        .values({ run_id: run.runId, article_id: articleId, prisma_bucket: "deduplicated" })
        .onConflict((oc) => oc.columns(["run_id", "article_id"]).doNothing())
        .execute();
    }
  }

  return { articleIds, inserted, reused };
}
