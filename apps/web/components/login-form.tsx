"use client";

import { startTransition, useState } from "react";
import { signIn } from "next-auth/react";

import { demoAccounts } from "@/lib/demo-accounts";

export function LoginForm() {
  const [username, setUsername] = useState(demoAccounts[0]?.username ?? "");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const result = await signIn("dev-credentials", {
      username,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    startTransition(() => {
      setPending(false);
    });

    if (result?.error) {
      setError("ログインに失敗しました。ユーザー名とパスワードを確認してください。");
      return;
    }

    window.location.href = result?.url ?? "/dashboard";
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur"
      >
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.25em] text-amber-700">5分Sync Login</p>
          <h1 className="text-3xl font-semibold text-stone-950">Knowledge Mesh</h1>
          <p className="max-w-xl text-sm leading-7 text-stone-600">
            大学内に散らばった知見を、5分Syncでつなぐための運用基盤です。開発モードでは下のデモアカウントでそのまま入れます。
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            ユーザー名
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-base outline-none transition focus:border-stone-900"
              placeholder="tanaka.sensei"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            パスワード
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-base outline-none transition focus:border-stone-900"
              placeholder="demo1234"
            />
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {pending ? "ログイン中..." : "ダッシュボードへ入る"}
          </button>
          {process.env.NEXT_PUBLIC_ENABLE_OIDC === "true" ? (
            <button
              type="button"
              onClick={() => signIn("oidc", { callbackUrl: "/dashboard" })}
              className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-900"
            >
              SSO でログイン
            </button>
          ) : null}
        </div>
      </form>

      <aside className="rounded-[2rem] border border-stone-200/80 bg-[#f5f1e8] p-6 shadow-[0_14px_50px_rgba(120,113,108,0.12)]">
        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Demo Accounts</p>
        <div className="mt-4 grid gap-3">
          {demoAccounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => {
                setUsername(account.username);
                setPassword(account.password);
              }}
              className="rounded-3xl border border-white/80 bg-white/90 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <p className="text-sm font-semibold text-stone-900">{account.displayName}</p>
              <p className="mt-1 text-xs text-stone-500">
                {account.username} / {account.password}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">{account.demoNote}</p>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
