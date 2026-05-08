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
    <div className="grid min-h-[calc(100vh-4rem)] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_430px]">
      <section className="overflow-hidden rounded-xl border border-[#d8dee4] bg-white shadow-xl shadow-slate-200/70">
          <div className="p-7 md:p-10">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-[#24292f] text-sm font-black tracking-[0.18em] text-white">
                KM
              </div>
              <div>
                <p className="text-sm font-bold text-[#24292f]">Knowledge Mesh</p>
                <p className="text-xs text-[#57606a]">わからないことをすぐ聞いて、議論できる学習コミュニティ</p>
              </div>
            </div>

            <p className="mt-12 text-xs font-bold uppercase tracking-[0.28em] text-[#57606a]">
              Sign in
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-black leading-tight tracking-[-0.05em] md:text-6xl">
              議論で
              <span className="text-[#1f883d]"> 理解が変わる。</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#57606a]">
              仲間と議論できる学習コミュニティ
            </p>

            <form onSubmit={handleSubmit} className="mt-8 max-w-xl rounded-xl border border-[#d8dee4] bg-[#f6f8fa] p-5">
              <div className="grid gap-4">
                <label className="grid gap-2 text-sm font-bold text-[#24292f]">
                  ユーザー名
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="rounded-md border border-[#d0d7de] bg-white px-4 py-3 text-base outline-none transition focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
                    placeholder="tanaka.sensei"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-[#24292f]">
                  パスワード
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="rounded-md border border-[#d0d7de] bg-white px-4 py-3 text-base outline-none transition focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
                    placeholder="demo1234"
                  />
                </label>
              </div>

              {error ? <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p> : null}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-[#1f883d] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#1a7f37] disabled:cursor-not-allowed disabled:bg-stone-400"
                >
                  {pending ? "ログイン中..." : "ログイン"}
                </button>
                {process.env.NEXT_PUBLIC_ENABLE_OIDC === "true" ? (
                  <button
                    type="button"
                    onClick={() => signIn("oidc", { callbackUrl: "/dashboard" })}
                    className="rounded-md border border-[#d0d7de] bg-white px-6 py-3 text-sm font-bold text-[#24292f] transition hover:border-[#8c959f]"
                  >
                    SSO でログイン
                  </button>
                ) : null}
                <a
                  href="/register"
                  className="text-sm font-semibold text-[#0969da] hover:underline"
                >
                  新規登録
                </a>
              </div>
            </form>
          </div>
      </section>

      <aside className="rounded-xl border border-[#d8dee4] bg-white p-5 shadow-xl shadow-slate-200/70">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#57606a]">Demo Accounts</p>
        <div className="mt-4 grid gap-3">
          {demoAccounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => {
                setUsername(account.username);
                setPassword(account.password);
              }}
              className="rounded-xl border border-[#d8dee4] bg-[#f6f8fa] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#0969da] hover:bg-white hover:shadow-lg"
            >
              <p className="text-sm font-black text-[#24292f]">{account.displayName}</p>
              <p className="mt-1 text-xs font-semibold text-[#57606a]">
                {account.username} / {account.password}
              </p>
              <p className="mt-3 text-sm leading-6 text-[#57606a]">{account.demoNote}</p>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
