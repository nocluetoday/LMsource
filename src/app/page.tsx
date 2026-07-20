import Link from "next/link";
import { getSession } from "@/auth/session";

const PIPELINE = [
  ["01", "PICO", "The question becomes a structured, editable search specification."],
  ["02", "Strategies", "Multiple complementary Boolean searches, each with a stated rationale."],
  ["03", "Retrieval", "PubMed, OpenAlex, Crossref, and Scopus, searched in parallel."],
  ["04", "Deduplication", "Deterministic identity resolution by DOI, PMID, EID, then title."],
  ["05", "Ranking", "Hybrid scoring: semantic, lexical, design, population, recency."],
  ["06", "Extraction", "Design, population, outcomes, and effect estimates — each tied to a source span."],
  ["07", "Synthesis", "A cited evidence matrix and narrative in which no claim floats free."],
] as const;

export default async function Landing() {
  const session = await getSession();
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24">
      <header className="flex items-baseline justify-between pt-8">
        <span className="font-serif text-xl tracking-tight">
          LM<span className="text-teal">Source</span>
        </span>
        <nav className="flex items-center gap-3">
          {session ? (
            <Link href="/dashboard" className="btn-primary">
              Open workspace
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary">
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="pt-24 pb-16">
        <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-teal">
          Literature reasoning, not literature search
        </p>
        <h1 className="mt-6 max-w-3xl font-serif text-[clamp(2.4rem,6vw,4.2rem)] leading-[1.05] tracking-tight">
          Every claim traceable to a{" "}
          <em className="text-teal-deep">source passage.</em>
        </h1>
        <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-soft">
          LMSource turns a clinical question into a reproducible evidence pipeline:
          structured searches across four bibliographic databases, deterministic
          deduplication, ranked screening, and a cited synthesis built only from
          extracted evidence.
        </p>
        <div className="mt-10 flex gap-3">
          <Link href={session ? "/dashboard" : "/signup"} className="btn-primary">
            Start a question
          </Link>
          <a href="#pipeline" className="btn-ghost">
            How it works
          </a>
        </div>
      </section>

      <section id="pipeline" className="rule-heavy pt-10">
        <h2 className="font-mono text-[13px] uppercase tracking-[0.2em] text-ink-faint">
          The pipeline
        </h2>
        <ol className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE.map(([n, title, body]) => (
            <li key={n} className="rule-t pt-4">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[13px] text-teal">{n}</span>
                <h3 className="font-serif text-xl">{title}</h3>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="rule-t mt-24 pt-6 text-[13px] text-ink-faint">
        <p>
          Bibliographic records remain authoritative to their sources. Scopus-derived
          content is limited to authorized institutional users.
        </p>
      </footer>
    </main>
  );
}
