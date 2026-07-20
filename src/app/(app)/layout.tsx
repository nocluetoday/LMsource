import Link from "next/link";
import { requireSession } from "@/auth/session";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const scopusEnabled = Boolean(process.env.ELSEVIER_API_KEY);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-rule bg-paper-raised">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="font-serif text-lg tracking-tight">
            LM<span className="text-teal">Source</span>
          </Link>
          <div className="flex items-center gap-4 text-[13px] text-ink-soft">
            {!scopusEnabled && (
              <span className="bg-amber-wash px-2 py-1 font-mono text-[11px] uppercase tracking-wide text-amber">
                degraded mode — no Scopus key
              </span>
            )}
            <span>{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
