-- Core application schema. Better Auth tables arrive in a later migration;
-- user_id columns are text (Better Auth ids) without FK until then.

CREATE TYPE run_status AS ENUM ('queued', 'running', 'failed', 'completed', 'cancelled');
CREATE TYPE stage_status AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');
CREATE TYPE source_name AS ENUM ('pubmed', 'openalex', 'crossref', 'scopus');
CREATE TYPE search_run_status AS ENUM ('completed', 'failed', 'skipped');
CREATE TYPE id_scheme AS ENUM ('doi', 'pmid', 'pmcid', 'scopus_eid', 'openalex', 'crossref_doi');
CREATE TYPE screen_decision AS ENUM ('include', 'exclude', 'maybe');
CREATE TYPE prisma_bucket AS ENUM ('identified', 'deduplicated', 'screened_in', 'screened_out', 'extracted');
CREATE TYPE support_status AS ENUM ('supported', 'insufficient');

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_user_id_idx ON projects (user_id);

CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  text text NOT NULL,
  pico jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_project_id_idx ON questions (project_id);

CREATE TABLE runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  status run_status NOT NULL DEFAULT 'queued',
  current_stage text,
  config jsonb NOT NULL,
  pico_snapshot jsonb,
  error jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX runs_question_id_idx ON runs (question_id);
CREATE INDEX runs_status_idx ON runs (status) WHERE status IN ('queued', 'running');

CREATE TABLE run_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  stage text NOT NULL,
  status stage_status NOT NULL DEFAULT 'pending',
  output jsonb,
  error jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE (run_id, stage)
);

CREATE TABLE search_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  label text NOT NULL,
  source_scope text NOT NULL DEFAULT 'all',
  query_text text NOT NULL,
  rationale text,
  model text,
  ordinal int NOT NULL
);
CREATE INDEX search_strategies_run_id_idx ON search_strategies (run_id);

CREATE TABLE search_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  strategy_id uuid REFERENCES search_strategies (id) ON DELETE SET NULL,
  source source_name NOT NULL,
  query_executed text NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  result_count int,
  fetched_count int,
  status search_run_status NOT NULL DEFAULT 'completed',
  error text,
  rate_limit_headers jsonb
);
CREATE INDEX search_runs_run_id_idx ON search_runs (run_id);

CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_normalized text NOT NULL,
  abstract text,
  year int,
  journal text,
  authors jsonb NOT NULL DEFAULT '[]',
  publication_types jsonb NOT NULL DEFAULT '[]',
  cited_by_count int,
  source_of_truth source_name,
  abstract_source source_name,
  embedding vector(1536),
  embedding_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX articles_title_normalized_idx ON articles (title_normalized);
CREATE INDEX articles_embedding_idx ON articles USING hnsw (embedding vector_cosine_ops);

CREATE TABLE article_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  scheme id_scheme NOT NULL,
  value text NOT NULL,
  UNIQUE (scheme, value)
);
CREATE INDEX article_identifiers_article_id_idx ON article_identifiers (article_id);

CREATE TABLE retrieval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  search_run_id uuid REFERENCES search_runs (id) ON DELETE SET NULL,
  source source_name NOT NULL,
  position int,
  raw_payload jsonb NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX retrieval_events_run_id_idx ON retrieval_events (run_id);
CREATE INDEX retrieval_events_article_id_idx ON retrieval_events (article_id);

CREATE TABLE run_articles (
  run_id uuid NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  score_total real,
  score_components jsonb,
  rank int,
  screen_decision screen_decision,
  screen_reason text,
  screen_model text,
  enriched boolean NOT NULL DEFAULT false,
  prisma_bucket prisma_bucket NOT NULL DEFAULT 'identified',
  PRIMARY KEY (run_id, article_id)
);
CREATE INDEX run_articles_rank_idx ON run_articles (run_id, rank);

CREATE TABLE evidence_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  extraction jsonb NOT NULL,
  model text NOT NULL,
  confidence real,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, article_id)
);

CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  section text NOT NULL,
  ordinal int NOT NULL,
  text text NOT NULL,
  support_status support_status NOT NULL
);
CREATE INDEX claims_run_id_idx ON claims (run_id);

CREATE TABLE claim_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims (id) ON DELETE CASCADE,
  extraction_id uuid REFERENCES evidence_extractions (id) ON DELETE SET NULL,
  article_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  quote text,
  source_section text,
  locator text
);
CREATE INDEX claim_sources_claim_id_idx ON claim_sources (claim_id);

CREATE TABLE user_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_annotations_target_idx ON user_annotations (target_type, target_id);

CREATE TABLE llm_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES runs (id) ON DELETE CASCADE,
  stage text NOT NULL,
  model text NOT NULL,
  prompt_tokens int,
  completion_tokens int,
  latency_ms int,
  attempt int NOT NULL DEFAULT 1,
  ok boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX llm_calls_run_id_idx ON llm_calls (run_id);
