/**
 * /login
 *
 * Email magic-link sign-in page.
 * Submitting the form calls Auth.js signIn("resend") server action.
 */

import type { Metadata }  from "next";
import { redirect }       from "next/navigation";
import { auth }           from "@/auth";
import { LoginForm }       from "./LoginForm";

export const metadata: Metadata = {
  title:  "ログイン | Global Card Index",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: { callbackUrl?: string; error?: string };
};

export default async function LoginPage({ searchParams }: Props) {
  // Already logged in → redirect
  const session = await auth();
  if (session) redirect(searchParams.callbackUrl ?? "/account");

  const callbackUrl = searchParams.callbackUrl ?? "/account";
  const error       = searchParams.error;

  return (
    <div className="mx-auto max-w-sm space-y-8 px-4 py-16 sm:px-0">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-navy/40">Global Card Index</p>
        <h1 className="text-2xl font-semibold text-navy">サインイン</h1>
        <p className="text-sm text-navy/60">
          メールアドレスを入力するだけで OK。<br />
          パスワード不要のリンク認証です。
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage(error)}
        </div>
      )}

      <LoginForm callbackUrl={callbackUrl} />

      <p className="text-xs text-navy/35 text-center">
        サインインすることで{" "}
        <a href="/terms" className="underline hover:text-navy/60">利用規約</a>
        {" "}に同意したことになります。
      </p>
    </div>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case "OAuthSignin":
    case "OAuthCallback":
    case "OAuthCreateAccount":
      return "認証に失敗しました。もう一度お試しください。";
    case "EmailCreateAccount":
    case "Callback":
      return "アカウント作成に失敗しました。";
    case "EmailSignin":
      return "メール送信に失敗しました。アドレスを確認してください。";
    case "CredentialsSignin":
      return "ログイン情報が正しくありません。";
    case "SessionRequired":
      return "続けるにはサインインが必要です。";
    case "Verification":
      return "リンクが無効または期限切れです。もう一度お試しください。";
    default:
      return "エラーが発生しました。もう一度お試しください。";
  }
}
