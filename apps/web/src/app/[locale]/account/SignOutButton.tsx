"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => void signOut({ callbackUrl: "/" })}
      className="rounded border border-navy/20 px-3 py-1.5 text-xs text-navy/50 transition hover:border-navy/40 hover:text-navy"
    >
      サインアウト
    </button>
  );
}
