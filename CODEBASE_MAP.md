# Codebase map

```
migrations/          — numbered .sql files (001 enables pgvector); run via npm run migrate
src/app/             — Next.js App Router: (marketing) landing, (auth) login/signup/reset, (app) dashboard/questions/runs, api/ routes
src/auth/            — Better Auth config (server) + client hooks
src/db/              — pg Pool, Kysely instance, Database types, migrator
src/sources/         — search-source adapters behind one SourceAdapter interface (pubmed, openalex, crossref, scopus/)
src/pipeline/        — run orchestration: runner, state persistence, stages/01-pico … 10-gaps
src/dedupe/          — deterministic identifier normalization + identity-resolution merge
src/ranking/         — hybrid relevance scoring + OpenAI embeddings client
src/llm/             — OpenRouter client, per-stage model config, zod-validated callStructured, prompts/
src/schemas/         — zod schemas shared by LLM stages, jsonb columns, and UI (pico, strategy, screening, extraction, synthesis)
src/components/      — React components (ArticleTable, EvidenceMatrix, PrismaFlow, PicoEditor, …)
src/email/           — Resend client + auth email templates
src/lib/             — small utils (markdown/csv export, formatting)
worker/              — long-lived pipeline worker (polls runs table)
scripts/             — dev CLIs: run-question, record-fixtures
tests/               — vitest unit tests + recorded API fixtures
```
