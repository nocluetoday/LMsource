<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# LMSource

Multi-user, LLM-enabled clinical literature-reasoning platform: clinical question → PICO → multi-source Boolean searches (PubMed, OpenAlex, Crossref, Scopus) → dedup → hybrid rerank → LLM screening → structured evidence extraction → evidence matrix → citation-grounded synthesis.

See `CODEBASE_MAP.md` for the directory layout.

## Commands

- `npm run dev` — Next.js dev server + pipeline worker (concurrently)
- `npm run migrate` — apply SQL migrations in `migrations/` to `DATABASE_URL`
- `npm test` — vitest unit tests (no network; adapters test against `tests/fixtures/`)
- `npm run build` — production build (Next standalone + worker bundle)

Local Postgres: `docker compose up -d` (pgvector image). Copy `.env.example` → `.env` first.

## Key facts

- Data layer is Kysely + node-postgres with hand-written SQL migrations. No ORM codegen; keep `src/db/types.ts` in sync with migrations.
- LLM calls go through OpenRouter via `src/llm/structured.ts` only — every structured output is zod-validated with a repair-retry loop.
- **Degraded mode:** without `ELSEVIER_API_KEY`, the pipeline runs on the 3 free sources and the Scopus enrich stage is a no-op. All code must work in this mode.
- Deterministic code (never the LLM) does dedup, identity resolution, and ranking math (`src/dedupe/`, `src/ranking/`).
- Licensing: never persist Elsevier full text or full-text embeddings. Abstracts/metadata/identifiers only.
- Layer rules: `src/app/` only reads/writes DB and enqueues runs; `src/sources|dedupe|ranking` contain no LLM calls; `src/llm/` contains no source-API calls; pipeline stages compose the layers.

<!-- Config review due: 2027-01 -->
