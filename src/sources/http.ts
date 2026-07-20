import PQueue from "p-queue";

// Shared HTTP layer for all source adapters: per-endpoint request-rate
// throttling, 429/5xx exponential backoff, rate-limit header capture,
// short-lived response caching, and in-flight duplicate suppression.

const queues = new Map<string, PQueue>();

function queueFor(endpoint: string, rps: number): PQueue {
  let q = queues.get(endpoint);
  if (!q) {
    q = new PQueue({ intervalCap: Math.max(1, rps), interval: 1000, carryoverIntervalCount: true });
    queues.set(endpoint, q);
  }
  return q;
}

interface CacheEntry {
  body: string;
  headers: Record<string, string>;
  expires: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<FetchedResponse>>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;

export interface FetchedResponse {
  body: string;
  rateLimitHeaders: Record<string, string>;
}

export interface ThrottledFetchOptions {
  /** Key grouping requests under one rate limit (e.g. "pubmed"). */
  endpoint: string;
  /** Requests per second for this endpoint. */
  rps: number;
  headers?: Record<string, string>;
  /** Skip the response cache (default false). */
  noCache?: boolean;
}

function pickRateHeaders(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    if (/^(x-)?ratelimit/i.test(key) || key.toLowerCase() === "retry-after") out[key] = value;
  });
  return out;
}

async function fetchWithRetry(
  url: string,
  opts: ThrottledFetchOptions,
  maxAttempts = 4,
): Promise<FetchedResponse> {
  const q = queueFor(opts.endpoint, opts.rps);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = (await q.add(() => fetch(url, { headers: opts.headers }))) as Response;
      const rateLimitHeaders = pickRateHeaders(response);
      if (response.status === 429 || response.status >= 500) {
        lastErr = new Error(`${opts.endpoint} HTTP ${response.status}`);
        const retryAfter = Number(response.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 500 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${opts.endpoint} HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      return { body: await response.text(), rateLimitHeaders };
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function throttledFetch(
  url: string,
  opts: ThrottledFetchOptions,
): Promise<FetchedResponse> {
  const cacheKey = `${opts.endpoint}:${url}`;
  if (!opts.noCache) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) {
      return { body: hit.body, rateLimitHeaders: hit.headers };
    }
    const pending = inFlight.get(cacheKey);
    if (pending) return pending;
  }
  const promise = fetchWithRetry(url, opts)
    .then((res) => {
      if (!opts.noCache) {
        if (cache.size >= CACHE_MAX) {
          const oldest = cache.keys().next().value;
          if (oldest) cache.delete(oldest);
        }
        cache.set(cacheKey, {
          body: res.body,
          headers: res.rateLimitHeaders,
          expires: Date.now() + CACHE_TTL_MS,
        });
      }
      return res;
    })
    .finally(() => inFlight.delete(cacheKey));
  if (!opts.noCache) inFlight.set(cacheKey, promise);
  return promise;
}
