"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type Community = { id: string; name: string };

interface Props {
  communities: Community[];
}

export function RegisterForm({ communities }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [communityId, setCommunityId] = useState(communities[0]?.id ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          display_name: displayName,
          community_id: communityId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { detail?: string };
        setError(data.detail ?? "登録に失敗しました.");
        setPending(false);
        return;
      }

      const result = await signIn("dev-credentials", {
        username,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        setError("アカウントを作成しましたが、ログインに失敗しました. 手動でログインしてください.");
        setPending(false);
        return;
      }

      router.push(result?.url ?? "/dashboard");
    } catch {
      setError("ネットワークエラーが発生しました.");
      setPending(false);
    }
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
              <p className="text-xs text-[#57606a]">SOS と 5分Sync の知見ネットワーク</p>
            </div>
          </div>

          <p className="mt-12 text-xs font-bold uppercase tracking-[0.28em] text-[#57606a]">
            Sign up
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-[-0.05em] md:text-5xl">
            ナレッジグラフに
            <br />
            参加する。
          </h1>
          <p className="mt-5 text-base leading-8 text-[#57606a]">
            アカウントを作成して、キャンパスの知見ネットワークに接続しましょう。
          </p>

          <form onSubmit={handleSubmit} className="mt-8 max-w-xl rounded-xl border border-[#d8dee4] bg-[#f6f8fa] p-5">
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-[#24292f]">
                表示名
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="rounded-md border border-[#d0d7de] bg-white px-4 py-3 text-base outline-none transition focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
                  placeholder="例: 田中 太郎"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-[#24292f]">
                ユーザー名
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="rounded-md border border-[#d0d7de] bg-white px-4 py-3 text-base outline-none transition focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
                  placeholder="半角英数字・ドット可"
                  autoComplete="username"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-[#24292f]">
                パスワード
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-md border border-[#d0d7de] bg-white px-4 py-3 text-base outline-none transition focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
                  placeholder="6文字以上"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-[#24292f]">
                キャンパス
                <select
                  value={communityId}
                  onChange={(e) => setCommunityId(e.target.value)}
                  className="rounded-md border border-[#d0d7de] bg-white px-4 py-3 text-base outline-none transition focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20"
                >
                  {communities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p> : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-[#1f883d] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#1a7f37] disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                {pending ? "登録中..." : "アカウントを作成"}
              </button>
              <a
                href="/login"
                className="text-sm font-semibold text-[#0969da] hover:underline"
              >
                ログインに戻る
              </a>
            </div>
          </form>
        </div>
      </section>

      <aside className="rounded-xl border border-[#d8dee4] bg-white p-6 shadow-xl shadow-slate-200/70">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#57606a]">登録後にできること</p>
        <ul className="mt-4 grid gap-3">
          {[
            { icon: "🆘", text: "SOS を送って5分以内に助けを求める" },
            { icon: "🔗", text: "知見グラフに自分のノードを追加する" },
            { icon: "📚", text: "学びたいこと・教えられることでマッチング" },
            { icon: "📅", text: "勉強会・イベントに参加する" },
          ].map(({ icon, text }) => (
            <li key={text} className="flex items-start gap-3 rounded-lg border border-[#d8dee4] bg-[#f6f8fa] p-4">
              <span className="text-xl">{icon}</span>
              <p className="text-sm leading-6 text-[#57606a]">{text}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
