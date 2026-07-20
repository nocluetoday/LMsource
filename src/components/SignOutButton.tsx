"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/auth/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="cursor-pointer text-ink-soft transition-colors hover:text-teal"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
