# LMSource

An LLM-enabled clinical literature-reasoning platform. Enter a clinical question and get a reproducible, citation-verified evidence pipeline:

question → PICO structuring → multiple Boolean search strategies → search across PubMed, OpenAlex, Crossref, and Scopus → deterministic deduplication → hybrid relevance reranking → LLM screening → structured evidence extraction → evidence matrix → citation-grounded synthesis where every claim traces to a specific source passage.

The LLM plans, ranks, extracts, and synthesizes; the bibliographic APIs remain the authoritative source for article identity, metadata, abstracts, and citations.

## Getting started

```bash
cp .env.example .env      # fill in keys (see comments in the file)
docker compose up -d      # local Postgres with pgvector
npm install
npm run migrate
npm run dev               # Next.js app + pipeline worker
```

Without an `ELSEVIER_API_KEY` the app runs in **degraded mode** (PubMed + OpenAlex + Crossref only). Scopus support activates automatically once the key is present.

## Deployment

GitHub → Render via `render.yaml` (Docker web service + background worker + managed Postgres). Push to `main` deploys.

## Licensing note (Elsevier / Scopus)

Elsevier's API service agreement restricts serving Elsevier-derived content to users outside the authorized institution, prohibits training AI models on Elsevier content, and restricts systematic storage and redistribution. Accordingly:

- This app stores only abstracts, metadata, identifiers, and user annotations — never Elsevier full text or full-text embeddings.
- Multi-user access to Scopus-derived content should be limited to authorized institutional users until written clarification from Elsevier is obtained.
- The PubMed, OpenAlex, and Crossref sources carry no such restriction.
