import type { ColumnType, Generated, JSONColumnType } from "kysely";

// Keep in sync with migrations/*.sql (hand-maintained).

export type RunStatus = "queued" | "running" | "failed" | "completed" | "cancelled";
export type StageStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type SourceName = "pubmed" | "openalex" | "crossref" | "scopus";
export type SearchRunStatus = "completed" | "failed" | "skipped";
export type IdScheme = "doi" | "pmid" | "pmcid" | "scopus_eid" | "openalex" | "crossref_doi";
export type ScreenDecision = "include" | "exclude" | "maybe";
export type PrismaBucket = "identified" | "deduplicated" | "screened_in" | "screened_out" | "extracted";
export type SupportStatus = "supported" | "insufficient";

type Timestamp = ColumnType<Date, Date | string, Date | string>;
type CreatedAt = ColumnType<Date, Date | string | undefined, never>;

export interface ProjectsTable {
  id: Generated<string>;
  user_id: string;
  name: string;
  description: string | null;
  created_at: CreatedAt;
}

export interface QuestionsTable {
  id: Generated<string>;
  project_id: string;
  text: string;
  pico: JSONColumnType<unknown> | null;
  created_at: CreatedAt;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface RunsTable {
  id: Generated<string>;
  question_id: string;
  status: Generated<RunStatus>;
  current_stage: string | null;
  config: JSONColumnType<unknown>;
  pico_snapshot: JSONColumnType<unknown> | null;
  error: JSONColumnType<unknown> | null;
  created_at: CreatedAt;
  started_at: Timestamp | null;
  finished_at: Timestamp | null;
}

export interface RunStagesTable {
  id: Generated<string>;
  run_id: string;
  stage: string;
  status: Generated<StageStatus>;
  output: JSONColumnType<unknown> | null;
  error: JSONColumnType<unknown> | null;
  started_at: Timestamp | null;
  finished_at: Timestamp | null;
}

export interface SearchStrategiesTable {
  id: Generated<string>;
  run_id: string;
  label: string;
  source_scope: Generated<string>;
  query_text: string;
  rationale: string | null;
  model: string | null;
  ordinal: number;
}

export interface SearchRunsTable {
  id: Generated<string>;
  run_id: string;
  strategy_id: string | null;
  source: SourceName;
  query_executed: string;
  executed_at: CreatedAt;
  result_count: number | null;
  fetched_count: number | null;
  status: Generated<SearchRunStatus>;
  error: string | null;
  rate_limit_headers: JSONColumnType<unknown> | null;
}

export interface ArticlesTable {
  id: Generated<string>;
  title: string;
  title_normalized: string;
  abstract: string | null;
  year: number | null;
  journal: string | null;
  authors: JSONColumnType<unknown>;
  publication_types: JSONColumnType<unknown>;
  cited_by_count: number | null;
  source_of_truth: SourceName | null;
  abstract_source: SourceName | null;
  embedding: string | null; // pgvector literal, e.g. "[0.1,0.2,...]"
  embedding_model: string | null;
  created_at: CreatedAt;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface ArticleIdentifiersTable {
  id: Generated<string>;
  article_id: string;
  scheme: IdScheme;
  value: string;
}

export interface RetrievalEventsTable {
  id: Generated<string>;
  article_id: string;
  run_id: string;
  search_run_id: string | null;
  source: SourceName;
  position: number | null;
  raw_payload: JSONColumnType<unknown>;
  retrieved_at: CreatedAt;
}

export interface RunArticlesTable {
  run_id: string;
  article_id: string;
  score_total: number | null;
  score_components: JSONColumnType<unknown> | null;
  rank: number | null;
  screen_decision: ScreenDecision | null;
  screen_reason: string | null;
  screen_model: string | null;
  enriched: Generated<boolean>;
  prisma_bucket: Generated<PrismaBucket>;
}

export interface EvidenceExtractionsTable {
  id: Generated<string>;
  run_id: string;
  article_id: string;
  extraction: JSONColumnType<unknown>;
  model: string;
  confidence: number | null;
  created_at: CreatedAt;
}

export interface ClaimsTable {
  id: Generated<string>;
  run_id: string;
  section: string;
  ordinal: number;
  text: string;
  support_status: SupportStatus;
}

export interface ClaimSourcesTable {
  id: Generated<string>;
  claim_id: string;
  extraction_id: string | null;
  article_id: string;
  quote: string | null;
  source_section: string | null;
  locator: string | null;
}

export interface UserAnnotationsTable {
  id: Generated<string>;
  user_id: string;
  target_type: string;
  target_id: string;
  note: string;
  created_at: CreatedAt;
}

export interface LlmCallsTable {
  id: Generated<string>;
  run_id: string | null;
  stage: string;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  latency_ms: number | null;
  attempt: Generated<number>;
  ok: boolean;
  created_at: CreatedAt;
}

export interface Database {
  projects: ProjectsTable;
  questions: QuestionsTable;
  runs: RunsTable;
  run_stages: RunStagesTable;
  search_strategies: SearchStrategiesTable;
  search_runs: SearchRunsTable;
  articles: ArticlesTable;
  article_identifiers: ArticleIdentifiersTable;
  retrieval_events: RetrievalEventsTable;
  run_articles: RunArticlesTable;
  evidence_extractions: EvidenceExtractionsTable;
  claims: ClaimsTable;
  claim_sources: ClaimSourcesTable;
  user_annotations: UserAnnotationsTable;
  llm_calls: LlmCallsTable;
}
