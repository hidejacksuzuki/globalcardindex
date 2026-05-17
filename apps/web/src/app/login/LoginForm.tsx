"use client";

/**
 * LoginForm — client component
 *
 * Calls the Auth.js signIn server action.
 * Kept as a separate client component so the parent /login page
 * can remain a Server Component (for auth() redirect check).
 */

import { useState, useTransition } from "react";

type Props = { callbackUrl: string };

export function LoginForm({ callbackUrl }: Props) {
  const [email,    setEmail]    = useState("");
  const [sent,     setSent]     = useState(false);
  const [pending,  startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const emailValue = email.trim().toLowerCase();
    if (!emailValue) return;
    setErrorMsg("");

    startTransition(async () => {
      try {
        // POST to Auth.js API — equivalent to signIn("resend", { email, redirectTo })
        const res = await fetch("/api/auth/signin/resend", {
          method:  "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body:    new URLSearchParams({
            email:      emailValue,
            csrfToken:  await getCsrfToken(),
            callbackUrl,
            json:       "true",
          }),
        });
        if (res.ok || res.status === 302) {
          setSent(true);
        } else {
          setErrorMsg("メール送信に失敗しました。もう一度お試しください。");
        }
      } catch {
        setErrorMsg("ネットワークエラーが発生しました。");
      }
    });
  };

  if (sent) {
    return (
      <div className="rounded border border-green-200 bg-green-50 px-5 py-6 text-center space-y-2">
        <p className="text-lg font-medium text-green-800">📧 メールを送信しました</p>
        <p className="text-sm text-green-700">
          <strong>{email}</strong> にログインリンクをお送りしました。<br />
          メールボックスを確認してください（有効期限: 10分）。
        </p>
        <button
          onClick={() => { setSent(false); setEmail(""); }}
          className="mt-3 text-xs text-green-600 underline hover:text-green-800"
        >
          別のメールアドレスで試す
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-navy/50">
          メールアドレス
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full rounded border border-navy/20 px-4 py-3 text-sm text-navy outline-none focus:border-navy/60 focus:ring-0"
        />
      </div>

      {errorMsg && (
        <p className="text-xs text-red-600">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={pending || !email.trim()}
        className="w-full rounded border border-navy bg-navy py-3 text-sm font-medium text-white transition hover:bg-navy/90 disabled:opacity-40"
      >
        {pending ? "送信中…" : "ログインリンクを送る"}
      </button>
    </form>
  );
}

// ── CSRF token helper ─────────────────────────────────────────────

async function getCsrfToken(): Promise<string> {
  try {
    const res  = await fetch("/api/auth/csrf");
    const data = await res.json() as { csrfToken: string };
    return data.csrfToken ?? "";
  } catch {
    return "";
  }
}
