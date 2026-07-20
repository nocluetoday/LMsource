"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/auth/session";
import { getDb } from "@/db/kysely";

export async function createProject(formData: FormData) {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await getDb()
    .insertInto("projects")
    .values({ user_id: session.user.id, name })
    .execute();
  revalidatePath("/dashboard");
}

export async function createQuestion(formData: FormData) {
  const session = await requireSession();
  const projectId = String(formData.get("project_id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!projectId || !text) return;
  const db = getDb();
  const project = await db
    .selectFrom("projects")
    .select("id")
    .where("id", "=", projectId)
    .where("user_id", "=", session.user.id)
    .executeTakeFirst();
  if (!project) throw new Error("Project not found");
  const question = await db
    .insertInto("questions")
    .values({ project_id: projectId, text })
    .returning("id")
    .executeTakeFirstOrThrow();
  redirect(`/questions/${question.id}`);
}
