import Link from "next/link";
import { requireSession } from "@/auth/session";
import { getDb } from "@/db/kysely";
import { createProject, createQuestion } from "./actions";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireSession();
  const db = getDb();
  const projects = await db
    .selectFrom("projects")
    .selectAll()
    .where("user_id", "=", session.user.id)
    .orderBy("created_at", "desc")
    .execute();
  const questions = projects.length
    ? await db
        .selectFrom("questions")
        .selectAll()
        .where("project_id", "in", projects.map((p) => p.id))
        .orderBy("created_at", "desc")
        .execute()
    : [];

  return (
    <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
      <section>
        <h1 className="font-serif text-3xl">Questions</h1>
        {projects.length === 0 ? (
          <p className="mt-6 text-[15px] text-ink-soft">
            Create a project to file your first clinical question.
          </p>
        ) : (
          <>
            <form action={createQuestion} className="rule-heavy mt-6 bg-paper-raised p-4">
              <label className="label" htmlFor="q-text">New clinical question</label>
              <textarea
                id="q-text"
                name="text"
                required
                rows={2}
                placeholder="Does methenamine prevent recurrent UTI in men?"
                className="field resize-y font-serif text-[17px]"
              />
              <div className="mt-3 flex items-center gap-3">
                <select name="project_id" className="field w-auto text-[13px]" required>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button className="btn-primary">File question</button>
              </div>
            </form>
            <ul className="mt-8 space-y-0">
              {questions.map((q) => {
                const project = projects.find((p) => p.id === q.project_id);
                return (
                  <li key={q.id} className="rule-t">
                    <Link
                      href={`/questions/${q.id}`}
                      className="group flex items-baseline justify-between gap-6 py-4"
                    >
                      <span className="font-serif text-[17px] leading-snug group-hover:text-teal-deep">
                        {q.text}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                        {project?.name}
                      </span>
                    </Link>
                  </li>
                );
              })}
              {questions.length === 0 && (
                <li className="rule-t py-4 text-[14px] text-ink-soft">No questions yet.</li>
              )}
            </ul>
          </>
        )}
      </section>

      <aside>
        <h2 className="font-mono text-[13px] uppercase tracking-[0.2em] text-ink-faint">
          Projects
        </h2>
        <form action={createProject} className="mt-4 flex gap-2">
          <input name="name" required placeholder="New project" className="field" />
          <button className="btn-ghost shrink-0">Add</button>
        </form>
        <ul className="mt-4 space-y-1 text-[14px]">
          {projects.map((p) => (
            <li key={p.id} className="rule-t py-2 text-ink-soft">{p.name}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
