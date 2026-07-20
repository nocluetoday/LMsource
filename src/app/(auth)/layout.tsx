import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-6">
      <div className="w-full max-w-sm pt-20 pb-24">
        <Link href="/" className="font-serif text-xl tracking-tight">
          LM<span className="text-teal">Source</span>
        </Link>
        <div className="rule-heavy mt-6 bg-paper-raised p-6 shadow-[0_1px_0_var(--rule)]">
          {children}
        </div>
      </div>
    </main>
  );
}
