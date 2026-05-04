"use client";

import { useState } from "react";

type ImportResult = {
  total_records: number;
  accepted_records: number;
  rejected_records: number;
  sample_titles: string[];
  errors: string[];
};

const examplePayload = JSON.stringify(
  {
    source_type: "json",
    records: [
      {
        id: "sample-course-1",
        course_title: "知見共有デザイン演習",
        instructor: "田中研究室",
        term: "前期",
        day: "火",
        period: "3",
        program: "学部横断",
        grade: "1-4年",
        credits: "2",
        contents: "5分Sync を中心にした知見接続の設計演習",
        lecture_plan: ["導入", "ネットワーク分析", "実践"],
        departments: ["工学部", "教育学部"],
      },
    ],
  },
  null,
  2,
);

export function CourseImportPanel() {
  const [payload, setPayload] = useState(examplePayload);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, setPending] = useState<"validate" | "commit" | null>(null);
  const [error, setError] = useState("");

  async function run(action: "validate" | "commit") {
    setPending(action);
    setError("");
    try {
      const response = await fetch(`/api/proxy/v1/admin/imports/courses/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: payload,
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setResult((await response.json()) as ImportResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_12px_45px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Import Flow</p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">コース取込</h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-stone-500">
          <code>validate -&gt; commit</code> の 2 段階を管理画面から実行できます。ここに CSV 変換後や JSON の内容を貼れば API 側で検証されます。
        </p>
      </div>

      <textarea
        value={payload}
        onChange={(event) => setPayload(event.target.value)}
        className="mt-6 min-h-[280px] w-full rounded-3xl border border-stone-200 bg-stone-50 p-4 font-mono text-xs leading-6 outline-none transition focus:border-stone-900"
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => run("validate")}
          disabled={pending !== null}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-900 disabled:cursor-not-allowed disabled:border-stone-200"
        >
          {pending === "validate" ? "検証中..." : "validate"}
        </button>
        <button
          type="button"
          onClick={() => run("commit")}
          disabled={pending !== null}
          className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {pending === "commit" ? "反映中..." : "commit"}
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

      {result ? (
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-3xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Total</p>
            <p className="mt-2 text-3xl font-semibold text-stone-950">{result.total_records}</p>
          </div>
          <div className="rounded-3xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Accepted</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-700">{result.accepted_records}</p>
          </div>
          <div className="rounded-3xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Rejected</p>
            <p className="mt-2 text-3xl font-semibold text-rose-700">{result.rejected_records}</p>
          </div>
          <div className="rounded-3xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Samples</p>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              {result.sample_titles.join(" / ") || "なし"}
            </p>
          </div>
          {result.errors.length > 0 ? (
            <div className="md:col-span-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {result.errors.join(" / ")}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
